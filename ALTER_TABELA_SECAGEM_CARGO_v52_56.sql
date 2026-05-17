-- ===================================================================
-- v2.52.56 — Ligar células de secagem_cargo a cargas (nº viagem)
--
-- Cada célula da matriz de paletes passa a poder estar (opcionalmente)
-- ligada a uma carga do Mapa de Encomendas, identificada por (date, nviagem).
--
-- Aditivo, idempotente, zero touch em dados existentes.
-- Sem foreign key (deliberado): se a linha do mapa for apagada, a
-- secagem continua a referenciá-la em texto. UI mostra "NV ??? — apagada".
-- ===================================================================

ALTER TABLE secagem_cargo
    ADD COLUMN IF NOT EXISTS carga_date    TEXT,   -- ex: '17/mai'
    ADD COLUMN IF NOT EXISTS carga_nviagem TEXT;   -- ex: '1234'

CREATE INDEX IF NOT EXISTS idx_secagem_cargo_carga
    ON secagem_cargo (carga_date, carga_nviagem)
    WHERE carga_nviagem IS NOT NULL;

-- ===================================================================
-- VERIFICAÇÃO
-- ===================================================================
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name='secagem_cargo' AND column_name LIKE 'carga_%';
-- ===================================================================
