// ===================================================================
// PSY - Gestão de secagens, encomendas e cargas
// Versão: v2.51.35b - Logo RAIZ + Limpar cor + Remove botão + Borda 40%
// Data: 18/03/2026
// ===================================================================
console.log('🚀 APP.JS v2.51.33 - Matriz: altura -40%, fonte 2x, footer 2 cols, Gantt fix');

// ===================================================================
// SISTEMA DE SAVE COM DEBOUNCING E QUEUE (Fase 1 - Trabalho Concorrente)
// ===================================================================
let saveQueue = new Map(); // Map<rowIndex, {fields, timestamp}>
let saveTimer = null;
const SAVE_DEBOUNCE_MS = 1000; // 1 segundo de inatividade
let isSaving = false;

// ===================================================================
// PROTEÇÕES PARA USO PROLONGADO (Anti-perda de dados)
// ===================================================================
let autoSaveInterval = null;
let lastActivityTime = Date.now();
let pendingChangesCount = 0;
const AUTO_SAVE_INTERVAL_MS = 30000; // 30 segundos
const INACTIVITY_WARNING_MS = 300000; // 5 minutos

// ===================================================================
// SUPABASE REALTIME (Fase 2 - Sincronização Tempo Real)
// ===================================================================
let realtimeChannel = null;
let isRealtimeActive = false;

// ===================================================================
// FASE 3: SUPABASE PRESENCE - Indicadores de Utilizadores Online
// ===================================================================
let presenceChannel = null;
let onlineUsers = new Map(); // Map<user_id, {name, email, color, cell}>
let myPresenceState = null;
let currentActiveCell = null; // {rowIndex, fieldKey}

// Cores para utilizadores (rotação automática)
const USER_COLORS = [
    '#4285F4', // Azul Google
    '#EA4335', // Vermelho Google
    '#FBBC04', // Amarelo Google
    '#34A853', // Verde Google
    '#FF6D00', // Laranja
    '#9C27B0', // Roxo
    '#00BCD4', // Ciano
    '#E91E63', // Rosa
    '#795548', // Castanho
    '#607D8B'  // Azul-acinzentado
];

function getUserColor(userId) {
    // Hash simples do userId para gerar índice de cor consistente
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

// ===================================================================
// SISTEMA DE TABS DE SEMANAS (ESTILO EXCEL)
// ===================================================================
let currentWeek = null; // Semana ativa (ex: "9", "10", "11"...)
let weekTabs = []; // Array de semanas do mês atual

// ===================================================================
// UTILS - Detectar conflitos de horário
function detectConflicts(estufaId, startTime, endTime, excludeId = null) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const now = new Date();
    
    console.log(`🔍 Detectando conflitos:`);
    console.log(`   Estufa: ${estufaId}`);
    console.log(`   Período: ${formatDateTime(start)} → ${formatDateTime(end)}`);
    console.log(`   ExcludeId: ${excludeId ? excludeId.slice(0,8) : 'nenhum'}`);
    console.log(`   Agora: ${formatDateTime(now)}`);
    console.log(`   Total de secagens em memória: ${secagens.length}`);
    
    // Listar todas as secagens da estufa
    const secagensEstufa = secagens.filter(s => s.estufa_id === estufaId);
    console.log(`   Secagens da Estufa ${estufaId}: ${secagensEstufa.length}`);
    secagensEstufa.forEach(s => {
        const secEnd = new Date(s.end_time);
        const isFinished = secEnd < now;
        console.log(`      - ${s.id.slice(0,8)}: ${formatDateTime(s.start_time)} → ${formatDateTime(s.end_time)} ${isFinished ? '✅ TERMINADA' : '🔴 ATIVA'}`);
    });
    
    const conflicts = secagens.filter(s => {
        // Ignorar a própria secagem (ao editar)
        if (excludeId && s.id === excludeId) {
            console.log(`   ⏭️ Ignorando própria secagem: ${s.id.slice(0,8)}`);
            return false;
        }
        
        // Apenas mesma estufa
        if (s.estufa_id !== estufaId) return false;
        
        const secStart = new Date(s.start_time);
        const secEnd = new Date(s.end_time);
        
        // 🛡️ IGNORAR SECAGENS JÁ TERMINADAS (passado)
        if (secEnd < now) {
            console.log(`   ⏭️ Ignorando secagem já terminada: ${s.id.slice(0,8)} (terminou em ${formatDateTime(secEnd)})`);
            return false;
        }
        
        // Detectar sobreposição: (start1 < end2) AND (end1 > start2)
        const hasOverlap = (start < secEnd) && (end > secStart);
        
        if (hasOverlap) {
            console.log(`   ⚠️ CONFLITO com ${s.id.slice(0,8)}: ${formatDateTime(secStart)} → ${formatDateTime(secEnd)}`);
        }
        
        return hasOverlap;
    });
    
    console.log(`   ✅ Total de conflitos: ${conflicts.length}`);
    
    return conflicts;
}

// UTILS - Gerar código sequencial da secagem
function getSecagemCode(sec) {
    if (!sec || !sec.estufa_id) return 'SEC_???';
    
    // 🎯 v2.50.3: Usar código da BD se existir (novo comportamento)
    if (sec.codigo) {
        return sec.codigo;
    }
    
    // ⚠️ FALLBACK: Calcular dinamicamente (para secagens antigas sem código)
    const samEstufaSecagens = secagens
        .filter(s => s.estufa_id === sec.estufa_id)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    const index = samEstufaSecagens.findIndex(s => s.id === sec.id);
    const sequentialNumber = (index + 1).toString().padStart(3, '0');
    const code = `SEC_E${sec.estufa_id}_${sequentialNumber}`;
    
    console.log(`⚠️ Código gerado dinamicamente (secagem antiga): ${code} | ID: ${sec.id.slice(0,8)}`);
    
    return code;
}

// AUTH
async function checkAuthState() {
    const { data: { session } } = await db.auth.getSession();
    if (session) {
        currentUser = session.user;
        
        // ✅ Garantir que o utilizador existe na tabela profiles
        console.log('🔍 [checkAuthState] Verificando perfil para:', currentUser.id);
        const { data: profile, error: profileError } = await db
            .from('profiles')
            .select('id')
            .eq('id', currentUser.id)
            .single();
        
        console.log('   [checkAuthState] Resultado:', { profile, profileError });
        
        if (profileError) {
            if (profileError.code === 'PGRST116') {
                // Utilizador não existe na tabela profiles → criar
                console.log('⚠️ [checkAuthState] Perfil não encontrado, criando automaticamente...');
                const { data: newProfile, error: insertError } = await db
                    .from('profiles')
                    .insert({
                        id: currentUser.id,
                        email: currentUser.email,
                        nome: currentUser.email.split('@')[0],
                        role: 'operador'
                    })
                    .select()
                    .single();
                
                if (insertError) {
                    console.error('❌ [checkAuthState] Erro ao criar perfil:', insertError);
                    console.error('   Código:', insertError.code);
                    console.error('   Detalhes:', insertError.details);
                } else {
                    console.log('✅ [checkAuthState] Perfil criado com sucesso!', newProfile);
                }
            } else {
                console.error('❌ [checkAuthState] Erro desconhecido:', profileError);
            }
        } else {
            console.log('✅ [checkAuthState] Perfil já existe:', profile);
        }
        
        showApp();
        loadAllData();
        setupRealtime();
        updateDateTime();
        setInterval(updateDateTime, 60000);
    } else {
        showLogin();
    }
}

function showLogin() {
    // 🔥 v2.51.5: Usar classe em vez de style inline
    document.getElementById('login-screen').classList.add('show');
    document.getElementById('app').style.display = 'none';
}

function showApp() {
    // 🔥 v2.51.5: Usar classe em vez de style inline
    document.getElementById('login-screen').classList.remove('show');
    document.getElementById('app').style.display = 'block';
    const initials = currentUser.email.substring(0, 2).toUpperCase();
    document.getElementById('user-avatar').textContent = initials;
    
    // Setup navegação do Gantt
    setupGanttNavigation();
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const email = username.toLowerCase() + '@secagens.local';
    
    const btn = document.getElementById('login-btn');
    const btnText = document.getElementById('login-text');
    const btnLoading = document.getElementById('login-loading');
    const errorDiv = document.getElementById('login-error');
    
    btn.disabled = true;
    btnText.classList.add('d-none');
    btnLoading.classList.remove('d-none');
    errorDiv.classList.add('d-none');
    
    try {
        const { data, error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
        currentUser = data.user;
        
        // ✅ Garantir que o utilizador existe na tabela profiles
        console.log('🔍 Verificando perfil para:', currentUser.id);
        const { data: profile, error: profileError } = await db
            .from('profiles')
            .select('id')
            .eq('id', currentUser.id)
            .single();
        
        console.log('   Resultado da consulta:', { profile, profileError });
        
        if (profileError) {
            if (profileError.code === 'PGRST116') {
                // Utilizador não existe na tabela profiles → criar
                console.log('⚠️ Perfil não encontrado, criando automaticamente...');
                const { data: newProfile, error: insertError } = await db
                    .from('profiles')
                    .insert({
                        id: currentUser.id,
                        email: currentUser.email,
                        nome: username,
                        role: 'operador'
                    })
                    .select()
                    .single();
                
                if (insertError) {
                    console.error('❌ Erro ao criar perfil:', insertError);
                    console.error('   Código:', insertError.code);
                    console.error('   Detalhes:', insertError.details);
                    console.error('   Hint:', insertError.hint);
                    
                    if (insertError.code === '42501') {
                        console.error('⚠️ RLS está a bloquear criação de perfil!');
                        console.error('⚠️ Você precisa criar o perfil manualmente no Supabase ou ajustar políticas RLS.');
                        showToast('⚠️ Perfil não existe. Contacte o administrador.', 'error');
                        // NÃO bloquear login - deixar continuar
                    } else {
                        throw new Error('Não foi possível criar perfil do utilizador');
                    }
                } else {
                    console.log('✅ Perfil criado com sucesso!', newProfile);
                }
            } else {
                console.error('❌ Erro desconhecido ao consultar perfil:', profileError);
            }
        } else {
            console.log('✅ Perfil já existe:', profile);
        }
        
        showApp();
        loadAllData();
        setupRealtime();
        showToast('Login realizado com sucesso!');
    } catch (error) {
        errorDiv.textContent = '❌ Credenciais inválidas';
        errorDiv.classList.remove('d-none');
    } finally {
        btn.disabled = false;
        btnText.classList.remove('d-none');
        btnLoading.classList.add('d-none');
    }
});

// LOGOUT
document.getElementById('logout-btn')?.addEventListener('click', async () => {
    if (!confirm('Tem certeza que deseja sair?')) return;
    
    try {
        // Desconectar realtime
        if (realtimeChannel) {
            await realtimeChannel.unsubscribe();
            realtimeChannel = null;
            console.log('🔌 Realtime desconectado');
        }
        if (presenceChannel) {
            await presenceChannel.unsubscribe();
            presenceChannel = null;
            console.log('🔌 Presence desconectado');
        }
        
        // Fazer logout no Supabase
        await db.auth.signOut();
        
        // Limpar dados locais
        currentUser = null;
        secagens = [];
        onlineUsers.clear();
        myPresenceState = null;
        
        // Limpar UI de utilizadores online
        const onlineContainer = document.getElementById('online-users-container');
        if (onlineContainer) {
            onlineContainer.innerHTML = '';
        }
        
        // Limpar indicadores de células ativas
        document.querySelectorAll('.active-cell-indicator').forEach(el => el.remove());
        
        // Mostrar tela de login
        showLogin();
        
        showToast('✅ Logout realizado com sucesso!', 'success');
        console.log('👋 Utilizador saiu - Dados limpos');
    } catch (error) {
        console.error('❌ Erro ao fazer logout:', error);
        showToast('❌ Erro ao fazer logout', 'error');
    }
});

// TABS
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(`tab-${tabName}`).classList.add('active');
        
        if (tabName === 'visualizacao') {
            console.log('🔄 Aba Visualização aberta - recarregando dados...');
            loadAllData().then(() => loadDashboard());
        }
        
        if (tabName === 'encomendas') {
            console.log('📋 Aba Mapa de Encomendas aberta - carregando dados...');
            loadEncomendasData().then(() => {
                // Ativar Realtime após carregar dados
                setupEncomendasRealtime();
                
                // 👥 FASE 3: Ativar sistema de presença
                setupPresence();
            });
        }
        
        if (tabName === 'calendario') {
            console.log('📅 Aba Mapa Cargas aberta - carregando dados...');
            
            // 🔥 BUGFIX v2.51.10: Garantir que dados estão carregados ANTES de renderizar
            const renderizarMapaCargas = () => {
                // 🔍 AUTO-DEBUG: Mostrar informações automáticas
                console.log('='.repeat(60));
                console.log('🔍 AUTO-DEBUG: DADOS DO MAPA CARGAS');
                console.log('='.repeat(60));
                
                console.log('\n📊 Estado atual:');
                console.log(`   currentCalendarioWeek: ${currentCalendarioWeek || 'não definida'}`);
                console.log(`   currentMonth: ${currentMonth}`);
                console.log(`   currentYear: ${currentYear}`);
                
                console.log('\n📅 encomendasData.dates (primeiras 20 não vazias):');
                let count = 0;
                encomendasData.dates.forEach((date, i) => {
                    if (date && date.trim() !== '' && count < 20) {
                        console.log(`   [${i}]: "${date}"`);
                        count++;
                    }
                });
                
                console.log('\n🔍 Procurar campos TRANSP preenchidos:');
                const transpKeys = Object.keys(encomendasData.data).filter(k => k.includes('_transp') && encomendasData.data[k] && encomendasData.data[k].trim() !== '');
                console.log(`   ✅ Total de campos TRANSP preenchidos: ${transpKeys.length}`);
                
                if (transpKeys.length > 0) {
                    console.log('\n📦 Detalhes de cada carga:');
                    transpKeys.forEach(key => {
                        const index = parseInt(key.split('_')[0]);
                        const date = encomendasData.dates[index];
                        const semana = encomendasData.data[`${index}_sem`];
                        const cliente = encomendasData.data[`${index}_cliente`] || '(sem cliente)';
                        const local = encomendasData.data[`${index}_local`] || '(sem local)';
                        const medida = encomendasData.data[`${index}_medida`] || '(sem medida)';
                        const qtd = encomendasData.data[`${index}_qtd`] || '(sem qtd)';
                        const transp = encomendasData.data[key];
                        const horario = encomendasData.data[`${index}_horario_carga`] || '(vazio)';
                        
                        console.log(`\n   📌 Índice ${index}:`);
                        console.log(`      Data: "${date}" (formato: ${date ? date.length : 0} caracteres)`);
                        console.log(`      Semana: ${semana}`);
                        console.log(`      Cliente: "${cliente}"`);
                        console.log(`      Local: "${local}"`);
                        console.log(`      Medida: "${medida}"`);
                        console.log(`      Qtd: "${qtd}"`);
                        console.log(`      Transporte: "${transp}"`);
                        console.log(`      Horário: "${horario}"`);
                    });
                } else {
                    console.warn('\n   ⚠️ NENHUM campo TRANSP preenchido encontrado!');
                    console.warn('   → Certifica-te que preencheste o campo TRANSP no Mapa de Encomendas');
                }
                
                console.log('\n' + '='.repeat(60));
                
                renderCalendarioSemanal();
            };
            
            // Verificar se dados já estão carregados
            if (!encomendasData.dates || encomendasData.dates.length === 0) {
                console.log('⏳ Dados não carregados ainda - carregando agora...');
                loadEncomendasData().then(() => {
                    console.log('✅ Dados carregados com sucesso!');
                    renderizarMapaCargas();
                });
            } else {
                console.log('✅ Dados já carregados - renderizando imediatamente...');
                renderizarMapaCargas();
            }
        }
    });
});

// DATA
async function loadAllData() {
    await loadSecagens();
    renderGantt();
    updateBadges();
}

async function loadSecagens() {
    try {
        console.log('📥 Carregando secagens da BD...');
        const { data, error } = await db
            .from('secagens')
            .select(`*, cargo:secagem_cargo(*)`)
            .order('start_time');
        if (error) throw error;
        secagens = data || [];
        
        console.log(`✅ Carregadas ${secagens.length} secagens da BD:`);
        secagens.forEach(s => {
            console.log(`   - ${s.id.slice(0,8)}: Estufa ${s.estufa_id} | ${formatDateTime(s.start_time)} → ${formatDateTime(s.end_time)}`);
        });
    } catch (error) {
        console.error('Error:', error);
        showToast('Erro ao carregar dados', 'error');
    }
}

function updateDateTime() {
    const now = new Date();
    document.getElementById('current-time').textContent = formatTime(now);
    document.getElementById('current-date-header').textContent = now.toLocaleDateString('pt-PT');
    document.getElementById('dashboard-subtitle').textContent = `Estado atual das 7 estufas — ${now.toLocaleDateString('pt-PT')}`;
}

function updateBadges() {
    const totalSecagens = secagens.length;
    const now = new Date();
    const activeSecagens = secagens.filter(s => 
        new Date(s.start_time) <= now && new Date(s.end_time) >= now
    ).length;
    
    document.getElementById('badge-planeamento').textContent = totalSecagens;
    document.getElementById('badge-visualizacao').textContent = activeSecagens;
}

