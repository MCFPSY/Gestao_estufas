// ===================================================================
// PSY - Gestão de secagens, encomendas e cargas
// Versão: v2.51.36i - HOTFIX MODALS + AUTO-REFRESH INDICATOR
// Data: 25/03/2026 11:45
// ===================================================================
console.log('%c🔥 APP.JS v2.51.36N - MOVER MODAL PARA BODY 🔥', 'background: #FF3B30; color: white; font-size: 20px; font-weight: bold; padding: 10px;');
console.log('%c📋 SOLUÇÃO: appendChild(modal) move para body (fora de tabs)', 'background: #34C759; color: white; font-size: 16px; padding: 5px;');
console.log('%c✅ PROBLEMA ERA: modal dentro de tab com display:none!', 'background: #007AFF; color: white; font-size: 14px; padding: 5px;');

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
// 🆕 v2.52.11: Heartbeat para manter presença sincronizada mesmo com tabs em background
let _presenceHeartbeat = null;
let _presenceSubStatus = null; // 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR' | 'TIMED_OUT'

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

// 🔐 v2.52.0: Variáveis globais de autenticação e permissões
let currentUser = null;
let userPermissions = {};

// 🆕 v2.52.6: Cache e helpers de transportadores (para combobox autocomplete)
let _transportadoresCache = [];

async function loadTransportadores() {
    try {
        const { data, error } = await db.from('transportadores').select('nome').eq('ativo', true).order('nome');
        if (error) {
            console.warn('⚠️ Tabela transportadores não disponível:', error.message);
            return [];
        }
        _transportadoresCache = (data || []).map(r => r.nome);
        console.log(`🚚 ${_transportadoresCache.length} transportadores carregados`);
        refreshTranspDatalist();
        return _transportadoresCache;
    } catch (e) {
        console.warn('⚠️ Erro ao carregar transportadores:', e);
        return [];
    }
}

function refreshTranspDatalist() {
    let datalist = document.getElementById('transp-datalist');
    if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = 'transp-datalist';
        document.body.appendChild(datalist);
    }
    datalist.innerHTML = _transportadoresCache
        .map(n => `<option value="${n.replace(/"/g, '&quot;')}"></option>`).join('');
}

async function saveNewTransportador(nome) {
    if (!nome) return;
    const trimmed = nome.trim();
    if (!trimmed) return;
    // Já existe em cache? Não inserir
    if (_transportadoresCache.some(n => n.toLowerCase() === trimmed.toLowerCase())) return;
    try {
        const { error } = await db.from('transportadores').insert({ nome: trimmed });
        if (error && error.code !== '23505') { // 23505 = duplicate key
            console.warn('⚠️ Erro ao guardar transportador novo:', error.message);
            return;
        }
        _transportadoresCache.push(trimmed);
        _transportadoresCache.sort();
        refreshTranspDatalist();
        console.log(`✅ Novo transportador guardado: ${trimmed}`);
    } catch (e) {
        console.warn('⚠️ Erro ao guardar transportador:', e);
    }
}

// 🔐 v2.52.0: Funções helper de permissões
function canEdit(tabId) {
    // Admin tem acesso total
    if (currentUser?.role === 'admin') {
        console.log(`   [canEdit] ${tabId}: TRUE (admin)`);
        return true;
    }
    
    const permission = userPermissions[tabId];
    const result = permission === 'edit' || permission === 'admin';
    console.log(`   [canEdit] ${tabId}: ${result} (permission=${permission}, role=${currentUser?.role})`);
    return result;
}

function canView(tabId) {
    // Admin tem acesso total
    if (currentUser?.role === 'admin') {
        console.log(`   [canView] ${tabId}: TRUE (admin)`);
        return true;
    }
    
    const permission = userPermissions[tabId];
    const result = permission && permission !== 'none';
    console.log(`   [canView] ${tabId}: ${result} (permission=${permission})`);
    return result;
}

function isAdmin() {
    const result = currentUser?.role === 'admin';
    console.log(`   [isAdmin]: ${result} (role=${currentUser?.role})`);
    return result;
}

function getPermission(tabId) {
    if (currentUser?.role === 'admin') return 'admin';
    return userPermissions[tabId] || 'none';
}

// AUTH
async function checkAuthState() {
    const { data: { session } } = await db.auth.getSession();
    if (session) {
        currentUser = session.user;
        
        // 🔐 v2.52.0: Carregar perfil COM permissões
        console.log('🔍 [checkAuthState] Verificando perfil para:', currentUser.id);
        const { data: profile, error: profileError } = await db
            .from('profiles')
            .select('id, email, nome, role, permissions')
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
                        role: 'viewer',
                        permissions: {
                            planeamento: 'view',
                            visualizacao: 'view',
                            encomendas: 'view',
                            cargas: 'view',
                            cargas_resumo: 'view'
                        }
                    })
                    .select()
                    .single();
                
                if (insertError) {
                    console.error('❌ [checkAuthState] Erro ao criar perfil:', insertError);
                    console.error('   Código:', insertError.code);
                    console.error('   Detalhes:', insertError.details);
                } else {
                    console.log('✅ [checkAuthState] Perfil criado com sucesso!', newProfile);
                    // Carregar permissões do novo perfil
                    userPermissions = newProfile.permissions || {};
                    currentUser.role = newProfile.role;
                    currentUser.nome = newProfile.nome;
                }
            } else {
                console.error('❌ [checkAuthState] Erro desconhecido:', profileError);
            }
        } else {
            console.log('✅ [checkAuthState] Perfil já existe:', profile);
            // 🔐 v2.52.0: Carregar permissões
            userPermissions = profile.permissions || {};
            currentUser.role = profile.role;
            currentUser.nome = profile.nome;
            
            console.log('👤 Utilizador:', currentUser.nome || currentUser.email);
            console.log('🔑 Role:', currentUser.role);
            console.log('🔐 Permissões:', userPermissions);
        }
        
        showApp();
        applyPermissions(); // 🔐 v2.52.0: Aplicar permissões na UI
        loadAllData();
        setupRealtime();
        updateDateTime();
        setInterval(updateDateTime, 60000);

        // 🔥 v2.52.22: carregar alertas do sistema (banner vermelho se anomalia)
        loadSystemAlerts();
        setInterval(loadSystemAlerts, 5 * 60 * 1000); // refresh a cada 5 min
    } else {
        showLogin();
    }
}

// 🔥 v2.52.22: Banner de alerta do sistema
// Mostra um header vermelho em cima da app quando o audit detecta
// anomalias na BD (corrupção, variação brusca de contagens, etc).
// Só utilizadores autorizados veem (Goncalo + Anabela por agora).
const ALERT_AUDIENCE = ['goncalo', 'anabela'];

async function loadSystemAlerts() {
    if (!currentUser) return;
    const username = (currentUser.email || '').split('@')[0].toLowerCase();
    if (!ALERT_AUDIENCE.includes(username)) return;

    try {
        const { data, error } = await db
            .from('system_alerts')
            .select('*')
            .is('acknowledged_at', null)
            .order('created_at', { ascending: false })
            .limit(20);
        if (error) {
            console.warn('⚠️ [alerts] erro ao ler system_alerts:', error.message);
            return;
        }
        renderSystemAlertBanner(data || []);
    } catch (e) {
        console.warn('⚠️ [alerts] excepção:', e?.message || e);
    }
}

function renderSystemAlertBanner(alerts) {
    const existing = document.getElementById('system-alert-banner');
    if (!alerts || alerts.length === 0) {
        if (existing) existing.remove();
        document.body.style.paddingTop = '';
        return;
    }

    let banner = existing;
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'system-alert-banner';
        banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:linear-gradient(90deg,#b00,#d00);color:#fff;padding:10px 18px;font:600 13px system-ui;display:flex;align-items:center;gap:14px;box-shadow:0 2px 12px rgba(0,0,0,0.4);border-bottom:2px solid #700;';
        document.body.appendChild(banner);
    }
    banner.innerHTML = '';

    const icon = document.createElement('span');
    icon.textContent = '🚨';
    icon.style.fontSize = '18px';
    banner.appendChild(icon);

    const msg = document.createElement('div');
    msg.style.flex = '1';
    msg.innerHTML = `<strong>Anomalia detectada na base de dados</strong> — ${alerts.length} alerta${alerts.length > 1 ? 's' : ''} pendente${alerts.length > 1 ? 's' : ''}. <span style="opacity:0.9;">Validar antes de inserir mais dados.</span>`;
    banner.appendChild(msg);

    const detailBtn = document.createElement('button');
    detailBtn.textContent = 'Ver detalhes';
    detailBtn.style.cssText = 'background:#fff;color:#b00;border:0;padding:7px 14px;cursor:pointer;border-radius:4px;font:600 12px system-ui;';
    detailBtn.onclick = () => showSystemAlertsModal(alerts);
    banner.appendChild(detailBtn);

    // body padding para o banner não sobrepor o conteúdo
    document.body.style.paddingTop = (banner.offsetHeight + 4) + 'px';
}

function showSystemAlertsModal(alerts) {
    let modal = document.getElementById('system-alerts-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'system-alerts-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:100000;padding:40px;overflow:auto;';

    const content = document.createElement('div');
    content.style.cssText = 'max-width:800px;margin:0 auto;background:#fff;border-radius:10px;padding:24px;font:13px system-ui;';

    const h = document.createElement('h2');
    h.textContent = `🚨 ${alerts.length} Alerta${alerts.length > 1 ? 's' : ''} pendente${alerts.length > 1 ? 's' : ''}`;
    h.style.cssText = 'margin:0 0 16px 0;color:#b00;';
    content.appendChild(h);

    const warn = document.createElement('p');
    warn.style.cssText = 'background:#fff4f4;border-left:4px solid #b00;padding:10px 14px;margin:0 0 18px 0;color:#700;';
    warn.textContent = 'O snapshot diário detectou variações anómalas. Verifica os meses afectados antes de introduzir novos dados.';
    content.appendChild(warn);

    alerts.forEach(a => {
        const card = document.createElement('div');
        card.style.cssText = 'border:1px solid #e0e0e0;border-radius:6px;padding:14px;margin-bottom:12px;';

        const title = document.createElement('div');
        title.style.cssText = 'font-weight:700;color:#333;margin-bottom:6px;';
        title.textContent = a.title || '(sem título)';
        card.appendChild(title);

        const time = document.createElement('div');
        time.style.cssText = 'font-size:11px;color:#888;margin-bottom:10px;';
        time.textContent = `Detectado: ${new Date(a.created_at).toLocaleString('pt-PT')} · Origem: ${a.source || '—'}`;
        card.appendChild(time);

        if (a.message) {
            const msg = document.createElement('div');
            msg.style.cssText = 'color:#333;margin-bottom:10px;white-space:pre-wrap;';
            msg.textContent = a.message;
            card.appendChild(msg);
        }

        if (a.details) {
            const det = document.createElement('pre');
            det.style.cssText = 'background:#f5f5f5;padding:10px;border-radius:4px;font:11px monospace;margin:0 0 10px 0;overflow:auto;max-height:200px;';
            det.textContent = JSON.stringify(a.details, null, 2);
            card.appendChild(det);
        }

        const ackBtn = document.createElement('button');
        ackBtn.textContent = '✓ Marcar como validado/resolvido';
        ackBtn.style.cssText = 'background:#060;color:#fff;border:0;padding:8px 14px;cursor:pointer;border-radius:4px;font:600 12px system-ui;';
        ackBtn.onclick = async () => {
            if (!confirm('Confirmas que já validaste este alerta?')) return;
            ackBtn.textContent = '⏳ a marcar...';
            ackBtn.disabled = true;
            try {
                await acknowledgeSystemAlert(a.id);
                card.style.opacity = '0.4';
                ackBtn.textContent = '✓ resolvido';
                // Recarregar banner (vai esconder se zero alertas)
                await loadSystemAlerts();
            } catch (e) {
                ackBtn.textContent = '❌ erro';
                alert('Erro ao marcar: ' + (e?.message || e));
            }
        };
        card.appendChild(ackBtn);

        content.appendChild(card);
    });

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Fechar';
    closeBtn.style.cssText = 'background:#666;color:#fff;border:0;padding:8px 16px;cursor:pointer;border-radius:4px;font:13px system-ui;margin-top:8px;';
    closeBtn.onclick = () => modal.remove();
    content.appendChild(closeBtn);

    modal.appendChild(content);
    document.body.appendChild(modal);
}

async function acknowledgeSystemAlert(alertId) {
    const { error } = await db
        .from('system_alerts')
        .update({
            acknowledged_at: new Date().toISOString(),
            acknowledged_by_user_id: currentUser?.id || null,
            acknowledged_by_email: currentUser?.email || null
        })
        .eq('id', alertId);
    if (error) throw error;
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

    // 🆕 v2.52.9: Tab default por utilizador
    // Catarina, Anabela e Goncalo abrem directamente no Mapa de Encomendas
    const username = (currentUser.email || '').split('@')[0].toLowerCase();
    const MAPA_ENCOMENDAS_USERS = ['catarina', 'anabela', 'goncalo'];
    if (MAPA_ENCOMENDAS_USERS.includes(username)) {
        const encomendasBtn = document.querySelector('[data-tab="encomendas"]');
        if (encomendasBtn) {
            console.log(`🎯 Tab default para ${username}: Mapa de Encomendas`);
            setTimeout(() => encomendasBtn.click(), 100);
        }
    }
}

// 🔐 v2.52.0: Aplicar permissões na UI
function applyPermissions() {
    console.log('🔐 Aplicando permissões na UI...');
    
    // Mapear tabs para elementos
    const tabs = {
        'planeamento': { btn: document.querySelector('[data-tab="planeamento"]'), content: document.getElementById('tab-planeamento') },
        'visualizacao': { btn: document.querySelector('[data-tab="visualizacao"]'), content: document.getElementById('tab-visualizacao') },
        'encomendas': { btn: document.querySelector('[data-tab="encomendas"]'), content: document.getElementById('tab-encomendas') },
        'cargas': { btn: document.querySelector('[data-tab="cargas"]'), content: document.getElementById('tab-cargas') },
        'cargas_resumo': { btn: document.querySelector('[data-tab="cargas_resumo"]'), content: document.getElementById('tab-cargas-resumo') }
    };
    
    // Aplicar permissões em cada tab
    Object.keys(tabs).forEach(tabId => {
        const permission = getPermission(tabId);
        const tab = tabs[tabId];
        
        console.log(`   Tab "${tabId}": ${permission}`);
        
        // Se permission = 'none', ocultar tab
        if (permission === 'none') {
            if (tab.btn) tab.btn.style.display = 'none';
            if (tab.content) tab.content.style.display = 'none';
            console.log(`      ❌ Tab oculta`);
            return;
        }
        
        // Se permission = 'view', aplicar modo visualização
        if (permission === 'view') {
            console.log(`      👁️ Modo visualização`);
        }
        
        // Se permission = 'edit' ou 'admin', permitir edição
        if (permission === 'edit' || permission === 'admin') {
            console.log(`      ✏️ Modo edição`);
        }
    });
    
    // Mostrar badge de permissão no avatar
    updateUserBadge();
}

// 🔐 v2.52.0: Atualizar badge do utilizador com role
function updateUserBadge() {
    const userAvatar = document.getElementById('user-avatar');
    if (!userAvatar) return;
    
    let badge = '';
    if (isAdmin()) {
        badge = '<span style="position:absolute;bottom:-2px;right:-2px;background:#007AFF;color:white;font-size:8px;padding:1px 3px;border-radius:3px;font-weight:600;">ADMIN</span>';
    } else if (currentUser.role === 'editor' || canEdit('planeamento')) {
        badge = '<span style="position:absolute;bottom:-2px;right:-2px;background:#34C759;color:white;font-size:8px;padding:1px 3px;border-radius:3px;font-weight:600;">EDIT</span>';
    } else {
        badge = '<span style="position:absolute;bottom:-2px;right:-2px;background:#FF9500;color:white;font-size:8px;padding:1px 3px;border-radius:3px;font-weight:600;">VIEW</span>';
    }
    
    // Adicionar badge (requer ajustar estrutura HTML)
    userAvatar.style.position = 'relative';
    userAvatar.innerHTML += badge;
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    // 🆕 v2.52.12: Suportar múltiplos domínios de email (legacy e novos)
    // Utilizadores antigos: @secagens.local
    // Utilizadores novos (criados após política de email do Supabase): @psy.pt
    const emailCandidates = [
        username.toLowerCase() + '@secagens.local',
        username.toLowerCase() + '@psy.pt',
    ];

    const btn = document.getElementById('login-btn');
    const btnText = document.getElementById('login-text');
    const btnLoading = document.getElementById('login-loading');
    const errorDiv = document.getElementById('login-error');

    btn.disabled = true;
    btnText.classList.add('d-none');
    btnLoading.classList.remove('d-none');
    errorDiv.classList.add('d-none');

    try {
        let data = null, error = null;
        for (const email of emailCandidates) {
            const result = await db.auth.signInWithPassword({ email, password });
            if (!result.error) { data = result.data; error = null; break; }
            error = result.error;
        }
        if (error) throw error;
        currentUser = data.user;
        
        // ✅ Carregar perfil completo (role + permissions)
        console.log('🔍 Verificando perfil para:', currentUser.id);
        const { data: profile, error: profileError } = await db
            .from('profiles')
            .select('id, email, nome, role, permissions')
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
                        showToast('⚠️ Perfil não existe. Contacte o administrador.', 'error');
                        // NÃO bloquear login - deixar continuar
                    } else {
                        throw new Error('Não foi possível criar perfil do utilizador');
                    }
                } else {
                    console.log('✅ Perfil criado com sucesso!', newProfile);
                    userPermissions = newProfile.permissions || {};
                    currentUser.role = newProfile.role;
                    currentUser.nome = newProfile.nome;
                }
            } else {
                console.error('❌ Erro desconhecido ao consultar perfil:', profileError);
            }
        } else {
            console.log('✅ Perfil carregado:', profile);
            userPermissions = profile.permissions || {};
            currentUser.role = profile.role;
            currentUser.nome = profile.nome;
            console.log('🔑 Role:', currentUser.role, '| Permissões:', userPermissions);
        }

        showApp();
        applyPermissions();
        loadAllData();
        setupRealtime();
        // 🔥 v2.52.22: alertas também aqui (fluxo de login manual)
        loadSystemAlerts();
        showToast('Login realizado com sucesso!');
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
        
        // 🆕 v2.51.36h: Auto-load + render tab Cargas Resumo
        if (tabName === 'cargas-resumo') {
            console.log('📦 Aba Cargas Resumo aberta - carregando dados...');
            loadEncomendasData().then(() => {
                console.log('✅ Dados carregados - renderizando resumo...');
                renderResumoCargas();
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
    const anchor = new Date(currentGanttDate);
    anchor.setHours(0,0,0,0);
    const startDate = new Date(anchor);
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
                // 🔐 v2.52.0: Verificar permissão
                if (!canEdit('planeamento')) {
                    showToast('⚠️ Não tem permissão para criar secagens', 'warning');
                    return;
                }
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
                
                // 🌡️ v2.51.38: Ícone termômetro para Ultra dry
                const isUltraDry = sec.tipo_secagem === 'Ultra dry';
                const ultraDryIcon = isUltraDry ? '<span style="font-size: 16px; margin-right: 4px;">🌡️</span>' : '';
                
                block.innerHTML = `
                    <div class="secagem-id">${ultraDryIcon}${getSecagemCode(sec)}</div>
                    <div class="secagem-time">${formatTime(sec.start_time)} → ${formatTime(sec.end_time)}</div>
                    <div class="secagem-cliente">${cargoPreview}</div>
                    <div class="secagem-badges">
                        ${sec.super_dry ? '<span class="secagem-badge">SD</span>' : ''}
                        ${cargoCount > 1 ? `<span class="secagem-badge">+${cargoCount - 1}</span>` : ''}
                    </div>
                `;
                
                block.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // 🔥 v2.52.24: view-only também abre o detalhe — o editSecagem
                    // trata de aplicar read-only ao modal. NÃO bloquear aqui.
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
    // 🔐 v2.52.0: Verificar permissão ANTES de abrir modal
    if (!canEdit('planeamento')) {
        console.warn('❌ [openNewSecagemModal] Utilizador não tem permissão para criar secagens');
        showToast('❌ Não tem permissão para criar secagens', 'error');
        return;
    }
    
    document.getElementById('modal-title').textContent = 'Nova Secagem';
    document.getElementById('modal-subtitle').textContent = `Estufa ${estufaId || 1}`;
    document.getElementById('form-secagem').reset();
    document.getElementById('secagem-id').value = '';
    document.getElementById('input-estufa').value = estufaId || 1;
    
    const dateStr = (date || new Date()).toISOString().slice(0, 16);
    document.getElementById('input-start').value = dateStr;
    document.getElementById('input-duration').value = '48';
    
    // v2.51.38: Novos campos (com verificação de existência)
    const tipoSecagemField = document.getElementById('input-tipo-secagem');
    if (tipoSecagemField) tipoSecagemField.value = 'Dry'; // Valor padrão
    
    const qtdTotalField = document.getElementById('input-qtd-total');
    if (qtdTotalField) qtdTotalField.value = '';
    
    updateModalSidebar(estufaId || 1);
    calculateEndTime();
    
    // Limpar matriz
    loadMatrixData([]);
    
    document.getElementById('btn-delete').classList.add('d-none');
    openModal();
}

function editSecagem(sec) {
    // 🔥 v2.52.24: abrir modal sempre — view-only só vê, não edita.
    const readOnly = !canEdit('planeamento');

    const titlePrefix = readOnly ? 'Ver' : 'Editar';
    document.getElementById('modal-title').textContent = `${titlePrefix} — ${getSecagemCode(sec)}`;
    document.getElementById('modal-subtitle').textContent = `Estufa ${sec.estufa_id} · ${sec.duration_hours}h`;
    document.getElementById('secagem-id').value = sec.id;
    document.getElementById('input-estufa').value = sec.estufa_id;
    document.getElementById('input-start').value = new Date(sec.start_time).toISOString().slice(0, 16);
    document.getElementById('input-duration').value = sec.duration_hours;
    document.getElementById('input-obs').value = sec.obs || '';

    // v2.51.38: Novos campos (com verificação de existência)
    const tipoSecagemField = document.getElementById('input-tipo-secagem');
    if (tipoSecagemField) tipoSecagemField.value = sec.tipo_secagem || 'Dry';

    const qtdTotalField = document.getElementById('input-qtd-total');
    if (qtdTotalField) qtdTotalField.value = sec.qtd_total || '';

    updateModalSidebar(sec.estufa_id);
    calculateEndTime();

    // Carregar dados na matriz
    loadMatrixData(sec.cargo || []);

    // Botão eliminar: só visível em modo edição
    const delBtn = document.getElementById('btn-delete');
    if (readOnly) delBtn.classList.add('d-none');
    else delBtn.classList.remove('d-none');

    // Aplicar modo read-only/edit ao modal
    applyModalSecagemMode(readOnly);

    openModal();
}

// 🔥 v2.52.24: Aplicar modo read-only ou edit ao modal de secagem.
// Em read-only: inputs bloqueados, botão guardar escondido, só "Fechar" disponível.
function applyModalSecagemMode(readOnly) {
    const modal = document.getElementById('modal-secagem');
    if (!modal) return;

    // Inputs, selects, textareas
    modal.querySelectorAll('input, select, textarea').forEach(el => {
        if (readOnly) {
            el.setAttribute('disabled', 'disabled');
            el.setAttribute('data-ro', '1');
        } else if (el.getAttribute('data-ro') === '1') {
            el.removeAttribute('disabled');
            el.removeAttribute('data-ro');
        }
    });

    // Células editáveis da matriz de cargo
    modal.querySelectorAll('[contenteditable]').forEach(el => {
        if (readOnly) {
            el.setAttribute('data-prev-editable', el.getAttribute('contenteditable') || 'true');
            el.setAttribute('contenteditable', 'false');
        } else if (el.hasAttribute('data-prev-editable')) {
            el.setAttribute('contenteditable', el.getAttribute('data-prev-editable'));
            el.removeAttribute('data-prev-editable');
        }
    });

    // Botão guardar (form submit)
    const saveBtn = modal.querySelector('.btn-save');
    if (saveBtn) saveBtn.style.display = readOnly ? 'none' : '';

    // Adicionar aviso visual se read-only
    let banner = modal.querySelector('#modal-readonly-banner');
    if (readOnly) {
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'modal-readonly-banner';
            banner.style.cssText = 'background:#fff4e6;border-left:4px solid #ff9500;color:#663c00;padding:8px 12px;margin:0 0 10px 0;font:500 12px system-ui;border-radius:4px;';
            banner.textContent = '👁️ Modo visualização — sem permissão para editar.';
            const body = modal.querySelector('.modal-body') || modal.querySelector('form');
            if (body) body.insertBefore(banner, body.firstChild);
        }
    } else if (banner) {
        banner.remove();
    }

    // Texto do botão Cancelar muda para "Fechar" em read-only
    const cancelBtn = modal.querySelector('.btn-secondary');
    if (cancelBtn) cancelBtn.textContent = readOnly ? 'Fechar' : 'Cancelar';
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

// 🆕 v2.52.12: Navegação com setas (funciona em contenteditable, input e select)
function encNavigate(e, currentTd) {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab'].includes(e.key)) return false;
    // 🔥 v2.52.19: intercetar também ↑↓ quando foco está num <select> (HORÁRIO).
    // Antes passavam ao browser e ele alterava silenciosamente a opção enquanto o
    // utilizador só queria mudar de linha — risco de editar dados por engano.
    // Para mudar o horário: clicar na seta do select, ou Alt+Down para abrir.

    e.preventDefault();
    const currentRow = parseInt(currentTd.getAttribute('data-row-index'));
    const currentField = currentTd.getAttribute('data-field');
    const currentFieldIndex = encomendasData.fields.findIndex(f => f.key === currentField);

    let nextRow = currentRow;
    let nextFieldIndex = currentFieldIndex;

    const datesLen = (typeof datesToRender !== 'undefined' ? datesToRender.length : encomendasData.dates.length);

    if (e.key === 'ArrowUp') {
        nextRow = Math.max(0, currentRow - 1);
    } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
        nextRow = Math.min(datesLen - 1, currentRow + 1);
    } else if (e.key === 'ArrowLeft') {
        nextFieldIndex = Math.max(0, currentFieldIndex - 1);
    } else if (e.key === 'ArrowRight' || e.key === 'Tab') {
        nextFieldIndex = Math.min(encomendasData.fields.length - 1, currentFieldIndex + 1);
    }

    const nextField = encomendasData.fields[nextFieldIndex];
    const nextCell = document.querySelector(
        `.excel-cell[data-row-index="${nextRow}"][data-field="${nextField.key}"]`
    );
    if (!nextCell) return true;

    // Focar na célula seguinte — dependendo do tipo
    const nextInput = nextCell.querySelector('input, select');
    if (nextInput) {
        nextInput.focus();
        if (nextInput.tagName === 'INPUT' && nextInput.select) nextInput.select();
    } else if (nextCell.contentEditable === 'true') {
        nextCell.focus();
        const range = document.createRange();
        range.selectNodeContents(nextCell);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }
    return true;
}

// 🆕 v2.52.13: Listener GLOBAL de paste para o Mapa de Encomendas
// Funciona em qualquer célula (contenteditable, input, select) dentro do grid
document.addEventListener('paste', function(e) {
    // Só actuar se o target está dentro do grid de encomendas
    const target = e.target;
    if (!target || !target.closest) return;
    const cell = target.closest('.excel-cell[data-original-index]');
    if (!cell) return;

    const text = (e.clipboardData || window.clipboardData || e.originalEvent?.clipboardData)?.getData('text');
    if (!text) return;

    console.log('📋 [global paste] Paste detetado em', cell.getAttribute('data-field'), '— text len:', text.length);

    // Se tem tabs ou newlines, é paste multi-cel — processar SEMPRE (mesmo com _encClipboard activo)
    if (text.includes('\t') || text.includes('\n')) {
        e.preventDefault();
        e.stopPropagation();
        pasteMultiCell(text, cell);
    }
    // Senão (single cell text), deixar o comportamento nativo funcionar
}, true); // capture phase — intercetar antes dos handlers do input/cell

// 🆕 v2.52.12: Paste multi-celular (contenteditable + input TRANSP + select HORARIO + OBS)
function pasteMultiCell(pastedText, startTd) {
    const normalized = pastedText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const rows = normalized.split('\n');
    while (rows.length > 0 && rows[rows.length - 1] === '') rows.pop();
    if (rows.length === 0) return;

    const startRow = parseInt(startTd.getAttribute('data-row-index'));
    const startField = startTd.getAttribute('data-field');
    const startFieldIndex = encomendasData.fields.findIndex(f => f.key === startField);
    if (isNaN(startRow) || startFieldIndex === -1) return;

    console.log(`📋 Colando ${rows.length} linha(s) x ${rows[0].split('\t').length} col(s)`);
    let pastedCount = 0;

    rows.forEach((rowText, rowOffset) => {
        const cells = rowText.split('\t');
        cells.forEach((cellValue, colOffset) => {
            const targetRow = startRow + rowOffset;
            const targetFieldIndex = startFieldIndex + colOffset;
            if (targetFieldIndex >= encomendasData.fields.length) return;

            const targetField = encomendasData.fields[targetFieldIndex];
            if (targetField.key === 'sem') return; // semana é calculada automaticamente

            const targetCell = document.querySelector(
                `.excel-cell[data-row-index="${targetRow}"][data-field="${targetField.key}"]`
            );
            if (!targetCell) return;

            const cleanValue = cellValue.trim();
            const originalIdx = parseInt(targetCell.getAttribute('data-original-index'));
            if (isNaN(originalIdx)) return;

            // Aplicar consoante o tipo de célula
            let applied = false;
            if (targetField.key === 'transp') {
                const input = targetCell.querySelector('input.transp-input');
                if (input) { input.value = cleanValue; applied = true; }
                if (cleanValue && typeof saveNewTransportador === 'function') {
                    saveNewTransportador(cleanValue);
                }
            } else if (targetField.key === 'horario_carga') {
                const sel = targetCell.querySelector('select.horario-select');
                if (sel) {
                    const valid = Array.from(sel.options).some(o => o.value === cleanValue);
                    if (valid) { sel.value = cleanValue; applied = true; }
                    else return; // valor inválido, não colar
                }
            } else {
                // Célula de texto (cliente, local, medida, qtd, et, enc, nviagem, obs)
                // Escreve o texto visualmente se possível (se não for contenteditable, o DOM
                // não muda mas os dados SÃO guardados na próxima sincronização)
                targetCell.textContent = cleanValue;
                applied = true;
            }

            if (!applied) return;

            // Sempre actualizar os dados em memória e enfileirar save
            encomendasData.data[`${originalIdx}_${targetField.key}`] = cleanValue;
            queueSave(originalIdx, targetField.key, cleanValue);
            pastedCount++;
        });
    });

    console.log(`✅ pasteMultiCell: ${pastedCount} célula(s) coladas`);
    showToast(`✅ ${pastedCount} célula(s) coladas`, 'success');
}

// ✅ SISTEMA DE MATRIZ DE CARGA COM SELEÇÃO MÚLTIPLA E MERGE VISUAL
let selectedCells = [];
let matrixData = {}; // {cellId: {tipo, mergedCells: [], isGroup: bool}}
let mergedGroups = []; // [{cells: [], tipo: string}]

// 🔥 v2.52.2 + v2.52.5: Clipboard interno para copiar/cortar/colar células do Mapa Encomendas
// Suporta seleção múltipla (linhas + colunas), formato matriz
let _encClipboard = null;
// Formato: {
//   mode: 'copy'|'cut',
//   matrix: [ [{field, value}, ...], ...],  // array de linhas, cada linha array de células ordenadas
//   fields: [field1, field2, ...],           // colunas (ordem das colunas)
//   sourceRows: [originalIdx, ...]           // linhas de origem (para cut)
// }

// Seleção de múltiplas células do mapa de encomendas
let _encSelection = new Set(); // Set de "originalIdx_field"
let _selectionAnchor = null;   // célula de partida para Shift+click

function _encClearSelection() {
    document.querySelectorAll('.excel-cell.enc-selected').forEach(c => {
        c.classList.remove('enc-selected');
        c.style.background = '';
    });
    _encSelection.clear();
}

function _encSelectCell(cell, additive) {
    const idx = cell.getAttribute('data-original-index');
    const field = cell.getAttribute('data-field');
    if (!idx || !field) return;
    if (!additive) _encClearSelection();
    const key = `${idx}_${field}`;
    _encSelection.add(key);
    cell.classList.add('enc-selected');
    cell.style.background = 'rgba(0, 122, 255, 0.18)';
}

// Registar clicks com Ctrl/Shift para seleção múltipla
document.addEventListener('mousedown', function(e) {
    const cell = e.target.closest?.('.excel-cell');
    if (!cell || !cell.getAttribute('data-original-index')) {
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey) _encClearSelection();
        return;
    }
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        _encSelectCell(cell, true);
        _selectionAnchor = cell;
    } else if (e.shiftKey && _selectionAnchor) {
        e.preventDefault();
        // Seleccionar rectângulo de anchor até cell actual
        const a = _selectionAnchor;
        const aRow = parseInt(a.getAttribute('data-original-index'));
        const bRow = parseInt(cell.getAttribute('data-original-index'));
        const aFieldIdx = encomendasData.fields.findIndex(f => f.key === a.getAttribute('data-field'));
        const bFieldIdx = encomendasData.fields.findIndex(f => f.key === cell.getAttribute('data-field'));

        _encClearSelection();
        const rowMin = Math.min(aRow, bRow), rowMax = Math.max(aRow, bRow);
        const fMin = Math.min(aFieldIdx, bFieldIdx), fMax = Math.max(aFieldIdx, bFieldIdx);
        for (let r = rowMin; r <= rowMax; r++) {
            for (let f = fMin; f <= fMax; f++) {
                const fieldKey = encomendasData.fields[f].key;
                const targetCell = document.querySelector(`.excel-cell[data-original-index="${r}"][data-field="${fieldKey}"]`);
                if (targetCell) _encSelectCell(targetCell, true);
            }
        }
    } else {
        // Click normal: limpar selecção mas não impedir foco/edição
        _encClearSelection();
        _selectionAnchor = cell;
    }
}, true);

