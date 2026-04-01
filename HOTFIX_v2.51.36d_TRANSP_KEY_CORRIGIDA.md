# 🔥 HOTFIX v2.51.36d — Correção da Key `transporte` → `transp`

**Data:** 24/03/2026  
**Versão:** v2.51.36d  
**Tipo:** Hotfix Critical  
**Estado:** ✅ COMPLETO

---

## 🎯 PROBLEMA CRÍTICO IDENTIFICADO

### **Tab "Cargas Resumo" mostra "Sem cargas" mesmo com TRANSP preenchido**

**Sintomas:**
- Utilizador confirma: "no dia 24 de Março tenho imensos TRANSP preenchidos"
- Interface mostra: "Sem cargas" em todos os dias
- Console (esperado): `"✅ 0 cargas com transporte preenchido"`

**Causa Raiz:**

```javascript
// ❌ ERRADO: Procurava key "transporte"
const transporteKey = `${i}_transporte`;
const transporte = encomendasData.data[transporteKey];
```

**Mas o campo chama-se `transp` (não `transporte`)!**

Verificado em `app.js` linha 1627:
```javascript
{ label: 'TRANSP', key: 'transp', color: '#FFFFFF', width: '120px' }
```

---

## ✅ CORREÇÃO APLICADA

### **Função `renderResumoCargas()` — Key Corrigida**

**Ficheiro:** `app.js` (linha ~4857)

```javascript
// ✅ CORRETO: Usa key "transp"
const transpKey = `${i}_transp`;
const transp = encomendasData.data[transpKey];

// Só incluir se tiver TRANSP preenchido
if (transp && transp.trim() !== '') {
    const horarioKey = `${i}_horario_carga`;
    cargas.push({
        data: data,
        horario_carga: encomendasData.data[horarioKey] || '',
        transp: transp  // ← Incluído para debug
    });
}
```

**Mudanças:**
- ❌ `transporte` → ✅ `transp`
- ❌ `transporteKey` → ✅ `transpKey`
- ✅ Adicionado campo `transp` no objeto carga (para debug)

---

## 📊 ANTES vs DEPOIS

### **ANTES (v2.51.36c):**

```javascript
// Mapa de Encomendas: Campo "TRANSP" com key='transp'
// Linha 5: transp = "Cliente Transportes Lda."

// renderResumoCargas() procurava:
const transporteKey = `5_transporte`;  // ← Key errada!
const transporte = encomendasData.data[transporteKey];  // undefined

// Resultado: 0 cargas detectadas
```

### **DEPOIS (v2.51.36d):**

```javascript
// Mapa de Encomendas: Campo "TRANSP" com key='transp'
// Linha 5: transp = "Cliente Transportes Lda."

// renderResumoCargas() procura:
const transpKey = `5_transp`;  // ← Key correta!
const transp = encomendasData.data[transpKey];  // "Cliente Transportes Lda."

// Resultado: Carga detectada! ✅
```

---

## 🔍 DIAGNÓSTICO COMPLETO

### **Como identificar o problema:**

1. **Abrir Console (F12)**
2. **Executar no console:**
   ```javascript
   // Ver todas as keys que contêm "transp"
   Object.keys(encomendasData.data).filter(k => k.includes('transp'))
   
   // Deve retornar: ["0_transp", "1_transp", "5_transp", ...]
   ```

3. **Ver valores:**
   ```javascript
   // Ver todos os TRANSP preenchidos
   Object.keys(encomendasData.data)
       .filter(k => k.includes('_transp') && encomendasData.data[k])
       .map(k => ({ key: k, value: encomendasData.data[k] }))
   ```

---

## 📋 FICHEIROS MODIFICADOS

| Ficheiro  | Alteração                                  | Linhas |
|-----------|--------------------------------------------|--------|
| `app.js`  | `transporte` → `transp` (3 ocorrências)    | 3      |
| `app.js`  | Adicionado campo `transp` no objeto carga  | 1      |

**Total:** 4 linhas alteradas

---

## ✅ VALIDAÇÃO

### Teste 1: Console Debug

Após abrir tab "Cargas Resumo", verificar console:

```
✅ 5 cargas com transporte preenchido  ← Deve ser > 0
📊 Primeiras 3 cargas: [
  {data: "24/03/2026", horario_carga: "Manhã", transp: "Cliente A"},
  {data: "24/03/2026", horario_carga: "Tarde", transp: "Cliente B"},
  {data: "25/03/2026", horario_carga: "Manhã", transp: "Cliente C"}
]
```

### Teste 2: Interface

- [ ] Dia **24/03/2026** mostra número de cargas (não "Sem cargas")
- [ ] Card tem cor correta:
  - 🟢 Verde: ≤ 3 cargas
  - 🟡 Amarelo: 4-6 cargas
  - 🔴 Vermelho: > 6 cargas
- [ ] Mostra contagem: "☀️ Manhã: X", "🌙 Tarde: Y"

### Teste 3: Comparação com Mapa de Encomendas

1. Abrir **"📋 Mapa de Encomendas"**
2. Contar quantas linhas do dia 24/03 têm campo **TRANSP** preenchido
3. Abrir **"📦 Cargas Resumo"**
4. Verificar se o número bate

---

## 🚀 DEPLOY

### Ficheiros a atualizar:

```
✅ app.js  (CRÍTICO — contém a correção)
```

**Não precisa atualizar:**
- ❌ `index.html` (sem alterações)
- ❌ `manifest.json` (sem alterações)

### Procedimento:

1. Aceder: https://github.com/MCFPSY/Gestao_estufas
2. Editar `app.js`
3. Copiar todo o conteúdo do ficheiro local
4. Commit: **"v2.51.36d - Fix transp key in Cargas Resumo"**
5. Aguardar 1-2 min (rebuild automático)
6. Testar: https://mcfpsy.github.io/Gestao_estufas/

---

## 📊 HISTÓRICO DE VERSÕES

| Versão    | Data       | Mudança Principal                              |
|-----------|------------|------------------------------------------------|
| v2.51.36  | 24/03/2026 | 3 funcionalidades (Copy/Paste, PDF, Resumo)   |
| v2.51.36a | 24/03/2026 | Modal PDF estrutura + `supabase` → `db`        |
| v2.51.36b | 24/03/2026 | Z-index modal + Resumo usa dados locais        |
| v2.51.36c | 24/03/2026 | 15+ logs de debug + conversão data             |
| v2.51.36d | 24/03/2026 | **Key `transporte` → `transp` (CRÍTICO)**      |

---

## 🔗 REFERÊNCIAS

- **Documentação anterior:** `DEBUG_v2.51.36c_LOGS_DETALHADOS.md`
- **Repositório:** https://github.com/MCFPSY/Gestao_estufas
- **Produção:** https://mcfpsy.github.io/Gestao_estufas/

---

## ⚠️ LEMBRETE: ÍCONES

**Antes de fazer deploy**, ainda falta criar a pasta `icons/`:

1. GitHub → **"Add file"** → **"Upload files"**
2. Arrastar `logo.png` 2x, renomear:
   - `icons/icon-512.png`
   - `icons/icon-192.png`
3. Commit: **"v2.51.36 - Add icons folder"**

---

## ✍️ AUTOR

**Desenvolvido por:** Assistente AI  
**Solicitado por:** Utilizador MCFPSY  
**Data:** 24/03/2026  
**Versão:** v2.51.36d

---

**🔥 FIM DO HOTFIX**
