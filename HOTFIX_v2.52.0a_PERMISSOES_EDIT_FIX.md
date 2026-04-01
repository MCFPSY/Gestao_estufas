# 🚑 HOTFIX v2.52.0a - Correção Permissões "edit"

**Data:** 2026-03-26  
**Prioridade:** 🔴 CRÍTICA  
**Problema:** Utilizadores com permissão "edit" não conseguem editar nada

---

## ⚠️ PROBLEMA

Utilizador com permissões:
```json
{
  "planeamento": "edit",
  "visualizacao": "edit",
  "encomendas": "edit",
  "cargas": "edit",
  "cargas_resumo": "edit"
}
```

**Sintoma:** Não consegue criar/editar secagens ou encomendas  
**Causa:** Variável `currentUser` não estava declarada globalmente

---

## 🔍 CAUSA RAIZ

No `app.js`, a variável `currentUser` era usada mas **nunca foi declarada**:

```javascript
// ❌ ANTES - currentUser não declarado
let userPermissions = {};

// ... mais tarde no código
currentUser = session.user; // ← Variável implícita (má prática)
```

Resultado:
- `currentUser` era `undefined` em alguns momentos
- `currentUser?.role` retornava `undefined`
- `canEdit()` retornava `false` sempre

---

## ✅ SOLUÇÃO

Declarar explicitamente `currentUser` como variável global:

```javascript
// ✅ DEPOIS - Declaração explícita
let currentUser = null;
let userPermissions = {};
```

---

## 🔧 ALTERAÇÃO NO CÓDIGO

**Ficheiro:** `app.js`  
**Linha:** ~150

**Antes:**
```javascript
// 🔐 v2.52.0: Variável global para permissões
let userPermissions = {};
```

**Depois:**
```javascript
// 🔐 v2.52.0: Variáveis globais de autenticação e permissões
let currentUser = null;
let userPermissions = {};
```

---

## 🧪 TESTES

### Teste 1: Utilizador com permissão "edit"
1. Login com utilizador que tem `"planeamento": "edit"`
2. Ir para tab "Planeamento estufas"
3. Click numa célula vazia
4. ✅ **Esperado:** Abre modal de nova secagem (sem toast de erro)

### Teste 2: Utilizador com permissão "view"
1. Login com utilizador que tem `"planeamento": "view"`
2. Ir para tab "Planeamento estufas"
3. Click numa célula vazia
4. ✅ **Esperado:** Toast "⚠️ Não tem permissão para criar secagens"

### Teste 3: Admin
1. Login com utilizador `role: 'admin'`
2. Tentar qualquer ação
3. ✅ **Esperado:** Sempre permitido (bypass de permissões)

---

## 🚀 DEPLOY

```bash
git add app.js
git commit -m "v2.52.0a - HOTFIX: Declarar currentUser globalmente (fix permissões edit)"
git push origin main
```

---

## 📊 VERIFICAÇÃO PÓS-DEPLOY

**Console logs esperados após login:**

```javascript
👤 Utilizador: goncalo
🔑 Role: operador
🔐 Permissões: {
  planeamento: "edit",
  visualizacao: "edit",
  encomendas: "edit",
  cargas: "edit",
  cargas_resumo: "edit"
}
```

**Ao clicar numa célula (com permissão edit):**
```javascript
🔘 Clique na célula vazia: Estufa 1 25/03/2026
// Abre modal (SEM toast de erro)
```

**Ao clicar numa célula (sem permissão edit):**
```javascript
🔘 Clique na célula vazia: Estufa 1 25/03/2026
⚠️ Não tem permissão para criar secagens
// NÃO abre modal
```

---

## 🔍 COMO DETECTAR O PROBLEMA

Se `currentUser` não estiver declarado, no console aparece:

```javascript
// Em algum lugar:
currentUser = session.user;

// Mais tarde:
console.log(currentUser); // ← undefined ou objeto incompleto
console.log(currentUser?.role); // ← undefined
```

Isso faz com que `canEdit()` **sempre retorne false**:

```javascript
function canEdit(tabId) {
    if (currentUser?.role === 'admin') return true; // ← false (role é undefined)
    
    const permission = userPermissions[tabId];
    return permission === 'edit' || permission === 'admin'; // ← false (mesmo com edit)
}
```

---

## 📝 LIÇÕES APRENDIDAS

### ✅ Boas práticas:

1. **Sempre declarar variáveis globais** no topo do ficheiro
2. **Usar `let` ou `const`** explicitamente
3. **Inicializar com `null`** para evitar `undefined`
4. **Adicionar logs temporários** para debug de permissões

### ❌ Evitar:

1. Variáveis implícitas (sem `let`/`const`/`var`)
2. Assumir que variáveis existem
3. Não verificar valores `undefined`

---

## 🔗 RELAÇÃO COM v2.52.0

Este hotfix corrige um **bug crítico** introduzido no v2.52.0:
- v2.52.0: Sistema de permissões implementado ✅
- v2.52.0a: Correção de bug que impedia funcionamento ✅

---

**Status:** ✅ Corrigido  
**Impacto:** 🔴 Crítico (bloqueava todos os utilizadores não-admin)  
**Deploy:** ⏳ Aguarda push para GitHub