// Listener global de teclado para Ctrl+C/X/V no Mapa de Encomendas
document.addEventListener('keydown', function(e) {
    const activeEl = document.activeElement;
    const isEncCell = activeEl?.classList?.contains('excel-cell') &&
                      activeEl?.getAttribute('data-original-index');

    const isCtrl = e.ctrlKey || e.metaKey;

    // 🔥 v2.52.18: se o foco está num input/select (TRANSP/HORÁRIO) — fora do
    // nosso controlo — e há um Ctrl+C/X/V: limpar _encClipboard antes de deixar
    // passar. Assim o Ctrl+V a seguir não cola dados antigos de um copy interno
    // que já não é relevante — cai para o handler de paste event (clipboard do
    // sistema), que é o que o utilizador espera depois de copiar texto num input.
    if (!isEncCell && _encSelection.size === 0) {
        if (isCtrl && (e.key === 'c' || e.key === 'C' || e.key === 'x' || e.key === 'X')) {
            _encClipboard = null;
        }
        return;
    }

    if (!isCtrl) return;

    // Helper: obter lista de células a copiar — selecção múltipla OU célula focada
    function getCellsToOperate() {
        if (_encSelection.size > 0) {
            // Seleção múltipla: construir matriz por linha
            const byRow = new Map();
            _encSelection.forEach(key => {
                // 🔥 v2.52.15: usar PRIMEIRO underscore (idx é numérico); o last
                // partia chaves como "346_horario_carga" em idx=346_horario/field=carga
                const firstUnderscore = key.indexOf('_');
                const idx = parseInt(key.substring(0, firstUnderscore));
                const field = key.substring(firstUnderscore + 1);
                if (!byRow.has(idx)) byRow.set(idx, new Set());
                byRow.get(idx).add(field);
            });
            const sortedRows = [...byRow.keys()].sort((a, b) => a - b);
            // Determinar colunas (união de todos os fields seleccionados, por ordem do fields)
            const allFields = new Set();
            byRow.forEach(fs => fs.forEach(f => allFields.add(f)));
            const orderedFields = encomendasData.fields.filter(f => allFields.has(f.key)).map(f => f.key);

            const matrix = sortedRows.map(row => {
                return orderedFields.map(field => {
                    const hasField = byRow.get(row).has(field);
                    return {
                        field,
                        value: hasField ? (encomendasData.data[`${row}_${field}`] || '') : null,
                        skip: !hasField  // célula vazia do rectângulo (não alterar no paste)
                    };
                });
            });
            return { matrix, fields: orderedFields, sourceRows: sortedRows };
        }
        // 🔥 v2.52.18: Fallback — SÓ a célula focada (antes copiava a linha toda
        // incluindo SEM, o que desalinhava colunas no paste). Se precisares de
        // copiar a linha, usa shift+click de SEM/CLIENTE até OBS.
        const originalIdx = parseInt(activeEl.getAttribute('data-original-index'));
        const focusedField = activeEl.getAttribute('data-field');
        if (!focusedField) {
            // Defensivo: sem data-field, sai sem fazer nada
            return { matrix: [], fields: [], sourceRows: [] };
        }
        return {
            matrix: [[{
                field: focusedField,
                value: encomendasData.data[`${originalIdx}_${focusedField}`] || '',
                skip: false
            }]],
            fields: [focusedField],
            sourceRows: [originalIdx]
        };
    }

    if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        e.stopPropagation();
        const { matrix, fields, sourceRows } = getCellsToOperate();
        _encClipboard = { mode: 'copy', matrix, fields, sourceRows };
        // Também copiar para o clipboard do sistema (para poder colar noutras apps)
        const tsv = matrix.map(row => row.map(c => c.skip ? '' : (c.value || '')).join('\t')).join('\n');
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(tsv).catch(() => {});
        const cellCount = matrix.reduce((s, row) => s + row.filter(c => !c.skip).length, 0);
        showToast(`📋 ${cellCount} célula(s) de ${matrix.length} linha(s) copiadas`, 'info');
    }

    if (e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        e.stopPropagation();
        const { matrix, fields, sourceRows } = getCellsToOperate();
        _encClipboard = { mode: 'cut', matrix, fields, sourceRows };
        const tsv = matrix.map(row => row.map(c => c.skip ? '' : (c.value || '')).join('\t')).join('\n');
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(tsv).catch(() => {});
        // Marcar visualmente origem
        sourceRows.forEach(idx => {
            fields.forEach(f => {
                const c = document.querySelector(`.excel-cell[data-original-index="${idx}"][data-field="${f}"]`);
                if (c) c.style.opacity = '0.4';
            });
        });
        showToast(`✂️ ${matrix.length} linha(s) cortadas`, 'info');
    }

    if ((e.key === 'v' || e.key === 'V') && _encClipboard) {
        e.preventDefault();
        e.stopPropagation();

        // Destino: célula focada como canto superior esquerdo
        // 🔥 v2.52.15: se o foco está num input/select DENTRO de uma célula,
        // subir ao TD pai em vez de cair no fallback (primeira célula do grid)
        const targetCell = activeEl?.classList?.contains('excel-cell') ? activeEl :
                           activeEl?.closest?.('.excel-cell[data-original-index]') ||
                           document.querySelector('.excel-cell[data-original-index]');
        if (!targetCell) return;

        const targetStartIdx = parseInt(targetCell.getAttribute('data-original-index'));
        const targetStartField = targetCell.getAttribute('data-field');
        const targetFieldStartIdx = encomendasData.fields.findIndex(f => f.key === targetStartField);

        // Colar a matriz com o canto superior esquerdo na célula focada
        const { matrix, fields: srcFields } = _encClipboard;

        // Mapear datas actuais para obter originalIndex a partir de row offset
        // Construir lista ORDENADA de originalIndex a partir do grid actual (visíveis)
        const visibleCells = document.querySelectorAll('.excel-cell[data-original-index]');
        const visibleRows = [...new Set([...visibleCells].map(c => parseInt(c.getAttribute('data-original-index'))))];
        visibleRows.sort((a, b) => {
            // Preservar ordem do DOM (row-index para ordenação)
            const aCell = document.querySelector(`.excel-cell[data-original-index="${a}"]`);
            const bCell = document.querySelector(`.excel-cell[data-original-index="${b}"]`);
            return parseInt(aCell?.getAttribute('data-row-index') || 0) -
                   parseInt(bCell?.getAttribute('data-row-index') || 0);
        });
        const targetRowPos = visibleRows.indexOf(targetStartIdx);
        if (targetRowPos < 0) { showToast('❌ Erro ao colar: linha destino não encontrada', 'error'); return; }

        let pastedCount = 0;
        matrix.forEach((row, rowOffset) => {
            const destRowPos = targetRowPos + rowOffset;
            if (destRowPos >= visibleRows.length) return;
            const destOriginalIdx = visibleRows[destRowPos];

            row.forEach((cellData, colOffset) => {
                if (cellData.skip) return;
                const destFieldIdx = targetFieldStartIdx + colOffset;
                if (destFieldIdx >= encomendasData.fields.length) return;
                const destField = encomendasData.fields[destFieldIdx].key;
                if (destField === 'sem') return; // nunca sobrescrever semana

                const value = cellData.value || '';
                const dataKey = `${destOriginalIdx}_${destField}`;
                encomendasData.data[dataKey] = value;
                queueSave(destOriginalIdx, destField, value);

                const destCell = document.querySelector(`.excel-cell[data-original-index="${destOriginalIdx}"][data-field="${destField}"]`);
                if (destCell) {
                    if (destCell.contentEditable === 'true') {
                        destCell.textContent = value;
                    } else {
                        // 🔥 v2.52.15: TRANSP usa <input>, HORÁRIO usa <select> — tratar ambos
                        const sel = destCell.querySelector('select');
                        const inp = destCell.querySelector('input');
                        if (sel) {
                            const valid = Array.from(sel.options).some(o => o.value === value);
                            if (valid) sel.value = value;
                            // se não for opção válida, data fica guardado mas select mantém o anterior
                        } else if (inp) {
                            inp.value = value;
                        }
                    }
                }
                pastedCount++;
            });
        });

        // Se foi CUT, limpar origem
        if (_encClipboard.mode === 'cut') {
            _encClipboard.sourceRows.forEach(idx => {
                _encClipboard.fields.forEach(field => {
                    if (field === 'sem') return;
                    // Apenas limpar se era célula não-skip na matriz original
                    const rowInMatrix = _encClipboard.matrix[_encClipboard.sourceRows.indexOf(idx)];
                    const cellInfo = rowInMatrix?.find(c => c.field === field);
                    if (!cellInfo || cellInfo.skip) return;
                    encomendasData.data[`${idx}_${field}`] = '';
                    queueSave(idx, field, '');
                    const src = document.querySelector(`.excel-cell[data-original-index="${idx}"][data-field="${field}"]`);
                    if (src) {
                        src.style.opacity = '1';
                        if (src.contentEditable === 'true') {
                            src.textContent = '';
                        } else {
                            // 🔥 v2.52.15: limpar também inputs (TRANSP) no cut-cleanup
                            const sel = src.querySelector('select');
                            const inp = src.querySelector('input');
                            if (sel) sel.value = '';
                            else if (inp) inp.value = '';
                        }
                    }
                });
            });
            _encClipboard = null;
            showToast(`✅ ${pastedCount} célula(s) movidas`, 'success');
        } else {
            showToast(`✅ ${pastedCount} célula(s) coladas (Ctrl+V para colar mais)`, 'success');
        }
    }
}, true); // useCapture: true para intercetar antes do listener por-célula

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
        
        // 🔥 v2.51.37: Footer handling - permitir footer-1 E footer-2 separados
        if (cellId.startsWith('footer') || data.isFooter) {
            // Salvar cada footer separadamente (footer-1, footer-2)
            if (!processedCells.has(cellId)) {
                result.push({
                    posicao: cellId, // 'footer-1' ou 'footer-2'
                    tipo_palete: data.tipo
                });
                processedCells.add(cellId);
                console.log(`   💾 BD: ${cellId} → "${data.tipo}"`);
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
    
    // 🔐 v2.52.0: Verificar permissão
    if (!canEdit('planeamento')) {
        showToast('⚠️ Não tem permissão para guardar secagens', 'error');
        return;
    }
    
    const secagemId = document.getElementById('secagem-id').value;
    const estufaId = parseInt(document.getElementById('input-estufa').value);
    const startTime = document.getElementById('input-start').value;
    const duration = parseInt(document.getElementById('input-duration').value);
    const obs = document.getElementById('input-obs').value;
    const tipoSecagem = document.getElementById('input-tipo-secagem')?.value || 'Dry';
    const qtdTotal = parseInt(document.getElementById('input-qtd-total')?.value) || null;
    
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
                tipo_secagem: tipoSecagem,
                qtd_total: qtdTotal,
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
                tipo_secagem: tipoSecagem,
                qtd_total: qtdTotal,
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
    // 🔐 v2.52.0: Verificar permissão
    if (!canEdit('planeamento')) {
        showToast('⚠️ Não tem permissão para eliminar secagens', 'error');
        return;
    }
    
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

// REALTIME + AUTO-REFRESH para TV
function setupRealtime() {
    const channel = db
        .channel('secagens-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'secagens' }, async () => {
            await loadAllData();
            const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
            if (activeTab === 'visualizacao') loadDashboard();
        })
        .subscribe();
}

// 🆕 v2.51.36h: Sistema de Auto-Refresh para TV (todas as tabs)
let autoRefreshInterval = null;
const AUTO_REFRESH_SECONDS = 60; // Atualizar a cada 60 segundos

function startAutoRefresh() {
    console.log(`🔄 Auto-refresh ativado (atualiza a cada ${AUTO_REFRESH_SECONDS}s)`);
    
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    
    // 🆕 v2.51.36h: Mostrar indicador visual
    const indicator = document.getElementById('reload-indicator');
    if (indicator) {
        indicator.style.display = 'block';
    }
    
    autoRefreshInterval = setInterval(() => {
        const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;

        // 🔥 v2.52.5: NUNCA recarregar se o utilizador está a editar
        //    - Célula com foco
        //    - Saves pendentes
        //    - Ou cópia a decorrer
        const editingCell = document.activeElement?.classList?.contains('excel-cell');
        const hasPendingSaves = typeof saveQueue !== 'undefined' && saveQueue.size > 0;
        const isSaving = typeof window._isSaving !== 'undefined' && window._isSaving;

        if (editingCell || hasPendingSaves || isSaving) {
            console.log(`⏸️ Auto-refresh SKIPPED (editing=${!!editingCell}, pending=${hasPendingSaves}, saving=${isSaving})`);
            return;
        }

        console.log(`%c🔄 AUTO-REFRESH EXECUTADO (tab: ${activeTab})`, 'background: #34C759; color: white; font-size: 14px; font-weight: bold; padding: 5px;');

        if (indicator) {
            indicator.style.opacity = '1';
            indicator.style.transform = 'scale(1.3)';
            setTimeout(() => {
                indicator.style.opacity = '0.5';
                indicator.style.transform = 'scale(1)';
            }, 800);
        }

        switch(activeTab) {
            case 'planeamento':
                loadAllData();
                break;
            case 'visualizacao':
                loadAllData().then(() => loadDashboard());
                break;
            case 'encomendas':
                // 🔥 v2.52.5: No mapa de encomendas, o Realtime já sincroniza alterações.
                // Auto-refresh pesado é desnecessário e destrutivo. Só recarregar se não houver Realtime.
                if (typeof isRealtimeActive === 'undefined' || !isRealtimeActive) {
                    loadEncomendasData().then(() => renderEncomendasGrid());
                }
                break;
            case 'calendario':
                loadEncomendasData().then(() => renderCalendario());
                break;
            case 'cargas-resumo':
                loadEncomendasData().then(() => renderResumoCargas());
                break;
        }
    }, AUTO_REFRESH_SECONDS * 1000);
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        console.log('🛑 Auto-refresh desativado');
        
        // 🆕 v2.51.36h: Ocultar indicador visual
        const indicator = document.getElementById('reload-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }
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
    
    // 🔥 BUGFIX v2.52.0: SEMPRE revalidar currentWeek ao gerar tabs
    // Corrige bug crítico: ao mudar de mês, currentWeek ficava com valor do mês anterior
    // (ex: semana 15 de Abril) que não existe no novo mês (ex: Maio tem semanas 18-22),
    // causando filtro que esconde TODOS os dados do mês.
    if (weekTabs.length > 0) {
        // Se currentWeek já é válida para este mês, manter
        if (currentWeek && weekTabs.includes(currentWeek)) {
            console.log(`📅 Semana ${currentWeek} mantida (válida para este mês)`);
        } else {
            const today = new Date();
            const currentWeekNumber = getWeekNumber(today);

            // Se semana atual existe nas tabs, selecionar ela
            if (weekTabs.includes(currentWeekNumber)) {
                currentWeek = currentWeekNumber;
                console.log(`📅 Semana ATUAL selecionada automaticamente: Semana ${currentWeek}`);
            } else {
                // Fallback: semana mais próxima da atual
                const closest = weekTabs.reduce((prev, curr) =>
                    Math.abs(curr - currentWeekNumber) < Math.abs(prev - currentWeekNumber) ? curr : prev
                );
                currentWeek = closest;
                console.log(`⚠️ Semana atual (${currentWeekNumber}) não encontrada. Usando mais próxima: Semana ${currentWeek}`);
            }
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

// 🆕 v2.52.13: Header com dia da semana no início de cada bloco de dia
function addDayHeader(tbody, dateStr) {
    // dateStr formato "DD/mmm" (ex: "14/abr")
    const [day, monthAbbr] = dateStr.split('/');
    const monthMap = {jan:0,fev:1,mar:2,abr:3,mai:4,jun:5,jul:6,ago:7,set:8,out:9,nov:10,dez:11};
    const dateObj = new Date(currentYear, monthMap[monthAbbr] || 0, parseInt(day));
    const dayNames = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
    const dayName = dayNames[dateObj.getDay()];

    const tr = document.createElement('tr');
    tr.className = 'excel-day-header';
    const td = document.createElement('td');
    td.colSpan = encomendasData.fields.length + 1;
    td.style.cssText = `
        background: linear-gradient(135deg, #1a1a2e, #16213e);
        color: white;
        font-weight: 700;
        font-size: 12px;
        padding: 8px 14px;
        text-align: left;
        letter-spacing: 0.5px;
        border: none;
    `;
    td.innerHTML = `📅 ${dayName} — <span style="opacity:0.85;font-weight:600;">${dateStr}</span>`;
    tr.appendChild(td);
    tbody.appendChild(tr);
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

// 🆕 v2.52.0: Setup paste handler para copy/paste de Excel
function setupExcelPasteHandler() {
    const table = document.getElementById('encomendas-grid');
    if (!table) return;
    
    // Remove handler antigo se existir
    table.removeEventListener('paste', handleExcelPaste);
    
    // Adiciona novo handler
    table.addEventListener('paste', handleExcelPaste);
    
    console.log('✅ Excel paste handler configurado');
}

// 🆕 v2.52.0: Handler de paste do Excel
function handleExcelPaste(e) {
    // Só processar se a célula ativa for editável
    const activeCell = document.activeElement;
    if (!activeCell || !activeCell.classList.contains('excel-cell')) {
        return;
    }
    
    e.preventDefault();
    
    // Obter dados copiados
    const clipboardData = e.clipboardData || window.clipboardData;
    const pastedData = clipboardData.getData('text');
    
    if (!pastedData) {
        console.warn('⚠️ Nenhum dado para colar');
        return;
    }
    
    console.log('📋 Dados copiados:', pastedData);
    
    // Parse dos dados (Excel usa \t para colunas e \n para linhas)
    const rows = pastedData.split('\n').filter(row => row.trim());
    const parsedData = rows.map(row => row.split('\t'));
    
    console.log('📊 Dados parseados:', {
        linhas: parsedData.length,
        colunas: parsedData[0]?.length || 0,
        preview: parsedData[0]
    });
    
    // Obter posição inicial (célula ativa)
    const startRowIndex = parseInt(activeCell.getAttribute('data-row-index'));
    const startField = activeCell.getAttribute('data-field');
    
    // Obter índice do campo inicial
    const fieldKeys = encomendasData.fields.map(f => f.key);
    const startFieldIndex = fieldKeys.indexOf(startField);
    
    if (startFieldIndex === -1) {
        console.error('❌ Campo não encontrado:', startField);
        return;
    }
    
    console.log('📍 Posição inicial:', {
        linha: startRowIndex,
        campo: startField,
        fieldIndex: startFieldIndex
    });
    
    // Preencher células
    let cellsUpdated = 0;
    
    parsedData.forEach((rowData, rowOffset) => {
        const targetRowIndex = startRowIndex + rowOffset;
        
        // Verificar se a linha existe
        if (targetRowIndex >= encomendasData.dates.length) {
            console.warn(`⚠️ Linha ${targetRowIndex} não existe (pulando)`);
            return;
        }
        
        // Obter índice original da linha
        const originalIndex = encomendasIndexMapping[targetRowIndex] || targetRowIndex;
        
        rowData.forEach((cellValue, colOffset) => {
            const targetFieldIndex = startFieldIndex + colOffset;
            
            // Verificar se o campo existe
            if (targetFieldIndex >= fieldKeys.length) {
                return;
            }
            
            const targetField = fieldKeys[targetFieldIndex];
            const cellKey = `${originalIndex}_${targetField}`;
            
            // Atualizar valor
            const trimmedValue = cellValue.trim();
            encomendasData.data[cellKey] = trimmedValue;
            
            console.log(`✏️ Atualizado: ${cellKey} = "${trimmedValue}"`);
            
            // Adicionar à fila de save
            queueSave(originalIndex, targetField, trimmedValue);
            
            cellsUpdated++;
        });
    });
    
    console.log(`✅ ${cellsUpdated} células atualizadas via paste`);
    
    // Re-renderizar grid para mostrar mudanças
    renderEncomendasGrid();
    
    // Toast de sucesso
    showToast(`✅ ${cellsUpdated} células coladas com sucesso!`, 'success');
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

        // 🔥 v2.52.16 + v2.52.20: Ordenação cronológica do display (APÓS filtro de semana)
        // · Base (todos os meses): por (data → row_order). Nunca altera a data.
        // · Só MAIO/2026: dentro do dia agrupa também por (cliente → local) antes do row_order.
        //   Motivo: dedup deixou 101 encomendas dispersas que ficam melhor agrupadas.
        //   Outros meses mantêm comportamento antigo para não desordenar.
        // Só mexe no display — encomendasData.data e row_order na BD ficam intactos.
        (function sortChronologically() {
            const monthOrder = { jan:0, fev:1, mar:2, abr:3, mai:4, jun:5, jul:6, ago:7, set:8, out:9, nov:10, dez:11 };
            const useClientLocalGrouping = (currentMonth === 'mai' && currentYear === 2026);
            const pairs = datesToRender.map((date, displayIdx) => {
                const oIdx = encomendasIndexMapping[displayIdx];
                const p = {
                    date: date || '',
                    originalIdx: oIdx
                };
                if (useClientLocalGrouping) {
                    p.cliente = (encomendasData.data[`${oIdx}_cliente`] || '').trim();
                    p.local = (encomendasData.data[`${oIdx}_local`] || '').trim();
                }
                return p;
            });
            pairs.sort((a, b) => {
                // 1. Data
                const aDateEmpty = !a.date || !a.date.trim();
                const bDateEmpty = !b.date || !b.date.trim();
                if (aDateEmpty && bDateEmpty) return (a.originalIdx || 0) - (b.originalIdx || 0);
                if (aDateEmpty) return 1;  // datas vazias ficam no fim
                if (bDateEmpty) return -1;
                const [ad, am] = a.date.split('/');
                const [bd, bm] = b.date.split('/');
                const amNum = monthOrder[am] ?? 99;
                const bmNum = monthOrder[bm] ?? 99;
                if (amNum !== bmNum) return amNum - bmNum;
                const adNum = parseInt(ad) || 0;
                const bdNum = parseInt(bd) || 0;
                if (adNum !== bdNum) return adNum - bdNum;

                // 2. Só Maio 2026: agrupar por cliente/local dentro do dia
                if (useClientLocalGrouping) {
                    // Linhas vazias (sem cliente) vão para o fim, ordenadas por row_order
                    const aCliEmpty = !a.cliente;
                    const bCliEmpty = !b.cliente;
                    if (aCliEmpty && bCliEmpty) return (a.originalIdx || 0) - (b.originalIdx || 0);
                    if (aCliEmpty) return 1;
                    if (bCliEmpty) return -1;
                    if (a.cliente !== b.cliente) return a.cliente.localeCompare(b.cliente, 'pt');
                    if (a.local !== b.local) return a.local.localeCompare(b.local, 'pt');
                }

                // 3. Empate final: row_order (estável, preserva ordem de inserção)
                return (a.originalIdx || 0) - (b.originalIdx || 0);
            });
            datesToRender = pairs.map(p => p.date);
            encomendasIndexMapping = pairs.map(p => p.originalIdx);
        })();
        
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

        // 🆕 v2.52.13: Header com dia da semana no início de cada bloco de dia
        if (date !== currentDate) {
            addDayHeader(tbody, date);
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

                // 🆕 v2.52.12: Navegação + foco no select HORARIO
                select.addEventListener('keydown', (e) => encNavigate(e, td));
                select.addEventListener('focus', () => {
                    td.style.outline = '2px solid #007AFF';
                    td.style.outlineOffset = '-2px';
                    updateMyActiveCell(originalIndex, field.key);
                });
                select.addEventListener('blur', () => {
                    td.style.outline = 'none';
                    clearMyActiveCell();
                });

                td.appendChild(select);
            }
            // 🆕 v2.52.6 + v2.52.8: Campo TRANSP como combobox custom (abre ao focus, filtra ao escrever)
            else if (field.key === 'transp') {
                td.contentEditable = 'false';
                td.style.padding = '0';
                td.style.position = 'relative';

                const transpInput = document.createElement('input');
                transpInput.type = 'text';
                transpInput.className = 'transp-input';
                transpInput.value = value;
                transpInput.setAttribute('autocomplete', 'off');
                transpInput.style.cssText = `
                    width: 100%; height: 100%; min-height: 28px;
                    border: none; background: ${field.color};
                    padding: 6px 8px; font-size: 11px;
                    outline: none; box-sizing: border-box;
                `;

                // Dropdown (criado on-demand)
                let dropdown = null;
                const closeDropdown = () => {
                    if (dropdown) { dropdown.remove(); dropdown = null; }
                };
                const openDropdown = async () => {
                    closeDropdown();
                    // 🔥 v2.52.9: Garantir que a lista está carregada antes de abrir o dropdown
                    if (!_transportadoresCache || _transportadoresCache.length === 0) {
                        await loadTransportadores();
                    }
                    const rect = transpInput.getBoundingClientRect();
                    dropdown = document.createElement('div');
                    dropdown.className = 'transp-dropdown';
                    dropdown.style.cssText = `
                        position: fixed;
                        top: ${rect.bottom}px;
                        left: ${rect.left}px;
                        width: ${Math.max(rect.width, 320)}px;
                        max-height: 300px;
                        overflow-y: auto;
                        background: white;
                        border: 1px solid #D1D1D6;
                        border-radius: 6px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                        z-index: 10000;
                        font-size: 12px;
                    `;
                    document.body.appendChild(dropdown);
                    renderDropdown(transpInput.value || '');
                };
                const renderDropdown = (filter) => {
                    if (!dropdown) return;
                    const f = filter.toLowerCase().trim();
                    const typed = transpInput.value.trim();
                    const matches = (_transportadoresCache || []).filter(n => n.toLowerCase().includes(f));

                    let html = '';

                    // Se há texto escrito que não bate 100% com nenhuma opção, mostrar opção "adicionar novo"
                    const exactMatch = matches.find(n => n.toLowerCase() === f);
                    if (typed && !exactMatch) {
                        const escapedTyped = typed.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                        html += `<div class="transp-add-new" data-value="${escapedTyped}" style="padding:8px 12px;cursor:pointer;background:#FFF4E6;border-bottom:2px solid #FF9500;color:#CC6600;font-weight:600;">
                            ➕ Adicionar novo: "${escapedTyped}"
                        </div>`;
                    }

                    if (matches.length === 0 && !typed) {
                        html += `<div style="padding:8px 12px;color:#999;font-style:italic;">Lista vazia. Escreva para adicionar novo.</div>`;
                    } else {
                        html += matches.slice(0, 100).map(n => {
                            const escaped = n.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                            return `<div class="transp-option" data-value="${n.replace(/"/g, '&quot;')}" style="padding:6px 12px;cursor:pointer;border-bottom:1px solid #F0F0F0;">${escaped}</div>`;
                        }).join('');
                    }

                    dropdown.innerHTML = html;

                    dropdown.querySelectorAll('.transp-option, .transp-add-new').forEach(el => {
                        el.onmouseenter = () => {
                            if (el.classList.contains('transp-add-new')) el.style.background = '#FFE4B5';
                            else el.style.background = '#E8F4FD';
                        };
                        el.onmouseleave = () => {
                            if (el.classList.contains('transp-add-new')) el.style.background = '#FFF4E6';
                            else el.style.background = '';
                        };
                        el.onmousedown = (e) => {
                            e.preventDefault(); // prevent blur
                            transpInput.value = el.getAttribute('data-value');
                            transpInput.dispatchEvent(new Event('change'));
                            closeDropdown();
                            transpInput.blur();
                        };
                    });
                };

                const saveValue = () => {
                    const oldValue = encomendasData.data[cellKey] || '';
                    const newValue = transpInput.value.trim();
                    if (oldValue !== newValue) {
                        encomendasData.data[cellKey] = newValue;
                        const originalIdx = parseInt(td.getAttribute('data-original-index'));
                        logHistory('UPDATE', {
                            date, field_name: field.key,
                            old_value: oldValue, new_value: newValue,
                            row_order: originalIdx
                        });
                        queueSave(originalIdx, field.key, newValue);
                        if (newValue && typeof saveNewTransportador === 'function') {
                            saveNewTransportador(newValue);
                        }
                    }
                };

                transpInput.addEventListener('focus', () => {
                    td.style.outline = '2px solid #007AFF';
                    td.style.outlineOffset = '-2px';
                    updateMyActiveCell(originalIndex, field.key);
                    openDropdown();
                });
                transpInput.addEventListener('input', () => {
                    if (!dropdown) openDropdown();
                    else renderDropdown(transpInput.value || '');
                });
                transpInput.addEventListener('blur', () => {
                    td.style.outline = 'none';
                    closeDropdown();
                    saveValue();
                    clearMyActiveCell();
                });
                transpInput.addEventListener('keydown', (e) => {
                    // Primeiro tentar navegação (Tab, setas esq/dir)
                    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.key)) {
                        closeDropdown();
                        if (encNavigate(e, td)) return;
                    }
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        transpInput.blur();
                    } else if (e.key === 'Escape') {
                        closeDropdown();
                        transpInput.blur();
                    }
                });

                // 🆕 v2.52.12: Suportar paste multi-célula começando num input TRANSP
                transpInput.addEventListener('paste', (e) => {
                    const text = (e.clipboardData || window.clipboardData).getData('text');
                    // Se é multi-celula, intercetar e chamar o handler de paste multi-celular
                    if (text.includes('\t') || text.includes('\n')) {
                        e.preventDefault();
                        closeDropdown();
                        transpInput.blur();
                        pasteMultiCell(text, td);
                    }
                });

                td.appendChild(transpInput);
                td.addEventListener('click', (e) => {
                    if (e.target === td) transpInput.focus();
                });
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
                // 🔥 v2.52.4: Usar originalIndex (não index filtrado) para que outros users
                // consigam encontrar a mesma célula independentemente do filtro aplicado
                updateMyActiveCell(originalIndex, field.key);
            });
            
            td.addEventListener('blur', () => {
                td.style.outline = 'none';
                
                // 👥 FASE 3: Limpar indicador de célula ativa
                clearMyActiveCell();
            });
            
            // ⌨️ NAVEGAÇÃO COM SETAS (estilo Excel) — extraído para função global
            td.addEventListener('keydown', (e) => encNavigate(e, td));
            
            // ===== 🔥 v2.52.12 COPY/PASTE EXCEL =====
            td.addEventListener('paste', function(e) {
                if (_encClipboard) { e.preventDefault(); return; }
                e.preventDefault();
                const pastedText = (e.clipboardData || window.clipboardData).getData('text');
                pasteMultiCell(pastedText, td);
            });
            // ===== FIM COPY/PASTE EXCEL =====
            
            // Contar para sub-total se campo é QTD
            if (field.key === 'qtd' && value) {
                const qtdValue = parseFloat(value) || 0;
                weekQtdSum += qtdValue;
                dayQtdSum += qtdValue;
            }
            
            tr.appendChild(td);
        });
        
        // 🔥 v2.52.25: contar como "carga" apenas se campo TRANSP estiver preenchido
        // (consistente com "Cargas Resumo"). Antes contava por LOCAL, o que incluía
        // encomendas sem transportador atribuído (ainda não são cargas a sério).
        // Também usa `originalIndex` (não `index`) para ficar certo após o sort cronológico.
        const transpCellKey = `${originalIndex}_transp`;
        const hasTransp = encomendasData.data[transpCellKey] && encomendasData.data[transpCellKey].trim() !== '';

        if (hasTransp) {
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
    
    // 🆕 v2.52.0: Handler para copy/paste de Excel
    setupExcelPasteHandler();

    // 📊 Seleção de células estilo Excel com somatório
    setupCellSelection(table);
    
    // 🔐 v2.52.0: Aplicar permissões no grid de encomendas
    if (!canEdit('encomendas')) {
        console.log('🔐 Aplicando modo visualização no Mapa de Encomendas...');
        // Desabilitar todos os inputs e selects
        table.querySelectorAll('[contentEditable="true"]').forEach(el => {
            el.contentEditable = 'false';
            el.style.backgroundColor = '#f5f5f5';
            el.style.cursor = 'default';
        });
        table.querySelectorAll('select').forEach(select => {
            select.disabled = true;
            select.style.backgroundColor = '#f5f5f5';
        });
        // Ocultar botões de adicionar/eliminar
        table.querySelectorAll('.excel-row-insert, .excel-row-delete, .excel-add-row').forEach(btn => {
            btn.style.display = 'none';
        });
    }
    
    console.log('✅ Grid renderizado com sucesso!');

    // 🔥 v2.52.4: Re-aplicar indicadores de células activas de outros utilizadores
    // (os indicadores são perdidos quando o grid é re-renderizado)
    try { updateCellIndicators(); } catch(e) { /* presence pode não estar activa */ }

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

// 📊 Seleção de células estilo Excel com somatório na status bar
function setupCellSelection(table) {
    let isSelecting = false;
    let startCell = null;
    let selectedCells = new Set();

    // Status bar (cria uma vez, reutiliza)
    let statusBar = document.getElementById('excel-selection-status');
    if (!statusBar) {
        statusBar = document.createElement('div');
        statusBar.id = 'excel-selection-status';
        statusBar.style.cssText = 'position:fixed;bottom:16px;right:20px;background:rgba(0,0,0,0.75);color:#fff;font-size:12px;padding:6px 14px;border-radius:8px;z-index:9999;display:none;pointer-events:none;font-family:inherit;';
        document.body.appendChild(statusBar);
    }

    function getCellCoords(cell) {
        return {
            row: parseInt(cell.getAttribute('data-row-index')),
            col: encomendasData.fields.findIndex(f => f.key === cell.getAttribute('data-field'))
        };
    }

    function getCellsInRange(a, b) {
        const minRow = Math.min(a.row, b.row), maxRow = Math.max(a.row, b.row);
        const minCol = Math.min(a.col, b.col), maxCol = Math.max(a.col, b.col);
        return table.querySelectorAll('.excel-cell:not([contenteditable="false"]),[data-field]')
            ? [...table.querySelectorAll('.excel-cell')].filter(c => {
                const r = parseInt(c.getAttribute('data-row-index'));
                const col = encomendasData.fields.findIndex(f => f.key === c.getAttribute('data-field'));
                return r >= minRow && r <= maxRow && col >= minCol && col <= maxCol;
            })
            : [];
    }

    function clearSelection() {
        selectedCells.forEach(c => c.style.removeProperty('box-shadow'));
        selectedCells.clear();
        statusBar.style.display = 'none';
        // NOTA v2.52.17: não tocar em _encSelection aqui. Senão o shift+click
        // (que popula _encSelection no capture phase do document) é imediatamente
        // limpo quando o table mousedown chama esta função no bubble phase.
    }

    function applySelection(cells) {
        clearSelection();
        cells.forEach(c => {
            c.style.boxShadow = 'inset 0 0 0 2px #007AFF';
            selectedCells.add(c);
        });
        // Calcular somatório e contagem
        let sum = 0, numCount = 0, total = cells.length;
        cells.forEach(c => {
            const v = parseFloat((c.textContent || '').replace(/\./g, '').replace(',', '.'));
            if (!isNaN(v)) { sum += v; numCount++; }
        });
        if (total > 1) {
            let msg = `${total} células`;
            if (numCount > 0) msg += ` · Soma: ${Math.round(sum).toLocaleString('pt-PT')}`;
            statusBar.textContent = msg;
            statusBar.style.display = 'block';
        } else {
            statusBar.style.display = 'none';
        }
    }

    table.addEventListener('mousedown', e => {
        const cell = e.target.closest('.excel-cell');
        if (!cell) return;
        // Only start drag-select on left click without Ctrl (Ctrl+click lets normal focus work)
        if (e.button !== 0) return;
        isSelecting = true;
        startCell = cell;
        clearSelection();
        // Don't prevent default so cell still gets focus/click for editing
    });

    table.addEventListener('mousemove', e => {
        if (!isSelecting || !startCell) return;
        const cell = e.target.closest('.excel-cell');
        if (!cell) return;
        const a = getCellCoords(startCell), b = getCellCoords(cell);
        if (a.row === b.row && a.col === b.col) { clearSelection(); return; }
        applySelection(getCellsInRange(a, b));
    });

    document.addEventListener('mouseup', () => {
        // 🔥 v2.52.17: só sincronizar _encSelection se houve drag REAL (selectedCells
        // com conteúdo). Shift/Ctrl+click não passam por aqui porque não chamam
        // applySelection — o _encSelection que eles populam no capture phase
        // permanece intacto.
        if (isSelecting && selectedCells.size > 0 && typeof _encSelection !== 'undefined') {
            _encSelection.clear();
            selectedCells.forEach(c => {
                const idx = c.getAttribute('data-original-index');
                const field = c.getAttribute('data-field');
                if (idx && field) _encSelection.add(`${idx}_${field}`);
            });
        }
        isSelecting = false;
    });

    // Clear selection when clicking outside the table
    document.addEventListener('mousedown', e => {
        if (!e.target.closest('#encomendas-grid')) clearSelection();
    }, true);
}

// Carregar dados do mês da BD
async function loadEncomendasData() {
    // Garantir que as alterações pendentes são salvas ANTES de recarregar,
    // para não perder edições locais de nenhum utilizador
    if (saveQueue && saveQueue.size > 0) {
        console.log('⚠️ [load] Flushing', saveQueue.size, 'alterações pendentes antes de recarregar...');
        await processSaveQueue();
    }

    console.log('📥 Carregando encomendas para:', currentMonth + '/' + currentYear);
    
    // 🔥 v2.51.21: Atualizar dropdown do mês para o mês atual (ambos os selectors)
    const monthSelector = document.getElementById('month-selector');
    if (monthSelector && monthSelector.value !== currentMonth) {
        monthSelector.value = currentMonth;
        console.log(`📅 Dropdown atualizado para: ${currentMonth}`);
    }
    const cargasMonthSelector = document.getElementById('cargas-month-selector');
    if (cargasMonthSelector && cargasMonthSelector.value !== currentMonth) {
        cargasMonthSelector.value = currentMonth;
    }
    const resumoMonthSelector = document.getElementById('resumo-month-selector');
    if (resumoMonthSelector && resumoMonthSelector.value !== currentMonth) {
        resumoMonthSelector.value = currentMonth;
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

            // 🔥 BUGFIX v2.52.1: Verificar se o mês está completo (todos os dias úteis presentes)
            // APENAS para meses com poucos dados (ex: só import PDF, sem pré-população)
            // NÃO correr se o mês já tem estrutura razoável (>100 linhas = já foi pré-populado)
            const existingDatesSet = new Set(encomendasData.dates.filter(d => d && d.trim()));
            const monthIndex = {
                'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
                'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11
            }[currentMonth];
            const firstDay = new Date(currentYear, monthIndex, 1);
            const lastDay = new Date(currentYear, monthIndex + 1, 0);
            const expectedDates = new Set();
            for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
                const dow = d.getDay();
                if (dow >= 1 && dow <= 6) { // Seg-Sáb
                    expectedDates.add(`${String(d.getDate()).padStart(2, '0')}/${currentMonth}`);
                }
            }
            const missingDates = [...expectedDates].filter(d => !existingDatesSet.has(d));

            // Só completar se há MUITOS dias em falta (>5) e poucas linhas no total
            // Isto evita correr em meses já pré-populados que podem ter 1-2 dias removidos
            if (missingDates.length > 5 && data.length < expectedDates.size * 10) {
                console.warn(`⚠️ Mês muito incompleto: ${missingDates.length} dia(s) em falta de ${expectedDates.size}. A preencher...`);
                console.log('   Dias em falta:', missingDates.sort().join(', '));

                function dateToSortNum(dateStr) {
                    const [dd] = dateStr.split('/');
                    return parseInt(dd) || 0;
                }

                missingDates.sort((a, b) => dateToSortNum(a) - dateToSortNum(b));

                // Construir as novas linhas para inserir DIRECTAMENTE na BD (sem saveAllRows)
                const newRows = [];
                let nextRowOrder = data.length > 0 ? Math.max(...data.map(r => r.row_order || 0)) + 1 : 0;

                for (const missDate of missingDates) {
                    const dayNum = parseInt(missDate.split('/')[0]);
                    const dateObj = new Date(currentYear, monthIndex, dayNum);
                    const dow = dateObj.getDay();
                    const numLines = dow === 6 ? 5 : 20;
                    const weekNum = getWeekNumber(dateObj);

                    for (let i = 0; i < numLines; i++) {
                        newRows.push({
                            month: currentMonth,
                            year: currentYear,
                            date: missDate,
                            row_order: nextRowOrder++,
                            sem: weekNum.toString(),
                            cliente: '', local: '', medida: '', qtd: '',
                            transp: '', et: '', enc: '', nviagem: '',
                            horario_carga: '', obs: ''
                        });
                    }
                }

                // Inserir APENAS as novas linhas (sem DELETE, sem saveAllRows)
                if (newRows.length > 0) {
                    console.log(`📝 Inserindo ${newRows.length} linhas para ${missingDates.length} dias em falta...`);
                    const BATCH = 500;
                    for (let i = 0; i < newRows.length; i += BATCH) {
                        const chunk = newRows.slice(i, i + BATCH);
                        await db.from('mapa_encomendas').insert(chunk);
                    }
                    console.log(`✅ Dias em falta preenchidos. A recarregar dados...`);
                    // Recarregar dados frescos da BD (recursão segura: desta vez não haverá missing)
                    const { data: freshData } = await db.from('mapa_encomendas')
                        .select('*').eq('month', currentMonth).eq('year', currentYear);
                    if (freshData) {
                        freshData.sort((a, b) => a.row_order - b.row_order);
                        encomendasData.dates = [];
                        encomendasData.data = {};
                        freshData.forEach(row => {
                            const idx = row.row_order;
                            while (encomendasData.dates.length <= idx) encomendasData.dates.push('');
                            encomendasData.dates[idx] = row.date;
                            encomendasData.fields.forEach(field => {
                                if (row[field.key]) encomendasData.data[`${idx}_${field.key}`] = row[field.key];
                            });
                        });
                    }
                }
            }
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
// 🔥 BUGFIX v2.52.0: Proteger contra race conditions — capturar mês/ano e dados NO INÍCIO
// para que mudanças de mês durante a operação async não causem perda de dados
// 🔥 v2.52.21: Serialização global de saveAllRows.
// Várias operações (insertRowBelow, deleteRow, addNewDay, recuperar mês) chamam
// saveAllRows. Se duas corriam em paralelo (ex: dois utilizadores a fazer insert
// simultâneo, ou um clique duplo), os DELETEs + INSERTs interleavearam e
// geraram duplicados massivos (caso Maio 2026 — 1679 rows).
// Esta chain garante execução estrictamente serial: cada chamada espera pela
// anterior antes de começar.
let _saveAllRowsChain = Promise.resolve();

async function saveAllRows() {
    const previous = _saveAllRowsChain;
    let release;
    _saveAllRowsChain = new Promise(resolve => { release = resolve; });
    try {
        // esperar pela anterior — ignora erro da anterior para não propagar
        try { await previous; } catch { /* intentionally ignore */ }
        return await _saveAllRowsImpl();
    } finally {
        release();
    }
}

async function _saveAllRowsImpl() {
    // 📸 SNAPSHOT: Capturar estado AGORA, antes de qualquer await
    const snapMonth = currentMonth;
    const snapYear = currentYear;
    const snapDates = [...encomendasData.dates];  // Cópia profunda do array
    const snapData = { ...encomendasData.data };  // Cópia do objeto de dados
    const snapFields = encomendasData.fields;

    console.log(`💾 Salvando todas as linhas para ${snapMonth}/${snapYear} (${snapDates.length} linhas)...`);

    // Validação de segurança: não apagar se os dados estão vazios/inconsistentes
    if (snapDates.length === 0) {
        console.error('🛡️ ABORTADO: encomendasData.dates está vazio! Não vou apagar dados da BD.');
        return;
    }

    // Validação: verificar se temos datas válidas (não apenas strings vazias)
    const validDates = snapDates.filter(d => d && d.trim());
    if (validDates.length === 0) {
        console.error('🛡️ ABORTADO: Todas as datas estão vazias! Não vou apagar dados da BD.');
        return;
    }

    try {
        // 1. Preparar todas as linhas PRIMEIRO (antes de apagar)
        const rows = snapDates.map((date, index) => {
            const row = {
                month: snapMonth,     // Usar snapshot, NÃO currentMonth
                year: snapYear,       // Usar snapshot, NÃO currentYear
                date: date,
                row_order: index
            };

            // Coletar dados de todas as células da linha
            snapFields.forEach(field => {
                const cellKey = `${index}_${field.key}`;
                row[field.key] = snapData[cellKey] || '';
            });

            return row;
        });

        // 2. Verificar se o mês mudou entre a captura e agora
        if (currentMonth !== snapMonth || currentYear !== snapYear) {
            console.warn(`🛡️ ATENÇÃO: Mês mudou durante preparação! Era ${snapMonth}/${snapYear}, agora é ${currentMonth}/${currentYear}. Continuando com snapshot original.`);
        }

        // 3. Apagar linhas do mês (usando snapshot)
        const { error: deleteError } = await db
            .from('mapa_encomendas')
            .delete()
            .eq('month', snapMonth)
            .eq('year', snapYear);

        // 🔥 v2.52.21: se o DELETE falhar, ABORTAR. Não fazer INSERT em seguida —
        // isso antes duplicava tudo quando o DELETE silenciosamente falhava.
        // A UNIQUE constraint agora também trava qualquer tentativa de duplicar,
        // mas ser explícito aqui evita pedidos inúteis à BD.
        if (deleteError) {
            console.error('❌ Erro ao apagar linhas do mês — a ABORTAR o save para não criar duplicados:', deleteError);
            if (typeof showToast === 'function') {
                showToast('❌ Erro ao salvar: DELETE falhou. Tenta novamente.', 'error');
            }
            throw deleteError;
        }

        // 4. Inserir IMEDIATAMENTE (rows já preparados, sem re-ler currentMonth)
        if (rows.length > 0) {
            // Inserir em lotes de 500 para evitar timeout
            const BATCH = 500;
            for (let i = 0; i < rows.length; i += BATCH) {
                const chunk = rows.slice(i, i + BATCH);
                const { error: insertError } = await db
                    .from('mapa_encomendas')
                    .insert(chunk);

                if (insertError) {
                    console.error(`❌ Erro ao inserir lote ${i}-${i + chunk.length}:`, insertError);
                    // Se for violação de UNIQUE constraint (23505), é sinal de que
                    // havia saves concorrentes ou estado inconsistente.
                    if (insertError.code === '23505') {
                        if (typeof showToast === 'function') {
                            showToast('⚠️ Conflito de dados detectado — outro save em curso? Recarrega a página.', 'error');
                        }
                    }
                    throw insertError;
                }
            }
        }

        console.log(`✅ Todas as ${rows.length} linhas salvas para ${snapMonth}/${snapYear}`);
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

// 🔥 BUGFIX v2.52.0: Mesma proteção que saveAllRows — snapshot no início
async function saveEncomendasData() {
    const snapMonth = currentMonth;
    const snapYear = currentYear;
    const snapDates = [...encomendasData.dates];
    const snapData = { ...encomendasData.data };
    const snapFields = encomendasData.fields;

    if (snapDates.length === 0 || snapDates.filter(d => d && d.trim()).length === 0) {
        console.error('🛡️ ABORTADO saveEncomendasData: dados vazios!');
        return;
    }

    try {
        // Preparar linhas PRIMEIRO
        const rows = snapDates.map((date, index) => {
            const row = {
                month: snapMonth,
                year: snapYear,
                date: date,
                row_order: index
            };
            snapFields.forEach(field => {
                const cellKey = `${index}_${field.key}`;
                row[field.key] = snapData[cellKey] || '';
            });
            return row;
        });

        // Apagar dados antigos do mês (usando snapshot)
        const { error: deleteError } = await db
            .from('mapa_encomendas')
            .delete()
            .eq('month', snapMonth)
            .eq('year', snapYear);

        if (deleteError) {
            console.warn('⚠️ Erro ao deletar:', deleteError);
        }

        // Inserir imediatamente
        console.log('💾 Salvando', rows.length, 'linhas no Supabase...');
        const BATCH = 500;
        for (let i = 0; i < rows.length; i += BATCH) {
            const chunk = rows.slice(i, i + BATCH);
            const { error } = await db
                .from('mapa_encomendas')
                .insert(chunk);
            if (error) throw error;
        }

        console.log(`✅ Encomendas salvas (${rows.length} linhas para ${snapMonth}/${snapYear})`);
    } catch (error) {
        console.error('❌ Erro ao salvar encomendas:', error);
        console.warn('💡 Dados mantidos em memória.');
    }
}

// ===================================================================
// FASE 2: SUPABASE REALTIME - SINCRONIZAÇÃO TEMPO REAL
// ===================================================================

// 🔥 v2.52.23: Realtime + polling fallback para sync multi-utilizador
// Problemas corrigidos vs versão anterior:
//   · Filtro composto (month+year) era inválido no Supabase Realtime — agora
//     usa filtro simples e verifica year no handler
//   · updateSingleRow usava indexing posicional do DOM, que deixou de
//     coincidir com row_order após o sort cronológico (v2.52.16/20) — agora
//     usa selector por data-original-index
//   · INSERT/DELETE não actualizavam o grid — agora trigger de soft re-render
//   · Sem fallback se Realtime caísse — agora polling de 20s verifica
//     alterações via updated_at
let _encomendasPollTimer = null;
let _lastRealtimePollAt = null;

function setupEncomendasRealtime() {
    // Cleanup: desconectar canal anterior se existir
    if (realtimeChannel) {
        console.log('🔌 Desconectando canal Realtime anterior...');
        db.removeChannel(realtimeChannel);
        realtimeChannel = null;
    }

    console.log('📡 Ativando Realtime para:', currentMonth, '/', currentYear);

    // Snapshot do mês no momento da subscrição (para usar no handler sem
    // apanhar mudanças de mês a meio)
    const subscribedMonth = currentMonth;
    const subscribedYear = currentYear;

    // Criar novo canal — filtro só por month (year é verificado no handler).
    // Supabase Realtime só aceita UM filtro por subscription.
    realtimeChannel = db.channel(`mapa-encomendas-${subscribedMonth}-${subscribedYear}`)
        .on('postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'mapa_encomendas',
                filter: `month=eq.${subscribedMonth}`
            },
            (payload) => {
                // Verificar year no cliente (Realtime não suporta filtro composto)
                const row = payload.new || payload.old;
                if (row?.year !== subscribedYear) return;
                handleRealtimeChange(payload);
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                isRealtimeActive = true;
                console.log('✅ Realtime ativo para', subscribedMonth, '/', subscribedYear);
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.error('❌ Realtime error:', status, '— fallback via polling');
                isRealtimeActive = false;
            } else if (status === 'CLOSED') {
                isRealtimeActive = false;
                console.log('🔌 Realtime desconectado');
            }
        });

    // Iniciar polling fallback (independente do Realtime — sempre activo como cinto-e-suspensórios)
    startEncomendasPolling();
}

// Handler para alterações recebidas (via Realtime OU polling)
function handleRealtimeChange(payload) {
    const eventType = payload.eventType || 'UPDATE';
    console.log('📡', eventType, 'row_order:', (payload.new || payload.old)?.row_order);

    if (eventType === 'INSERT' || eventType === 'UPDATE') {
        const row = payload.new;
        if (!row) return;
        const rowIndex = row.row_order;

        // Ignorar se há alterações locais pendentes para esta linha
        if (saveQueue.has(rowIndex)) {
            console.log('⚠️ [realtime] Linha', rowIndex, 'tem alterações pendentes — update remoto ignorado');
            return;
        }

        // Actualizar estado em memória
        const wasKnown = typeof encomendasData.dates[rowIndex] === 'string' && encomendasData.dates[rowIndex].length > 0;
        encomendasData.dates[rowIndex] = row.date || '';
        encomendasData.fields.forEach(field => {
            const cellKey = `${rowIndex}_${field.key}`;
            if (row[field.key] !== undefined) {
                encomendasData.data[cellKey] = row[field.key];
            }
        });

        if (!wasKnown && eventType === 'INSERT') {
            // Linha nova — fazer soft re-render (a célula ainda não existe no DOM)
            console.log('🆕 Linha nova — soft re-render');
            scheduleSoftRerender();
        } else {
            // Linha existente — só actualizar as células afectadas
            updateSingleRow(rowIndex);
        }

        // Não mostrar toast se a alteração é minha (isSaving indica que o save local está em curso)
        if (!isSaving) {
            showToast(`📡 Actualização de outro utilizador`, 'info');
        }
    }

    if (eventType === 'DELETE') {
        console.log('📡 Linha apagada — soft re-render');
        const row = payload.old;
        if (row) {
            const rowIndex = row.row_order;
            encomendasData.dates[rowIndex] = '';
            encomendasData.fields.forEach(field => {
                delete encomendasData.data[`${rowIndex}_${field.key}`];
            });
        }
        scheduleSoftRerender();
    }
}

// Re-render "suave": agrupa múltiplos eventos num único render, e evita
// re-render enquanto o utilizador está a editar (não perder input).
let _softRerenderTimer = null;
function scheduleSoftRerender() {
    if (_softRerenderTimer) return;  // já agendado
    _softRerenderTimer = setTimeout(() => {
        _softRerenderTimer = null;
        const activeEl = document.activeElement;
        const editing = activeEl && (
            activeEl.classList?.contains('excel-cell') ||
            activeEl.classList?.contains('transp-input') ||
            activeEl.classList?.contains('horario-select') ||
            activeEl.closest?.('.excel-cell')
        );
        if (editing) {
            // Adiar re-render — tentar outra vez daqui a 5s
            console.log('⏸️ Re-render adiado (utilizador está a editar)');
            setTimeout(scheduleSoftRerender, 5000);
            return;
        }
        try { renderEncomendasGrid(); } catch (e) { console.error('Erro no soft re-render:', e); }
    }, 300);  // debounce 300ms para agrupar eventos
}

// 🔥 v2.52.23: Polling fallback — corre de 20 em 20 segundos, busca linhas
// com updated_at mais recente que a última ronda e aplica como updates.
// Garante latência máxima de ~20s mesmo que o Realtime falhe por qualquer motivo.
function startEncomendasPolling() {
    stopEncomendasPolling();
    _lastRealtimePollAt = new Date().toISOString();
    _encomendasPollTimer = setInterval(pollEncomendasUpdates, 20_000);
    console.log('🔄 Polling fallback activo (20s)');
}

function stopEncomendasPolling() {
    if (_encomendasPollTimer) {
        clearInterval(_encomendasPollTimer);
        _encomendasPollTimer = null;
    }
}

async function pollEncomendasUpdates() {
    // Não fazer poll se não estamos na tab encomendas ou se há saves em curso
    if (isSaving) return;
    if (!currentMonth || !currentYear) return;

    const pollStart = new Date().toISOString();
    try {
        const { data, error } = await db
            .from('mapa_encomendas')
            .select('*')
            .eq('month', currentMonth)
            .eq('year', currentYear)
            .gt('updated_at', _lastRealtimePollAt);
        if (error) {
            console.warn('⚠️ poll error:', error.message);
            return;
        }
        if (data && data.length > 0) {
            console.log(`🔄 Polling encontrou ${data.length} alteração(ões) desde ${_lastRealtimePollAt}`);
            data.forEach(row => {
                handleRealtimeChange({ eventType: 'UPDATE', new: row });
            });
        }
        _lastRealtimePollAt = pollStart;
    } catch (e) {
        console.warn('⚠️ poll exception:', e?.message || e);
    }
}

// Atualizar visualmente UMA linha por data-original-index (não por posição DOM)
// 🔥 v2.52.23: usar selector por atributo em vez de nth-child. O sort cronológico
// faz com que DOM order != row_order — indexing posicional apanhava a linha errada.
function updateSingleRow(rowIndex) {
    const table = document.getElementById('encomendas-grid');
    if (!table) return;

    encomendasData.fields.forEach(field => {
        const cell = table.querySelector(
            `.excel-cell[data-original-index="${rowIndex}"][data-field="${field.key}"]`
        );
        if (!cell) return;

        const cellKey = `${rowIndex}_${field.key}`;
        const newValue = encomendasData.data[cellKey] || '';

        // Não sobrescrever célula que o utilizador está a editar
        const activeEl = document.activeElement;
        const userIsEditingThisCell =
            activeEl === cell ||
            (activeEl && cell.contains(activeEl));
        if (userIsEditingThisCell) return;

        // TRANSP — input
        const input = cell.querySelector('input.transp-input');
        if (input) {
            if (input.value !== newValue) {
                input.value = newValue;
                flashCell(cell, field.color);
            }
            return;
        }

        // HORÁRIO — select
        const sel = cell.querySelector('select.horario-select');
        if (sel) {
            const valid = Array.from(sel.options).some(o => o.value === newValue);
            if (valid && sel.value !== newValue) {
                sel.value = newValue;
                flashCell(cell, field.color);
            }
            return;
        }

        // Contenteditable
        if (cell.textContent !== newValue) {
            cell.textContent = newValue;
            flashCell(cell, field.color);
        }
    });
}

function flashCell(cell, originalColor) {
    cell.style.transition = 'background 0.5s ease';
    cell.style.background = '#90EE90';
    setTimeout(() => { cell.style.background = originalColor || ''; }, 500);
}

// Desconectar Realtime (cleanup)
function disconnectRealtime() {
    if (realtimeChannel) {
        console.log('🔌 Desconectando Realtime...');
        db.removeChannel(realtimeChannel);
        realtimeChannel = null;
        isRealtimeActive = false;
    }
    // 🔥 v2.52.23: parar polling também (é recriado em setupEncomendasRealtime)
    stopEncomendasPolling();
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
    
    // 🔥 v2.52.10: Canal GLOBAL (não depende do mês) — assim todos os users
    // aparecem online independentemente do mês que estão a ver.
    // O cursor só aparece nas células se estiverem no MESMO mês (filtro abaixo).
    presenceChannel = db.channel('presence-mapa-encomendas-global', {
        config: {
            presence: {
                key: currentUser.id
            }
        }
    });

    // Estado inicial do utilizador (inclui mês/ano para filtrar cursor)
    myPresenceState = {
        user_id: currentUser.id,
        user_name: currentUser.email.split('@')[0],
        user_email: currentUser.email,
        color: userColor,
        active_cell: null,
        month: currentMonth,  // 🆕 permite filtrar cursor por mês
        year: currentYear,
        last_seen: new Date().toISOString()
    };
    
    // Track presence state (quem está online) — sync inicial / join / leave
    presenceChannel.on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        console.log('👥 Presença sincronizada:', Object.keys(state).length, 'users', state);

        // Reconstruir onlineUsers do state (preservando active_cell vindo por broadcast)
        const newMap = new Map();
        Object.entries(state).forEach(([userId, presences]) => {
            if (userId === currentUser.id) return;
            const presence = presences[0];
            if (!presence) return;
            const existing = onlineUsers.get(userId);
            newMap.set(userId, {
                user_name: presence.user_name,
                user_email: presence.user_email,
                color: presence.color,
                // preservar active_cell se já existia (do broadcast)
                active_cell: existing?.active_cell || null,
            });
        });
        onlineUsers = newMap;

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
        // Remover active_cell quando user sai (evitar borda "fantasma")
        onlineUsers.delete(key);
        updateOnlineUsersList();
        updateCellIndicators();
    });

    // 🆕 v2.52.7: Usar BROADCAST para actualizações de cursor (em tempo real, sem throttling de Presence)
    presenceChannel.on('broadcast', { event: 'cursor' }, (msg) => {
        const { userId, active_cell, color, user_name, month, year } = msg.payload || {};
        if (!userId || userId === currentUser?.id) return; // ignorar self

        // 🔥 v2.52.10: Só mostrar cursor se estiver no MESMO mês/ano
        const sameMonth = month === currentMonth && year === currentYear;

        const existing = onlineUsers.get(userId) || {};
        onlineUsers.set(userId, {
            ...existing,
            user_name: user_name || existing.user_name || 'Utilizador',
            color: color || existing.color || '#ff9500',
            month, year,
            // Se está noutro mês, active_cell fica null (não mostra cursor)
            active_cell: sameMonth ? active_cell : null
        });
        updateCellIndicators();
    });

    // Subscribe e fazer track do estado
    presenceChannel.subscribe(async (status) => {
        _presenceSubStatus = status;
        console.log(`📡 Canal presença: ${status}`);

        if (status === 'SUBSCRIBED') {
            console.log('✅ Presença ativa!');
            await presenceChannel.track(myPresenceState);

            // Broadcast inicial (caso tenha célula activa)
            if (currentActiveCell) {
                await presenceChannel.send({
                    type: 'broadcast',
                    event: 'cursor',
                    payload: {
                        userId: currentUser.id,
                        user_name: myPresenceState.user_name,
                        color: myPresenceState.color,
                        active_cell: currentActiveCell,
                        month: currentMonth,
                        year: currentYear
                    }
                });
            }
            showToast('👥 Sistema de presença ativo', 'success');
        }

        // 🆕 v2.52.11: Auto-reconnect se o canal cair
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`⚠️ Canal presença caiu (${status}). A reconectar em 3s...`);
            setTimeout(() => {
                if (currentUser && _presenceSubStatus !== 'SUBSCRIBED') {
                    setupPresence();
                }
            }, 3000);
        }
    });

    // 🆕 v2.52.11: Heartbeat — re-track a cada 15s (mantém sync mesmo com tab em background)
    if (_presenceHeartbeat) clearInterval(_presenceHeartbeat);
    _presenceHeartbeat = setInterval(async () => {
        if (!presenceChannel || _presenceSubStatus !== 'SUBSCRIBED') return;
        try {
            myPresenceState.last_seen = new Date().toISOString();
            myPresenceState.month = currentMonth;
            myPresenceState.year = currentYear;
            await presenceChannel.track(myPresenceState);
            // Também re-broadcast do cursor actual (se houver)
            if (currentActiveCell) {
                await presenceChannel.send({
                    type: 'broadcast',
                    event: 'cursor',
                    payload: {
                        userId: currentUser.id,
                        user_name: myPresenceState.user_name,
                        color: myPresenceState.color,
                        active_cell: currentActiveCell,
                        month: currentMonth,
                        year: currentYear
                    }
                });
            }
            console.log('💓 Presence heartbeat');
        } catch (e) {
            console.warn('⚠️ Heartbeat falhou:', e);
        }
    }, 15000);

    // 🆕 v2.52.11: Re-sync ao voltar de background (visibility change)
    if (!window._encPresenceVisListener) {
        window._encPresenceVisListener = true;
        document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'visible' && presenceChannel && _presenceSubStatus === 'SUBSCRIBED') {
                console.log('👁️ Tab visível — forçar re-sync presence');
                try {
                    await presenceChannel.track(myPresenceState);
                } catch (e) {}
            }
        });
    }
}

