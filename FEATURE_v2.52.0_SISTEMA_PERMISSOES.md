# 🔐 FEATURE v2.52.0 - Sistema de Permissões por Tab

**Data:** 2026-03-26  
**Tipo:** Nova funcionalidade - Controlo de acesso  
**Prioridade:** 🔴 ALTA

---

## 🎯 OBJETIVO

Criar sistema de permissões granular por utilizador e por tab, permitindo:
- **Admins**: Acesso total (editar tudo)
- **Editores**: Editar tabs específicas
- **Visualizadores**: Apenas ver (sem editar)

---

## 📊 ESTRUTURA PROPOSTA

### **OPÇÃO 1: Coluna JSON na tabela `profiles`** ✅ Recomendado

**Vantagens:**
- ✅ Flexível (fácil adicionar novas tabs)
- ✅ Não precisa criar tabela extra
- ✅ Centralizado num só sítio
- ✅ Suporte nativo JSON no PostgreSQL

**Estrutura da tabela `profiles`:**

```sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    email TEXT NOT NULL UNIQUE,
    nome TEXT,
    role TEXT DEFAULT 'viewer', -- 'admin', 'editor', 'viewer'
    permissions JSONB DEFAULT '{}', -- 🆕 Permissões por tab
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Exemplo de estrutura JSON:**

```json
{
  "planeamento": "edit",      // pode editar secagens
  "visualizacao": "view",     // apenas ver estufas live
  "encomendas": "edit",       // pode editar encomendas
  "cargas": "view",           // apenas ver mapa cargas
  "cargas_resumo": "view"     // apenas ver resumo
}
```

---

### **OPÇÃO 2: Tabela dedicada `user_permissions`** (Alternativa)

**Vantagens:**
- ✅ Normalizado (estrutura relacional)
- ✅ Facilita queries complexas
- ✅ Histórico de alterações

**Desvantagem:**
- ❌ Mais complexo (JOIN em todas as queries)
- ❌ Mais lento (duas tabelas)

```sql
CREATE TABLE user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    tab_name TEXT NOT NULL,
    permission TEXT NOT NULL CHECK (permission IN ('admin', 'edit', 'view', 'none')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, tab_name)
);
```

---

## 🛠️ IMPLEMENTAÇÃO RECOMENDADA: OPÇÃO 1

---

## 📝 PASSO 1: SQL - Atualizar Tabela `profiles`

Execute no **Supabase SQL Editor:**

```sql
-- 1. Adicionar coluna permissions (JSONB)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';

-- 2. Atualizar role para TEXT (se ainda não for)
ALTER TABLE profiles 
ALTER COLUMN role TYPE TEXT;

-- 3. Definir valores padrão para roles existentes
UPDATE profiles 
SET role = 'admin' 
WHERE role IS NULL OR role = '';

-- 4. Definir permissões padrão para admins (acesso total)
UPDATE profiles 
SET permissions = '{
  "planeamento": "edit",
  "visualizacao": "edit",
  "encomendas": "edit",
  "cargas": "edit",
  "cargas_resumo": "view"
}'::jsonb
WHERE role = 'admin' AND permissions = '{}';

-- 5. Definir permissões padrão para viewers (apenas visualização)
UPDATE profiles 
SET permissions = '{
  "planeamento": "view",
  "visualizacao": "view",
  "encomendas": "view",
  "cargas": "view",
  "cargas_resumo": "view"
}'::jsonb
WHERE role = 'viewer' AND permissions = '{}';

-- 6. Criar índice para otimizar queries
CREATE INDEX IF NOT EXISTS idx_profiles_permissions ON profiles USING GIN (permissions);
```

---

## 🔑 NÍVEIS DE PERMISSÃO

| Valor | Descrição | Ações Permitidas |
|-------|-----------|------------------|
| **`admin`** | Administrador total | Ver, criar, editar, apagar, gerir permissões |
| **`edit`** | Editor | Ver, criar, editar (não apaga, não gere permissões) |
| **`view`** | Visualizador | Apenas ver (nenhuma edição) |
| **`none`** | Sem acesso | Tab não aparece/bloqueada |

---

## 🗂️ TABS DO SISTEMA

| Tab ID | Nome | Funcionalidades Principais |
|--------|------|---------------------------|
| `planeamento` | Planeamento estufas | Criar/editar/apagar secagens, matriz carga |
| `visualizacao` | Estufas live | Ver dashboard ao vivo |
| `encomendas` | Mapa Encomendas | Editar grid Excel, importar PDF |
| `cargas` | Mapa Cargas | Ver calendário de cargas |
| `cargas_resumo` | Cargas Resumo | Ver resumo 3 semanas |

---

## 💻 PASSO 2: JavaScript - Carregar Permissões

**No `app.js`, após login:**

```javascript
// Variável global para permissões do utilizador
let userPermissions = {};

