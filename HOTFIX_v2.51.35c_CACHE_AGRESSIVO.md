# 🔥 HOTFIX v2.51.35c – Anti-Cache Agressivo

**Data:** 18/03/2026  
**Versão:** v2.51.35c  
**Problema:** Logo continua "P" mesmo após múltiplos deploys  
**Causa:** Cache extremamente persistente do browser + PWA  

---

## 🔍 Situação

**Confirmado pelo utilizador:**
- ✅ URL funciona: `https://mcfpsy.github.io/Gestao_estufas/logo.png` mostra logo correto
- ❌ App mostra: "P" genérico (cache antigo)
- ❌ PWA ícone: "P" genérico (manifest em cache)

**Conclusão:** O arquivo está correto, mas o **cache é MUITO persistente**.

---

## 🛠️ Soluções Aplicadas

### 1. Meta Tags Anti-Cache
```html
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
<meta http-equiv="Pragma" content="no-cache">
<meta http-equiv="Expires" content="0">
```
**Efeito:** Browser **não pode** cachear página

### 2. Timestamp Estático (não versão)
```html
<!-- Antes: -->
href="logo.png?v=2.51.35b"

<!-- Depois: -->
href="logo.png?t=20260318"
```
**Vantagem:** Número de versão pode ser ignorado pelo browser, mas **data (timestamp) força reload**

### 3. Manifest com Timestamp
```html
<link rel="manifest" href="manifest.json?t=20260318">
```

---

## 📦 Procedimento COMPLETO de Limpeza

### ⚠️ CRÍTICO: Fazer TODOS os passos na ordem

#### 1. Desinstalar PWA
```
Windows:
Menu Iniciar → "PSY" → Clicar direito → Desinstalar
```

#### 2. Limpar Chrome COMPLETAMENTE
```
Chrome aberto → Ctrl + Shift + Delete
↓
Período: "Desde sempre"
↓
Marcar TUDO:
  ☑ Histórico de navegação
  ☑ Cookies e outros dados
  ☑ Imagens e ficheiros em cache
  ☑ Dados de aplicações alojadas
↓
"Limpar dados"
```

#### 3. Limpar Storage da App (IMPORTANTE!)
```
Chrome → Ir para: https://mcfpsy.github.io/Gestao_estufas/
↓
F12 → Aba "Application"
↓
No lado esquerdo:
  1. Storage → "Clear site data" (botão)
  2. Service Workers → Clicar "Unregister" em todos
  3. Cache Storage → Apagar tudo (botão direito → Delete)
  4. Local Storage → Apagar
  5. Session Storage → Apagar
```

#### 4. Hard Reload com DevTools
```
F12 ainda aberto
↓
Clicar direito no botão Atualizar (🔄) do browser
↓
"Esvaziar a cache e recarregar forçadamente"
```

#### 5. Fechar Chrome TOTALMENTE
```
Fechar todas as abas
↓
Gestor de Tarefas (Ctrl+Shift+Esc)
↓
Terminar TODOS os processos "Google Chrome"
```

#### 6. Reabrir e Testar ANTES de Instalar
```
Abrir Chrome
↓
Ir para: https://mcfpsy.github.io/Gestao_estufas/logo.png
Verificar: Logo PSY aparece ✅
↓
Ir para: https://mcfpsy.github.io/Gestao_estufas/
↓
F12 → Console → Ver se há erros
↓
Ver se logo aparece no header (canto superior esquerdo)
```

#### 7. SE logo aparece no header → Instalar PWA
```
Menu (⋮) → Instalar PSY
↓
Verificar ícone no desktop
```

---

## 🎯 Por Que Vai Funcionar Agora?

### Meta Tags
```
Cache-Control: no-cache, no-store, must-revalidate
Pragma: no-cache
Expires: 0
```
**Browser NÃO PODE cachear** - tem que buscar sempre do servidor

### Timestamp em vez de Versão
```
?t=20260318  ← Browser vê como parâmetro novo = arquivo novo
```

### Limpeza Completa
- Service Workers apagados
- Cache Storage limpo
- PWA desinstalada
- Chrome reiniciado

---

## 🧪 Verificação Pós-Deploy

### 1. Testar URL direto
```
https://mcfpsy.github.io/Gestao_estufas/logo.png?t=20260318
```
**Deve mostrar:** Logo PSY ✅

### 2. Verificar Console
```
F12 → Console
```
**Não deve haver:** Erros de logo

### 3. Verificar Network
```
F12 → Network → Filtrar "logo"
```
**Deve mostrar:**
- `logo.png?t=20260318`
- Status: `200 OK`
- Size: `~67 KB` (não "from cache")

---

## 📊 Comparação

| Tentativa | Método | Resultado |
|-----------|--------|-----------|
| v2.51.33h | `?v=versão` | ❌ Cache persistiu |
| v2.51.34 | manifest.json | ❌ Cache persistiu |
| v2.51.35b | Caminhos corretos | ❌ Cache persistiu |
| **v2.51.35c** | **Timestamp + no-cache** | ✅ **Deve funcionar** |

---

## ⚠️ Se AINDA Não Funcionar

Significa que o **cache está no nível do sistema operativo** (Windows). Nesse caso:

### Opção Nuclear:
```
1. Reiniciar computador
2. Abrir Chrome
3. Seguir procedimento acima
```

### OU usar outro browser temporariamente:
```
Edge/Firefox → Instalar PWA lá
(para confirmar que funciona)
```

---

## 📦 Arquivos para Deploy

```
index.html   (v2.51.35c) - Meta tags + timestamp
manifest.json (sem mudanças)
app.js       (v2.51.35c) - Versão atualizada
```

---

## ✅ Checklist

**Pré-deploy:**
- [x] Meta tags no-cache adicionadas
- [x] Timestamps em todos os logos
- [x] Manifest com timestamp

**Deploy:**
- [ ] Upload index.html
- [ ] Upload app.js
- [ ] Aguardar 1 min

**Pós-deploy:**
- [ ] Desinstalar PWA
- [ ] Limpar cache Chrome (Ctrl+Shift+Delete)
- [ ] F12 → Application → Clear site data
- [ ] Hard reload (F12 + clicar direito em 🔄)
- [ ] Fechar Chrome completamente
- [ ] Reabrir e testar

**Verificação:**
- [ ] Logo aparece no header ✅
- [ ] Logo aparece no login ✅
- [ ] Instalar PWA
- [ ] Ícone PWA correto ✅

---

**Status:** ✅ Mudanças anti-cache mais agressivas aplicadas. 

**Próximo passo:** Deploy + procedimento completo de limpeza.
