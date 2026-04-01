-- ===================================================================
-- TABELA: mapa_encomendas
-- Descrição: Armazena as linhas do Mapa de Encomendas por mês/ano
-- ===================================================================

-- 1. Criar a tabela
CREATE TABLE IF NOT EXISTS mapa_encomendas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month TEXT NOT NULL,                  -- 'jan', 'fev', 'mar', 'abr', etc.
    year INTEGER NOT NULL,                -- 2026, 2027, etc.
    date TEXT NOT NULL,                   -- '01/mar', '02/mar', etc.
    row_order INTEGER NOT NULL,           -- Ordem da linha (0, 1, 2...)
    row_data JSONB DEFAULT '{}'::jsonb,   -- Dados da linha: { "sem": "1", "cliente": "Sonae", ... }
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_mapa_encomendas_month_year 
    ON mapa_encomendas(month, year);

CREATE INDEX IF NOT EXISTS idx_mapa_encomendas_order 
    ON mapa_encomendas(month, year, row_order);

-- 3. Ativar Row Level Security (RLS)
ALTER TABLE mapa_encomendas ENABLE ROW LEVEL SECURITY;

-- 4. Criar políticas de segurança

-- Política: Leitura (todos os utilizadores autenticados)
DROP POLICY IF EXISTS "Allow authenticated read mapa_encomendas" ON mapa_encomendas;
CREATE POLICY "Allow authenticated read mapa_encomendas"
    ON mapa_encomendas
    FOR SELECT
    TO authenticated
    USING (true);

-- Política: Inserção (todos os utilizadores autenticados)
DROP POLICY IF EXISTS "Allow authenticated insert mapa_encomendas" ON mapa_encomendas;
CREATE POLICY "Allow authenticated insert mapa_encomendas"
    ON mapa_encomendas
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Política: Atualização (todos os utilizadores autenticados)
DROP POLICY IF EXISTS "Allow authenticated update mapa_encomendas" ON mapa_encomendas;
CREATE POLICY "Allow authenticated update mapa_encomendas"
    ON mapa_encomendas
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Política: Eliminação (todos os utilizadores autenticados)
DROP POLICY IF EXISTS "Allow authenticated delete mapa_encomendas" ON mapa_encomendas;
CREATE POLICY "Allow authenticated delete mapa_encomendas"
    ON mapa_encomendas
    FOR DELETE
    TO authenticated
    USING (true);

-- 5. Verificar a estrutura
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'mapa_encomendas'
ORDER BY ordinal_position;

-- 6. Dados de exemplo (opcional - remover após testar)
/*
INSERT INTO mapa_encomendas (month, year, date, row_order, row_data) VALUES
('mar', 2026, '01/mar', 0, '{"sem": "1", "cliente": "Sonae", "local": "Porto", "medida": "1200x800", "qtd": "220"}'),
('mar', 2026, '01/mar', 1, '{"sem": "1", "cliente": "IKEA", "local": "Lisboa", "medida": "1000x600", "qtd": "180"}'),
('mar', 2026, '02/mar', 2, '{"sem": "1", "cliente": "Continente", "local": "Braga", "medida": "800x600", "qtd": "150"}');
*/

-- ===================================================================
-- INSTRUÇÕES DE USO
-- ===================================================================

/*
1. Abre o Supabase SQL Editor:
   https://supabase.com/dashboard → SecagemsPro → SQL Editor

2. Cola este script completo

3. Clica "Run" (ou F5)

4. Verifica se a tabela foi criada:
   SELECT * FROM mapa_encomendas;

5. Testa a aplicação:
   - Vai à aba "Mapa Encomendas"
   - Edita células → dados salvos automaticamente
   - Muda o mês → dados carregados do mês selecionado
   - Adiciona/Remove linhas → BD atualizada

6. Debug (se necessário):
   -- Ver todas as encomendas de Março 2026:
   SELECT * FROM mapa_encomendas 
   WHERE month = 'mar' AND year = 2026 
   ORDER BY row_order;
   
   -- Apagar dados de um mês (cuidado!):
   DELETE FROM mapa_encomendas 
   WHERE month = 'mar' AND year = 2026;
   
   -- Ver estrutura da tabela:
   \d mapa_encomendas
*/

-- ===================================================================
-- FIM DO SCRIPT
-- ===================================================================
