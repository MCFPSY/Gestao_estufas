# 🐛 BUGFIX v2.51.27 — Inserir Linha na Data Correta (com Filtro)

**Data**: 14/03/2026 20:00  
**Versão**: v2.51.27  
**Tipo**: Bugfix - Crítico  
**Status**: ✅ Produção

---

## 🐛 Problema Reportado

**Sintoma**:
- Ao clicar em **+ (inserir linha)** no dia **18 de Março**
- A nova linha aparecia no dia **4 de Março** (data errada!)
- Mesmo problema ao **apagar linhas** (apagava linha errada)

**Exemplo Real**:
```
Usuário vê (com filtro Semana 12):
┌──────────┐
│ 18 Mar   │ ← Clica no + aqui
│ 19 Mar   │
│ 20 Mar   │
└──────────┘

Sistema inseria aqui (sem filtro):
┌──────────┐
│ 04 Mar   │ ← Linha inserida ERRADA!
│ 05 Mar   │
│ ...      │
│ 18 Mar   │
└──────────┘
```

**Causa Raiz**:
- Quando há **filtro de semana ativo**, a tabela mostra apenas algumas datas
- O índice visual (0, 1, 2...) não corresponde ao índice real no array completo
- As funções `insertRowBelow()` e `deleteRow()` usavam o **índice visual** diretamente
- Resultado: operação na posição errada do array

---

## ✅ Solução Implementada

### 1️⃣ **Mapeamento Global de Índices**

**Código Adicionado**:
```javascript
// 🔥 v2.51.27: Mapeamento de índices (visual -> real) para suportar filtros de semana
let encomendasIndexMapping = [];
```

**Função**: Guardar a correspondência entre índice visual e índice real:
```javascript
// Visual: 0, 1, 2
// Real:   14, 15, 16
encomendasIndexMapping = [14, 15, 16];
```

---

### 2️⃣ **Atualização da Função `renderEncomendasGrid`**

**ANTES**:
```javascript
// Mapeamento local (não acessível fora da função)
let indexMapping = [];

if (currentWeek !== null) {
    indexMapping.push(originalIndex);
} else {
    indexMapping = datesToRender.map((_, i) => i);
}
```

**DEPOIS**:
```javascript
// 🔥 v2.51.27: Mapeamento GLOBAL
encomendasIndexMapping = [];

if (currentWeek !== null) {
    encomendasIndexMapping.push(originalIndex);  // ← Global
} else {
    encomendasIndexMapping = datesToRender.map((_, i) => i);
}
```

---

### 3️⃣ **Correção da Função `insertRowBelow`**

**ANTES (v2.51.26)**:
```javascript
async function insertRowBelow(index) {
    const currentDate = encomendasData.dates[index];  // ❌ Índice visual direto
    
    // Inserir na posição index + 1
    encomendasData.dates.splice(index + 1, 0, currentDate);  // ❌ Errado!
}
```

**DEPOIS (v2.51.27)**:
```javascript
async function insertRowBelow(index) {
    // 🔥 Converter índice visual para índice real
    const realIndex = encomendasIndexMapping[index] || index;
    const currentDate = encomendasData.dates[realIndex];  // ✅ Índice real
    
    console.log(`➕ Inserindo nova linha abaixo de ${currentDate} (índice visual: ${index}, real: ${realIndex})`);
    
    // Inserir na posição realIndex + 1
    encomendasData.dates.splice(realIndex + 1, 0, currentDate);  // ✅ Correto!
}
```

---

### 4️⃣ **Correção da Função `deleteRow`**

**ANTES**:
```javascript
async function deleteRow(index) {
    const date = encomendasData.dates[index];  // ❌ Índice visual
    encomendasData.dates.splice(index, 1);     // ❌ Apaga linha errada
}
```

**DEPOIS**:
```javascript
async function deleteRow(index) {
    // 🔥 Converter índice visual para índice real
    const realIndex = encomendasIndexMapping[index] || index;
    const date = encomendasData.dates[realIndex];  // ✅ Data correta
    
    encomendasData.dates.splice(realIndex, 1);     // ✅ Apaga linha correta
}
```

---

## 📊 Impacto do Bugfix

### Cenário de Teste

**Setup**:
- Array completo: 30 datas (04/mar até 03/abr)
- Filtro ativo: **Semana 12** (18/mar, 19/mar, 20/mar, 21/mar, 22/mar)
- Índices visuais: 0, 1, 2, 3, 4
- Índices reais: 14, 15, 16, 17, 18

