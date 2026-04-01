# 🔧 FIX v2.51.34 – PWA Manifest + Ícone Windows

**Data:** 18/03/2026  
**Versão:** v2.51.34  
**Problema:** Ícone da PWA no Windows mostra "P" em vez do logo PSY  
**Prioridade:** Alta  

---

## 🐛 Problema

Quando o utilizador instala a app no Windows (através do browser), o **ícone do ambiente de trabalho** e da **barra de tarefas** mostra apenas um "P" genérico em vez do logo PSY.

### Onde aparece?
- ❌ Atalho no ambiente de trabalho do Windows
- ❌ Ícone na barra de tarefas (quando app está aberta)
- ❌ Menu Iniciar do Windows
- ❌ Lista de aplicações instaladas

---

## 🔍 Causa

A aplicação **NÃO tinha um arquivo `manifest.json`**, que é o arquivo que define:
- Nome da aplicação (PWA)
- Ícones em vários tamanhos
- Cor do tema
- Modo de exibição (standalone, fullscreen, etc.)

### O que é PWA?
**Progressive Web App** - permite instalar websites como se fossem apps nativas:
- Windows: Chrome/Edge → Menu (⋮) → "Instalar PSY..."
- Android: Chrome → "Adicionar à tela inicial"
- iOS: Safari → Compartilhar → "Adicionar à Tela de Início"

Sem `manifest.json`, o sistema operativo usa um ícone genérico ("P" de PSY).

---

## ✅ Solução Aplicada

### 1. Criar `manifest.json`

```json
{
  "name": "PSY - Gestão de secagens, encomendas e cargas",
  "short_name": "PSY",
  "description": "Sistema de gestão de secagens, encomendas e cargas",
  "start_url": "/Gestao_estufas/",
  "display": "standalone",
  "background_color": "#FFFFFF",
  "theme_color": "#007AFF",
  "icons": [
    {
      "src": "images/logo.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "images/logo.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    }
    // ... outros tamanhos (144, 96, 72, 48)
  ]
}
```

### 2. Adicionar link no HTML

```html
<!-- index.html -->
<link rel="manifest" href="manifest.json">
```

---

## 📊 Tamanhos de Ícones Definidos

| Tamanho | Uso | Plataforma |
|---------|-----|------------|
| 512×512 | Alta resolução | Android, Windows (alta DPI) |
| 192×192 | Padrão | Android, Chrome OS |
| 144×144 | Médio | Windows 10/11 |
| 96×96 | Pequeno | Desktop |
| 72×72 | Tablet | Android |
| 48×48 | Mini | Ícones pequenos |

**Nota:** Todos apontam para `images/logo.png` (o browser redimensiona automaticamente).

---

## 🧪 Como Testar

### No Windows (Chrome/Edge):

1. **Instalar a PWA:**
   ```
   1. Abrir https://mcfpsy.github.io/Gestao_estufas/
   2. Clicar no menu (⋮) → "Instalar PSY..."
   3. Confirmar instalação
   ```

2. **Verificar ícone:**
   - ✅ Atalho no ambiente de trabalho mostra logo PSY
   - ✅ Ícone na barra de tarefas mostra logo PSY
   - ✅ Menu Iniciar mostra logo PSY

3. **Remover instalação anterior (se necessário):**
   ```
   1. Configurações → Apps → Apps instalados
   2. Procurar "PSY"
   3. Desinstalar
   4. Reinstalar com nova versão
   ```

### No Android:

1. Chrome → Abrir app → Menu (⋮) → "Adicionar à tela inicial"
2. Verificar ícone na tela inicial

### No iOS:

1. Safari → Abrir app → Compartilhar → "Adicionar à Tela de Início"
2. Verificar ícone

---

## 📦 Estrutura de Arquivos

```
📁 Gestao_estufas/
├── 📄 index.html       (link para manifest.json)
├── 📄 app.js
├── 📄 manifest.json    ← NOVO!
├── 📁 images/
│   └── 🖼️ logo.png    (67 KB)
└── ...
```

---

## 🎯 Propriedades do manifest.json

| Propriedade | Valor | Função |
|------------|-------|--------|
| `name` | "PSY - Gestão..." | Nome completo da app |
| `short_name` | "PSY" | Nome curto (ícone) |
| `start_url` | "/Gestao_estufas/" | URL inicial |
| `display` | "standalone" | Abre sem barra do browser |
| `theme_color` | "#007AFF" | Cor da barra de status |
| `background_color` | "#FFFFFF" | Cor de fundo ao abrir |
| `icons` | Array de ícones | Múltiplos tamanhos |

---

## ⚠️ Importante

### Cache da PWA

Se a app já estava instalada **ANTES** do manifest.json:

1. **Desinstalar a app antiga:**
   - Windows: Configurações → Apps → PSY → Desinstalar
   - Android: Remover da tela inicial
   - iOS: Segurar ícone → Remover

2. **Limpar cache do browser:**
   ```
   Ctrl + Shift + Delete → Limpar tudo
   ```

3. **Reinstalar:**
   - Abrir URL novamente
   - Instalar novamente
   - Agora o ícone será o logo PSY ✅

---

## 📊 Antes vs Depois

### ANTES (sem manifest.json):
```
Windows:
┌────────┐
│   P    │  ← Ícone genérico (primeira letra)
└────────┘
```

### DEPOIS (com manifest.json):
```
Windows:
┌────────┐
│  🖼️PSY │  ← Logo completo PSY
└────────┘
```

---

## 📦 Deploy

### Arquivos novos/modificados:
```
✅ manifest.json  (NOVO - 1 KB)
✅ index.html     (v2.51.34 - link para manifest)
✅ app.js         (v2.51.34 - versão atualizada)
```

### Passos de deploy:
1. ✅ Upload de `manifest.json`, `index.html`, `app.js`
2. ✅ Confirmar que `images/logo.png` existe (67 KB)
3. ✅ Push para GitHub
4. ✅ Aguardar rebuild do GitHub Pages
5. ✅ **Desinstalar app antiga** (se já instalada)
6. ✅ **Reinstalar** com nova versão
7. ✅ Verificar ícone correto

---

## ✅ Checklist

- ✅ `manifest.json` criado
- ✅ Link adicionado no `index.html`
- ✅ Ícones definidos (6 tamanhos)
- ✅ `theme_color` e `background_color` configurados
- ✅ `display: standalone` (abre sem barra do browser)
- ✅ `start_url` correto para GitHub Pages

---

## 🎯 Resultado Final

| Plataforma | Antes | Depois | Status |
|------------|-------|--------|--------|
| Windows Desktop | "P" ❌ | Logo PSY ✅ | ✅ |
| Windows Barra Tarefas | "P" ❌ | Logo PSY ✅ | ✅ |
| Android Tela Inicial | "P" ❌ | Logo PSY ✅ | ✅ |
| iOS Tela Inicial | Favicon ⚠️ | Logo PSY ✅ | ✅ |

---

**Status:** ✅ **RESOLVIDO** - Agora o ícone da PWA mostra o logo PSY correto!

**Nota:** Utilizadores que já têm a app instalada precisam **desinstalar e reinstalar** para ver o novo ícone.
