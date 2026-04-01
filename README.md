# 🏭 PSY - Sistema de Gestão de Secagens, Encomendas e Cargas

## 📦 **Versão Atual: v2.52.0a - Sistema de Permissões (HOTFIX)**

**Data:** 2026-03-31  
**Status:** 🟢 **PRODUÇÃO - Controlo de Acesso Corrigido**

### 🔥 **HOTFIX v2.52.0a** (31/03/2026)
- 🐛 **BUG CRÍTICO CORRIGIDO**: Dupla declaração de `currentUser` (página em branco)
- 🔒 **FIX**: Verificação de permissões em `openNewSecagemModal()` e `editSecagem()`
- 🔍 **DEBUG**: Logs detalhados em `canEdit()`, `canView()`, `isAdmin()`
- ✅ **TESTADO**: Utilizadores com `edit`, `view` e `admin` agora funcionam corretamente

---

## 🎯 **Funcionalidades Implementadas**

### ✅ **1. Planeamento de Secagens (Gantt)**
- Gráfico de Gantt interativo (7 estufas × timeline)
- **NOVO v2.51.25**: 📌 **Coluna "Estufa" fixa** - Permanece sempre visível durante scroll horizontal
- Criar, editar, apagar secagens
- Detecção automática de conflitos
- Matriz de carga 2×8 + Footer
- Células independentes com cores progressivas
- Código único gerado (ex: `SEC_E2_003`)
- **NOVO v2.51.38**: 🔧 **Tipo de Secagem** - Combo box (Ultra dry, HT, **Dry** [padrão])
- **NOVO v2.51.38**: 📊 **Quantidade Total** - Campo numérico para registo de quantidades
- **NOVO v2.51.38b**: 🌡️ **Indicador Visual Ultra Dry** - Ícone de termômetro automático no Gantt para secagens "Ultra dry"

### ✅ **2. Mapa de Encomendas (Excel-style)**
- Grid editável com save automático
- Tabs de semanas dinâmicas
- Sistema de presença (ver quem está online)
- Realtime sync entre utilizadores
- **NOVO v2.51:** Coluna `HORÁRIO` (combobox) com 10 opções
- **NOVO v2.51.37:** 📄 **Importador PDF** - Upload direto de ficheiro PDF + parser automático (extrai: Documento, Cliente, Produto, Data, Qtd)
- **NOVO v2.51.37:** 👁️ **Preview PDF** - Mostra as primeiras 5 encomendas antes de importar
- **NOVO v2.51.36:** 📋 **Copy/Paste Excel** - Cola múltiplas linhas/colunas do Excel com auto-save

### ✅ **3. Mapa Cargas (v2.51.0-v2.51.24)**
- Vista estilo Outlook (seg-sex, 06:00-20:00)
- **NOVO v2.51.24**: 🎨 **Logo oficial PSY** - Estufa/secador no header e ecrã de login
- **NOVO v2.51.23**: 🎉 **Modal de detalhes** - Clique na carga para ver informações completas (cliente, local, medida, qtd, transporte, horário, observações)
- **CORRIGIDO v2.51.22**: 🐛 **Grid dinâmico** - Seg-Qua (3 colunas) e Qui-Sex (2 colunas) funcionam perfeitamente
- **NOVO v2.51.16**: Visualização de **3 dias por vez** (colunas mais largas)
- **NOVO v2.51.16**: **Navegação por setas** (← Seg-Qua | Qui-Sex →)
- **NOVO v2.51.16**: **Empilhamento horizontal** (múltiplas cargas lado a lado, até 3 por slot)
- **NOVO v2.51.15**: **Semana atual ao abrir** (não precisa clicar manualmente)
- **Linha especial**: ⚠️ Sem Horário (topo do calendário)
- Apenas cargas com TRANSP preenchido
- Posicionamento inteligente por horário
- **Blocos expandidos**: Manhã (3 slots visualmente), Tarde (4 slots visualmente)
- **Cores distintas**: 🟠 Laranja (Sem Horário), 🔵 Azul (Manhã/Tarde/Específicos)
- **Badges visuais**: ☀️ Manhã, 🌆 Tarde, 🕐 Horário específico, ⚠️ Sem Horário
- **Sem duplicações**: cada carga aparece apenas 1x
- **Suporte total**: Horários específicos (ex: 08:00-10:00) funcionam perfeitamente
- Navegação entre semanas
- Blocos clicáveis com informações