**Ação**: Clicar em **+ no dia 18/mar** (índice visual 0)

| Versão | Índice Usado | Data Inserida | Resultado |
|--------|-------------|---------------|-----------|
| **v2.51.26 (antes)** | 0 (visual) | 05/mar | ❌ **ERRADO** |
| **v2.51.27 (agora)** | 14 (real) | 19/mar | ✅ **CORRETO** |

---

## 🧪 Como Testar (2 minutos)

### ✅ **Teste 1: Inserir Linha com Filtro Ativo**

1. **Login** no sistema
2. Ir para **📋 Mapa Encomendas**
3. **Selecionar semana** no dropdown (ex: Semana 12)
4. **Clicar em +** ao lado do dia **18/mar**
5. ✅ **VERIFICAR**: Nova linha aparece **abaixo do 18/mar** (19/mar)
6. ✅ **VERIFICAR**: Console mostra:
   ```
   ➕ Inserindo nova linha abaixo de 18/mar (índice visual: 0, real: 14)
   ```

### ✅ **Teste 2: Apagar Linha com Filtro Ativo**

1. Manter **filtro de semana ativo**
2. **Clicar em −** ao lado do dia **20/mar**
3. **Confirmar** a ação
4. ✅ **VERIFICAR**: Linha **20/mar** é removida (não outra data!)

### ✅ **Teste 3: Sem Filtro (Verificar Regressão)**

1. **Remover filtro** (selecionar "Todas as semanas")
2. **Clicar em +** ao lado de **10/mar**
3. ✅ **VERIFICAR**: Nova linha aparece **abaixo do 10/mar** (11/mar)
4. ✅ **VERIFICAR**: Funciona igual antes do bugfix

---

## 📋 Ficheiros Alterados

### `app.js` (v2.51.27)

**Alterações**:
1. ✅ Adicionado `encomendasIndexMapping = []` (variável global)
2. ✅ Atualizado `renderEncomendasGrid()` para popular o array global
3. ✅ Corrigido `insertRowBelow()` para usar `realIndex`
4. ✅ Corrigido `deleteRow()` para usar `realIndex`
5. ✅ Atualizado cabeçalho de versão

**Linhas Modificadas**: ~15 linhas
**Impacto**: Apenas funções de inserir/apagar (sem afetar edição de células)

---

## ✅ Checklist de Deploy

- [x] Bug identificado e reproduzido
- [x] Causa raiz diagnosticada
- [x] Solução implementada
- [x] Console logs adicionados para debug
- [x] Testado com filtro ativo
- [x] Testado sem filtro (sem regressão)
- [x] Documentação criada

### 📦 **Ficheiros a Enviar**
1. `app.js` (v2.51.27) ← **Alterado**
2. `index.html` (v2.51.26) ← **Inalterado** (pode reenviar ou não)

---

## 🔮 Melhorias Futuras (Opcional)

1. **Toast mais descritivo**: Mostrar "Nova linha inserida em 19/mar (abaixo de 18/mar)"
2. **Animação visual**: Highlight da linha recém-inserida
3. **Undo/Redo**: Permitir desfazer inserção/remoção de linhas
4. **Inserir acima**: Botão adicional para inserir **antes** da data atual

---

## 📝 Notas Técnicas

### Por Que o Bug Acontecia?

1. **Filtro de semana** cria um array temporário com apenas algumas datas
2. **Índices visuais** (0, 1, 2...) são diferentes dos **índices reais** (14, 15, 16...)
3. **Funções antigas** usavam `index` diretamente, assumindo que visual === real
4. **Resultado**: Operações eram feitas na posição errada do array completo

### Solução Aplicada

- **Mapeamento global** (`encomendasIndexMapping`) mantém a correspondência
- **Conversão explícita** em `insertRowBelow()` e `deleteRow()`
- **Logs detalhados** mostram índice visual vs. real para debug

### Compatibilidade

- ✅ **Sem filtro**: Mapeamento 1:1 (índice visual = índice real)
- ✅ **Com filtro**: Mapeamento correto via `encomendasIndexMapping`
- ✅ **Edição de células**: Não afetada (já usava `originalIndex`)

---

**🎉 Bugfix v2.51.27**: Inserir/apagar linhas agora funciona corretamente mesmo com filtro de semana ativo!

---

*PSY Team — 14/03/2026 20:00*
