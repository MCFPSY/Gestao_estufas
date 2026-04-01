# 🖼️ HOTFIX v2.52.1 - Ícone Windows PWA

**Data:** 2026-03-26  
**Prioridade:** 🟡 MÉDIA  
**Problema:** Ícone da PWA não aparece no Windows (ficheiros vazios)

---

## ⚠️ PROBLEMA

Os ficheiros de ícone estão vazios (0 bytes):
```
icons/icon-192.png → 0 bytes ❌
icons/icon-512.png → 0 bytes ❌
```

Resultado: Windows mostra ícone genérico "P" em vez do logo PSY.

---

## ✅ SOLUÇÃO

### **Opção 1: Usar ícone do logo PSY existente**

Se você tem o ficheiro do logo PSY (`.png` ou `.svg`), precisa:

1. Redimensionar para múltiplos tamanhos
2. Salvar na pasta `icons/`

**Tamanhos necessários:**
- 512x512 px → `icon-512.png`
- 192x192 px → `icon-192.png`
- 144x144 px → `icon-144.png` (novo)
- 96x96 px → `icon-96.png` (novo)
- 72x72 px → `icon-72.png` (novo)
- 48x48 px → `icon-48.png` (novo)

---

### **Opção 2: Criar ícone placeholder temporário**

Enquanto não tem o logo pronto, posso criar um SVG placeholder.

---

## 🔧 ATUALIZAR MANIFEST.JSON

```json
{
  "name": "PSY Gestão",
  "short_name": "PSY",
  "description": "Sistema de gestão de secagens, encomendas e cargas",
  "start_url": "/Gestao_estufas/",
  "scope": "/Gestao_estufas/",
  "display": "standalone",
  "background_color": "#FFFFFF",
  "theme_color": "#007AFF",
  "orientation": "any",
  "icons": [
    {
      "src": "/Gestao_estufas/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/Gestao_estufas/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/Gestao_estufas/icons/icon-144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/Gestao_estufas/icons/icon-96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/Gestao_estufas/icons/icon-72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/Gestao_estufas/icons/icon-48.png",
      "sizes": "48x48",
      "type": "image/png",
      "purpose": "any"
    }
  ]
}
```

---

## 📋 ADICIONAR FAVICON.ICO

Windows também precisa de `favicon.ico` na raiz. Criar a partir do logo:

**Localização:** `/Gestao_estufas/favicon.ico`

**Adicionar no `<head>` do index.html:**
```html
<link rel="icon" type="image/x-icon" href="/Gestao_estufas/favicon.ico">
```

---

## 🎨 COMO CRIAR OS ÍCONES

### **Ferramentas online:**

1. **RealFaviconGenerator** (recomendado)
   - https://realfavicongenerator.net/
   - Upload do logo PSY
   - Gera todos os tamanhos automaticamente
   - Download ZIP com tudo

2. **PWA Builder**
   - https://www.pwabuilder.com/imageGenerator
   - Upload logo
   - Gera PWA icons

3. **ICO Converter**
   - https://www.icoconverter.com/
   - Para criar favicon.ico

---

## 📦 ESTRUTURA FINAL

```
/Gestao_estufas/
├── favicon.ico (NOVO)
├── icons/
│   ├── icon-512.png (SUBSTITUIR)
│   ├── icon-192.png (SUBSTITUIR)
│   ├── icon-144.png (NOVO)
│   ├── icon-96.png (NOVO)
│   ├── icon-72.png (NOVO)
│   └── icon-48.png (NOVO)
├── manifest.json (ATUALIZAR)
└── index.html (atualizar <link favicon>)
```

---

## 🚀 PASSOS

1. **Obter ficheiro do logo PSY** (PNG ou SVG alta resolução)
2. **Gerar ícones** usando ferramenta online
3. **Substituir ficheiros** em `icons/`
4. **Adicionar favicon.ico** na raiz
5. **Atualizar manifest.json**
6. **Commit e deploy**
7. **Reinstalar PWA** no Windows

---

## 🧪 TESTAR NO WINDOWS

1. Desinstalar PWA antiga (se instalada)
2. Limpar cache do browser
3. Abrir: https://mcfpsy.github.io/Gestao_estufas/
4. Instalar PWA novamente
5. ✅ Verificar ícone correto no desktop/menu iniciar

---

## 📝 NOTA IMPORTANTE

**Depois de atualizar os ícones, os utilizadores precisam:**
1. Desinstalar a PWA antiga
2. Limpar cache do browser
3. Reinstalar a PWA

Ou aguardar que o navegador atualize automaticamente (pode demorar dias).

---

**Status:** ⏳ Aguarda ficheiros de ícone do logo PSY  
**Bloqueador:** Ícones atuais estão vazios (0 bytes)