// 🆕 v2.52.7: Usar BROADCAST para cursor (muito mais rápido e sem throttling de Presence)
async function updateMyActiveCell(rowIndex, fieldKey) {
    if (!presenceChannel || !myPresenceState) return;

    currentActiveCell = { rowIndex, fieldKey };

    // Broadcast imediato para todos os peers
    try {
        await presenceChannel.send({
            type: 'broadcast',
            event: 'cursor',
            payload: {
                userId: currentUser.id,
                user_name: myPresenceState.user_name,
                color: myPresenceState.color,
                active_cell: currentActiveCell,
                month: currentMonth,   // 🆕 v2.52.10
                year: currentYear
            }
        });
        console.log('📍 Cursor enviado:', rowIndex, fieldKey);
    } catch (error) {
        console.warn('⚠️ Erro ao enviar cursor:', error);
    }
}

// Limpar célula ativa (quando utilizador sai da célula)
async function clearMyActiveCell() {
    if (!presenceChannel || !myPresenceState) return;

    currentActiveCell = null;

    // 🆕 v2.52.7: Broadcast para limpar o cursor dos outros users
    try {
        await presenceChannel.send({
            type: 'broadcast',
            event: 'cursor',
            payload: {
                userId: currentUser.id,
                user_name: myPresenceState.user_name,
                color: myPresenceState.color,
                active_cell: null,
                month: currentMonth,   // 🆕 v2.52.10
                year: currentYear
            }
        });
    } catch (error) {
        console.warn('⚠️ Erro ao limpar cursor:', error);
    }
}

