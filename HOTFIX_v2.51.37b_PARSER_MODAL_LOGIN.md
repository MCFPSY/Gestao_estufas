# 🔥 HOTFIX v2.51.37b - Parser PDF, Modal Expandido e Login Debug

**Data**: 2026-03-25 14:10  
**Versão**: v2.51.37b  
**Tipo**: HOTFIX CRÍTICO

---

## 🐛 **PROBLEMAS CORRIGIDOS**

### **1. ✅ Parser PDF - Reescrito para Formato PALSYSTEMS**

**Problema**: Preview mostrava dados incorretos (estrutura do PDF não estava sendo parseada corretamente)

**Análise do PDF**:
```
PALSYSTEMS - PALETES E EMBALAGENS, LDA
Análise de Encomendas de Clientes (01/01/2026 até 31/12/2026)

Entidade:
C0006
CORK SUPPLY PORTUGAL, S.A.

Documento | UN | Dt.Entrega | Qtd. Enc. | ...
ECL 2026/167 | UN | 24/03/2026 | C0006 | 50,000 | ...

Produto:
P080653930140S
PAL 800X600 DIV
50,000 | UN | 0,000 | 50,000 | 0,000
```

**Solução**: Parser reescrito para reconhecer estrutura específica

```javascript
function parsePdfText(text) {
    // 🔥 v2.51.37b: Parser reescrito para formato PALSYSTEMS
    
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    const orders = [];
    let currentCliente = '';
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // 1. Detectar cliente: "C0006"
        if (line.match(/^C\d{4,5}$/)) {
            // Próxima linha tem o nome
            if (i + 1 < lines.length) {
                currentCliente = lines[i + 1].trim();
            }
            continue;
        }
        
        // 2. Linha com documento: "ECL 2026/167 UN 24/03/2026"
        const docMatch = line.match(/^(ECL\s+\d{4}\/\d+)\s+(UN)\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
        if (docMatch) {
            const enc = docMatch[1].replace(/\s+/g, ' ');
            const data = docMatch[3];
            
            // Próxima linha(s) tem produto e qtd
            let j = i + 1;
            while (j < lines.length) {
                const nextLine = lines[j];
                
                // Linha de produto: "P080653930140S PAL 800X600 DIV 50,000 UN"
                const prodMatch = nextLine.match(/^(P\d+[A-Z]*)\s+(.+?)\s+(\d{1,5}[,\.]\d{3})\s+UN/i);
                if (prodMatch) {
                    const medida = prodMatch[2].trim();
                    const qtdStr = prodMatch[3].replace(',', '.');
                    const qtd = Math.floor(parseFloat(qtdStr));
                    
                    orders.push({
                        enc,
                        cliente: currentCliente,
                        data_entrega: data,
                        medida,
                        qtd
                    });
                    
                    j++;
                    continue;
                }
                break;
            }
            
            i = j - 1;
            continue;
        }
    }
    
    return orders;
}
```

**Teste esperado**:
- Upload "Encomendas Pendentes.pdf"
- Preview deve mostrar:
  ```
  ENC: ECL 2026/167
  Cliente: CORK SUPPLY PORTUGAL, S.A.
  Data: 24/03/2026
  Medida: PAL 800X600 DIV
  Qtd: 50
  ```

---

### **2. ✅ Modal Grid - Blocos Expandidos (Manhã/Tarde)**

**Problema**: Cargas "Manhã" e "Tarde" não atravessavam visualmente os slots (apareciam apenas num slot)

**Expectativa**: 
- Manhã → bloco visual de 08:00 até 12:00 (4 slots)
- Tarde → bloco visual de 12:00 até 18:00 (6 slots)

**Solução**: Usar `position: absolute` com altura calculada

