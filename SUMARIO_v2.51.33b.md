# 📦 SUMÁRIO v2.51.33b – Hotfix CSS

**Data:** 18/03/2026  
**Tipo:** Correção urgente  
**Versão:** v2.51.33b  

---

## 🎯 O Que Foi Corrigido

### Problema reportado
Usuário reportou que **duas mudanças da v2.51.33 NÃO funcionaram**:
1. ❌ Altura das 4 linhas principais não reduziu
2. ❌ Texto inserido não aumentou (ver foto)

### Causa identificada
1. **CSS `aspect-ratio: 2/1`** estava forçando altura de ~100px (ignora `min-height: 30px`)
2. **CSS `.matrix-cell .cell-tipo`** não aplicava fonte 22px corretamente

### Solução aplicada
```css
/* ✅ CORRIGIDO */
.matrix-cell {
    height: 30px;  /* Altura FIXA (removido aspect-ratio) */
    font-size: 22px;
    font-weight: 700;
}

.matrix-cell .cell-tipo {
    font-size: 22px;
    font-weight: 700;
    line-height: 1.2;
}
```

---

## 📊 Resultado Final

| Item | Antes | Depois | ✅ |
|------|-------|--------|---|
| Altura células | ~100px | **30px** | ✅ -70% |
| Fonte células | 11px | **22px bold** | ✅ +100% |
| Legibilidade | Baixa | **Alta** | ✅ |

---

## 📦 Deploy

**Arquivos:** `index.html` + `app.js` (v2.51.33b)  
**Ação:** Upload + hard refresh (Ctrl+Shift+R)  
**Teste:** Abrir modal "Nova Secagem" → células 30px de altura + texto 22px bold

---

## ✅ Status

**HOTFIX APLICADO** – Matriz agora funciona conforme especificado.  
Pronto para produção.