// Atualizar indicadores visuais nas células
function updateCellIndicators() {
    const table = document.getElementById('encomendas-grid');
    if (!table) {
        console.log('🎨 [indicators] Sem grid, skip');
        return;
    }

    // Limpar todos os indicadores anteriores
    table.querySelectorAll('.user-indicator, .user-label').forEach(el => el.remove());
    table.querySelectorAll('.excel-cell.peer-editing').forEach(cell => {
        cell.classList.remove('peer-editing');
        cell.style.removeProperty('--peer-color');
    });

    console.log(`🎨 [indicators] Aplicando para ${onlineUsers.size} utilizadores online`);

    // Adicionar indicadores para cada utilizador online
    onlineUsers.forEach((presence, userId) => {
        if (!presence.active_cell) {
            console.log(`   - ${presence.user_name || userId}: sem célula activa`);
            return;
        }

        const { rowIndex, fieldKey } = presence.active_cell;
        console.log(`   📍 ${presence.user_name || userId} (${presence.color}) a editar row=${rowIndex} field=${fieldKey}`);

        // 🔥 v2.52.4: Procurar célula pelo originalIndex (não por posição no DOM)
        const cell = table.querySelector(
            `.excel-cell[data-original-index="${rowIndex}"][data-field="${fieldKey}"]`
        );
        if (!cell) {
            console.warn(`   ⚠️ Célula não encontrada: [data-original-index="${rowIndex}"][data-field="${fieldKey}"]`);
            return;
        }
        console.log(`   ✅ Célula encontrada, aplicando borda cor ${presence.color}`);

        // 🆕 v2.52.6: Apenas classe + CSS var — os estilos vêm do CSS com !important
        // (evita sobreposição pelos estilos default da .excel-cell)
        cell.classList.add('peer-editing');
        cell.style.setProperty('--peer-color', presence.color);

        // Avatar no canto superior direito
        const indicator = document.createElement('div');
        indicator.className = 'user-indicator';
        indicator.style.cssText = `
            position: absolute;
            top: -12px;
            right: -8px;
            width: 28px;
            height: 28px;
            background: ${presence.color};
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: bold;
            border: 2px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
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
    if (_presenceHeartbeat) {
        clearInterval(_presenceHeartbeat);
        _presenceHeartbeat = null;
    }
    if (presenceChannel) {
        console.log('👥 Desconectando presença...');
        try { presenceChannel.untrack(); } catch(e) {}
        try { db.removeChannel(presenceChannel); } catch(e) {}
        presenceChannel = null;
        onlineUsers.clear();
        _presenceSubStatus = null;
    }
}

// ===================================================================
// FUNÇÕES DE NAVEGAÇÃO E UTILITÁRIOS
// ===================================================================

// Mudar mês
async function changeMonth(newMonth) {
    console.log('📅 Mudando para mês:', newMonth);

    // 🔥 v2.52.10: Só desconectar Realtime (o canal de presença é GLOBAL, não precisa reconectar)
    disconnectRealtime();

    currentMonth = newMonth;
    // Sincronizar todos os selectors de mês
    const monthSel = document.getElementById('month-selector');
    if (monthSel) monthSel.value = newMonth;
    const cargasSel = document.getElementById('cargas-month-selector');
    if (cargasSel) cargasSel.value = newMonth;
    const resumoSel = document.getElementById('resumo-month-selector');
    if (resumoSel) resumoSel.value = newMonth;
    await loadEncomendasData();
    renderResumoCargas();

    // Reconectar Realtime para o novo mês
    setupEncomendasRealtime();

    // 🆕 v2.52.10: Actualizar estado da presença (novo mês) e avisar os peers
    if (presenceChannel && myPresenceState) {
        myPresenceState.month = currentMonth;
        myPresenceState.year = currentYear;
        try {
            await presenceChannel.track(myPresenceState);
            // Broadcast para os peers saberem que mudei de mês (limpa cursor)
            await presenceChannel.send({
                type: 'broadcast',
                event: 'cursor',
                payload: {
                    userId: currentUser.id,
                    user_name: myPresenceState.user_name,
                    color: myPresenceState.color,
                    active_cell: null,
                    month: currentMonth,
                    year: currentYear
                }
            });
        } catch (e) { console.warn('⚠️ Erro ao actualizar presença:', e); }
    }

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
        // Capturar dados da linha ANTES de apagar (para o log de auditoria)
        const deletedRowSnapshot = { date };
        encomendasData.fields.forEach(field => {
            deletedRowSnapshot[field.key] = encomendasData.data[`${realIndex}_${field.key}`] || '';
        });

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

        logHistory('DELETE', {
            date,
            row_order: realIndex,
            enc: deletedRowSnapshot.enc,
            cliente: deletedRowSnapshot.cliente,
            medida: deletedRowSnapshot.medida,
            qtd: deletedRowSnapshot.qtd,
            new_value: JSON.stringify(deletedRowSnapshot),
        });
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

// ===================================================================
// 🔥 v2.52.1: AGRUPAMENTO DE CARGAS POR BLOCO DE TRANSPORTE
// Quando uma linha tem TRANSP preenchido, todas as linhas seguintes
// (do mesmo dia, sem TRANSP) pertencem ao mesmo bloco de entrega.
// O horário e transporte aplicam-se a todo o bloco.
// ===================================================================
function buildTransportBlocks(rows) {
    // rows: array de objectos com campos da BD, ORDENADOS por row_order, do MESMO dia
    // Retorna: array de blocos { transp, horario_carga, date, items[], totalQtd }
    const blocks = [];
    let currentBlock = null;

    for (const row of rows) {
        const transp = (row.transp || '').trim();
        const hasData = (row.cliente || '').trim() || (row.medida || '').trim() || (row.qtd || '').trim();

        if (transp) {
            // Nova linha com TRANSP → novo bloco
            currentBlock = {
                transp: transp,
                horario_carga: (row.horario_carga || '').trim(),
                date: row.date,
                nviagem: (row.nviagem || '').trim(),
                items: [],
                totalQtd: 0
            };
            blocks.push(currentBlock);
            // Adicionar esta linha como primeiro item do bloco
            const qty = parseInt((row.qtd || '0').replace(/\./g, '').split(',')[0]) || 0;
            currentBlock.items.push({
                cliente: (row.cliente || '').trim(),
                local: (row.local || '').trim(),
                medida: (row.medida || '').trim(),
                qtd: row.qtd || '',
                enc: (row.enc || '').trim(),
                obs: (row.obs || '').trim(),
                et: (row.et || '').trim(),
            });
            currentBlock.totalQtd += qty;
        } else if (currentBlock && hasData) {
            // Linha SEM TRANSP mas com dados → pertence ao bloco actual
            const qty = parseInt((row.qtd || '0').replace(/\./g, '').split(',')[0]) || 0;
            currentBlock.items.push({
                cliente: (row.cliente || '').trim(),
                local: (row.local || '').trim(),
                medida: (row.medida || '').trim(),
                qtd: row.qtd || '',
                enc: (row.enc || '').trim(),
                obs: (row.obs || '').trim(),
                et: (row.et || '').trim(),
            });
            currentBlock.totalQtd += qty;
        }
        // Linhas vazias sem bloco activo são ignoradas
    }

    return blocks;
}

// Versão que trabalha directamente com encomendasData (in-memory)
function buildTransportBlocksFromMemory(dateFilter, weekFilter) {
    // Recolher linhas do encomendasData para o dia/semana indicado
    const rows = [];
    encomendasData.dates.forEach((date, idx) => {
        if (dateFilter && date !== dateFilter) return;
        if (weekFilter !== undefined) {
            const sem = encomendasData.data[`${idx}_sem`];
            if (parseInt(sem) !== weekFilter) return;
        }
        const row = { date, row_order: idx };
        encomendasData.fields.forEach(f => {
            row[f.key] = encomendasData.data[`${idx}_${f.key}`] || '';
        });
        rows.push(row);
    });

    // Agrupar por dia, depois buildTransportBlocks para cada dia
    const byDate = {};
    rows.forEach(r => {
        if (!byDate[r.date]) byDate[r.date] = [];
        byDate[r.date].push(r);
    });

    const allBlocks = [];
    for (const [date, dateRows] of Object.entries(byDate)) {
        dateRows.sort((a, b) => a.row_order - b.row_order);
        const blocks = buildTransportBlocks(dateRows);
        allBlocks.push(...blocks);
    }
    return allBlocks;
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
    
    // 🔥 BUGFIX v2.52.0: SEMPRE revalidar currentCalendarioWeek (mesmo fix que generateWeekTabs)
    // Corrige bug: ao mudar de mês, semana ficava com valor do mês anterior
    if (weekTabs.length > 0) {
        if (currentCalendarioWeek && weekTabs.includes(currentCalendarioWeek)) {
            console.log(`📅 Semana ${currentCalendarioWeek} mantida no Mapa Cargas (válida para este mês)`);
        } else {
            const today = new Date();
            const currentWeekNumber = getWeekNumber(today);

            if (weekTabs.includes(currentWeekNumber)) {
                currentCalendarioWeek = currentWeekNumber;
                console.log(`📅 Semana ATUAL selecionada automaticamente no Mapa Cargas: Semana ${currentCalendarioWeek}`);
            } else {
                const closest = weekTabs.reduce((prev, curr) =>
                    Math.abs(curr - currentWeekNumber) < Math.abs(prev - currentWeekNumber) ? curr : prev
                );
                currentCalendarioWeek = closest;
                console.log(`⚠️ Semana atual (${currentWeekNumber}) não encontrada. Usando mais próxima: Semana ${currentCalendarioWeek}`);
            }
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
    
    // 🔥 v2.52.1: Usar blocos de transporte em vez de linhas individuais
    // Um bloco = 1 entrega (linha com TRANSP + linhas seguintes sem TRANSP)
    const transportBlocks = buildTransportBlocksFromMemory(null, currentCalendarioWeek);

    // Converter blocos para o formato "cargas" usado pelo renderizador
    const cargas = transportBlocks.map(block => ({
        date: block.date,
        transp: block.transp,
        horario: block.horario_carga,
        nviagem: block.nviagem,
        // Primeiro item define o display principal
        cliente: block.items.map(it => it.cliente).filter(Boolean).join(', '),
        local: block.items[0]?.local || '',
        medida: block.items.map(it => it.medida ? `${it.medida} (${it.qtd})` : '').filter(Boolean).join(' + '),
        qtd: block.totalQtd.toString(),
        obs: block.items.map(it => it.obs).filter(Boolean).join(', '),
        items: block.items,  // Guardar items para tooltip/detalhe
    }));
    const cargasSemTransp = []; // Placeholder para compatibilidade com logging
    
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
    
    // Pré-calcular total de cargas por dia (para o header)
    const totalCargasPorDia = {};
    weekDates.forEach(d => {
        totalCargasPorDia[d.dateStr] = cargas.filter(c => normalizeDateFormat(c.date) === d.dateStr).length;
    });

    // Header Row
    const headerTime = document.createElement('div');
    headerTime.className = 'calendario-header-cell';
    headerTime.textContent = 'Horário';
    grid.appendChild(headerTime);

    weekDates.forEach(d => {
        const header = document.createElement('div');
        header.className = 'calendario-header-cell';
        const totalDia = totalCargasPorDia[d.dateStr] || 0;
        const totalBadge = totalDia > 0
            ? `<span style="display:inline-block;background:#007AFF;color:white;font-size:10px;font-weight:700;padding:1px 7px;border-radius:10px;margin-left:6px;">${totalDia}</span>`
            : '';
        header.innerHTML = `<div style="font-weight:700;">${d.dayName}${totalBadge}</div><div style="font-size:12px;color:#666;margin-top:4px;">${d.dateStr}</div>`;
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
                    // Horário específico: verificar se corresponde a um slot conhecido
                    const knownSlots = ['06:00 - 08:00','08:00 - 10:00','10:00 - 12:00','12:00 - 14:00','14:00 - 16:00','16:00 - 18:00','18:00 - 20:00'];
                    if (knownSlots.includes(horarioNormalizado)) {
                        slots = [horarioNormalizado];
                        rowSpan = 1;
                    } else {
                        // Horário livre (ex: "10-15H - AGENDAR...") → linha Sem Horário
                        slots = ['SEM_HORARIO'];
                        rowSpan = 1;
                    }
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

            // Badge de contagem sempre visível no canto superior direito da célula
            if (cargasNesteSlot.length > 0) {
                dayCell.style.position = 'relative';
                const countBadge = document.createElement('div');
                countBadge.style.cssText = 'position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.6);color:white;font-size:10px;font-weight:700;padding:1px 6px;border-radius:10px;z-index:30;pointer-events:none;';
                countBadge.textContent = cargasNesteSlot.length;
                dayCell.appendChild(countBadge);
            }

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

// ===================================================================
// 🔥 v2.51.36 - IMPORTADOR PDF ENCOMENDAS
// ===================================================================

// 🔥 v2.51.36i: GLOBAL para onclick funcionar
window.openPdfImporter = function() {
    console.log('%c📄 OPEN PDF IMPORTER CHAMADO!', 'background: #FF9500; color: white; font-size: 20px; font-weight: bold; padding: 10px;');
    
    // 🔐 v2.52.0: Verificar permissão
    if (!canEdit('encomendas')) {
        showToast('⚠️ Não tem permissão para importar encomendas', 'warning');
        return;
    }
    
    const modal = document.getElementById('modal-pdf-importer');
    const textarea = document.getElementById('pdf-text-input');
    const preview = document.getElementById('pdf-preview-container');
    
    if (!modal) {
        console.error('%c❌ MODAL PDF NÃO ENCONTRADO!', 'background: #FF3B30; color: white; font-size: 18px; padding: 10px;');
        return;
    }
    
    console.log('✅ [OPEN] Modal encontrado:', modal);
    console.log('✅ [OPEN] Display antes:', modal.style.display);
    console.log('✅ [OPEN] Classes antes:', modal.className);
    
    // 🔥 CRÍTICO: MOVER modal para BODY (fora de tabs com display:none)
    if (modal.parentElement !== document.body) {
        console.log('🚨 [OPEN] Modal está dentro de:', modal.parentElement?.id || modal.parentElement?.className);
        console.log('🚨 [OPEN] MOVENDO modal para document.body...');
        document.body.appendChild(modal);
        console.log('✅ [OPEN] Modal movido para body!');
    }
    
    // Limpar campos
    if (textarea) textarea.value = '';
    if (preview) preview.style.display = 'none';
    
    // CRÍTICO: Prevenir que close seja chamado
    modal.dataset.opening = 'true';
    
    // 🔥 v2.51.36k: FORÇAR display + z-index + opacity + ALIGN
    modal.style.setProperty('display', 'flex', 'important');
    modal.style.setProperty('align-items', 'center', 'important');
    modal.style.setProperty('justify-content', 'center', 'important');
    modal.style.setProperty('z-index', '99999', 'important');
    modal.style.setProperty('opacity', '1', 'important');
    modal.style.setProperty('pointer-events', 'auto', 'important');
    
    // 🔥 CRÍTICO: Forçar dimensões no .modal-dialog com cssText (override TUDO)
    const dialog = modal.querySelector('.modal-dialog');
    if (dialog) {
        // Usar cssText para sobrescrever TUDO de uma vez
        dialog.style.cssText = `
            display: flex !important;
            width: 700px !important;
            min-width: 700px !important;
            max-width: 700px !important;
            max-height: 85vh !important;
            background: white !important;
            border-radius: 20px !important;
            overflow: hidden !important;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3) !important;
            position: relative !important;
        `;
        console.log('✅ [OPEN] Dialog forçado com cssText');
        console.log('✅ [OPEN] Dialog offsetWidth:', dialog.offsetWidth, 'offsetHeight:', dialog.offsetHeight);
        console.log('✅ [OPEN] Dialog clientWidth:', dialog.clientWidth, 'clientHeight:', dialog.clientHeight);
        console.log('✅ [OPEN] Dialog computed width:', window.getComputedStyle(dialog).width);
        
        // Se AINDA for 0, adicionar atributo inline direto
        if (dialog.offsetWidth === 0) {
            console.error('%c🚨 DIALOG AINDA É 0! Tentando setAttribute...', 'background: red; color: white; font-size: 14px; padding: 5px;');
            dialog.setAttribute('style', 'display: flex !important; width: 700px !important; min-width: 700px !important; background: white !important; border-radius: 20px !important;');
            console.log('   → offsetWidth após setAttribute:', dialog.offsetWidth);
        }
    } else {
        console.error('❌ [OPEN] .modal-dialog NÃO ENCONTRADO!');
    }
    
    console.log('✅ [OPEN] Display após flex:', modal.style.display);
    console.log('✅ [OPEN] Z-index:', modal.style.zIndex);
    console.log('✅ [OPEN] Opacity:', modal.style.opacity);
    
    // 🔥 v2.51.36i: MutationObserver para detectar quem fecha o modal
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes') {
                if (mutation.attributeName === 'style') {
                    const currentDisplay = modal.style.display;
                    if (currentDisplay === 'none' || currentDisplay === '') {
                        console.error('%c🚨 ALGUÉM MUDOU O DISPLAY PARA NONE!', 'background: red; color: white; font-size: 16px; padding: 5px;');
                        console.trace(); // Mostra stack trace
                        // Reabrir imediatamente
                        modal.style.setProperty('display', 'flex', 'important');
                    }
                }
            }
        });
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['style', 'class'] });
    modal._observer = observer; // Guardar referência
    
    setTimeout(() => {
        modal.classList.add('active');
        delete modal.dataset.opening;
        console.log('✅ [OPEN] Classe active adicionada');
        console.log('✅ [OPEN] Display final:', modal.style.display);
        console.log('✅ [OPEN] Classes final:', modal.className);
        
        // 🔥 CRÍTICO: Aguardar mais tempo para browser renderizar
        setTimeout(() => {
            const rect = modal.getBoundingClientRect();
            console.log('📐 [OPEN] Posição modal (após 100ms):', {
                width: rect.width,
                height: rect.height,
                visible: rect.width > 0 && rect.height > 0
            });
            
            const dialog = modal.querySelector('.modal-dialog');
            if (dialog) {
                const dialogRect = dialog.getBoundingClientRect();
                console.log('📐 [OPEN] Dialog rect (após 100ms):', {
                    width: dialogRect.width,
                    height: dialogRect.height
                });
                
                // Se AINDA for 0, forçar via requestAnimationFrame
                if (dialogRect.width === 0) {
                    console.error('%c🚨 FORÇANDO COM requestAnimationFrame!', 'background: red; color: white; font-size: 16px; padding: 5px;');
                    requestAnimationFrame(() => {
                        dialog.style.cssText = `
                            display: block !important;
                            width: 700px !important;
                            min-width: 700px !important;
                            background: white !important;
                            border-radius: 20px !important;
                            padding: 40px !important;
                            position: relative !important;
                        `;
                        console.log('   → offsetWidth final:', dialog.offsetWidth);
                    });
                }
            }
        }, 100);
    }, 10);
    
    if (textarea) {
        setTimeout(() => textarea.focus(), 50);
    }
}

// 🔥 v2.51.36N: Upload e processar PDF
window.handlePdfUpload = async function(event) {
    const file = event.target.files[0];
    const statusEl = document.getElementById('pdf-status');
    const previewContainer = document.getElementById('pdf-preview-container');
    
    if (!file) return;
    
    if (file.type !== 'application/pdf') {
        statusEl.innerHTML = '<span style="color: #FF3B30;">❌ Por favor selecione um arquivo PDF</span>';
        return;
    }
    
    statusEl.innerHTML = '<span style="color: #007AFF;">⏳ Processando PDF...</span>';
    
    try {
        // Ler PDF com PDF.js
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
        
        let fullText = '';

        // 🔥 v2.52.0: Extrair texto respeitando linhas do PDF (posição Y dos items)
        // Agrupar items por linha (mesma coordenada Y ± tolerância) para manter estrutura
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();

            // Agrupar items por coordenada Y (linha visual)
            const lineMap = new Map();
            const yTolerance = 3; // pixels de tolerância para mesma linha

            textContent.items.forEach(item => {
                if (!item.str || !item.str.trim()) return;
                const y = Math.round(item.transform[5] / yTolerance) * yTolerance; // normalizar Y
                if (!lineMap.has(y)) lineMap.set(y, []);
                lineMap.get(y).push({ x: item.transform[4], str: item.str });
            });

            // Ordenar linhas por Y descendente (PDF tem Y invertido: topo = valor alto)
            const sortedLines = [...lineMap.entries()]
                .sort((a, b) => b[0] - a[0])
                .map(([y, items]) => {
                    // Ordenar items dentro da linha por X (esquerda → direita)
                    items.sort((a, b) => a.x - b.x);
                    return items.map(it => it.str).join(' ');
                });

            fullText += sortedLines.join('\n') + '\n';
        }
        
        console.log('📄 PDF processado:', fullText.substring(0, 500));
        
        // Parsear texto
        const orders = parsePdfText(fullText);
        
        if (orders.length === 0) {
            statusEl.innerHTML = '<span style="color: #FF9500;">⚠️ Nenhuma encomenda encontrada no PDF</span>';
            return;
        }
        
        // 🔥 v2.52.0 + v2.52.4: Filtrar clientes LPR e IPP — camadas múltiplas de segurança
        // 1) Por nome (contém "LPR" ou "IPP")
        // 2) Por código cliente conhecido (C0068=LPR EUROPE BV, C0570=IPP LOGIPAL)
        // 3) Por número de documento conhecido (ECL específicos, caso o nome falhe)
        const EXCLUDED_CLIENTS_RE = /\bLPR\b|\bIPP\b/i;
        const EXCLUDED_CLIENT_CODES = new Set(['C0068', 'C0570']);
        const filteredOrders = orders.filter(o => {
            // Check 1: name contains LPR/IPP
            if (EXCLUDED_CLIENTS_RE.test(o.cliente)) {
                console.log(`🚫 Excluído (nome LPR/IPP): ${o.enc} | ${o.cliente}`);
                return false;
            }
            // Check 2: client code is known LPR/IPP
            if (o.clientCode && EXCLUDED_CLIENT_CODES.has(o.clientCode)) {
                console.log(`🚫 Excluído (código cliente ${o.clientCode}): ${o.enc} | ${o.cliente}`);
                return false;
            }
            return true;
        });
        const excludedCount = orders.length - filteredOrders.length;
        if (excludedCount > 0) {
            console.log(`🚫 ${excludedCount} encomenda(s) excluída(s) (clientes LPR/IPP)`);
        }

        // Guardar orders globalmente para importar depois
        window.parsedOrders = filteredOrders;
        window.importDiff = null;

        statusEl.innerHTML = `<span style="color: #34C759;">✅ ${filteredOrders.length} encomenda(s) encontrada(s)${excludedCount > 0 ? ` (${excludedCount} excluída(s) — LPR/IPP)` : ''} — a comparar com BD...</span>`;

        // Mostrar diff preview (async — compara com BD)
        await showDiffPreview(filteredOrders);

        statusEl.innerHTML = `<span style="color: #34C759;">✅ ${filteredOrders.length} encomenda(s) encontrada(s)${excludedCount > 0 ? ` (${excludedCount} excluída(s) — LPR/IPP)` : ''}</span>`;
        
    } catch (error) {
        console.error('Erro ao processar PDF:', error);
        statusEl.innerHTML = '<span style="color: #FF3B30;">❌ Erro ao processar PDF: ' + error.message + '</span>';
    }
};

async function showDiffPreview(orders) {
    const previewContainer = document.getElementById('pdf-preview-container');
    const previewEl = document.getElementById('pdf-preview');

    // Mostrar loading imediatamente
    previewEl.innerHTML = '<p style="text-align:center;padding:20px;color:#666;">⏳ A comparar com dados existentes...</p>';
    previewContainer.style.display = 'block';

    const monthAbbrs = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

    function preparePdfRecord(order) {
        let dateFormatted = '', monthName = '', yearNum = currentYear, semNum = '';
        if (order.data_entrega) {
            const parts = order.data_entrega.split('/');
            if (parts.length === 3) {
                const day = parts[0];
                const monthIdx = parseInt(parts[1]) - 1;
                yearNum = parseInt(parts[2]);
                monthName = monthAbbrs[monthIdx] || '';
                dateFormatted = `${day}/${monthName}`;
                semNum = getWeekNumberFromDateStr(dateFormatted).toString();
            }
        }
        return {
            enc: order.enc || '', cliente: order.cliente || '', date: dateFormatted,
            month: monthName, year: yearNum, sem: semNum,
            medida: order.medida || '', qtd: order.qtd !== undefined ? order.qtd.toString() : '',
            local: order.local || '',   // 🆕 v2.52.0: Descarga do PDF
            obs: order.obs || ''        // 🆕 v2.52.0: Referência do PDF
        };
    }

    const key = r => `${r.enc}|${r.date}|${r.medida}`;
    const pdfRecords = orders.map(preparePdfRecord);
    const pdfMap = new Map(pdfRecords.map(r => [key(r), r]));

    // Buscar todos os campos (incluindo colunas manuais) para os meses cobertos pelo PDF
    const monthsInPdf = [...new Set(pdfRecords.map(r => `${r.month}/${r.year}`))];
    const existingRows = [];
    for (const my of monthsInPdf) {
        const [m, y] = my.split('/');
        const { data } = await db
            .from('mapa_encomendas')
            .select('id, enc, date, medida, qtd, cliente, sem, local, transp, et, nviagem, horario_carga, obs, row_order')
            .eq('month', m)
            .eq('year', parseInt(y));
        if (data) existingRows.push(...data);
    }
    // 🔥 v2.52.0: Proteger registos de clientes LPR/IPP — não alterar nem reordenar
    const EXCLUDED_CLIENTS_RE = /\bLPR\b|\bIPP\b/i;
    const meaningfulRows = existingRows.filter(r => {
        if (!r.enc || r.enc.trim() === '') return false;
        // Proteger linhas de clientes LPR/IPP contra qualquer alteração pelo import
        if (EXCLUDED_CLIENTS_RE.test(r.cliente)) {
            console.log(`🛡️ Protegido (cliente LPR/IPP): ${r.enc} | ${r.cliente} — não será alterado pelo import`);
            return false; // Excluir da comparação = nunca será tocado
        }
        return true;
    });

    // Fase 1: correspondência exata (enc|date|medida)
    const dbExactMap = new Map(meaningfulRows.map(r => [key(r), r]));

    // Fase 2: índice só por enc para detetar "data alterada no mesmo pedido"
    const dbEncMap = new Map();
    meaningfulRows.forEach(r => {
        if (!dbEncMap.has(r.enc)) dbEncMap.set(r.enc, []);
        dbEncMap.get(r.enc).push(r);
    });

    const toInsert = [], toUpdate = [], toSkip = [], removedFromPdf = [];
    const matchedDbIds = new Set();

    pdfMap.forEach((pdfRec) => {
        const k = key(pdfRec);
        if (dbExactMap.has(k)) {
            const dbRec = dbExactMap.get(k);
            matchedDbIds.add(dbRec.id);
            // 🔥 v2.52.0: Comparar também local e obs (se PDF os fornece)
            const qtyDiff = dbRec.qtd !== pdfRec.qtd || dbRec.cliente !== pdfRec.cliente;
            const localDiff = pdfRec.local && String(dbRec.local || '') !== String(pdfRec.local);
            const obsDiff = pdfRec.obs && String(dbRec.obs || '') !== String(pdfRec.obs);
            if (qtyDiff || localDiff || obsDiff) {
                toUpdate.push({ pdfRec, dbRec });
            } else {
                toSkip.push(pdfRec);
            }
        } else {
            // Fallback: procurar por enc único não correspondido (data ou medida alterou)
            const encMatches = (dbEncMap.get(pdfRec.enc) || []).filter(r => !matchedDbIds.has(r.id));
            if (encMatches.length === 1) {
                const dbRec = encMatches[0];
                matchedDbIds.add(dbRec.id);
                // 🔥 v2.52.0: Incluir local e obs na comparação (se PDF os fornece)
                const fieldsToCheck = ['date','medida','qtd','cliente','sem'];
                if (pdfRec.local) fieldsToCheck.push('local');
                if (pdfRec.obs) fieldsToCheck.push('obs');
                const anyDiff = fieldsToCheck.some(f => String(pdfRec[f]||'') !== String(dbRec[f]||''));
                if (anyDiff) toUpdate.push({ pdfRec, dbRec });
                else toSkip.push(pdfRec);
            } else {
                toInsert.push(pdfRec);
            }
        }
    });
    meaningfulRows.forEach(r => { if (!matchedDbIds.has(r.id)) removedFromPdf.push(r); });

    // Guardar diff para usar no import — guarda pdfRec + dbRec completos
    window.importDiff = {
        toInsert,
        toUpdate: toUpdate.map(x => ({ id: x.dbRec.id, pdfRec: x.pdfRec, dbRec: x.dbRec })),
        existingRows: existingRows.sort((a, b) => (a.row_order || 0) - (b.row_order || 0)),
    };

    // --- Render ---
    const BADGE_S = 'display:inline-block;width:18px;height:18px;line-height:18px;text-align:center;border-radius:3px;font-weight:700;font-size:12px;vertical-align:middle;margin-right:5px;';
    let html = '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px;">';
    html += `<span style="background:#D4EDDA;color:#155724;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600;"><span style="${BADGE_S}background:#28A745;color:#fff;">+</span>${toInsert.length} nova${toInsert.length !== 1 ? 's' : ''} — serão adicionadas</span>`;
    html += `<span style="background:#FFF3CD;color:#856404;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600;"><span style="${BADGE_S}background:#FF9500;color:#fff;">✎</span>${toUpdate.length} alterada${toUpdate.length !== 1 ? 's' : ''} — serão atualizadas</span>`;
    if (toSkip.length > 0 || removedFromPdf.length > 0) {
        html += `<span style="color:#999;font-size:11px;">(${toSkip.length} iguais e ${removedFromPdf.length} só na BD não são afetadas)</span>`;
    }
    html += '</div>';

    // Colunas do PDF (serão atualizadas) vs colunas manuais (preservadas)
    const MANUAL_COLS = [
        { key: 'local', label: 'Local' },
        { key: 'transp', label: 'Transp' },
        { key: 'et', label: 'E.T.' },
        { key: 'nviagem', label: 'NºViagem' },
        { key: 'horario_carga', label: 'Horário' },
        { key: 'obs', label: 'Obs' },
    ];

    const BADGE_INSERT = '<span style="display:inline-block;width:20px;height:20px;line-height:20px;text-align:center;border-radius:4px;font-weight:700;font-size:12px;background:#28A745;color:#fff;">+</span>';
    const BADGE_UPDATE = '<span style="display:inline-block;width:20px;height:20px;line-height:20px;text-align:center;border-radius:4px;font-weight:700;font-size:12px;background:#FF9500;color:#fff;">✎</span>';

    const TH = (label, extra='') => `<th style="padding:4px 7px;text-align:left;white-space:nowrap;font-size:11px;${extra}">${label}</th>`;
    const TD = (content, extra='') => `<td style="padding:4px 7px;font-size:11px;${extra}">${content}</td>`;

    html += '<div style="overflow-x:auto;">';
    html += '<table style="width:100%;border-collapse:collapse;min-width:900px;">';
    html += '<thead><tr style="background:#E5E5EA;font-weight:600;">';
    html += TH('');
    html += TH('Data');
    html += TH('ENC.');
    html += TH('Medida');
    html += TH('Qtd', 'text-align:right;');
    html += TH('Cliente');
    html += TH('SEM', 'text-align:right;');
    MANUAL_COLS.forEach(c => html += `<th style="padding:4px 7px;text-align:left;white-space:nowrap;font-size:11px;color:#888;">${c.label}</th>`);
    html += '</tr></thead><tbody>';

    function diffCell(newVal, oldVal, rightAlign) {
        const n = newVal || '—', o = oldVal || '—';
        const changed = String(newVal||'') !== String(oldVal||'');
        const style = `padding:4px 7px;font-size:11px;${rightAlign?'text-align:right;':''}${changed?'font-weight:600;color:#CC6600;':''}`;
        const content = changed
            ? `${n} <span style="color:#BBB;text-decoration:line-through;font-size:10px;">${o}</span>`
            : n;
        return `<td style="${style}">${content}</td>`;
    }

    toInsert.forEach(r => {
        let tr = `<tr style="background:#F0FFF4;border-bottom:1px solid rgba(0,0,0,0.04);">`;
        tr += TD(BADGE_INSERT);
        tr += TD(r.date || '—');
        tr += TD(r.enc || '—');
        tr += TD(r.medida || '—');
        tr += TD(r.qtd || '—', 'text-align:right;font-weight:600;');
        tr += TD(r.cliente || '—');
        tr += TD(r.sem || '—', 'text-align:right;');
        MANUAL_COLS.forEach(() => tr += TD('—', 'color:#CCC;'));
        tr += '</tr>';
        html += tr;
    });

    toUpdate.forEach(({ pdfRec, dbRec }) => {
        let tr = `<tr style="background:#FFFBF0;border-bottom:1px solid rgba(0,0,0,0.04);">`;
        tr += TD(BADGE_UPDATE);
        tr += diffCell(pdfRec.date, dbRec.date, false);
        tr += diffCell(pdfRec.enc, dbRec.enc, false);
        tr += diffCell(pdfRec.medida, dbRec.medida, false);
        tr += diffCell(pdfRec.qtd, dbRec.qtd, true);
        tr += diffCell(pdfRec.cliente, dbRec.cliente, false);
        tr += diffCell(pdfRec.sem, dbRec.sem ? String(dbRec.sem) : '', true);
        MANUAL_COLS.forEach(c => {
            const val = dbRec[c.key] || '';
            tr += `<td style="padding:4px 7px;font-size:11px;color:#888;font-style:italic;" title="preservado">${val || '—'}</td>`;
        });
        tr += '</tr>';
        html += tr;
    });

    html += '</tbody></table></div>';

    if (toInsert.length === 0 && toUpdate.length === 0) {
        html += '<p style="margin-top:12px;text-align:center;color:#34C759;font-weight:600;font-size:13px;">✅ PDF sem diferenças — todos os dados já estão atualizados.</p>';
    } else {
        html += '<p style="margin-top:8px;font-size:10px;color:#999;">Colunas em itálico cinzento (Local, Transp, etc.) são preservadas tal como estão na base de dados.</p>';
    }

    previewEl.innerHTML = html;
}

// 🔥 v2.51.36i: GLOBAL para onclick funcionar
window.closePdfImporter = function() {
    const modal = document.getElementById('modal-pdf-importer');
    
    // CRÍTICO: Não fechar se está abrindo
    if (modal.dataset.opening === 'true') {
        console.log('⚠️ [CLOSE] CANCELADO - Modal está abrindo!');
        return;
    }
    
    console.log('🚪 [CLOSE] Fechando modal PDF...');
    
    // Desconectar observer
    if (modal._observer) {
        modal._observer.disconnect();
        delete modal._observer;
    }
    
    modal.classList.remove('active');
    setTimeout(() => {
        modal.style.display = 'none';
        console.log('🚪 [CLOSE] Modal fechado');
    }, 300);
}

// ===================================================================
// 🔥 v2.52.0: Parser para NOVO formato PDF (com Referência e Descarga)
// Colunas: Documento | Referência | Dt.Entrega | Descarga | Qtd.Enc UN | Qtd.Satisf | Qtd.Pend
// Referência → campo "obs" (observações) no mapa de encomendas
// Descarga → campo "local" no mapa de encomendas
// ===================================================================
function parseNewPdfFormat(text, parseQtd) {
    console.log('📄 [NOVO FORMAT] Iniciando parse...');
    const orders = [];
    let m;

    // 1. Mapear código de cliente → nome a partir dos cabeçalhos de secção
    // Padrão: C#### seguido de NOME DA EMPRESA, antes do primeiro ECL da secção
    const clientMap = {};
    const sectionBounds = [];
    // Regex: C#### (opcionalmente com sufixo tipo "PT") seguido de nome em maiúsculas até ECL
    const clientRegex = /(C\d{4,5}(?:\s+[A-Z]{2,3})?)\s+([A-Z\u00C0-\u00FF][\w\u00C0-\u00FF\s,.\-&'\/()]+?)(?=\s+ECL\s)/g;
    while ((m = clientRegex.exec(text)) !== null) {
        const code = m[1].trim();
        const name = m[2].trim();
        if (!clientMap[code]) {
            clientMap[code] = name;
            sectionBounds.push({ code, pos: m.index });
            console.log(`👤 [NOVO] Cliente: ${code} → ${name}`);
        }
    }
    sectionBounds.sort((a, b) => a.pos - b.pos);

    function getClientAtPos(pos) {
        let code = null;
        for (const s of sectionBounds) {
            if (s.pos <= pos) code = s.code; else break;
        }
        return code;
    }

    // 2. Encontrar linhas ECL: ECL YYYY/NNN [ref] DD/MM/YYYY [descarga] qty UN qty qty
    // Usamos regex que captura ECL + meio + 3 quantidades
    const eclMatches = [];
    const eclRegex = /(ECL\s+\d{4}\/\d+)\s+(.+?)([\d.,]+)\s+UN\s+([\d.,]+)\s+([\d.,]+)/g;
    while ((m = eclRegex.exec(text)) !== null) {
        const doc = m[1].trim().replace(/\s+/g, ' ');
        const middle = m[2].trim();
        const qtdPend = parseQtd(m[5]); // Última coluna = Qtd. Pendente

        // Separar o "middle" em: [referência] DD/MM/YYYY [descarga]
        // Usar a ÚLTIMA data encontrada (caso a referência contenha datas, ex: "mail 16/03/2026 - AG")
        const dateMatches = [...middle.matchAll(/(\d{2}\/\d{2}\/\d{4})/g)];
        if (dateMatches.length === 0) continue;

        const lastDateMatch = dateMatches[dateMatches.length - 1];
        const date = lastDateMatch[1];
        const ref = middle.substring(0, lastDateMatch.index).trim();
        const descarga = middle.substring(lastDateMatch.index + 10).trim();

        // Determinar cliente pela posição no texto (secção de cliente)
        const clientCode = getClientAtPos(m.index);
        const cliente = clientCode ? (clientMap[clientCode] || clientCode) : '';

        eclMatches.push({
            pos: m.index,
            end: m.index + m[0].length,
            doc, date, ref, descarga, qtd: qtdPend, clientCode, cliente
        });
    }
    console.log(`✅ [NOVO] ${eclMatches.length} documentos ECL encontrados`);

    // 3. Encontrar produtos (mesmo padrão, mas com 3 quantidades: qty UN qty qty)
    const prodMatches = [];
    const prodRegex = /(P\d[A-Z0-9\-]{3,}|P-[A-Z0-9\-]{3,}|#\d{4,}|\d{5,9}\.\d{4}(?!\d))\s+(.+?)\s+[\d.,]+\s+UN\s+[\d.,]+\s+[\d.,]+/g;
    while ((m = prodRegex.exec(text)) !== null) {
        prodMatches.push({
            pos: m.index,
            end: m.index + m[0].length,
            code: m[1],
            desc: m[2].trim()
        });
    }
    console.log(`✅ [NOVO] ${prodMatches.length} produtos encontrados`);

    // 4. Associar ECLs ao produto seguinte
    // 🔥 v2.52.5: Filtrar por secção de cliente — evita que ECLs "residuais" (ex: SERV_TRANSP
    // com qty=1) de um cliente sejam associadas ao produto da secção do cliente seguinte.
    prodMatches.forEach((prod, pi) => {
        const prevEnd = pi > 0 ? prodMatches[pi - 1].end : 0;
        const prodSection = getClientAtPos(prod.pos);
        const relatedEcls = eclMatches.filter(e =>
            e.pos >= prevEnd &&
            e.pos < prod.pos &&
            // ECL e produto têm de estar na MESMA secção de cliente
            (prodSection === null || e.clientCode === prodSection)
        );

        relatedEcls.forEach(ecl => {
            orders.push({
                enc: ecl.doc,
                cliente: ecl.cliente,
                clientCode: ecl.clientCode,  // 🆕 v2.52.4: código cliente p/ filtro LPR/IPP
                data_entrega: ecl.date,
                medida: prod.desc,
                qtd: ecl.qtd,
                local: ecl.descarga,   // 🆕 Descarga → LOCAL
                obs: ecl.ref           // 🆕 Referência → OBSERVAÇÕES
            });
            console.log(`✅ ${ecl.doc} | ${ecl.cliente} | ${ecl.date} | ${prod.desc} | ${ecl.qtd} | Local: ${ecl.descarga} | Obs: ${ecl.ref}`);
        });
    });

    console.log(`✅ [NOVO] Parse completo: ${orders.length} encomendas detectadas`);
    if (orders.length === 0) {
        console.warn('⚠️ [NOVO] NENHUMA encomenda detectada! Verifique o formato do PDF.');
    }

    return orders;
}

function parsePdfText(rawText) {
    // Parser para formato Primavera BSS (ECL YYYY/NNN)
    // O font Primavera usa um mapeamento PUA completamente custom (não é ASCII+0xF000).
    // Tabela derivada por análise visual do PDF renderizado vs texto extraído pelo PDF.js.
    const PRIM_DECODE = {
        '\uf027': ' ', '\uf029': 'E', '\uf02a': 'U', '\uf02b': 'R',
        '\uf02c': '2', '\uf02d': '4', '\uf02e': '/', '\uf02f': '0',
        '\uf030': '3', '\uf031': '6', '\uf032': ',', '\uf033': 'P',
        '\uf036': ',', '\uf037': '1', '\uf038': '9', '\uf039': 'C',
        '\uf03a': 'O', '\uf03c': 'S', '\uf03d': 'L', '\uf03f': 'T',
        '\uf040': 'G', '\uf041': 'A', '\uf042': '.', '\uf043': '5',
        '\uf044': 'N', '\uf045': '7', '\uf046': '8', '\uf047': 'X',
        '\uf048': 'D', '\uf049': 'I', '\uf04e': '-', '\uf04f': 'C',
        '\uf051': 'M', '\uf05f': 'J', '\uf060': 'E', '\uf061': 'A',
    };
    const text = rawText.replace(/[\uf020-\uf0ff]/g, c => PRIM_DECODE[c] || c);

    console.log('📄 Iniciando parse do PDF PALSYSTEMS...');
    console.log('📄 Texto completo (primeiros 1000 chars):', text.substring(0, 1000));

    // Helper: parse quantidade em formato português (ponto=milhar, vírgula=decimal)
    function parseQtd(s) {
        const t = s.trim();
        return parseInt(t.replace(/\./g, '').split(',')[0]) || 0;
    }

    // 🔥 v2.52.0: Detetar formato do PDF (novo com Referência/Descarga vs antigo)
    const isNewFormat = /Refer[êe]ncia/.test(text) && /Descarga/.test(text);
    if (isNewFormat) {
        console.log('📄 ✅ Formato NOVO detectado (com Referência e Descarga)');
        return parseNewPdfFormat(text, parseQtd);
    }
    console.log('📄 Formato ANTIGO detectado (sem Referência/Descarga)');

    const orders = [];
    let m;

    // 1. Mapear código de cliente → nome
    // PDF.js concatena texto com espaços (sem \n), por isso o nome aparece inline antes de qty.
    // Formato: [NOME] qty qty qty UN qty C#### DD/MM/YYYY ECL ...
    // Usa \u00C0-\u00FF para cobrir letras acentuadas portuguesas (ALSÉCUS, PAPÉIS, etc.)
    const clientMap = {};
    const sectionBounds = [];
    const CLIENT_CHAR = '[A-Z\u00C0-\u00FF]';
    const CLIENT_BODY = '[A-Z\u00C0-\u00FF\\s,\\.\\-&\'\\/]{8,}?';
    const clientRegex = new RegExp(
        `(${CLIENT_CHAR}${CLIENT_BODY})\\s+[\\d.,]+\\s+[\\d.,]+\\s+[\\d.,]+\\s+UN\\s+[\\d.,]+\\s+(C\\d{4,5}(?:\\s+[A-Z]{2,3})?)\\s+\\d{2}\\/\\d{2}\\/\\d{4}\\s+ECL`,
        'g'
    );
    while ((m = clientRegex.exec(text)) !== null) {
        const clientCode = m[2];
        if (!clientMap[clientCode]) {
            clientMap[clientCode] = m[1].trim();
            // Posição da secção: última ocorrência do código antes do match
            const codePos = text.lastIndexOf(clientCode, m.index);
            sectionBounds.push({ code: clientCode, pos: codePos >= 0 ? codePos : m.index });
            console.log(`👤 Cliente: ${clientCode} → ${clientMap[clientCode]}`);
        }
    }
    sectionBounds.sort((a, b) => a.pos - b.pos);
    function getSectionCode(pos) {
        let code = null;
        for (const s of sectionBounds) {
            if (s.pos <= pos) code = s.code; else break;
        }
        return code;
    }

    // 2. Encontrar todos os documentos ECL com posição no texto
    // Formato real do PDF: [qty] UN [qty] [client] [date] ECL YYYY/NNN
    const eclMatches = [];
    const eclRegex = /([\d.,]+)\s+(C\d{4,5}(?:\s+[A-Z]{2,3})?)\s+(\d{2}\/\d{2}\/\d{4})\s+(ECL\s+\d{4}\/\d+)/g;
    while ((m = eclRegex.exec(text)) !== null) {
        eclMatches.push({
            pos: m.index,
            end: m.index + m[0].length,
            doc: m[4].trim().replace(/\s+/g, ' '),
            date: m[3],
            clientCode: m[2],
            qtd: parseQtd(m[1])
        });
    }
    console.log(`✅ ${eclMatches.length} documentos encontrados`);

    // 3. Encontrar todos os produtos com posição no texto
    // Formato: [code]  [desc]  [qty_total]  [qty_entregue]  [qty_restante] UN
    // Códigos P começam SEMPRE com dígito após P (P0...). Códigos # são só dígitos.
    // Códigos Navigator: numéricos com ponto — ex. 573392.2585 (6 dígitos + ponto + 4 dígitos exatos)
    // Os 4 dígitos finais distinguem de quantidades (ex. 16.308,000 tem vírgula a seguir)
    const prodMatches = [];
    const prodRegex = /(P\d[A-Z0-9\-]{3,}|P-[A-Z0-9\-]{3,}|#\d{4,}|\d{5,9}\.\d{4}(?!\d))\s+(.+?)\s+[\d.,]+\s+[\d.,]+\s+[\d.,]+\s+(?:UN|VP)/g;
    while ((m = prodRegex.exec(text)) !== null) {
        prodMatches.push({
            pos: m.index,
            end: m.index + m[0].length,
            code: m[1],
            desc: m[2].trim()
        });
    }
    console.log(`✅ ${prodMatches.length} produtos encontrados`);

    // 4. Associar documentos ao produto seguinte
    // Filtrar por secção de cliente: evita que ECLs de SERV_TRANSP (ou outras linhas residuais)
    // de um cliente contaminem os produtos do cliente seguinte.
    prodMatches.forEach((prod, pi) => {
        const prevEnd = pi > 0 ? prodMatches[pi - 1].end : 0;
        const prodSection = getSectionCode(prod.pos);
        const relatedEcls = eclMatches.filter(e =>
            e.pos >= prevEnd &&
            e.pos < prod.pos &&
            (prodSection === null || e.clientCode === prodSection)
        );

        relatedEcls.forEach(ecl => {
            const cliente = clientMap[ecl.clientCode] || ecl.clientCode;
            orders.push({
                enc: ecl.doc,
                cliente: cliente,
                clientCode: ecl.clientCode,  // 🆕 v2.52.4: código cliente p/ filtro LPR/IPP
                data_entrega: ecl.date,
                medida: prod.desc,
                qtd: ecl.qtd
            });
            console.log(`✅ ${ecl.doc} | ${cliente} | ${ecl.date} | ${prod.desc} | ${ecl.qtd}`);
        });
    });

    console.log(`✅ Parse completo: ${orders.length} encomendas detectadas`);
    if (orders.length === 0) {
        console.warn('⚠️ NENHUMA encomenda detectada! Verifique o formato do PDF.');
    }

    return orders;
}

async function importPdfData() {
    if (!window.importDiff) {
        showToast('⚠️ Faça upload do PDF primeiro.', 'warning');
        return;
    }

    const { toInsert, toUpdate } = window.importDiff;

    if (toInsert.length === 0 && toUpdate.length === 0) {
        showToast('✅ PDF sem diferenças — todos os dados já estão atualizados.', 'success');
        return;
    }

    const statusEl = document.getElementById('pdf-status');
    const BATCH_SIZE = 100; // Supabase payload safety limit

    // Helper: convert "DD/mmm" date to a sort number for chronological ordering
    const monthIdx = {jan:0,fev:1,mar:2,abr:3,mai:4,jun:5,jul:6,ago:7,set:8,out:9,nov:10,dez:11};
    function dateToNum(d) {
        if (!d) return 0;
        const [day, mon] = d.split('/');
        return (monthIdx[mon] || 0) * 100 + (parseInt(day) || 0);
    }

    try {
        // ── 1. UPDATES — patch only PDF-provided fields, preserve manual columns ──
        if (toUpdate.length > 0) {
            statusEl.innerHTML = `<span style="color:#FF9500;">✎ Atualizando ${toUpdate.length} linha(s)...</span>`;
            // PDF-provided fields: date, month, year, enc, medida, qtd, cliente, sem
            // 🔥 v2.52.0: local e obs agora vêm do PDF (Descarga e Referência) se disponíveis
            // Manual fields (transp, et, nviagem, horario_carga) are NOT touched
            await Promise.all(toUpdate.map(({ id, pdfRec }) => {
                const changes = {
                    date: pdfRec.date,
                    month: pdfRec.month,
                    year: pdfRec.year,
                    enc: pdfRec.enc,
                    medida: pdfRec.medida,
                    qtd: pdfRec.qtd,
                    cliente: pdfRec.cliente,
                    sem: pdfRec.sem,
                };
                // 🆕 Só atualizar local/obs se o PDF os fornece (formato novo)
                if (pdfRec.local) changes.local = pdfRec.local;
                if (pdfRec.obs) changes.obs = pdfRec.obs;
                return db.from('mapa_encomendas').update(changes).eq('id', id);
            }));
            // Audit
            toUpdate.forEach(({ id, pdfRec, dbRec }) => {
                logHistory('PDF_UPDATE', {
                    enc: pdfRec.enc,
                    date: pdfRec.date,
                    field_name: 'pdf_reimport',
                    new_value: JSON.stringify({ date: pdfRec.date, enc: pdfRec.enc, medida: pdfRec.medida, qtd: pdfRec.qtd, cliente: pdfRec.cliente }),
                    details: `anterior: ${JSON.stringify({ date: dbRec.date, enc: dbRec.enc, medida: dbRec.medida, qtd: dbRec.qtd, cliente: dbRec.cliente })} (id=${id})`,
                });
            });
        }

        // ── 2. INSERTS — with correct date-grouped positioning ──
        if (toInsert.length > 0) {
            statusEl.innerHTML = `<span style="color:#007AFF;">⏳ Inserindo ${toInsert.length} nova(s) linha(s)...</span>`;

            // Sort new rows: by date chronologically, then by ENC number within same date
            // ECL format "ECL 2026/NNN" → extract NNN for numeric sort
            function encToNum(enc) {
                const m = (enc || '').match(/(\d+)$/);
                return m ? parseInt(m[1]) : 0;
            }
            const sortedInserts = [...toInsert].sort((a, b) => {
                const dateDiff = dateToNum(a.date) - dateToNum(b.date);
                return dateDiff !== 0 ? dateDiff : encToNum(a.enc) - encToNum(b.enc);
            });

            // Build merged list: existing rows (already sorted by row_order) + new rows in correct position
            const existing = [...(window.importDiff.existingRows || [])];

            // Group new rows by date
            const insertsByDate = {};
            sortedInserts.forEach(r => {
                (insertsByDate[r.date] = insertsByDate[r.date] || []).push(r);
            });

            // 🔥 v2.52.4: Juntar todas as linhas e ORDENAR cronologicamente no fim
            // Isto garante que dias aparecem em ordem correcta independentemente do estado inicial da BD
            // Novas linhas vêm no TOPO do dia (antes das existentes) — onde o utilizador quer vê-las
            const allNewRows = [];
            Object.keys(insertsByDate).forEach(date => {
                insertsByDate[date].forEach(r => allNewRows.push({ ...r, _new: true }));
            });

            const merged = [...existing, ...allNewRows];

            // Ordenação final: (1) por data cronológica, (2) dentro do dia: novas primeiro, (3) depois por row_order existente
            merged.sort((a, b) => {
                const dateDiff = dateToNum(a.date) - dateToNum(b.date);
                if (dateDiff !== 0) return dateDiff;
                // Mesma data: novas primeiro (topo do dia)
                if (a._new && !b._new) return -1;
                if (!a._new && b._new) return 1;
                // Ambas novas ou ambas existentes: preservar ordem relativa
                return (a.row_order || 0) - (b.row_order || 0);
            });

            // Re-number the merged list; collect what changed
            const toInsertFinal = [];
            const rowOrderUpdates = []; // existing rows that need a new row_order

            merged.forEach((r, i) => {
                const newOrder = i + 1;
                if (r._new) {
                    const { _new, ...rec } = r;
                    // 🔥 v2.52.0: local e obs já vêm de rec (do PDF), não sobrescrever com ''
                    toInsertFinal.push({ ...rec, local: rec.local || '', obs: rec.obs || '', transp: '', horario_carga: '', row_order: newOrder });
                } else if ((r.row_order || 0) !== newOrder) {
                    rowOrderUpdates.push({ id: r.id, row_order: newOrder });
                }
            });

            // Batch insert new rows (100 at a time)
            for (let i = 0; i < toInsertFinal.length; i += BATCH_SIZE) {
                const chunk = toInsertFinal.slice(i, i + BATCH_SIZE);
                statusEl.innerHTML = `<span style="color:#007AFF;">⏳ Inserindo ${i + chunk.length}/${toInsertFinal.length}...</span>`;
                const { error } = await db.from('mapa_encomendas').insert(chunk);
                if (error) throw error;
            }
            // Audit: log the import as a single batch entry
            logHistory('PDF_INSERT', {
                new_value: `${toInsertFinal.length} linha(s) importadas do PDF`,
                details: JSON.stringify(toInsertFinal.map(r => ({ enc: r.enc, date: r.date, medida: r.medida, qtd: r.qtd, cliente: r.cliente }))),
            });

            // Update shifted row_orders in parallel (only rows whose position changed)
            if (rowOrderUpdates.length > 0) {
                statusEl.innerHTML = `<span style="color:#007AFF;">⏳ Reordenando ${rowOrderUpdates.length} linha(s) existentes...</span>`;
                await Promise.all(rowOrderUpdates.map(({ id, row_order }) =>
                    db.from('mapa_encomendas').update({ row_order }).eq('id', id)
                ));
            }
        }

        const summary = [
            toInsert.length ? `${toInsert.length} adicionada(s)` : '',
            toUpdate.length ? `${toUpdate.length} atualizada(s)` : '',
        ].filter(Boolean).join(', ');

        showToast(`✅ ${summary}`, 'success');
        window.importDiff = null;
        closePdfImporter();
        await loadEncomendasData();
        renderEncomendasGrid();

    } catch (err) {
        console.error('Erro ao importar PDF:', err);
        statusEl.innerHTML = `<span style="color:#FF3B30;">❌ Erro: ${err.message}</span>`;
        showToast('❌ Erro ao importar dados: ' + err.message, 'error');
    }
}

// ===================================================================
// 🔥 v2.51.36 - MAPA CARGAS RESUMO (3 SEMANAS)
// ===================================================================

async function renderResumoCargas() {
    const container = document.getElementById('resumo-cargas-container');
    if (!container) return;
    
    container.innerHTML = '<p style="text-align: center; padding: 40px; color: #666;">⏳ Carregando dados...</p>';
    
    try {
        // 🔥 v2.52.2: Carregar dados das 3 semanas directamente da BD (cross-month)
        console.log('📦 Renderizando resumo — carregando dados da BD...');
        const today = new Date();
        const startWeekNum = getWeekNumber(today);

        // Determinar que meses cobrem as 3 semanas
        const monthAbbrs = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
        const monthsNeeded = new Set();
        for (let w = 0; w < 3; w++) {
            const wDays = generateWeekDays(startWeekNum + w, currentYear);
            wDays.forEach(d => {
                const parts = d.date.split('/');
                if (parts.length === 3) {
                    const mi = parseInt(parts[1]) - 1;
                    monthsNeeded.add(monthAbbrs[mi]);
                }
            });
        }
        console.log(`📅 Meses necessários para resumo: ${[...monthsNeeded].join(', ')}`);

        // Buscar dados de todos os meses necessários
        let allRows = [];
        for (const m of monthsNeeded) {
            const { data: mData } = await db.from('mapa_encomendas')
                .select('date, row_order, cliente, local, medida, qtd, transp, horario_carga, sem')
                .eq('month', m).eq('year', currentYear)
                .order('row_order');
            if (mData) allRows = allRows.concat(mData.map(r => ({ ...r, _month: m })));
        }

        // Agrupar por dia para buildTransportBlocks
        const byDate = {};
        allRows.forEach(r => {
            if (!r.date) return;
            if (!byDate[r.date]) byDate[r.date] = [];
            byDate[r.date].push(r);
        });

        const allBlocks = [];
        for (const [date, dateRows] of Object.entries(byDate)) {
            dateRows.sort((a, b) => a.row_order - b.row_order);
            allBlocks.push(...buildTransportBlocks(dateRows));
        }

        const cargas = allBlocks.map(block => ({
            data: block.date,
            horario_carga: block.horario_carga,
            transp: block.transp,
            sem: (function() {
                try { return getWeekNumberFromDateStr(block.date); }
                catch(e) { return 0; }
            })()
        }));

        // 🔥 v2.52.2: Calcular totais de paletes por dia (TODAS as linhas, não só com TRANSP)
        // e totais isolados para clientes chave
        const KEY_CLIENTS = ['NAVIGATOR', 'DS SMITH', 'POLIVOUGA', 'JANGADA', 'PRS', 'CORK SUPPLY'];
        const palletTotals = {}; // dateKey → { total, clients: { NAVIGATOR: n, ... } }
        allRows.forEach(r => {
            if (!r.date) return;
            const qty = parseInt((r.qtd || '0').replace(/\./g, '').split(',')[0]) || 0;
            if (qty === 0) return;

            // Converter date "DD/mmm" → "DD/MM/YYYY" para comparar com weekDays
            const parts = r.date.split('/');
            const monthMap = {jan:'01',fev:'02',mar:'03',abr:'04',mai:'05',jun:'06',jul:'07',ago:'08',set:'09',out:'10',nov:'11',dez:'12'};
            const dateKey = `${parts[0]}/${monthMap[parts[1]] || '01'}/${currentYear}`;

            if (!palletTotals[dateKey]) {
                palletTotals[dateKey] = { total: 0, clients: {} };
                KEY_CLIENTS.forEach(c => palletTotals[dateKey].clients[c] = 0);
            }
            palletTotals[dateKey].total += qty;

            const cl = (r.cliente || '').toUpperCase();
            KEY_CLIENTS.forEach(key => {
                if (cl.includes(key)) palletTotals[dateKey].clients[key] += qty;
            });
        });

        // Guardar globalmente para usar no renderizador
        window._resumoPalletTotals = palletTotals;
        
        console.log(`✅ ${cargas.length} cargas com transporte preenchido`);
        console.log('📊 Primeiras 3 cargas:', cargas.slice(0, 3));
        
        // Criar estrutura de 3 semanas a partir da semana actual
        const weeks = [];
        for (let i = 0; i < 3; i++) {
            const weekNum = startWeekNum + i;
            weeks.push({
                num: weekNum,
                days: generateWeekDays(weekNum, currentYear),
                loads: {}
            });
        }
        
        console.log('📆 Dias gerados para semana 1:', weeks[0].days.map(d => d.date));
        
        // Agrupar cargas por semana e dia
        cargas.forEach((carga, idx) => {
            if (!carga.data) return;

            // Converter data para formato DD/MM/YYYY (para usar como chave nos cards)
            let dateKey = carga.data;
            if (carga.data.includes('/')) {
                const parts = carga.data.split('/');
                if (parts.length === 2) {
                    // Formato "01/mar" → "01/04/2026"
                    const monthMap = {
                        'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04',
                        'mai': '05', 'jun': '06', 'jul': '07', 'ago': '08',
                        'set': '09', 'out': '10', 'nov': '11', 'dez': '12'
                    };
                    const mes = monthMap[parts[1]] || '01';
                    dateKey = `${parts[0]}/${mes}/${currentYear}`;
                }
                // Formato "24/03/2026" fica igual
            }

            // 🔥 Usar sem do DB directamente — evita inconsistências de cálculo
            const cargaWeek = carga.sem;
            if (!cargaWeek) return;

            // Só considerar cargas das 3 semanas
            const weekIndex = cargaWeek - startWeekNum;
            if (weekIndex < 0 || weekIndex >= 3) {
                return;
            }
            
            const week = weeks[weekIndex];
            
            if (!week.loads[dateKey]) {
                week.loads[dateKey] = { manha: 0, tarde: 0, indefinido: 0 };
            }
            
            const horario = (carga.horario_carga || '').trim();
            
            // Detectar se é horário específico (ex: "06:00-08:00") ou texto ("Manhã"/"Tarde")
            let periodo = 'indefinido';
            
            if (horario === '') {
                periodo = 'indefinido';
            } else if (horario.toLowerCase().includes('manhã') || horario.toLowerCase().includes('manha')) {
                periodo = 'manha';
            } else if (horario.toLowerCase().includes('tarde')) {
                periodo = 'tarde';
            } else if (horario.match(/\d{1,2}:\d{2}/)) {
                // Formato horário: "06:00-08:00" ou "06:00"
                const horaMatch = horario.match(/^(\d{1,2}):(\d{2})/);
                if (horaMatch) {
                    const hora = parseInt(horaMatch[1]);
                    if (hora < 12) {
                        periodo = 'manha';
                    } else {
                        periodo = 'tarde';
                    }
                }
            }
            
            week.loads[dateKey][periodo]++;
            console.log(`   ✅ +1 ${periodo.charAt(0).toUpperCase() + periodo.slice(1)} em ${dateKey} (horario="${horario}")`);
        
        });
        
        console.log('📦 Loads finais:', weeks.map(w => ({ week: w.num, loads: Object.keys(w.loads).length })));
        
        // Renderizar grid
        let html = '<div style="display: flex; flex-direction: column; gap: 30px;">';
        
        weeks.forEach(week => {
            html += `<div style="background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 20px;">`;
            html += `<h3 style="margin: 0 0 16px 0; color: #1D1D1F; font-size: 16px;">📅 Semana ${week.num}</h3>`;
            // 🔥 v2.52.3: Filtrar sáb/dom e alargar cards
            const weekDaysOnly = week.days.filter(d => d.dayName !== 'Sáb' && d.dayName !== 'Dom');
            html += `<div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px;">`;

            weekDaysOnly.forEach(day => {
                const dateKey = day.date;
                const loads = week.loads[dateKey] || { manha: 0, tarde: 0, indefinido: 0 };
                const total = loads.manha + loads.tarde + loads.indefinido;
                
                if (dateKey === '24/03/2026') {
                    console.log(`🔍 DEBUG 24/03: loads=`, loads, 'total=', total, 'week.loads=', week.loads);
                }
                
                // Cor do card: SEM cargas = vermelho, COM cargas = verde
                let bgColor, borderColor;
                if (total === 0) {
                    // Sem cargas = vermelho
                    bgColor = '#F8D7DA';
                    borderColor = '#DC3545';
                } else {
                    // Com cargas = verde
                    bgColor = '#D4EDDA';
                    borderColor = '#28A745';
                }
                
                // Fix: usar onclick sem string literal (evita problemas com aspas)
                const cardId = `card-${dateKey.replace(/\//g, '-')}`;
                html += `<div id="${cardId}" data-date="${dateKey}" style="background: ${bgColor}; border: 2px solid ${borderColor}; border-radius: 8px; padding: 12px; cursor: pointer;">`;
                html += `<div style="font-size: 12px; color: #666; margin-bottom: 4px;">${day.dayName}</div>`;
                html += `<div style="font-size: 14px; font-weight: 700; color: #1D1D1F; margin-bottom: 8px;">${day.date}</div>`;
                
                if (total === 0) {
                    html += `<div style="font-size: 12px; color: #999;">Sem cargas</div>`;
                } else {
                    html += `<div style="font-size: 20px; font-weight: 700; color: #1D1D1F; margin-bottom: 4px;">${total} entrega(s)</div>`;
                    if (loads.manha > 0) html += `<div style="font-size: 11px; color: #666;">☀️ Manhã: ${loads.manha}</div>`;
                    if (loads.tarde > 0) html += `<div style="font-size: 11px; color: #666;">🌙 Tarde: ${loads.tarde}</div>`;
                    if (loads.indefinido > 0) html += `<div style="font-size: 11px; color: #999;">❓ Indefinido: ${loads.indefinido}</div>`;
                }

                // 🔥 v2.52.2: Totais de paletes (todas as linhas + clientes chave)
                const pt = window._resumoPalletTotals?.[dateKey];
                if (pt && pt.total > 0) {
                    html += `<div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(0,0,0,0.1);">`;
                    html += `<div style="font-size:12px;font-weight:700;color:#333;">📦 ${pt.total.toLocaleString('pt-PT')} paletes</div>`;
                    const clientLabels = [
                        { key: 'NAVIGATOR', label: 'Navigator', color: '#007AFF' },
                        { key: 'DS SMITH', label: 'DS Smith', color: '#FF9500' },
                        { key: 'POLIVOUGA', label: 'Polivouga', color: '#34C759' },
                        { key: 'JANGADA', label: 'Jangada', color: '#AF52DE' },
                        { key: 'PRS', label: 'PRS', color: '#FF3B30' },
                        { key: 'CORK SUPPLY', label: 'Cork Supply', color: '#8B6914' },
                    ];
                    // 🔥 v2.52.3: Cada cliente numa linha separada
                    const clientLines = clientLabels
                        .filter(c => pt.clients[c.key] > 0)
                        .map(c => `<div style="font-size:10px;color:${c.color};font-weight:600;">${c.label}: ${pt.clients[c.key].toLocaleString('pt-PT')}</div>`)
                        .join('');
                    if (clientLines) html += `<div style="margin-top:3px;">${clientLines}</div>`;
                    html += `</div>`;
                }
                
                html += `</div>`;
            });
            
            html += `</div></div>`;
        });
        
        html += '</div>';
        container.innerHTML = html;
        
        // 🔥 v2.51.36i: Event delegation ULTRA-SIMPLES com onclick inline
        // Adicionar onclick DIRETO em cada card
        console.log('🔥 [v2.51.36i] Configurando onclick inline nos cards...');
        
        document.querySelectorAll('[id^="card-"]').forEach(card => {
            const dateKey = card.getAttribute('data-date');
            card.onclick = function() {
                console.log('%c🖱️ CLICK NO CARD: ' + dateKey, 'background: #FF9500; color: white; font-size: 16px; font-weight: bold; padding: 5px;');
                window.openCargasDetalhe(dateKey);
            };
            card.style.cursor = 'pointer';
        });
        
        console.log('✅ onclick inline configurado em', document.querySelectorAll('[id^="card-"]').length, 'cards');
        
    } catch (err) {
        console.error('Erro ao carregar resumo de cargas:', err);
        container.innerHTML = `<p style="text-align: center; padding: 40px; color: #DC3545;">❌ Erro ao carregar dados: ${err.message}</p>`;
    }
}