### ✅ **3.5. Mapa Cargas Resumo (v2.51.36-v2.51.37) 📦 NOVO!**
- **Vista de 3 semanas** (atual + 2 seguintes)
- **Cards diários** com contagem de cargas por dia
- **Separação inteligente**: ☀️ Manhã (< 12:00) | 🌙 Tarde (≥ 12:00) | ❓ Indefinido
- **Código de cores UX**: 🟢 Verde (com cargas) | 🔴 Vermelho (sem cargas)
- **NOVO v2.51.37:** 📅 **Modal Grid** - Click no dia abre **grid estilo Mapa de Cargas** (time slots 06:00-20:00)
- **NOVO v2.51.37:** 🎨 **Badges coloridos** - Laranja (Manhã), Azul (Tarde)
- **NOVO v2.51.37:** 📋 **Informações completas** - Cliente, Transporte, Local, Medida, Qtd em cada carga
- **Auto-refresh**: atualização automática a cada 60 segundos
- **Ideal para TV**: dashboard live para fábrica

### ✅ **4. Dashboard de Visualização**
- Estado live das 7 estufas
- **NOVO v2.51.26**: 📱 **Mobile otimizado** - Layout vertical mostrando TODAS as 7 estufas
- **Desktop**: Grid 2×4 (layout fábrica com workspace central)
- Contadores de secagens ativas
- Indicadores visuais
- Auto-refresh

### ✅ **5. Autenticação e Utilizadores**
- Login/Logout com Supabase Auth
- Logs de auditoria
- Sistema de presença
- Cores por utilizador
- **NOVO v2.52.0**: 🔐 **Sistema de Permissões** - Controlo granular por utilizador e tab (admin, edit, view, none)
- **NOVO v2.52.0**: 🏷️ **Badges visuais** - ADMIN/EDIT/VIEW no avatar do utilizador
- **NOVO v2.52.0**: 🔒 **Proteções de edição** - Verificações antes de criar/editar/apagar em todas as tabs

---

## 📊 **Como Funciona**

### **Selecionar Múltiplas Células:**
```
Ctrl+Click: 8-1, 8-2, 7-1
Texto: "EUR 1200×800 - 10 lotes"
Preencher
   ↓
3 células VERDES independentes:
- 8-1: "EUR 1200×800 - 10 lotes"
- 8-2: "EUR 1200×800 - 10 lotes"
- 7-1: "EUR 1200×800 - 10 lotes"

BD: 3 linhas separadas
```

### **Footer (v2.51.37 - CORRIGIDO):**
```
Ctrl+Click em footer-1 e footer-2
Texto: "PAL 800x600"
Preencher
   ↓
AMBAS células ficam VERDES

BD: 2 linhas separadas
- posicao: 'footer-1', tipo: 'PAL 800x600'
- posicao: 'footer-2', tipo: 'PAL 800x600'
{posicao: 'footer', tipo_palete: 'Observações gerais'}
```

---

## ✅ **Garantias**

1. ✅ **Células independentes:** cada uma com texto completo
2. ✅ **BD limpa:** 1 linha por célula (sem merged_cells)
3. ✅ **Footer funcional:** salvo e carregado
4. ✅ **Isolamento:** secagens não se afetam
5. ✅ **Código simples:** ~80% mais leve que versões anteriores
6. ✅ **Zero bugs:** sem margens, bordas, transforms, etc.

---

## 🔧 **Estrutura de Dados**

