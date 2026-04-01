# 🔍 DEBUG v2.51.36c — Logs Detalhados + Diagnóstico

**Data:** 24/03/2026  
**Versão:** v2.51.36c  
**Tipo:** Debug & Logging  
**Estado:** ✅ COMPLETO

---

## 🎯 PROBLEMAS REPORTADOS

### **1. Tab "Cargas Resumo" mostra todos os dias com "Sem cargas"**

**Sintomas:**
- Interface mostra "Semana 13" com 7 cards
- Todos os cards mostram "Sem cargas" (fundo verde)
- Console não mostra erros
- Utilizador confirma que dia 24/03 tem "imensos TRANSP preenchidos"

**Hipóteses:**
1. ❓ Formato de data incompatível (`"01/mar"` vs `"24/03/2026"`)
2. ❓ Campo `transporte` vazio (key errada: `transporte` vs `transp`)
3. ❓ `week.loads[dateKey]` não encontra correspondência
4. ❓ `encomendasData.dates` está vazio

---

### **2. Botão "📄 Importar PDF" não funciona no developer**

**Sintomas:**
- Botão existe, mas não abre o modal
- Testando no ambiente de desenvolvimento local (não GitHub Pages)
- Console pode mostrar erro ou nada

**Hipóteses:**
1. ❓ `app.js` não está carregado corretamente
2. ❓ Função `openPdfImporter()` não está no escopo global
3. ❓ Modal ainda tem z-index baixo

---

## ✅ CORREÇÕES APLICADAS

### 1. **Logs Detalhados na Função `renderResumoCargas()`**

Adicionados **15 console.logs** para diagnóstico completo:

```javascript
async function renderResumoCargas() {
    // ...
    
    // LOG 1: Quantas cargas têm transporte?
    console.log(`✅ ${cargas.length} cargas com transporte preenchido`);
    
    // LOG 2: Mostrar primeiras 3 cargas
    console.log('📊 Primeiras 3 cargas:', cargas.slice(0, 3));
    
    // LOG 3: Semana atual
    console.log(`📅 Semana atual: ${currentWeekNum}, Hoje: ${today.toLocaleDateString('pt-PT')}`);
    
    // LOG 4: Dias gerados
    console.log('📆 Dias gerados para semana 1:', weeks[0].days.map(d => d.date));
    
    // LOG 5-10: Para cada carga processada
    cargas.forEach((carga, idx) => {
        console.log(`🔍 Carga ${idx}: data="${carga.data}", horario="${carga.horario_carga}"`);
        // ...
        console.log(`   → Parsed: ${dia}/${mes}/${ano}, Week: ${cargaWeek}, Key: ${dateKey}`);
        
        if (weekIndex < 0 || weekIndex >= 3) {
            console.log(`   ❌ Fora do range (week ${cargaWeek}, current ${currentWeekNum})`);
            return;
        }
        
        // LOG por tipo de horário
        if (horario.includes('manhã')) {
            console.log(`   ✅ +1 Manhã em ${dateKey}`);
        } else if (horario.includes('tarde')) {
            console.log(`   ✅ +1 Tarde em ${dateKey}`);
        } else {
            console.log(`   ✅ +1 Indefinido em ${dateKey}`);
        }
    });
    
    // LOG 11: Resumo final
    console.log('📦 Loads finais:', weeks.map(w => ({ 
        week: w.num, 
        loads: Object.keys(w.loads).length 
    })));
    
    // LOG 12: Debug específico do dia 24/03
    week.days.forEach(day => {
        const dateKey = day.date;
        if (dateKey === '24/03/2026') {
            console.log(`🔍 DEBUG 24/03: loads=`, loads, 'total=', total, 'week.loads=', week.loads);
        }
    });
}
```

---

### 2. **Conversão de Formato de Data Melhorada**

Adicionada conversão automática de `"01/mar"` → `"01/03/2026"`:

```javascript
// Detectar formato: "01/mar" ou "24/03/2026"
if (carga.data.includes('/')) {
    const parts = carga.data.split('/');
    if (parts.length === 2) {
        // Formato "01/mar"
        dia = parts[0];
        const monthMap = {
            'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04',
            'mai': '05', 'jun': '06', 'jul': '07', 'ago': '08',
            'set': '09', 'out': '10', 'nov': '11', 'dez': '12'
        };
        mes = monthMap[parts[1]] || '01';
        ano = currentYear.toString();
        dateKey = `${dia}/${mes}/${ano}`;
    } else if (parts.length === 3) {
        // Formato "24/03/2026"
        dateKey = carga.data;
    }
}
```

---

### 3. **Debug do Botão PDF (para ambiente local)**

Para testar no ambiente de desenvolvimento:

1. **Abrir Console do navegador** (F12)
2. **Verificar se `app.js` carregou:**
   ```javascript
   typeof openPdfImporter
   // Deve retornar: "function"
   ```

3. **Testar manualmente:**
   ```javascript
   openPdfImporter()
   // Deve abrir o modal
   ```

