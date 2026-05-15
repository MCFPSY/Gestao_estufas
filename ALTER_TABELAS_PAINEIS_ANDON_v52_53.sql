-- ===================================================================
-- v2.52.53 — Migrar paineis_andon para suportar 1/2/3 zonas por painel.
--
-- Estratégia: ADITIVA. Adiciona colunas novas, faz backfill das colunas
-- antigas, mas NÃO apaga as colunas antigas (estado_atual / mensagem_atual /
-- estado_anterior / estado_novo / mensagem). Ficam como backup.
-- Idempotente — seguro de re-correr.
-- ===================================================================

-- 1. paineis_andon: novas colunas layout + zonas
ALTER TABLE paineis_andon
    ADD COLUMN IF NOT EXISTS layout INT DEFAULT 1 CHECK (layout IN (1,2,3));

ALTER TABLE paineis_andon
    ADD COLUMN IF NOT EXISTS zonas JSONB DEFAULT '[{"estado":"verde","mensagem":"OK"}]'::jsonb;

-- Backfill: para cada linha existente, criar zonas a partir das colunas antigas
UPDATE paineis_andon
SET zonas = jsonb_build_array(
    jsonb_build_object(
        'estado',   COALESCE(estado_atual, 'verde'),
        'mensagem', COALESCE(mensagem_atual, 'OK')
    )
)
WHERE zonas = '[{"estado":"verde","mensagem":"OK"}]'::jsonb
   OR zonas IS NULL;

-- 2. paineis_andon_presets: novas colunas layout + zonas
ALTER TABLE paineis_andon_presets
    ADD COLUMN IF NOT EXISTS layout INT DEFAULT 1 CHECK (layout IN (1,2,3));

ALTER TABLE paineis_andon_presets
    ADD COLUMN IF NOT EXISTS zonas JSONB;

UPDATE paineis_andon_presets
SET zonas = jsonb_build_array(
    jsonb_build_object('estado', estado, 'mensagem', mensagem)
)
WHERE zonas IS NULL;

-- 3. paineis_andon_historico: novas colunas para registar layouts e zonas inteiros
ALTER TABLE paineis_andon_historico
    ADD COLUMN IF NOT EXISTS layout_anterior INT;

ALTER TABLE paineis_andon_historico
    ADD COLUMN IF NOT EXISTS layout_novo INT;

ALTER TABLE paineis_andon_historico
    ADD COLUMN IF NOT EXISTS zonas_anteriores JSONB;

ALTER TABLE paineis_andon_historico
    ADD COLUMN IF NOT EXISTS zonas_novas JSONB;

-- Permitir que estado_novo seja NULL (já não obrigamos a escrever, é legacy)
ALTER TABLE paineis_andon_historico
    ALTER COLUMN estado_novo DROP NOT NULL;

-- ===================================================================
-- VERIFICAÇÃO
-- ===================================================================
-- SELECT id, layout, zonas FROM paineis_andon LIMIT 3;
-- SELECT nome, layout, zonas FROM paineis_andon_presets;
-- ===================================================================
