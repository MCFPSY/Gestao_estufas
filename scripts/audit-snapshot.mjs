#!/usr/bin/env node
/**
 * PSY Gestão — Snapshot diário da tabela mapa_encomendas para audit log.
 *
 * Para cada (month, year) com dados, grava uma linha em
 * mapa_encomendas_audit_log com contagens agregadas. Permite detectar
 * flutuações anómalas (ex: corrupção que duplica 1000+ rows num segundo
 * ou perde 30% das encomendas) comparando entre dias.
 *
 * Variáveis de ambiente necessárias:
 *   SUPABASE_URL, SUPABASE_KEY
 */

import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Faltam variáveis de ambiente: SUPABASE_URL, SUPABASE_KEY');
    process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log('🔍 Audit snapshot — início', new Date().toISOString());

    // 1. Descobrir todos os (month, year) com dados — paginado para ultrapassar o limit 1000
    const allKeys = new Set();
    let from = 0;
    const PAGE = 1000;
    while (true) {
        const { data, error } = await db
            .from('mapa_encomendas')
            .select('month, year')
            .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        data.forEach(r => allKeys.add(`${r.month}|${r.year}`));
        if (data.length < PAGE) break;
        from += PAGE;
        if (from > 500000) break; // safeguard
    }

    console.log(`📅 ${allKeys.size} pares (month, year) encontrados`);

    // 2. Para cada par, contar rows com critérios e gravar snapshot
    const snapshots = [];
    for (const key of allKeys) {
        const [month, yearStr] = key.split('|');
        const year = parseInt(yearStr, 10);

        // Precisamos paginar para não bater no limit 1000
        let all = [];
        let fromK = 0;
        while (true) {
            const { data, error } = await db
                .from('mapa_encomendas')
                .select('row_order, cliente, qtd, enc')
                .eq('month', month)
                .eq('year', year)
                .range(fromK, fromK + PAGE - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            all = all.concat(data);
            if (data.length < PAGE) break;
            fromK += PAGE;
            if (fromK > 50000) break;
        }

        const totalRows = all.length;
        const uniqueRowOrders = new Set(all.map(r => r.row_order)).size;
        const rowsWithCliente = all.filter(r => r.cliente && String(r.cliente).trim()).length;
        const rowsWithQtd = all.filter(r => r.qtd && String(r.qtd).trim()).length;
        const rowsWithEnc = all.filter(r => r.enc && String(r.enc).trim()).length;

        snapshots.push({
            month, year,
            total_rows: totalRows,
            unique_row_orders: uniqueRowOrders,
            rows_with_cliente: rowsWithCliente,
            rows_with_qtd: rowsWithQtd,
            rows_with_enc: rowsWithEnc,
            notes: uniqueRowOrders !== totalRows
                ? `⚠️ ${totalRows - uniqueRowOrders} linhas duplicadas por row_order`
                : null
        });
    }

    console.log('📊 Resumo dos snapshots:');
    snapshots.forEach(s => {
        const flag = s.notes ? '⚠️' : '✅';
        console.log(`  ${flag} ${s.month}/${s.year}: ${s.total_rows} rows, ${s.rows_with_cliente} com cliente${s.notes ? ' — ' + s.notes : ''}`);
    });

    // 3. Gravar em batch na audit log
    if (snapshots.length > 0) {
        const { error } = await db.from('mapa_encomendas_audit_log').insert(snapshots);
        if (error) throw error;
        console.log(`✅ ${snapshots.length} snapshot(s) gravados em mapa_encomendas_audit_log`);
    }

    // 4. Detecção de anomalia — comparar com snapshot anterior do mesmo (month, year)
    console.log('\n🔎 Detecção de anomalias vs snapshot anterior…');
    let anomalies = 0;
    for (const s of snapshots) {
        const { data: prev } = await db
            .from('mapa_encomendas_audit_log')
            .select('total_rows, rows_with_cliente, snapshot_at')
            .eq('month', s.month).eq('year', s.year)
            .lt('snapshot_at', new Date().toISOString())
            .order('snapshot_at', { ascending: false })
            .limit(1);

        if (!prev || prev.length === 0) continue;
        const p = prev[0];
        const rowDelta = s.total_rows - p.total_rows;
        const cliDelta = s.rows_with_cliente - p.rows_with_cliente;

        // Variação > 30% em qualquer direção é suspeita
        const rowPct = p.total_rows ? (rowDelta / p.total_rows) * 100 : 0;
        const cliPct = p.rows_with_cliente ? (cliDelta / p.rows_with_cliente) * 100 : 0;

        if (Math.abs(rowPct) > 30 || Math.abs(cliPct) > 30) {
            console.warn(`🚨 ANOMALIA ${s.month}/${s.year}: rows ${p.total_rows}→${s.total_rows} (${rowPct.toFixed(1)}%), cliente ${p.rows_with_cliente}→${s.rows_with_cliente} (${cliPct.toFixed(1)}%) desde ${p.snapshot_at}`);
            anomalies++;
        }
    }

    if (anomalies === 0) {
        console.log('✅ Sem anomalias detectadas.');
    } else {
        console.error(`🚨 ${anomalies} anomalia(s) detectadas — VERIFICA a BD manualmente.`);
        process.exit(2); // exit code 2 → GitHub Actions job aparece a amarelo/falhou
    }
}

main().catch(err => {
    console.error('❌ Erro no snapshot:', err);
    process.exit(1);
});
