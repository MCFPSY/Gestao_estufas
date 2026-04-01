# 🚨 DEPLOY URGENTE v2.51.36i - INSTRUÇÕES SUPER CLARAS

**Data:** 25/03/2026 11:50  
**Versão:** v2.51.36i (HOTFIX RADICAL)

---

## 🔥 MUDANÇAS RADICAIS IMPLEMENTADAS

### ✅ O QUE FOI MUDADO

1. **Funções tornadas GLOBAIS** (window.xxx)
   - `window.openPdfImporter()`
   - `window.closePdfImporter()`
   - `window.openCargasDetalhe()`
   - `window.closeResumoDiaModal()`
   - `window.openMapaCargas()`

2. **onclick inline DIRETO no botão PDF**
   ```html
   <button onclick="window.openPdfImporter(); console.log('CLICK');">
   ```

3. **onclick inline DIRETO nos cards** (via JavaScript)
   ```javascript
   card.onclick = function() { window.openCargasDetalhe(dateKey); };
   ```

4. **Logs GIGANTES e COLORIDOS**
   - `console.log('%c🔥 TEXTO', 'background: red; color: white; font-size: 20px;')`
   - Impossível não ver no console

5. **Auto-refresh iniciado AUTOMATICAMENTE**
   - Após 5 segundos do page load
   - Log colorido gigante quando executa

---

## 📋 CHECKLIST PASSO-A-PASSO

### 1️⃣ VERIFICAR VERSÃO NO CONSOLE

Após deploy, abrir https://mcfpsy.github.io/Gestao_estufas/ e **IMEDIATAMENTE** abrir console (F12).

**DEVE APARECER (em VERMELHO GIGANTE):**
```
🔥 APP.JS v2.51.36i - HOTFIX MODALS FUNCIONANDO 🔥
📋 Changelog: Flag dataset.opening + stopImmediatePropagation + Indicador refresh
```

**SE NÃO APARECER:**
- ❌ Arquivo `app.js` NÃO foi atualizado
- Solução: Limpar cache (Ctrl+Shift+R) ou aguardar mais tempo

---

### 2️⃣ TESTAR BOTÃO IMPORTAR PDF

1. Ir para tab **"📋 Mapa Encomendas"**
2. Clicar no botão **"📄 Importar PDF"**

**CONSOLE DEVE MOSTRAR (em LARANJA GIGANTE):**
```
🖱️ CLICK INLINE no botão PDF
📄 OPEN PDF IMPORTER CHAMADO!
✅ [OPEN] Modal encontrado
✅ [OPEN] Display após flex: flex
```

**SE APARECER VERMELHO:**
```
❌ MODAL PDF NÃO ENCONTRADO!
```
→ Problema no HTML (modal não existe)

**SE NÃO APARECER NADA:**
→ Função `window.openPdfImporter` não existe (arquivo app.js antigo)

---

### 3️⃣ TESTAR CLICK NO CARD (CARGAS RESUMO)

1. Ir para tab **"📦 Cargas Resumo"**
2. Aguardar cards aparecerem
3. Clicar em **qualquer card**

**CONSOLE DEVE MOSTRAR (em LARANJA GIGANTE):**
```
🖱️ CLICK NO CARD: 24/03/2026
📅 OPEN CARGAS DETALHE: 24/03/2026
```

**SE NÃO APARECER "CLICK NO CARD":**
→ onclick não foi configurado (problema no renderResumoCargas)

---

### 4️⃣ VERIFICAR AUTO-REFRESH

1. Abrir console (F12)
2. **Aguardar 5 segundos** após page load

**CONSOLE DEVE MOSTRAR (em AZUL):**
```
🚀 INICIALIZANDO SISTEMA...
```

**Depois de 5 segundos (em VERDE):**
```
🔄 INICIANDO AUTO-REFRESH (60s)...
```

3. **Aguardar 60 segundos**

**CONSOLE DEVE MOSTRAR (em VERDE GIGANTE):**
```
🔄 AUTO-REFRESH EXECUTADO (tab: planeamento)
```

4. **Verificar ícone 🔄 no header:**
   - Deve estar VISÍVEL (canto superior direito)
   - Deve estar GIRANDO
   - Deve dar FLASH (crescer) a cada 60s

