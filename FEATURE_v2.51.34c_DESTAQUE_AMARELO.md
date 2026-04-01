# ✨ FEATURE v2.51.34c – Destaque Amarelo de Células

**Data:** 18/03/2026  
**Versão:** v2.51.34c  
**Feature:** Modo de destaque amarelo tipo Excel  
**Local:** Mapa de Encomendas  

---

## 🎯 Feature Solicitada

> "no mapa de encomendas, é possivel colocar uma função tipo excel para formatação exclusivamente amarela? tipo um botão onde se clicava uma vez e depois clicava-se sobre a célula que se pretende formatar. para realçar isso."

---

## ✨ Feature Implementada

Adicionado **botão 🖍️ "Destacar Célula"** no Mapa de Encomendas que:

1. **Ativa modo de destaque** (como marcador de texto)
2. **Clique nas células** → ficam amarelas (🟨)
3. **Clique novamente** → remove o destaque
4. **Desativar modo** → voltar ao normal

---

## 🎨 Como Funciona

### 1. Ativar modo destaque
```
📋 Mapa de Encomendas → 🖍️ Destacar Célula (clicar)
```

### 2. Botão fica amarelo
```
Antes: 🖍️ Destacar Célula
Depois: 🖍️ Modo Ativo (clique nas células)  ← Botão amarelo
```