async function checkAuthState() {
    const { data: { session } } = await db.auth.getSession();
    
    if (session) {
        currentUser = session.user;
        
        // ✅ Carregar perfil com permissões
        const { data: profile, error } = await db
            .from('profiles')
            .select('id, email, nome, role, permissions')
            .eq('id', currentUser.id)
            .single();
        
        if (!error && profile) {
            // Guardar permissões globalmente
            userPermissions = profile.permissions || {};
            currentUser.role = profile.role;
            currentUser.nome = profile.nome;
            
            console.log('👤 Utilizador:', currentUser.nome);
            console.log('🔑 Role:', currentUser.role);
            console.log('🔐 Permissões:', userPermissions);
            
            // Aplicar permissões na UI
            applyPermissions();
        }
        
        showApp();
    } else {
        showLogin();
    }
}
```

---

## 🎨 PASSO 3: JavaScript - Aplicar Permissões na UI

```javascript
function applyPermissions() {
    console.log('🔐 Aplicando permissões na UI...');
    
    // Obter todas as tabs
    const tabs = {
        'planeamento': document.querySelector('[data-tab="planeamento"]'),
        'visualizacao': document.querySelector('[data-tab="visualizacao"]'),
        'encomendas': document.querySelector('[data-tab="encomendas"]'),
        'cargas': document.querySelector('[data-tab="cargas"]'),
        'cargas_resumo': document.querySelector('[data-tab="cargas_resumo"]')
    };
    
    // Para cada tab, verificar permissão
    Object.keys(tabs).forEach(tabId => {
        const permission = userPermissions[tabId] || 'none';
        const tab = tabs[tabId];
        
        console.log(`   Tab "${tabId}": ${permission}`);
        
        // Se permission = 'none', ocultar tab
        if (permission === 'none' && tab) {
            tab.style.display = 'none';
            console.log(`      ❌ Tab oculta`);
            return;
        }
        
        // Se permission = 'view', desabilitar edição
        if (permission === 'view') {
            disableEditingInTab(tabId);
            console.log(`      👁️ Modo visualização`);
        }
        
        // Se permission = 'edit' ou 'admin', permitir tudo
        if (permission === 'edit' || permission === 'admin') {
            enableEditingInTab(tabId);
            console.log(`      ✏️ Modo edição`);
        }
    });
}
```

---

## 🔒 PASSO 4: JavaScript - Funções de Controlo

```javascript
function disableEditingInTab(tabId) {
    switch(tabId) {
        case 'planeamento':
            // Ocultar botões de criar/editar/apagar secagens
            document.querySelectorAll('.gantt-day-cell').forEach(cell => {
                cell.style.cursor = 'default';
                cell.onclick = null; // Remove click handler
            });
            document.querySelectorAll('.secagem-block').forEach(block => {
                block.style.cursor = 'default';
                block.onclick = null;
            });
            // Ocultar botão "Nova Secagem" (se existir)
            const btnNova = document.querySelector('#btn-nova-secagem');
            if (btnNova) btnNova.style.display = 'none';
            break;
            
        case 'encomendas':
            // Tornar células read-only
            document.querySelectorAll('.excel-grid input').forEach(input => {
                input.setAttribute('readonly', true);
                input.style.backgroundColor = '#f5f5f5';
            });
            document.querySelectorAll('.excel-grid select').forEach(select => {
                select.setAttribute('disabled', true);
                select.style.backgroundColor = '#f5f5f5';
            });
            // Ocultar botões de ação
            const btnAddRow = document.querySelector('#btn-add-row');
            if (btnAddRow) btnAddRow.style.display = 'none';
            const btnImportPdf = document.querySelector('#btn-import-pdf');
            if (btnImportPdf) btnImportPdf.style.display = 'none';
            break;
            
        case 'visualizacao':
            // Dashboard é read-only por natureza (nada a desabilitar)
            break;
            
        case 'cargas':
        case 'cargas_resumo':
            // Mapas de carga são read-only (nada a desabilitar)
            break;
    }
}