function generateWeekDays(weekNum, year = currentYear) {
    // Gerar 7 dias de uma semana (seg-dom)
    const firstDayOfYear = new Date(year, 0, 1);
    const daysOffset = (weekNum - 1) * 7;
    const weekStart = new Date(firstDayOfYear);
    weekStart.setDate(firstDayOfYear.getDate() + daysOffset);
    
    // Ajustar para segunda-feira
    const dayOfWeek = weekStart.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    weekStart.setDate(weekStart.getDate() + diff);
    
    const days = [];
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    
    for (let i = 0; i < 7; i++) {
        const current = new Date(weekStart);
        current.setDate(weekStart.getDate() + i);
        
        const day = String(current.getDate()).padStart(2, '0');
        const month = String(current.getMonth() + 1).padStart(2, '0');
        const dateStr = `${day}/${month}/${year}`;
        
        days.push({
            date: dateStr,
            dayName: dayNames[current.getDay()]
        });
    }
    
    return days;
}

// 🔥 v2.51.36i: GLOBAL para event delegation funcionar
window.openCargasDetalhe = function(dateKey) {
    console.log(`%c📅 OPEN CARGAS DETALHE: ${dateKey}`, 'background: #007AFF; color: white; font-size: 20px; font-weight: bold; padding: 10px;');
    
    // 🔥 v2.51.37: Mostrar grid tipo Mapa de Cargas para um único dia
    
    // Buscar todas as cargas desse dia
    const cargas = [];
    for (let i = 0; i < encomendasData.dates.length; i++) {
        const data = encomendasData.dates[i];
        
        // Normalizar formato da data
        let normalizedDate = data;
        if (data && data.includes('/')) {
            const parts = data.split('/');
            if (parts.length === 2) {
                // Formato "01/mar" → "01/03/2026"
                const monthMap = {
                    'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04',
                    'mai': '05', 'jun': '06', 'jul': '07', 'ago': '08',
                    'set': '09', 'out': '10', 'nov': '11', 'dez': '12'
                };
                normalizedDate = `${parts[0]}/${monthMap[parts[1]]}/${currentYear}`;
            }
        }
        
        if (normalizedDate === dateKey) {
            const transpKey = `${i}_transp`;
            const transp = encomendasData.data[transpKey];
            
            // Só incluir se tiver TRANSP preenchido
            if (transp && transp.trim() !== '') {
                const horario = encomendasData.data[`${i}_horario_carga`] || '';
                
                // Calcular rowSpan
                let slots = [];
                let rowSpan = 1;
                const horarioNormalizado = horario 
                    ? horario
                        .trim()
                        .replace(/\s+/g, ' ')
                        .replace(/\s*-\s*/g, ' - ')
                        .toUpperCase()
                    : '';
                
                if (!horarioNormalizado || horarioNormalizado === '') {
                    slots = ['SEM_HORARIO'];
                    rowSpan = 1;
                } else if (horarioNormalizado === 'MANHÃ' || horarioNormalizado === 'MANHA') {
                    slots = ['06:00 - 08:00'];
                    rowSpan = 3;
                } else if (horarioNormalizado === 'TARDE') {
                    slots = ['12:00 - 14:00'];
                    rowSpan = 4;
                } else {
                    const knownSlots = ['06:00 - 08:00','08:00 - 10:00','10:00 - 12:00','12:00 - 14:00','14:00 - 16:00','16:00 - 18:00','18:00 - 20:00'];
                    slots = knownSlots.includes(horarioNormalizado) ? [horarioNormalizado] : ['SEM_HORARIO'];
                    rowSpan = 1;
                }

                cargas.push({
                    index: i,
                    date: normalizedDate,
                    cliente: encomendasData.data[`${i}_cliente`] || '',
                    local: encomendasData.data[`${i}_local`] || '',
                    medida: encomendasData.data[`${i}_medida`] || '',
                    qtd: encomendasData.data[`${i}_qtd`] || '',
                    transp: transp,
                    horario: horarioNormalizado,
                    obs: encomendasData.data[`${i}_obs`] || '',
                    slots,
                    rowSpan
                });
            }
        }
    }
    
    console.log(`✅ ${cargas.length} cargas encontradas para ${dateKey}`);
    
    if (cargas.length === 0) {
        showToast('⚠️ Nenhuma carga encontrada para este dia', 'warning');
        return;
    }
    
    // Abrir modal
    const modal = document.getElementById('modal-resumo-dia');
    const title = document.getElementById('resumo-dia-title');
    const subtitle = document.getElementById('resumo-dia-subtitle');
    const stats = document.getElementById('resumo-dia-stats');
    const content = document.getElementById('resumo-dia-content');
    
    // Atualizar título
    const [dia, mes, ano] = dateKey.split('/');
    const date = new Date(ano, parseInt(mes) - 1, parseInt(dia));
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const dayName = dayNames[date.getDay()];
    
    title.textContent = `📦 Cargas de ${dayName}`;
    subtitle.textContent = `${dateKey} • ${cargas.length} carga${cargas.length !== 1 ? 's' : ''}`;
    
    // Contar por período
    let manha = 0, tarde = 0, indefinido = 0;
    cargas.forEach(c => {
        const horario = c.horario.toLowerCase();
        if (horario.includes('manhã') || horario.includes('manha')) {
            manha++;
        } else if (horario.includes('tarde')) {
            tarde++;
        } else if (horario.match(/\d{1,2}:\d{2}/)) {
            const hora = parseInt(horario.match(/^(\d{1,2})/)[1]);
            if (hora < 12) manha++;
            else tarde++;
        } else {
            indefinido++;
        }
    });
    
    // 🔥 v2.51.37d: Usar EXATAMENTE o mesmo código do renderCalendarioSemanal
    stats.innerHTML = `
        <div style="font-size: 13px; color: #666; font-weight: 600; margin-bottom: 12px;">
            Total: <span style="color: #007AFF; font-weight: 700;">${cargas.length} carga${cargas.length !== 1 ? 's' : ''}</span>
        </div>
    `;
    
    // 🔥 v2.51.37d: COPIAR EXATAMENTE o código do renderCalendarioSemanal
    const timeSlots = [
        'SEM_HORARIO',
        '06:00 - 08:00',
        '08:00 - 10:00',
        '10:00 - 12:00',
        '12:00 - 14:00',
        '14:00 - 16:00',
        '16:00 - 18:00',
        '18:00 - 20:00'
    ];
    
    // Criar grid com createElement
    const grid = document.createElement('div');
    grid.className = 'calendario-grid';
    grid.style.gridTemplateColumns = '140px 1fr'; // 1 coluna de horário + 1 dia
    
    // Header
    const headerTime = document.createElement('div');
    headerTime.className = 'calendario-header-cell';
    headerTime.textContent = 'Horário';
    grid.appendChild(headerTime);
    
    const headerDay = document.createElement('div');
    headerDay.className = 'calendario-header-cell';
    const totalBadgeModal = `<span style="display:inline-block;background:#007AFF;color:white;font-size:10px;font-weight:700;padding:1px 7px;border-radius:10px;margin-left:6px;">${cargas.length}</span>`;
    headerDay.innerHTML = `<div style="font-weight:700;">${dayName}${totalBadgeModal}</div><div style="font-size:12px;color:#666;margin-top:4px;">${dateKey}</div>`;
    grid.appendChild(headerDay);
    
    // Rastrear células ocupadas
    const celulasOcupadas = {};
    
    // Agrupar cargas (mesmo código do original)
    const cargasPorDia = {};
    cargasPorDia[dateKey] = cargas.map(c => ({
        ...c,
        date: dateKey
    }));
    
    // Renderizar slots
    timeSlots.forEach(slot => {
        // Coluna horário
        const timeCell = document.createElement('div');
        timeCell.className = 'calendario-time-cell';
        
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
        
        // Célula do dia
        const dayCell = document.createElement('div');
        dayCell.className = 'calendario-day-cell';
        
        const celKey = `${dateKey}_${slot}`;
        const cargasNesteSlot = cargas.filter(c => c.slots.includes(slot));
        
        // Célula ocupada
        const celulaOcupadaPorExpandido = celulasOcupadas[celKey];
        
        if (celulaOcupadaPorExpandido && cargasNesteSlot.length === 0) {
            dayCell.style.visibility = 'hidden';
            grid.appendChild(dayCell);
            return;
        }
        
        if (celulaOcupadaPorExpandido && cargasNesteSlot.length > 0) {
            dayCell.style.position = 'relative';
        }
        
        // Renderizar cargas (EXATAMENTE como no original)
        cargasNesteSlot.forEach((carga, cargoIdx) => {
            // Marcar células ocupadas
            if (cargoIdx === 0 && carga.rowSpan > 1) {
                const slotIndex = timeSlots.indexOf(slot);
                for (let i = 0; i < carga.rowSpan; i++) {
                    const ocupadoSlot = timeSlots[slotIndex + i];
                    if (ocupadoSlot) {
                        celulasOcupadas[`${dateKey}_${ocupadoSlot}`] = true;
                    }
                }
            }
            
            const event = document.createElement('div');
            event.className = 'calendario-event';
            
            const totalCargasNesteSlot = cargasNesteSlot.length;
            
            if (carga.rowSpan > 1) {
                // Blocos expandidos
                event.classList.add('expanded');
                const alturaTotal = (carga.rowSpan * 102) - 10;
                event.style.height = `${alturaTotal}px`;
                event.style.top = '0';
                event.style.zIndex = '5';
                
                if (totalCargasNesteSlot === 1) {
                    event.style.left = '8px';
                    event.style.right = '8px';
                    event.style.width = 'auto';
                } else {
                    const larguraPorBloco = Math.floor(96 / totalCargasNesteSlot);
                    const offsetHorizontal = cargoIdx * (larguraPorBloco + 1);
                    event.style.left = `${offsetHorizontal + 2}%`;
                    event.style.right = 'auto';
                    event.style.width = `${larguraPorBloco}%`;
                }
            } else if (totalCargasNesteSlot > 1) {
                event.style.display = 'inline-block';
                event.style.verticalAlign = 'top';
                event.style.marginRight = '4px';
                const larguraPorBloco = Math.floor((100 / totalCargasNesteSlot) - 1);
                event.style.width = `${larguraPorBloco}%`;
                event.style.minWidth = '120px';
            } else if (celulaOcupadaPorExpandido) {
                event.style.position = 'relative';
                event.style.zIndex = '10';
                event.style.marginTop = '4px';
            }
            
            // Badge e cor (EXATAMENTE como no original)
            let badgeHorario = '';
            let backgroundColor = '';
            
            if (!carga.horario || carga.horario.trim() === '') {
                badgeHorario = '<span style="background:#FF9500;color:white;font-size:9px;padding:2px 6px;border-radius:4px;font-weight:600;margin-left:4px;">⚠️ SEM HORÁRIO</span>';
                backgroundColor = 'linear-gradient(135deg, #FF9500 0%, #FF6B00 100%)';
            } else if (carga.horario === 'MANHÃ' || carga.horario === 'MANHA') {
                badgeHorario = '<span style="background:#007AFF;color:white;font-size:9px;padding:2px 6px;border-radius:4px;font-weight:600;margin-left:4px;">☀️ MANHÃ (06-12h)</span>';
                backgroundColor = 'linear-gradient(135deg, #007AFF 0%, #0051D5 100%)';
            } else if (carga.horario === 'TARDE') {
                badgeHorario = '<span style="background:#007AFF;color:white;font-size:9px;padding:2px 6px;border-radius:4px;font-weight:600;margin-left:4px;">🌆 TARDE (12-20h)</span>';
                backgroundColor = 'linear-gradient(135deg, #007AFF 0%, #0051D5 100%)';
            } else {
                badgeHorario = `<span style="background:#007AFF;color:white;font-size:9px;padding:2px 6px;border-radius:4px;font-weight:600;margin-left:4px;">🕐 ${carga.horario}</span>`;
                backgroundColor = 'linear-gradient(135deg, #007AFF 0%, #0051D5 100%)';
            }
            
            event.style.background = backgroundColor;
            
            event.innerHTML = `
                <div class="calendario-event-title">${carga.cliente || '(sem cliente)'}${badgeHorario}</div>
                <div class="calendario-event-details">
                    📍 ${carga.local || '---'}<br>
                    📦 ${carga.medida || '---'} × ${carga.qtd || '---'}<br>
                    🚚 ${carga.transp}
                </div>
            `;
            
            dayCell.appendChild(event);
        });

        // Badge de contagem sempre visível no canto superior direito da célula
        if (cargasNesteSlot.length > 0) {
            dayCell.style.position = 'relative';
            const countBadge = document.createElement('div');
            countBadge.style.cssText = 'position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.6);color:white;font-size:10px;font-weight:700;padding:1px 6px;border-radius:10px;z-index:30;pointer-events:none;';
            countBadge.textContent = cargasNesteSlot.length;
            dayCell.appendChild(countBadge);
        }

        grid.appendChild(dayCell);
    });

    content.innerHTML = '';
    content.appendChild(grid);
    
    console.log('📦 [OPEN DETALHE] Abrindo modal do dia...');
    console.log('   [OPEN DETALHE] Modal:', modal);
    console.log('   [OPEN DETALHE] Display antes:', modal.style.display);
    
    // 🔥 CRÍTICO: MOVER modal para BODY
    if (modal.parentElement !== document.body) {
        console.log('   🚨 [OPEN DETALHE] MOVENDO modal para body...');
        document.body.appendChild(modal);
        console.log('   ✅ [OPEN DETALHE] Modal movido!');
    }
    
    // CRÍTICO: Prevenir que close seja chamado
    modal.dataset.opening = 'true';
    
    // 🔥 v2.51.36k: FORÇAR display + z-index + opacity + ALIGN
    modal.style.setProperty('display', 'flex', 'important');
    modal.style.setProperty('align-items', 'center', 'important');
    modal.style.setProperty('justify-content', 'center', 'important');
    modal.style.setProperty('z-index', '99999', 'important');
    modal.style.setProperty('opacity', '1', 'important');
    modal.style.setProperty('pointer-events', 'auto', 'important');
    
    // 🔥 CRÍTICO: Forçar dimensões no .modal-dialog com cssText
    // v2.52.25: largura responsiva 95vw (antes 900px fixo) — aproveita ecrã todo
    const dialog = modal.querySelector('.modal-dialog');
    if (dialog) {
        dialog.style.cssText = `
            display: flex !important;
            width: 95vw !important;
            min-width: 600px !important;
            max-width: 1800px !important;
            max-height: 92vh !important;
            background: white !important;
            border-radius: 16px !important;
            overflow: hidden !important;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3) !important;
            position: relative !important;
        `;
        console.log('   ✅ [OPEN DETALHE] Dialog forçado com cssText');
        console.log('   ✅ [OPEN DETALHE] Dialog offsetWidth:', dialog.offsetWidth, 'offsetHeight:', dialog.offsetHeight);

        if (dialog.offsetWidth === 0) {
            console.error('%c🚨 DETALHE DIALOG AINDA É 0!', 'background: red; color: white; font-size: 14px; padding: 5px;');
            dialog.setAttribute('style', 'display: flex !important; width: 95vw !important; background: white !important; border-radius: 16px !important;');
            console.log('   → offsetWidth após setAttribute:', dialog.offsetWidth);
        }
    } else {
        console.error('   ❌ [OPEN DETALHE] .modal-dialog NÃO ENCONTRADO!');
    }
    
    console.log('   [OPEN DETALHE] Display após flex:', modal.style.display);
    console.log('   [OPEN DETALHE] Z-index:', modal.style.zIndex);
    console.log('   [OPEN DETALHE] Opacity:', modal.style.opacity);
    
    // 🔥 v2.51.36i: MutationObserver para detectar mudanças
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const currentDisplay = modal.style.display;
                if (currentDisplay === 'none' || currentDisplay === '') {
                    console.error('%c🚨 DETALHE: ALGUÉM MUDOU O DISPLAY!', 'background: red; color: white; font-size: 16px; padding: 5px;');
                    console.trace();
                    modal.style.setProperty('display', 'flex', 'important');
                }
            }
        });
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['style', 'class'] });
    modal._observer = observer;
    
    setTimeout(() => {
        modal.classList.add('active');
        delete modal.dataset.opening;
        console.log('   [OPEN DETALHE] Classe active adicionada');
        console.log('   [OPEN DETALHE] Display final:', modal.style.display);
        
        // 🔥 TESTE: Verificar se modal está visível
        const rect = modal.getBoundingClientRect();
        console.log('   📐 [OPEN DETALHE] Posição modal:', {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            visible: rect.width > 0 && rect.height > 0
        });
        
        if (rect.width === 0 || rect.height === 0) {
            console.error('%c⚠️ MODAL DETALHE TEM WIDTH/HEIGHT = 0!', 'background: red; color: white; font-size: 16px; padding: 5px;');
        }
    }, 10);
}