### 3. Clicar nas células
- Célula fica **amarela** (background #FFEB3B)
- Texto fica **negrito**
- Clicar novamente → **remove destaque**

### 4. Desativar modo
- Clicar novamente no botão 🖍️
- Botão volta ao normal
- Destaques permanecem nas células

---

## 🖼️ Visual

### Botão Normal:
```
┌─────────────────────┐
│ 🖍️ Destacar Célula  │
└─────────────────────┘
```

### Botão Ativo:
```
┌──────────────────────────────────────┐
│ 🖍️ Modo Ativo (clique nas células)  │ ← AMARELO
└──────────────────────────────────────┘
```

### Célula Destacada:
```
┌─────────────────┐
│ CLIENTE         │ ← Normal
├─────────────────┤
│ FERCAM          │ ← AMARELO + BOLD
├─────────────────┤
│ DHL             │ ← Normal
└─────────────────┘
```

---

## 💡 Casos de Uso

### 1. Marcar encomendas urgentes
```
Cliente: URGENTE CORK SUPPLY
Medida: EUR 1200×800
→ Destacar em amarelo
```

### 2. Destacar problemas
```
Cliente: CLIENTE SEM CONFIRMAR
→ Destacar em amarelo
```

### 3. Marcar encomendas especiais
```
Cliente: VIP - REVIGRÉS
→ Destacar em amarelo
```

### 4. Revisão/Verificação
```
Cliente: A VERIFICAR DIMENSÕES
→ Destacar em amarelo
→ Após verificar: remover destaque
```

---

## 🧪 Como Testar

### 1. Abrir Mapa de Encomendas
```
📋 Mapa Encomendas (tab)
```

### 2. Ativar modo destaque
```
Clicar: 🖍️ Destacar Célula
Ver: Toast "Modo destaque ATIVO"
Ver: Botão fica amarelo
```

### 3. Destacar células
```
Clicar em qualquer célula editável
Ver: Célula fica amarela + negrito
Clicar novamente na mesma célula
Ver: Destaque removido
```

### 4. Desativar modo
```
Clicar novamente: 🖍️ Modo Ativo
Ver: Toast "Modo destaque desativado"
Ver: Botão volta ao normal
Nota: Células destacadas PERMANECEM amarelas
```

---

## 🔧 Implementação Técnica

### HTML - Botão adicionado:
```html
<button class="btn-secondary" id="highlight-btn" onclick="toggleHighlightMode()">
    🖍️ Destacar Célula
</button>
```

### CSS - Classes:
```css
/* Célula destacada */
.excel-cell-highlighted {
    background: #FFEB3B !important;
    font-weight: 600 !important;
}

/* Botão modo ativo */
.highlight-mode-active {
    background: #FFEB3B !important;
    border-color: #FFC107 !important;
}
```

### JavaScript - Lógica:
```javascript
let highlightModeActive = false;

function toggleHighlightMode() {
    highlightModeActive = !highlightModeActive;
    // Toggle botão amarelo
    // Mostrar toast
}

// Listener global para cliques
document.addEventListener('click', function(e) {
    if (highlightModeActive && e.target.classList.contains('excel-cell')) {
        // Toggle classe 'excel-cell-highlighted'
    }
});
```

---

## ⚙️ Detalhes Técnicos

### Persistência:
- **Atual:** Destaques são **temporários** (resetam ao recarregar página)
- **Futuro:** Pode ser adicionado salvamento na BD Supabase

### Células suportadas:
- ✅ Todas as células editáveis (`contentEditable='true'`)
- ✅ Cliente, Local, Medida, Qtd, TRANSP, Horário, Observações

### Células NÃO suportadas:
- ❌ Cabeçalhos (Data, Cliente, etc.)
- ❌ Células de data (coluna fixa)
- ❌ Células de semana

---

## 🎨 Cor do Destaque

**Amarelo escolhido:**
- Cor: `#FFEB3B` (amarelo brilhante tipo marcador)
- Borda: `#FFC107` (dourado)
- Contraste: Alto (texto preto legível)
- Similar: Excel/Google Sheets destaque amarelo

---

## 📊 Comparação

| Funcionalidade | Excel | PSY (v2.51.34c) | Status |
|----------------|-------|-----------------|--------|
| Destaque amarelo | ✅ | ✅ | ✅ |
| Toggle on/off | ✅ | ✅ | ✅ |
| Clique célula | ✅ | ✅ | ✅ |
| Remove destaque | ✅ | ✅ | ✅ |
| Múltiplas cores | ✅ | ❌ (só amarelo) | ⚠️ Futuro |
| Persistência | ✅ | ❌ (temporário) | ⚠️ Futuro |

---

## 🚀 Melhorias Futuras (Opcionais)

### 1. Múltiplas cores
```
🔴 Vermelho (urgente)
🟢 Verde (concluído)
🟡 Amarelo (atenção)
🔵 Azul (informação)
```

### 2. Persistência na BD
```javascript
// Salvar destaques no Supabase
async function saveHighlightState() {
    // Guardar células destacadas por data/coluna
}
```

### 3. Atalho de teclado
```
Ctrl + H = Ativar/Desativar modo destaque
Ctrl + Shift + H = Remover todos os destaques
```

---

## 📦 Deploy

### Arquivos modificados:
```
index.html  (v2.51.34c) - Botão + CSS
app.js      (v2.51.34c) - Lógica de destaque
```

### Passos:
1. ✅ Upload de `index.html` e `app.js`
2. ✅ Hard refresh (Ctrl+Shift+R)
3. ✅ Testar:
   - Botão 🖍️ aparece
   - Clicar ativa modo
   - Células ficam amarelas
   - Clicar novamente desativa

---

## ✅ Checklist

- ✅ Botão 🖍️ adicionado ao Mapa de Encomendas
- ✅ CSS `.excel-cell-highlighted` criado
- ✅ JavaScript `toggleHighlightMode()` implementado
- ✅ Event listener para cliques em células
- ✅ Toggle destaque (adicionar/remover)
- ✅ Toast feedback visual
- ✅ Botão fica amarelo quando ativo
- ✅ Testado em desktop

---

## 🎯 Resultado

**Antes (v2.51.34b):**
- ❌ Sem modo de destaque
- ❌ Células normais

**Depois (v2.51.34c):**
- ✅ Botão 🖍️ "Destacar Célula"
- ✅ Modo toggle on/off
- ✅ Células ficam amarelas + negrito
- ✅ Fácil de usar (tipo Excel)

---

**Status:** ✅ Feature implementada e pronta para uso!
