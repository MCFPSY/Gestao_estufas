# 🔧 HOTFIX v2.51.38d - Permitir Scroll em Menus/Modais

**Data:** 2026-03-25 20:30  
**Tipo:** HOTFIX - Correção de UX  
**Prioridade:** 🟡 MÉDIA

---

## ⚠️ PROBLEMA

Após o HOTFIX v2.51.37e (zoom fix para TV/Android), o scroll vertical ficou bloqueado em menus e modais, impossibilitando navegar em conteúdos longos.

**Causa:**
```html
<!-- ANTES - Bloqueava scroll do utilizador -->
<meta name="viewport" content="... user-scalable=no">
```

```css
/* ANTES - Não especificava overflow-y */
html, body {
    overflow-x: hidden;  /* Bloqueava horizontal */
    /* overflow-y não definido */
}
```

---

## ✅ SOLUÇÃO

### 1. Permitir scroll vertical + zoom limitado

**Meta viewport atualizada:**
```html
<!-- DEPOIS - Permite scroll e zoom controlado -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
                                                                       ↑↑↑           ↑↑↑
                                                                  max 5x zoom    scroll OK
```

**Comportamento:**
- ✅ Scroll vertical: **permitido**
- ✅ Zoom manual: **permitido** (até 5x)
- ✅ Zoom inicial: **1.0** (sem zoom automático)
- ❌ Scroll horizontal: **bloqueado** (previne layout quebrado)

---

### 2. CSS com overflow-y explícito

```css
/* Permitir scroll vertical, bloquear apenas horizontal */
html, body {
    width: 100%;
    overflow-x: hidden;  /* ❌ Bloqueia horizontal (previne bugs) */
    overflow-y: auto;    /* ✅ Permite vertical (scroll normal) */
    -webkit-overflow-scrolling: touch; /* Smooth scroll no iOS/Android */
}
```

---

## 📊 IMPACTO

| Funcionalidade | v2.51.37e (Antes) | v2.51.38d (Depois) |
|----------------|-------------------|---------------------|
| **Scroll vertical** | ❌ Bloqueado | ✅ Funcionando |
| **Scroll horizontal** | ❌ Bloqueado | ❌ Bloqueado (OK) |
| **Zoom manual** | ❌ Bloqueado | ✅ Permitido (até 5x) |
| **Zoom automático Android** | ✅ Prevenido | ✅ Prevenido |
| **7 estufas visíveis na TV** | ✅ Funcionando | ✅ Funcionando |

---

## 🧪 TESTES

### Teste 1: Scroll em modal longo
1. Abrir modal de secagem
2. Preencher campos até aparecer scrollbar
3. ✅ **Esperado:** Consegue fazer scroll para ver todos os campos

### Teste 2: Zoom manual (mobile/tablet)
1. Abrir app em mobile/tablet
2. Pinch-to-zoom (dois dedos)
3. ✅ **Esperado:** Permite zoom até 5x

### Teste 3: TV/Android Box (não deve quebrar)
1. Abrir app na TV
2. Verificar Gantt
3. ✅ **Esperado:** Ainda mostra 7 estufas completas
4. ✅ **Esperado:** Sem zoom automático indesejado

### Teste 4: Scroll horizontal (deve continuar bloqueado)
1. Tentar scroll horizontal no body
2. ✅ **Esperado:** Bloqueado (apenas Gantt tem scroll-x)

---

## 🎯 BALANÇO FINAL

**O que foi preservado (do v2.51.37e):**
- ✅ 7 estufas visíveis na TV/Android Box
- ✅ Zoom inicial fixo em 1.0
- ✅ Prevenir zoom automático do Android
- ✅ Scroll horizontal bloqueado no body

**O que foi corrigido (v2.51.38d):**
- ✅ Scroll vertical funciona normalmente
- ✅ Zoom manual permitido (útil para mobile)
- ✅ Modais e menus com scroll

---

## 📁 FICHEIRO MODIFICADO

✅ **index.html** (2 alterações):
- Linha 5: Meta viewport (`user-scalable=yes`, `maximum-scale=5.0`)
- Linhas 28-32: CSS overflow (`overflow-y: auto`)

---

## 🚀 DEPLOY

```bash
git add index.html
git commit -m "v2.51.38d - HOTFIX: Permitir scroll vertical e zoom manual"
git push origin main
```

**Não precisa alterar BD!** É apenas CSS/HTML.

---

**Implementado por:** AI Assistant  
**Data:** 2026-03-25 20:30  
**Versão:** v2.51.38d  
**Status:** ✅ Corrigido