// 🔥 v2.51.36i: GLOBAL para onclick funcionar
window.closeResumoDiaModal = function() {
    const modal = document.getElementById('modal-resumo-dia');
    
    // CRÍTICO: Não fechar se está abrindo
    if (modal.dataset.opening === 'true') {
        console.log('⚠️ [CLOSE DETALHE] CANCELADO - Modal está abrindo!');
        return;
    }
    
    console.log('🚪 [CLOSE DETALHE] Fechando modal...');
    
    // Desconectar observer
    if (modal._observer) {
        modal._observer.disconnect();
        delete modal._observer;
    }
    
    modal.classList.remove('active');
    setTimeout(() => {
        modal.style.display = 'none';
        console.log('🚪 [CLOSE DETALHE] Modal fechado');
    }, 300);
}

// 🔥 v2.51.36i: GLOBAL para onclick funcionar
window.openMapaCargas = function() {
    window.closeResumoDiaModal();
    changeTab('calendario');
}

// ===================================================================
// 🔥 v2.51.36h: Event Delegation Global (SOLUÇÃO DEFINITIVA)
// ===================================================================

// Event delegation no BODY (funciona mesmo se elemento criado dinamicamente)
document.addEventListener('click', function(e) {
    // Botão Importar PDF (múltiplos checks)
    const isPdfBtn = 
        e.target.id === 'import-pdf-btn' || 
        e.target.closest('#import-pdf-btn') ||
        e.target.classList?.contains('import-pdf-btn') ||
        (e.target.tagName === 'BUTTON' && e.target.textContent?.includes('Importar PDF'));
    
    if (isPdfBtn) {
        console.log('🖱️ [DELEGATION] CLICK DETECTADO NO BOTÃO PDF!');
        console.log('   [DELEGATION] Target:', e.target);
        console.log('   [DELEGATION] Target ID:', e.target.id);
        console.log('   [DELEGATION] Target Classes:', e.target.className);
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();  // CRÍTICO: Prevenir outros listeners
        openPdfImporter();
        return;
    }
    
    // Log de debug para outros clicks (apenas IDs importantes)
    if (e.target.id && (e.target.id.includes('btn') || e.target.id.includes('import'))) {
        console.log('🖱️ Click em elemento:', e.target.id);
    }
}, true);  // useCapture = true (captura antes de bubble)

