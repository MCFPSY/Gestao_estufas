# 📘 Guia: Criar Utilizador "Anabela" no Supabase Auth

**Sistema**: Supabase Authentication (oficial)  
**Username desejado**: `Anabela`  
**Password**: `1234`

---

## 🎯 Como o Sistema Funciona

O código atual faz:
```javascript
const username = 'Anabela';  // Input do utilizador
const email = username.toLowerCase() + '@secagens.local';  // Converte para: anabela@secagens.local
await db.auth.signInWithPassword({ email, password });
```

**Portanto**: O username é convertido em email fictício: `anabela@secagens.local`

---

## 📋 Passo a Passo (2 minutos)

### **1. Abrir Supabase Dashboard**
- Ir para: https://supabase.com/dashboard
- Selecionar seu projeto: **SecagemsPro** (ou o nome do seu projeto)

### **2. Ir para Authentication**
- Menu lateral → **Authentication**
- Submenu → **Users**

### **3. Adicionar Novo Utilizador**
- Clicar no botão **Add user** → **Create new user**

### **4. Preencher o Formulário**

**Opção A: Email + Password manual**
```
Email:           anabela@secagens.local
Password:        1234
Auto Confirm:    ✅ (marcar)
```

**OU**

**Opção B: Enviar email de confirmação**
```
Email:           anabela@secagens.local
Send email:      ✅ (marcar)
```
(Mas como o email é fictício, use Opção A)

### **5. Clicar em "Create user"**

### **6. IMPORTANTE: Confirmar o Utilizador**

Se não marcou "Auto Confirm", precisa confirmar manualmente:

1. Na lista de utilizadores, clicar no utilizador `anabela@secagens.local`
2. Encontrar o campo **Email Confirmed**
3. Mudar para `true` ou clicar em "Confirm email"

---

## 🧪 Testar o Login

1. **Abrir a aplicação**
2. **Fazer logout** (se estiver logado)
3. **Fazer login com**:
   - Username: `Anabela` (o sistema converte para `anabela@secagens.local`)
   - Password: `1234`
4. **Verificar**: Deve fazer login com sucesso

---

## 📸 Screenshots do Processo

### **Passo 1: Authentication → Users**
```
Supabase Dashboard
├─ Authentication    ← Clicar aqui
│  ├─ Users          ← Depois aqui
│  ├─ Policies
│  └─ ...
```

### **Passo 2: Add User**
```
┌─────────────────────────────────────────┐
│ Users                    [+ Add user]   │ ← Clicar aqui
├─────────────────────────────────────────┤
│ usuario1@secagens.local                 │
│ usuario2@secagens.local                 │
└─────────────────────────────────────────┘
```

### **Passo 3: Formulário**
```
┌─────────────────────────────────────────┐
│ Create new user                         │
├─────────────────────────────────────────┤
│ Email *                                 │
│ [anabela@secagens.local              ]  │
│                                         │
│ Password *                              │
│ [1234                                ]  │
│                                         │
│ ✅ Auto Confirm User                    │
│                                         │
│              [Create user]              │
└─────────────────────────────────────────┘
```

---

## ⚠️ Problemas Comuns

### **Erro: "Password should be at least 6 characters"**

**Causa**: Supabase Auth exige senha mínima de 6 caracteres por padrão.

**Soluções**:

#### **Opção 1: Usar senha mais longa** (Recomendado)
```
Password: 123456  (ou Anabela1234)
```

#### **Opção 2: Alterar configuração do Supabase**
1. Dashboard → **Authentication** → **Policies**
2. Encontrar **Password requirements**
3. Alterar **Minimum password length** de `6` para `4`

---

### **Erro: "Email not confirmed"**

**Causa**: Utilizador não foi confirmado.

**Solução**:
1. **Authentication** → **Users**
2. Clicar no utilizador `anabela@secagens.local`
3. Na seção **User details**, encontrar **Email Confirmed**
4. Alterar para `true` ou clicar no botão de confirmação

---

### **Erro: "Invalid login credentials"**

**Causas possíveis**:
1. Email não confirmado (ver solução acima)
2. Password incorreta
3. Utilizador não existe

**Verificar**:
```
Authentication → Users → Procurar por "anabela@secagens.local"
```

---

## 🔐 Recomendação de Senha

Como o Supabase exige mínimo 6 caracteres, recomendo:

| Username | Email Fictício | Senha Sugerida |
|----------|---------------|----------------|
| `Anabela` | `anabela@secagens.local` | `123456` ou `Anabela1234` |

---

## 📊 Alternativa: Criar via SQL

Se preferir usar SQL (mais avançado):

```sql
-- NOTA: Isto NÃO funciona diretamente porque auth.users 
-- não aceita INSERT direto por segurança
-- Use a interface do Dashboard
```

**Motivo**: O Supabase Auth não permite criar utilizadores via SQL direto por questões de segurança (precisa de hashing de senha, etc.).

---

## 🆘 Alternativa: API REST

Se tiver acesso programático (para criar múltiplos utilizadores):

```javascript
// No console do navegador (F12)
const { data, error } = await db.auth.admin.createUser({
  email: 'anabela@secagens.local',
  password: '123456',
  email_confirm: true
});

console.log('Utilizador criado:', data, error);
```

**Nota**: Requer permissões de admin.

---

## 📋 Checklist Completo

- [ ] Abrir Supabase Dashboard
- [ ] Ir para Authentication → Users
- [ ] Clicar "Add user" → "Create new user"
- [ ] Email: `anabela@secagens.local`
- [ ] Password: `123456` (ou senha de pelo menos 6 caracteres)
- [ ] Marcar "Auto Confirm User" ✅
- [ ] Clicar "Create user"
- [ ] Verificar que utilizador aparece na lista
- [ ] Testar login na aplicação:
  - Username: `Anabela`
  - Password: `123456`
- [ ] Confirmar que login funciona

---

## 🎯 Resumo Ultra-Rápido

1. **Dashboard** → **Authentication** → **Users**
2. **Add user** → **Create new user**
3. Email: `anabela@secagens.local`
4. Password: `123456` (mínimo 6 caracteres)
5. ✅ **Auto Confirm User**
6. **Create user**
7. Testar login com username `Anabela`

---

## 💡 Utilizadores Atuais (Provavelmente)

Se já existem utilizadores, devem seguir o padrão:

| Username | Email Fictício | Como Login |
|----------|---------------|------------|
| `teste` | `teste@secagens.local` | Username: `teste` |
| `admin` | `admin@secagens.local` | Username: `admin` |

**Novo utilizador**:
| Username | Email Fictício | Como Login |
|----------|---------------|------------|
| `Anabela` | `anabela@secagens.local` | Username: `Anabela` |

---

## 🔍 Verificar Utilizadores Existentes

**Dashboard** → **Authentication** → **Users**

Vai ver lista de emails tipo:
```
teste@secagens.local
admin@secagens.local
...
```

---

## ✅ Confirmação Final

Após criar, teste:

**Login Screen**:
```
Username: Anabela
Password: 123456
         [Entrar]
```

**Resultado esperado**: Login com sucesso, nome aparece no canto superior direito.

---

**📘 GUIA COMPLETO - SUPABASE AUTHENTICATION**

**Sistema**: Supabase Auth (email/password)  
**Conversão**: Username → Email fictício (@secagens.local)  
**Senha mínima**: 6 caracteres (requisito do Supabase)

**Username**: `Anabela`  
**Email criado**: `anabela@secagens.local`  
**Password sugerida**: `123456` ou `Anabela1234`