// GANTT
function renderGantt() {
    const grid = document.getElementById('gantt-grid');
    grid.innerHTML = '';
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 2);
    
    const days = [];
    for (let i = 0; i < 10; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        days.push(d);
    }
    
    // Update date range
    const firstDay = formatDate(days[0]);
    const lastDay = formatDate(days[9]);
    document.getElementById('gantt-date-range').textContent = `${firstDay} — ${lastDay}`;
    
    // Header
    const headerCell = document.createElement('div');
    headerCell.className = 'gantt-cell gantt-header-cell';
    headerCell.textContent = 'ESTUFA';
    grid.appendChild(headerCell);
    
    days.forEach(day => {
        const cell = document.createElement('div');
        cell.className = 'gantt-cell gantt-header-cell';
        const dayName = day.toLocaleDateString('pt-PT', {weekday: 'short', day: '2-digit'});
        const monthName = day.toLocaleDateString('pt-PT', {month: 'short'}).toUpperCase();
        cell.innerHTML = `<div>${dayName.split(' ')[0].toUpperCase()}</div><div style="font-weight: 700; font-size: 15px;">${dayName.split(' ')[1]}</div>`;
        
        if (day.toDateString() === today.toDateString()) {
            cell.classList.add('today');
        }
        
        grid.appendChild(cell);
    });
    
    // Estufas - criar linhas uma de cada vez
    for (let estufaId = 1; estufaId <= 7; estufaId++) {
        const estufaCell = document.createElement('div');
        estufaCell.className = 'gantt-cell gantt-estufa-cell';
        
        const hasActiveSecagem = secagens.some(s => 
            s.estufa_id === estufaId && 
            new Date(s.start_time) <= today && 
            new Date(s.end_time) >= today
        );
        
        estufaCell.innerHTML = `
            <div class="estufa-name">
                <div class="estufa-dot" style="background: ${ESTUFA_COLORS[estufaId - 1]}"></div>
                <span>Estufa ${estufaId}</span>
            </div>
        `;
        grid.appendChild(estufaCell);
        
        // Criar todas as células do dia para esta estufa
        days.forEach((day, dayIndex) => {
            const cell = document.createElement('div');
            cell.className = 'gantt-cell gantt-day-cell';
            
            if (day < today) cell.classList.add('past');
            if (day.toDateString() === today.toDateString()) cell.classList.add('today');
            
            cell.addEventListener('click', () => {
                console.log('🔘 Clique na célula vazia:', `Estufa ${estufaId}`, formatDate(day));
                openNewSecagemModal(estufaId, day);
            });
            
            // Buscar secagens que INICIAM neste dia
            const daySecagens = secagens.filter(s => {
                if (s.estufa_id !== estufaId) return false;
                
                const secStartDate = new Date(s.start_time);
                const secStartDay = new Date(secStartDate);
                secStartDay.setHours(0, 0, 0, 0);
                
                return secStartDay.getTime() === day.getTime();
            });
            
            daySecagens.forEach(sec => {
                const secStartDate = new Date(sec.start_time);
                const secEndDate = new Date(sec.end_time);
                
                // ✅ CÁLCULO CORRETO: offset inicial + largura total
                // Exemplo: 26/02 às 17:07 até 28/02 às 17:07 (48h)
                
                // 1. Offset dentro do primeiro dia (em % do dia)
                const startHour = secStartDate.getHours() + secStartDate.getMinutes() / 60;
                const startOffsetPct = (startHour / 24) * 100; // % do dia até à hora de início
                
                // 2. Duração total em dias fracionais
                const totalHours = (secEndDate - secStartDate) / (1000 * 60 * 60);
                const fractionalDays = totalHours / 24;
                
                // 3. Largura em % (baseada no número de células)
                const widthPct = fractionalDays * 100; // cada célula = 100%
                
                console.log(`📅 ${sec.id.slice(0,6)}: ${formatDateTime(sec.start_time)} → ${formatDateTime(sec.end_time)}`);
                console.log(`   Offset: ${startOffsetPct.toFixed(1)}% | Largura: ${widthPct.toFixed(1)}% (${fractionalDays.toFixed(2)} dias)`);
                
                const block = document.createElement('div');
                block.className = 'secagem-block';
                block.style.background = ESTUFA_COLORS[estufaId - 1];
                block.style.position = 'absolute';
                block.style.left = `${startOffsetPct}%`;
                // 🔥 v2.51.33: Ajustar largura para blocos terminarem exatamente no fim
                // Remover subtração fixa, usar padding interno
                block.style.width = `${widthPct}%`;
                block.style.paddingLeft = '8px';
                block.style.paddingRight = '8px';
                block.style.boxSizing = 'border-box';
                
                // ⚠️ Detectar conflitos e marcar visualmente
                const conflicts = detectConflicts(estufaId, secStartDate, secEndDate, sec.id);
                if (conflicts.length > 0) {
                    block.classList.add('conflict');
                    block.title = `⚠️ CONFLITO: sobrepõe-se a ${conflicts.map(c => getSecagemCode(c)).join(', ')}`;
                }
                
                const cargoCount = sec.cargo?.length || 0;
                const cargoPreview = sec.cargo?.[0]?.tipo_palete || '';
                
                block.innerHTML = `
                    <div class="secagem-id">${getSecagemCode(sec)}</div>
                    <div class="secagem-time">${formatTime(sec.start_time)} → ${formatTime(sec.end_time)}</div>
                    <div class="secagem-cliente">${cargoPreview}</div>
                    <div class="secagem-badges">
                        ${sec.super_dry ? '<span class="secagem-badge">SD</span>' : ''}
                        ${cargoCount > 1 ? `<span class="secagem-badge">+${cargoCount - 1}</span>` : ''}
                    </div>
                `;
                
                block.addEventListener('click', (e) => {
                    e.stopPropagation();
                    console.log('🔵 Clique no bloco:', getSecagemCode(sec));
                    editSecagem(sec);
                });
                
                cell.appendChild(block);
            });
            
            grid.appendChild(cell);
        });
    }
}

// Event listeners para navegação do Gantt
function setupGanttNavigation() {
    const prevBtn = document.getElementById('prev-day');
    const nextBtn = document.getElementById('next-day');
    const todayBtn = document.getElementById('today-btn');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            currentGanttDate.setDate(currentGanttDate.getDate() - 1);
            renderGantt();
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            currentGanttDate.setDate(currentGanttDate.getDate() + 1);
            renderGantt();
        });
    }
    
    if (todayBtn) {
        todayBtn.addEventListener('click', () => {
            currentGanttDate = new Date();
            renderGantt();
        });
    }
}

// DASHBOARD
async function loadDashboard() {
    const grid = document.getElementById('dashboard-grid');
    grid.innerHTML = '';
    
    const now = new Date();
    let ativas = 0, livres = 0, superDry = 0;
    
    // Labels das seções
    const pinturaLabel = document.createElement('div');
    pinturaLabel.className = 'factory-label label-pintura';
    pinturaLabel.textContent = 'PINTURA';
    grid.appendChild(pinturaLabel);
    
    const caldeirasLabel = document.createElement('div');
    caldeirasLabel.className = 'factory-label label-caldeiras';
    caldeirasLabel.textContent = 'CALDEIRAS';
    grid.appendChild(caldeirasLabel);
    
    for (let estufaId = 1; estufaId <= 7; estufaId++) {
        // Encontrar secagem ATIVA (que está acontecendo agora)
        const activeSec = secagens.find(s => {
            if (s.estufa_id !== estufaId) return false;
            
            const start = new Date(s.start_time);
            const end = new Date(s.end_time);
            
            // Debug: descomentar para ver as comparações de datas
            const isActive = start <= now && end >= now;
            
            if (!isActive && s.estufa_id === estufaId) {
                console.log(`⚠️ Estufa ${estufaId} - Secagem NÃO ATIVA:`, getSecagemCode(s));
                console.log(`   Início: ${start.toLocaleString()} | Fim: ${end.toLocaleString()} | Agora: ${now.toLocaleString()}`);
                if (start > now) console.log(`   Motivo: Ainda não começou (futura)`);
                if (end < now) console.log(`   Motivo: Já terminou`);
            }
            
            return isActive;
        });
        
        const card = document.createElement('div');
        card.className = 'estufa-card';
        card.setAttribute('data-estufa', estufaId);
        card.style.background = ESTUFA_COLORS[estufaId - 1];
        
        // Apenas número e status simples (sem pre-visualização)
        const statusText = activeSec ? 'EM SECAGEM' : 'Livre';
        card.innerHTML = `
            <div class="estufa-simple-number">${estufaId}</div>
            <div class="estufa-simple-status">${statusText}</div>
        `;
        
        // Clique para abrir detalhe (ou criar nova)
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
            if (activeSec) {
                editSecagem(activeSec);
            } else {
                openNewSecagemModal(estufaId, new Date());
            }
        });
        
        grid.appendChild(card);
    }
    
    // Adicionar área central (espaço de trabalho)
    const workspace = document.createElement('div');
    workspace.className = 'factory-workspace';
    workspace.innerHTML = '🏭 Área de Trabalho';
    grid.appendChild(workspace);
    
    document.getElementById('stat-ativas').textContent = ativas;
    document.getElementById('stat-livres').textContent = livres;
    document.getElementById('stat-super-dry').textContent = superDry;
}

// MODAL
function openNewSecagemModal(estufaId, date) {
    document.getElementById('modal-title').textContent = 'Nova Secagem';
    document.getElementById('modal-subtitle').textContent = `Estufa ${estufaId || 1}`;
    document.getElementById('form-secagem').reset();
    document.getElementById('secagem-id').value = '';
    document.getElementById('input-estufa').value = estufaId || 1;
    
    const dateStr = (date || new Date()).toISOString().slice(0, 16);
    document.getElementById('input-start').value = dateStr;
    document.getElementById('input-duration').value = '48';
    
    updateModalSidebar(estufaId || 1);
    calculateEndTime();
    
    // Limpar matriz
    loadMatrixData([]);
    
    document.getElementById('btn-delete').classList.add('d-none');
    openModal();
}

function editSecagem(sec) {
    document.getElementById('modal-title').textContent = `Editar — ${getSecagemCode(sec)}`;
    document.getElementById('modal-subtitle').textContent = `Estufa ${sec.estufa_id} · ${sec.duration_hours}h`;
    document.getElementById('secagem-id').value = sec.id;
    document.getElementById('input-estufa').value = sec.estufa_id;
    document.getElementById('input-start').value = new Date(sec.start_time).toISOString().slice(0, 16);
    document.getElementById('input-duration').value = sec.duration_hours;
    document.getElementById('input-obs').value = sec.obs || '';
    
    updateModalSidebar(sec.estufa_id);
    calculateEndTime();
    
    // Carregar dados na matriz
    loadMatrixData(sec.cargo || []);
    
    document.getElementById('btn-delete').classList.remove('d-none');
    openModal();
}

function openModal() {
    document.getElementById('modal-secagem').classList.add('active');
}

function closeModal() {
    document.getElementById('modal-secagem').classList.remove('active');
}

function updateModalSidebar(estufaId) {
    document.getElementById('modal-sidebar').style.background = ESTUFA_COLORS[estufaId - 1];
}

// ✅ SISTEMA DE MATRIZ DE CARGA COM SELEÇÃO MÚLTIPLA E MERGE VISUAL
let selectedCells = [];
let matrixData = {}; // {cellId: {tipo, mergedCells: [], isGroup: bool}}
let mergedGroups = []; // [{cells: [], tipo: string}]

function initMatrixSystem() {
    console.log('🔧 INIT MATRIX SYSTEM!');
    const cells = document.querySelectorAll('.matrix-cell');
    console.log('   Células encontradas:', cells.length);
    // 🔥 v2.51.33: Footer dividido em 2 células
    const footer1 = document.getElementById('cargo-footer-1');
    const footer2 = document.getElementById('cargo-footer-2');
    const footers = [footer1, footer2].filter(f => f); // Remover nulls
    
    cells.forEach(cell => {
        cell.addEventListener('click', (e) => {
            const cellId = cell.getAttribute('data-cell');
            console.log('🖱️ CÉLULA CLICADA:', cellId, 'Ctrl:', e.ctrlKey);
            
            // Multi-seleção com Ctrl/Cmd
            if (e.ctrlKey || e.metaKey) {
                if (selectedCells.includes(cellId)) {
                    selectedCells = selectedCells.filter(id => id !== cellId);
                    cell.classList.remove('selected');
                } else {
                    selectedCells.push(cellId);
                    cell.classList.add('selected');
                }
            } else {
                // Seleção única
                cells.forEach(c => c.classList.remove('selected'));
                selectedCells = [cellId];
                cell.classList.add('selected');
            }
            
            updateSelectionLabel();
        });
    });
    
    // 🔥 v2.51.33: Footer click handlers (2 células)
    footers.forEach(footer => {
        footer.addEventListener('click', (e) => {
            const cellId = footer.getAttribute('data-cell');
            console.log('🖱️ FOOTER CLICADO:', cellId, 'Ctrl:', e.ctrlKey);
            
            // Multi-seleção com Ctrl/Cmd
            if (e.ctrlKey || e.metaKey) {
                if (selectedCells.includes(cellId)) {
                    selectedCells = selectedCells.filter(id => id !== cellId);
                    footer.classList.remove('selected');
                } else {
                    selectedCells.push(cellId);
                    footer.classList.add('selected');
                }
            } else {
                // Seleção única
                cells.forEach(c => c.classList.remove('selected'));
                footers.forEach(f => f.classList.remove('selected'));
                selectedCells = [cellId];
                footer.classList.add('selected');
            }
            
            updateSelectionLabel();
        });
    });
}

function updateSelectionLabel() {
    const label = document.getElementById('selected-cells-label');
    if (selectedCells.length === 0) {
        label.textContent = 'Selecione células (Ctrl+clique para múltipla seleção)';
        label.style.color = '#86868B';
    } else if (selectedCells.some(id => id.startsWith('footer'))) {
        // 🔥 v2.51.33: Suportar footer-1 e footer-2
        label.textContent = 'Célula(s) footer selecionada(s)';
        label.style.color = '#007AFF';
    } else {
        label.textContent = `${selectedCells.length} célula(s) selecionada(s) - Serão mescladas visualmente`;
        label.style.color = '#007AFF';
    }
}

// 🎯 v2.50.0: Palette de cores progressivas (verde → azul → turquesa)
const COLOR_PALETTE = [
    '#4CD964', // Verde claro
    '#5AC8FA', // Azul céu
    '#50E3C2', // Turquesa
    '#34C759', // Verde médio
    '#30B0C7', // Azul médio
    '#48D1CC', // Turquesa médio
    '#2ECC71', // Verde esmeralda
    '#3498DB', // Azul dodger
    '#1ABC9C', // Verde azulado
    '#27AE60', // Verde mais escuro
    '#2980B9', // Azul mais escuro
    '#16A085'  // Verde petróleo
];

let blockColorIndex = 0; // Índice global de cores

// 🎯 v2.50.0: Obter próxima cor da palette
function getNextBlockColor() {
    const color = COLOR_PALETTE[blockColorIndex % COLOR_PALETTE.length];
    blockColorIndex++;
    return color;
}

function fillSelectedCells() {
    console.log('🔵 fillSelectedCells CHAMADO!');
    const tipo = document.getElementById('cargo-tipo').value.trim();
    console.log('   Tipo:', tipo);
    console.log('   SelectedCells:', selectedCells);
    
    if (!tipo) {
        showToast('Preencha o campo Tipo Palete', 'error');
        return;
    }
    
    if (selectedCells.length === 0) {
        showToast('Selecione pelo menos uma célula', 'error');
        return;
    }
    
    // 🔥 v2.51.33: Footer handling (suportar footer-1 e footer-2)
    const footerCells = selectedCells.filter(id => id.startsWith('footer'));
    if (footerCells.length > 0) {
        footerCells.forEach(cellId => {
            const footer = document.getElementById(`cargo-${cellId}`);
            if (footer) {
                footer.classList.remove('selected');
                footer.classList.add('filled');
                footer.textContent = tipo;
                matrixData[cellId] = { tipo, isFooter: true };
            }
        });
        selectedCells = [];
        updateSelectionLabel();
        document.getElementById('cargo-tipo').value = '';
        showToast('Footer preenchido', 'success');
        return;
    }
    
    // 🎯 v2.50.0: CÉLULAS INDEPENDENTES COM COR ÚNICA POR BLOCO
    const blockColor = getNextBlockColor();
    const blockId = `block-${Date.now()}`; // ID único do bloco
    
    console.log(`🟢 Preenchendo ${selectedCells.length} células | Cor: ${blockColor} | Texto: "${tipo}"`);
    
    selectedCells.forEach(cellId => {
        const cell = document.querySelector(`[data-cell="${cellId}"]`);
        if (cell) {
            cell.classList.remove('selected');
            cell.classList.add('filled');
            
            // Aplicar cor de fundo do bloco
            cell.style.backgroundColor = blockColor;
            
            // Adicionar texto com estilo inline para garantir tamanho
            cell.innerHTML = `<div class="cell-tipo" style="font-size: 17px; font-weight: 700; color: white;">${tipo}</div>`;
            
            // Armazenar dados com informações do bloco
            matrixData[cellId] = { 
                tipo,
                blockId,      // ID do bloco (para agrupar células)
                blockColor,   // Cor do bloco
                blockCells: [...selectedCells] // Todas as células do bloco
            };
            
            console.log(`   ✅ ${cellId}: filled com cor ${blockColor}`);
        }
    });
    
    // CÓDIGO ANTIGO DE MERGE REMOVIDO
    if (false && selectedCells.length > 1) {
        console.log('🟢 MESCLANDO', selectedCells.length, 'células:', selectedCells);
        
        // Encontrar célula principal (top-left) - SÓ ela terá texto
        const rows = selectedCells.map(id => parseInt(id.split('-')[0]));
        const cols = selectedCells.map(id => parseInt(id.split('-')[1]));
        const minRow = Math.min(...rows);
        const minCol = Math.min(...cols);
        const mainCellId = `${minRow}-${minCol}`;
        
        console.log(`   📌 Célula principal: ${mainCellId} (única com texto)`);
        
        // ✅ TODAS as células ficam verdes individualmente (SEM bounding box!)
        selectedCells.forEach(cellId => {
            const cell = document.querySelector(`[data-cell="${cellId}"]`);
            if (cell) {
                cell.classList.remove('selected');
                cell.classList.add('filled', 'merged-cell');
                
                // 🎯 FIX v2.30.8: border-radius: 0 ANTES das margens negativas
                cell.style.setProperty('border-radius', '0', 'important');
                
                // 🎯 FIX v2.30.10: position + z-index (SEM overflow:hidden global!)
                cell.style.setProperty('position', 'relative', 'important');
                cell.style.setProperty('z-index', '2', 'important'); // Acima das células cinzas (z-index: 1)
                
                // APENAS a célula principal tem texto
                if (cellId === mainCellId) {
                    // 🎯 FIX v2.30.11: Centralizar texto no bloco mesclado inteiro
                    const rowSpan = Math.max(...rows) - Math.min(...rows) + 1;
                    const colSpan = Math.max(...cols) - Math.min(...cols) + 1;
                    
                    // Criar container de texto que cobre todo o bloco
                    cell.innerHTML = `<div class="cell-tipo merged-text" style="
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: calc(${colSpan} * 100% + ${colSpan - 1} * 8px);
                        height: calc(${rowSpan} * 100% + ${rowSpan - 1} * 8px);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        pointer-events: none;
                        z-index: 100;
                        color: white;
                        font-size: 17px;
                        font-weight: 700;
                    ">${tipo}</div>`;
                    console.log(`   ✅ ${cellId}: filled + merged-cell (COM TEXTO CENTRALIZADO ${rowSpan}×${colSpan})`);
                } else {
                    cell.innerHTML = ''; // Outras células: verdes mas vazias
                    console.log(`   ✅ ${cellId}: filled + merged-cell (sem texto)`);
                }
                
                // Armazenar dados
                matrixData[cellId] = {
                    tipo,
                    isGroupMember: true,
                    mainCell: mainCellId,
                    groupCells: [...selectedCells]
                };
                
                // Remover bordas internas entre células adjacentes do grupo
                const [row, col] = cellId.split('-').map(n => parseInt(n));
                
                // Vizinhos
                const rightNeighbor = `${row}-${col+1}`;
                const leftNeighbor = `${row}-${col-1}`;
                const bottomNeighbor = `${row+1}-${col}`;
                const topNeighbor = `${row-1}-${col}`;
                
                // 🎯 FIX v2.30.19: Margin negativa APENAS nas bordas INTERNAS do bloco
                // Bordas EXTERNAS mantêm margin 0 (não empurram vizinhos)
                
                // Direita: verificar se é borda INTERNA (vizinho no mesmo grupo)
                if (selectedCells.includes(rightNeighbor)) {
                    // Borda INTERNA: remover borda + aplicar margin negativa
                    cell.style.setProperty('border-right', 'none', 'important');
                    cell.style.setProperty('margin-right', '-10px', 'important');
                    console.log(`      🔹 ${cellId}: border-right + margin-right=-10px (INTERNA: ${rightNeighbor})`);
                } else {
                    // Borda EXTERNA: manter borda verde + margin 0
                    cell.style.setProperty('border-right', '2px solid #2DA948', 'important');
                    cell.style.setProperty('margin-right', '0', 'important');
                }
                
                // Esquerda: verificar se vizinho está no grupo
                const leftNeighborInGroup = selectedCells.includes(leftNeighbor);
                if (leftNeighborInGroup) {
                    // Borda INTERNA: remover borda (margin já aplicada pelo vizinho à esquerda)
                    cell.style.setProperty('border-left', 'none', 'important');
                    cell.style.setProperty('margin-left', '0', 'important');
                    console.log(`      🔹 ${cellId}: border-left removida (INTERNA: ${leftNeighbor})`);
                } else {
                    // Borda EXTERNA: manter borda verde + margin 0
                    cell.style.setProperty('border-left', '2px solid #2DA948', 'important');
                    cell.style.setProperty('margin-left', '0', 'important');
                }
                
                // Baixo: verificar se é borda INTERNA
                if (selectedCells.includes(bottomNeighbor)) {
                    // Borda INTERNA: remover borda + aplicar margin negativa
                    cell.style.setProperty('border-bottom', 'none', 'important');
                    cell.style.setProperty('margin-bottom', '-10px', 'important');
                    console.log(`      🔹 ${cellId}: border-bottom + margin-bottom=-10px (INTERNA: ${bottomNeighbor})`);
                } else {
                    // Borda EXTERNA: manter borda verde + margin 0
                    cell.style.setProperty('border-bottom', '2px solid #2DA948', 'important');
                    cell.style.setProperty('margin-bottom', '0', 'important');
                }
                
                // Cima: verificar se vizinho está no grupo
                const topNeighborInGroup = selectedCells.includes(topNeighbor);
                if (topNeighborInGroup) {
                    // Borda INTERNA: remover borda (margin já aplicada pelo vizinho acima)
                    cell.style.setProperty('border-top', 'none', 'important');
                    cell.style.setProperty('margin-top', '0', 'important');
                    console.log(`      🔹 ${cellId}: border-top removida (INTERNA: ${topNeighbor})`);
                } else {
                    // Borda EXTERNA: manter borda verde + margin 0
                    cell.style.setProperty('border-top', '2px solid #2DA948', 'important');
                    cell.style.setProperty('margin-top', '0', 'important');
                }
            }
        });
        
        mergedGroups.push({ cells: [...selectedCells], tipo, mainCell: mainCellId });
        console.log('✅ Mesclagem concluída! Células verdes individualmente, bordas internas removidas.');
    } else {
        // Célula única
        const cellId = selectedCells[0];
        matrixData[cellId] = { tipo };
        
        const cell = document.querySelector(`[data-cell="${cellId}"]`);
        cell.classList.remove('selected');
        cell.classList.add('filled');
        cell.innerHTML = `<div class="cell-tipo" style="font-size: 17px; font-weight: 700; color: white;">${tipo}</div>`;
    }
    
    selectedCells = [];
    updateSelectionLabel();
    
    // Limpar input
    document.getElementById('cargo-tipo').value = '';
    
    console.log('✅ MatrixData atualizado:', matrixData);
    console.log('✅ Merged groups:', mergedGroups);
    console.log(`   Total de células preenchidas: ${Object.keys(matrixData).length}`);
    
    showToast(`${cellsFilled} célula(s) preenchida(s) ${cellsFilled > 1 ? '(mescladas)' : ''}`, 'success');
}

