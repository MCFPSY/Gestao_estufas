# 🔥 HOTFIX v2.51.26 — Mobile Mostra TODAS as Estufas

**Data**: 14/03/2026 19:30  
**Versão**: v2.51.26  
**Tipo**: Hotfix - Correção Mobile  
**Status**: ✅ Produção

---

## 🐛 Problema Reportado

**Sintoma**:
- Mobile **não mostrava estufas 1, 2, 3, 4** (ficavam escondidas)
- Versão anterior (v2.51.25) só exibia estufas 6, 7 e 5 no telemóvel
- Desktop funcionava perfeitamente

**Impacto**:
- ❌ Utilizadores mobile não conseguiam ver o estado completo da fábrica
- ❌ Impossível monitorizar estufas 1-4 no telemóvel

---

## ✅ Solução Implementada

### Alteração no Layout Mobile

**ANTES (v2.51.25)**:
```css
/* Escondia estufas 1-4 */
.dashboard-grid .estufa-card:nth-child(1),
.dashboard-grid .estufa-card:nth-child(2),
.dashboard-grid .estufa-card:nth-child(3),
.dashboard-grid .estufa-card:nth-child(4) {
    display: none !important;
}
```

**DEPOIS (v2.51.26)**:
```css
/* Layout vertical - TODAS as 7 estufas visíveis */
.dashboard-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
}

/* Resetar posicionamento grid */
.dashboard-grid .estufa-card[data-estufa="1"],
.dashboard-grid .estufa-card[data-estufa="2"],
/* ... até 7 ... */ {
    grid-column: auto;
    grid-row: auto;
    min-width: 100%;
}

/* Esconder apenas workspace e labels */
.factory-workspace,
.factory-label {
    display: none !important;
}
```

---

## 🎯 Resultado

### ✅ **Mobile (< 768px)**
- **Layout vertical** (Flexbox column)
- **TODAS as 7 estufas** aparecem em lista
- **Cards full-width** para melhor legibilidade
- **Gap de 12px** entre cards
- **Sem workspace/labels** (só estufas)

### ✅ **Desktop (≥ 768px)**
- **Grid 2×4** mantido (layout fábrica)
- **Estufas posicionadas** conforme planta física
- **Workspace central** visível
- **Labels PINTURA/CALDEIRAS** visíveis
- **Sem alterações** (tudo como antes)

---

## 📋 Ficheiros Alterados

### `index.html` (v2.51.26)
```diff
- /* Esconder estufas 1, 2, 3, 4 no mobile */
- .dashboard-grid .estufa-card:nth-child(1),
- .dashboard-grid .estufa-card:nth-child(2),
- .dashboard-grid .estufa-card:nth-child(3),
- .dashboard-grid .estufa-card:nth-child(4) {
-     display: none !important;
- }

+ /* Layout vertical - TODAS as 7 estufas visíveis */
+ .dashboard-grid {
+     display: flex;
+     flex-direction: column;
+     gap: 12px;
+ }
```

### `app.js` (v2.51.26)
- ✅ Atualizado cabeçalho de versão
- ⚠️ Sem alterações de lógica

---

## 🧪 Como Testar (1 minuto)

### ✅ **Mobile**
1. Abrir no **telemóvel** (ou F12 > DevTools > Toggle Device Toolbar)
2. Login normal
3. Ir para **📊 Estufas live**
4. **VERIFICAR**: Aparecem **7 cards** em lista vertical:
   - Estufa 6 (azul claro)
   - Estufa 5 (roxo)
   - Estufa 7 (rosa)
   - Estufa 1
   - Estufa 2
   - Estufa 3
   - Estufa 4
5. **VERIFICAR**: Scroll vertical suave
6. **VERIFICAR**: Cards ocupam largura completa

### ✅ **Desktop**
1. Abrir no **computador**
2. Ir para **📊 Estufas live**
3. **VERIFICAR**: Grid 2×4 mantido (layout fábrica)
4. **VERIFICAR**: Workspace central visível
5. **VERIFICAR**: Labels PINTURA/CALDEIRAS visíveis

---

## 📊 Comparação

| Aspecto | v2.51.25 (Anterior) | v2.51.26 (Atual) |
|---------|---------------------|------------------|
| **Mobile - Estufas visíveis** | ❌ Apenas 3 (6,7,5) | ✅ Todas as 7 |
| **Mobile - Layout** | Grid comprimido | Flexbox vertical |
| **Mobile - Scroll** | Horizontal + Vertical | Apenas Vertical |
| **Desktop - Layout** | ✅ Grid 2×4 | ✅ Grid 2×4 (sem mudança) |
| **Desktop - Workspace** | ✅ Visível | ✅ Visível (sem mudança) |
| **Experiência Mobile** | 🔴 Incompleta | 🟢 Completa |

---

## ✅ Checklist de Deploy

- [x] Código corrigido
- [x] Testado em mobile (Chrome DevTools)
- [x] Testado em desktop (sem regressões)
- [x] Versão atualizada (v2.51.26)
- [x] Documentação criada

### 📦 **Ficheiros a Enviar**
1. `index.html` (v2.51.26) ← **Alterado**
2. `app.js` (v2.51.26) ← **Alterado**

---

## 🔮 Melhorias Futuras (Opcional)

1. **Ordenação customizada** no mobile (priorizar estufas mais usadas)
2. **Filtro de estufas** (mostrar apenas ativas/livres)
3. **Scroll horizontal** para cards (estilo carrossel)
4. **Animações** na transição desktop ↔ mobile

---

## 📝 Notas Técnicas

- **Flexbox**: melhor que Grid para layouts lineares mobile
- **Media query**: `@media (max-width: 768px)` mantida
- **Performance**: sem impacto (apenas CSS, sem JS adicional)
- **Compatibilidade**: todos os browsers modernos

---

**🎉 Hotfix v2.51.26**: Agora mobile mostra **todas as 7 estufas** em layout vertical otimizado, sem comprometer o desktop!

---

*PSY Team — 14/03/2026 19:30*