---

## 🚨 TROUBLESHOOTING IMEDIATO

### ❌ Se logs GIGANTES não aparecem:
1. Limpar cache: **Ctrl+Shift+R** (Windows/Linux) ou **Cmd+Shift+R** (Mac)
2. Aguardar 2-3 minutos (GitHub Pages demora)
3. Verificar timestamp do arquivo no GitHub:
   - https://github.com/MCFPSY/Gestao_estufas/blob/main/app.js
   - Ver "Last commit" → deve ser HOJE (25/03/2026)

### ❌ Se "window.openPdfImporter is not defined":
→ Arquivo `app.js` NÃO foi atualizado
→ Copiar NOVAMENTE o conteúdo local para o GitHub

### ❌ Se modal abre e fecha imediatamente:
→ Verificar se aparece:
```
⚠️ [CLOSE] CANCELADO - Modal está abrindo!
```
→ Se SIM: flag `dataset.opening` está funcionando
→ Se modal ainda fecha: há outro código chamando close (procurar no HTML)

### ❌ Se ícone 🔄 não aparece:
1. Abrir console
2. Verificar log: `🔄 INICIANDO AUTO-REFRESH`
3. Se NÃO aparecer: `startAutoRefresh()` não foi chamado
4. Chamar manualmente: `window.startAutoRefresh && window.startAutoRefresh()`

---

## 📞 CHECKLIST DE VALIDAÇÃO COMPLETA

Marcar ✅ conforme testar:

```
[ ] Console mostra: 🔥 APP.JS v2.51.36i (VERMELHO GIGANTE)
[ ] Botão PDF: Console mostra 📄 OPEN PDF IMPORTER (LARANJA GIGANTE)
[ ] Botão PDF: Modal abre e PERMANECE aberto
[ ] Card Resumo: Console mostra 🖱️ CLICK NO CARD (LARANJA GIGANTE)
[ ] Card Resumo: Modal abre e PERMANECE aberto
[ ] Auto-refresh: Console mostra 🔄 INICIANDO AUTO-REFRESH após 5s
[ ] Auto-refresh: Console mostra 🔄 EXECUTADO a cada 60s (VERDE GIGANTE)
[ ] Ícone 🔄: Aparece no header (canto superior direito)
[ ] Ícone 🔄: Está girando continuamente
[ ] Ícone 🔄: Dá flash/cresce a cada 60s
```

---

## 🎯 SE TUDO FALHAR

Execute no console (F12):

```javascript
// Verificar se funções existem
console.log('openPdfImporter:', typeof window.openPdfImporter);
console.log('openCargasDetalhe:', typeof window.openCargasDetalhe);
console.log('startAutoRefresh:', typeof startAutoRefresh);

// Chamar manualmente
window.openPdfImporter && window.openPdfImporter();
```

**Resultado esperado:**
```
openPdfImporter: function
openCargasDetalhe: function
startAutoRefresh: function
```

**Se mostrar "undefined":**
→ Arquivo `app.js` NÃO foi atualizado no servidor

---

## 📁 ARQUIVOS A ATUALIZAR

### ✅ app.js
- Tamanho: ~220 KB
- Linhas: ~5450
- **CRÍTICO:** Primeira linha DEVE ter o log gigante vermelho

### ✅ index.html
- Tamanho: ~90 KB
- Linhas: ~2660
- **CRÍTICO:** Linha ~2232 DEVE ter `onclick="window.openPdfImporter()"`

---

## ⚡ DEPLOY RÁPIDO

1. Copiar **TODO** o conteúdo de `app.js` local
2. Editar https://github.com/MCFPSY/Gestao_estufas/blob/main/app.js
3. **Colar** (substituir tudo)
4. Commit: `v2.51.36i - HOTFIX RADICAL: onclick inline + logs gigantes`
5. Repetir para `index.html`
6. Aguardar 2 minutos
7. Testar com **Ctrl+Shift+R**

---

**✅ COM LOGS GIGANTES COLORIDOS, É IMPOSSÍVEL NÃO VER O QUE ESTÁ ACONTECENDO!**