function createMergeOverlay(mainCellId, minRow, maxRow, minCol, maxCol, tipo, cells) {
    // Remover overlay anterior se existir
    const existingOverlay = document.getElementById(`overlay-${mainCellId}`);
    if (existingOverlay) {
        existingOverlay.remove();
    }
    
    // Pegar célula top-left para referência de posição
    const topLeftCell = document.querySelector(`[data-cell="${minRow}-${minCol}"]`);
    if (!topLeftCell) return;
    
    // Criar overlay
    const overlay = document.createElement('div');
    overlay.id = `overlay-${mainCellId}`;
    overlay.className = 'merge-overlay';
    overlay.dataset.cells = JSON.stringify(cells);
    
    // Calcular dimensões do bounding box
    const rowSpan = maxRow - minRow + 1;
    const colSpan = maxCol - minCol + 1;
    
    // Aplicar CSS variables para posicionamento
    overlay.style.setProperty('--row-start', minRow);
    overlay.style.setProperty('--col-start', minCol);
    overlay.style.setProperty('--row-span', rowSpan);
    overlay.style.setProperty('--col-span', colSpan);
    
    // Adicionar texto centralizado
    overlay.innerHTML = `<div class="overlay-tipo">${tipo}</div>`;
    
    // Adicionar ao grid
    const matrixGrid = document.getElementById('cargo-matrix-grid');
    if (matrixGrid) {
        matrixGrid.appendChild(overlay);
        console.log(`   🎨 Overlay criado: ${rowSpan}×${colSpan} sobre células ${cells.join(', ')}`);
    }
}

function clearSelectedCells() {
    if (selectedCells.length === 0) {
        showToast('Selecione células para limpar', 'error');
        return;
    }
    
    // 🔥 v2.51.33: Footer handling (suportar footer-1 e footer-2)
    const footerCells = selectedCells.filter(id => id.startsWith('footer'));
    if (footerCells.length > 0) {
        footerCells.forEach(cellId => {
            const footer = document.getElementById(`cargo-${cellId}`);
            if (footer) {
                footer.classList.remove('selected', 'filled');
                footer.textContent = '';
                delete matrixData[cellId];
            }
        });
        selectedCells = [];
        updateSelectionLabel();
        showToast('Footer limpo', 'success');
        return;
    }
    
    selectedCells.forEach(cellId => {
        const cellData = matrixData[cellId];
        
        // Se é membro de um grupo, limpar TODAS as células do grupo
        if (cellData && cellData.isGroupMember) {
            const groupCells = cellData.groupCells;
            groupCells.forEach(id => {
                delete matrixData[id];
                const cell = document.querySelector(`[data-cell="${id}"]`);
                if (cell) {
                    cell.classList.remove('selected', 'filled', 'merged-cell');
                    // Remover todas as propriedades de borda, radius E margins aplicadas
                    cell.style.removeProperty('border-right');
                    cell.style.removeProperty('border-left');
                    cell.style.removeProperty('border-top');
                    cell.style.removeProperty('border-bottom');
                    cell.style.removeProperty('border-top-left-radius');
                    cell.style.removeProperty('border-top-right-radius');
                    cell.style.removeProperty('border-bottom-left-radius');
                    cell.style.removeProperty('border-bottom-right-radius');
                    cell.style.removeProperty('margin-right');
                    cell.style.removeProperty('margin-left');
                    cell.style.removeProperty('margin-top');
                    cell.style.removeProperty('margin-bottom');
                    cell.style.removeProperty('background-color'); // 🔥 v2.51.35: Remover cor de fundo
                    cell.innerHTML = '';
                }
            });
            mergedGroups = mergedGroups.filter(g => !g.cells.includes(cellId));
        } else {
            // Célula individual
            delete matrixData[cellId];
            const cell = document.querySelector(`[data-cell="${cellId}"]`);
            if (cell) {
                cell.classList.remove('selected', 'filled');
                cell.style.removeProperty('background-color'); // 🔥 v2.51.35: Remover cor de fundo
                cell.innerHTML = '';
            }
        }
    });
    
    selectedCells = [];
    updateSelectionLabel();
    showToast('Células limpas', 'success');
}

function loadMatrixData(cargoArray) {
    // 🎯 v2.50.0: Limpar matriz e resetar índice de cores
    matrixData = {};
    mergedGroups = [];
    blockColorIndex = 0; // Reset para cores consistentes
    
    document.querySelectorAll('.matrix-cell').forEach(cell => {
        cell.classList.remove('filled', 'selected');
        cell.style.backgroundColor = ''; // Limpar cores
        cell.style.gridColumn = '';
        cell.style.gridRow = '';
        cell.style.aspectRatio = '';
        cell.style.zIndex = '';
        cell.innerHTML = '';
    });
    
    // 🔥 v2.51.33: Limpar ambas células do footer
    const footer1 = document.getElementById('cargo-footer-1');
    const footer2 = document.getElementById('cargo-footer-2');
    [footer1, footer2].forEach(footer => {
        if (footer) {
            footer.classList.remove('filled', 'selected');
            footer.textContent = '';
        }
    });
    
    // Carregar dados
    if (cargoArray && cargoArray.length > 0) {
        cargoArray.forEach(item => {
            if (!item.posicao) return;
            
            const posicao = item.posicao;
            const tipo = item.tipo_palete;
            const blockColor = getNextBlockColor(); // 🎯 Gerar cor automaticamente (block_color não existe na BD)
            
            // 🔥 v2.51.33: Footer handling (suportar footer, footer-1, footer-2)
            if (posicao.startsWith('footer')) {
                const footerId = posicao === 'footer' ? 'footer-1' : posicao; // Compatibilidade: 'footer' → 'footer-1'
                const footer = document.getElementById(`cargo-${footerId}`);
                if (footer) {
                    footer.classList.add('filled');
                    footer.textContent = tipo;
                    matrixData[footerId] = { tipo, isFooter: true };
                }
                return;
            }
            
            // 🎯 v2.50.0: Carregar bloco com células concatenadas
            const cellIds = posicao.split(',');
            const blockId = `block-${Date.now()}-${Math.random()}`;
            
            cellIds.forEach(cellId => {
                const cell = document.querySelector(`[data-cell="${cellId}"]`);
                if (cell) {
                    cell.classList.add('filled');
                    cell.style.backgroundColor = blockColor; // Aplicar cor
                    cell.innerHTML = `<div class="cell-tipo" style="font-size: 17px; font-weight: 700; color: white;">${tipo}</div>`;
                    
                    matrixData[cellId] = {
                        tipo,
                        blockId,
                        blockColor,
                        blockCells: cellIds
                    };
                }
            });
            
            console.log(`   📥 Carregado bloco (${cellIds.length} células) → cor ${blockColor}`);
        });
    }
}

function getMatrixCargoData() {
    // 🎯 v2.50.1: Agrupar células por bloco SEM duplicação
    const result = [];
    const processedBlocks = new Set();
    const processedCells = new Set(); // 🆕 Evitar duplicação de células
    
    Object.entries(matrixData).forEach(([cellId, data]) => {
        // Validar dados
        if (!data || !data.tipo) return;
        
        // Footer: tratamento especial
        if (cellId === 'footer' || data.isFooter) {
            if (!processedCells.has('footer')) {
                result.push({
                    posicao: 'footer',
                    tipo_palete: data.tipo
                });
                processedCells.add('footer');
                console.log(`   💾 BD: footer → "${data.tipo}"`);
            }
            return;
        }
        
        // 🆕 VALIDAÇÃO: Ignorar células já processadas
        if (processedCells.has(cellId)) {
            console.log(`   ⏭️ Célula ${cellId} já processada, ignorando duplicação`);
            return;
        }
        
        // Ignorar blocos já processados
        if (data.blockId && processedBlocks.has(data.blockId)) return;
        
        // Marcar bloco como processado
        if (data.blockId) {
            processedBlocks.add(data.blockId);
        }
        
        // Determinar células do bloco
        const blockCells = (data.blockCells && Array.isArray(data.blockCells)) 
            ? data.blockCells 
            : [cellId]; // Array de 1 elemento
        
        // 🆕 Marcar TODAS as células do bloco como processadas
        blockCells.forEach(id => processedCells.add(id));
        
        result.push({
            posicao: blockCells.join(','), // Ex: "7-1,7-2" ou "8-1"
            tipo_palete: data.tipo
        });
        
        console.log(`   💾 BD: bloco ${data.blockId || 'único'} → ${blockCells.length} célula(s): ${blockCells.join(',')}`);
    });
    
    return result;
}

function calculateEndTime() {
    const start = document.getElementById('input-start').value;
    const duration = parseInt(document.getElementById('input-duration').value);
    
    if (start && duration) {
        const startDate = new Date(start);
        const endDate = new Date(startDate.getTime() + duration * 60 * 60 * 1000);
        document.getElementById('input-end').value = formatDateTime(endDate);
    }
}

document.getElementById('input-start').addEventListener('change', calculateEndTime);
document.getElementById('input-duration').addEventListener('input', calculateEndTime);

document.getElementById('form-secagem').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const secagemId = document.getElementById('secagem-id').value;
    const estufaId = parseInt(document.getElementById('input-estufa').value);
    const startTime = document.getElementById('input-start').value;
    const duration = parseInt(document.getElementById('input-duration').value);
    const obs = document.getElementById('input-obs').value;
    
    // ✅ Calcular end time
    const startDate = new Date(startTime);
    const endDate = new Date(startDate.getTime() + duration * 60 * 60 * 1000);
    
    console.log('📅 Cálculo de datas:');
    console.log(`   Início: ${formatDateTime(startDate)}`);
    console.log(`   Duração: ${duration} horas`);
    console.log(`   Fim calculado: ${formatDateTime(endDate)}`);
    console.log(`   Diferença em dias: ${(endDate - startDate) / (1000 * 60 * 60 * 24)} dias`);
    
    // 🔄 RECARREGAR SECAGENS DA BD (para evitar conflitos fantasma)
    console.log('🔄 Recarregando secagens da BD antes de validar conflitos...');
    await loadAllData();
    
    // ⚠️ VALIDAR CONFLITOS DE HORÁRIO
    const conflicts = detectConflicts(estufaId, startDate, endDate, secagemId);
    
    if (conflicts.length > 0) {
        console.warn('⚠️ CONFLITO DE HORÁRIO DETECTADO!');
        console.warn(`   Nova secagem: Estufa ${estufaId} | ${formatDateTime(startDate)} → ${formatDateTime(endDate)}`);
        console.warn(`   Total de secagens em memória: ${secagens.length}`);
        console.warn(`   Conflitos encontrados: ${conflicts.length}`);
        conflicts.forEach(c => {
            console.warn(`   - ${getSecagemCode(c)}: ${formatDateTime(c.start_time)} → ${formatDateTime(c.end_time)} | ID: ${c.id.slice(0,8)}`);
        });
        
        const conflictNames = conflicts.map(c => getSecagemCode(c)).join(', ');
        const message = `⚠️ CONFLITO DE HORÁRIO!\n\nA nova secagem sobrepõe-se a:\n${conflictNames}\n\nEstufa ${estufaId} já está ocupada nesse período.\n\nPretende guardar na mesma? (Não recomendado)`;
        
        if (!confirm(message)) {
            console.log('❌ Utilizador cancelou devido a conflito de horário');
            return; // Cancela o save
        }
        
        console.log('⚠️ Utilizador optou por guardar apesar do conflito');
    }
    
    // ✅ Obter dados da matriz
    const cargoItems = getMatrixCargoData();
    
    console.log('💾 SALVANDO SECAGEM:');
    console.log('   MatrixData:', matrixData);
    console.log('   CargoItems:', cargoItems);
    console.log('   Total de células preenchidas:', cargoItems.length);
    
    // Validar dados do cargo
    if (cargoItems.length > 0) {
        console.log('🔍 VALIDANDO CARGO:');
        cargoItems.forEach((item, index) => {
            console.log(`   Item ${index + 1}:`, {
                posicao: item.posicao,
                tipo_posicao: typeof item.posicao,
                tipo_palete: item.tipo_palete
            });
            
            // Validações (apenas campos obrigatórios)
            if (!item.posicao) console.warn(`   ⚠️ Item ${index + 1}: posicao está vazio!`);
            if (typeof item.posicao !== 'string') console.warn(`   ⚠️ Item ${index + 1}: posicao não é string!`);
            if (!item.tipo_palete) console.warn(`   ⚠️ Item ${index + 1}: tipo_palete está vazio!`);
        });
    }
    
    try {
        if (secagemId) {
            const { error } = await db.from('secagens').update({
                estufa_id: estufaId,
                start_time: startTime,
                end_time: endDate.toISOString(),  // ← ADICIONAR end_time explicitamente
                duration_hours: duration,
                obs: obs,
                updated_by: currentUser.id
            }).eq('id', secagemId);
            
            if (error) throw error;
            
            // 🔒 SEGURANÇA: Apagar e reinserir cargo em transação segura
            // 1. Backup do cargo antigo em memória (para rollback se necessário)
            const { data: oldCargo } = await db.from('secagem_cargo')
                .select('*')
                .eq('secagem_id', secagemId);
            console.log('📦 BACKUP cargo antigo:', oldCargo);
            
            // 2. Apagar cargo antigo
            await db.from('secagem_cargo').delete().eq('secagem_id', secagemId);
            console.log('🗑️ Cargo antigo apagado');
            
            // 3. Inserir novo cargo
            if (cargoItems.length > 0) {
                const cargoToInsert = cargoItems.map(c => ({ ...c, secagem_id: secagemId }));
                console.log('📦 INSERINDO CARGO (UPDATE):', cargoToInsert);
                const { data: cargoData, error: cargoError } = await db.from('secagem_cargo').insert(cargoToInsert).select();
                
                if (cargoError) {
                    console.error('❌ ERRO AO INSERIR CARGO:');
                    console.error('   Mensagem:', cargoError.message);
                    console.error('   Código:', cargoError.code);
                    console.error('   Detalhes:', cargoError.details);
                    
                    // 🚑 ROLLBACK: Tentar restaurar cargo antigo
                    if (oldCargo && oldCargo.length > 0) {
                        console.log('🚑 Tentando restaurar cargo antigo...');
                        const { error: restoreError } = await db.from('secagem_cargo').insert(oldCargo);
                        if (restoreError) {
                            console.error('💀 ERRO CRÍTICO: Não foi possível restaurar cargo!', restoreError);
                        } else {
                            console.log('✅ Cargo antigo restaurado com sucesso');
                        }
                    }
                    
                    throw cargoError;
                }
                console.log('✅ CARGO INSERIDO:', cargoData);
            } else {
                console.log('⚠️ Nenhum cargo novo para inserir');
            }
            
            showToast('Secagem atualizada!');
        } else {
            // 🎯 v2.50.3: Gerar código antes de inserir
            // Contar secagens existentes da mesma estufa para gerar código sequencial
            const { data: existingSecagens, error: countError } = await db
                .from('secagens')
                .select('id, created_at')
                .eq('estufa_id', estufaId)
                .order('created_at', { ascending: true });
            
            if (countError) {
                console.warn('⚠️ Erro ao contar secagens:', countError);
            }
            
            const sequentialNumber = ((existingSecagens?.length || 0) + 1).toString().padStart(3, '0');
            const codigo = `SEC_E${estufaId}_${sequentialNumber}`;
            
            console.log(`🏷️ Código gerado para nova secagem: ${codigo}`);
            
            const { data: newSec, error } = await db.from('secagens').insert({
                codigo: codigo,  // 🆕 Código único e estável
                estufa_id: estufaId,
                start_time: startTime,
                end_time: endDate.toISOString(),
                duration_hours: duration,
                obs: obs,
                status: 'planeada',
                created_by: currentUser.id,
                updated_by: currentUser.id
            }).select().single();
            
            if (error) throw error;
            
            if (cargoItems.length > 0) {
                const cargoToInsert = cargoItems.map(c => ({ ...c, secagem_id: newSec.id }));
                console.log('📦 INSERINDO CARGO (NEW):', cargoToInsert);
                const { data: cargoData, error: cargoError } = await db.from('secagem_cargo').insert(cargoToInsert).select();
                if (cargoError) {
                    console.error('❌ ERRO AO INSERIR CARGO:');
                    console.error('   Mensagem:', cargoError.message);
                    console.error('   Código:', cargoError.code);
                    console.error('   Detalhes:', cargoError.details);
                    console.error('   Hint:', cargoError.hint);
                    console.error('   Objeto completo:', JSON.stringify(cargoError, null, 2));
                    throw cargoError;
                }
                console.log('✅ CARGO INSERIDO:', cargoData);
            } else {
                console.log('⚠️ NENHUM CARGO PARA INSERIR (matrixData vazio)');
            }
            
            showToast('Secagem criada!');
        }
        
        await loadAllData();
        renderGantt();
        
        // Atualizar Estufas Live se estiver na tab de visualização
        const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
        if (activeTab === 'visualizacao') {
            await loadDashboard();
        }
        
        closeModal();
    } catch (error) {
        console.error('Error:', error);
        showToast('Erro ao guardar', 'error');
    }
});

async function deleteSecagem() {
    if (!confirm('Eliminar esta secagem?')) return;
    
    const secagemId = document.getElementById('secagem-id').value;
    
    try {
        const { error } = await db.from('secagens').delete().eq('id', secagemId);
        if (error) throw error;
        showToast('Secagem eliminada');
        await loadAllData();
        renderGantt();
        
        // Atualizar Estufas Live se estiver na tab de visualização
        const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
        if (activeTab === 'visualizacao') {
            await loadDashboard();
        }
        
        closeModal();
    } catch (error) {
        showToast('Erro ao eliminar', 'error');
    }
}

// REALTIME
function setupRealtime() {
    const channel = db
        .channel('secagens-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'secagens' }, async () => {
            await loadAllData();
            const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
            if (activeTab === 'visualizacao') loadDashboard();
        })
        .subscribe();
}

// MAPA DE ENCOMENDAS - Excel Grid (DATAS nas LINHAS, CAMPOS nas COLUNAS)
// 🔥 v2.51.21: Detectar mês e ano ATUAL automaticamente
const hoje = new Date();
const mesesAbrev = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
let currentMonth = mesesAbrev[hoje.getMonth()];  // Mês atual (ex: 'mar', 'abr', etc.)
let currentYear = hoje.getFullYear();  // Ano atual (ex: 2026)

console.log(`📅 Mês/Ano detectado automaticamente: ${currentMonth}/${currentYear} (hoje: ${hoje.toLocaleDateString('pt-PT')})`);

