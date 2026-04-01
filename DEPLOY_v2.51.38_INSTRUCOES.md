# 🚀 DEPLOY v2.51.38 - Novos Campos Secagem

**Data:** 2026-03-25 15:30  
**Prioridade:** 🟡 MÉDIA (nova funcionalidade, não crítico)  
**Breaking Changes:** ❌ NÃO (compatível com dados existentes)

---

## 📋 Resumo da Atualização

Adicionados dois novos campos ao formulário de secagem:
1. **Tipo de Secagem** → Combo box: Ultra dry | HT | **Dry** (padrão)
2. **Quantidade Total** → Campo numérico (opcional)

Ambos os campos são gravados na tabela `secagens` do Supabase.

---

## ✅ PRÉ-REQUISITOS: Atualizar Base de Dados

**⚠️ IMPORTANTE:** Execute estes comandos no Supabase SQL Editor **ANTES** de fazer deploy dos ficheiros!

### 1. Aceder ao Supabase Dashboard
- URL: https://supabase.com/dashboard/project/sawmdixlevjghlikvakv
- Menu lateral: **SQL Editor** → **New query**

### 2. Executar SQL

```sql
-- Adicionar coluna tipo_secagem com valor padrão 'Dry'
ALTER TABLE secagens 
ADD COLUMN IF NOT EXISTS tipo_secagem TEXT DEFAULT 'Dry';

-- Adicionar coluna qtd_total (opcional, pode ser NULL)
ALTER TABLE secagens 
ADD COLUMN IF NOT EXISTS qtd_total INTEGER;

-- Atualizar secagens existentes (definir tipo_secagem = 'Dry' para os registos sem valor)
UPDATE secagens 
SET tipo_secagem = 'Dry' 
WHERE tipo_secagem IS NULL;
```

### 3. Verificar alterações

```sql
-- Verificar estrutura da tabela
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'secagens'
ORDER BY ordinal_position;
```

**Esperado:**
```
| column_name   | data_type | column_default | is_nullable |
|---------------|-----------|----------------|-------------|
| ...           | ...       | ...            | ...         |
| tipo_secagem  | text      | 'Dry'::text    | YES         |
| qtd_total     | integer   | NULL           | YES         |
```

---

## 📦 Ficheiros Alterados

### 1. `index.html`
**Linhas modificadas:** ~2411-2422 (novo `form-row` com 2 campos)

**Alteração:**
- Adicionado combo box `#input-tipo-secagem` com opções: Dry (selected), HT, Ultra dry
- Adicionado input numérico `#input-qtd-total` (min=0, placeholder "Ex: 150")

### 2. `app.js`
**Linhas modificadas:** 
- ~782-784 (função `openNewSecagemModal` - valores padrão)
- ~803-804 (função `editSecagem` - carregar valores da BD)
- ~1409-1410 (leitura dos campos no submit)
- ~1479-1480 (UPDATE - gravação)
- ~1551-1552 (INSERT - gravação)

**Alterações:**
- Leitura: `const tipoSecagem = document.getElementById('input-tipo-secagem').value;`
- Leitura: `const qtdTotal = parseInt(document.getElementById('input-qtd-total').value) || null;`
- Gravação em ambas as operações (INSERT/UPDATE)
- Valores padrão ao criar nova secagem
- Preenchimento correto ao editar secagem existente

### 3. `README.md`
**Alterações:**
- Versão atualizada: v2.51.37e → **v2.51.38**
- Adicionadas 2 novas linhas na seção "Planeamento de Secagens"
- Estrutura da tabela `secagens` atualizada com novos campos

---

## 🚀 Passos de Deploy

### 1️⃣ Atualizar Base de Dados (ver acima)
✅ Executar SQL no Supabase **PRIMEIRO**

### 2️⃣ Commit e Push para GitHub

```bash
# Verificar alterações
git status

# Adicionar ficheiros
git add index.html app.js README.md FEATURE_v2.51.38_NOVOS_CAMPOS_SECAGEM.md DEPLOY_v2.51.38_INSTRUCOES.md

# Commit
git commit -m "v2.51.38 - Adicionar campos Tipo Secagem e Quantidade Total"

# Push para main
git push origin main
```

### 3️⃣ Aguardar GitHub Pages Rebuild
⏱️ **Tempo estimado:** 1-2 minutos

### 4️⃣ Validar Deploy

1. Abrir: https://mcfpsy.github.io/Gestao_estufas/
2. **Limpar cache:** `Ctrl + Shift + R` (Windows/Linux) ou `Cmd + Shift + R` (Mac)
3. Fazer login
4. Ir para tab **Planeamento estufas**

---

## 🧪 Testes Pós-Deploy

### Teste 1: Nova Secagem com valores padrão
1. Clicar em qualquer célula do Gantt (dia vazio)
2. Modal abre
3. ✅ **Verificar:** Campo "Tipo de Secagem" = **Dry** (selecionado)
4. ✅ **Verificar:** Campo "Quantidade Total" = vazio
5. Preencher campos obrigatórios (hora, duração, etc.)
6. Clicar "Guardar Secagem"
7. ✅ **Resultado esperado:** Secagem gravada com tipo_secagem='Dry' e qtd_total=NULL

