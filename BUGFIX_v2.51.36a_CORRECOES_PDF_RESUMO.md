# 🐛 BUGFIX v2.51.36a — Correções PDF Importer e Resumo Cargas

**Data:** 24/03/2026  
**Versão:** v2.51.36a  
**Tipo:** Bugfix  
**Estado:** ✅ COMPLETO

---

## 🎯 PROBLEMAS IDENTIFICADOS

1. ❌ **Botão "📄 Importar PDF" não abre o modal**
   - Causa: Estrutura HTML do modal incorreta (`.modal-overlay` + `.modal-content` em vez de `.modal-dialog`)
   
2. ❌ **Tab "Cargas Resumo" mostra erro: `supabase.from is not a function`**
   - Causa: Funções usavam `supabase` em vez de `db` (nome correto da instância Supabase)

---

## ✅ CORREÇÕES APLICADAS

### 1. **Modal PDF Importer — Estrutura HTML**

**Problema:**
```html
<!-- ❌ ERRADO -->
<div class="modal" id="modal-pdf-importer">
    <div class="modal-overlay"></div>
    <div class="modal-content">...</div>
</div>
```

**Solução:**
```html
<!-- ✅ CORRETO -->
<div class="modal" id="modal-pdf-importer" style="display:none;">
    <div class="modal-dialog" style="max-width: 700px;">
        <div class="modal-sidebar" style="background: #FF9500;"></div>
        <div class="modal-body">
            <button class="modal-close" onclick="closePdfImporter()">×</button>
            <div class="modal-header">
                <h3>📄 Importar Encomendas de PDF</h3>
                <p class="modal-subtitle">Cole o texto do PDF abaixo</p>
            </div>
            <div style="padding: 24px;">
                <!-- Conteúdo -->
            </div>
        </div>
    </div>
</div>
```

**Mudanças:**
- ✅ `.modal-overlay` → `.modal-dialog` (compatível com CSS existente)
- ✅ `.modal-content` → `.modal-body` (padrão da app)
- ✅ Removido header duplicado
- ✅ Adicionado botão `.modal-close` no topo
- ✅ Footer integrado no `.modal-body`

---

### 2. **Funções JavaScript — Substituir `supabase` por `db`**

**Problema:**
```javascript
// ❌ ERRADO
const { data, error } = await supabase
    .from('mapa_encomendas')
    .insert(recordsToInsert);
```

**Solução:**
```javascript
// ✅ CORRETO
const { data, error } = await db
    .from('mapa_encomendas')
    .insert(recordsToInsert);
```

**Locais corrigidos:**
- `importPdfData()` — linha ~4815
- `renderResumoCargas()` — linha ~4846

---

### 3. **Função `openPdfImporter()` — Debug Logs**

Adicionados logs para facilitar troubleshooting:

```javascript
function openPdfImporter() {
    console.log('📄 Abrindo importador PDF...');
    const modal = document.getElementById('modal-pdf-importer');
    
    if (!modal) {
        console.error('❌ Modal PDF não encontrado!');
        return;
    }
    
    console.log('✅ Modal encontrado:', modal);
    
    // ... resto do código
}
```

---

### 4. **Atualização Número de Versão**

```javascript
// De:
console.log('🚀 APP.JS v2.51.33 - ...');

// Para:
console.log('🚀 APP.JS v2.51.36 - Copy/Paste Excel + PDF Importer + Cargas Resumo');
```

---

## 📋 FICHEIROS MODIFICADOS

| Ficheiro      | Alteração                              | Linhas |
|---------------|----------------------------------------|--------|
| `app.js`      | Versão → v2.51.36                      | 1      |
| `app.js`      | `supabase` → `db` (2 locais)           | 2      |
| `app.js`      | Logs debug em `openPdfImporter()`      | 8      |
| `index.html`  | Estrutura modal PDF (`.modal-dialog`)  | ~20    |

---

## ✅ VALIDAÇÃO

### Teste 1: Botão PDF Importer

- [ ] Abrir **Mapa de Encomendas**
- [ ] Clicar em **"📄 Importar PDF"**
- [ ] Verificar que modal abre corretamente
- [ ] Verificar que console mostra: `"📄 Abrindo importador PDF..."`
- [ ] Verificar que textarea está visível e editável

### Teste 2: Preview PDF

- [ ] Colar texto de exemplo no textarea
- [ ] Clicar em **"👁️ Preview"**
- [ ] Verificar que preview mostra tabela com encomendas
- [ ] Verificar contador: `"✅ X encomenda(s) detectada(s)"`

### Teste 3: Importar PDF

- [ ] Clicar em **"✓ Importar"**
- [ ] Confirmar diálogo
- [ ] Verificar que modal fecha
- [ ] Verificar que grid é recarregada
- [ ] Verificar que toast mostra: `"✅ X encomenda(s) importada(s) com sucesso!"`

### Teste 4: Tab Cargas Resumo

- [ ] Abrir tab **"📦 Cargas Resumo"**
- [ ] Verificar que não mostra erro `supabase.from is not a function`
- [ ] Verificar que mostra 3 semanas
- [ ] Verificar que cards mostram contagem de cargas
- [ ] Verificar cores (verde/amarelo/vermelho)

---

## 🔗 REFERÊNCIAS

- **Release original:** `RELEASE_v2.51.36_3_NOVAS_FUNCIONALIDADES.md`
- **Repositório:** https://github.com/MCFPSY/Gestao_estufas
- **Produção:** https://mcfpsy.github.io/Gestao_estufas/

---

## ✍️ AUTOR

**Desenvolvido por:** Assistente AI  
**Solicitado por:** Utilizador MCFPSY  
**Data:** 24/03/2026  
**Versão:** v2.51.36a

---

**🐛 FIM DO BUGFIX**