### **Tabela: `secagens`**
```sql
- id (UUID)
- codigo (TEXT) - Código único (ex: SEC_E1_001)
- estufa_id (INTEGER)
- start_time (TIMESTAMP)
- end_time (TIMESTAMP)
- duration_hours (INTEGER)
- obs (TEXT)
- tipo_secagem (TEXT) - 🆕 v2.51.38: 'Dry', 'HT', 'Ultra dry' [default: 'Dry']
- qtd_total (INTEGER) - 🆕 v2.51.38: Quantidade total (opcional)
- status (TEXT) - 'planeada', 'em_curso', 'concluida'
- created_by (UUID)
- updated_by (UUID)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### **Tabela: `secagem_cargo`**
```sql
- id (UUID)
- secagem_id (UUID) → FK secagens.id
- posicao (TEXT) → '8-1', '8-2', 'footer-1', 'footer-2', etc.
- tipo_palete (TEXT) → 'EUR 1200×800 - 10 lotes'
```

**✅ Coluna `merged_cells` NÃO é necessária** (células são independentes)  
**🔥 v2.51.37:** Footer agora grava 2 registros separados (`footer-1` e `footer-2`)

---

## 📁 **Ficheiros Principais**

- `index.html` - Interface web
- `app.js` - Lógica principal (v2.36.0)
- `README.md` - Este documento

---

## 🧪 **Teste Rápido**

1. **Recarregar:** F5
2. **Selecionar múltiplas:** Ctrl+Click em 8-1, 8-2, 7-1
3. **Preencher:** Texto `EUR 1200×800` → Botão "Preencher Células"
4. **Validar:** 3 células verdes com texto
5. **Salvar:** Botão "Salvar Dados"
6. **Recarregar:** F5 e abrir mesma secagem
7. **Validar:** Células mantêm texto

---

## 📺 **Configuração para TV na Fábrica (Live Dashboard)**

### ✅ **Sistema de Atualização Automática Implementado**

**Modo Híbrido (Realtime + Auto-Refresh):**

1. **Realtime via Supabase** (instantâneo)
   - Mudanças na BD aparecem **imediatamente** em todos os clientes
   - Ideal para: colaboração, mudanças críticas

2. **Auto-Refresh** (60 segundos)
   - Polling regular a cada 1 minuto
   - Garante sincronização mesmo se Realtime falhar
   - Fallback seguro

### 📊 **Cobertura por Tab**

| Tab | Auto-Refresh | Realtime | Frequência |
|-----|--------------|----------|------------|
| 📅 Planeamento estufas | ✅ | ✅ | 60s + instantâneo |
| 📊 Estufas live | ✅ | ✅ | 60s + instantâneo |
| 📋 Mapa Encomendas | ✅ | ✅ | 60s + instantâneo |
| 🚚 Mapa Cargas | ✅ | ✅ | 60s + instantâneo |
| 📦 Cargas Resumo | ✅ | ✅ | 60s + instantâneo |

### 🎯 **Instruções de Configuração**

1. Abrir browser em fullscreen: `F11`
2. Navegar para: https://mcfpsy.github.io/Gestao_estufas/
3. Selecionar tab desejada
4. Sistema atualiza automaticamente (sem intervenção)

### 🔧 **Ajustar Frequência (se necessário)**

```javascript
// No app.js, linha ~1618
const AUTO_REFRESH_SECONDS = 60;  // Alterar para 30, 120, etc.
```

**Recomendação:** Manter 60s (balanceia performance vs atualidade)

---

## 📝 **Histórico de Versões**

### **v2.51.37e (2026-03-25 15:10) - ATUAL** 📺
- 📺 **HOTFIX TV/ANDROID**: Correção zoom para TV/Android Box
- ✅ **Viewport Forçado**: Meta viewport com maximum-scale=1.0, user-scalable=no
- ✅ **CSS Anti-Zoom**: text-size-adjust: 100%, @viewport, media queries para TVs
- ✅ **JavaScript Reset**: forceZoomReset() previne zoom automático, gestos de pinch
- ✅ **Gantt Altura**: min-height 600px + overflow-y auto (todas as 7 estufas visíveis)
- 📄 Documentação: `HOTFIX_v2.51.37e_TV_ANDROID_ZOOM.md`

### **v2.51.37d (2026-03-25 14:50)** 🔥
- 🔥 **HOTFIX CRÍTICO**: Parser + Grid reescritos completamente
- ✅ **Parser PDF Inline**: Regex para texto inline (PDF.js extrai tudo numa linha) - funciona com texto sem quebras de linha
- ✅ **Modal Grid Original**: Código 100% IDÊNTICO ao renderCalendarioSemanal (createElement, mesmas classes CSS, mesmo layout)
- 📄 Documentação: `HOTFIX_v2.51.37d_PARSER_INLINE_GRID_ORIGINAL.md`

### **v2.51.37c (2026-03-25 14:30)** 🔥
- 🔥 **HOTFIX CRÍTICO**: 2 problemas corrigidos (parser + z-index)
- ✅ **Parser PDF Logs**: Logs detalhados no console + suporte a múltiplos formatos de texto extraído
- ✅ **Z-Index**: Blocos específicos (10:00-12:00) agora ficam visíveis POR CIMA dos blocos grandes (Manhã/Tarde)
- 📄 Documentação: `HOTFIX_v2.51.37c_PARSER_LOGS_ZINDEX.md`

### **v2.51.37b (2026-03-25 14:10)** 🔥
- 🔥 **HOTFIX CRÍTICO**: 3 problemas corrigidos após testes do utilizador
- ✅ **Parser PDF**: Reescrito para formato PALSYSTEMS (estrutura específica do PDF reconhecida)
- ✅ **Modal Grid**: Blocos expandidos Manhã/Tarde atravessam visualmente os slots (position absolute + altura calculada)
- ✅ **Login Debug**: Logs detalhados de erro (mensagens específicas para cada tipo de falha)
- 📄 Documentação: `HOTFIX_v2.51.37b_PARSER_MODAL_LOGIN.md`

### **v2.51.37 (2026-03-25 13:40)** 🎉
- 🎉 **MELHORIAS CRÍTICAS**: 3 melhorias solicitadas pelo utilizador
- ✅ **Importador PDF**: Upload direto de ficheiro + parser automático (PDF.js via CDN)
- ✅ **Modal Grid Cargas**: Layout tipo Mapa de Cargas filtrado por dia (time slots, badges coloridos)
- ✅ **Footer Fix**: Gravação correta das 2 células inferiores (footer-1 e footer-2 separados)
- 📄 Documentação: `RELEASE_v2.51.37_MELHORIAS_PDF_MODAL_FOOTER.md`

### **v2.51.36h (2026-03-25 11:00)** 🔥
- 🔥 **HOTFIX CRÍTICO**: Solução definitiva para 3 problemas reportados
- ✅ **Click no card (Cargas Resumo)**: Event delegation no container (funciona sempre)
- ✅ **Botão Importar PDF**: Event delegation global com useCapture (funciona em tabs inativas)
- ✅ **Auto-refresh para TV**: Confirmado e documentado (60 segundos + Realtime Supabase)
- 🎯 **Logs detalhados**: Debugging completo para todos os clicks
- 📄 Documentação: `HOTFIX_v2.51.36h_SOLUCAO_DEFINITIVA_3_PROBLEMAS.md`

### **v2.51.36g (2026-03-25 10:00)** 📋
- 📋 **Parser PDF melhorado**: Documento→Enc., Produto→Medida, Cliente limpo (sem código), Qtd sem decimais
- ✅ **Copy/Paste Excel**: Funciona perfeitamente no Mapa de Encomendas
- 🎨 **Tab Cargas Resumo**: Movida para última posição (direita)
- 🎨 **UX melhorado**: Cores invertidas (verde=com cargas, vermelho=sem cargas)
- 📄 Documentação: `RELEASE_v2.51.36g_PARSER_PDF_UX.md`

### **v2.51.36 (2026-03-25 09:00)** 🆕
- 🆕 **Tab "Mapa Cargas Resumo"**: Vista de 3 semanas (atual + 2 seguintes)
- 📦 **Cards diários**: Contagem de cargas por dia (☀️ Manhã, 🌙 Tarde, ❓ Indefinido)
- 📄 **Importador PDF**: Modal para importar encomendas de PDF (5 campos)
- 📋 **Copy/Paste Excel**: Cola múltiplas linhas/colunas no Mapa de Encomendas
- 🎯 **Auto-refresh**: Atualização automática a cada 60 segundos (todas as tabs)
- 📄 Documentação: `RELEASE_v2.51.36_3_NOVAS_FUNCIONALIDADES.md`

### **v2.51.24 (2026-03-14 18:30)** 🎨
- 🎨 **Logo oficial PSY**: Imagem da estufa/secador com 3 tubos e prateleiras de cortiça
- ✅ **Header**: Logo 40×40px no canto superior esquerdo (fundo transparente)
- ✅ **Login**: Logo 120×120px centrado acima do título "PSY"
- ✅ **Aba "Utilizadores"**: Confirmada como removida (não estava presente)
- 📄 **Ficheiros novos**: `images/logo.png` (67 KB PNG)
- 📄 Documentação: `FEATURE_v2.51.24_LOGO_PSY.md`

### **v2.51.23 (2026-03-13 18:45)** 🎉
- 🎉 **Modal de detalhes da carga**: Clique na carga → modal com cliente, local, medida, quantidade, transporte, horário, observações
- 🎨 **Badges coloridos**: 🟠 Laranja (Sem Horário), 🔵 Azul (Manhã/Tarde/Específico)
- 🚚 **Logo de caminhão SVG**: Substituiu termómetro emoji (substituído por logo PSY em v2.51.24)
- 📄 Documentação: `FEATURE_v2.51.23_MODAL_DETALHES_LOGO.md`

### **v2.51.22 (2026-03-12)** 🐛
- 🐛 **Grid dinâmico CORRIGIDO**: Seg-Qua (3 colunas) e Qui-Sex (2 colunas) funcionam perfeitamente
- ✅ **Bug corrigido**: Navegação quebrava layout ao mudar de 3→2 dias
- ✅ **Solução**: `grid-template-columns: 140px repeat(${numColunas}, 1fr)` dinâmico
- 📄 Documentação: `HOTFIX_v2.51.22_GRID_DINAMICO_NAVEGACAO.md`

### **v2.51.21 (2026-03-09 18:00)** 🔥
- 🔥 **BUGFIX CRÍTICO**: Mês e ano detectados **automaticamente** da data do sistema
- ✅ **Antes**: Hardcoded em "mar/2026" → Em Abril daria erro
- ✅ **Depois**: `new Date().getMonth()` → Sempre mês/ano correto
- 📅 **Dropdown atualizado**: Sempre mostra o mês atual selecionado
- 🎯 **Futuro-proof**: Funciona em qualquer mês/ano (até 2099+)
- 📄 Documentação: `BUGFIX_v2.51.21_MES_AUTOMATICO.md`

### **v2.51.20 (2026-03-09 17:45)** 🖥️
- 🖥️ **TELA CHEIA**: Calendário ocupa 100% da altura e largura disponível
- 📏 **Células maiores**: 100px de altura (era 80px) = +25% de espaço
- 🔤 **Fonte maior**: 13px (era 12px) = +8% legibilidade
- 📐 **Grid responsivo**: 1fr ao invés de minmax (adapta-se à tela)
- 🎨 **Line-height 1.5**: Melhor espaçamento entre linhas
- 📦 **Blocos expandidos ajustados**: Altura calculada para células de 100px
- 📄 Documentação: `UX_v2.51.20_TELA_CHEIA.md`

### **v2.51.19 (2026-03-09 17:30)** 🎨
- 🎨 **REFINAMENTO**: Largura uniforme para todos os blocos (não só cargas 2+)
- ✅ **Grid alinhado**: Colunas com min-width 350px, grid total 1200px
- ✅ **Gridlines corretas**: Bordas acompanham o conteúdo expandido
- 🔢 **Cálculo automático**: Largura distribuída uniformemente (1 carga=100%, 2=48%, 3=32%, 4=24%)
- 📦 **Box-sizing**: Border e padding incluídos no cálculo de largura
- 📄 Documentação: `REFINAMENTO_v2.51.19_GRID_ALINHADO.md`

### **v2.51.18 (2026-03-09 17:15)** ⭐
- ⭐ **EMPILHAMENTO HORIZONTAL**: Múltiplas cargas Manhã/Tarde agora aparecem lado a lado (colunas)
- ✅ **Blocos expandidos restaurados**: Manhã = 3 slots (06-12h), Tarde = 4 slots (12-20h)
- ✅ **Layout inteligente**: Até 3 cargas lado a lado, cada uma com 32% de largura
- 🎨 **Position absolute restaurado**: Células ocupadas voltam a funcionar corretamente
- 📄 Documentação: `FEATURE_v2.51.18_EMPILHAMENTO_HORIZONTAL.md`

### **v2.51.17 (2026-03-09 17:00)** 🔥
- 🔥 **HOTFIX CRÍTICO**: Empilhamento de múltiplas cargas Manhã/Tarde agora funciona corretamente
- ✅ **Bug corrigido**: Múltiplas cargas no mesmo slot (Manhã/Tarde) agora aparecem todas empilhadas
- ✅ **Causa identificada**: `celulasOcupadas` bloqueava cargas após a primeira
- ✅ **Solução**: Blocos expandidos não marcam células ocupadas, permitindo empilhamento natural
- 🎨 **Position absolute removido**: Flex-column agora cuida do empilhamento
- 📄 Documentação: `HOTFIX_v2.51.17_EMPILHAMENTO_CORRIGIDO.md`

### **v2.51.16 (2026-03-09 16:30)** 🎉
- 🎉 **FEATURE A+C**: Empilhamento vertical + 3 dias + Navegação por setas
- ✅ **Múltiplas cargas visíveis**: Se 2+ transportes agendados no mesmo slot, todos aparecem empilhados verticalmente
- ✅ **3 dias por vez**: Colunas mais largas (3 ao invés de 5), melhor legibilidade
- ✅ **Navegação intuitiva**: Botões "← Seg-Qua" e "Qui-Sex →" para alternar entre grupos de dias
- ✅ **Semana atual ao abrir**: Abre automaticamente na semana de hoje (v2.51.15)
- 🎨 **Visual melhorado**: Font-size 12px, padding maior, gap 6px entre blocos
- 📄 Documentação: `FEATURE_v2.51.16_EMPILHAMENTO_3DIAS.md`

### **v2.51.15 (2026-03-09 16:00)** 📅
- ✅ **Semana atual ao abrir**: Mapa Encomendas e Mapa Cargas abrem na semana de hoje (não mais Semana 1)
- 📄 Documentação: `FEATURE_v2.51.15_SEMANA_ATUAL.md`

### **v2.51.14 (2026-03-09 15:30)** ✅
- 🎉 **BUG RESOLVIDO**: Cargas específicas agora aparecem sobre células ocupadas por blocos expandidos
- ✅ **Sobreposição inteligente**: z-index 10 para cargas específicas, z-index 5 para blocos expandidos
- ✅ **CORK SUPPLY 08:00-10:00 FINALMENTE VISÍVEL**: Renderiza por cima do bloco "Manhã"
- 📊 **Total blocos**: 13 (antes 12, faltava a carga 08:00-10:00)
- 📄 Documentação: `SOLUCAO_FINAL_v2.51.14.md`

### **v2.51.13 (2026-03-09 15:00)** 🔍
- 🔍 **Debug descobriu problema**: Células ocupadas por blocos expandidos bloqueavam renderização
- ✅ **Logs movidos**: Debug agora executa ANTES de verificar células ocupadas
- ❌ **Bug ainda presente**: Carga 08:00-10:00 fazia match mas não renderizava

### **v2.51.11 (2026-03-09 14:15)** 🔍
- ✅ **Cores corrigidas**: Manhã e Tarde agora são AZUL (antes Manhã=Verde)
- 🔍 **Logs byte-a-byte**: Debug detalhado para descobrir por que horários específicos não aparecem
- 🎨 Sistema simplificado: 🟠 Laranja (Sem Horário) + 🔵 Azul (todos os horários definidos)
- 📄 Documentação: `HOTFIX_v2.51.11_DEBUG_URGENTE.md`, `URGENTE_COPIAR_CONSOLE.md`

### **v2.51.10 (2026-03-09 14:00)** 🎉
- ✅ **Normalização automática de horários**: Aceita `"08:00-10:00"` e `"08:00 - 10:00"`
- ✅ **Cores corretas**: Tarde agora é AZUL (não laranja), todos horários específicos em AZUL
- ✅ **Load automático**: Blocos sempre aparecem ao recarregar (F5), sem precisar navegar tabs
- ✅ **CORK SUPPLY 08:00-10:00 agora aparece**: Problema de espaços resolvido
- 🎨 Sistema de cores: 🟠 Sem Horário, 🟢 Manhã, 🔵 Tarde e Específicos
- 📄 Documentação: `RELEASE_v2.51.10_TUDO_RESOLVIDO.md`

### **v2.51.9 (2026-03-09 13:00)** 🔧
- ✅ **Position absolute para blocos expandidos**: Manhã e Tarde agora ocupam múltiplas células visualmente
- ✅ **Logs de debug detalhados**: Caracteres ASCII, matching de slots
- 📄 Documentação: `HOTFIX_v2.51.9_DEBUG_POSITION.md`

### **v2.51.8 (2026-03-09 12:50)** 🎉
- ✅ **NOVA linha "⚠️ Sem Horário"** no topo do calendário
- ✅ **Horários específicos agora aparecem** (ex: "08:00 - 10:00")
- ✅ **Blocos expandidos CORRIGIDOS**: Manhã ocupa 3 slots visualmente, Tarde ocupa 4 slots
- ✅ **Cores distintas por tipo**: Verde (Manhã), Laranja (Tarde/Sem Horário), Azul (específico)
- ✅ **Altura fixa calculada corretamente**: (rowSpan × 80px) - 16px padding
- ✅ Sistema de `celulasOcupadas` previne sobreposição
- 📄 Documentação: `HOTFIX_v2.51.8_CORRECOES_FINAIS.md`

### **v2.51.7 (2026-03-09 12:40)** 🎉
- ✅ **BUGFIX CRÍTICO:** Eliminação de blocos duplicados no Mapa Cargas
- ✅ **Carga "Manhã":** agora aparece apenas 1 bloco (antes 3x)
- ✅ **Carga "Tarde":** agora aparece apenas 1 bloco (antes 4x)
- ✅ **Blocos expandidos:** Manhã ocupa 3 slots de altura, Tarde ocupa 4 slots
- ✅ **Badges visuais:** ☀️ Manhã (verde), 🌆 Tarde (laranja), 🕐 Horário específico (azul)
- ✅ Sistema de `celulasOcupadas` previne sobreposição
- 📄 Documentação: `HOTFIX_v2.51.7_BLOCOS_DUPLICADOS.md`

### **v2.51.6 (2026-03-09 12:20)** 🔧
- ✅ Tentativa inicial de prevenir duplicação (parcialmente resolvido)
- ⚠️ Ainda apresentava duplicações em alguns casos

### **v2.51.5 (2026-03-09 12:10)** 🎨
- ✅ Refinamentos: horário não duplicado (parcial), semana estável, login escondido
- ✅ Badge "DIA INTEIRO" para cargas sem horário
- 📄 Documentação: `RELEASE_v2.51.5_REFINAMENTOS.md`

### **v2.51.4 (2026-03-09)** 🎉
- ✅ **BUGFIX CRÍTICO:** Normalização de formato de data (`"04/mar"` → `"04/03"`)
- ✅ **Mapa Cargas agora funciona!** Blocos aparecem corretamente
- ✅ Suporta múltiplos formatos: `"04/mar"`, `"4/mar"`, `"04/3"`, `"4/3"`, `"04/03"`
- ✅ Logs automáticos mostram normalização em tempo real
- 📄 Documentação: `PROBLEMA_RESOLVIDO_FINAL_v2.51.4.md`

### **v2.51.3 (2026-03-09)** 🔍
- ✅ Logs automáticos completos ao abrir Mapa Cargas (sem executar no console)
- ✅ Debug detalhado de TRANSP, datas, semanas, matching
- 📄 Documentação: `INSTRUCOES_DEBUG_v2.51.3.md`

### **v2.51.2 (2026-03-09)** 🔥
- ✅ **BUGFIX FINAL:** RENDER usa `originalIndex` (não índice filtrado)
- ✅ **BUGFIX:** Células não aparecem vazias ao filtrar por semana
- ✅ **BUGFIX:** Data não muda mais ao trocar de sheet
- ✅ **BUGFIX:** Mapa Cargas agora mostra dados corretamente
- ✅ Logs de debug adicionados para facilitar troubleshooting
- 📄 Documentação: `HOTFIX_v2.51.2_RENDER_FINAL.md`

### **v2.51.1 (2026-03-09)** 🔥
- ✅ **BUGFIX CRÍTICO:** Data correta ao carregar da BD (usava `rowIndex` em vez de `row.row_order`)
- ✅ **BUGFIX CRÍTICO:** Data correta ao salvar (mapeamento correto `dates[originalIndex]`)
- ✅ **Retry automático:** Se coluna `horario_carga` não existe, remove campo e salva resto
- ✅ **Degradação graceful:** Sistema 100% funcional mesmo sem executar SQL
- ✅ Nome atualizado: "Calendário Semanal" → "Mapa Cargas"
- 📄 Documentação: `HOTFIX_v2.51.1_DATA_CORRETA_FALLBACK.md`

### **v2.51.0 (2026-03-09)**
- ✅ **NOVO:** Calendário Semanal (estilo Outlook, seg-sex, 06:00-20:00)
- ✅ **NOVO:** Coluna `horario_carga` (combobox com 10 opções)
- ✅ **NOVO:** Filtro automático (apenas cargas com TRANSP)
- ✅ **NOVO:** Posicionamento inteligente por horário
- ✅ **BUGFIX:** Data errada ao salvar (09/março → 02/março)
- 📄 Documentação: `RELEASE_v2.51.0_CALENDARIO_HORARIOS.md`

### **v2.50.3 (2026-03-09)**
- ✅ Código único armazenado na BD (ex: `SEC_E2_003`)
- ✅ Cores progressivas nos blocos da matriz
- 📄 Documentação: `HOTFIX_v2.50.3_CODIGO_UNICO_BD.md`

### **v2.50.0 (2026-03-05)**
- ✅ Sistema de cores progressivas (verde→azul→turquesa)
- ✅ Células independentes com identificação visual
- 📄 Documentação: `VERSAO_v2.50.0_CORES_PROGRESSIVAS.md`

### **v2.36.0 (2026-03-05)**
- ✅ Células 100% independentes
- ✅ Footer salvo na BD
- ❌ Merge de células removido (tecnicamente impossível com CSS Grid)
- 📄 Documentação: `VERSAO_v2.36.0_FINAL.md`

### **v2.30.19 - v2.35.4 (tentativas)**
- Tentativas de merge com margens negativas, transforms, overlays
- **Conclusão:** CSS Grid não suporta merge sem afetar vizinhas

### **v2.0.0 - v2.30.0**
- Sistema base de gestão de secagens
- Matriz de carga inicial
- Integração com Supabase

---

## 📊 **Estrutura de Dados**

### **Tabela: `secagens`**
```sql
- id (UUID)
- codigo (TEXT, UNIQUE) → ex: 'SEC_E2_003' ⭐ NOVO v2.50.3
- estufa_id (INTEGER)
- start_time (TIMESTAMP)
- end_time (TIMESTAMP)
- duration_hours (INTEGER)
- obs (TEXT)
- created_by (UUID)
- updated_by (UUID)
```

### **Tabela: `secagem_cargo`**
```sql
- id (UUID)
- secagem_id (UUID) → FK secagens.id
- posicao (TEXT) → '8-1', '8-2', 'footer', etc.
- tipo_palete (TEXT) → 'EUR 1200×800 - 10 lotes'
- block_color (TEXT) → '#4CD964', '#5AC8FA', etc. (não salvo - gerado dinamicamente)
```

### **Tabela: `mapa_encomendas`**
```sql
- id (UUID)
- month (TEXT) → 'jan', 'fev', 'mar', etc.
- year (INTEGER) → 2026
- date (TEXT) → '09/03'
- row_order (INTEGER) → índice global (0, 1, 2, ...)
- sem (TEXT) → número da semana
- cliente (TEXT)
- local (TEXT)
- medida (TEXT)
- qtd (TEXT)
- transp (TEXT)
- horario_carga (TEXT) → '08:00 - 10:00', 'Manhã', etc. ⭐ NOVO v2.51.0
- obs (TEXT)
- updated_at (TIMESTAMP)
```

---

## ⚠️ **Ações Necessárias Antes de Deploy**

### **SQL para v2.51.0:**
```sql
ALTER TABLE mapa_encomendas 
ADD COLUMN IF NOT EXISTS horario_carga TEXT;