function enableEditingInTab(tabId) {
    // Por defeito, tudo está habilitado
    // Esta função pode re-habilitar se necessário após desabilitar
    console.log(`   ✅ Edição habilitada em: ${tabId}`);
}

// Helper: Verificar se utilizador pode editar uma tab específica
function canEdit(tabId) {
    const permission = userPermissions[tabId];
    return permission === 'edit' || permission === 'admin' || currentUser.role === 'admin';
}

// Helper: Verificar se utilizador pode ver uma tab
function canView(tabId) {
    const permission = userPermissions[tabId];
    return permission !== 'none';
}

// Helper: Verificar se é admin
function isAdmin() {
    return currentUser.role === 'admin';
}
```

---

## 🧪 PASSO 5: Exemplos de Uso no Código

### Exemplo 1: Ao clicar numa célula do Gantt

```javascript
cell.addEventListener('click', () => {
    if (!canEdit('planeamento')) {
        showToast('⚠️ Não tem permissão para criar secagens', 'warning');
        return;
    }
    
    console.log('🔘 Clique na célula vazia:', `Estufa ${estufaId}`, formatDate(day));
    openNewSecagemModal(estufaId, day);
});
```

### Exemplo 2: Ao editar encomenda

```javascript
async function saveEncomenda(data) {
    if (!canEdit('encomendas')) {
        showToast('⚠️ Não tem permissão para editar encomendas', 'error');
        return;
    }
    
    // Continuar com save...
}
```

### Exemplo 3: Mostrar badge de permissão

```javascript
function renderUserBadge() {
    const userBadge = document.getElementById('user-badge');
    const permission = userPermissions['planeamento'] || 'view';
    
    if (permission === 'view') {
        userBadge.innerHTML = `
            <span style="color: orange;">👁️ Visualização</span>
        `;
    } else if (permission === 'edit') {
        userBadge.innerHTML = `
            <span style="color: green;">✏️ Editor</span>
        `;
    } else if (permission === 'admin' || currentUser.role === 'admin') {
        userBadge.innerHTML = `
            <span style="color: blue;">🔑 Admin</span>
        `;
    }
}
```

---

## 🎯 CASOS DE USO

### **Caso 1: Utilizador "Operador TV" (Apenas visualização)**

**Permissões:**
```json
{
  "planeamento": "view",
  "visualizacao": "view",
  "encomendas": "none",
  "cargas": "view",
  "cargas_resumo": "view"
}
```

**Resultado:**
- ✅ Vê tab "Planeamento estufas" mas não pode criar/editar secagens
- ✅ Vê "Estufas live"
- ❌ Tab "Mapa Encomendas" não aparece
- ✅ Vê "Mapa Cargas"
- ✅ Vê "Cargas Resumo"

---

### **Caso 2: Utilizador "Gestor" (Edita encomendas e cargas)**

**Permissões:**
```json
{
  "planeamento": "view",
  "visualizacao": "view",
  "encomendas": "edit",
  "cargas": "edit",
  "cargas_resumo": "view"
}
```

**Resultado:**
- ✅ Vê secagens mas não pode editá-las
- ✅ Pode editar encomendas (importar PDF, adicionar linhas)
- ✅ Pode editar mapa de cargas
- ✅ Vê resumo de cargas

---

### **Caso 3: Utilizador "Admin" (Acesso total)**

**Role:** `admin`

**Permissões:** (podem ser vazias, role admin sobrepõe)
```json
{
  "planeamento": "admin",
  "visualizacao": "admin",
  "encomendas": "admin",
  "cargas": "admin",
  "cargas_resumo": "admin"
}
```

**Resultado:**
- ✅ Acesso total a todas as tabs
- ✅ Pode criar/editar/apagar tudo
- ✅ Pode gerir permissões de outros utilizadores (futuro)

---

## 🔧 PASSO 6: Interface de Gestão de Permissões (Opcional)

**Criar tab "Administração" (apenas para admins):**

```html
<!-- Tab Admin (apenas visível para role = 'admin') -->
<div class="tab-content" id="tab-admin" style="display: none;">
    <h2>🔑 Gestão de Utilizadores</h2>
    
    <table class="users-table">
        <thead>
            <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Role</th>
                <th>Planeamento</th>
                <th>Encomendas</th>
                <th>Cargas</th>
                <th>Ações</th>
            </tr>
        </thead>
        <tbody id="users-list">
            <!-- Preenchido via JS -->
        </tbody>
    </table>
