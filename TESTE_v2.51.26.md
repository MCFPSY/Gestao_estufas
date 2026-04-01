# ⚡ TESTE URGENTE v2.51.26 — 1 MINUTO

**Versão**: v2.51.26  
**Data**: 14/03/2026 19:30  
**Tipo**: Hotfix - Mobile mostra TODAS as estufas  
**Tempo de teste**: 1 minuto

---

## 🎯 O Que Mudou

**ANTES (v2.51.25)**:
- ❌ Mobile mostrava apenas estufas 6, 7, 5
- ❌ Estufas 1, 2, 3, 4 ficavam escondidas

**AGORA (v2.51.26)**:
- ✅ Mobile mostra **TODAS as 7 estufas**
- ✅ Layout **vertical** (lista)
- ✅ Desktop **inalterado** (grid 2×4)

---

## 🧪 Teste Rápido (1 minuto)

### ✅ **MOBILE — Todas as Estufas**

1. **Abrir no telemóvel** (ou F12 > Toggle Device Toolbar)
2. **Login** normal
3. **Ir para** "📊 Estufas live"
4. ✅ **VERIFICAR**: Aparecem **7 cards** em lista vertical:
   ```
   ┌─────────────────┐
   │ 6 - LIVRE       │
   ├─────────────────┤
   │ 5 - LIVRE       │
   ├─────────────────┤
   │ 7 - LIVRE       │
   ├─────────────────┤
   │ 1 - ...         │
   ├─────────────────┤
   │ 2 - ...         │
   ├─────────────────┤
   │ 3 - ...         │
   ├─────────────────┤
   │ 4 - ...         │
   └─────────────────┘
   ```
5. ✅ **VERIFICAR**: Scroll vertical suave
6. ✅ **VERIFICAR**: Cards largura completa

**🟢 PASS** = 7 cards visíveis em lista vertical  
**🔴 FAIL** = Faltam estufas ou layout quebrado → reportar

---

### ✅ **DESKTOP — Grid Mantido**

1. **Abrir no computador** (ou maximizar janela do browser)
2. **Ir para** "📊 Estufas live"
3. ✅ **VERIFICAR**: Grid 2×4 (layout fábrica)
4. ✅ **VERIFICAR**: Workspace central visível (🏭 Área de Trabalho)
5. ✅ **VERIFICAR**: Labels PINTURA e CALDEIRAS visíveis

**🟢 PASS** = Layout desktop inalterado  
**🔴 FAIL** = Grid quebrado → reportar

---

## 🚀 Deploy

### Ficheiros a enviar:
1. `index.html` (v2.51.26)
2. `app.js` (v2.51.26)

### Após upload:
```bash
Ctrl + Shift + R  # Limpar cache
```

---

## ✅ Checklist Final

- [ ] Upload de `index.html`
- [ ] Upload de `app.js`
- [ ] Hard refresh (Ctrl + Shift + R)
- [ ] Teste mobile: 7 estufas em lista ✓
- [ ] Teste desktop: grid 2×4 mantido ✓
- [ ] Coluna Estufa continua fixa no Gantt ✓

---

## 📊 Comparação Visual

```
MOBILE v2.51.25 (ANTES)          MOBILE v2.51.26 (AGORA)
┌───────────────┐                ┌─────────────────┐
│ 6 - LIVRE     │                │ 6 - LIVRE       │
├───────────────┤                ├─────────────────┤
│ 7 - LIVRE     │                │ 5 - LIVRE       │
├───────────────┤                ├─────────────────┤
│ 5 - LIVRE     │                │ 7 - LIVRE       │
└───────────────┘                ├─────────────────┤
❌ Faltam 1,2,3,4               │ 1 - ...         │
                                 ├─────────────────┤
                                 │ 2 - ...         │
                                 ├─────────────────┤
                                 │ 3 - ...         │
                                 ├─────────────────┤
                                 │ 4 - ...         │
                                 └─────────────────┘
                                 ✅ TODAS as 7!
```

---

**⏱️ Tempo total**: 1 minuto  
**🎯 Resultado esperado**: Mobile mostra 7 estufas + Desktop mantido

---

*PSY v2.51.26 — 14/03/2026*
