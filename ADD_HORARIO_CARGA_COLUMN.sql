-- Adicionar coluna horario_carga à tabela mapa_encomendas
-- v2.51.0 - Feature: Horário de Carga

ALTER TABLE mapa_encomendas 
ADD COLUMN IF NOT EXISTS horario_carga TEXT;

-- Comentário da coluna
COMMENT ON COLUMN mapa_encomendas.horario_carga IS 'Horário de carga: 06:00-08:00, 08:00-10:00, ..., Manhã, Tarde';

-- Verificar estrutura
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'mapa_encomendas'
ORDER BY ordinal_position;