console.log('✅ Event delegation global configurado (PDF + multi-check)');

// 🔥 v2.51.37e: Forçar zoom reset para TV/Android Box
function forceZoomReset() {
    console.log('📺 Forçando zoom reset para TV/Android...');
    
    // Adicionar classe ao body
    document.body.classList.add('zoom-reset');
    
    // Forçar viewport zoom
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    }
    
    // Tentar resetar zoom via JavaScript
    if (document.body.style.zoom !== undefined) {
        document.body.style.zoom = '1.0';
    }
    
    // Prevenir pinch-zoom
    document.addEventListener('gesturestart', function(e) {
        e.preventDefault();
    });
    
    document.addEventListener('touchmove', function(e) {
        if (e.scale !== 1) {
            e.preventDefault();
        }
    }, { passive: false });
    
    console.log('✅ Zoom reset aplicado');
    console.log('   Screen size:', window.screen.width, 'x', window.screen.height);
    console.log('   Window size:', window.innerWidth, 'x', window.innerHeight);
    console.log('   Zoom:', document.body.style.zoom || 'default');
}

// Aplicar imediatamente
forceZoomReset();

// Reaplicar após resize
window.addEventListener('resize', forceZoomReset);

// ===================================================================
// 🖨️ IMPRIMIR CARGAS DO DIA (v2.52.0)
// ===================================================================

