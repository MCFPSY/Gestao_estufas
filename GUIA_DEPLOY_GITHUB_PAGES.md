# 🚀 Guia: Deploy no GitHub Pages

**Projeto**: SecagemsPro  
**Versão**: 2.22.6  
**Tipo**: Static Website (HTML + CSS + JavaScript)

---

## 📋 Pré-requisitos

✅ Conta no GitHub (gratuita)  
✅ Todos os arquivos do projeto já criados  
✅ Supabase configurado e funcionando

---

## 🎯 Opção 1: Deploy via Interface Web (Mais Fácil)

### **Passo 1: Criar Repositório no GitHub**

1. **Ir para**: https://github.com
2. **Fazer login** com sua conta
3. **Clicar** no botão **"+"** (canto superior direito) → **"New repository"**
4. **Preencher**:
   ```
   Repository name: secagens-pro
   Description: Sistema de Gestão de Estufas de Secagem
   Visibility: ✅ Public (ou Private, se preferir)
   ```
5. **NÃO marcar** "Add a README file" (já temos README.md)
6. **Clicar** em **"Create repository"**

---

### **Passo 2: Preparar os Arquivos para Upload**

**Arquivos principais a incluir**:
```
secagens-pro/
├── index.html          ✅ (obrigatório - página principal)
├── app.js              ✅ (obrigatório - lógica)
├── README.md           ✅ (recomendado - documentação)
├── .gitignore          ⚠️ (criar se não existir)
└── (outros .md)        📄 (opcional - guias)
```

**Criar arquivo `.gitignore`** (se não existir):
```
# Node modules (se usar npm no futuro)
node_modules/

# Environment variables (NÃO commitar chaves secretas)
.env
.env.local

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Logs
*.log
```

---

### **Passo 3: Upload dos Arquivos**

#### **Método A: Drag & Drop (Mais Fácil)**

1. **Na página do repositório** (GitHub), clicar em **"uploading an existing file"**
2. **Arrastar todos os arquivos** para a área de upload:
   - `index.html`
   - `app.js`
   - `README.md`
   - Outros arquivos `.md` (guias)
3. **Scroll para baixo** → Escrever commit message:
   ```
   Initial commit - SecagemsPro v2.22.6
   ```
4. **Clicar** em **"Commit changes"**

#### **Método B: Upload Individual**

1. Clicar em **"Add file"** → **"Upload files"**
2. Selecionar arquivos
3. Commit

---

### **Passo 4: Ativar GitHub Pages**

1. **No repositório**, clicar na aba **"Settings"** (⚙️)
2. **Menu lateral** → **"Pages"** (ou buscar "Pages")
3. **Source** (Branch):
   ```
   Branch: main (ou master)
   Folder: / (root)
   ```
4. **Clicar** em **"Save"**
5. **Aguardar ~2 minutos** (GitHub processa)
6. **Recarregar a página** → Deve aparecer:
   ```
   ✅ Your site is live at https://seu-usuario.github.io/secagens-pro/
   ```

---

## 🎯 Opção 2: Deploy via Git CLI (Avançado)

### **Passo 1: Instalar Git**

- **Windows**: https://git-scm.com/download/win
- **Mac**: `brew install git`
- **Linux**: `sudo apt install git`

---

### **Passo 2: Configurar Git (primeira vez)**

```bash
git config --global user.name "Seu Nome"
git config --global user.email "seu-email@example.com"
```

---

### **Passo 3: Inicializar Repositório Local**

```bash
# Abrir terminal/cmd na pasta do projeto
cd /caminho/para/seu/projeto

# Inicializar repositório
git init

# Adicionar todos os arquivos
git add .

# Primeiro commit
git commit -m "Initial commit - SecagemsPro v2.22.6"
```

---

### **Passo 4: Conectar ao GitHub**

```bash
# Adicionar repositório remoto (trocar SEU-USUARIO)
git remote add origin https://github.com/SEU-USUARIO/secagens-pro.git

# Verificar
git remote -v
```

---

### **Passo 5: Push (Enviar para GitHub)**

```bash
# Renomear branch para 'main' (se necessário)
git branch -M main

# Enviar código
git push -u origin main
```

**Se pedir autenticação**:
- Username: seu username do GitHub
- Password: usar **Personal Access Token** (não senha normal)

**Gerar Token**:
1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token → Marcar `repo` → Generate
3. Copiar token (só aparece uma vez!)

---

### **Passo 6: Ativar GitHub Pages**

(Mesmo processo da Opção 1, Passo 4)

---

## 🔧 Estrutura Final no GitHub

```
https://github.com/SEU-USUARIO/secagens-pro
│
├── index.html
├── app.js
├── README.md
├── .gitignore
├── GUIA_CRIAR_UTILIZADOR_SUPABASE_AUTH.md
├── GUIA_DEPLOY_GITHUB_PAGES.md
└── (outros .md)
```

---

## 🌐 URL Final

Após ativar GitHub Pages:

```
https://SEU-USUARIO.github.io/secagens-pro/
```

**Exemplo**:
- Se seu username é `joaosilva`
- URL será: `https://joaosilva.github.io/secagens-pro/`

---

## ⚠️ IMPORTANTE: Configuração do Supabase

**Antes de fazer deploy**, verificar se o Supabase está configurado corretamente:

### **1. Verificar URL e Anon Key no `app.js`**

```javascript
// No início do app.js
const SUPABASE_URL = 'https://seu-projeto.supabase.co';
const SUPABASE_ANON_KEY = 'sua-chave-anon-publica';
```

