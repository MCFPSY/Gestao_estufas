# FEATURE v2.51.38 - Novos Campos na Secagem

**Data**: 2026-03-25 15:30  
**Status**: ✅ Implementado  
**Tipo**: Nova funcionalidade  

---

## 📋 Resumo

Adicionados dois novos campos ao formulário de secagem:
1. **Tipo de Secagem** - Combo box com opções: Ultra dry, HT, Dry (padrão)
2. **Quantidade Total** - Campo numérico para registar a quantidade total de paletes

---

## 🎯 Alterações Implementadas

### 1. Interface (index.html)

Adicionado novo `form-row` após o campo "Duração":

```html
<div class="form-row">
    <div class="form-field">
        <label>Tipo de Secagem</label>
        <select id="input-tipo-secagem" required>
            <option value="Dry" selected>Dry</option>
            <option value="HT">HT</option>
            <option value="Ultra dry">Ultra dry</option>
        </select>
    </div>
    
    <div class="form-field">
        <label>Quantidade Total</label>
        <input type="number" id="input-qtd-total" min="0" placeholder="Ex: 150">
    </div>
</div>
```

**Localização**: Entre os campos "Duração/Fim Estimado" e a seção "Carga - Matriz de Paletes"

---

### 2. Base de Dados (app.js)

#### 2.1. Leitura dos campos no submit do formulário

```javascript
const tipoSecagem = document.getElementById('input-tipo-secagem').value;
const qtdTotal = parseInt(document.getElementById('input-qtd-total').value) || null;
```

#### 2.2. Gravação - UPDATE (edição)

```javascript
const { error } = await db.from('secagens').update({
    estufa_id: estufaId,
    start_time: startTime,
    end_time: endDate.toISOString(),
    duration_hours: duration,
    obs: obs,
    tipo_secagem: tipoSecagem,      // 🆕 NOVO
    qtd_total: qtdTotal,             // 🆕 NOVO
    updated_by: currentUser.id
}).eq('id', secagemId);
```

#### 2.3. Gravação - INSERT (nova secagem)

```javascript
const { data: newSec, error } = await db.from('secagens').insert({
    codigo: codigo,
    estufa_id: estufaId,
    start_time: startTime,
    end_time: endDate.toISOString(),
    duration_hours: duration,
    obs: obs,
    tipo_secagem: tipoSecagem,      // 🆕 NOVO
    qtd_total: qtdTotal,             // 🆕 NOVO
    status: 'planeada',
    created_by: currentUser.id,
    updated_by: currentUser.id
}).select().single();
```

---

### 3. Funções de Edição (app.js)

#### 3.1. openNewSecagemModal()

Definir valores padrão ao criar nova secagem:

```javascript
document.getElementById('input-tipo-secagem').value = 'Dry'; // Valor padrão
document.getElementById('input-qtd-total').value = '';
```

#### 3.2. editSecagem()

Preencher campos ao editar secagem existente:

```javascript
document.getElementById('input-tipo-secagem').value = sec.tipo_secagem || 'Dry';
document.getElementById('input-qtd-total').value = sec.qtd_total || '';
```

---

## 🗄️ Estrutura da Tabela `secagens`

### Colunas Necessárias (adicionar no Supabase):

```sql
-- Adicionar coluna tipo_secagem
ALTER TABLE secagens 
ADD COLUMN IF NOT EXISTS tipo_secagem TEXT DEFAULT 'Dry';

-- Adicionar coluna qtd_total
ALTER TABLE secagens 
ADD COLUMN IF NOT EXISTS qtd_total INTEGER;
```

### Esquema completo da tabela:

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|-------------|---------|-----------|
| `id` | UUID | ✅ | auto | ID único |
| `codigo` | TEXT | ✅ | - | Código da secagem (ex: SEC_E1_001) |
| `estufa_id` | INTEGER | ✅ | - | ID da estufa (1-7) |
| `start_time` | TIMESTAMPTZ | ✅ | - | Data/hora de início |
| `end_time` | TIMESTAMPTZ | ✅ | - | Data/hora de fim |
| `duration_hours` | INTEGER | ✅ | - | Duração em horas |
| `obs` | TEXT | ❌ | - | Observações |
| **`tipo_secagem`** | **TEXT** | **✅** | **'Dry'** | **🆕 Tipo de secagem** |
| **`qtd_total`** | **INTEGER** | **❌** | **-** | **🆕 Quantidade total** |
| `status` | TEXT | ✅ | 'planeada' | Status da secagem |
| `created_by` | UUID | ✅ | - | Utilizador criador |
| `updated_by` | UUID | ✅ | - | Utilizador que editou |
| `created_at` | TIMESTAMPTZ | ✅ | now() | Data de criação |
| `updated_at` | TIMESTAMPTZ | ✅ | now() | Data de atualização |

