# ⚡ TESTE URGENTE v2.51.25 — 2 MINUTOS

**Versão**: v2.51.25  
**Data**: 14/03/2026 19:00  
**Tempo de teste**: 2 minutos

---

## 🎯 O Que Mudou

1. ✅ **Coluna "Estufa" agora é fixa** no Planeamento (sticky)
2. ✅ **Mobile mostra apenas Estufas 6, 7 e 5** com zoom-out 75%

---

## 🧪 Teste Rápido (2 minutos)

### ✅ **DESKTOP — Coluna Fixa**

1. **Abrir** https://teu-site.com
2. **Login** normal
3. **Ir para** "📅 Planeamento estufas"
4. **Fazer scroll horizontal** para a direita
5. ✅ **VERIFICAR**: Coluna "Estufa" fica sempre visível à esquerda
6. ✅ **VERIFICAR**: Sombra sutil na coluna

**🟢 PASS** = Coluna Estufa permanece fixa  
**🔴 FAIL** = Coluna desaparece no scroll → reportar

---

### ✅ **MOBILE — Estufas 6, 7, 5**

1. **Abrir no telemóvel** (ou F12 > Toggle Device Toolbar)
2. **Login** normal
3. **Ir para** "📊 Estufas live"
4. ✅ **VERIFICAR**: Aparecem apenas **3 cards** (Estufa 6, 7 e 5)
5. ✅ **VERIFICAR**: Zoom-out permite ver tudo sem scroll horizontal
6. ✅ **VERIFICAR**: Desktop ainda mostra **todas as 7 estufas**

**🟢 PASS** = Mobile mostra 3 estufas com zoom-out  
**🔴 FAIL** = Mostra todas ou nenhuma → reportar

---

## 🚀 Deploy

### Ficheiros a enviar:
1. `index.html` (v2.51.25)
2. `app.js` (v2.51.25)
3. `logo.png` (já existe, não precisa reenviar)

### Após upload:
```bash
Ctrl + Shift + R  # Limpar cache
```

---

## ✅ Checklist Final

- [ ] Upload de `index.html`
- [ ] Upload de `app.js`
- [ ] Hard refresh (Ctrl + Shift + R)
- [ ] Teste desktop: coluna Estufa fixa ✓
- [ ] Teste mobile: apenas 3 estufas ✓
- [ ] Logout + Login para garantir

---

**⏱️ Tempo total**: 2 minutos  
**🎯 Resultado esperado**: Coluna fixa em desktop + 3 estufas focadas no mobile

---

*PSY v2.51.25 — 14/03/2026*
