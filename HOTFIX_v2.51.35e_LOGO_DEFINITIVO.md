# 🔧 HOTFIX v2.51.35e – Logo PWA DEFINITIVO

**Data:** 20/03/2026  
**Versão:** v2.51.35e  
**Prioridade:** 🔴 CRÍTICA  

---

## 🐛 Problema Identificado

### O logo da PWA continuava a aparecer como "P" no Windows:

- ❌ **Favicon no browser** → Letra "P"
- ❌ **Ícone da PWA instalada** → Letra "P"  
- ❌ **Ícone na barra de tarefas** → Letra "P"
- ✅ **Logo dentro da app** → Logo PSY correto

---

## 🔍 Causa Raiz

**ERRO DE CAMINHO DE FICHEIRO:**

```
FICHEIRO REAL:    images/logo.png  (✅ existe, 67 KB)
REFERÊNCIAS:      logo.png          (❌ raiz, não existe)
```

### Ficheiros com caminhos ERRADOS:

1. **manifest.json:**
   ```json
   "src": "logo.png"  ❌ 
   ```

2. **index.html (favicons):**
   ```html
   <link rel="icon" href="logo.png?t=...">  ❌
   <link rel="shortcut icon" href="logo.png?t=...">  ❌
   <link rel="apple-touch-icon" href="logo.png?t=...">  ❌
   ```

3. **index.html (imagens):**
   ```html
   <img src="logo.png?t=...">  ❌
   ```

---

## ✅ Solução Aplicada

### 1. Corrigidos TODOS os caminhos para `images/logo.png`

**manifest.json:**
```json
{
  "icons": [
    {
      "src": "images/logo.png",  ✅
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "images/logo.png",  ✅
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "images/logo.png",  ✅
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

**index.html (6 alterações):**
```html
<!-- Favicons -->
<link rel="icon" type="image/png" sizes="32x32" href="images/logo.png?t=20260320">  ✅
<link rel="icon" type="image/png" sizes="16x16" href="images/logo.png?t=20260320">  ✅
<link rel="shortcut icon" href="images/logo.png?t=20260320">  ✅
<link rel="apple-touch-icon" sizes="180x180" href="images/logo.png?t=20260320">  ✅

<!-- Imagens no HTML -->
<img src="images/logo.png?t=20260320">  ✅ (login)
<img src="images/logo.png?t=20260320">  ✅ (header)
```

### 2. Atualizado timestamp da cache

- **Anterior:** `?t=20260318b`
- **Novo:** `?t=20260320`
- **Efeito:** Força refresh de TODOS os recursos

---

## 📦 Ficheiros Modificados

### ✅ Para fazer upload no GitHub:

```
1. index.html        (v2.51.35e - 7 alterações de caminho)
2. manifest.json     (v2.51.35e - 3 alterações de caminho)
```

---

## 🚀 Procedimento de Deploy COMPLETO

### **PASSO 1: Upload dos Ficheiros**

#### Via GitHub Web:
1. Ir a https://github.com/MCFPSY/Gestao_estufas
2. **index.html:**
   - Clicar no ficheiro
   - Editar (ícone lápis)
   - Colar o conteúdo COMPLETO do ficheiro
   - Commit: `"v2.51.35e - Fix logo PWA caminhos definitivo"`
3. **manifest.json:**
   - Repetir o processo
   - Commit: `"v2.51.35e - Fix manifest logo paths"`

#### Via Git CLI:
```bash
cd <caminho-do-projeto>
git add index.html manifest.json
git commit -m "v2.51.35e - Fix logo PWA caminhos definitivo"
git push origin main
```

### **PASSO 2: Aguardar Rebuild do GitHub Pages**
⏱️ **Tempo:** ~1-2 minutos  
✅ **Verificar:** Settings → Pages → último deploy

---

### **PASSO 3: Limpeza TOTAL da Cache (OBRIGATÓRIO)**

#### **Windows – Chrome/Edge:**

**A. Desinstalar PWA Antiga**
```
1. Menu Iniciar → Pesquisar "PSY"
2. Botão direito → Desinstalar
   OU
   Configurações → Apps → Aplicações instaladas → PSY → Desinstalar
```

**B. Limpar Cache do Browser**
```
1. Abrir Chrome/Edge
2. Ctrl + Shift + Delete
3. Intervalo de tempo: "Sempre"
4. ✅ Marcar:
   - Histórico de navegação
   - Cookies e outros dados do site
   - Imagens e ficheiros em cache
   - Dados do site hospedados
