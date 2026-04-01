# 🐛 BUGFIX v2.51.36b — Modal Visível + Resumo com Dados Locais

**Data:** 24/03/2026  
**Versão:** v2.51.36b  
**Tipo:** Bugfix Critical  
**Estado:** ✅ COMPLETO

---

## 🎯 PROBLEMAS IDENTIFICADOS

### **1. Botão "📄 Importar PDF" não mostra o modal**

**Sintomas:**
- Console mostra: `"✅ Modal encontrado: <div class='modal active'...>"`
- Modal abre (`display: flex; class='active'`), mas não aparece na tela

**Causa Raiz:**
- Modal tinha `z-index: 1000`
- Toast tem `z-index: 9999`
- Modal ficava **atrás** de outros elementos

**Solução:**
```css
/* De: */
.modal { z-index: 1000; }

/* Para: */
.modal { z-index: 10000; }
```

---

### **2. Tab "Cargas Resumo" mostra erro de BD**

**Sintomas:**
```
❌ Erro ao carregar dados: column mapa_encomendas.transporte does not exist
```

**Causa Raiz:**
- Função `renderResumoCargas()` fazia query SQL:
  ```javascript
  await db.from('mapa_encomendas')
      .select('*')
      .not('transporte', 'is', null)  // ❌ Coluna não existe!
      .neq('transporte', '');
  ```
- A tabela `mapa_encomendas` tem duas estruturas possíveis:
  - **Estrutura 1 (original):** `row_data JSONB` — dados em JSON
  - **Estrutura 2 (atual):** Colunas individuais (`cliente`, `medida`, `qtd`, etc.)
- Mas a coluna `transporte` **não foi adicionada** à BD (só `horario_carga` foi)

**Solução:**
- ✅ **Usar dados já carregados** (`encomendasData`) em vez de fazer nova query
- ✅ Filtrar localmente por `transporte` preenchido
- ✅ Evita dependência de estrutura SQL

**Código Anterior:**
```javascript
// ❌ ERRO: Query SQL com coluna inexistente
const { data: cargas, error } = await db
    .from('mapa_encomendas')
    .select('*')
    .not('transporte', 'is', null)
    .neq('transporte', '');
```

**Código Corrigido:**
```javascript
// ✅ Usar dados locais já carregados
const cargas = [];
for (let i = 0; i < encomendasData.dates.length; i++) {
    const data = encomendasData.dates[i];
    if (!data) continue;
    
    const transporteKey = `${i}_transporte`;
    const transporte = encomendasData.data[transporteKey];
    
    // Só incluir se tiver transporte preenchido
    if (transporte && transporte.trim() !== '') {
        const horarioKey = `${i}_horario_carga`;
        cargas.push({
            data: data,
            horario_carga: encomendasData.data[horarioKey] || ''
        });
    }
}
```

**Vantagens:**
- ✅ Funciona independentemente da estrutura SQL
- ✅ Mais rápido (sem query adicional)
- ✅ Usa dados já em memória
- ✅ Consistente com o resto da app

---

## ✅ CORREÇÕES APLICADAS

### 1. **CSS Modal — Z-Index**

**Ficheiro:** `index.html` (linha ~1028)

```css
.modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 10000;  /* ← Alterado de 1000 para 10000 */
    backdrop-filter: blur(4px);
}
```

---

### 2. **Função `renderResumoCargas()` — Dados Locais**

**Ficheiro:** `app.js` (linha ~4850)

**Mudanças:**
- ❌ Removida query SQL `await db.from('mapa_encomendas').select('*')...`
- ✅ Adicionado loop pelos dados locais `encomendasData`
- ✅ Filtro por `transporte` preenchido
- ✅ Criação de array `cargas` com estrutura: `{ data, horario_carga }`

