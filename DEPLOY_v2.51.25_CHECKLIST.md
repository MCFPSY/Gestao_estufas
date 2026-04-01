# ✅ DEPLOY v2.51.25 — CHECKLIST

**Versão**: v2.51.25  
**Data**: 14/03/2026 19:00  
**Tipo**: Feature - Melhorias de UX

---

## 📦 Ficheiros a Enviar

### ✅ **Obrigatórios**
1. **index.html** (83 KB) ← **v2.51.25**
2. **app.js** (175 KB) ← **v2.51.25**

### ℹ️ **Opcional** (já existem no servidor)
- `images/logo.png` (67 KB) — **Não precisa reenviar** (já está no GitHub)

---

## 🚀 Passos de Deploy

### 1️⃣ **Upload dos Ficheiros**
```
📁 Servidor/GitHub
├── index.html     ← Substituir pelo novo
├── app.js         ← Substituir pelo novo
└── images/
    └── logo.png   ← Já existe (não mexer)
```

### 2️⃣ **Verificar URLs**
Após upload, confirmar que carregam:
- ✅ https://teu-site.com/index.html
- ✅ https://teu-site.com/app.js
- ✅ https://teu-site.com/images/logo.png ← **Deve continuar acessível**

---

## 🧪 Teste Pós-Deploy (2 minutos)

### ✅ **Desktop**
1. Abrir https://teu-site.com
2. **Hard refresh**: `Ctrl + Shift + R` (Windows) ou `Cmd + Shift + R` (Mac)
3. Login normal
4. Ir para **"📅 Planeamento estufas"**
5. Fazer **scroll horizontal** para a direita
6. ✓ **VERIFICAR**: Coluna "Estufa" permanece fixa à esquerda
7. ✓ **VERIFICAR**: Sombra sutil na coluna fixa

### ✅ **Mobile**
1. Abrir no telemóvel (ou F12 > Toggle Device Toolbar)
2. **Hard refresh**: Menu > Recarregar
3. Login normal
4. Ir para **"📊 Estufas live"**
5. ✓ **VERIFICAR**: Aparecem apenas **3 cards** (Estufa 6, 7 e 5)
6. ✓ **VERIFICAR**: Zoom-out permite ver tudo sem scroll horizontal
7. Voltar ao desktop (ou fechar DevTools)
8. ✓ **VERIFICAR**: Desktop mostra **todas as 7 estufas**

---

## 🔍 Debug (Se Algo Falhar)

### ❌ **Coluna Estufa não fica fixa**
```bash
# Verificar se o CSS está correto:
F12 > Elements > Selecionar coluna "Estufa" > Computed
# Procurar: position: sticky; left: 0; z-index: 10;
```

### ❌ **Mobile mostra todas as estufas**
```bash
# Verificar media query:
F12 > Console > Executar:
window.matchMedia('(max-width: 768px)').matches
# Deve retornar: true (em mobile)
```

### ❌ **Logo não aparece**
```bash
# Verificar URL direta:
https://teu-site.com/images/logo.png
# Deve mostrar: imagem da estufa

# Se falhar:
1. Verificar se a pasta "images/" existe
2. Reenviar o logo.png (67 KB)
```

---

## 📊 Checklist Final

### Antes do Deploy
- [x] Código testado localmente
- [x] Documentação criada
- [x] Versão atualizada (v2.51.25)

### Durante o Deploy
- [ ] Upload de `index.html` concluído
- [ ] Upload de `app.js` concluído
- [ ] Verificar URLs acessíveis

### Após o Deploy
- [ ] Hard refresh executado
- [ ] Teste desktop: coluna Estufa fixa ✓
- [ ] Teste mobile: 3 estufas visíveis ✓
- [ ] Logo aparece no header e login ✓

---

## ⚠️ Notas Importantes

1. **Não remover** a pasta `images/` ou o `logo.png`
2. **Sempre fazer hard refresh** após deploy (`Ctrl + Shift + R`)
3. **Se falhar**, verificar Console (F12) por erros JavaScript
4. **Mobile**: Testar em dispositivo real, não só no DevTools

---

## 📞 Em Caso de Problemas

### Sintoma → Solução

| Problema | Causa | Solução |
|----------|-------|---------|
| Coluna não fica fixa | Cache antigo | Hard refresh + Logout/Login |
| Mobile mostra 7 estufas | Media query não aplicada | Verificar largura do ecrã (<768px) |
| Logo não aparece | Caminho errado | Verificar `images/logo.png` existe |
| Página em branco | Erro JavaScript | F12 > Console > reportar erro |

---

## 🎯 Resultado Esperado

### ✅ **Desktop (Computador)**
- Coluna "Estufa" fixa durante scroll horizontal
- Sombra sutil na coluna
- Dashboard mostra **7 estufas**

### ✅ **Mobile (Telemóvel)**
- Dashboard mostra **apenas 3 estufas** (6, 7, 5)
- Zoom-out 75% para visualização confortável
- Sem scroll horizontal excessivo

---

**🎉 Deploy v2.51.25 concluído com sucesso!**

*Tempo estimado total: 5 minutos (upload + teste)*

---

*PSY Team — 14/03/2026*
