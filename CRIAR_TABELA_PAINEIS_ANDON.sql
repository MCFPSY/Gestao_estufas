-- ===================================================================
-- TABELAS: paineis_andon, paineis_andon_historico, paineis_andon_presets
-- v2.52.49 — Sistema de sinalização visual industrial (LED P10 + Huidu)
--
-- IMPORTANTE: este script só CRIA tabelas e INSERE seeds. Não toca
-- nenhuma tabela existente. Idempotente — seguro de re-correr.
-- ===================================================================

-- 1. Tabela principal: configuração e estado actual de cada painel
CREATE TABLE IF NOT EXISTS paineis_andon (
    id              TEXT PRIMARY KEY,                   -- slug: 'psy-posto-01'
    nome            TEXT NOT NULL,                      -- 'PSY Posto 01'
    fabrica         TEXT NOT NULL CHECK (fabrica IN ('PSY','MCF')),
    localizacao     TEXT,                               -- descritivo livre
    ip_local        TEXT NOT NULL,                      -- '192.168.1.51'
    ativo           BOOLEAN DEFAULT TRUE,

    estado_atual    TEXT DEFAULT 'verde' CHECK (estado_atual IN ('verde','amarelo','vermelho')),
    mensagem_atual  TEXT DEFAULT 'OK',
    cor_fundo       TEXT,                               -- hex opcional (override do estado)
    cor_texto       TEXT,                               -- hex opcional

    online          BOOLEAN DEFAULT FALSE,              -- derivado pelo bridge daemon
    ultimo_ping_em  TIMESTAMPTZ,

    criado_em       TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paineis_fabrica ON paineis_andon(fabrica);
CREATE INDEX IF NOT EXISTS idx_paineis_ativo   ON paineis_andon(ativo) WHERE ativo = TRUE;

-- 2. Histórico de mudanças de estado (auditoria)
CREATE TABLE IF NOT EXISTS paineis_andon_historico (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    painel_id        TEXT NOT NULL REFERENCES paineis_andon(id) ON DELETE CASCADE,
    estado_anterior  TEXT,
    estado_novo      TEXT NOT NULL,
    mensagem         TEXT,
    alterado_por     TEXT,                              -- email/username do user
    criado_em        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paineis_historico_painel ON paineis_andon_historico(painel_id, criado_em DESC);

-- 3. Presets de mensagens (botões rápidos no UI)
CREATE TABLE IF NOT EXISTS paineis_andon_presets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome        TEXT NOT NULL,
    estado      TEXT NOT NULL CHECK (estado IN ('verde','amarelo','vermelho')),
    mensagem    TEXT NOT NULL,
    cor_fundo   TEXT,
    cor_texto   TEXT,
    fabrica     TEXT CHECK (fabrica IS NULL OR fabrica IN ('PSY','MCF')),  -- NULL = global
    ordem       INTEGER DEFAULT 0,
    criado_em   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paineis_presets_ordem ON paineis_andon_presets(ordem);

-- 4. RLS — autenticados podem tudo (interno, não cliente-facing)
ALTER TABLE paineis_andon ENABLE ROW LEVEL SECURITY;
ALTER TABLE paineis_andon_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE paineis_andon_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "paineis_andon_auth_all" ON paineis_andon;
CREATE POLICY "paineis_andon_auth_all" ON paineis_andon
    FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "paineis_andon_historico_auth_all" ON paineis_andon_historico;
CREATE POLICY "paineis_andon_historico_auth_all" ON paineis_andon_historico
    FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "paineis_andon_presets_auth_all" ON paineis_andon_presets;
CREATE POLICY "paineis_andon_presets_auth_all" ON paineis_andon_presets
    FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- 5. Trigger para manter atualizado_em coerente em UPDATEs
CREATE OR REPLACE FUNCTION trg_paineis_andon_touch() RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS paineis_andon_touch ON paineis_andon;
CREATE TRIGGER paineis_andon_touch
    BEFORE UPDATE ON paineis_andon
    FOR EACH ROW EXECUTE FUNCTION trg_paineis_andon_touch();

-- 6. Seed: 10 paineis PSY com placeholders. Renomear via UI depois.
INSERT INTO paineis_andon (id, nome, fabrica, localizacao, ip_local, estado_atual, mensagem_atual) VALUES
    ('psy-posto-01', 'PSY Posto 01', 'PSY', 'A definir', '192.168.1.51', 'verde', 'OK'),
    ('psy-posto-02', 'PSY Posto 02', 'PSY', 'A definir', '192.168.1.52', 'verde', 'OK'),
    ('psy-posto-03', 'PSY Posto 03', 'PSY', 'A definir', '192.168.1.53', 'verde', 'OK'),
    ('psy-posto-04', 'PSY Posto 04', 'PSY', 'A definir', '192.168.1.54', 'verde', 'OK'),
    ('psy-posto-05', 'PSY Posto 05', 'PSY', 'A definir', '192.168.1.55', 'verde', 'OK'),
    ('psy-posto-06', 'PSY Posto 06', 'PSY', 'A definir', '192.168.1.56', 'verde', 'OK'),
    ('psy-posto-07', 'PSY Posto 07', 'PSY', 'A definir', '192.168.1.57', 'verde', 'OK'),
    ('psy-posto-08', 'PSY Posto 08', 'PSY', 'A definir', '192.168.1.58', 'verde', 'OK'),
    ('psy-posto-09', 'PSY Posto 09', 'PSY', 'A definir', '192.168.1.59', 'verde', 'OK'),
    ('psy-posto-10', 'PSY Posto 10', 'PSY', 'A definir', '192.168.1.60', 'verde', 'OK')
ON CONFLICT (id) DO NOTHING;

-- 7. Seed de presets standard
INSERT INTO paineis_andon_presets (nome, estado, mensagem, ordem) VALUES
    ('OK Produção',           'verde',    'OK',         10),
    ('Atenção',               'amarelo',  'ATENÇÃO',    20),
    ('Manutenção',            'amarelo',  'MANUT',      30),
    ('Paragem Programada',    'amarelo',  'PARAGEM',    40),
    ('Avaria',                'vermelho', 'AVARIA',     50),
    ('Fim de Turno',          'verde',    'FIM TURNO',  60)
ON CONFLICT DO NOTHING;

-- ===================================================================
-- VERIFICAÇÃO
-- ===================================================================
-- SELECT COUNT(*) FROM paineis_andon WHERE fabrica='PSY';  -- deve dar 10
-- SELECT COUNT(*) FROM paineis_andon_presets;              -- deve dar 6
-- ===================================================================
