# 🐛 BUGFIX v2.51.30 — Empilhamento Horizontal em Horários Específicos

**Data**: 14/03/2026 22:00  
**Versão**: v2.51.30  
**Tipo**: Bugfix - Crítico  
**Status**: ✅ Produção

---

## 🐛 Problema Identificado

**Sintoma**:
- Console mostra **3 cargas** no slot 10:00-12:00:
  ```
  📦 3 cargas no slot "10:00 - 12:00" do dia 18/03:
     [1] IPP - 10:00 - 12:00
     [2] THE NAVIGATOR COMPANY - 10:00 - 12:00
     [3] LPR - 10:00 - 12:00
  ```
- Mas no **Mapa de Cargas** só aparece **1 carga** (IPP)
- As outras 2 cargas estão **sobrepostas** (não empilham lado a lado)

**Causa Raiz**:
- Lógica de empilhamento só era aplicada para **blocos expandidos** (`rowSpan > 1`):
  - ✅ **Manhã** (rowSpan = 3) → Empilha corretamente
  - ✅ **Tarde** (rowSpan = 4) → Empilha corretamente
  - ❌ **10:00-12:00** (rowSpan = 1) → **NÃO empilhava**!

```javascript
// CÓDIGO ANTIGO (v2.51.29):
if (carga.rowSpan > 1) {
    // ✅ Empilhamento horizontal
    event.style.width = `${larguraPorBloco}%`;
} else {
    // ❌ SEM empilhamento (default width = 100%)
    // Resultado: Cargas ficam sobrepostas!
}
```

---

## ✅ Solução Implementada

### 1️⃣ **Empilhamento para rowSpan = 1**

**NOVO CÓDIGO (v2.51.30)**:
```javascript
if (carga.rowSpan > 1) {
    // Blocos expandidos (Manhã/Tarde): position absolute
    event.style.width = `${larguraPorBloco}%`;
    
} else if (totalCargasNesteSlot > 1) {
    // 🔥 NOVO: Horários específicos (rowSpan = 1) com múltiplas cargas
    event.style.display = 'inline-block';
    event.style.verticalAlign = 'top';
    event.style.marginRight = '4px';
    
    // Distribuir largura
    const larguraPorBloco = Math.floor((100 / totalCargasNesteSlot) - 1);
    event.style.width = `${larguraPorBloco}%`;
    event.style.minWidth = '120px'; // Legibilidade mínima
}
```

---

### 2️⃣ **CSS Ajustado para Inline-Block**

**`.calendario-day-cell` (célula pai)**:
```css
.calendario-day-cell {
    white-space: nowrap;    /* ← Permitir inline-block lado a lado */
    overflow-x: auto;       /* ← Scroll se necessário */
}
```

**`.calendario-event`**:
```css
.calendario-event {
    white-space: normal;    /* ← Quebra de linha dentro do bloco */
    vertical-align: top;    /* ← Alinhamento correto */
}
```

---

## 📊 Como Funciona Agora

### Cenário: 3 Cargas no Slot 10:00-12:00

**ANTES (v2.51.29)**:
```
┌────────────────────────────────┐
│ IPP                            │ ← Única visível (width: 100%)
│ (THE NAVIGATOR sobreposto)     │ ← Escondido atrás
│ (LPR sobreposto)               │ ← Escondido atrás
└────────────────────────────────┘
```

**DEPOIS (v2.51.30)**:
```
┌──────────┬──────────┬──────────┐
│ IPP      │ THE NAV. │ LPR      │ ← 3 cargas lado a lado
│ (32%)    │ (32%)    │ (32%)    │ ← Largura dividida
└──────────┴──────────┴──────────┘
```

---

### Cálculo de Largura

| Nº Cargas | Largura por Bloco | Exemplo |
|-----------|-------------------|---------|
| 1 carga   | 100% | IPP (ocupa tudo) |
| 2 cargas  | 49% cada | IPP (49%) \| NAV (49%) |
| 3 cargas  | 32% cada | IPP (32%) \| NAV (32%) \| LPR (32%) |
| 4 cargas  | 24% cada | 4 blocos lado a lado |

**Largura mínima**: 120px (garantir legibilidade)

---

## 🧪 Como Testar (1 minuto)

### ✅ **Teste Principal**

1. **Login** no sistema
2. **Ir para** 🚚 Mapa Cargas
3. **Navegar** para dia **18/03** (Qua)
4. **Procurar** slot **10:00-12:00**
5. ✅ **VERIFICAR**: Aparecem **3 cargas lado a lado**:
   - IPP (esquerda)
   - THE NAVIGATOR COMPANY (centro)
   - LPR (direita)
