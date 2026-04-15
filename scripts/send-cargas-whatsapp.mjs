#!/usr/bin/env node
/**
 * PSY Gestão — Envio diário de cargas por WhatsApp (Twilio)
 * Gera imagem do mapa de cargas do dia e envia para lista de números.
 *
 * Variáveis de ambiente necessárias:
 *   TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM (whatsapp:+14155238886)
 *   SUPABASE_URL, SUPABASE_KEY
 *   WHATSAPP_NUMBERS (comma-separated: +351937742261,+351912345678)
 */

import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const {
    TWILIO_SID,
    TWILIO_TOKEN,
    TWILIO_FROM = 'whatsapp:+14155238886',
    SUPABASE_URL,
    SUPABASE_KEY,
    WHATSAPP_NUMBERS,
} = process.env;

if (!TWILIO_SID || !TWILIO_TOKEN || !SUPABASE_URL || !SUPABASE_KEY || !WHATSAPP_NUMBERS) {
    console.error('❌ Variáveis de ambiente em falta. Necessárias: TWILIO_SID, TWILIO_TOKEN, SUPABASE_URL, SUPABASE_KEY, WHATSAPP_NUMBERS');
    process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Helpers ──────────────────────────────────────────────

function buildTransportBlocks(rows) {
    const blocks = [];
    let currentBlock = null;
    for (const row of rows) {
        const transp = (row.transp || '').trim();
        const hasData = (row.cliente || '').trim() || (row.medida || '').trim() || (row.qtd || '').trim();
        if (transp) {
            currentBlock = {
                transp,
                horario_carga: (row.horario_carga || '').trim(),
                nviagem: (row.nviagem || '').trim(),
                items: [],
                totalQtd: 0,
            };
            blocks.push(currentBlock);
        }
        if (currentBlock && (transp || hasData)) {
            const qty = parseInt((row.qtd || '0').replace(/\./g, '').split(',')[0]) || 0;
            currentBlock.items.push({
                cliente: (row.cliente || '').trim(),
                local: (row.local || '').trim(),
                medida: (row.medida || '').trim(),
                qtd: row.qtd || '',
                enc: (row.enc || '').trim(),
            });
            currentBlock.totalQtd += qty;
        }
    }
    return blocks;
}

// ── Fetch today's data ───────────────────────────────────

async function fetchTodayCargas() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const monthAbbrs = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
    const monthAbbr = monthAbbrs[now.getMonth()];
    const year = now.getFullYear();
    const dateStr = `${day}/${monthAbbr}`;
    const dayNames = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
    const dayName = dayNames[now.getDay()];

    console.log(`📅 Buscando cargas para ${dateStr} (${dayName})...`);

    const { data, error } = await db
        .from('mapa_encomendas')
        .select('*')
        .eq('month', monthAbbr)
        .eq('year', year)
        .eq('date', dateStr)
        .order('row_order', { ascending: true });

    if (error) throw error;
    return { rows: data || [], dateStr, dayName, day, monthAbbr, year };
}

// ── Generate HTML ────────────────────────────────────────