```javascript
async function renderResumoCargas() {
    const container = document.getElementById('resumo-cargas-container');
    if (!container) return;
    
    container.innerHTML = '<p style="text-align: center; padding: 40px; color: #666;">⏳ Carregando dados...</p>';
    
    try {
        // Usar dados já carregados do encomendasData
        console.log('📦 Renderizando resumo com dados locais...');
        
        // Filtrar apenas linhas que tenham TRANSPORTE preenchido
        const cargas = [];
        for (let i = 0; i < encomendasData.dates.length; i++) {
            const data = encomendasData.dates[i];
            if (!data) continue;
            
            const transporteKey = `${i}_transporte`;
            const transporte = encomendasData.data[transporteKey];
            
            // Só incluir se tiver transporte preenchido
            if (transporte && transporte.trim() !== '') {
                const horarioKey = `${i}_horario_carga`;
                cargas.push({
                    data: data,
                    horario_carga: encomendasData.data[horarioKey] || ''
                });
            }
        }
        
        console.log(`✅ ${cargas.length} cargas com transporte preenchido`);
        
        // ... resto do código (sem alterações)
```

---

## 📋 FICHEIROS MODIFICADOS

| Ficheiro      | Alteração                                  | Linhas |
|---------------|--------------------------------------------|--------|
| `index.html`  | Z-index modal: 1000 → 10000                | 1      |
| `app.js`      | `renderResumoCargas()` — dados locais      | ~25    |

---

## ✅ VALIDAÇÃO

### Teste 1: Modal PDF Importer

- [ ] Abrir **Mapa de Encomendas**
- [ ] Clicar em **"📄 Importar PDF"**
- [ ] ✅ **VERIFICAR**: Modal aparece **visível** (fundo escurecido + modal branco)
- [ ] ✅ **VERIFICAR**: Textarea está editável
- [ ] ✅ **VERIFICAR**: Botões "Cancelar", "Preview" e "Importar" estão visíveis

### Teste 2: Tab Cargas Resumo

- [ ] Abrir tab **"📦 Cargas Resumo"**
- [ ] ✅ **VERIFICAR**: **NÃO** aparece erro `"column transporte does not exist"`
- [ ] ✅ **VERIFICAR**: Console mostra `"📦 Renderizando resumo com dados locais..."`
- [ ] ✅ **VERIFICAR**: Console mostra `"✅ X cargas com transporte preenchido"`
- [ ] ✅ **VERIFICAR**: Grid mostra 3 semanas
- [ ] ✅ **VERIFICAR**: Cards diários com contagem de cargas

### Teste 3: Contagem de Cargas

- [ ] No **Mapa de Encomendas**, preencher campo **TRANSPORTE** em algumas linhas
- [ ] Preencher campo **HORÁRIO** (Manhã/Tarde)
- [ ] Abrir tab **"📦 Cargas Resumo"**
- [ ] ✅ **VERIFICAR**: Só aparecem as datas que têm transporte preenchido
- [ ] ✅ **VERIFICAR**: Contagem de Manhã/Tarde está correta

---

## 📊 RESUMO DAS VERSÕES

| Versão     | Data       | Mudança                                        |
|------------|------------|------------------------------------------------|
| v2.51.36   | 24/03/2026 | 3 novas funcionalidades (Copy/Paste, PDF, Resumo) |
| v2.51.36a  | 24/03/2026 | Estrutura modal PDF + `supabase` → `db`        |
| v2.51.36b  | 24/03/2026 | **Z-index modal + Resumo com dados locais**   |

---

## 🔗 REFERÊNCIAS

- **Release original:** `RELEASE_v2.51.36_3_NOVAS_FUNCIONALIDADES.md`
- **Bugfix anterior:** `BUGFIX_v2.51.36a_CORRECOES_PDF_RESUMO.md`
- **Repositório:** https://github.com/MCFPSY/Gestao_estufas
- **Produção:** https://mcfpsy.github.io/Gestao_estufas/

---

## ✍️ AUTOR

**Desenvolvido por:** Assistente AI  
**Solicitado por:** Utilizador MCFPSY  
**Data:** 24/03/2026  
**Versão:** v2.51.36b

---

**🐛 FIM DO BUGFIX**
