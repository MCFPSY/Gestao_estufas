# 🔍 DEBUG v2.51.29 — Rastreamento de Cargas Sem TRANSP

**Data**: 14/03/2026 21:30  
**Versão**: v2.51.29  
**Tipo**: Debug - Investigação  
**Status**: 🔍 Diagnóstico

---

## 🎯 Objetivo

**Problema Reportado**:
- **Mapa de Encomendas** mostra várias cargas no dia 18/03 das 10:00-12:00
- **Mapa de Cargas** só mostra **1 carga** (IPP) no mesmo horário
- Empilhamento horizontal **não funciona** (cargas "desaparecem")

**Hipótese**:
- As outras cargas podem **NÃO ter** o campo **TRANSP** (transportadora) preenchido
- **Mapa de Cargas** só mostra cargas **com TRANSP preenchido** (por design)

---

## 🔍 Nova Funcionalidade de Debug

### Log Adicionado

**ANTES (v2.51.28)**:
```javascript
✅ Cargas filtradas com TRANSP: 12
```

**AGORA (v2.51.29)**:
```javascript
✅ Cargas filtradas com TRANSP: 12
⚠️ Cargas SEM TRANSP (não aparecem): 8

⚠️ ATENÇÃO: Cargas sem TRANSP preenchido (NÃO APARECEM no Mapa):
   1. 18/03 - SÃO JOÃO DE VER - Horário: "10:00 - 12:00"
   2. 18/03 - ÁGUA PASCUAL - Horário: "10:00 - 12:00"
   3. 18/03 - SETÚBAL - Horário: "10:00 - 12:00"
   ...

💡 SOLUÇÃO: Preencher campo TRANSP no Mapa de Encomendas para estas cargas aparecerem!
```

---

## 🧪 Como Diagnosticar (1 minuto)

### Passo 1: Verificar Console

1. **Abrir** 🚚 Mapa Cargas
2. **F12** > Console
3. **Procurar** linha `⚠️ Cargas SEM TRANSP`
4. **Verificar** lista de cargas sem transportadora

**Se aparecerem cargas na lista**:
- ✅ **Problema identificado**: Cargas sem TRANSP não aparecem no mapa
- 💡 **Solução**: Preencher campo TRANSP no Mapa de Encomendas

**Se NÃO aparecerem cargas**:
- ⚠️ **Outro problema**: Investigar normalização de horário ou filtro de semana

---

### Passo 2: Verificar Mapa de Encomendas

1. **Ir para** 📋 Mapa Encomendas
2. **Filtrar** por Semana 12 (ou atual)
3. **Procurar** dia **18/03**
4. **Verificar** coluna **TRANSP** das cargas com horário 10:00-12:00

**Exemplo**:
```
DIA     CLIENTE          HORÁRIO        TRANSP
18/03   IPP              10:00 - 12:00  FERCAM      ✅ Aparece
18/03   SÃO JOÃO         10:00 - 12:00  (vazio)     ❌ NÃO aparece
18/03   ÁGUA PASCUAL     10:00 - 12:00  (vazio)     ❌ NÃO aparece
18/03   SETÚBAL          10:00 - 12:00  (vazio)     ❌ NÃO aparece
```

---

## 🔧 Solução

### Se o Problema for TRANSP Vazio

**Opção 1: Preencher TRANSP Manualmente**
1. Ir para **Mapa de Encomendas**
2. Clicar na célula **TRANSP** de cada carga
3. Digitar nome da transportadora (ex: "PSY", "FERCAM", etc.)
4. Sistema salva automaticamente
5. Voltar ao **Mapa Cargas** > **Atualizar** 🔄

**Opção 2: Modificar Lógica (Mostrar Todas)**
- Alterar `app.js` para mostrar cargas **mesmo sem TRANSP**
- ⚠️ Pode poluir o calendário com cargas irrelevantes

---

## 📊 Cenários Possíveis

### Cenário A: Cargas sem TRANSP ✅ (Mais Provável)

**Console mostra**:
```
⚠️ Cargas SEM TRANSP (não aparecem): 5
   1. 18/03 - SÃO JOÃO - 10:00 - 12:00
   2. 18/03 - ÁGUA - 10:00 - 12:00
   ...
```

**Ação**: Preencher TRANSP no Mapa de Encomendas

---

### Cenário B: Horário com Espaços Diferentes ⚠️

**Console mostra**:
```
✅ Cargas filtradas com TRANSP: 4
📅 18/03 (Qua): 4 carga(s)
   1. IPP - Horário: "10:00 - 12:00"
   2. SÃO JOÃO - Horário: "10:00-12:00"   ← SEM espaços
   3. ÁGUA - Horário: "10:00  - 12:00"     ← 2 espaços
```

**Ação**: Já corrigido em v2.51.28 (normalização agressiva)

---

### Cenário C: Semana Errada ⚠️

**Console mostra**:
```
✅ Cargas filtradas com TRANSP: 0
   (Nenhuma carga na Semana 12)
```

**Ação**: Verificar campo **SEM** no Mapa de Encomendas

---

## 📋 Ficheiro Alterado

### `app.js` (v2.51.29)

**Alterações**:
1. ✅ Variável `cargasSemTransp` para rastrear cargas sem TRANSP
2. ✅ Log `⚠️ Cargas SEM TRANSP` no console
3. ✅ Lista detalhada de cargas que não aparecem
4. ✅ Mensagem com solução

**Linhas Adicionadas**: ~15 linhas
**Impacto**: Apenas logs (sem mudança de lógica)

---

## ✅ Próximos Passos

1. **Deploy** de `app.js` (v2.51.29)
2. **Abrir Console** (F12) e ir para Mapa Cargas
3. **Verificar** log `⚠️ Cargas SEM TRANSP`
4. **Reportar** resultado:
   - Quantas cargas sem TRANSP?
   - Quais clientes/datas?
   - Preencher TRANSP resolve?

---

## 📦 Deploy Rápido

```bash
# 1. Upload
app.js (v2.51.29)

# 2. Hard Refresh
Ctrl + Shift + R

# 3. Abrir Console
F12 > Console

# 4. Ir para Mapa Cargas
🚚 Mapa Cargas > Procurar log "⚠️ Cargas SEM TRANSP"
```

---

## 🎯 Resultado Esperado

### Se Problema for TRANSP Vazio

**Console mostrará**:
```
⚠️ Cargas SEM TRANSP (não aparecem): 5

⚠️ ATENÇÃO: Cargas sem TRANSP preenchido:
   1. 18/03 - SÃO JOÃO DE VER - 10:00 - 12:00
   2. 18/03 - ÁGUA PASCUAL - 10:00 - 12:00
   3. 18/03 - SETÚBAL - 10:00 - 12:00
   4. 18/03 - MAIA - 10:00 - 12:00
   5. 18/03 - APEX - 10:00 - 12:00

💡 Preencher TRANSP no Mapa de Encomendas!
```

**Ação**: Preencher campo TRANSP e atualizar mapa

---

### Se Problema for Outro

**Console mostrará**:
```
⚠️ Cargas SEM TRANSP (não aparecem): 0

(Todas as cargas têm TRANSP!)
```

**Ação**: Investigar outra causa (normalização, filtro, etc.)

---

**🔍 Debug v2.51.29**: Ferramenta de diagnóstico para identificar por que cargas não aparecem no Mapa de Cargas!

---

*PSY Team — 14/03/2026 21:30*