let encomendasData = {
    dates: [],  // Será carregado da BD
    fields: [
        { label: 'SEM', key: 'sem', color: '#FFFFFF', width: '60px' },
        { label: 'CLIENTE', key: 'cliente', color: '#FFFFFF', width: '150px' },
        { label: 'LOCAL', key: 'local', color: '#FFFFFF', width: '120px' },
        { label: 'MEDIDA', key: 'medida', color: '#FFFFFF', width: '100px' },
        { label: 'QTD', key: 'qtd', color: '#FFFFFF', width: '80px' },
        { label: 'TRANSP', key: 'transp', color: '#FFFFFF', width: '120px' },
        { label: 'E.T.*', key: 'et', color: '#D9E1F2', width: '80px' },
        { label: 'ENC.', key: 'enc', color: '#FFFFFF', width: '100px' },
        { label: 'NºVIAGEM', key: 'nviagem', color: '#FFFFFF', width: '100px' },
        { label: 'HORÁRIO', key: 'horario_carga', color: '#FFF4E6', width: '150px', type: 'select' },  // 🆕 v2.51.0
        { label: 'OBSERVAÇÕES', key: 'obs', color: '#FFFFFF', width: '200px' }
    ],
    data: {}  // {date_field: value}
};

// 🔥 v2.51.27: Mapeamento de índices (visual -> real) para suportar filtros de semana
let encomendasIndexMapping = [];

const monthNames = {
    'jan': 'Janeiro', 'fev': 'Fevereiro', 'mar': 'Março',
    'abr': 'Abril', 'mai': 'Maio', 'jun': 'Junho',
    'jul': 'Julho', 'ago': 'Agosto', 'set': 'Setembro',
    'out': 'Outubro', 'nov': 'Novembro', 'dez': 'Dezembro'
};

// ===================================================================
// FUNÇÕES PARA TABS DE SEMANAS
// ===================================================================

// Gerar tabs de semanas do mês atual
function generateWeekTabs() {
    try {
        const container = document.getElementById('week-tabs-container');
        if (!container) {
            console.warn('⚠️ Container de tabs de semanas não encontrado');
            return;
        }
    
    container.innerHTML = '';
    
    // Descobrir semanas do mês atual
    const monthIndex = {
        'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
        'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11
    }[currentMonth];
    
    const firstDay = new Date(currentYear, monthIndex, 1);
    const lastDay = new Date(currentYear, monthIndex + 1, 0);
    
    const weeks = new Set();
    
    // Iterar por todos os dias do mês e coletar números de semana
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
        const weekNum = getWeekNumber(d);
        weeks.add(weekNum);
    }
    
    weekTabs = Array.from(weeks).sort((a, b) => a - b);
    
    // 🔥 FEATURE v2.51.15: Selecionar semana ATUAL (data de hoje) ao invés da primeira
    if (!currentWeek && weekTabs.length > 0) {
        const today = new Date();
        const currentWeekNumber = getWeekNumber(today);
        
        // Se semana atual existe nas tabs, selecionar ela
        if (weekTabs.includes(currentWeekNumber)) {
            currentWeek = currentWeekNumber;
            console.log(`📅 Semana ATUAL selecionada automaticamente: Semana ${currentWeek}`);
        } else {
            // Fallback: semana mais próxima (primeira disponível)
            currentWeek = weekTabs[0];
            console.log(`⚠️ Semana atual (${currentWeekNumber}) não encontrada. Usando primeira: Semana ${currentWeek}`);
        }
    }
    
    // Criar tabs
    weekTabs.forEach(week => {
        const tab = document.createElement('div');
        tab.className = 'week-tab';
        if (week === currentWeek) {
            tab.classList.add('active');
        }
        tab.textContent = `Semana ${week}`;
        tab.onclick = () => switchToWeek(week);
        container.appendChild(tab);
    });
    
    // Botão +
    const addBtn = document.createElement('button');
    addBtn.className = 'week-tab-add';
    addBtn.innerHTML = '+';
    addBtn.title = 'Adicionar nova semana';
    addBtn.onclick = addNewWeek;
    container.appendChild(addBtn);
    
    console.log(`✅ Tabs de semanas geradas: ${weekTabs.length} semanas`);
    
    } catch (error) {
        console.error('❌ Erro ao gerar tabs de semanas:', error);
    }
}

// Mudar para outra semana
function switchToWeek(weekNumber) {
    currentWeek = weekNumber;
    
    // Atualizar tabs visuais
    const tabs = document.querySelectorAll('.week-tab');
    tabs.forEach(tab => {
        if (tab.textContent === `Semana ${weekNumber}`) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    // Re-renderizar grid apenas com dados da semana selecionada
    renderEncomendasGrid();
}

// Adicionar nova semana
async function addNewWeek() {
    // Próxima semana após a última
    const nextWeek = weekTabs.length > 0 ? Math.max(...weekTabs) + 1 : 1;
    
    weekTabs.push(nextWeek);
    weekTabs.sort((a, b) => a - b);
    
    // Pré-popular essa semana com 7 dias × 20 linhas
    prePopulateWeek(nextWeek);
    
    // Salvar no Supabase
    await saveAllRows();
    
    // Re-gerar tabs
    generateWeekTabs();
    
    // Mudar para a nova semana
    switchToWeek(nextWeek);
    
    showToast(`✅ Semana ${nextWeek} adicionada`, 'success');
}

// ⚠️ FORÇAR PRÉ-POPULAÇÃO DO MÊS (apagar dados existentes)
async function forcePrePopulateMonth() {
    const totalLinhas = encomendasData.dates.length;
    
    const confirmMsg = totalLinhas > 0 
        ? `⚠️ ATENÇÃO!\n\nEste mês tem ${totalLinhas} linhas existentes.\n\nPré-popular irá:\n✅ Criar estrutura completa (Seg-Sex: 20 linhas, Sáb: 5, Dom: 0)\n❌ APAGAR todos os dados atuais\n\nTem certeza?`
        : `✅ Pré-popular ${monthNames[currentMonth]} 2026?\n\nSerá criada a estrutura completa:\n• Segunda a Sexta: 20 linhas/dia\n• Sábado: 5 linhas/dia\n• Domingo: 0 linhas`;
    
    if (!confirm(confirmMsg)) {
        console.log('❌ Pré-população cancelada pelo utilizador');
        return;
    }
    
    console.log('🔄 Forçando pré-população do mês:', currentMonth, '/', currentYear);
    
    try {
        // 1. APAGAR dados antigos do Supabase
        console.log('🗑️ Apagando dados antigos...');
        const { error: deleteError } = await db
            .from('mapa_encomendas')
            .delete()
            .eq('month', currentMonth)
            .eq('year', currentYear);
        
        if (deleteError) {
            console.error('❌ Erro ao apagar:', deleteError);
            throw deleteError;
        }
        
        console.log('✅ Dados antigos apagados');
        
        // 2. Criar estrutura nova
        prePopulateMonth();
        
        // 3. Salvar no Supabase
        console.log('💾 Salvando nova estrutura...');
        await saveAllRows();
        
        // 4. Regenerar tabs e grid
        generateWeekTabs();
        renderEncomendasGrid();
        
        showToast(`✅ Mês pré-populado com ${encomendasData.dates.length} linhas!`, 'success');
        
    } catch (error) {
        console.error('❌ Erro ao pré-popular:', error);
        showToast('❌ Erro ao pré-popular. Verifique o console.', 'error');
    }
}

// Pré-popular MÊS INTEIRO automaticamente
// Estrutura: Seg-Sex = 20 linhas, Sábado = 5 linhas, Domingo = 0 linhas
function prePopulateMonth() {
    // Limpar dados
    encomendasData.dates = [];
    encomendasData.data = {};
    
    const monthIndex = {
        'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
        'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11
    }[currentMonth];
    
    const firstDay = new Date(currentYear, monthIndex, 1);
    const lastDay = new Date(currentYear, monthIndex + 1, 0);
    
    let totalLines = 0;
    let dayCount = 0;
    
    console.log(`📅 Pré-populando ${currentMonth}/${currentYear}...`);
    console.log(`   Primeiro dia: ${firstDay.toLocaleDateString()}`);
    console.log(`   Último dia: ${lastDay.toLocaleDateString()}`);
    
    // Iterar por todos os dias do mês
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
        const dateStr = `${String(d.getDate()).padStart(2, '0')}/${currentMonth}`;
        const weekNum = getWeekNumber(d);
        const dayOfWeek = d.getDay(); // 0=Domingo, 1=Segunda, ..., 6=Sábado
        
        // Determinar número de linhas baseado no dia da semana
        let numLines = 0;
        if (dayOfWeek === 0) {
            // Domingo: 0 linhas (não criar nada)
            numLines = 0;
        } else if (dayOfWeek === 6) {
            // Sábado: 5 linhas
            numLines = 5;
        } else {
            // Segunda a Sexta: 20 linhas
            numLines = 20;
        }
        
        if (numLines > 0) {
            dayCount++;
        }
        
        // Criar linhas para este dia
        for (let i = 0; i < numLines; i++) {
            const index = encomendasData.dates.length;
            encomendasData.dates.push(dateStr);
            
            // Pré-preencher semana
            const semKey = `${index}_sem`;
            encomendasData.data[semKey] = weekNum.toString();
        }
        
        totalLines += numLines;
    }
    
    console.log(`✅ Mês pré-populado: ${totalLines} linhas total em ${dayCount} dias`);
    console.log(`   📅 Estrutura: Seg-Sex (20 linhas) + Sáb (5 linhas) + Dom (0 linhas)`);
}

// Pré-popular uma semana com dias + 20 linhas/dia
function prePopulateWeek(weekNumber) {
    // Encontrar todos os dias do ano que pertencem a essa semana
    const monthIndex = {
        'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
        'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11
    }[currentMonth];
    
    const firstDay = new Date(currentYear, monthIndex, 1);
    const lastDay = new Date(currentYear, monthIndex + 1, 0);
    
    const daysInWeek = [];
    
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
        if (getWeekNumber(d) === weekNumber) {
            daysInWeek.push(new Date(d));
        }
    }
    
    // Para cada dia, adicionar linhas baseado no dia da semana
    daysInWeek.forEach(date => {
        const dateStr = `${String(date.getDate()).padStart(2, '0')}/${currentMonth}`;
        const dayOfWeek = date.getDay(); // 0=Domingo, 1=Segunda, ..., 6=Sábado
        
        // Determinar número de linhas
        let numLines = 0;
        if (dayOfWeek === 0) {
            numLines = 0; // Domingo
        } else if (dayOfWeek === 6) {
            numLines = 5; // Sábado
        } else {
            numLines = 20; // Segunda a Sexta
        }
        
        for (let i = 0; i < numLines; i++) {
            encomendasData.dates.push(dateStr);
        }
    });
    
    console.log(`📅 Pré-populada semana ${weekNumber} com ${daysInWeek.length} dias (Seg-Sex: 20, Sáb: 5, Dom: 0)`);
}

// Filtrar dados apenas da semana ativa
function getWeekData() {
    if (!currentWeek) return encomendasData;
    
    const filtered = {
        fields: encomendasData.fields,
        dates: [],
        data: {}
    };
    
    // Filtrar apenas datas que pertencem à semana ativa
    encomendasData.dates.forEach((date, index) => {
        const weekNum = getWeekNumberFromDateStr(date);
        
        if (weekNum === currentWeek) {
            filtered.dates.push(date);
            
            // Copiar dados das células
            encomendasData.fields.forEach(field => {
                const cellKey = `${index}_${field.key}`;
                if (encomendasData.data[cellKey]) {
                    const newIndex = filtered.dates.length - 1;
                    const newKey = `${newIndex}_${field.key}`;
                    filtered.data[newKey] = encomendasData.data[cellKey];
                }
            });
        }
    });
    
    return filtered;
}

// Obter número da semana a partir de string de data (ex: "05/mar")
function getWeekNumberFromDateStr(dateStr) {
    const [day, monthAbbr] = dateStr.split('/');
    
    const monthIndex = {
        'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
        'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11
    }[monthAbbr];
    
    const date = new Date(currentYear, monthIndex, parseInt(day));
    
    return getWeekNumber(date);
}

// Obter número da semana de um Date object (ISO 8601)
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}

// Adicionar linha de sub-total no final de cada dia
function addSubtotalRow(tbody, date, total, rowIndex) {
    const tr = document.createElement('tr');
    tr.className = 'excel-subtotal-row';
    
    // Encontrar índice da coluna QTD
    const qtdFieldIndex = encomendasData.fields.findIndex(f => f.key === 'qtd');
    
    // Se não há coluna QTD, não adicionar sub-total
    if (qtdFieldIndex === -1) return;
    
    // Criar células até chegar à coluna QTD
    // Primeira célula: Data (label sub-total)
    const dateTh = document.createElement('th');
    dateTh.className = 'excel-subtotal-label';
    dateTh.textContent = `━━ Sub-total ━━`;
    dateTh.style.textAlign = 'center';
    dateTh.style.color = '#4472C4';
    dateTh.style.fontWeight = '700';
    dateTh.style.background = '#F5F5F7';
    dateTh.style.borderTop = '2px solid #4472C4';
    tr.appendChild(dateTh);
    
    // Células vazias até QTD
    encomendasData.fields.forEach((field, index) => {
        const td = document.createElement('td');
        td.className = 'excel-subtotal-cell';
        td.style.background = '#F5F5F7';
        td.style.borderTop = '2px solid #4472C4';
        
        if (field.key === 'qtd') {
            // Célula QTD: mostrar total
            td.className = 'excel-subtotal-value';
            td.textContent = total;
            td.style.background = '#E7E6E6';
            td.style.color = '#1D1D1F';
            td.style.fontWeight = '700';
            td.style.fontSize = '13px';
            td.style.textAlign = 'center';
        } else {
            // Células vazias
            td.textContent = '';
        }
        
        tr.appendChild(td);
    });
    
    tbody.appendChild(tr);
}

// Adicionar linha de sub-total por semana
// Função para adicionar linha de espaçamento vazia
function addSpacerRow(tbody) {
    const spacerRow = document.createElement('tr');
    spacerRow.className = 'excel-spacer-row';
    spacerRow.style.height = '8px';
    spacerRow.style.background = 'transparent';
    spacerRow.style.border = 'none';
    
    const spacerTd = document.createElement('td');
    spacerTd.colSpan = encomendasData.fields.length + 1;
    spacerTd.style.border = 'none';
    spacerTd.style.background = 'transparent';
    spacerRow.appendChild(spacerTd);
    
    tbody.appendChild(spacerRow);
}

// Função para adicionar subtotal por DIA
function addDaySubtotal(tbody, dateStr, rowCount, qtdSum) {
    const subtotalRow = document.createElement('tr');
    subtotalRow.className = 'excel-day-subtotal';
    subtotalRow.style.background = '#E2EFDA';
    subtotalRow.style.fontWeight = '600';
    subtotalRow.style.borderTop = '1px solid #A0C4E8';
    subtotalRow.style.borderBottom = '1px solid #A0C4E8';
    
    // Primeira célula: Label "📅 01/mar"
    const labelTh = document.createElement('th');
    labelTh.style.background = '#E2EFDA';
    labelTh.style.color = '#2F5233';
    labelTh.style.fontWeight = '700';
    labelTh.style.padding = '8px 12px';
    labelTh.style.textAlign = 'center';
    labelTh.style.fontSize = '11px';
    labelTh.textContent = `📅 ${dateStr}`;
    subtotalRow.appendChild(labelTh);
    
    // Outras células: mostrar contador e soma
    encomendasData.fields.forEach(field => {
        const td = document.createElement('td');
        td.className = 'excel-subtotal-cell';
        td.style.background = '#E2EFDA';
        td.style.fontWeight = '600';
        td.style.fontSize = '11px';
        td.style.textAlign = 'center';
        td.style.padding = '6px';
        td.style.border = '1px solid #A0C4E8';
        
        if (field.key === 'transp') {
            // Coluna TRANSP: mostrar contador de cargas
            td.textContent = `${rowCount} cargas`;
            td.style.color = '#0066CC';
            td.style.fontWeight = '600';
        } else if (field.key === 'qtd') {
            // Coluna QTD: mostrar soma
            td.textContent = qtdSum.toFixed(0);
            td.style.color = '#0066CC';
            td.style.fontWeight = '700';
            td.style.fontSize = '12px';
        } else {
            // Outras colunas: vazio
            td.textContent = '';
        }
        
        subtotalRow.appendChild(td);
    });
    
    tbody.appendChild(subtotalRow);
}

function addWeekSubtotal(tbody, weekNum, rowCount, qtdSum) {
    const subtotalRow = document.createElement('tr');
    subtotalRow.className = 'excel-week-subtotal';
    subtotalRow.style.background = '#E2EFDA';
    subtotalRow.style.fontWeight = '600';
    subtotalRow.style.borderTop = '2px solid #4472C4';
    subtotalRow.style.borderBottom = '2px solid #4472C4';
    
    // Primeira célula: Label "Sub-total Semana X"
    const labelTh = document.createElement('th');
    labelTh.style.background = '#E2EFDA';
    labelTh.style.color = '#2F5233';
    labelTh.style.fontWeight = '700';
    labelTh.style.padding = '10px 12px';
    labelTh.style.textAlign = 'center';
    labelTh.style.fontSize = '12px';
    labelTh.textContent = `📊 Semana ${weekNum}`;
    subtotalRow.appendChild(labelTh);
    
    // Outras células: mostrar contador e soma
    encomendasData.fields.forEach(field => {
        const td = document.createElement('td');
        td.className = 'excel-subtotal-cell';
        td.style.background = '#E2EFDA';
        td.style.fontWeight = '600';
        td.style.fontSize = '12px';
        td.style.textAlign = 'center';
        td.style.padding = '8px';
        td.style.border = '1px solid #A0C4E8';
        
        if (field.key === 'transp') {
            // Coluna TRANSP: mostrar contador de cargas
            td.textContent = `${rowCount} cargas`;
            td.style.color = '#0066CC';
            td.style.fontWeight = '600';
        } else if (field.key === 'qtd') {
            // Coluna QTD: mostrar soma
            td.textContent = qtdSum.toFixed(0);
            td.style.color = '#0066CC';
            td.style.fontWeight = '700';
            td.style.fontSize = '13px';
        } else {
            // Outras colunas: vazio
            td.textContent = '';
        }
        
        subtotalRow.appendChild(td);
    });
    
    tbody.appendChild(subtotalRow);
}

