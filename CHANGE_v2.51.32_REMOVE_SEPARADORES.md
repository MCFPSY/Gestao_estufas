# 🔧 CHANGE v2.51.32 — Remoção dos Separadores Picotados

**Data**: 14/03/2026 22:45  
**Versão**: v2.51.32  
**Tipo**: Change - Limpeza Visual  
**Status**: ✅ Produção

---

## 🎯 Alteração Solicitada

**Pedido**: Remover as linhas picotadas (separadores horizontais) da matriz de carga

---

## ✅ Alteração Implementada

### CSS Removido

**ANTES (v2.51.31)**:
```css
/* Separador após linha 1 */
.matrix-cell[data-row="1"][data-col="2"]::after {
    content: '';
    /* ... linha picotada ... */
}

/* Separador após linha 3 */
.matrix-cell[data-row="3"][data-col="2"]::after {
    content: '';
    /* ... linha picotada ... */
}
```

**DEPOIS (v2.51.32)**:
```css
/* 🔥 v2.51.32: Separadores picotados removidos (não são mais necessários) */
```

---

## 📊 Visual

### ANTES (com separadores)
```
┌────┬────┐
│1-1 │1-2 │
├────┼────┤ ─ ─ ─ ─ ─ ← Separador picotado
│2-1 │2-2 │
├────┼────┤
│3-1 │3-2 │
├────┼────┤ ─ ─ ─ ─ ─ ← Separador picotado
│4-1 │4-2 │
└────┴────┘
```

### DEPOIS (limpo)
```
┌────┬────┐
│1-1 │1-2 │
├────┼────┤
│2-1 │2-2 │
├────┼────┤
│3-1 │3-2 │
├────┼────┤
│4-1 │4-2 │
└────┴────┘
```

---

## 📋 Ficheiros Alterados

- ✅ `index.html` — CSS dos separadores removido (~30 linhas)
- ✅ `app.js` — Versão atualizada
- ✅ `README.md` — Versão atualizada

---

## 🧪 Teste Rápido

1. Upload `index.html` + `app.js`
2. Hard refresh (`Ctrl + Shift + R`)
3. Nova Secagem → Verificar matriz **SEM** linhas picotadas ✓

---

**🎉 v2.51.32**: Matriz 2×4 agora tem visual limpo e minimalista!

---

*PSY Team — 14/03/2026*
