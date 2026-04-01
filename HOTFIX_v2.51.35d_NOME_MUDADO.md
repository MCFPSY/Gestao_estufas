# 🔄 HOTFIX v2.51.35d – Nome da App Mudado

**Data:** 18/03/2026  
**Versão:** v2.51.35d  
**Estratégia:** Mudar nome para forçar Windows a tratá-la como app NOVA  

---

## 🎯 Nova Estratégia

Como o cache é **extremamente persistente**, vou mudar o **nome da app**:

```
ANTES: "PSY - Gestão de secagens, encomendas e cargas"
DEPOIS: "PSY Gestão"
```

**Por quê?**
- Windows associa o ícone ao **nome da app**
- Mudando o nome → Windows trata como **app diferente**
- Cache antigo do "PSY - Gestão..." não afeta "PSY Gestão"

---

## 📝 Mudanças Aplicadas

### 1. Manifest.json
```json
{
  "name": "PSY Gestão",
  "short_name": "PSY Gestão",
  ...
}
```

### 2. Título da Página
```html
<title>PSY Gestão - Secagens e Cargas</title>
```

### 3. Apple Meta
```html
<meta name="apple-mobile-web-app-title" content="PSY Gestão">
```

### 4. Timestamps Atualizados
```
?t=20260318  →  ?t=20260318b
```

### 5. Manifest Simplificado
Removidos ícones duplicados, mantido apenas os essenciais:
- 512×512 (principal)
- 192×192 (Android)
- 144×144 (Windows, maskable)

---

## 📦 Procedimento de Instalação

### 1. Desinstalar "PSY - Gestão..." Antiga
```
Menu Iniciar → Procurar "PSY" → Desinstalar
```

### 2. Limpar Cache
```
Chrome → Ctrl + Shift + Delete
Marcar tudo → Limpar
```

### 3. Limpar Application Storage
```
F12 → Application → Clear site data
```

### 4. Fechar Chrome TOTALMENTE
```
Fechar todas as abas
Gestor de Tarefas → Terminar processos Chrome
```

### 5. Reabrir e Instalar
```
Chrome → https://mcfpsy.github.io/Gestao_estufas/
↓
Menu (⋮) → "Instalar PSY Gestão..." ← Nome novo!
↓
Instalar
```

---

## 🎯 Resultado Esperado

### Na Caixa de Instalação:
```
┌────────────────────────────────────┐
│ Instalar esta página como uma app  │
│                                    │
│  [Logo]  PSY Gestão               │ ← Nome novo
│          mcfpsy.github.io          │
│                                    │
│  [Instalar]  [Cancelar]           │
└────────────────────────────────────┘
```

### No Desktop:
```
[Logo PSY] 
PSY Gestão  ← Nome novo, ícone novo
```

---

## ✅ Por Que Vai Funcionar

1. **Nome diferente** → Windows não usa cache antigo
2. **Timestamp atualizado** (`b`) → Browser recarrega manifest
3. **Manifest simplificado** → Menos chance de conflito
4. **start_url atualizado** → `/Gestao_estufas/index.html` (mais específico)

---

## 📊 Comparação

| Item | v2.51.35c | v2.51.35d |
|------|-----------|-----------|
| Nome | "PSY - Gestão..." | "PSY Gestão" ✅ |
| Timestamp | `t=20260318` | `t=20260318b` ✅ |
| Ícones manifest | 6 tamanhos | 3 essenciais ✅ |
| start_url | `/Gestao_estufas/` | `...index.html` ✅ |

---

## 🔧 Se AINDA Não Funcionar

### Última Opção: Registar Service Worker Manualmente

Adicionar no `app.js`:
```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(reg => reg.unregister());
  });
}
```

Mas vamos tentar primeiro com a mudança de nome.

---

## 📦 Deploy

**Arquivos:**
```
index.html    (v2.51.35d) - Nome + timestamp b
manifest.json (v2.51.35d) - Nome mudado + simplificado
app.js        (v2.51.35d) - Versão atualizada
```

**Procedimento:**
1. Upload dos 3 arquivos
2. Aguardar 1-2 min (rebuild)
3. Desinstalar app antiga "PSY - Gestão..."
4. Limpar cache Chrome
5. Instalar nova "PSY Gestão"

---

**Status:** ✅ Nome da app mudado para forçar tratamento como app nova.

**Vantagem:** Quando instalar, vai ter **nome diferente** e Windows não vai buscar cache antigo!