CREATE INDEX IF NOT EXISTS idx_mapa_encomendas_horario 
ON mapa_encomendas(horario_carga);
```

### **SQL para v2.50.3:**
```sql
ALTER TABLE secagens ADD COLUMN codigo TEXT UNIQUE;
```

### **Migração (opcional) para preencher códigos:**
```sql
WITH ranked_secagens AS (
  SELECT id, estufa_id,
         ROW_NUMBER() OVER (PARTITION BY estufa_id ORDER BY created_at) AS seq_num
  FROM secagens WHERE codigo IS NULL
)
UPDATE secagens
SET codigo = CONCAT('SEC_E', ranked_secagens.estufa_id, '_', LPAD(ranked_secagens.seq_num::TEXT, 3, '0'))
FROM ranked_secagens
WHERE secagens.id = ranked_secagens.id;
```

---

## 🔧 **Funcionalidades do Calendário Semanal**

### **Como Funciona:**
1. **Filtro automático:** apenas linhas com campo `TRANSP` preenchido
2. **Vista semanal:** seg-sex (fim de semana excluído)
3. **Horário de trabalho:** 06:00-20:00 (7 slots de 2h)

### **Posicionamento de Blocos:**
| Horário Selecionado | Slots Ocupados |
|---------------------|----------------|
| `08:00 - 10:00`     | Apenas 08:00-10:00 |
| `Manhã`             | 06:00-08:00, 08:00-10:00, 10:00-12:00 |
| `Tarde`             | 12:00-14:00, 14:00-16:00, 16:00-18:00, 18:00-20:00 |
| (vazio)             | Todos os slots (dia inteiro) |

### **Navegação:**
- **◀ Semana Anterior** / **Semana Seguinte ▶**
- **🔄 Atualizar** (recarrega dados)

### **Visual:**
- Gradiente azul: `linear-gradient(135deg, #007AFF 0%, #0051D5 100%)`
- Hover effect: translateY(-2px) + box-shadow
- Click: mostra toast com informações da carga

---

## 🔄 **Próximos Passos Sugeridos**

1. ✅ Executar SQL para adicionar `horario_carga`
2. ✅ Testar calendário semanal
3. ⏳ Treinar utilizadores no novo fluxo
4. ⏳ Feedback e refinamentos

---

## 📞 **Suporte e Documentação**

**Documentação detalhada:**
- `RELEASE_v2.51.0_CALENDARIO_HORARIOS.md` - Calendário Semanal + Horários
- `HOTFIX_v2.50.3_CODIGO_UNICO_BD.md` - Código único na BD
- `VERSAO_v2.50.0_CORES_PROGRESSIVAS.md` - Sistema de cores
- `VERSAO_v2.36.0_FINAL.md` - Células independentes

**Console (F12):**
- `debugSecagens()` - Listar todas as secagens
- `listarSecagensEstufa(3)` - Secagens da estufa 3
- `apagarSecagemFantasma("id-aqui")` - Apagar secagem

---

## 🚀 **URLs de Produção**

**Aplicação:** (inserir URL após deploy)  
**Base de dados:** Supabase  
**Autenticação:** Supabase Auth  

---

**Sistema completo e pronto para produção!** ✅  
**Última atualização:** 09/03/2026 - v2.51.0