function generateCargasHtml(blocks, dateStr, dayName) {
    const timeSlots = [
        'Sem Horário',
        '06:00 - 08:00', '08:00 - 10:00', '10:00 - 12:00',
        '12:00 - 14:00', '14:00 - 16:00', '16:00 - 18:00', '18:00 - 20:00',
    ];

    // Group blocks by slot
    const bySlot = {};
    timeSlots.forEach(s => bySlot[s] = []);
    blocks.forEach(b => {
        const h = b.horario_carga || 'Sem Horário';
        const slot = timeSlots.includes(h) ? h : 'Sem Horário';
        bySlot[slot].push(b);
    });

    const totalPallets = blocks.reduce((s, b) => s + b.totalQtd, 0);

    let rows = '';
    timeSlots.forEach(slot => {
        const slotBlocks = bySlot[slot];
        if (slotBlocks.length === 0) {
            // Empty slot — show it greyed out
            rows += `<tr class="empty-slot">
                <td class="slot-cell">${slot}</td>
                <td colspan="5" style="color:#ccc;text-align:center;">—</td>
            </tr>`;
            return;
        }
        let first = true;
        slotBlocks.forEach(block => {
            block.items.forEach((item, ii) => {
                rows += `<tr>`;
                if (first) {
                    const totalRows = slotBlocks.reduce((s, b) => s + b.items.length, 0);
                    rows += `<td class="slot-cell" rowspan="${totalRows}">${slot}</td>`;
                    first = false;
                }
                if (ii === 0) {
                    rows += `<td class="transp-cell" rowspan="${block.items.length}">
                        🚚 ${block.transp}
                        ${block.nviagem ? `<br><small>NV: ${block.nviagem}</small>` : ''}
                    </td>`;
                }
                rows += `<td>${item.cliente}</td>`;
                rows += `<td>${item.local}</td>`;
                rows += `<td>${item.medida}</td>`;
                rows += `<td class="qty">${item.qtd}</td>`;
                rows += `</tr>`;
            });
        });
    });

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f7; padding: 20px; width: 900px; }
    .header { background: linear-gradient(135deg, #1a1a2e, #16213e); color: white; padding: 20px 24px; border-radius: 12px 12px 0 0; }
    .header h1 { font-size: 22px; margin-bottom: 4px; }
    .header .sub { font-size: 13px; color: #aab; }
    .stats { display: flex; gap: 16px; padding: 12px 24px; background: #e8f4fd; border-bottom: 2px solid #007AFF; }
    .stat { font-size: 13px; font-weight: 600; }
    .stat .num { font-size: 20px; color: #007AFF; }
    table { width: 100%; border-collapse: collapse; background: white; }
    th { background: #333; color: white; padding: 8px 10px; text-align: left; font-size: 11px; }
    td { padding: 6px 10px; border: 1px solid #e0e0e0; font-size: 11px; vertical-align: top; }
    .slot-cell { font-weight: 700; background: #f0f4ff; width: 110px; text-align: center; font-size: 12px; }
    .transp-cell { font-weight: 700; background: #fff8e1; width: 140px; }
    .qty { text-align: right; font-weight: 600; }
    .empty-slot td { background: #fafafa; }
    .footer { padding: 10px 24px; background: white; border-radius: 0 0 12px 12px; border-top: 1px solid #e0e0e0; font-size: 10px; color: #999; text-align: right; }
</style></head><body>
<div class="header">
    <h1>🚚 Cargas do Dia — ${dateStr} (${dayName})</h1>
    <div class="sub">PSY — Gestão de Estufas e Cargas | Gerado: ${new Date().toLocaleString('pt-PT')}</div>
</div>
<div class="stats">
    <div class="stat"><div class="num">${blocks.length}</div>entrega(s)</div>
    <div class="stat"><div class="num">${totalPallets.toLocaleString('pt-PT')}</div>paletes total</div>
</div>
<table>
<thead><tr>
    <th>Horário</th><th>Transporte</th><th>Cliente</th><th>Local</th><th>Medida</th><th style="text-align:right">Qtd</th>
</tr></thead>
<tbody>${rows}</tbody>
</table>
<div class="footer">PalSystems — Envio automático diário</div>
</body></html>`;
}

// ── Screenshot HTML → PNG ────────────────────────────────

async function htmlToImage(html) {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 920, height: 800 });
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Auto-size to content
    const bodyHandle = await page.$('body');
    const { height } = await bodyHandle.boundingBox();
    await page.setViewport({ width: 920, height: Math.ceil(height) + 40 });

    const imageBuffer = await page.screenshot({ type: 'png', fullPage: true });
    await browser.close();
    return imageBuffer;
}

// ── Upload to Supabase Storage ───────────────────────────

async function uploadImage(buffer, filename) {
    // Ensure bucket exists
    const { error: bucketError } = await db.storage.createBucket('cargas-whatsapp', {
        public: true,
        fileSizeLimit: 5242880,
    });
    // Ignore "already exists" error

    const { data, error } = await db.storage
        .from('cargas-whatsapp')
        .upload(filename, buffer, {
            contentType: 'image/png',
            upsert: true,
        });

    if (error) throw error;

    const { data: urlData } = db.storage
        .from('cargas-whatsapp')
        .getPublicUrl(filename);

    return urlData.publicUrl;
}

// ── Send WhatsApp via Twilio ─────────────────────────────

async function sendWhatsApp(to, body, mediaUrl) {
    const params = new URLSearchParams();
    params.append('To', `whatsapp:${to}`);
    params.append('From', TWILIO_FROM);
    params.append('Body', body);
    if (mediaUrl) params.append('MediaUrl', mediaUrl);

    const resp = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
        {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        }
    );
    const result = await resp.json();
    if (result.error_code) throw new Error(`Twilio error: ${result.error_message}`);
    return result;
}

// ── Main ─────────────────────────────────────────────────

async function main() {
    console.log('🚀 PSY Cargas WhatsApp — Início');

    // 1. Fetch data
    const { rows, dateStr, dayName } = await fetchTodayCargas();
    console.log(`📊 ${rows.length} linhas encontradas para ${dateStr}`);

    // 2. Build transport blocks
    const blocks = buildTransportBlocks(rows);
    console.log(`🚚 ${blocks.length} entregas agrupadas`);

    if (blocks.length === 0) {
        console.log('⚠️ Sem cargas para hoje. Enviando aviso...');
        const numbers = WHATSAPP_NUMBERS.split(',').map(n => n.trim());
        for (const num of numbers) {
            await sendWhatsApp(num, `📅 ${dateStr} (${dayName})\n\n✅ Sem cargas programadas para hoje.`);
            console.log(`✅ Aviso enviado para ${num}`);
        }
        return;
    }

    // 3. Generate HTML & screenshot
    const html = generateCargasHtml(blocks, dateStr, dayName);
    console.log('🖼️ Gerando imagem...');
    const imageBuffer = await htmlToImage(html);

    // 4. Upload to Supabase Storage
    const filename = `cargas-${dateStr.replace('/', '-')}.png`;
    console.log(`☁️ Uploading ${filename}...`);
    const imageUrl = await uploadImage(imageBuffer, filename);
    console.log(`✅ Imagem: ${imageUrl}`);

    // 5. Send to all numbers
    const numbers = WHATSAPP_NUMBERS.split(',').map(n => n.trim());
    const totalPallets = blocks.reduce((s, b) => s + b.totalQtd, 0);
    const body = `🚚 *Cargas ${dateStr} (${dayName})*\n\n📦 ${blocks.length} entrega(s) | ${totalPallets.toLocaleString('pt-PT')} paletes\n\n_PSY Gestão de Estufas_`;

    for (const num of numbers) {
        const result = await sendWhatsApp(num, body, imageUrl);
        console.log(`✅ Enviado para ${num} (SID: ${result.sid})`);
    }

    console.log('🎉 Concluído!');
}

main().catch(err => {
    console.error('❌ Erro:', err);
    process.exit(1);
});
