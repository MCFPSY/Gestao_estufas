# ✅ CHECKLIST DE DEPLOY v2.51.33g

**Data:** 18/03/2026  
**Versão:** v2.51.33g - Favicon raiz + cache busting  

---

## 📦 Arquivos para Deploy

### ✅ Arquivos modificados:
```
✅ index.html  (v2.51.33g) - Favicon corrigido + cache busting
✅ app.js      (v2.51.33g) - Versão atualizada  
✅ logo.png    (copiar para raiz se não estiver)
```

### 📁 Estrutura final do repositório:
```
📁 Gestao_estufas/
├── 📄 index.html
├── 📄 app.js
├── 🖼️ logo.png  ← DEVE ESTAR NA RAIZ!
├── 📄 manifest.json
├── 📄 README.md
├── 📁 images/
│   └── 🖼️ logo.png (pode manter, não é usado)
└── 📁 (outros arquivos .md)
```

---

## 🚀 Passos de Deploy no GitHub

### 1. Verificar arquivos locais
```bash
# Confirmar que logo.png está na raiz:
ls -la logo.png
# Deve mostrar: logo.png (67 KB)
```

### 2. Fazer commit
```bash
git add index.html app.js logo.png
git commit -m "v2.51.33g - Favicon raiz + cache busting"
```

### 3. Push para GitHub
```bash
git push origin main
```

### 4. Aguardar GitHub Pages rebuild
- Ir em: **Settings** → **Pages**
- Aguardar rebuild (~30-60 segundos)
- Verificar status: ✅ "Your site is live at..."

---

## 🧪 Testes Pós-Deploy

### 1. Testar no browser
```
URL: https://mcfpsy.github.io/Gestao_estufas/
```

### 2. Hard refresh
```
Ctrl + Shift + R  (Windows/Linux)
Cmd + Shift + R   (Mac)
```

### 3. Verificar favicon
- ✅ Logo PSY aparece na aba do browser
- ✅ Sem "P" genérico

### 4. Verificar Console (F12)
```
Network → Filtrar "logo.png"
Status: 200 OK ✅
URL: logo.png?v=2.51.33g
```

### 5. Testar em múltiplos devices
- ✅ Desktop (Chrome, Firefox, Edge)
- ✅ Mobile (Android, iOS)
- ✅ Tablet

---

## 📊 Mudanças Principais

### 1. Favicon (6 locais)
```html
<!-- ANTES -->
href="images/logo.png"

<!-- DEPOIS -->
href="logo.png?v=2.51.33g"
```

### 2. Cache busting
- Parâmetro `?v=2.51.33g` força reload
- Usuários verão novo logo **SEM** limpar cache

### 3. Estrutura de arquivos
- `logo.png` movido para **raiz**
- HTML atualizado

---

## ⚠️ Pontos de Atenção

### 1. Logo.png na raiz
**CRÍTICO:** O arquivo `logo.png` **DEVE** estar na raiz do repositório:
```
✅ /logo.png
❌ /images/logo.png  (não é usado mais)
```

### 2. Cache busting
Se fizer nova versão, mudar o parâmetro:
```html
<!-- Próxima versão -->
href="logo.png?v=2.51.34"
       ↑ Incrementar versão
```

### 3. GitHub Pages
- Aguardar rebuild após push
- Pode demorar até 2 minutos
- Verificar status em Settings → Pages

---

## 🎯 Resultado Esperado

| Item | Antes | Depois |
|------|-------|--------|
| Favicon | "P" ❌ | **Logo PSY** ✅ |
| Caminho | `images/` ❌ | **Raiz** ✅ |
| Cache | Manual ❌ | **Auto** ✅ |
| Multi-user | ❌ | ✅ |

---

## ✅ Checklist Final

**Antes de fazer push:**
- [ ] `index.html` atualizado (v2.51.33g)
- [ ] `app.js` atualizado (v2.51.33g)
- [ ] `logo.png` está na **raiz** do projeto
- [ ] Testado localmente

**Após push:**
- [ ] GitHub Pages rebuild concluído
- [ ] URL acessível: https://mcfpsy.github.io/Gestao_estufas/
- [ ] Favicon aparece no browser
- [ ] Sem erros 404 no Console (F12)
- [ ] Testado em desktop + mobile

**Confirmação final:**
- [ ] Múltiplos usuários veem logo correto
- [ ] Cache busting funciona
- [ ] Sem necessidade de limpar cache manual

---

## 📱 Teste Multi-Dispositivo

### Desktop
- [ ] Chrome (Windows)
- [ ] Firefox (Windows)
- [ ] Edge (Windows)

### Mobile
- [ ] Chrome (Android)
- [ ] Safari (iOS)

### Verificar em cada:
- [ ] Favicon na aba
- [ ] Logo no header
- [ ] Logo na tela de login

---

## 🎉 Deploy Concluído!

**Versão:** v2.51.33g  
**Status:** ✅ Pronto para produção  
**Funcionalidades:**
- ✅ Matriz 2×4 (células 60px, footer 36px, fonte 17px bold)
- ✅ Favicon PSY (raiz + cache busting)
- ✅ Multi-dispositivo
- ✅ Auto-update sem limpar cache

---

**Próximo passo:** Fazer push para GitHub e testar! 🚀
