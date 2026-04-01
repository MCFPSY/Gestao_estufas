# 🔧 CHANGE v2.51.31 — Matriz de Carga 2×8 → 2×4

**Data**: 14/03/2026 22:30  
**Versão**: v2.51.31  
**Tipo**: Change - Redução da Matriz  
**Status**: ✅ Produção

---

## 🎯 Alteração Solicitada

**Pedido do Utilizador**:
> "Preciso que me alteres uma coisa: em vez de 2× colunas + 8× linhas - nas secagens (novas secagens, visualização das mesmas, etc) faz me antes 2× colunas + 4× linhas."

**Ação**: Reduzir matriz de carga de **2×8** (16 células) para **2×4** (8 células)

---

## ✅ Alterações Implementadas

### 1️⃣ **HTML - Modal Nova Secagem**

**ANTES (v2.51.30)**:
```html
<!-- Matriz 2x8 (16 células: 2 colunas × 8 linhas) -->
<div class="matrix-grid" id="cargo-matrix-grid">
    <!-- Linha 1 -->
    <div class="matrix-cell" data-cell="1-1" data-row="1" data-col="1"></div>
    <div class="matrix-cell" data-cell="1-2" data-row="1" data-col="2"></div>
    
    <!-- Linha 2 -->
    <div class="matrix-cell" data-cell="2-1" data-row="2" data-col="1"></div>
    <div class="matrix-cell" data-cell="2-2" data-row="2" data-col="2"></div>
    
    <!-- ... Linhas 3-8 ... -->
    
    <!-- Linha 8 -->
    <div class="matrix-cell" data-cell="8-1" data-row="8" data-col="1"></div>
    <div class="matrix-cell" data-cell="8-2" data-row="8" data-col="2"></div>
</div>
```

**DEPOIS (v2.51.31)**:
```html
<!-- Matriz 2x4 (8 células: 2 colunas × 4 linhas) -->
<div class="matrix-grid" id="cargo-matrix-grid">
    <!-- Linha 1 -->
    <div class="matrix-cell" data-cell="1-1" data-row="1" data-col="1"></div>
    <div class="matrix-cell" data-cell="1-2" data-row="1" data-col="2"></div>
    
    <!-- Linha 2 -->
    <div class="matrix-cell" data-cell="2-1" data-row="2" data-col="1"></div>
    <div class="matrix-cell" data-cell="2-2" data-row="2" data-col="2"></div>
    
    <!-- Linha 3 -->
    <div class="matrix-cell" data-cell="3-1" data-row="3" data-col="1"></div>
    <div class="matrix-cell" data-cell="3-2" data-row="3" data-col="2"></div>
    
    <!-- Linha 4 -->
    <div class="matrix-cell" data-cell="4-1" data-row="4" data-col="1"></div>
    <div class="matrix-cell" data-cell="4-2" data-row="4" data-col="2"></div>
</div>
```

**Resultado**: **8 linhas HTML removidas** (linhas 5-8)

---

### 2️⃣ **CSS - Separadores Picotados**

**ANTES**: Linhas picotadas após linhas 1, 3, 5, 7 (4 separadores)

**DEPOIS**: Linhas picotadas após linhas 1, 3 (2 separadores)

```css
/* 🔥 v2.51.31: Separadores horizontais - apenas após linhas 1 e 3 */
.matrix-cell[data-row="1"][data-col="2"]::after { /* Separador */ }
.matrix-cell[data-row="3"][data-col="2"]::after { /* Separador */ }

/* ❌ Removido: data-row="5" e data-row="7" */
```

**Resultado**: **2 blocos CSS removidos** (separadores das linhas 5 e 7)

---

### 3️⃣ **JavaScript - Sem Alterações Necessárias**

**Verificação**:
- ✅ `getMatrixCargoData()`: Itera sobre `matrixData` (dinâmico)
- ✅ Não há loops `for (i=1; i<=8; i++)`
- ✅ Não há validações hardcoded de 8 linhas
- ✅ Sistema adapta-se automaticamente ao número de células HTML

**Conclusão**: **JavaScript já é compatível** (código genérico)

---

### 4️⃣ **Base de Dados - Sem Alterações Necessárias**

**Estrutura Atual**:
```sql
CREATE TABLE cargo (
    id UUID,
    secagem_id UUID,
    posicao TEXT,        -- Ex: "1-1", "7-1,7-2", "8-1,8-2"
    tipo_palete TEXT
)
```

**Verificação**:
- ✅ Campo `posicao` é **TEXT genérico** (não depende de 8 linhas)
- ✅ Suporta qualquer valor: "1-1", "4-2", "footer", etc.
- ✅ Secagens antigas com "5-1", "8-2" **continuam funcionando**
- ✅ Novas secagens só usarão "1-1" até "4-2"

**Conclusão**: **BD já é compatível** (sem migration necessária)

---

## 📊 Comparação Visual

### ANTES (2×8 = 16 células)
```
┌────┬────┐
│1-1 │1-2 │ Linha 1
├────┼────┤ ──────── Separador
│2-1 │2-2 │ Linha 2
├────┼────┤
│3-1 │3-2 │ Linha 3
├────┼────┤ ──────── Separador
│4-1 │4-2 │ Linha 4
├────┼────┤
│5-1 │5-2 │ Linha 5  ← REMOVIDA
├────┼────┤ ──────── Separador
│6-1 │6-2 │ Linha 6  ← REMOVIDA
├────┼────┤
│7-1 │7-2 │ Linha 7  ← REMOVIDA
├────┼────┤ ──────── Separador
│8-1 │8-2 │ Linha 8  ← REMOVIDA
└────┴────┘
[  Footer  ] ← Mantido
```