function renderEncomendasGrid() {
    try {
        const table = document.getElementById('encomendas-grid');
        if (!table) {
            console.error('❌ Elemento #encomendas-grid não encontrado!');
            return;
        }
        
        // Ativar proteções para uso prolongado (primeira vez apenas)
        if (!autoSaveInterval) {
            startAutoSave();
            setupBeforeUnloadProtection();
            
            // Verificar inatividade a cada 1 minuto
            setInterval(checkInactivity, 60000);
            
            // Rastrear atividade do utilizador
            document.addEventListener('keydown', trackActivity);
            document.addEventListener('click', trackActivity);
            document.addEventListener('scroll', trackActivity);
        }
        
        // Filtrar dados pela semana ativa (se houver)
        let datesToRender = encomendasData.dates;
        let dataToRender = encomendasData.data;
        
        // 🔥 v2.51.27: Resetar mapeamento global
        encomendasIndexMapping = [];
        
        if (currentWeek !== null) {
            console.log(`📊 Filtrando dados pela semana ${currentWeek}`);
            
            const filtered = [];
            const filteredData = {};
            
            encomendasData.dates.forEach((date, originalIndex) => {
                const weekNum = getWeekNumberFromDateStr(date);
                
                if (weekNum === currentWeek) {
                    const newIndex = filtered.length;
                    filtered.push(date);
                    encomendasIndexMapping.push(originalIndex);  // 🔥 Guardar no array global
                    
                    // Copiar dados desta linha
                    encomendasData.fields.forEach(field => {
                        const oldKey = `${originalIndex}_${field.key}`;
                        const newKey = `${newIndex}_${field.key}`;
                        if (encomendasData.data[oldKey]) {
                            filteredData[newKey] = encomendasData.data[oldKey];
                        }
                    });
                }
            });
            
            datesToRender = filtered;
            dataToRender = filteredData;
            
            console.log(`   ✅ Filtrado: ${datesToRender.length} linhas da semana ${currentWeek}`);
        } else {
            // Sem filtro: mapeamento 1:1
            encomendasIndexMapping = datesToRender.map((_, i) => i);
        }
        
        console.log(`📊 Renderizando grid:`, {
            dates: datesToRender.length,
            fields: encomendasData.fields.length,
            data: Object.keys(dataToRender).length
        });
        
        if (!datesToRender || datesToRender.length === 0) {
            console.warn('⚠️ Nenhuma data para renderizar!');
            table.innerHTML = '<tbody><tr><td colspan="10" style="text-align:center;padding:40px;">Nenhum dado disponível para esta semana</td></tr></tbody>';
            return;
        }
        
        table.innerHTML = '';
    
    // HEADER: Campos nas COLUNAS
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    // Primeira célula: "Data"
    const dateTh = document.createElement('th');
    dateTh.className = 'excel-header-corner';
    dateTh.textContent = 'Data';
    dateTh.style.background = '#BFBFBF';
    dateTh.style.color = 'white';
    dateTh.style.fontWeight = '700';
    dateTh.style.position = 'sticky';
    dateTh.style.top = '0';
    dateTh.style.zIndex = '100';
    headerRow.appendChild(dateTh);
    
    // Cabeçalhos de campos (colunas)
    encomendasData.fields.forEach(field => {
        const th = document.createElement('th');
        th.className = 'excel-field-header';
        th.textContent = field.label;
        th.style.background = '#BFBFBF';
        th.style.color = 'white';
        th.style.fontWeight = '700';
        th.style.textAlign = 'center';
        th.style.padding = '10px 12px';
        th.style.position = 'sticky';
        th.style.top = '0';
        th.style.zIndex = '100';
        th.style.minWidth = field.width || '120px';
        th.style.fontSize = '11px';
        th.style.whiteSpace = 'nowrap';
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // BODY: Datas nas LINHAS
    const tbody = document.createElement('tbody');
    
    // Variáveis para sub-total por semana e por dia
    let currentWeekNum = null;
    let weekRowCount = 0;
    let weekQtdSum = 0;
    
    let currentDate = null;
    let dayRowCount = 0;
    let dayQtdSum = 0;
    
    datesToRender.forEach((date, index) => {
        const weekNum = getWeekNumberFromDateStr(date);
        
        // Se mudou de DIA, adicionar sub-total do dia anterior
        if (currentDate !== null && date !== currentDate) {
            addDaySubtotal(tbody, currentDate, dayRowCount, dayQtdSum);
            addSpacerRow(tbody);
            dayRowCount = 0;
            dayQtdSum = 0;
        }
        
        // Se mudou de semana, adicionar sub-total da semana anterior
        if (currentWeekNum !== null && weekNum !== currentWeekNum) {
            addSpacerRow(tbody);
            addWeekSubtotal(tbody, currentWeekNum, weekRowCount, weekQtdSum);
            addSpacerRow(tbody);
            weekRowCount = 0;
            weekQtdSum = 0;
        }
        
        currentWeekNum = weekNum;
        currentDate = date;
        
        const tr = document.createElement('tr');
        tr.className = 'excel-row';
        tr.setAttribute('data-row-index', index);  // Para identificar linha no Realtime
        
        // Label da data (primeira coluna) com botão de delete
        const dateTh = document.createElement('th');
        dateTh.className = 'excel-date-label';
        dateTh.style.background = 'white';
        dateTh.style.fontWeight = '600';
        dateTh.style.padding = '8px 12px';
        dateTh.style.textAlign = 'center';
        dateTh.style.fontSize = '12px';
        dateTh.style.minWidth = '100px';
        dateTh.style.position = 'relative';
        
        // Botão de inserir (hover) - NOVO
        const insertBtn = document.createElement('button');
        insertBtn.className = 'excel-row-insert';
        insertBtn.innerHTML = '+';
        insertBtn.title = 'Inserir linha abaixo';
        insertBtn.onclick = () => insertRowBelow(index);
        
        // Botão de delete (hover)
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'excel-row-delete';
        deleteBtn.innerHTML = '−';
        deleteBtn.title = 'Apagar linha';
        deleteBtn.onclick = () => deleteRow(index);
        
        const dateSpan = document.createElement('span');
        dateSpan.textContent = date;
        dateSpan.style.display = 'block';
        dateSpan.style.textAlign = 'center';
        dateSpan.style.width = '100%';
        
        dateTh.appendChild(insertBtn);  // NOVO: botão + primeiro
        dateTh.appendChild(deleteBtn);
        dateTh.appendChild(dateSpan);
        tr.appendChild(dateTh);
        
        // 🔥 BUGFIX v2.51.2 + v2.51.27: Obter o índice ORIGINAL antes de tudo
        const originalIndex = encomendasIndexMapping[index] || index;
        
        // Calcular semana automaticamente para a primeira célula (SEM)
        const weekNumber = getWeekNumberFromDateStr(date);
        const semCellKey = `${originalIndex}_sem`;  // 🔥 Usar originalIndex!
        if (!encomendasData.data[semCellKey]) {
            encomendasData.data[semCellKey] = weekNumber.toString();
        }
        
        // Células editáveis para cada campo
        encomendasData.fields.forEach(field => {
            const cellKey = `${originalIndex}_${field.key}`;  // 🔥 Usar originalIndex!
            const value = encomendasData.data[cellKey] || '';  // 🔥 Buscar em encomendasData.data, não dataToRender!
            
            const td = document.createElement('td');
            td.className = 'excel-cell';
            td.setAttribute('data-row-index', index);  // Index filtrado (display)
            td.setAttribute('data-original-index', originalIndex);  // Index global (save)
            td.setAttribute('data-date', date);
            td.setAttribute('data-field', field.key);
            td.style.background = field.color;
            td.style.border = '1px solid #D0D0D0';
            td.style.padding = field.type === 'select' ? '0' : '6px 8px';
            td.style.fontSize = '11px';
            td.style.minHeight = '28px';
            td.style.minWidth = field.width || '120px';
            
            // 🆕 v2.51.0: Renderizar SELECT para horario_carga
            if (field.type === 'select' && field.key === 'horario_carga') {
                td.contentEditable = 'false';
                const select = document.createElement('select');
                select.className = 'horario-select';
                select.style.width = '100%';
                select.style.height = '100%';
                select.style.border = 'none';
                select.style.background = field.color;
                select.style.padding = '6px 8px';
                select.style.fontSize = '11px';
                select.style.cursor = 'pointer';
                
                const options = [
                    { value: '', label: '--' },
                    { value: '06:00 - 08:00', label: '06:00 - 08:00' },
                    { value: '08:00 - 10:00', label: '08:00 - 10:00' },
                    { value: '10:00 - 12:00', label: '10:00 - 12:00' },
                    { value: '12:00 - 14:00', label: '12:00 - 14:00' },
                    { value: '14:00 - 16:00', label: '14:00 - 16:00' },
                    { value: '16:00 - 18:00', label: '16:00 - 18:00' },
                    { value: '18:00 - 20:00', label: '18:00 - 20:00' },
                    { value: 'Manhã', label: 'Manhã' },
                    { value: 'Tarde', label: 'Tarde' }
                ];
                
                options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt.value;
                    option.textContent = opt.label;
                    if (opt.value === value) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });
                
                select.addEventListener('change', () => {
                    const oldValue = encomendasData.data[cellKey] || '';
                    const newValue = select.value;
                    
                    if (oldValue !== newValue) {
                        encomendasData.data[cellKey] = newValue;
                        console.log('💾 Horário atualizado:', cellKey, '=', newValue);
                        
                        const originalIdx = parseInt(td.getAttribute('data-original-index'));
                        
                        logHistory('UPDATE', {
                            date: date,
                            field_name: field.key,
                            old_value: oldValue,
                            new_value: newValue,
                            row_order: originalIdx
                        });
                        
                        queueSave(originalIdx, field.key, newValue);
                    }
                });
                
                td.appendChild(select);
            } else {
                // Célula editável normal
                td.contentEditable = 'true';
                td.textContent = value;
                
                // Auto-save on blur
                td.addEventListener('blur', () => {
                    const oldValue = encomendasData.data[cellKey] || '';
                    const newValue = td.textContent.trim();
                    
                    if (oldValue !== newValue) {
                        encomendasData.data[cellKey] = newValue;
                        console.log('💾 Atualizado:', cellKey, '=', newValue);
                        
                        const originalIdx = parseInt(td.getAttribute('data-original-index'));
                        
                        // Registar no histórico
                        logHistory('UPDATE', {
                            date: date,
                            field_name: field.key,
                            old_value: oldValue,
                            new_value: newValue,
                            row_order: originalIdx  // Usar índice original
                        });
                        
                        // NOVO: Adicionar à fila de saves (com debouncing) - USAR ÍNDICE ORIGINAL
                        queueSave(originalIdx, field.key, newValue);
                    }
                });
            }
            
            // Foco visual + tracking de presença
            td.addEventListener('focus', () => {
                td.style.outline = '2px solid #007AFF';
                td.style.outlineOffset = '-2px';
                
                // 👥 FASE 3: Notificar outros utilizadores que estou a editar esta célula
                updateMyActiveCell(index, field.key);
            });
            
            td.addEventListener('blur', () => {
                td.style.outline = 'none';
                
                // 👥 FASE 3: Limpar indicador de célula ativa
                clearMyActiveCell();
            });
            
            // ⌨️ NAVEGAÇÃO COM SETAS (estilo Excel)
            td.addEventListener('keydown', (e) => {
                // Permitir navegação com setas
                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab'].includes(e.key)) {
                    e.preventDefault();
                    
                    const currentRow = parseInt(td.getAttribute('data-row-index'));
                    const currentField = td.getAttribute('data-field');
                    const currentFieldIndex = encomendasData.fields.findIndex(f => f.key === currentField);
                    
                    let nextRow = currentRow;
                    let nextFieldIndex = currentFieldIndex;
                    
                    // Determinar próxima célula
                    if (e.key === 'ArrowUp') {
                        nextRow = Math.max(0, currentRow - 1);
                    } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
                        nextRow = Math.min(datesToRender.length - 1, currentRow + 1);
                    } else if (e.key === 'ArrowLeft') {
                        nextFieldIndex = Math.max(0, currentFieldIndex - 1);
                    } else if (e.key === 'ArrowRight' || e.key === 'Tab') {
                        nextFieldIndex = Math.min(encomendasData.fields.length - 1, currentFieldIndex + 1);
                    }
                    
                    // Encontrar e focar na próxima célula
                    const nextField = encomendasData.fields[nextFieldIndex];
                    const nextCell = document.querySelector(
                        `.excel-cell[data-row-index="${nextRow}"][data-field="${nextField.key}"]`
                    );
                    
                    if (nextCell) {
                        nextCell.focus();
                        // Selecionar todo o texto (estilo Excel)
                        const range = document.createRange();
                        range.selectNodeContents(nextCell);
                        const sel = window.getSelection();
                        sel.removeAllRanges();
                        sel.addRange(range);
                    }
                }
            });
            
            // Contar para sub-total se campo é QTD
            if (field.key === 'qtd' && value) {
                const qtdValue = parseFloat(value) || 0;
                weekQtdSum += qtdValue;
                dayQtdSum += qtdValue;
            }
            
            tr.appendChild(td);
        });
        
        // Contar linha preenchida APENAS se campo LOCAL estiver preenchido
        const localCellKey = `${index}_local`;
        const hasLocal = dataToRender[localCellKey] && dataToRender[localCellKey].trim() !== '';
        
        if (hasLocal) {
            weekRowCount++;
            dayRowCount++;
        }
        
        tbody.appendChild(tr);
    });
    
    // Adicionar sub-total do último dia
    if (currentDate !== null && dayRowCount > 0) {
        addDaySubtotal(tbody, currentDate, dayRowCount, dayQtdSum);
        addSpacerRow(tbody);
    }
    
    // Adicionar sub-total da última semana
    if (currentWeekNum !== null) {
        addSpacerRow(tbody);
        addWeekSubtotal(tbody, currentWeekNum, weekRowCount, weekQtdSum);
        addSpacerRow(tbody);
    }
    
    // Adicionar linha especial com botão "+" no final
    const addRow = document.createElement('tr');
    addRow.className = 'excel-add-row';
    
    const addTh = document.createElement('th');
    addTh.colSpan = 1;
    addTh.style.textAlign = 'center';
    addTh.style.padding = '8px';
    addTh.style.background = '#F9F9F9';
    
    const addBtn = document.createElement('button');
    addBtn.className = 'excel-row-add';
    addBtn.innerHTML = '+';
    addBtn.title = 'Adicionar linha';
    addBtn.onclick = addNewRow;
    
    addTh.appendChild(addBtn);
    addRow.appendChild(addTh);
    
    // Células vazias para as outras colunas
    encomendasData.fields.forEach(() => {
        const emptyTd = document.createElement('td');
        emptyTd.style.background = '#F9F9F9';
        emptyTd.style.border = '1px solid #D0D0D0';
        addRow.appendChild(emptyTd);
    });
    
    tbody.appendChild(addRow);
    
    table.appendChild(tbody);
    
    console.log('✅ Grid renderizado com sucesso!');
    
    } catch (error) {
        console.error('❌ ERRO ao renderizar grid:', error);
        console.error('Stack trace:', error.stack);
        
        // Mostrar erro na interface
        const table = document.getElementById('encomendas-grid');
        if (table) {
            table.innerHTML = `
                <tbody>
                    <tr>
                        <td colspan="10" style="text-align:center;padding:40px;color:#DC3545;">
                            <strong>❌ Erro ao carregar dados</strong><br>
                            ${error.message}<br>
                            <small>Verifique o console (F12) para mais detalhes</small>
                        </td>
                    </tr>
                </tbody>
            `;
        }
    }
}

// Carregar dados do mês da BD
async function loadEncomendasData() {
    console.log('📥 Carregando encomendas para:', currentMonth + '/' + currentYear);
    
    // 🔥 v2.51.21: Atualizar dropdown do mês para o mês atual
    const monthSelector = document.getElementById('month-selector');
    if (monthSelector && monthSelector.value !== currentMonth) {
        monthSelector.value = currentMonth;
        console.log(`📅 Dropdown atualizado para: ${currentMonth}`);
    }
    
    try {
        const { data, error } = await db
            .from('mapa_encomendas')
            .select('*')
            .eq('month', currentMonth)
            .eq('year', currentYear);
        
        if (error) {
            console.warn('⚠️ Erro ao carregar da BD:', error);
            throw error;
        }
        
        if (data && data.length > 0) {
            console.log(`✅ Carregados ${data.length} registros da BD`);
            
            // Ordenar por row_order
            data.sort((a, b) => a.row_order - b.row_order);
            
            // Reconstruir dates e data
            encomendasData.dates = [];
            encomendasData.data = {};
            
            data.forEach((row) => {
                // 🔥 BUGFIX v2.51.1: Usar row.row_order (índice original da BD) em vez de rowIndex (índice do array filtrado)
                const originalIndex = row.row_order;
                
                // Expandir array se necessário (caso haja gaps nos row_order)
                while (encomendasData.dates.length <= originalIndex) {
                    encomendasData.dates.push('');
                }
                
                encomendasData.dates[originalIndex] = row.date;
                
                // Carregar dados das células usando o ÍNDICE ORIGINAL
                encomendasData.fields.forEach(field => {
                    const cellKey = `${originalIndex}_${field.key}`;
                    if (row[field.key]) {
                        encomendasData.data[cellKey] = row[field.key];
                    }
                });
            });
        } else {
            console.log('📅 Mês vazio. Pré-populando com estrutura completa...');
            
            // Pré-popular o mês com estrutura completa
            prePopulateMonth();
            
            console.log(`📊 Total de linhas geradas: ${encomendasData.dates.length}`);
            console.log(`📊 Primeira data: ${encomendasData.dates[0]}, Última data: ${encomendasData.dates[encomendasData.dates.length - 1]}`);
            
            // Salvar no Supabase
            await saveAllRows();
            
            console.log('✅ Pré-população concluída e salva na BD');
        }
        
    } catch (error) {
        console.error('❌ Erro fatal ao carregar:', error);
        
        // Fallback: dados mínimos
        encomendasData.dates = ['01/' + currentMonth, '01/' + currentMonth, '01/' + currentMonth];
        encomendasData.data = {
            '0_sem': '10',
            '1_sem': '10', 
            '2_sem': '10'
        };
    }
    
    // SEMPRE renderizar (mesmo com erro)
    console.log(`📊 Renderizando grid com ${encomendasData.dates.length} linhas`);
    
    try {
        generateWeekTabs();
    } catch (e) {
        console.error('❌ Erro ao gerar tabs:', e);
    }
    
    try {
        renderEncomendasGrid();
    } catch (e) {
        console.error('❌ Erro ao renderizar grid:', e);
    }
}

// ===================================================================
// FASE 1: SAVE POR LINHA COM DEBOUNCING
// ===================================================================

// Adicionar alteração à fila de saves (com debouncing)
function queueSave(rowIndex, fieldKey, value) {
    // Obter dados existentes da linha ou criar novo objeto
    if (!saveQueue.has(rowIndex)) {
        saveQueue.set(rowIndex, { fields: {}, timestamp: Date.now() });
    }
    
    const rowData = saveQueue.get(rowIndex);
    rowData.fields[fieldKey] = value;
    rowData.timestamp = Date.now();
    
    console.log('📦 Adicionado à fila:', `linha ${rowIndex}, campo ${fieldKey}`);
    
    // Atualizar indicador visual
    updatePendingChangesIndicator();
    
    // Debounce: esperar 1 segundo de inatividade antes de processar
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        processSaveQueue();
    }, SAVE_DEBOUNCE_MS);
}

// Processar fila de saves (salvar todas as linhas pendentes)
async function processSaveQueue() {
    if (saveQueue.size === 0 || isSaving) return;
    
    isSaving = true;
    const rowsToSave = Array.from(saveQueue.entries());
    saveQueue.clear(); // Limpar fila imediatamente
    
    console.log('💾 Processando fila:', rowsToSave.length, 'linha(s)');
    
    try {
        // Salvar cada linha
        for (const [rowIndex, rowData] of rowsToSave) {
            await saveRowData(rowIndex, rowData.fields);
        }
        
        showToast(`✅ ${rowsToSave.length} linha(s) salva(s) no Supabase`, 'success');
    } catch (error) {
        console.error('❌ Erro ao processar fila:', error);
        showToast('❌ Erro ao salvar. Dados mantidos em memória.', 'error');
        
        // Re-adicionar à fila em caso de erro
        rowsToSave.forEach(([rowIndex, rowData]) => {
            saveQueue.set(rowIndex, rowData);
        });
    } finally {
        isSaving = false;
        // Atualizar indicador visual
        updatePendingChangesIndicator();
    }
}

// Salvar dados de UMA linha específica (UPSERT)
async function saveRowData(originalRowIndex, fields) {
    try {
        // 🔥 v2.51.0: BUGFIX - rowIndex é o índice ORIGINAL (não o filtrado)
        // Precisamos obter a data pelo índice original
        const date = encomendasData.dates[originalRowIndex];
        
        if (!date) {
            console.warn('⚠️ Linha', originalRowIndex, 'não existe nos dados');
            console.warn('   Total de dates:', encomendasData.dates.length);
            return;
        }
        
        console.log(`💾 Salvando linha ${originalRowIndex}: data=${date}, fields=`, fields);
        
        // 1. Verificar se linha já existe
        const { data: existing, error: selectError } = await db
            .from('mapa_encomendas')
            .select('id')
            .eq('month', currentMonth)
            .eq('year', currentYear)
            .eq('row_order', originalRowIndex)
            .maybeSingle();
        
        if (selectError) {
            console.error('❌ Erro ao verificar linha:', selectError);
            throw selectError;
        }
        
        // Preparar dados para salvar
        const rowData = {
            month: currentMonth,
            year: currentYear,
            date: date,
            row_order: originalRowIndex,
            updated_at: new Date().toISOString(),
            ...fields
        };
        
        // 🔥 TEMPORÁRIO v2.51.1: Remover horario_carga se causar erro 400
        // (coluna ainda não existe na BD - precisa executar SQL)
        if (rowData.horario_carga !== undefined) {
            console.log('⚠️ Campo horario_carga detectado. Se houver erro 400, execute o SQL: ALTER TABLE mapa_encomendas ADD COLUMN horario_carga TEXT;');
        }
        
        if (existing) {
            // 2. UPDATE linha existente
            let { error: updateError } = await db
                .from('mapa_encomendas')
                .update(rowData)
                .eq('id', existing.id);
            
            // 🔥 RETRY sem horario_carga se erro 400 (coluna não existe)
            if (updateError && updateError.code === 'PGRST204' && rowData.horario_carga !== undefined) {
                console.warn('⚠️ Coluna horario_carga não existe. Tentando salvar sem ela...');
                delete rowData.horario_carga;
                const retry = await db
                    .from('mapa_encomendas')
                    .update(rowData)
                    .eq('id', existing.id);
                updateError = retry.error;
            }
            
            if (updateError) {
                console.error('❌ Erro ao atualizar linha:', updateError);
                throw updateError;
            }
            
            console.log('✅ Linha', originalRowIndex, 'atualizada (data:', date, ')');
        } else {
            // 3. INSERT linha nova
            let { error: insertError } = await db
                .from('mapa_encomendas')
                .insert([rowData]);
            
            // 🔥 RETRY sem horario_carga se erro 400 (coluna não existe)
            if (insertError && insertError.code === 'PGRST204' && rowData.horario_carga !== undefined) {
                console.warn('⚠️ Coluna horario_carga não existe. Tentando salvar sem ela...');
                delete rowData.horario_carga;
                const retry = await db
                    .from('mapa_encomendas')
                    .insert([rowData]);
                insertError = retry.error;
            }
            
            if (insertError) {
                console.error('❌ Erro ao inserir linha:', insertError);
                throw insertError;
            }
            
            console.log('✅ Linha', originalRowIndex, 'inserida (data:', date, ')');
        }
    } catch (error) {
        console.error('❌ Erro em saveRowData:', error);
        throw error;
    }
}

