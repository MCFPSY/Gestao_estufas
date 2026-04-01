# 📦 Deploy v2.51.35h - Instruções Completas

## ✅ Ficheiros para Atualizar:

```
1. icons/icon-512.png   (NOVO - fazer upload do logo)
2. icons/icon-192.png   (NOVO - fazer upload do logo)
3. index.html           (atualizado com novos caminhos)
4. manifest.json        (atualizado com novos caminhos)
```

---

## 🚀 PASSO 1: Criar pasta icons/ e fazer upload do logo

### No GitHub:
1. Ir a: https://github.com/MCFPSY/Gestao_estufas
2. Clicar **"Add file"** → **"Upload files"**
3. **Arrastar o ficheiro `logo.png`** (do teu PC)
4. **ANTES de commit,** editar o nome do ficheiro para: `icons/icon-512.png`
5. Clicar **"Commit changes"**

6. Repetir o processo:
   - **"Add file"** → **"Upload files"**
   - Arrastar novamente o `logo.png`
   - Renomear para: `icons/icon-192.png`
   - Commit

**OU (mais rápido):**
- Upload os 2 ficheiros de uma vez (GitHub cria a pasta automaticamente)

---

## 🚀 PASSO 2: Atualizar index.html

1. No GitHub, clicar em **`index.html`**
2. Clicar no **ícone do lápis** (Edit)
3. **APAGAR TODO** o conteúdo
4. **COLAR** o novo conteúdo (que está na secção abaixo)
5. Commit message: `"v2.51.35h - Use icons/ folder"`
6. **Commit changes**

---

## 🚀 PASSO 3: Atualizar manifest.json

1. No GitHub, clicar em **`manifest.json`**
2. Clicar no **ícone do lápis** (Edit)
3. **APAGAR TODO** o conteúdo
4. **COLAR** o novo conteúdo (abaixo)
5. Commit message: `"v2.51.35h - Use icons/ folder"`
6. **Commit changes**

---

## 🧪 PASSO 4: Testar

1. Aguardar 1-2 minutos (rebuild do GitHub Pages)
2. Ir a: https://mcfpsy.github.io/Gestao_estufas/
3. **Ctrl + F5** (hard refresh)
4. ✅ Logo deve aparecer no ecrã de login
5. ✅ Logo deve aparecer no header após login

---

## 📄 Conteúdo do manifest.json:

```json
{
  "name": "PSY Gestão",
  "short_name": "PSY Gestão",
  "description": "Sistema de gestão de secagens, encomendas e cargas",
  "start_url": "/Gestao_estufas/index.html",
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
      "purpose": "any"
    },
    {
      "src": "/Gestao_estufas/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/Gestao_estufas/icons/icon-192.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

---

## ✅ Estrutura Final no GitHub:

```
Gestao_estufas/
├── index.html          (atualizado)
├── app.js
├── manifest.json       (atualizado)
├── icons/              (NOVO)
│   ├── icon-512.png    (logo 512x512)
│   └── icon-192.png    (logo 192x192)
└── images/
    └── ... (outros ficheiros)
```

---

## 🎯 Caminhos Usados (como na tua outra app):

| Ficheiro | Caminho |
|----------|---------|
| **Favicons** | `/Gestao_estufas/icons/icon-192.png` |
| **Apple Touch Icon** | `/Gestao_estufas/icons/icon-512.png` |
| **Manifest Icons** | `/Gestao_estufas/icons/icon-512.png` e `icon-192.png` |
| **Login Logo** | `/Gestao_estufas/icons/icon-512.png` |
| **Header Logo** | `/Gestao_estufas/icons/icon-192.png` |

---

## 📝 Diferença vs Versões Anteriores:

- **v2.51.35e-g:** Caminhos errados, logo desapareceu
- **v2.51.35h:** Pasta `icons/` dedicada (como a tua outra app) ✅

---

**FIM DAS INSTRUÇÕES**