```javascript
// Blocos expandidos (Manhã/Tarde)
if (carga.rowSpan > 1) {
    // Altura = (rowSpan * altura_célula) + gaps
    const altura = (carga.rowSpan * 98) - 10;
    
    html += `
        <div style="position: absolute; 
                    top: 8px; 
                    left: 8px; 
                    right: 8px; 
                    height: ${altura}px; 
                    background: linear-gradient(135deg, #F5F5F7 0%, #FAFAFA 100%); 
                    border: 2px solid ${badgeColor}; 
                    border-radius: 10px; 
                    padding: 12px; 
                    z-index: 10; 
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            <!-- Conteúdo da carga -->
        </div>
    `;
}
```

**Visual esperado**:
```
┌─────────────┬──────────────────────┐
│ 06:00-08:00 │                      │
├─────────────┼──────────────────────┤
│ 08:00-10:00 │ ┌──────────────────┐ │
├─────────────┤ │                  │ │
│ 10:00-12:00 │ │  🟠 MANHÃ        │ │
├─────────────┤ │  Cliente X       │ │
│ 12:00-14:00 │ │  Transporte Y    │ │
├─────────────┤ └──────────────────┘ │
│ 14:00-16:00 │                      │
└─────────────┴──────────────────────┘
```

**Cálculo de altura**:
- Manhã (3 slots): `(3 * 98) - 10 = 284px`
- Tarde (4 slots): `(4 * 98) - 10 = 382px`

---

### **3. ✅ Login - Logs Detalhados de Erro**

**Problema**: Após logout, não conseguia voltar a entrar (sem mensagem de erro clara)

**Solução**: Logs mais detalhados no catch do login

```javascript
} catch (error) {
    console.error('❌ Erro no login:', error);
    console.error('   Mensagem:', error.message);
    console.error('   Code:', error.code);
    
    let errorMessage = '❌ Credenciais inválidas';
    if (error.message && error.message.includes('Invalid login credentials')) {
        errorMessage = '❌ Utilizador ou password incorretos';
    } else if (error.message && error.message.includes('Email not confirmed')) {
        errorMessage = '❌ Email não confirmado';
    }
    
    errorDiv.textContent = errorMessage;
    errorDiv.classList.remove('d-none');
}
```

**Logs esperados no console**:
```javascript
❌ Erro no login: {message: "Invalid login credentials", code: ...}
   Mensagem: Invalid login credentials
   Code: 400
```

**Causas possíveis**:
1. ✅ **Utilizador ou password incorretos** → Verificar credenciais
2. ✅ **Email não confirmado** → Verificar email no Supabase
3. ✅ **Sessão expirada** → Fazer logout completo e login novamente

**Debug checklist**:
```javascript
// No console do browser após erro:
1. Verificar mensagem de erro exata
2. Confirmar credenciais corretas
3. Verificar no Supabase Auth → Users → status do user
4. Verificar se existe na tabela profiles
```

---

## 📊 **IMPACTO DAS CORREÇÕES**

| Problema | Antes | Depois |
|----------|-------|--------|
| **Parser PDF** | Dados incorretos no preview | ✅ ECL 2026/167, CORK SUPPLY, etc. |
| **Modal Grid** | Manhã/Tarde num slot só | ✅ Bloco visual atravessando slots |
| **Login erro** | "Credenciais inválidas" genérico | ✅ Mensagem específica + logs |

---

## 🚀 **DEPLOY**

### **Ficheiros Modificados**
- `app.js` (3 funções alteradas):
  1. `parsePdfText()` - reescrito para formato PALSYSTEMS
  2. `openCargasDetalhe()` - blocos expandidos com position absolute
  3. Login catch - logs detalhados

### **Instruções**
1. Substituir `app.js` no GitHub
2. Commit: `v2.51.37b - HOTFIX Parser + Modal Grid + Login Debug`
3. Push → aguardar ~2 min
4. Limpar cache (Ctrl+Shift+R)

---

## ✅ **TESTES PÓS-DEPLOY**

### **1. Parser PDF**
```bash
1. Abrir tab "Mapa de Encomendas"
2. Clicar "📄 Importar PDF"
3. Upload "Encomendas Pendentes.pdf"
4. Verificar preview:
   ✅ ENC: ECL 2026/167
   ✅ Cliente: CORK SUPPLY PORTUGAL, S.A.
   ✅ Data: 24/03/2026
   ✅ Medida: PAL 800X600 DIV
   ✅ Qtd: 50
```

### **2. Modal Grid**
```bash
1. Criar encomenda com:
   - Cliente: "CORK SUPPLY"
   - Data: 24/03/2026
   - Transp: "Transporte X"
   - Horário: "Manhã"
2. Ir tab "Cargas Resumo"
3. Clicar card "24/03"
4. Verificar:
   ✅ Bloco laranja atravessa slots 08:00-12:00
   ✅ Border 2px laranja
   ✅ Shadow visível
   ✅ Dados completos visíveis
```

### **3. Login Debug**
```bash
1. Fazer logout
2. Tentar login com password errada
3. Verificar console:
   ✅ "❌ Erro no login: ..."
   ✅ "Mensagem: Invalid login credentials"
   ✅ Mensagem específica na tela
4. Login com credenciais corretas
5. Verificar:
   ✅ Login sucesso
   ✅ App carrega normalmente
```

---

## 🐛 **TROUBLESHOOTING**

### **Parser ainda não funciona**
```javascript
// No console após upload:
window.parsedOrders
// Deve retornar array com objetos:
// [{enc: "ECL 2026/167", cliente: "CORK...", ...}]
```

### **Bloco não atravessa slots**
```javascript
// Inspecionar elemento do bloco:
// Deve ter: position: absolute; height: 284px (ou 382px)
```

### **Login continua a falhar**
```javascript
// Verificar no Supabase:
1. Auth → Users → verificar se user existe
2. Table Editor → profiles → verificar se id existe
3. SQL Editor → SELECT * FROM auth.users WHERE email = 'user@secagens.local';
```

---

**Versão**: v2.51.37b  
**Status**: ✅ Pronto para deploy  
**Testes**: Pendente verificação em produção
