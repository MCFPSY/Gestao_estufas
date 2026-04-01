# 🧪 TESTE URGENTE v2.51.24 - Logo PSY

**Data**: 14/03/2026 18:30  
**Tempo estimado**: 2 minutos  
**Versão testada**: v2.51.24

---

## 🎯 Objetivo

Validar que o **logo oficial PSY** (estufa/secador) está a aparecer corretamente em **todos os locais**:
- ✅ Ecrã de login
- ✅ Header da aplicação
- ✅ Sem distorções

---

## 🔧 Pré-requisitos

1. **Upload completo**:
   - ✅ `index.html` (v2.51.24)
   - ✅ `app.js` (v2.51.24)
   - ✅ `images/logo.png` (67 KB)

2. **Limpar cache**:
   - Chrome/Edge: `Ctrl + Shift + R`
   - Firefox: `Ctrl + F5`
   - Safari: `Cmd + Option + R`

---

## ✅ Testes Rápidos

### **1. Ecrã de Login** (30 segundos)

**Passos**:
1. Fazer logout (se estiver dentro da aplicação)
2. Recarregar a página (F5)

**Validações** ✅:
- [ ] Logo PSY aparece **centrado** acima do título "PSY"
- [ ] Tamanho: **120×120 pixels** (grande, bem visível)
- [ ] Imagem: **Estufa/secador** com 3 tubos no topo e prateleiras de cortiça
- [ ] **Sem distorções** (proporções corretas)
- [ ] Título "PSY" aparece **abaixo do logo**
- [ ] Subtítulo "Gestão de secagens, encomendas e cargas" visível

**Resultado esperado**:
```
┌─────────────────────┐
│                     │
│    [LOGO 120x120]   │  ← Estufa/secador
│                     │
│        PSY          │  ← Título
│ Gestão de...        │  ← Subtítulo
│                     │
│  [Campo Utilizador] │
│  [Campo Password]   │
│     [Btn Entrar]    │
└─────────────────────┘
```

---

### **2. Header da Aplicação** (30 segundos)

**Passos**:
1. Fazer login (se não estiver)
2. Observar o canto superior esquerdo

**Validações** ✅:
- [ ] Logo PSY aparece no **canto superior esquerdo**
- [ ] Tamanho: **40×40 pixels** (pequeno, compacto)
- [ ] **Fundo transparente** (sem círculo rosa/gradient)
- [ ] Alinhado corretamente com texto "PSY"
- [ ] Subtítulo "Gestão de secagens, encomendas e cargas" visível à direita

**Resultado esperado**:
```
┌────────────────────────────────────────────┐
│ [🏭 40x40]  PSY                    👤 JC → │
│            Gestão de...                     │
├────────────────────────────────────────────┤
│ 📅 Planeamento | 📊 Estufas | ...          │
└────────────────────────────────────────────┘
```

---

### **3. Navegação entre Tabs** (30 segundos)

**Passos**:
1. Clicar em diferentes tabs:
   - 📅 Planeamento estufas
   - 📊 Estufas live
   - 📋 Mapa Encomendas
   - 🚚 Mapa Cargas

**Validações** ✅:
- [ ] Logo PSY **permanece visível** em todas as tabs
- [ ] **Nenhuma aba "Utilizadores"** aparece
- [ ] Apenas 4 tabs disponíveis (confirmado)

---

### **4. Validação Console** (10 segundos)

**Passos**:
1. Abrir DevTools: `F12`
2. Ir para tab "Console"

**Validações** ✅:
- [ ] Mensagem aparece: `🚀 APP.JS v2.51.24 - Logo personalizado PSY + Aba Utilizadores removida`
- [ ] **Sem erros** relacionados com `images/logo.png`
- [ ] **Sem erros 404** (ficheiro não encontrado)

---

### **5. Responsividade Mobile** (20 segundos)

**Passos**:
1. DevTools: `Ctrl + Shift + M` (modo mobile)
2. Testar em diferentes resoluções (iPhone, iPad, etc.)

**Validações** ✅:
- [ ] Logo no header **redimensiona corretamente**
- [ ] Logo no login **mantém proporções**
- [ ] **Sem cortes ou distorções**

---

## 🚨 Problemas Conhecidos (Soluções)

### ❌ **Problema**: Logo não aparece (404)
**Solução**:
1. Verificar se `images/logo.png` foi enviado
2. Limpar cache do browser (`Ctrl + Shift + R`)
3. Verificar permissões do ficheiro no servidor

### ❌ **Problema**: Logo distorcido
**Solução**:
1. Verificar propriedade `object-fit: contain` no CSS
2. Confirmar que a imagem tem fundo transparente

### ❌ **Problema**: Aba "Utilizadores" ainda aparece
**Solução**:
1. Verificar se `index.html` v2.51.24 foi corretamente enviado
2. Limpar cache do browser completamente

---

## ✅ Checklist Final

Marque **todos os itens** antes de considerar o teste como **PASSOU**:

- [ ] ✅ Logo aparece no ecrã de login (120×120px)
- [ ] ✅ Logo aparece no header (40×40px)
- [ ] ✅ Sem distorções em ambos os locais
- [ ] ✅ Fundo transparente no header (sem círculo rosa)
- [ ] ✅ Aba "Utilizadores" NÃO aparece
- [ ] ✅ Console sem erros 404
- [ ] ✅ Responsividade mobile OK

---

## 📊 Resultado do Teste

**Status**: [ ] ✅ PASSOU | [ ] ❌ FALHOU

**Observações**:
```
(Escrever aqui qualquer problema encontrado ou confirmação de sucesso)
```

**Testado por**: _______________  
**Data/Hora**: _______________

---

## 🚀 Próximo Passo (após teste passar)

✅ **Deploy aprovado** → Sistema pronto para produção  
📸 **Tirar screenshots** para documentação  
📝 **Atualizar changelog** se necessário

---

**FIM DO TESTE**