5. Clicar "Limpar dados"
```

**C. Limpar Cache de Desenvolvimento**
```
1. Ir a: https://mcfpsy.github.io/Gestao_estufas/
2. Abrir DevTools: F12
3. Tab "Application"
4. Storage → "Clear site data" → Limpar
5. Service Workers → Clicar "Unregister" em cada
6. Cache Storage → Apagar TODAS as caches
```

**D. Hard Reload**
```
1. F12 (DevTools aberto)
2. Botão direito no ícone de refresh (ao lado da barra de endereço)
3. Escolher: "Empty Cache and Hard Reload"
```

**E. Fechar TUDO**
```
1. Fechar TODAS as janelas do Chrome/Edge
2. Ctrl + Shift + Esc (Gestor de Tarefas)
3. Processos → Terminar TODOS os processos "Google Chrome" ou "Microsoft Edge"
```

---

### **PASSO 4: Reinstalar PWA**

```
1. Abrir Chrome/Edge (nova sessão)
2. Ir a: https://mcfpsy.github.io/Gestao_estufas/
3. Fazer login (se necessário)
4. Menu (⋮) no canto superior direito
5. Clicar "Instalar PSY..." ou "Instalar aplicação"
6. Confirmar instalação
```

---

## ✅ Testes de Validação

### **Teste 1: Logo no Browser**
```
✅ Aba do browser → Logo PSY (não "P")
✅ Favoritos → Logo PSY
```

### **Teste 2: Logo da PWA Instalada**
```
✅ Ícone no desktop → Logo PSY
✅ Menu Iniciar → Logo PSY
✅ Barra de tarefas (quando aberta) → Logo PSY
```

### **Teste 3: Logo Dentro da App**
```
✅ Ecrã de login → Logo PSY (120x120)
✅ Header da app → Logo PSY (40x40)
```

### **Teste 4: Verificar Caminhos (DevTools)**
```
1. F12 → Tab "Network"
2. Filtrar por "logo"
3. ✅ Verificar que TODOS os pedidos são:
   - https://mcfpsy.github.io/Gestao_estufas/images/logo.png?t=20260320
   - Status: 200 OK
   - Size: ~67 KB
```

---

## 🎯 Resultados Esperados

### ✅ ANTES vs DEPOIS:

| Local | ANTES (v2.51.35d) | DEPOIS (v2.51.35e) |
|-------|-------------------|-------------------|
| **Favicon browser** | ❌ Letra "P" | ✅ Logo PSY |
| **PWA instalada** | ❌ Letra "P" | ✅ Logo PSY |
| **Menu Iniciar** | ❌ Letra "P" | ✅ Logo PSY |
| **Barra tarefas** | ❌ Letra "P" | ✅ Logo PSY |
| **Header app** | ✅ Logo PSY | ✅ Logo PSY |
| **Login screen** | ✅ Logo PSY | ✅ Logo PSY |

---

## 🔍 Diferenças vs Versões Anteriores

### **v2.51.35c → v2.51.35d:**
- ❌ Tentou resolver com cache busting (`?t=...`)
- ❌ Manteve caminhos ERRADOS (`logo.png` em vez de `images/logo.png`)

### **v2.51.35d → v2.51.35e:**
- ✅ **CORRIGIU A CAUSA RAIZ:** caminhos dos ficheiros
- ✅ Todos os `logo.png` → `images/logo.png`
- ✅ Novo timestamp `?t=20260320`
- ✅ 7 alterações de caminho no total

---

## 📝 Notas Importantes

### ⚠️ **Por que é que demorou tanto a resolver?**

1. **Cache agressiva do Windows/Chrome:**
   - PWAs guardam ícones localmente no sistema
   - Favicons têm cache de ~7 dias
   - Service Workers mantêm recursos em cache

2. **Erro de diagnóstico inicial:**
   - Tentámos resolver com cache busting
   - MAS o problema era o caminho ERRADO do ficheiro
   - O ficheiro `logo.png` na raiz NÃO EXISTE
   - O ficheiro correto é `images/logo.png`

3. **Solução definitiva:**
   - Corrigir caminhos + limpeza TOTAL da cache
   - Só funciona se AMBOS os passos forem feitos

---

## 🎓 Lições Aprendidas

### ✅ **Sempre verificar:**
1. Onde está o ficheiro FISICAMENTE (`LS images/`)
2. Onde o código está a PROCURAR (`logo.png` vs `images/logo.png`)
3. Limpar cache COMPLETAMENTE após mudanças de ícones/favicons

### ✅ **Para PWAs:**
- Desinstalar SEMPRE a versão antiga
- Limpar cache de aplicação + browser + service workers
- Reinstalar após deploy

---

## 📞 Suporte

Se após seguir TODOS os passos o logo continuar errado:

### **Teste Alternativo:**

1. **Abrir janela anónima/privada:**
   ```
   Ctrl + Shift + N (Chrome)
   Ctrl + Shift + P (Edge)
   ```

2. **Ir ao site:**
   ```
   https://mcfpsy.github.io/Gestao_estufas/
   ```

3. **Verificar logo:**
   - Se aparecer correto na janela anónima → problema é cache local
   - Se continuar errado → problema é no deploy do GitHub

---

## ✅ Status

- [x] Caminhos corrigidos (7 alterações)
- [x] Timestamp atualizado
- [x] Documentação criada
- [x] Procedimento de limpeza documentado
- [ ] **Deploy no GitHub** (aguarda utilizador)
- [ ] **Limpeza de cache** (aguarda utilizador)
- [ ] **Teste de validação** (aguarda utilizador)

---

**FIM DO HOTFIX v2.51.35e**