---

## ✅ Validações

1. **Tipo de Secagem**: Campo obrigatório (`required`) com 3 opções fixas
2. **Quantidade Total**: 
   - Campo opcional (pode ficar vazio)
   - Se preenchido, deve ser número ≥ 0
   - Gravado como `NULL` se vazio

---

## 📝 Fluxo de Utilização

### Nova Secagem
1. Utilizador clica em "Nova Secagem"
2. Formulário abre com "Tipo de Secagem" = **Dry** (padrão)
3. Campo "Quantidade Total" vazio
4. Utilizador preenche todos os campos
5. Ao clicar "Guardar":
   - Se "Quantidade Total" estiver vazio → grava `NULL`
   - Se preenchido → grava o valor numérico

### Editar Secagem Existente
1. Utilizador clica numa secagem do Gantt
2. Modal abre com dados carregados da BD:
   - **Tipo de Secagem**: valor gravado ou "Dry" se `NULL`
   - **Quantidade Total**: valor gravado ou vazio se `NULL`
3. Utilizador edita os campos
4. Ao guardar, valores são atualizados na BD

---

## 🧪 Testes Sugeridos

1. ✅ Criar nova secagem com "Dry" e quantidade 100 → verificar gravação
2. ✅ Criar nova secagem com "HT" sem quantidade → verificar NULL
3. ✅ Editar secagem existente e alterar tipo para "Ultra dry" → verificar update
4. ✅ Editar secagem sem quantidade e adicionar 250 → verificar update
5. ✅ Verificar que valor padrão "Dry" aparece ao criar nova secagem
6. ✅ Verificar que dados são carregados corretamente ao editar

---

## 🚀 Deploy

### Passos:
1. **Atualizar BD no Supabase**:
   ```sql
   ALTER TABLE secagens 
   ADD COLUMN IF NOT EXISTS tipo_secagem TEXT DEFAULT 'Dry';
   
   ALTER TABLE secagens 
   ADD COLUMN IF NOT EXISTS qtd_total INTEGER;
   ```

2. **Deploy dos ficheiros**:
   ```bash
   git add index.html app.js FEATURE_v2.51.38_NOVOS_CAMPOS_SECAGEM.md
   git commit -m "v2.51.38 - Adicionar campos Tipo Secagem e Quantidade Total"
   git push origin main
   ```

3. **Aguardar ~2 minutos** para rebuild do GitHub Pages

4. **Limpar cache** do browser: `Ctrl + Shift + R`

---

## 🌡️ Indicador Visual no Gantt (v2.51.38b)

### Ícone de Termômetro para Ultra Dry

Secagens com tipo "Ultra dry" agora exibem um ícone 🌡️ ao lado do código no Gantt:

**Código:**
```javascript
// 🌡️ v2.51.38: Ícone termômetro para Ultra dry
const isUltraDry = sec.tipo_secagem === 'Ultra dry';
const ultraDryIcon = isUltraDry ? '<span style="font-size: 16px; margin-right: 4px;">🌡️</span>' : '';

block.innerHTML = `
    <div class="secagem-id">${ultraDryIcon}${getSecagemCode(sec)}</div>
    ...
`;
```

**Resultado visual:**
- Dry: `SEC_E1_005`
- HT: `SEC_E2_003`
- Ultra dry: `🌡️ SEC_E3_004` ← ícone visível

---

## 📊 Próximos Passos (Opcional)

- ✅ **IMPLEMENTADO:** Exibir ícone 🌡️ para "Ultra dry" no Gantt
- Exibir "Quantidade Total" no Gantt (tooltip ou badge)
- Adicionar filtros por tipo de secagem
- Calcular totais automáticos baseados na matriz de paletes
- Adicionar validação: "Quantidade Total" ≠ soma da matriz (alerta)

---

**Implementado por**: AI Assistant  
**Testado**: Pendente  
**Versão**: v2.51.38