6. ✅ **VERIFICAR**: Largura dividida (~32% cada)

### ✅ **Teste Console (F12)**

```javascript
📦 3 cargas no slot "10:00 - 12:00" do dia 18/03:
   [1] IPP - 10:00 - 12:00
   [2] THE NAVIGATOR COMPANY - 10:00 - 12:00
   [3] LPR - 10:00 - 12:00

🎨 RESULTADO FINAL:
   ✅ Total de blocos renderizados no calendário: 9
```

---

### ✅ **Teste Slot SEM_HORARIO**

1. **Procurar** linha **⚠️ Sem Horário** (topo do calendário)
2. ✅ **VERIFICAR**: 5 cargas aparecem lado a lado:
   - JANGADA DE MÉRITO
   - IPP
   - REVIGRÉS
   - LPR
   - IPP

---

## 📋 Ficheiros Alterados

### `app.js` (v2.51.30)

**Alterações**:
1. ✅ Lógica de empilhamento aplicada para `rowSpan = 1`
2. ✅ Estilo `inline-block` para cargas específicas
3. ✅ Cálculo de largura distribuída
4. ✅ Largura mínima (120px) para legibilidade

**Linhas Modificadas**: ~20 linhas

---

### `index.html` (v2.51.30)

**Alterações**:
1. ✅ `.calendario-day-cell`: `white-space: nowrap` + `overflow-x: auto`
2. ✅ `.calendario-event`: `white-space: normal` + `vertical-align: top`

**Linhas Modificadas**: ~4 linhas

---

## 📊 Comparação

### Empilhamento por Tipo de Horário

| Tipo de Horário | rowSpan | v2.51.29 | v2.51.30 |
|-----------------|---------|----------|----------|
| **Manhã** (06-12h) | 3 | ✅ Empilha | ✅ Empilha |
| **Tarde** (12-20h) | 4 | ✅ Empilha | ✅ Empilha |
| **10:00-12:00** | 1 | ❌ Sobrepõe | ✅ Empilha |
| **08:00-10:00** | 1 | ❌ Sobrepõe | ✅ Empilha |
| **Sem Horário** | 1 | ❌ Sobrepõe | ✅ Empilha |

---

## 🔧 Detalhes Técnicos

### Por Que Acontecia?

**Blocos Expandidos (rowSpan > 1)**:
- Usam `position: absolute`
- Largura definida em **porcentagem** (`left`, `width`)
- Empilhamento funcionava ✅

**Horários Específicos (rowSpan = 1)**:
- Usam `position: relative` (default)
- Sem largura definida → `width: auto` = **100%**
- Todos ocupavam **100% da célula** → Sobreposição ❌

### Solução: Inline-Block

```css
/* Célula pai */
.calendario-day-cell {
    white-space: nowrap; /* ← Forçar elementos lado a lado */
}

/* Eventos */
.calendario-event {
    display: inline-block; /* ← Comportamento inline + dimensões */
    width: 32%;            /* ← Largura definida */
}
```

**Resultado**: Cargas ficam lado a lado como palavras em uma frase!

---

## ✅ Checklist de Deploy

- [x] Bug reproduzido e diagnosticado
- [x] Lógica de empilhamento estendida (rowSpan = 1)
- [x] CSS ajustado (inline-block)
- [x] Testado com 1, 2, 3 e 5 cargas
- [x] Largura mínima garantida (120px)
- [x] Sem regressões detectadas

### 📦 **Ficheiros a Enviar**
1. `app.js` (v2.51.30) ← **Alterado**
2. `index.html` (v2.51.30) ← **Alterado**

---

## 🚀 Deploy Rápido

```bash
# 1. Upload
Enviar: app.js + index.html (v2.51.30)

# 2. Hard Refresh
Ctrl + Shift + R

# 3. Teste
Mapa Cargas → Dia 18/03 → Slot 10:00-12:00 → 3 cargas lado a lado ✓
```

---

## 🔮 Melhorias Futuras (Opcional)

1. **Responsive**: Ajustar largura mínima em mobile
2. **Drag & Drop**: Reorganizar cargas dentro do slot
3. **Indicador visual**: Badge "×3" quando múltiplas cargas
4. **Hover tooltip**: Mostrar todas as cargas ao passar o mouse

---

**🎉 Bugfix v2.51.30**: Empilhamento horizontal funciona para TODOS os tipos de horário (Manhã, Tarde, específicos e sem horário)!

---

*PSY Team — 14/03/2026 22:00*
