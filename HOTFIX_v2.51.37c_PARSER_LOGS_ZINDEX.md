# 🔥 HOTFIX v2.51.37c - Parser Logs + Z-Index

**Data**: 2026-03-25 14:30  
**Versão**: v2.51.37c  
**Tipo**: HOTFIX CRÍTICO

---

## 🐛 **PROBLEMAS CORRIGIDOS**

### **1. ✅ Parser PDF - Logs Detalhados + Múltiplos Formatos**

**Problema**: Parser retornava "0 encomendas detectadas" (console mostrava parse vazio)

**Causa**: PDF.js extrai texto de forma diferente do esperado (espaços, quebras de linha)

**Solução**: 
1. **Logs detalhados** para debug
2. **Múltiplos formatos** de parsing
3. **Detecção flexível** de campos

#### **Logs Adicionados**

```javascript
function parsePdfText(text) {
    console.log('📄 Texto completo (primeiros 1000 chars):', text.substring(0, 1000));
    console.log(`📄 Total de linhas: ${lines.length}`);
    console.log('📄 Primeiras 20 linhas:', lines.slice(0, 20));
    
    // Para cada campo detectado:
    console.log(`👤 Cliente detectado: ${line} → ${currentCliente}`);
    console.log(`📋 Documento detectado: ${currentDoc}`);
    console.log(`📅 Data detectada: ${currentData}`);
    console.log(`✅ Encomenda: ${enc} | ${cliente} | ${data} | ${medida} | ${qtd}`);
}
```

#### **Formatos Suportados**

**Cliente**:
```
Formato 1: C0006 (linha separada)
           CORK SUPPLY PORTUGAL, S.A. (próxima linha)

Formato 2: C0006 - CORK SUPPLY PORTUGAL, S.A. (mesma linha)
```

**Documento**:
```
Formato 1: ECL 2026/167 (linha separada)

Formato 2: ECL 2026/167 UN 24/03/2026 (mesma linha)
```

**Data**:
```
Formato 1: 24/03/2026 (linha separada)

Formato 2: Incluída na linha do documento
```

**Produto**:
```
Formato 1: P080653930140S (código)
           PAL 800X600 DIV (próxima linha)
           50,000 (qtd em linha seguinte)

Formato 2: PAL 800X600 DIV 50,000 UN (tudo na mesma linha)

Formato 3: P080653930140S PAL 800X600 DIV 50,000 UN (código + produto)
```

#### **Estratégia de Parsing**

1. **Acumular contexto**: Guardar cliente, documento e data atual
2. **Detectar produto**: Quando encontrar produto, criar encomenda com contexto acumulado
3. **Busca flexível**: Procurar qtd nas próximas 5 linhas se não estiver na mesma linha

```javascript
let currentCliente = '';
let currentDoc = '';
let currentData = '';

// Detectar produto
if (line.match(/^P\d+/i)) {
    // Próxima linha pode ter o nome
    const nextLine = lines[i + 1];
    if (nextLine.match(/^(PAL|PRANCHA)/i)) {
        const medida = nextLine.trim();
        
        // Procurar qtd nas próximas 5 linhas
        let qtd = 0;
        for (let k = i; k < Math.min(i + 5, lines.length); k++) {
            const qtdMatch = lines[k].match(/(\d{1,5})[,\.](\d{3})/);
            if (qtdMatch) {
                qtd = parseInt(qtdMatch[1]);
                break;
            }
        }
        
        // Criar encomenda com contexto acumulado
        if (currentDoc && currentData && medida) {
            orders.push({
                enc: currentDoc,
                cliente: currentCliente || 'Cliente não identificado',
                data_entrega: currentData,
                medida: medida,
                qtd: qtd
            });
        }
    }
}
```

#### **Debug no Console**

Após upload, verificar console:

```javascript
📄 Iniciando parse do PDF PALSYSTEMS...
📄 Texto completo (primeiros 1000 chars): PALSYSTEMS - PALETES E EMBALAGENS...
📄 Total de linhas: 347
📄 Primeiras 20 linhas: ['PALSYSTEMS - PALETES E EMBALAGENS, LDA', ...]
👤 Cliente detectado: C0006 → CORK SUPPLY PORTUGAL, S.A.
📋 Documento detectado: ECL 2026/167
📅 Data detectada: 24/03/2026
✅ Encomenda: ECL 2026/167 | CORK SUPPLY PORTUGAL, S.A. | 24/03/2026 | PAL 800X600 DIV | 50
✅ Parse completo: 1 encomendas detectadas
```

Se aparecer:
```
⚠️ NENHUMA encomenda detectada! Verifique logs acima.
```

→ Analisar logs para ver onde o parsing falhou

---

### **2. ✅ Z-Index - Blocos Específicos Por Cima**

**Problema**: Blocos grandes (Manhã/Tarde) ficavam **por cima** dos blocos pequenos (horários específicos)

**Expectativa**: Blocos específicos (ex: 10:00-12:00) devem ficar **visíveis** por cima dos blocos grandes

**Solução**: Inverter z-index

#### **Antes (BUG)**
```javascript
// Bloco expandido (Manhã/Tarde)
z-index: 10;  // ❌ Por cima de tudo

// Bloco específico (10:00-12:00)
z-index: (não definido = 0);  // ❌ Por baixo
```