### Teste 2: Nova Secagem com todos os campos
1. Criar nova secagem
2. Selecionar **Tipo de Secagem** = "HT"
3. Preencher **Quantidade Total** = 250
4. Preencher restantes campos
5. Guardar
6. Editar a mesma secagem
7. ✅ **Verificar:** Tipo de Secagem = "HT" (carregado corretamente)
8. ✅ **Verificar:** Quantidade Total = 250 (carregado corretamente)

### Teste 3: Editar secagem antiga (criada antes do v2.51.38)
1. Editar secagem existente (criada antes desta atualização)
2. ✅ **Verificar:** Tipo de Secagem = "Dry" (valor padrão aplicado)
3. ✅ **Verificar:** Quantidade Total = vazio (NULL)
4. Alterar Tipo para "Ultra dry" e Qtd para 100
5. Guardar
6. Reabrir e verificar que valores foram gravados

### Teste 4: Validação de quantidade
1. Criar nova secagem
2. Tentar inserir quantidade negativa (ex: -50)
3. ✅ **Verificar:** Campo não aceita (min=0 definido no HTML)
4. Tentar inserir texto (ex: "abc")
5. ✅ **Verificar:** Campo não aceita (type=number)
6. Deixar vazio e guardar
7. ✅ **Verificar:** Grava NULL sem erro

---

## 🔍 Verificação na Base de Dados

### Console do Browser (F12)
Após criar/editar uma secagem, verificar console:
```
💾 SALVANDO SECAGEM:
   Tipo Secagem: HT
   Quantidade Total: 250
```

### Supabase Table Editor
1. Ir para: https://supabase.com/dashboard/project/sawmdixlevjghlikvakv/editor
2. Selecionar tabela **secagens**
3. Verificar colunas `tipo_secagem` e `qtd_total` com valores corretos

### SQL Query
```sql
SELECT 
    codigo,
    estufa_id,
    tipo_secagem,
    qtd_total,
    created_at
FROM secagens
ORDER BY created_at DESC
LIMIT 10;
```

**Resultado esperado:**
```
| codigo        | estufa_id | tipo_secagem | qtd_total | created_at          |
|---------------|-----------|--------------|-----------|---------------------|
| SEC_E1_005    | 1         | HT           | 250       | 2026-03-25 15:45... |
| SEC_E2_003    | 2         | Dry          | NULL      | 2026-03-25 14:20... |
| SEC_E3_001    | 3         | Ultra dry    | 100       | 2026-03-25 12:10... |
```

---

## ⚠️ Problemas Conhecidos / Troubleshooting

### Problema: Campos não aparecem no formulário
**Causa:** Cache do browser  
**Solução:** `Ctrl + Shift + R` para hard refresh

### Problema: Erro ao guardar - "column does not exist"
**Causa:** SQL não executado no Supabase  
**Solução:** Executar SQL de criação das colunas (ver PRÉ-REQUISITOS)

### Problema: Tipo de Secagem sempre = NULL na BD
**Causa:** JavaScript não está a ler o campo corretamente  
**Solução:** Verificar console do browser (F12) por erros JavaScript

### Problema: Quantidade Total aceita valores negativos
**Causa:** Validação HTML não está a funcionar  
**Solução:** Não deve acontecer (atributo `min="0"` está definido), mas pode adicionar validação extra no JS se necessário

---

## 📊 Impacto e Compatibilidade

### ✅ Retrocompatibilidade
- Secagens antigas (sem `tipo_secagem`) → valor padrão "Dry" aplicado automaticamente
- Secagens antigas (sem `qtd_total`) → NULL (campo opcional)
- Nenhuma funcionalidade existente é afetada

### 🔄 Migração de Dados
- **Não é necessária** migração manual
- SQL `ALTER TABLE` adiciona colunas com valores padrão
- UPDATE opcional define "Dry" para registos NULL

### 📈 Performance
- **Impacto mínimo**: 2 campos adicionais na tabela
- Queries existentes não são afetadas
- Índices: não necessários (campos não usados em filtros/joins)

---

## 🎯 Próximos Passos (Sugestões)

1. **Validação avançada:**
   - Alertar se Quantidade Total ≠ soma da matriz
   - Sugerir tipo de secagem baseado no produto

2. **Visualização:**
   - Mostrar "Tipo de Secagem" no Gantt (badge/tooltip)
   - Mostrar "Qtd Total" ao passar mouse sobre secagem

3. **Relatórios:**
   - Filtrar secagens por tipo
   - Somar quantidades totais por período

4. **Dashboard:**
   - Card "Total de paletes em secagem" (soma de qtd_total)
   - Gráfico: distribuição por tipo de secagem

---

**Deploy preparado por:** AI Assistant  
**Data:** 2026-03-25 15:30  
**Versão:** v2.51.38  
**Status:** ✅ Pronto para deploy