function openPrintCargasModal() {
    const modal = document.getElementById('modal-print-cargas');
    if (!modal) return;
    modal.classList.add('active');

    // Default to today's date
    const dateInput = document.getElementById('print-cargas-date');
    const today = new Date();
    dateInput.value = today.toISOString().split('T')[0];

    // Attach change listener
    dateInput.onchange = () => generatePrintCargasPreview();

    // Generate initial preview
    generatePrintCargasPreview();
}

function closePrintCargasModal() {
    const modal = document.getElementById('modal-print-cargas');
    if (modal) modal.classList.remove('active');
}

async function generatePrintCargasPreview() {
    const dateInput = document.getElementById('print-cargas-date');
    const preview = document.getElementById('print-cargas-preview');
    const printBtn = document.getElementById('print-cargas-confirm-btn');

    if (!dateInput.value) {
        preview.innerHTML = '<p style="color:#999;text-align:center;">Selecione uma data.</p>';
        printBtn.disabled = true;
        return;
    }

    const selectedDate = new Date(dateInput.value);
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const monthNames = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
    const monthAbbr = monthNames[selectedDate.getMonth()];
    const year = selectedDate.getFullYear();
    const dateStr = `${day}/${monthAbbr}`;
    const dayNames = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
    const dayName = dayNames[selectedDate.getDay()];

    preview.innerHTML = '<p style="text-align:center;color:#666;">⏳ A carregar cargas...</p>';

    try {
        // Fetch all rows for this day
        const { data, error } = await db
            .from('mapa_encomendas')
            .select('*')
            .eq('month', monthAbbr)
            .eq('year', year)
            .eq('date', dateStr)
            .order('row_order', { ascending: true });

        if (error) throw error;

        // 🔥 v2.52.1: Usar blocos de transporte em vez de linhas individuais
        const blocks = buildTransportBlocks(data || []);

        if (blocks.length === 0) {
            preview.innerHTML = `<p style="text-align:center;color:#999;padding:20px;">Nenhuma carga encontrada para <strong>${dateStr} (${dayName})</strong></p>`;
            printBtn.disabled = true;
            return;
        }

        // Agrupar blocos por horário
        const grouped = {};
        blocks.forEach(block => {
            const slot = block.horario_carga || 'Sem Horário';
            if (!grouped[slot]) grouped[slot] = [];
            grouped[slot].push(block);
        });

        // Build preview table
        let html = `<div style="margin-bottom:12px;">
            <strong style="font-size:16px;">${dateStr} — ${dayName}</strong>
            <span style="color:#666;margin-left:12px;">${blocks.length} entrega(s)</span>
        </div>`;
        html += '<table style="width:100%;border-collapse:collapse;font-size:12px;">';
        html += '<thead><tr style="background:#E5E5EA;">';
        html += '<th style="padding:6px 8px;text-align:left;border:1px solid #D1D1D6;">Horário</th>';
        html += '<th style="padding:6px 8px;text-align:left;border:1px solid #D1D1D6;">Transp</th>';
        html += '<th style="padding:6px 8px;text-align:left;border:1px solid #D1D1D6;">Cliente</th>';
        html += '<th style="padding:6px 8px;text-align:left;border:1px solid #D1D1D6;">Local</th>';
        html += '<th style="padding:6px 8px;text-align:left;border:1px solid #D1D1D6;">Medida</th>';
        html += '<th style="padding:6px 8px;text-align:right;border:1px solid #D1D1D6;">Qtd</th>';
        html += '<th style="padding:6px 8px;text-align:left;border:1px solid #D1D1D6;">ENC</th>';
        html += '<th style="padding:6px 8px;text-align:left;border:1px solid #D1D1D6;">Obs</th>';
        html += '</tr></thead><tbody>';

        const slotOrder = ['Sem Horário','06:00 - 08:00','08:00 - 10:00','10:00 - 12:00','12:00 - 14:00','14:00 - 16:00','16:00 - 18:00','18:00 - 20:00'];
        const sortedSlots = Object.keys(grouped).sort((a, b) => {
            const ia = slotOrder.indexOf(a);
            const ib = slotOrder.indexOf(b);
            return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        });

        sortedSlots.forEach(slot => {
            grouped[slot].forEach((block, bi) => {
                // Cabeçalho do bloco (transporte)
                const totalItems = block.items.length;
                block.items.forEach((item, ii) => {
                    html += '<tr style="border-bottom:1px solid #E5E5EA;">';
                    if (bi === 0 && ii === 0) {
                        const slotBlockCount = grouped[slot].reduce((sum, b) => sum + b.items.length, 0);
                        html += `<td style="padding:6px 8px;border:1px solid #D1D1D6;font-weight:600;vertical-align:top;" rowspan="${slotBlockCount}">${slot}</td>`;
                    }
                    if (ii === 0) {
                        html += `<td style="padding:6px 8px;border:1px solid #D1D1D6;font-weight:600;vertical-align:top;background:#f0f4ff;" rowspan="${totalItems}">${block.transp}<br><span style="font-size:10px;color:#666;">NºV: ${block.nviagem || '—'}</span></td>`;
                    }
                    html += `<td style="padding:6px 8px;border:1px solid #D1D1D6;">${item.cliente}</td>`;
                    html += `<td style="padding:6px 8px;border:1px solid #D1D1D6;">${item.local}</td>`;
                    html += `<td style="padding:6px 8px;border:1px solid #D1D1D6;">${item.medida}</td>`;
                    html += `<td style="padding:6px 8px;border:1px solid #D1D1D6;text-align:right;">${item.qtd}</td>`;
                    html += `<td style="padding:6px 8px;border:1px solid #D1D1D6;">${item.enc}</td>`;
                    html += `<td style="padding:6px 8px;border:1px solid #D1D1D6;">${item.obs}</td>`;
                    html += '</tr>';
                });
            });
        });

        html += '</tbody></table>';
        preview.innerHTML = html;
        printBtn.disabled = false;

        // Store for printing
        window._printCargasData = { blocks, dateStr, dayName, year, grouped, sortedSlots };

    } catch (err) {
        console.error('Erro ao gerar preview de impressão:', err);
        preview.innerHTML = `<p style="color:#FF3B30;text-align:center;">❌ Erro: ${err.message}</p>`;
        printBtn.disabled = true;
    }
}

function executePrintCargas() {
    if (!window._printCargasData) return;
    const { blocks, dateStr, dayName, year, grouped, sortedSlots } = window._printCargasData;

    // 🔥 v2.52.1: Impressão com blocos de transporte
    let printHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Cargas ${dateStr} ${dayName}</title>
    <style>
        @page { size: landscape; margin: 12mm; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #000; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        h2 { font-size: 13px; color: #555; margin-top: 0; font-weight: normal; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th { background: #333; color: #fff; padding: 6px 8px; text-align: left; font-size: 11px; }
        td { padding: 5px 8px; border: 1px solid #ccc; font-size: 11px; }
        .transp-cell { font-weight: 700; background: #f0f4ff; vertical-align: top; }
        .footer { margin-top: 16px; font-size: 10px; color: #999; text-align: right; }
    </style></head><body>
    <h1>Cargas — ${dateStr} (${dayName})</h1>
    <h2>PSY — Gestao de Estufas | ${blocks.length} entrega(s) | Impresso: ${new Date().toLocaleString('pt-PT')}</h2>
    <table>
    <thead><tr>
        <th>Horario</th><th>Transp.</th><th>Cliente</th><th>Local</th>
        <th>Medida</th><th style="text-align:right;">Qtd</th><th>ENC</th><th>Obs</th>
    </tr></thead><tbody>`;

    sortedSlots.forEach(slot => {
        grouped[slot].forEach((block, bi) => {
            block.items.forEach((item, ii) => {
                printHtml += '<tr>';
                if (bi === 0 && ii === 0) {
                    const slotRows = grouped[slot].reduce((s, b) => s + b.items.length, 0);
                    printHtml += `<td rowspan="${slotRows}" style="font-weight:700;vertical-align:top;">${slot}</td>`;
                }
                if (ii === 0) {
                    printHtml += `<td class="transp-cell" rowspan="${block.items.length}">${block.transp}<br><small>NV: ${block.nviagem || '—'}</small></td>`;
                }
                printHtml += `<td>${item.cliente}</td>`;
                printHtml += `<td>${item.local}</td>`;
                printHtml += `<td>${item.medida}</td>`;
                printHtml += `<td style="text-align:right;">${item.qtd}</td>`;
                printHtml += `<td>${item.enc}</td>`;
                printHtml += `<td>${item.obs}</td>`;
                printHtml += '</tr>';
            });
        });
    });

    printHtml += `</tbody></table>
    <div class="footer">PalSystems — Gestão de Estufas e Cargas</div>
    </body></html>`;

    // Open print window
    const printWindow = window.open('', '_blank', 'width=1100,height=700');
    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
    }, 500);

    closePrintCargasModal();
    showToast('🖨️ Janela de impressão aberta', 'info');
}

// 🔥 v2.51.36i: Garantir que auto-refresh inicia
console.log('%c🚀 INICIALIZANDO SISTEMA...', 'background: #5AC8FA; color: white; font-size: 16px; padding: 5px;');
checkAuthState();
initMatrixSystem();
// 🆕 v2.52.6: Carregar lista de transportadores em background
loadTransportadores();

// Iniciar auto-refresh após 5 segundos (dar tempo para carregar dados)
setTimeout(() => {
    console.log('%c🔄 INICIANDO AUTO-REFRESH (60s)...', 'background: #34C759; color: white; font-size: 16px; padding: 5px;');
    startAutoRefresh();
}, 5000);