</div>
```

**JavaScript para listar utilizadores:**

```javascript
async function loadUsers() {
    if (!isAdmin()) return;
    
    const { data: users, error } = await db
        .from('profiles')
        .select('*')
        .order('nome');
    
    if (error) {
        console.error('Erro ao carregar utilizadores:', error);
        return;
    }
    
    const tbody = document.getElementById('users-list');
    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${user.nome || 'N/A'}</td>
            <td>${user.email}</td>
            <td>
                <select onchange="updateUserRole('${user.id}', this.value)">
                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                    <option value="editor" ${user.role === 'editor' ? 'selected' : ''}>Editor</option>
                    <option value="viewer" ${user.role === 'viewer' ? 'selected' : ''}>Viewer</option>
                </select>
            </td>
            <td>
                <select onchange="updatePermission('${user.id}', 'planeamento', this.value)">
                    <option value="admin">Admin</option>
                    <option value="edit" ${user.permissions?.planeamento === 'edit' ? 'selected' : ''}>Edit</option>
                    <option value="view" ${user.permissions?.planeamento === 'view' ? 'selected' : ''}>View</option>
                    <option value="none">None</option>
                </select>
            </td>
            <td><!-- Similar para outras tabs --></td>
            <td>
                <button onclick="deleteUser('${user.id}')">🗑️ Apagar</button>
            </td>
        </tr>
    `).join('');
}

async function updatePermission(userId, tabId, permission) {
    const { data: user } = await db
        .from('profiles')
        .select('permissions')
        .eq('id', userId)
        .single();
    
    const permissions = user.permissions || {};
    permissions[tabId] = permission;
    
    const { error } = await db
        .from('profiles')
        .update({ permissions })
        .eq('id', userId);
    
    if (error) {
        showToast('Erro ao atualizar permissão', 'error');
    } else {
        showToast('Permissão atualizada!', 'success');
    }
}
```

---

## 📊 TESTES

### Teste 1: Admin vê tudo
1. Login com utilizador admin
2. ✅ Todas as tabs visíveis
3. ✅ Pode criar/editar/apagar em todas

### Teste 2: Viewer não pode editar
1. Login com utilizador viewer
2. ✅ Vê tabs permitidas
3. ❌ Botões de edição ocultos/desabilitados
4. ❌ Click em células não faz nada

### Teste 3: Editor parcial
1. Login com utilizador com permissão "edit" só em "encomendas"
2. ✅ Pode editar encomendas
3. ❌ Não pode editar secagens
4. ✅ Vê outras tabs em modo view

---

## 🚀 DEPLOY

### Passo 1: SQL no Supabase
Execute o SQL de criação/atualização da tabela `profiles`

### Passo 2: Atualizar app.js
- Adicionar funções de permissões
- Modificar event handlers para verificar permissões

### Passo 3: Testar
- Criar utilizadores de teste com diferentes permissões
- Validar comportamento

---

## 📝 PRÓXIMOS PASSOS

1. ✅ Implementar estrutura base (OPÇÃO 1)
2. ⏳ Adicionar verificações em todos os event handlers
3. ⏳ Criar interface de gestão (tab Admin)
4. ⏳ Adicionar logs de auditoria (quem alterou permissões)
5. ⏳ Notificações quando permissões mudarem

---

**Versão:** v2.52.0  
**Status:** 📋 Proposta  
**Aprovação:** Pendente