#### **Depois (CORRETO)**
```javascript
// Bloco expandido (Manhã/Tarde)
z-index: 1;  // ✅ Fundo (por baixo)

// Bloco específico (10:00-12:00)
z-index: 10;  // ✅ Frente (por cima)
position: relative;  // ✅ Necessário para z-index funcionar
```

#### **Visual Esperado**

```
┌─────────────┬──────────────────────────┐
│ 08:00-10:00 │ ┌────────────────────┐   │
├─────────────┤ │                    │   │
│ 10:00-12:00 │ │  🟠 MANHÃ (fundo)  │   │ ← Bloco grande no fundo
├─────────────┤ │                    │   │   (z-index: 1)
│ 12:00-14:00 │ │  ┌──────────────┐  │   │
├─────────────┤ └──┤ 10:00-12:00  ├──┘   │ ← Bloco específico visível
│ 14:00-16:00 │    │ Cliente X    │      │   (z-index: 10)
└─────────────┴────┴──────────────┴──────┘
```

#### **Código Implementado**

```javascript
// Bloco expandido (Manhã/Tarde)
if (carga.rowSpan > 1) {
    html += `
        <div style="position: absolute; 
                    ...
                    z-index: 1;  /* Fundo */
                    ...">
    `;
}

// Bloco específico (horário definido)
else {
    html += `
        <div style="...
                    position: relative;  /* Necessário! */
                    z-index: 10;  /* Frente */
                    ...">
    `;
}
```

---

## 📊 **IMPACTO DAS CORREÇÕES**

| Problema | Antes | Depois |
|----------|-------|--------|
| **Parser logs** | 0 encomendas (sem debug) | ✅ Logs detalhados + múltiplos formatos |
| **Z-index** | Blocos específicos invisíveis | ✅ Blocos específicos por cima |

---

## 🚀 **DEPLOY**

### **Ficheiros Modificados**
- `app.js` (2 funções alteradas):
  1. `parsePdfText()` - logs detalhados + múltiplos formatos
  2. `openCargasDetalhe()` - z-index invertido

### **Instruções**
1. Substituir `app.js` no GitHub
2. Commit: `v2.51.37c - HOTFIX Parser Logs + Z-Index`
3. Push → aguardar ~2 min
4. Limpar cache (Ctrl+Shift+R)

---

## ✅ **TESTES PÓS-DEPLOY**

### **1. Parser PDF com Logs**
```bash
1. Abrir tab "Mapa de Encomendas"
2. Abrir console (F12)
3. Clicar "📄 Importar PDF"
4. Upload "Encomendas Pendentes.pdf"
5. Verificar console:
   ✅ "📄 Texto completo (primeiros 1000 chars): ..."
   ✅ "📄 Total de linhas: ..."
   ✅ "👤 Cliente detectado: ..."
   ✅ "📋 Documento detectado: ..."
   ✅ "✅ Parse completo: X encomendas detectadas"
6. Verificar preview:
   ✅ Dados corretos visíveis
```

**Se ainda mostrar 0 encomendas**:
- Copiar logs do console
- Enviar para análise
- Verificar estrutura do PDF extraído

### **2. Z-Index Blocos**
```bash
1. Criar 2 encomendas no mesmo dia:
   a) Encomenda 1: Horário = "Manhã"
   b) Encomenda 2: Horário = "10:00 - 12:00"
2. Ir tab "Cargas Resumo"
3. Clicar card do dia
4. Verificar modal:
   ✅ Bloco laranja "Manhã" atravessa slots 08:00-12:00 (fundo)
   ✅ Bloco específico "10:00-12:00" visível POR CIMA do bloco Manhã
   ✅ Todos os dados do bloco específico legíveis
```

**Visual esperado**:
- Bloco Manhã: fundo com opacity baixa
- Bloco específico: frente com shadow destacado

---

## 🐛 **TROUBLESHOOTING**

### **Parser ainda não funciona**
```javascript
// No console após upload, verificar:
📄 Texto completo (primeiros 1000 chars): ...

// Se texto estiver vazio ou truncado:
→ Problema no PDF.js ou no PDF corrupto

// Se texto aparecer mas 0 encomendas:
→ Analisar logs para ver onde parou o parsing
→ Copiar "Primeiras 20 linhas" e enviar para análise
```

### **Z-index não funciona**
```javascript
// Inspecionar elemento do bloco específico:
// Deve ter:
position: relative;  ✅
z-index: 10;  ✅

// Se não tiver "position: relative":
→ z-index não funciona sem position!
```

### **Blocos ainda se sobrepõem**
```javascript
// Verificar se AMBOS os blocos têm z-index:
// Bloco expandido: z-index: 1
// Bloco específico: z-index: 10

// Se ambos tiverem o mesmo z-index:
→ Ordem natural (último renderizado fica por cima)
```

---

## 📝 **PRÓXIMOS PASSOS**

Se parser continuar a falhar:
1. Copiar todo o log do console
2. Enviar print do preview vazio
3. (Opcional) Copiar texto extraído do PDF manualmente

Se z-index continuar a ter problemas:
1. Inspecionar elementos (F12 → Elements)
2. Verificar computed styles (z-index, position)
3. Enviar screenshot

---

**Versão**: v2.51.37c  
**Status**: ✅ Pronto para deploy  
**Testes**: Logs detalhados implementados