✅ **Estas chaves PODEM ser públicas** (são keys "anon" = anonymous)  
❌ **NÃO commitar** service_role key (se tiver)

---

### **2. Configurar CORS no Supabase**

1. **Supabase Dashboard** → Seu projeto
2. **Settings** → **API**
3. **Site URL**: Adicionar a URL do GitHub Pages
   ```
   https://SEU-USUARIO.github.io
   ```
4. **Additional Redirect URLs**: Mesma URL
   ```
   https://SEU-USUARIO.github.io/secagens-pro/*
   ```

---

### **3. Configurar Authentication Redirect**

Se estiver usando Supabase Auth:

1. **Authentication** → **URL Configuration**
2. **Site URL**: 
   ```
   https://SEU-USUARIO.github.io/secagens-pro
   ```
3. **Redirect URLs** (adicionar):
   ```
   https://SEU-USUARIO.github.io/secagens-pro/*
   ```

---

## 🧪 Testar Deploy

1. **Abrir**: `https://SEU-USUARIO.github.io/secagens-pro/`
2. **Verificar**:
   - [ ] Página carrega corretamente
   - [ ] CSS está funcionando
   - [ ] JavaScript está carregando
3. **F12 (Console)** → Verificar erros
4. **Testar login**:
   - Username: `Anabela`
   - Password: `123456`
5. **Verificar**:
   - [ ] Login funciona
   - [ ] Dados do Supabase carregam
   - [ ] Realtime funciona

---

## 🔍 Troubleshooting

### **Erro: "Failed to load resource: net::ERR_BLOCKED_BY_CLIENT"**
**Causa**: Algum ad-blocker está bloqueando

**Solução**: Desativar ad-blocker ou permitir o site

---

### **Erro: "Failed to fetch" no console**
**Causa**: CORS não configurado no Supabase

**Solução**:
1. Supabase Dashboard → Settings → API
2. Adicionar `https://SEU-USUARIO.github.io` em **Site URL**

---

### **Erro: "404 - File not found"**
**Causa**: Arquivo `index.html` não está na raiz

**Solução**: 
- Verificar se `index.html` está na raiz do repositório
- GitHub Pages → Settings → Verificar se Branch/Folder está correto

---

### **Página carrega mas CSS não funciona**
**Causa**: Caminhos relativos errados

**Solução**: 
- Se CSS está em `<link href="style.css">`, arquivo deve estar na raiz
- Se CSS está inline no HTML, não há problema

---

### **JavaScript não carrega**
**Causa**: Erro de sintaxe ou caminho errado

**Solução**:
1. F12 → Console → Ver erro
2. Verificar se `<script src="app.js">` aponta para arquivo correto

---

## 📊 Atualizações Futuras

### **Opção 1: Via Interface (Upload)**
1. GitHub → Repositório
2. Clicar no arquivo a editar (ex: `app.js`)
3. Clicar no ícone de **lápis** (Edit)
4. Fazer alterações
5. Scroll para baixo → Commit changes

### **Opção 2: Via Git CLI**
```bash
# Fazer alterações nos arquivos locais

# Adicionar alterações
git add .

# Commit
git commit -m "Atualização v2.22.7 - Nova funcionalidade X"

# Push
git push origin main
```

**GitHub Pages atualiza automaticamente** em ~2 minutos após push.

---

## ✅ Checklist Final

Antes de compartilhar o link:

- [ ] Repositório criado no GitHub
- [ ] Todos os arquivos enviados
- [ ] GitHub Pages ativado (Settings → Pages)
- [ ] URL funciona: `https://SEU-USUARIO.github.io/secagens-pro/`
- [ ] Supabase CORS configurado
- [ ] Login funciona
- [ ] Dados carregam do Supabase
- [ ] README.md está atualizado com a URL

---

## 🎯 Resumo Ultra-Rápido

1. **GitHub** → New repository → `secagens-pro`
2. **Upload files**: `index.html`, `app.js`, `README.md`
3. **Settings** → **Pages** → Branch: `main`, Folder: `/` → Save
4. **Supabase** → Settings → API → Site URL: `https://SEU-USUARIO.github.io`
5. **Testar**: Abrir URL e verificar login

---

## 📝 Alternativas ao GitHub Pages

Se preferir outras opções:

| Serviço | Gratuito? | Deploy | Velocidade |
|---------|-----------|--------|------------|
| **GitHub Pages** | ✅ Sim | Automático | Rápido |
| **Netlify** | ✅ Sim | Drag & Drop | Muito rápido |
| **Vercel** | ✅ Sim | Git integration | Muito rápido |
| **Cloudflare Pages** | ✅ Sim | Git integration | Super rápido |

**Recomendação**: GitHub Pages para começar (mais simples).

---

## 🆘 Precisa de Ajuda?

Se tiver algum problema:

1. **Verificar console** (F12) → Procurar erros vermelhos
2. **Verificar GitHub Actions** (aba Actions no repositório)
3. **Testar localmente** antes de fazer deploy:
   - Abrir `index.html` no navegador
   - Verificar se funciona

---

**🚀 GUIA COMPLETO - DEPLOY NO GITHUB PAGES**

**URL Final**: `https://SEU-USUARIO.github.io/secagens-pro/`

**Tempo Estimado**: 10-15 minutos (primeira vez)

**Método Recomendado**: Interface Web (Opção 1) - Mais fácil para iniciantes! ✅