4. **Verificar erros:**
   ```javascript
   console.log(document.getElementById('modal-pdf-importer'))
   // Deve mostrar o elemento <div class="modal"...>
   ```

---

## 📊 GUIA DE INTERPRETAÇÃO DOS LOGS

### **Cenário 1: Nenhuma carga detectada**

```
✅ 0 cargas com transporte preenchido
📊 Primeiras 3 cargas: []
```

**Causa:** Campo `transporte` está vazio ou usa key diferente.

**Solução:** Verificar no Mapa de Encomendas:
- Campo está preenchido?
- Key é `transporte` ou `transp`?
- Abrir console e executar:
  ```javascript
  console.log(encomendasData.data)
  // Procurar keys que contenham "transp"
  ```

---

### **Cenário 2: Cargas detectadas, mas não aparecem no card**

```
✅ 5 cargas com transporte preenchido
📊 Primeiras 3 cargas: [{data: "01/mar", ...}, ...]
🔍 Carga 0: data="01/mar", horario="Manhã"
   → Parsed: 01/03/2026, Week: 13, Key: 01/03/2026
   ✅ +1 Manhã em 01/03/2026
📦 Loads finais: [{week: 13, loads: 5}, ...]
```

Mas o card mostra "Sem cargas".

**Causa:** `week.loads` tem keys `"01/03/2026"` mas os cards procuram `"24/03/2026"`.

**Solução:** Verificar:
```javascript
// No console, dentro da tab "Cargas Resumo"
console.log(weeks[0].loads)
// Deve mostrar objeto com keys das datas
```

---

### **Cenário 3: Data fora do range de 3 semanas**

```
🔍 Carga 0: data="01/01/2026", horario="Manhã"
   → Parsed: 01/01/2026, Week: 1, Key: 01/01/2026
   ❌ Fora do range (week 1, current 13)
```

**Causa:** Carga está numa semana diferente das 3 exibidas.

**Solução:** Normal — só aparecem cargas das semanas 13, 14 e 15.

---

### **Cenário 4: Debug do dia 24/03**

```
🔍 DEBUG 24/03: loads= {manha: 3, tarde: 2, indefinido: 1} total= 6 week.loads= {...}
```

**Interpretação:**
- **6 cargas** no dia 24/03
- **3 Manhã**, **2 Tarde**, **1 Indefinido**
- **Card deve mostrar fundo amarelo** (4-6 cargas)

Se o card ainda mostra "Sem cargas", o problema está no HTML rendering.

---

## 🚀 PROCEDIMENTO DE TESTE

### **Passo 1: Deploy no GitHub Pages**

1. Fazer upload de `app.js` e `index.html` atualizados
2. Aguardar rebuild (1-2 min)
3. Abrir: https://mcfpsy.github.io/Gestao_estufas/
4. Abrir Console (F12)

### **Passo 2: Testar Tab "Cargas Resumo"**

1. Login na aplicação
2. Abrir tab **"📦 Cargas Resumo"**
3. **Observar os logs no console:**
   - ✅ Quantas cargas detectadas?
   - ✅ Formato das datas?
   - ✅ Semana atual?
   - ✅ Dias gerados?
   - ✅ Loads finais?

### **Passo 3: Testar Botão PDF**

1. Abrir tab **"📋 Mapa Encomendas"**
2. Clicar em **"📄 Importar PDF"**
3. **Observar:**
   - ✅ Modal abre?
   - ✅ Console mostra `"📄 Abrindo importador PDF..."`?
   - ✅ Modal visível (não atrás de outros elementos)?

### **Passo 4: Copiar Logs e Enviar**

Se o problema persistir:

1. **Copiar TODOS os logs do console**
2. **Tirar screenshot da interface**
3. **Enviar para análise**

---

## 📋 CHECKLIST DE VALIDAÇÃO

- [ ] Deploy feito no GitHub Pages
- [ ] Console aberto durante teste
- [ ] Tab "Cargas Resumo" aberta
- [ ] Logs copiados:
  - [ ] `✅ X cargas com transporte preenchido`
  - [ ] `📊 Primeiras 3 cargas: ...`
  - [ ] `📅 Semana atual: ...`
  - [ ] `📆 Dias gerados: ...`
  - [ ] `🔍 Carga 0: ...` (primeiras 3)
  - [ ] `📦 Loads finais: ...`
  - [ ] `🔍 DEBUG 24/03: ...`
- [ ] Botão PDF testado
- [ ] Screenshot tirado

---

## 📊 FICHEIROS MODIFICADOS

| Ficheiro  | Alteração                                    | Linhas |
|-----------|----------------------------------------------|--------|
| `app.js`  | 15+ logs de debug em `renderResumoCargas()`  | ~60    |
| `app.js`  | Conversão de formato data "01/mar" → DD/MM/YYYY | ~25    |
| `app.js`  | Debug específico dia 24/03                   | 3      |

---

## ✍️ AUTOR

**Desenvolvido por:** Assistente AI  
**Solicitado por:** Utilizador MCFPSY  
**Data:** 24/03/2026  
**Versão:** v2.51.36c

---

**🔍 FIM DO DEBUG LOG**
