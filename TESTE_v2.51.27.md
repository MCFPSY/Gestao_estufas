# ⚡ TESTE URGENTE v2.51.27 — 2 MINUTOS

**Versão**: v2.51.27  
**Data**: 14/03/2026 20:00  
**Tipo**: Bugfix - Inserir linha na data correta  
**Tempo de teste**: 2 minutos

---

## 🐛 Bug Corrigido

**ANTES (v2.51.26)**:
- ❌ Clicar em **+ no dia 18/mar** → Linha inserida no **04/mar** (ERRADO!)
- ❌ Apagar linha do dia **20/mar** → Apagava linha errada

**AGORA (v2.51.27)**:
- ✅ Clicar em **+ no dia 18/mar** → Linha inserida **abaixo do 18/mar** (CORRETO!)
- ✅ Apagar linha do dia **20/mar** → Apaga a linha correta

---

## 🧪 Teste Rápido (2 minutos)

### ✅ **Teste 1: Inserir Linha COM Filtro de Semana**

1. **Login** no sistema
2. **Ir para** 📋 Mapa Encomendas
3. **Selecionar semana** no dropdown (ex: "Semana 12")
4. **Clicar no botão +** ao lado do dia **18/mar**
5. ✅ **VERIFICAR**: Nova linha aparece **abaixo do 18/mar**
6. ✅ **VERIFICAR**: Data da nova linha = **19/mar** (ou mesma data se tiver duplicação)
7. ✅ **VERIFICAR**: Console mostra:
   ```
   ➕ Inserindo nova linha abaixo de 18/mar (índice visual: X, real: Y)
   ```

**🟢 PASS** = Nova linha no local correto  
**🔴 FAIL** = Nova linha em data diferente → reportar

---

### ✅ **Teste 2: Apagar Linha COM Filtro de Semana**

1. Manter **filtro de semana ativo** (ex: Semana 12)
2. **Clicar no botão −** ao lado do dia **20/mar**
3. **Confirmar** a exclusão
4. ✅ **VERIFICAR**: Linha **20/mar** foi removida (não outra!)
5. ✅ **VERIFICAR**: Outras linhas da semana permanecem intactas

**🟢 PASS** = Linha correta removida  
**🔴 FAIL** = Linha errada removida → reportar

---

### ✅ **Teste 3: SEM Filtro (Verificar Regressão)**

1. **Remover filtro** (dropdown → "Todas as semanas")
2. **Clicar no botão +** ao lado de qualquer data (ex: 10/mar)
3. ✅ **VERIFICAR**: Nova linha aparece **abaixo da data clicada**
4. **Clicar no botão −** em outra data
5. ✅ **VERIFICAR**: Linha correta é removida

**🟢 PASS** = Funciona sem filtro (sem regressão)  
**🔴 FAIL** = Quebrou funcionalidade → reportar

---

## 🚀 Deploy

### Ficheiros a enviar:
1. **app.js** (v2.51.27) ← **OBRIGATÓRIO**
2. ~~index.html~~ ← **Não precisa** (sem mudanças)

### Após upload:
```bash
Ctrl + Shift + R  # Hard refresh
```

---

## 🔍 Debug (Se Falhar)

### Console Logs Esperados

Ao inserir linha, deve aparecer:
```javascript
➕ Inserindo nova linha abaixo de 18/mar (índice visual: 0, real: 14)
✅ Nova linha inserida abaixo de 18/mar
```

Se não aparecer, verificar:
1. **F12** > Console
2. Verificar erros JavaScript
3. Verificar se `app.js` foi substituído corretamente

---

## 📊 Comparação

```
SITUAÇÃO: Filtro Semana 12 ativo (datas 18, 19, 20, 21, 22)

ANTES v2.51.26:                AGORA v2.51.27:
┌──────────┐                   ┌──────────┐
│ 04 Mar   │ ← Linha           │ 18 Mar   │
│ ...      │   inserida        │ 19 Mar   │ ← Nova linha
│ 18 Mar   │ ← Clique aqui     │ 20 Mar   │
│ 19 Mar   │                   │ 21 Mar   │
│ 20 Mar   │                   │ 22 Mar   │
└──────────┘                   └──────────┘
❌ ERRADO!                      ✅ CORRETO!
```

---

## ✅ Checklist Final

- [ ] Upload de `app.js` (v2.51.27)
- [ ] Hard refresh (Ctrl + Shift + R)
- [ ] Teste 1: Inserir linha COM filtro ✓
- [ ] Teste 2: Apagar linha COM filtro ✓
- [ ] Teste 3: Operações SEM filtro ✓
- [ ] Verificar Console logs

---

## ⚠️ Notas Importantes

1. **Sempre fazer hard refresh** após substituir `app.js`
2. **Testar COM e SEM filtro** de semana
3. **Verificar Console** (F12) para logs de debug
4. **Se falhar**, reportar com:
   - Data clicada
   - Filtro ativo (sim/não)
   - Data onde a linha apareceu
   - Screenshot do Console

---

**⏱️ Tempo total**: 2 minutos  
**🎯 Resultado esperado**: Inserir/apagar na data correta (com ou sem filtro)

---

*PSY v2.51.27 — 14/03/2026*