// ===================================================================
// PROTEÇÕES PARA USO PROLONGADO
// ===================================================================

// Auto-save periódico (força save a cada 30 segundos se houver mudanças pendentes)
function startAutoSave() {
    if (autoSaveInterval) return; // Já está rodando
    
    autoSaveInterval = setInterval(() => {
        if (saveQueue.size > 0) {
            console.log('🔄 Auto-save: Salvando mudanças pendentes...');
            processSaveQueue();
        }
    }, AUTO_SAVE_INTERVAL_MS);
    
    console.log('✅ Auto-save ativado (a cada 30 segundos)');
}

function stopAutoSave() {
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
        autoSaveInterval = null;
        console.log('⏹️ Auto-save desativado');
    }
}

// Detectar inatividade (avisar utilizador após 5 min sem atividade)
function trackActivity() {
    lastActivityTime = Date.now();
}

function checkInactivity() {
    const inactiveTime = Date.now() - lastActivityTime;
    
    if (inactiveTime > INACTIVITY_WARNING_MS && saveQueue.size > 0) {
        console.warn('⚠️ Inativo há 5 minutos com mudanças pendentes!');
        // Forçar save imediato
        processSaveQueue();
        showToast('⚠️ Mudanças salvas automaticamente (inatividade detectada)', 'warning');
    }
}

// Avisar antes de fechar página se houver mudanças não salvas
function setupBeforeUnloadProtection() {
    window.addEventListener('beforeunload', (e) => {
        if (saveQueue.size > 0 || isSaving) {
            e.preventDefault();
            e.returnValue = 'Você tem mudanças não salvas. Deseja realmente sair?';
            return e.returnValue;
        }
    });
}

// Salvar tudo antes de trocar de tab
function setupTabSwitchProtection() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (saveQueue.size > 0) {
                e.preventDefault();
                e.stopPropagation();
                
                console.log('💾 Salvando mudanças antes de trocar de tab...');
                await processSaveQueue();
                
                // Agora pode trocar
                btn.click();
            }
        }, true); // useCapture = true para interceptar antes
    });
}

// Indicador visual de mudanças pendentes
function updatePendingChangesIndicator() {
    const badge = document.getElementById('badge-encomendas');
    if (badge) {
        if (saveQueue.size > 0) {
            badge.textContent = saveQueue.size;
            badge.style.display = 'inline-block';
            badge.style.background = '#FF9500'; // Laranja (pendente)
        } else {
            badge.style.display = 'none';
        }
    }
}

// Salvar todas as linhas (usado em operações que afetam múltiplas linhas)
async function saveAllRows() {
    console.log('💾 Salvando todas as linhas...');
    
    try {
        // 1. Apagar todas as linhas do mês atual
        const { error: deleteError } = await db
            .from('mapa_encomendas')
            .delete()
            .eq('month', currentMonth)
            .eq('year', currentYear);
        
        if (deleteError) {
            console.warn('⚠️ Erro ao deletar:', deleteError);
        }
        
        // 2. Preparar todas as linhas para inserir
        const rows = encomendasData.dates.map((date, index) => {
            const row = {
                month: currentMonth,
                year: currentYear,
                date: date,
                row_order: index
            };
            
            // Coletar dados de todas as células da linha
            encomendasData.fields.forEach(field => {
                const cellKey = `${index}_${field.key}`;
                row[field.key] = encomendasData.data[cellKey] || '';
            });
            
            return row;
        });
        
        // 3. Inserir todas as linhas
        if (rows.length > 0) {
            const { error: insertError } = await db
                .from('mapa_encomendas')
                .insert(rows);
            
            if (insertError) {
                console.error('❌ Erro ao inserir:', insertError);
                throw insertError;
            }
        }
        
        console.log('✅ Todas as linhas salvas no Supabase');
    } catch (error) {
        console.error('❌ Erro ao salvar todas as linhas:', error);
        throw error;
    }
}

// ===================================================================
// FUNÇÕES ANTIGAS (manter por compatibilidade)
// ===================================================================

// Salvar dados na BD (DEPRECADO - usar queueSave para edições individuais)
// Registar alteração no histórico
async function logHistory(actionType, details = {}) {
    if (!currentUser) return;
    
    try {
        const historyRecord = {
            timestamp: new Date().toISOString(),
            user_id: currentUser.id,
            user_email: currentUser.email,
            action_type: actionType,
            month: currentMonth,
            year: currentYear,
            date: details.date || '',
            field_name: details.field_name || '',
            old_value: details.old_value || '',
            new_value: details.new_value || '',
            row_order: details.row_order || 0,
            details: JSON.stringify(details)
        };
        
        const { error } = await db
            .from('mapa_encomendas_historico')
            .insert([historyRecord]);
        
        if (error) throw error;
        
        console.log('📝 Histórico registado:', actionType, details);
    } catch (error) {
        console.warn('⚠️ Erro ao registar histórico:', error);
    }
}

async function saveEncomendasData() {
    try {
        // Apagar dados antigos do mês usando Supabase
        const { error: deleteError } = await db
            .from('mapa_encomendas')
            .delete()
            .eq('month', currentMonth)
            .eq('year', currentYear);
        
        if (deleteError) {
            console.warn('⚠️ Erro ao deletar:', deleteError);
        }
        
        // Preparar linhas para inserir
        const rows = encomendasData.dates.map((date, index) => {
            const row = {
                month: currentMonth,
                year: currentYear,
                date: date,
                row_order: index
            };
            
            // Coletar dados das células usando INDEX
            encomendasData.fields.forEach(field => {
                const cellKey = `${index}_${field.key}`;  // USAR index
                row[field.key] = encomendasData.data[cellKey] || '';
            });
            
            return row;
        });
        
        // Inserir novas linhas usando Supabase diretamente
        console.log('💾 Salvando', rows.length, 'linhas no Supabase...');
        
        const { error } = await db
            .from('mapa_encomendas')
            .insert(rows);
        
        if (error) throw error;
        
        console.log('✅ Encomendas salvas no Supabase!');
    } catch (error) {
        console.error('❌ Erro ao salvar encomendas:', error);
        console.warn('💡 Dados mantidos em memória.');
    }
}

// ===================================================================
// FASE 2: SUPABASE REALTIME - SINCRONIZAÇÃO TEMPO REAL
// ===================================================================

// Configurar Realtime para o Mapa de Encomendas
function setupEncomendasRealtime() {
    // Cleanup: desconectar canal anterior se existir
    if (realtimeChannel) {
        console.log('🔌 Desconectando canal Realtime anterior...');
        db.removeChannel(realtimeChannel);
        realtimeChannel = null;
    }
    
    console.log('📡 Ativando Realtime para:', currentMonth, '/', currentYear);
    
    // Criar novo canal
    realtimeChannel = db.channel(`mapa-encomendas-${currentMonth}-${currentYear}`)
        .on('postgres_changes', 
            { 
                event: '*',  // Todos: INSERT, UPDATE, DELETE
                schema: 'public', 
                table: 'mapa_encomendas',
                filter: `month=eq.${currentMonth},year=eq.${currentYear}`
            }, 
            handleRealtimeChange
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                isRealtimeActive = true;
                console.log('✅ Realtime ativo!');
                showToast('📡 Sincronização em tempo real ativa', 'info');
            } else if (status === 'CHANNEL_ERROR') {
                console.error('❌ Erro ao conectar Realtime');
                isRealtimeActive = false;
            } else if (status === 'CLOSED') {
                isRealtimeActive = false;
                console.log('🔌 Realtime desconectado');
            }
        });
}

// Handler para alterações recebidas via Realtime
function handleRealtimeChange(payload) {
    console.log('📡 Alteração recebida:', payload.eventType, payload);
    
    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        const row = payload.new;
        const rowIndex = row.row_order;
        
        console.log('💾 Atualizando linha', rowIndex, 'localmente');
        
        // Atualizar dados locais
        if (!encomendasData.dates[rowIndex]) {
            encomendasData.dates[rowIndex] = row.date;
        } else {
            encomendasData.dates[rowIndex] = row.date;
        }
        
        // Atualizar células
        encomendasData.fields.forEach(field => {
            const cellKey = `${rowIndex}_${field.key}`;
            if (row[field.key] !== undefined) {
                encomendasData.data[cellKey] = row[field.key];
            }
        });
        
        // Atualizar visualmente apenas essa linha
        updateSingleRow(rowIndex);
        
        // Toast discreto (não mostrar se for a própria alteração)
        if (!isSaving) {
            showToast(`📡 Linha ${rowIndex + 1} atualizada por outro utilizador`, 'info');
        }
    }
    
    if (payload.eventType === 'DELETE') {
        console.log('📡 Linha apagada por outro utilizador');
        showToast('📡 Dados alterados. A recarregar...', 'warning');
        
        // Recarregar todos os dados
        setTimeout(() => {
            loadEncomendasData();
        }, 500);
    }
}

// Atualizar visualmente apenas UMA linha (performance otimizada)
function updateSingleRow(rowIndex) {
    const table = document.getElementById('encomendas-grid');
    if (!table) return;
    
    const rows = table.querySelectorAll('tbody tr.excel-row');
    const row = rows[rowIndex];
    
    if (!row) {
        console.warn('⚠️ Linha', rowIndex, 'não encontrada no DOM');
        return;
    }
    
    // Atualizar cada célula da linha
    const cells = row.querySelectorAll('.excel-cell');
    
    cells.forEach((cell, fieldIndex) => {
        const field = encomendasData.fields[fieldIndex];
        const cellKey = `${rowIndex}_${field.key}`;
        const newValue = encomendasData.data[cellKey] || '';
        
        // Só atualizar se:
        // 1. Valor mudou
        // 2. Utilizador NÃO está a editar essa célula neste momento
        if (cell.textContent !== newValue && document.activeElement !== cell) {
            cell.textContent = newValue;
            
            // Feedback visual: célula pisca verde
            const originalBackground = cell.style.background || field.color;
            
            cell.style.transition = 'background 0.5s ease';
            cell.style.background = '#90EE90';  // Verde claro
            
            setTimeout(() => {
                cell.style.background = originalBackground;
            }, 500);
        }
    });
}

// Desconectar Realtime (cleanup)
function disconnectRealtime() {
    if (realtimeChannel) {
        console.log('🔌 Desconectando Realtime...');
        db.removeChannel(realtimeChannel);
        realtimeChannel = null;
        isRealtimeActive = false;
    }
}

// ===================================================================
// FASE 3: SISTEMA DE PRESENÇA - Indicadores de Utilizadores
// ===================================================================

// Configurar canal de presença
function setupPresence() {
    if (!currentUser) {
        console.warn('⚠️ Sem utilizador - presença não ativada');
        return;
    }
    
    // Cleanup: remover canal anterior
    if (presenceChannel) {
        console.log('👥 Desconectando canal de presença anterior...');
        db.removeChannel(presenceChannel);
        presenceChannel = null;
    }
    
    console.log('👥 Ativando sistema de presença...');
    
    const userColor = getUserColor(currentUser.id);
    
    // Criar canal de presença
    presenceChannel = db.channel(`presence-mapa-encomendas-${currentMonth}-${currentYear}`, {
        config: {
            presence: {
                key: currentUser.id
            }
        }
    });
    
    // Estado inicial do utilizador
    myPresenceState = {
        user_id: currentUser.id,
        user_name: currentUser.email.split('@')[0], // Nome antes do @
        user_email: currentUser.email,
        color: userColor,
        active_cell: null, // {rowIndex, fieldKey}
        last_seen: new Date().toISOString()
    };
    
    // Track presence state (quem está online)
    presenceChannel.on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        console.log('👥 Presença sincronizada:', state);
        
        // Atualizar mapa de utilizadores online
        onlineUsers.clear();
        
        Object.entries(state).forEach(([userId, presences]) => {
            // Cada utilizador pode ter múltiplas presenças (múltiplas tabs)
            // Usar a primeira
            const presence = presences[0];
            if (presence && userId !== currentUser.id) {
                onlineUsers.set(userId, presence);
            }
        });
        
        console.log('👥 Utilizadores online:', onlineUsers.size);
        updateOnlineUsersList();
        updateCellIndicators();
    });
    
    // Join e track
    presenceChannel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('👋 Utilizador entrou:', key, newPresences);
        // showToast(`👋 ${newPresences[0].user_name} entrou`, 'info');  ← DESATIVADO: muito ruído
        updateOnlineUsersList();
    });
    
    presenceChannel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('👋 Utilizador saiu:', key, leftPresences);
        // showToast(`👋 ${leftPresences[0].user_name} saiu`, 'info');  ← DESATIVADO: muito ruído
        updateOnlineUsersList();
        updateCellIndicators();
    });
    
    // Subscribe e fazer track do estado
    presenceChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
            console.log('✅ Presença ativa!');
            
            // Enviar estado inicial
            await presenceChannel.track(myPresenceState);
            
            showToast('👥 Sistema de presença ativo', 'success');
        }
    });
}

// Atualizar célula ativa do utilizador atual
async function updateMyActiveCell(rowIndex, fieldKey) {
    if (!presenceChannel || !myPresenceState) return;
    
    currentActiveCell = { rowIndex, fieldKey };
    
    myPresenceState.active_cell = currentActiveCell;
    myPresenceState.last_seen = new Date().toISOString();
    
    try {
        await presenceChannel.track(myPresenceState);
        console.log('📍 Célula ativa atualizada:', rowIndex, fieldKey);
    } catch (error) {
        console.warn('⚠️ Erro ao atualizar presença:', error);
    }
}

// Limpar célula ativa (quando utilizador sai da célula)
async function clearMyActiveCell() {
    if (!presenceChannel || !myPresenceState) return;
    
    currentActiveCell = null;
    myPresenceState.active_cell = null;
    myPresenceState.last_seen = new Date().toISOString();
    
    try {
        await presenceChannel.track(myPresenceState);
        console.log('📍 Célula ativa limpa');
    } catch (error) {
        console.warn('⚠️ Erro ao limpar presença:', error);
    }
}

// Atualizar indicadores visuais nas células
function updateCellIndicators() {
    const table = document.getElementById('encomendas-grid');
    if (!table) return;
    
    // Limpar todos os indicadores anteriores
    table.querySelectorAll('.user-indicator').forEach(el => el.remove());
    table.querySelectorAll('.excel-cell').forEach(cell => {
        cell.style.boxShadow = '';
        cell.style.outline = '';
    });
    
    // Adicionar indicadores para cada utilizador online
    onlineUsers.forEach((presence, userId) => {
        if (!presence.active_cell) return;
        
        const { rowIndex, fieldKey } = presence.active_cell;
        
        // Encontrar a célula no DOM
        const rows = table.querySelectorAll('tbody tr.excel-row');
        const row = rows[rowIndex];
        if (!row) return;
        
        const fieldIndex = encomendasData.fields.findIndex(f => f.key === fieldKey);
        if (fieldIndex === -1) return;
        
        const cells = row.querySelectorAll('.excel-cell');
        const cell = cells[fieldIndex];
        if (!cell) return;
        
        // Adicionar borda colorida
        cell.style.outline = `3px solid ${presence.color}`;
        cell.style.outlineOffset = '-3px';
        cell.style.boxShadow = `0 0 8px ${presence.color}`;
        
        // Adicionar avatar/indicador
        const indicator = document.createElement('div');
        indicator.className = 'user-indicator';
        indicator.style.cssText = `
            position: absolute;
            top: -10px;
            right: -10px;
            width: 24px;
            height: 24px;
            background: ${presence.color};
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: bold;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            z-index: 100;
            pointer-events: none;
        `;
        
        // Iniciais do utilizador
        const initials = presence.user_name.substring(0, 2).toUpperCase();
        indicator.textContent = initials;
        indicator.title = `${presence.user_name} está a editar esta célula`;
        
        // Adicionar ao cell (que precisa de position: relative)
        cell.style.position = 'relative';
        cell.appendChild(indicator);
    });
}

// Atualizar lista de utilizadores online (no topo da página)
function updateOnlineUsersList() {
    let container = document.getElementById('online-users-container');
    
    // Criar container se não existir
    if (!container) {
        const encomendasTab = document.getElementById('tab-encomendas');
        if (!encomendasTab) return;
        
        container = document.createElement('div');
        container.id = 'online-users-container';
        container.style.cssText = `
            background: #F8F9FA;
            border: 1px solid #DEE2E6;
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
        `;
        
        // Inserir antes da primeira child do tab
        encomendasTab.insertBefore(container, encomendasTab.firstChild);
    }
    
    // Limpar conteúdo
    container.innerHTML = '';
    
    // Label
    const label = document.createElement('span');
    label.style.cssText = 'font-weight: 600; color: #495057;';
    label.textContent = '👥 Online:';
    container.appendChild(label);
    
    // Adicionar utilizador atual (eu)
    if (currentUser) {
        const myBadge = createUserBadge(
            currentUser.email.split('@')[0],
            getUserColor(currentUser.id),
            true // isMe
        );
        container.appendChild(myBadge);
    }
    
    // Adicionar outros utilizadores
    if (onlineUsers.size === 0) {
        const emptyMsg = document.createElement('span');
        emptyMsg.style.cssText = 'color: #6C757D; font-style: italic;';
        emptyMsg.textContent = 'Ninguém mais online';
        container.appendChild(emptyMsg);
    } else {
        onlineUsers.forEach((presence, userId) => {
            const badge = createUserBadge(presence.user_name, presence.color, false);
            container.appendChild(badge);
        });
    }
}

