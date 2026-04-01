-- ========================================
-- SecagemsPro - Criação de Tabelas
-- Versão: 2.14.0
-- Data: 28/02/2026
-- ========================================

-- 1️⃣ TABELA: mapa_encomendas (Dados Principais)
-- ========================================

CREATE TABLE IF NOT EXISTS mapa_encomendas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month TEXT NOT NULL,
    year INTEGER NOT NULL,
    date TEXT NOT NULL,
    row_order INTEGER NOT NULL,
    sem TEXT,
    cliente TEXT,
    local TEXT,
    medida TEXT,
    qtd TEXT,
    transp TEXT,
    et TEXT,
    enc TEXT,
    nviagem TEXT,
    obs TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para otimização
CREATE INDEX IF NOT EXISTS idx_mapa_month_year ON mapa_encomendas(month, year);
CREATE INDEX IF NOT EXISTS idx_mapa_date ON mapa_encomendas(date);
CREATE INDEX IF NOT EXISTS idx_mapa_row_order ON mapa_encomendas(row_order);

-- Comentários
COMMENT ON TABLE mapa_encomendas IS 'Dados do Mapa de Encomendas por mês/ano';
COMMENT ON COLUMN mapa_encomendas.month IS 'Mês (jan, fev, mar, etc.)';
COMMENT ON COLUMN mapa_encomendas.year IS 'Ano (2026)';
COMMENT ON COLUMN mapa_encomendas.date IS 'Data no formato DD/mmm (ex: 01/mar)';
COMMENT ON COLUMN mapa_encomendas.row_order IS 'Ordem da linha na tabela';
COMMENT ON COLUMN mapa_encomendas.sem IS 'Número da semana (ISO 8601)';
COMMENT ON COLUMN mapa_encomendas.et IS 'E.T.* (Entrega Técnica)';
COMMENT ON COLUMN mapa_encomendas.nviagem IS 'Número da viagem';

-- ========================================
-- 2️⃣ TABELA: mapa_encomendas_historico (Auditoria)
-- ========================================

CREATE TABLE IF NOT EXISTS mapa_encomendas_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID NOT NULL,
    user_email TEXT NOT NULL,
    action_type TEXT NOT NULL CHECK (action_type IN ('CREATE', 'UPDATE', 'DELETE', 'ADD_DAY', 'ADD_ROW')),
    month TEXT NOT NULL,
    year INTEGER NOT NULL,
    date TEXT,
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    row_order INTEGER,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para otimização de queries de histórico
CREATE INDEX IF NOT EXISTS idx_historico_user ON mapa_encomendas_historico(user_id);
CREATE INDEX IF NOT EXISTS idx_historico_email ON mapa_encomendas_historico(user_email);
CREATE INDEX IF NOT EXISTS idx_historico_timestamp ON mapa_encomendas_historico(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_historico_action ON mapa_encomendas_historico(action_type);
CREATE INDEX IF NOT EXISTS idx_historico_month_year ON mapa_encomendas_historico(month, year);
CREATE INDEX IF NOT EXISTS idx_historico_date ON mapa_encomendas_historico(date);

-- Comentários
COMMENT ON TABLE mapa_encomendas_historico IS 'Log de auditoria de todas as alterações ao Mapa de Encomendas';
COMMENT ON COLUMN mapa_encomendas_historico.action_type IS 'CREATE, UPDATE, DELETE, ADD_DAY, ADD_ROW';
COMMENT ON COLUMN mapa_encomendas_historico.details IS 'Contexto adicional em formato JSON';

-- ========================================
-- 3️⃣ ROW LEVEL SECURITY (RLS)
-- ========================================

-- Ativar RLS
ALTER TABLE mapa_encomendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE mapa_encomendas_historico ENABLE ROW LEVEL SECURITY;

-- Política: Utilizadores autenticados podem ler/escrever encomendas
DROP POLICY IF EXISTS "Utilizadores podem aceder encomendas" ON mapa_encomendas;
CREATE POLICY "Utilizadores podem aceder encomendas" 
ON mapa_encomendas 
FOR ALL 
USING (auth.role() = 'authenticated');

-- Política: Histórico apenas leitura
DROP POLICY IF EXISTS "Histórico read-only" ON mapa_encomendas_historico;
CREATE POLICY "Histórico read-only" 
ON mapa_encomendas_historico 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Política: Sistema pode inserir no histórico
DROP POLICY IF EXISTS "Sistema pode inserir histórico" ON mapa_encomendas_historico;
CREATE POLICY "Sistema pode inserir histórico" 
ON mapa_encomendas_historico 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- ========================================
-- 4️⃣ TRIGGERS (Atualização Automática)
-- ========================================

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para mapa_encomendas
DROP TRIGGER IF EXISTS update_mapa_encomendas_updated_at ON mapa_encomendas;
CREATE TRIGGER update_mapa_encomendas_updated_at
    BEFORE UPDATE ON mapa_encomendas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 5️⃣ QUERIES ÚTEIS
-- ========================================

-- Ver todas as encomendas de Março 2026
-- SELECT * FROM mapa_encomendas 
-- WHERE month = 'mar' AND year = 2026 
-- ORDER BY row_order;

-- Ver histórico de um utilizador
-- SELECT * FROM mapa_encomendas_historico 
-- WHERE user_email = 'teste@secagens.pt' 
-- ORDER BY timestamp DESC;

-- Ver alterações de um dia específico
-- SELECT * FROM mapa_encomendas_historico 
-- WHERE date = '15/mar' 
-- ORDER BY timestamp DESC;

-- Estatísticas de ações por utilizador
-- SELECT 
--     user_email, 
--     action_type, 
--     COUNT(*) as total_actions 
-- FROM mapa_encomendas_historico 
-- GROUP BY user_email, action_type 
-- ORDER BY total_actions DESC;

-- Top 10 campos mais editados
-- SELECT 
--     field_name, 
--     COUNT(*) as edit_count 
-- FROM mapa_encomendas_historico 
-- WHERE action_type = 'UPDATE' 
-- GROUP BY field_name 
-- ORDER BY edit_count DESC 
-- LIMIT 10;

-- Actividade por dia
-- SELECT 
--     DATE(timestamp) as dia,
--     COUNT(*) as total_alteracoes
-- FROM mapa_encomendas_historico
-- GROUP BY DATE(timestamp)
-- ORDER BY dia DESC;

-- ========================================
-- 6️⃣ VERIFICAÇÃO
-- ========================================

-- Contar registos
-- SELECT COUNT(*) FROM mapa_encomendas;
-- SELECT COUNT(*) FROM mapa_encomendas_historico;

-- Ver estrutura
-- \d mapa_encomendas
-- \d mapa_encomendas_historico

-- ========================================
-- ✅ SCRIPT CONCLUÍDO
-- ========================================
-- Execute este script no SQL Editor do Supabase
-- Todas as tabelas, índices, RLS e triggers serão criados
-- ========================================