### DEPOIS (2×4 = 8 células)
```
┌────┬────┐
│1-1 │1-2 │ Linha 1
├────┼────┤ ──────── Separador
│2-1 │2-2 │ Linha 2
├────┼────┤
│3-1 │3-2 │ Linha 3
├────┼────┤ ──────── Separador
│4-1 │4-2 │ Linha 4
└────┴────┘
[  Footer  ] ← Mantido
```

---

## 🧪 Como Testar (2 minutos)

### ✅ **Teste 1: Nova Secagem**

1. **Login** no sistema
2. **Ir para** 📅 Planeamento estufas
3. **Clicar** em "+ Nova Secagem"
4. ✅ **VERIFICAR**: Matriz mostra **4 linhas** (1-4)
5. ✅ **VERIFICAR**: **NÃO** aparecem linhas 5-8
6. ✅ **VERIFICAR**: 2 separadores picotados (após linhas 1 e 3)
7. ✅ **VERIFICAR**: Footer continua presente

### ✅ **Teste 2: Criar Secagem com Nova Matriz**

1. **Preencher** configuração:
   - Estufa: 1
   - Data: Hoje
   - Duração: 48h
2. **Preencher** matriz:
   - Clicar em `1-1` → Tipo: "EUR 1200×800"
   - Clicar em `3-1, 3-2` (Ctrl) → Tipo: "Cliente X"
   - Clicar em `4-1` → Tipo: "Lote 10"
   - Clicar em Footer → Tipo: "Total: 40 paletes"
3. **Guardar**
4. ✅ **VERIFICAR**: Secagem criada com sucesso
5. ✅ **VERIFICAR**: Dados salvos na BD corretamente

### ✅ **Teste 3: Editar Secagem Antiga (com linhas 5-8)**

**Cenário**: Secagem criada ANTES de v2.51.31 (com células "5-1", "8-2")

1. **Abrir** secagem antiga
2. ✅ **VERIFICAR**: Modal mostra apenas linhas 1-4
3. ✅ **VERIFICAR**: Células antigas (5-8) **NÃO** aparecem
4. ⚠️ **NOTA**: Dados antigos (5-8) **permanecem na BD** mas não são editáveis

**Comportamento Esperado**:
- Secagens antigas continuam funcionando
- Editar secagem antiga **não quebra** (células antigas são ignoradas)
- Novas células só podem usar 1-4

---

## 📋 Ficheiros Alterados

### `index.html` (v2.51.31)

**Alterações**:
1. ✅ Removidas 8 linhas HTML (células 5-1 até 8-2)
2. ✅ Comentário atualizado: "Matriz 2×4" (era "2×8")
3. ✅ Removidos 2 blocos CSS (separadores linhas 5 e 7)

**Linhas Modificadas**: ~20 linhas
**Linhas Removidas**: ~10 linhas

---

### `app.js` (v2.51.31)

**Alterações**:
1. ✅ Cabeçalho de versão atualizado
2. ✅ Console log atualizado

**Linhas Modificadas**: ~2 linhas
**Sem alterações de lógica**

---

## ✅ Checklist de Deploy

- [x] HTML: Células 5-8 removidas
- [x] CSS: Separadores 5 e 7 removidos
- [x] JavaScript: Verificado (sem hardcoding)
- [x] Base de Dados: Verificada (compatível)
- [x] Testado: Criar nova secagem
- [x] Testado: Editar secagem antiga

### 📦 **Ficheiros a Enviar**
1. `index.html` (v2.51.31) ← **Alterado**
2. `app.js` (v2.51.31) ← **Alterado**

---

## ⚠️ Notas Importantes

### Secagens Antigas (Criadas Antes de v2.51.31)

**Cenário**: Secagem tem células "5-1", "7-2", "8-1" preenchidas

**Comportamento Após Update**:
- ✅ Secagem continua **visível** no Gantt
- ✅ Dados permanecem **na BD**
- ⚠️ Ao editar: células 5-8 **não aparecem** no modal
- ⚠️ Se salvar: células 5-8 **permanecem na BD** (não são apagadas)

**Recomendação**:
- Se necessário **migrar dados** antigos (5-8 → 1-4), fazer manualmente
- Ou criar ferramenta de migração (opcional)

---

### Impacto em Diferentes Telas

| Tela | Antes | Depois | Compatível? |
|------|-------|--------|-------------|
| **Nova Secagem** | 16 células (2×8) | 8 células (2×4) | ✅ Sim |
| **Editar Secagem** | 16 células | 8 células | ✅ Sim |
| **Dashboard (cards)** | Mostra 1-8 | Mostra 1-4 | ✅ Sim |
| **Visualização live** | Mostra 1-8 | Mostra 1-4 | ✅ Sim |

---

## 🔮 Melhorias Futuras (Opcional)

1. **Migração automática**: Script SQL para mover células 5-8 → 1-4
2. **Warning**: Alerta ao editar secagem antiga com células 5-8
3. **Visualização**: Mostrar células 5-8 antigas em modo "read-only"
4. **Configuração**: Permitir trocar entre 2×4 e 2×8 via settings

---

**🎉 Change v2.51.31**: Matriz de carga reduzida de 2×8 para 2×4 conforme solicitado!

---

*PSY Team — 14/03/2026 22:30*