// Criar badge de utilizador
function createUserBadge(name, color, isMe) {
    const badge = document.createElement('div');
    badge.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        background: white;
        border: 2px solid ${color};
        border-radius: 20px;
        font-size: 13px;
        font-weight: 500;
        color: ${color};
        ${isMe ? 'box-shadow: 0 0 0 3px rgba(66, 133, 244, 0.1);' : ''}
    `;
    
    // Indicador de status (círculo verde)
    const dot = document.createElement('span');
    dot.style.cssText = `
        width: 8px;
        height: 8px;
        background: #34A853;
        border-radius: 50%;
        display: inline-block;
    `;
    
    badge.appendChild(dot);
    badge.appendChild(document.createTextNode(name + (isMe ? ' (você)' : '')));
    
    return badge;
}

// Desconectar presença (cleanup)
function disconnectPresence() {
    if (presenceChannel) {
        console.log('👥 Desconectando presença...');
        presenceChannel.untrack();
        db.removeChannel(presenceChannel);
        presenceChannel = null;
        onlineUsers.clear();
    }
}

// ===================================================================
// FUNÇÕES DE NAVEGAÇÃO E UTILITÁRIOS
// ===================================================================

// Mudar mês
async function changeMonth(newMonth) {
    console.log('📅 Mudando para mês:', newMonth);
    
    // Desconectar Realtime e Presença do mês anterior
    disconnectRealtime();
    disconnectPresence();
    
    currentMonth = newMonth;
    document.getElementById('month-selector').value = newMonth;
    await loadEncomendasData();
    
    // Reconectar Realtime e Presença para o novo mês
    setupEncomendasRealtime();
    setupPresence();
    
    showToast(`✅ Mês alterado: ${newMonth.toUpperCase()}`);
}

// Calcular número da semana (ISO 8601)
// Apagar linha específica
// Inserir nova linha logo abaixo da linha especificada
async function insertRowBelow(index) {
    // 🔥 v2.51.27: Converter índice visual para índice real
    const realIndex = encomendasIndexMapping[index] || index;
    const currentDate = encomendasData.dates[realIndex];
    
    console.log(`➕ Inserindo nova linha abaixo de ${currentDate} (índice visual: ${index}, real: ${realIndex})`);
    
    // 1. Inserir nova data no array (na posição realIndex + 1)
    encomendasData.dates.splice(realIndex + 1, 0, currentDate);
    
    // 2. Reconstruir o objeto data deslocando todos os índices após a inserção
    const newData = {};
    
    // Copiar dados antes da inserção (índices 0 até realIndex)
    for (let i = 0; i <= realIndex; i++) {
        encomendasData.fields.forEach(field => {
            const key = `${i}_${field.key}`;
            if (encomendasData.data[key] !== undefined) {
                newData[key] = encomendasData.data[key];
            }
        });
    }
    
    // Linha inserida (realIndex + 1) fica vazia, exceto o campo SEM (semana)
    const weekNum = getWeekNumberFromDateStr(currentDate);
    newData[`${realIndex + 1}_sem`] = weekNum.toString();
    
    // Copiar dados depois da inserção (deslocar índices +1)
    for (let i = realIndex + 1; i < encomendasData.dates.length - 1; i++) {
        encomendasData.fields.forEach(field => {
            const oldKey = `${i}_${field.key}`;
            const newKey = `${i + 1}_${field.key}`;
            if (encomendasData.data[oldKey] !== undefined) {
                newData[newKey] = encomendasData.data[oldKey];
            }
        });
    }
    
    encomendasData.data = newData;
    
    // 3. Re-renderizar grid
    renderEncomendasGrid();
    
    // 4. Salvar no Supabase (reindexar todas as linhas)
    await saveAllRows();
    
    // 5. Histórico
    logHistory('INSERT', { date: currentDate, row_order: realIndex + 1 });
    
    showToast(`✅ Nova linha inserida abaixo de ${currentDate}`, 'success');
}

async function deleteRow(index) {
    if (encomendasData.dates.length <= 1) {
        showToast('❌ Não pode apagar a última linha!', 'error');
        return;
    }
    
    // 🔥 v2.51.27: Converter índice visual para índice real
    const realIndex = encomendasIndexMapping[index] || index;
    const date = encomendasData.dates[realIndex];
    
    if (confirm(`Apagar linha ${date}?`)) {
        // Remover a data do array
        encomendasData.dates.splice(realIndex, 1);
        
        // Reconstruir o objeto data com novos índices
        const newData = {};
        encomendasData.dates.forEach((d, newIndex) => {
            encomendasData.fields.forEach(field => {
                const oldKey = `${newIndex >= realIndex ? newIndex + 1 : newIndex}_${field.key}`;
                const newKey = `${newIndex}_${field.key}`;
                if (encomendasData.data[oldKey]) {
                    newData[newKey] = encomendasData.data[oldKey];
                }
            });
        });
        
        encomendasData.data = newData;
        
        logHistory('DELETE', { date: date, row_order: realIndex });
        renderEncomendasGrid();
        
        // Salvar todas as linhas (necessário porque reindexamos)
        await saveAllRows();
        showToast(`✅ Linha ${date} apagada`);
    }
}

// ===================================================================
// CALENDÁRIO SEMANAL (v2.51.0)
// ===================================================================

let currentCalendarioWeek = null;
let currentDayOffset = 0; // 🔥 v2.51.16: Controla qual grupo de 3 dias mostrar (0=Seg-Qua, 1=Qui-Sex)

// 🔥 Função para normalizar formato de data
function normalizeDateFormat(dateStr) {
    if (!dateStr) return '';
    
    // Se já está em formato DD/MM (5 caracteres: "04/03")
    if (dateStr.length === 5 && dateStr.includes('/') && !isNaN(dateStr.split('/')[0]) && !isNaN(dateStr.split('/')[1])) {
        const [dd, mm] = dateStr.split('/');
        return `${dd.padStart(2, '0')}/${mm.padStart(2, '0')}`;
    }
    
    // Se está em formato DD/MMM (6+ caracteres: "04/mar")
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        const day = parts[0].padStart(2, '0');
        const monthPart = parts[1];
        
        // Mapear nome do mês para número
        const monthMap = {
            'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04',
            'mai': '05', 'jun': '06', 'jul': '07', 'ago': '08',
            'set': '09', 'out': '10', 'nov': '11', 'dez': '12'
        };
        
        // Se é nome de mês (ex: "mar")
        if (monthMap[monthPart.toLowerCase()]) {
            return `${day}/${monthMap[monthPart.toLowerCase()]}`;
        }
        
        // Se é número de mês (ex: "3")
        if (!isNaN(monthPart)) {
            return `${day}/${monthPart.padStart(2, '0')}`;
        }
    }
    
    // Fallback: retornar original
    return dateStr;
}

function renderCalendarioSemanal() {
    const container = document.getElementById('calendario-grid-container');
    if (!container) return;
    
    // 🔥 BUGFIX v2.51.6: Limpar container ANTES de tudo (prevenir duplicação em hot-reload)
    container.innerHTML = '<div style="padding:40px;text-align:center;color:#666;">⏳ Carregando...</div>';
    
    // 🔥 BUGFIX v2.51.5: Garantir que weekTabs está inicializado
    if (!weekTabs || weekTabs.length === 0) {
        console.warn('⚠️ weekTabs não inicializado! Gerando agora...');
        generateWeekTabs();
    }
    
    // 🔥 FEATURE v2.51.15: Determinar semana ATUAL (data de hoje) ao invés da primeira
    if (!currentCalendarioWeek && weekTabs.length > 0) {
        const today = new Date();
        const currentWeekNumber = getWeekNumber(today);
        
        // Se semana atual existe nas tabs, selecionar ela
        if (weekTabs.includes(currentWeekNumber)) {
            currentCalendarioWeek = currentWeekNumber;
            console.log(`📅 Semana ATUAL selecionada automaticamente no Mapa Cargas: Semana ${currentCalendarioWeek}`);
        } else {
            // Fallback: semana mais próxima (primeira disponível)
            currentCalendarioWeek = weekTabs[0];
            console.log(`⚠️ Semana atual (${currentWeekNumber}) não encontrada. Usando primeira: Semana ${currentCalendarioWeek}`);
        }
    }
    
    // Verificar se ainda está vazio
    if (!currentCalendarioWeek) {
        console.error('❌ Erro: currentCalendarioWeek ainda está vazio!');
        container.innerHTML = '<div style="padding:40px;text-align:center;color:#666;">⚠️ Erro ao carregar semanas. Recarregue a página.</div>';
        return;
    }
    
    // Atualizar número da semana no header
    const weekNumEl = document.getElementById('calendario-week-num');
    if (weekNumEl) {
        weekNumEl.textContent = currentCalendarioWeek;
    }
    
    // 🔥 BUGFIX v2.51.2: Filtrar apenas linhas com TRANSP preenchido da semana atual
    const cargas = [];
    const cargasSemTransp = []; // 🔥 v2.51.29: Rastrear cargas SEM transp
    
    encomendasData.dates.forEach((date, originalIndex) => {
        // Ignorar posições vazias (gaps no array)
        if (!date || date.trim() === '') return;
        
        const semana = encomendasData.data[`${originalIndex}_sem`];
        const transp = encomendasData.data[`${originalIndex}_transp`];
        const horario = encomendasData.data[`${originalIndex}_horario_carga`] || '';
        const cliente = encomendasData.data[`${originalIndex}_cliente`] || '';
        
        // 🔥 v2.51.29: Log cargas da semana SEM transp (para debug)
        if (parseInt(semana) === currentCalendarioWeek && (!transp || transp.trim() === '')) {
            cargasSemTransp.push({
                date: date,
                cliente: cliente,
                horario: horario,
                index: originalIndex
            });
        }
        
        // Filtrar por semana e TRANSP preenchido
        if (parseInt(semana) !== currentCalendarioWeek || !transp || transp.trim() === '') {
            return;
        }
        
        cargas.push({
            date: date,
            index: originalIndex,  // Índice original (não posição no array filtrado)
            cliente: cliente,
            local: encomendasData.data[`${originalIndex}_local`] || '',
            medida: encomendasData.data[`${originalIndex}_medida`] || '',
            qtd: encomendasData.data[`${originalIndex}_qtd`] || '',
            transp: transp,
            horario: horario,
            obs: encomendasData.data[`${originalIndex}_obs`] || ''
        });
    });
    
    console.log('\n' + '='.repeat(60));
    console.log(`📅 RENDER: Mapa Cargas - Semana ${currentCalendarioWeek}`);
    console.log('='.repeat(60));
    console.log(`   Total de dates no array: ${encomendasData.dates.length}`);
    console.log(`   Dates não vazias: ${encomendasData.dates.filter(d => d && d.trim() !== '').length}`);
    console.log(`   ✅ Cargas filtradas com TRANSP: ${cargas.length}`);
    console.log(`   ⚠️ Cargas SEM TRANSP (não aparecem): ${cargasSemTransp.length}`);
    
    // 🔥 v2.51.29: Mostrar cargas sem transp para debug
    if (cargasSemTransp.length > 0) {
        console.warn('\n   ⚠️ ATENÇÃO: Cargas sem TRANSP preenchido (NÃO APARECEM no Mapa):');
        cargasSemTransp.forEach((c, i) => {
            console.warn(`      ${i+1}. ${c.date} - ${c.cliente} - Horário: "${c.horario}"`);
        });
        console.warn('\n   💡 SOLUÇÃO: Preencher campo TRANSP no Mapa de Encomendas para estas cargas aparecerem!\n');
    }
    
    if (cargas.length > 0) {
        console.log(`\n   📦 Cargas que VÃO SER RENDERIZADAS:`);
        cargas.forEach((carga, i) => {
            console.log(`\n   [${i+1}] Carga:`);
            console.log(`      date: "${carga.date}" (${carga.date.length} chars)`);
            console.log(`      cliente: "${carga.cliente}"`);
            console.log(`      local: "${carga.local}"`);
            console.log(`      medida: "${carga.medida}"`);
            console.log(`      qtd: "${carga.qtd}"`);
            console.log(`      transp: "${carga.transp}"`);
            console.log(`      horario: "${carga.horario}" (length: ${carga.horario.length})`);
            
            // 🔍 DEBUG especial para CORK SUPPLY
            if (carga.cliente && carga.cliente.includes('CORK SUPPLY')) {
                console.log(`      🔍 CORK SUPPLY detectado!`);
                console.log(`         Local: "${carga.local}"`);
                console.log(`         Horário raw: [${Array.from(carga.horario).map(c => c.charCodeAt(0)).join(',')}]`);
            }
        });
    } else {
        console.warn('\n   ❌ PROBLEMA: Nenhuma carga passou o filtro!');
        console.warn('   Verificar:');
        console.warn('      1) Campo TRANSP está preenchido?');
        console.warn('      2) Campo SEM corresponde à semana atual?');
        console.warn(`      3) currentCalendarioWeek = ${currentCalendarioWeek}`);
    }
    
    // Construir array de seg-sex da semana
    const allWeekDates = getWeekDates(currentCalendarioWeek);
    
    // 🔥 v2.51.16: Mostrar apenas 3 dias por vez (navegação por grupos)
    // Grupo 0: Seg-Qua (0,1,2), Grupo 1: Qui-Sex (3,4)
    const startIdx = currentDayOffset * 3;
    const endIdx = Math.min(startIdx + 3, allWeekDates.length);
    const weekDates = allWeekDates.slice(startIdx, endIdx);
    
    console.log(`\n📅 Dias da semana ${currentCalendarioWeek} (todos):`, allWeekDates.map(d => d.dateStr));
    console.log(`📅 Exibindo dias ${startIdx}-${endIdx-1}:`, weekDates.map(d => d.dateStr));
    
    // 🔍 DEBUG: Verificar matching
    if (cargas.length > 0) {
        console.log(`\n🔍 MATCHING: Verificar se datas das cargas existem na semana:`);
        cargas.forEach(carga => {
            const normalized = normalizeDateFormat(carga.date);
            const found = weekDates.find(d => d.dateStr === normalized);
            
            if (normalized !== carga.date) {
                console.log(`   🔄 Normalizado: "${carga.date}" → "${normalized}"`);
            }
            
            if (found) {
                console.log(`   ✅ "${normalized}" encontrada → dia ${found.dayName}`);
            } else {
                console.warn(`   ❌ "${normalized}" NÃO encontrada!`);
                console.warn(`      Dias disponíveis:`, weekDates.map(d => d.dateStr).join(', '));
            }
        });
    }
    
    // Time slots (linha "Sem Horário" + 7 slots)
    const timeSlots = [
        'SEM_HORARIO',  // Linha especial para cargas sem horário
        '06:00 - 08:00',
        '08:00 - 10:00',
        '10:00 - 12:00',
        '12:00 - 14:00',
        '14:00 - 16:00',
        '16:00 - 18:00',
        '18:00 - 20:00'
    ];
    
    // 🔥 v2.51.16: Criar navegação de dias (< Anterior | Próximo >)
    const navContainer = document.createElement('div');
    navContainer.style.cssText = 'display:flex;justify-content:center;align-items:center;gap:16px;margin-bottom:16px;padding:12px;background:#f5f5f7;border-radius:8px;';
    
    const btnPrev = document.createElement('button');
    btnPrev.innerHTML = '← Seg-Qua';
    btnPrev.style.cssText = 'padding:8px 16px;background:#007AFF;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:13px;';
    btnPrev.disabled = currentDayOffset === 0;
    if (btnPrev.disabled) btnPrev.style.opacity = '0.4';
    btnPrev.onclick = () => {
        if (currentDayOffset > 0) {
            currentDayOffset--;
            renderCalendarioSemanal();
        }
    };
    
    const labelDays = document.createElement('div');
    labelDays.style.cssText = 'font-weight:700;font-size:14px;color:#333;';
    const dayNames = weekDates.map(d => d.dayName).join(' • ');
    labelDays.textContent = `${dayNames}`;
    
    const btnNext = document.createElement('button');
    btnNext.innerHTML = 'Qui-Sex →';
    btnNext.style.cssText = 'padding:8px 16px;background:#007AFF;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:13px;';
    btnNext.disabled = endIdx >= allWeekDates.length;
    if (btnNext.disabled) btnNext.style.opacity = '0.4';
    btnNext.onclick = () => {
        if (endIdx < allWeekDates.length) {
            currentDayOffset++;
            renderCalendarioSemanal();
        }
    };
    
    navContainer.appendChild(btnPrev);
    navContainer.appendChild(labelDays);
    navContainer.appendChild(btnNext);
    
    // Criar grid
    const grid = document.createElement('div');
    grid.className = 'calendario-grid';
    
    // 🔥 v2.51.22: BUGFIX - Ajustar número de colunas dinamicamente (2 ou 3 dias)
    const numColunas = weekDates.length;
    grid.style.gridTemplateColumns = `140px repeat(${numColunas}, 1fr)`;
    console.log(`📐 Grid configurado para ${numColunas} colunas (dias: ${weekDates.map(d => d.dayName).join(', ')})`);
    
    // Header Row
    const headerTime = document.createElement('div');
    headerTime.className = 'calendario-header-cell';
    headerTime.textContent = 'Horário';
    grid.appendChild(headerTime);
    
    weekDates.forEach(d => {
        const header = document.createElement('div');
        header.className = 'calendario-header-cell';
        header.innerHTML = `<div style="font-weight:700;">${d.dayName}</div><div style="font-size:12px;color:#666;margin-top:4px;">${d.dateStr}</div>`;
        grid.appendChild(header);
    });
    
    // Contador de blocos renderizados
    let totalBlocosRenderizados = 0;
    
    // 🔥 v2.51.6: Agrupar cargas por dia e calcular row-span
    const cargasPorDia = {};
    
    // 🔥 v2.51.28: Debug simplificado (remover logs excessivos)
    console.log(`\n📊 Processando ${cargas.length} cargas para renderização`);
    
    weekDates.forEach(d => {
        const cargasDesteDia = cargas.filter(c => normalizeDateFormat(c.date) === d.dateStr);
        
        if (cargasDesteDia.length > 0) {
            console.log(`\n📅 ${d.dateStr} (${d.dayName}): ${cargasDesteDia.length} carga(s)`);
            cargasDesteDia.forEach((c, i) => {
                console.log(`   ${i+1}. ${c.cliente} - Horário: "${c.horario}"`);
            });
        }
        
        cargasPorDia[d.dateStr] = cargasDesteDia.map(c => {
                // Calcular quantos slots este horário deve ocupar
                let slots = [];
                let rowSpan = 1;
                
                // 🔥 v2.51.28: Normalização AGRESSIVA de horário (garantir agrupamento correto)
                const horarioNormalizado = c.horario 
                    ? c.horario
                        .trim()                      // Remover espaços início/fim
                        .replace(/\s+/g, ' ')        // Múltiplos espaços → 1 espaço
                        .replace(/\s*-\s*/g, ' - ')  // Padronizar traço com espaços: "08:00-10:00" → "08:00 - 10:00"
                        .toUpperCase()               // Normalizar capitalização (MANHÃ/Manhã/manhã → MANHÃ)
                    : '';
                
                if (!horarioNormalizado || horarioNormalizado === '') {
                    // Sem horário: linha especial no topo
                    slots = ['SEM_HORARIO'];
                    rowSpan = 1;
                } else if (horarioNormalizado === 'MANHÃ' || horarioNormalizado === 'MANHA') {
                    // Manhã: 06-12 (3 slots)
                    slots = ['06:00 - 08:00'];
                    rowSpan = 3;
                } else if (horarioNormalizado === 'TARDE') {
                    // Tarde: 12-20 (4 slots)
                    slots = ['12:00 - 14:00'];
                    rowSpan = 4;
                } else {
                    // Horário específico: já normalizado acima
                    slots = [horarioNormalizado];
                    rowSpan = 1;
                }
                
                // Retornar carga com horário normalizado
                return { 
                    ...c, 
                    horario: horarioNormalizado,  // Usar horário normalizado
                    slots, 
                    rowSpan 
                };
            });
    });
    
    // Set para rastrear células já ocupadas (prevenir sobreposição)
    const celulasOcupadas = {}; // formato: "dia_slot" -> true
    
    // Rows por horário
    timeSlots.forEach(slot => {
        // Coluna de horário
        const timeCell = document.createElement('div');
        timeCell.className = 'calendario-time-cell';
        
        // Tratamento especial para linha "SEM HORÁRIO"
        if (slot === 'SEM_HORARIO') {
            timeCell.textContent = '⚠️ Sem Horário';
            timeCell.style.background = '#FFE5CC';
            timeCell.style.color = '#FF9500';
            timeCell.style.fontWeight = '700';
            timeCell.style.fontSize = '13px';
        } else {
            timeCell.textContent = slot;
        }
        
        grid.appendChild(timeCell);
        
        // Células por dia da semana
        weekDates.forEach(d => {
            const dayCell = document.createElement('div');
            dayCell.className = 'calendario-day-cell';
            
            const celKey = `${d.dateStr}_${slot}`;
            
            // Encontrar cargas que COMEÇAM neste slot
            const cargasNesteDia = cargasPorDia[d.dateStr] || [];
            const cargasNesteSlot = cargasNesteDia.filter(c => c.slots.includes(slot));
            
            // 🔥 v2.51.28: Log apenas quando há múltiplas cargas no mesmo slot
            if (cargasNesteSlot.length > 1) {
                console.log(`📦 ${cargasNesteSlot.length} cargas no slot "${slot}" do dia ${d.dateStr}:`);
                cargasNesteSlot.forEach((c, idx) => {
                    console.log(`   [${idx+1}] ${c.cliente} - ${c.horario}`);
                });
            }
            
            // 🔥 BUGFIX v2.51.14: Se célula ocupada, ocultar MAS permitir renderização de novas cargas
            const celulaOcupadaPorExpandido = celulasOcupadas[celKey];
            
            if (celulaOcupadaPorExpandido && cargasNesteSlot.length === 0) {
                // Célula ocupada e SEM cargas novas → apenas ocultar
                console.log(`   ⚠️ Célula ocupada por bloco expandido - sem cargas novas`);
                dayCell.style.visibility = 'hidden';
                grid.appendChild(dayCell);
                return;
            }
            
            if (celulaOcupadaPorExpandido && cargasNesteSlot.length > 0) {
                // Célula ocupada MAS existem cargas novas → renderizar por cima
                console.log(`   ✅ Célula ocupada mas com ${cargasNesteSlot.length} carga(s) nova(s) - renderizar por cima!`);
                dayCell.style.position = 'relative'; // Permitir sobreposição
            }
            
            // Renderizar eventos
            cargasNesteSlot.forEach((carga, cargoIdx) => {
                totalBlocosRenderizados++;
                
                // 🔥 v2.51.18: Marcar células ocupadas por blocos expandidos (restaurar lógica original)
                // Mas apenas para PRIMEIRA carga do slot (outras renderizam horizontalmente)
                if (cargoIdx === 0 && carga.rowSpan > 1) {
                    // Primeira carga marca células verticais (bloco expandido)
                    const slotIndex = timeSlots.indexOf(slot);
                    for (let i = 0; i < carga.rowSpan; i++) {
                        const ocupadoSlot = timeSlots[slotIndex + i];
                        if (ocupadoSlot) {
                            celulasOcupadas[`${d.dateStr}_${ocupadoSlot}`] = true;
                        }
                    }
                }
                
                const event = document.createElement('div');
                event.className = 'calendario-event';
                
                // 🔥 v2.51.30: Empilhamento horizontal para TODAS as cargas (rowSpan > 1 ou não)
                const totalCargasNesteSlot = cargasNesteSlot.length;
                
                if (carga.rowSpan > 1) {
                    // Blocos expandidos (Manhã/Tarde): position absolute
                    event.classList.add('expanded');
                    
                    // 🔥 v2.51.34c: Calcular altura total (cada célula = 100px + 2px border = 102px)
                    const alturaTotal = (carga.rowSpan * 102) - 10; // -10px para padding
                    event.style.height = `${alturaTotal}px`;
                    event.style.top = '0';
                    event.style.zIndex = '5';
                    
                    console.log(`🎯 Bloco expandido: ${carga.cliente} | rowSpan: ${carga.rowSpan} | Altura: ${alturaTotal}px | Slot: ${slot}`);
                    
                    // Empilhamento horizontal
                    if (totalCargasNesteSlot === 1) {
                        // Apenas 1 carga: ocupar toda a largura
                        event.style.left = '8px';
                        event.style.right = '8px';
                        event.style.width = 'auto'; // 🔥 v2.51.34: Garantir largura automática
                    } else {
                        // Múltiplas cargas: dividir horizontalmente
                        const larguraPorBloco = Math.floor(96 / totalCargasNesteSlot); // 96% dividido (deixar 4% de margem)
                        const offsetHorizontal = cargoIdx * (larguraPorBloco + 1); // +1% de gap
                        
                        event.style.left = `${offsetHorizontal + 2}%`; // +2% margem inicial
                        event.style.right = 'auto';
                        event.style.width = `${larguraPorBloco}%`;
                    }
                } else if (totalCargasNesteSlot > 1) {
                    // 🔥 v2.51.30: Horários específicos (rowSpan = 1) com múltiplas cargas
                    // Usar flexbox inline para empilhar horizontalmente
                    event.style.display = 'inline-block';
                    event.style.verticalAlign = 'top';
                    event.style.marginRight = '4px';
                    
                    // Calcular largura (distribuir espaço)
                    const larguraPorBloco = Math.floor((100 / totalCargasNesteSlot) - 1); // -1% para gaps
                    event.style.width = `${larguraPorBloco}%`;
                    event.style.minWidth = '120px'; // Largura mínima para legibilidade
                } else if (celulaOcupadaPorExpandido) {
                    // Carga específica sobre célula ocupada → z-index maior
                    event.style.position = 'relative';
                    event.style.zIndex = '10';
                    event.style.marginTop = '4px';
                }
                
                // Badge visual do horário
                let badgeHorario = '';
                let backgroundColor = '';
                
                if (!carga.horario || carga.horario.trim() === '') {
                    // Sem horário: Laranja
                    badgeHorario = '<span style="background:#FF9500;color:white;font-size:9px;padding:2px 6px;border-radius:4px;font-weight:600;margin-left:4px;">⚠️ SEM HORÁRIO</span>';
                    backgroundColor = 'linear-gradient(135deg, #FF9500 0%, #FF6B00 100%)';
                } else if (carga.horario === 'Manhã') {
                    // Manhã: AZUL
                    badgeHorario = '<span style="background:#007AFF;color:white;font-size:9px;padding:2px 6px;border-radius:4px;font-weight:600;margin-left:4px;">☀️ MANHÃ (06-12h)</span>';
                    backgroundColor = 'linear-gradient(135deg, #007AFF 0%, #0051D5 100%)';
                } else if (carga.horario === 'Tarde') {
                    // Tarde: AZUL
                    badgeHorario = '<span style="background:#007AFF;color:white;font-size:9px;padding:2px 6px;border-radius:4px;font-weight:600;margin-left:4px;">🌆 TARDE (12-20h)</span>';
                    backgroundColor = 'linear-gradient(135deg, #007AFF 0%, #0051D5 100%)';
                } else {
                    // Horários específicos: AZUL
                    badgeHorario = `<span style="background:#007AFF;color:white;font-size:9px;padding:2px 6px;border-radius:4px;font-weight:600;margin-left:4px;">🕐 ${carga.horario}</span>`;
                    backgroundColor = 'linear-gradient(135deg, #007AFF 0%, #0051D5 100%)';
                }
                
                // Aplicar cor de fundo específica
                event.style.background = backgroundColor;
                
                event.innerHTML = `
                    <div class="calendario-event-title">${carga.cliente || '(sem cliente)'}${badgeHorario}</div>
                    <div class="calendario-event-details">
                        📍 ${carga.local || '---'}<br>
                        📦 ${carga.medida || '---'} × ${carga.qtd || '---'}<br>
                        🚚 ${carga.transp}
                    </div>
                `;
                // 🔥 v2.51.23: Abrir modal de detalhes ao clicar
                event.onclick = () => {
                    console.log('🔵 Clique em carga:', carga);
                    showCargaDetails(carga, d.dayName, d.dateStr);
                };
                dayCell.appendChild(event);
            });
            
            grid.appendChild(dayCell);
        });
    });
    
    container.innerHTML = '';
    container.appendChild(navContainer); // 🔥 v2.51.16: Navegação de dias
    container.appendChild(grid);
    
    console.log(`\n🎨 RESULTADO FINAL:`);
    console.log(`   ✅ Total de blocos renderizados no calendário: ${totalBlocosRenderizados}`);
    
    if (totalBlocosRenderizados === 0 && cargas.length > 0) {
        console.error(`\n   ❌ ERRO: ${cargas.length} carga(s) encontrada(s), mas NENHUM bloco foi renderizado!`);
        console.error(`   Isto significa que as datas não estão a fazer match com os dias da semana.`);
    }
    
    console.log('='.repeat(60) + '\n');
}

function getWeekDates(weekNumber) {
    // Construir array de seg-sex da semana indicada
    const monthIndex = {
        'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
        'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11
    }[currentMonth];
    
    const firstDay = new Date(currentYear, monthIndex, 1);
    const lastDay = new Date(currentYear, monthIndex + 1, 0);
    
    const result = [];
    
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
        const wn = getWeekNumber(d);
        if (wn === weekNumber) {
            const dayOfWeek = d.getDay(); // 0=dom, 1=seg, ..., 6=sab
            if (dayOfWeek >= 1 && dayOfWeek <= 5) { // seg-sex
                const dd = String(d.getDate()).padStart(2, '0');
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dateStr = `${dd}/${mm}`;
                
                const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                const dayName = dayNames[dayOfWeek];
                
                result.push({ dateStr, dayName });
            }
        }
    }
    
    return result;
}

function prevWeekCalendario() {
    const currentIndex = weekTabs.indexOf(currentCalendarioWeek);
    if (currentIndex > 0) {
        currentCalendarioWeek = weekTabs[currentIndex - 1];
        currentDayOffset = 0; // 🔥 v2.51.16: Resetar para Seg-Qua ao mudar semana
        renderCalendarioSemanal();
    } else {
        showToast('⚠️ Já está na primeira semana', 'info');
    }
}

function nextWeekCalendario() {
    const currentIndex = weekTabs.indexOf(currentCalendarioWeek);
    if (currentIndex < weekTabs.length - 1) {
        currentCalendarioWeek = weekTabs[currentIndex + 1];
        currentDayOffset = 0; // 🔥 v2.51.16: Resetar para Seg-Qua ao mudar semana
        renderCalendarioSemanal();
    } else {
        showToast('⚠️ Já está na última semana', 'info');
    }
}

function refreshCalendario() {
    renderCalendarioSemanal();
    showToast('🔄 Calendário atualizado', 'success');
}

// 🔍 DEBUG: Função para investigar dados
function debugMapaCargas() {
    console.log('='.repeat(60));
    console.log('🔍 DEBUG MAPA CARGAS');
    console.log('='.repeat(60));
    
    console.log('📊 Estado atual:');
    console.log(`   currentCalendarioWeek: ${currentCalendarioWeek}`);
    console.log(`   currentMonth: ${currentMonth}`);
    console.log(`   currentYear: ${currentYear}`);
    
    console.log('\n📅 encomendasData.dates (primeiras 10):');
    encomendasData.dates.slice(0, 10).forEach((date, i) => {
        console.log(`   [${i}]: "${date}"`);
    });
    
    console.log('\n📦 encomendasData.data (primeiros 20 campos):');
    const keys = Object.keys(encomendasData.data).slice(0, 20);
    keys.forEach(key => {
        console.log(`   ${key}: "${encomendasData.data[key]}"`);
    });
    
    console.log('\n🔍 Procurar campos TRANSP preenchidos:');
    const transpKeys = Object.keys(encomendasData.data).filter(k => k.includes('_transp') && encomendasData.data[k]);
    console.log(`   Total de campos TRANSP: ${transpKeys.length}`);
    transpKeys.forEach(key => {
        const index = parseInt(key.split('_')[0]);
        const date = encomendasData.dates[index];
        const semana = encomendasData.data[`${index}_sem`];
        const cliente = encomendasData.data[`${index}_cliente`];
        const horario = encomendasData.data[`${index}_horario_carga`];
        
        console.log(`   ${key}: "${encomendasData.data[key]}"`);
        console.log(`      → index: ${index}, date: "${date}", semana: ${semana}, cliente: "${cliente}", horario: "${horario}"`);
    });
    
    console.log('='.repeat(60));
}

// Adicionar à janela global
window.debugMapaCargas = debugMapaCargas;

// Adicionar novo DIA (20 linhas vazias com a mesma data)
async function addNewDay() {
    const lastDate = encomendasData.dates[encomendasData.dates.length - 1];
    const [day, month] = lastDate.split('/');
    const newDay = (parseInt(day) + 1).toString().padStart(2, '0');
    const newDate = `${newDay}/${month}`;
    
    // Adicionar 20 linhas com a mesma data
    for (let i = 0; i < 20; i++) {
        encomendasData.dates.push(newDate);
    }
    
    logHistory('ADD_DAY', { date: newDate, count: 20 });
    renderEncomendasGrid();
    
    // Salvar todas as linhas novas
    await saveAllRows();
    showToast(`✅ Dia ${newDate} adicionado (20 linhas)`);
}

// Adicionar apenas UMA linha (repete a última data)
async function addNewRow() {
    const lastDate = encomendasData.dates[encomendasData.dates.length - 1];
    encomendasData.dates.push(lastDate);
    logHistory('ADD_ROW', { date: lastDate });
    renderEncomendasGrid();
    
    // Salvar apenas a nova linha
    const newIndex = encomendasData.dates.length - 1;
    await saveRowData(newIndex, {});
    showToast(`✅ Nova linha adicionada (${lastDate})`);
}

// INIT
// ===================================================================
// FULLSCREEN (Ecrã Inteiro) para Mapa de Encomendas
// ===================================================================
function toggleFullscreen() {
    const container = document.querySelector('.excel-grid-container');
    const btn = document.getElementById('fullscreen-btn');
    
    if (!document.fullscreenElement) {
        // Entrar em fullscreen
        if (container.requestFullscreen) {
            container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) { // Safari
            container.webkitRequestFullscreen();
        } else if (container.msRequestFullscreen) { // IE11
            container.msRequestFullscreen();
        }
        
        btn.textContent = '⛶ Sair do Ecrã Inteiro';
        showToast('📺 Modo ecrã inteiro ativado (ESC para sair)', 'info');
        
        // Adicionar classe para ajustar estilos em fullscreen
        container.classList.add('fullscreen-active');
    } else {
        // Sair de fullscreen
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
        
        btn.textContent = '⛶ Ecrã Inteiro';
        container.classList.remove('fullscreen-active');
    }
}

// Detectar mudanças de fullscreen (ESC, F11, etc.)
document.addEventListener('fullscreenchange', () => {
    const container = document.querySelector('.excel-grid-container');
    const btn = document.getElementById('fullscreen-btn');
    
    if (!document.fullscreenElement) {
        // Saiu de fullscreen
        if (btn) btn.textContent = '⛶ Ecrã Inteiro';
        if (container) container.classList.remove('fullscreen-active');
    }
});

// 🔥 v2.51.34c: Modo de destaque amarelo para células
let highlightModeActive = false;

function toggleHighlightMode() {
    highlightModeActive = !highlightModeActive;
    const btn = document.getElementById('highlight-btn');
    
    if (highlightModeActive) {
        btn.classList.add('highlight-mode-active');
        btn.textContent = '🖍️ Modo Ativo (clique nas células)';
        showToast('🖍️ Modo destaque ATIVO - clique nas células para destacar', 'info');
    } else {
        btn.classList.remove('highlight-mode-active');
        btn.textContent = '🖍️ Destacar Célula';
        showToast('Modo destaque desativado', 'info');
    }
}

// Adicionar listener para células clicáveis
document.addEventListener('click', function(e) {
    // Verificar se clicou numa célula editável E modo destaque está ativo
    if (highlightModeActive && e.target.classList.contains('excel-cell') && e.target.contentEditable === 'true') {
        e.preventDefault();
        e.stopPropagation();
        
        // Toggle destaque
        if (e.target.classList.contains('excel-cell-highlighted')) {
            e.target.classList.remove('excel-cell-highlighted');
            console.log('🖍️ Destaque removido da célula');
        } else {
            e.target.classList.add('excel-cell-highlighted');
            console.log('🖍️ Célula destacada em amarelo');
        }
        
        // Salvar estado (opcional - para persistir destaques)
        // saveHighlightState();
    }
});

console.log('🚀 APP.JS v2.50.3 - CORES + Código Único na BD - ' + new Date().toLocaleTimeString());

// 🛠️ FUNÇÕES DE DEBUG (chamar do console)
window.debugSecagens = function() {
    console.log('\n═══════════════════════════════════════');
    console.log('🔍 DEBUG: TODAS AS SECAGENS EM MEMÓRIA');
    console.log('═══════════════════════════════════════');
    console.log(`Total: ${secagens.length} secagens\n`);
    
    secagens.forEach((s, idx) => {
        console.log(`${idx + 1}. ID: ${s.id}`);
        console.log(`   Estufa: ${s.estufa_id}`);
        console.log(`   Status: ${s.status || 'N/A'}`);
        console.log(`   Início: ${formatDateTime(s.start_time)}`);
        console.log(`   Fim: ${formatDateTime(s.end_time)}`);
        console.log(`   Created: ${new Date(s.created_at).toLocaleString()}`);
        console.log('');
    });
    
    console.log('═══════════════════════════════════════\n');
};

window.listarSecagensEstufa = function(estufaId) {
    console.log(`\n🏭 Secagens da Estufa ${estufaId}:`);
    const filtered = secagens.filter(s => s.estufa_id === estufaId);
    console.log(`Total: ${filtered.length}\n`);
    
    filtered.forEach((s, idx) => {
        console.log(`${idx + 1}. ${s.id.slice(0,8)}: ${formatDateTime(s.start_time)} → ${formatDateTime(s.end_time)}`);
    });
};

window.apagarSecagemFantasma = async function(secagemId) {
    console.log(`🗑️ Tentando apagar secagem: ${secagemId}`);
    
    try {
        const { error } = await db
            .from('secagens')
            .delete()
            .eq('id', secagemId);
        
        if (error) throw error;
        
        console.log('✅ Secagem apagada da BD');
        
        // Remover do array em memória
        secagens = secagens.filter(s => s.id !== secagemId);
        console.log('✅ Secagem removida da memória');
        
        // Recarregar dashboard
        await loadAllData();
        console.log('✅ Dashboard recarregado');
        
    } catch (error) {
        console.error('❌ Erro ao apagar:', error);
    }
};

console.log('\n💡 Funções de debug disponíveis:');
console.log('   debugSecagens() - Listar todas as secagens');
console.log('   listarSecagensEstufa(3) - Listar secagens da estufa 3');
console.log('   apagarSecagemFantasma("id-aqui") - Apagar secagem fantasma');
console.log('   debugMapaCargas() - Investigar dados do Mapa de Cargas');
console.log('');

// ===================================================================
// 🔥 v2.51.23: MODAL DE DETALHES DA CARGA
// ===================================================================

function showCargaDetails(carga, dayName, dateStr) {
    console.log('📦 Abrindo detalhes da carga:', carga);
    
    const modal = document.getElementById('modal-carga-details');
    
    // Atualizar título e subtítulo
    document.getElementById('modal-carga-title').textContent = `📦 ${carga.cliente || '(sem cliente)'}`;
    document.getElementById('modal-carga-subtitle').textContent = `${dateStr} • ${dayName}`;
    
    // Atualizar campos
    document.getElementById('carga-cliente').textContent = carga.cliente || '---';
    document.getElementById('carga-local').textContent = carga.local || '---';
    document.getElementById('carga-medida').textContent = carga.medida || '---';
    document.getElementById('carga-qtd').textContent = carga.qtd ? `${carga.qtd} un` : '---';
    document.getElementById('carga-transp').textContent = carga.transp || '---';
    
    // Horário com badge colorido
    const horarioEl = document.getElementById('carga-horario');
    if (!carga.horario || carga.horario.trim() === '') {
        horarioEl.textContent = '⚠️ Sem Horário Definido';
        horarioEl.style.color = '#FF9500';
    } else if (carga.horario === 'Manhã') {
        horarioEl.textContent = '☀️ Manhã (06:00 - 12:00)';
        horarioEl.style.color = '#007AFF';
    } else if (carga.horario === 'Tarde') {
        horarioEl.textContent = '🌆 Tarde (12:00 - 20:00)';
        horarioEl.style.color = '#007AFF';
    } else {
        horarioEl.textContent = `🕐 ${carga.horario}`;
        horarioEl.style.color = '#007AFF';
    }
    
    // Observações (mostrar apenas se existir)
    const obsContainer = document.getElementById('carga-obs-container');
    const obsValue = document.getElementById('carga-obs');
    
    if (carga.obs && carga.obs.trim() !== '') {
        obsValue.textContent = carga.obs;
        obsContainer.style.display = 'block';
    } else {
        obsContainer.style.display = 'none';
    }
    
    // Mostrar modal
    modal.style.display = 'flex';
    
    // Animação de entrada
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
}

function closeCargaModal() {
    const modal = document.getElementById('modal-carga-details');
    modal.classList.remove('active');
    
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}

checkAuthState();
initMatrixSystem();
