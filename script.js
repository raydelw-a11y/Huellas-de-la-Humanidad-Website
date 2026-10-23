document.addEventListener('DOMContentLoaded', () => {
    // Scroll Reveal Animation
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.glass-panel').forEach(panel => {
        panel.classList.add('fade-in');
        observer.observe(panel);
    });

    // Auto-update latest YouTube video from channel RSS feed
    const CHANNEL_ID = 'UCayIhjKhh0KFaJlzRIRkSZQ';
    const ytIframe = document.getElementById('youtube-latest-player');
    if (ytIframe) {
        const rssUrl = encodeURIComponent(`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`);
        fetch(`https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}`)
            .then(res => res.json())
            .then(data => {
                if (data && data.items && data.items.length > 0) {
                    const latestItem = data.items[0];
                    const parts = (latestItem.guid || '').split(':');
                    const videoId = parts[parts.length - 1];
                    if (videoId && !ytIframe.src.includes(videoId)) {
                        ytIframe.src = `https://www.youtube.com/embed/${videoId}`;
                    }
                }
            })
            .catch(() => {});
    }

    // ==========================================
    // SUBMENÚ SUPERIOR DE CUENTA Y CHAT EN VIVO
    // ==========================================
    const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? ''
        : 'https://huellas-chat-api.onrender.com';

    const guestTopButtons = document.getElementById('guest-top-buttons');
    const loggedTopButtons = document.getElementById('logged-top-buttons');
    const topUserDisplay = document.getElementById('top-user-display');

    const btnOpenLogin = document.getElementById('btn-open-login');
    const btnOpenRegister = document.getElementById('btn-open-register');
    const btnOpenSettings = document.getElementById('btn-open-settings');
    const btnTopLogout = document.getElementById('btn-top-logout');
    const closeSubmenuBtn = document.getElementById('close-submenu-btn');
    const topSubmenuDropdown = document.getElementById('top-submenu-dropdown');

    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const accountSettingsForm = document.getElementById('account-settings-form');
    const authFeedback = document.getElementById('auth-feedback');

    const chatGuestPrompt = document.getElementById('chat-guest-prompt');
    const chatTriggerLogin = document.getElementById('chat-trigger-login');
    const chatTriggerRegister = document.getElementById('chat-trigger-register');
    const userChatView = document.getElementById('user-chat-view');
    const adminChatView = document.getElementById('admin-chat-view');

    const regPasswordInput = document.getElementById('reg-password');
    const ruleLength = document.getElementById('rule-length');
    const ruleNumber = document.getElementById('rule-number');
    const ruleSymbol = document.getElementById('rule-symbol');

    let authToken = localStorage.getItem('huellas_chat_token') || '';
    let currentUser = null;
    try {
        currentUser = JSON.parse(localStorage.getItem('huellas_chat_user') || 'null');
    } catch (e) {
        currentUser = null;
    }

    let selectedAdminUser = null;
    let pollTimer = null;
    let activeSubmenu = null; // 'login' | 'register' | 'settings' | null

    function showFeedback(msg, type = 'error') {
        authFeedback.textContent = msg;
        authFeedback.className = `auth-feedback ${type}`;
    }

    function clearFeedback() {
        authFeedback.textContent = '';
        authFeedback.className = 'auth-feedback hidden';
    }

    function openSubmenu(mode) {
        clearFeedback();
        if (activeSubmenu === mode && !topSubmenuDropdown.classList.contains('hidden')) {
            closeSubmenu();
            return;
        }
        activeSubmenu = mode;
        topSubmenuDropdown.classList.remove('hidden');

        loginForm.classList.toggle('hidden', mode !== 'login');
        registerForm.classList.toggle('hidden', mode !== 'register');
        accountSettingsForm.classList.toggle('hidden', mode !== 'settings');

        btnOpenLogin.classList.toggle('active', mode === 'login');
        btnOpenRegister.classList.toggle('active', mode === 'register');
        if (btnOpenSettings) btnOpenSettings.classList.toggle('active', mode === 'settings');

        if (mode === 'settings' && currentUser) {
            document.getElementById('settings-email').value = currentUser.email || '';
            document.getElementById('settings-notify-yt').checked = currentUser.notifyYoutube !== false;
        }
    }

    function closeSubmenu() {
        activeSubmenu = null;
        topSubmenuDropdown.classList.add('hidden');
        btnOpenLogin.classList.remove('active');
        btnOpenRegister.classList.remove('active');
        if (btnOpenSettings) btnOpenSettings.classList.remove('active');
        clearFeedback();
    }

    btnOpenLogin.addEventListener('click', () => openSubmenu('login'));
    btnOpenRegister.addEventListener('click', () => openSubmenu('register'));
    if (btnOpenSettings) btnOpenSettings.addEventListener('click', () => openSubmenu('settings'));
    closeSubmenuBtn.addEventListener('click', closeSubmenu);

    if (chatTriggerLogin) {
        chatTriggerLogin.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            openSubmenu('login');
            setTimeout(() => document.getElementById('login-username').focus(), 300);
        });
    }
    if (chatTriggerRegister) {
        chatTriggerRegister.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            openSubmenu('register');
            setTimeout(() => document.getElementById('reg-username').focus(), 300);
        });
    }

    // Mostrar / Ocultar contraseña
    document.querySelectorAll('.toggle-pwd-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            const icon = btn.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                icon.className = 'fa-regular fa-eye-slash';
            } else {
                input.type = 'password';
                icon.className = 'fa-regular fa-eye';
            }
        });
    });

    // Validación en vivo de reglas de contraseña (mín. 8 caracteres, 1 número, 1 símbolo)
    function checkPasswordRules(pwd) {
        const hasLen = pwd.length >= 8;
        const hasNum = /[0-9]/.test(pwd);
        const hasSym = /[^A-Za-z0-9]/.test(pwd);

        updateRuleItem(ruleLength, hasLen);
        updateRuleItem(ruleNumber, hasNum);
        updateRuleItem(ruleSymbol, hasSym);

        return hasLen && hasNum && hasSym;
    }

    function updateRuleItem(el, valid) {
        if (!el) return;
        const icon = el.querySelector('i');
        if (valid) {
            el.classList.add('valid');
            if (icon) icon.className = 'fa-solid fa-circle-check';
        } else {
            el.classList.remove('valid');
            if (icon) icon.className = 'fa-regular fa-circle';
        }
    }

    regPasswordInput.addEventListener('input', () => {
        checkPasswordRules(regPasswordInput.value);
    });

    // Soporte explícito para tecla Enter en todos los formularios del submenú
    [loginForm, registerForm, accountSettingsForm].forEach(form => {
        if (!form) return;
        form.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                form.requestSubmit();
            }
        });
    });

    // Registro de cuenta nueva (con correo opcional)
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearFeedback();

        const username = document.getElementById('reg-username').value.trim();
        const password = regPasswordInput.value;
        const email = document.getElementById('reg-email').value.trim();

        if (!checkPasswordRules(password)) {
            return showFeedback('La contraseña debe tener mínimo 8 caracteres, al menos 1 número y 1 símbolo.');
        }

        try {
            const res = await fetch(`${API_BASE}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, email })
            });
            const data = await res.json();
            if (!res.ok) {
                return showFeedback(data.error || 'No se pudo crear la cuenta.');
            }
            saveSession(data.token, data.user);
            closeSubmenu();
            enterChatView();
        } catch (err) {
            showFeedback('Conectando con el servidor, intenta de nuevo en unos segundos...');
        }
    });

    // Inicio de sesión (Usuario o Admin)
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearFeedback();

        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        try {
            const res = await fetch(`${API_BASE}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (!res.ok) {
                return showFeedback(data.error || 'Usuario o contraseña incorrectos.');
            }
            saveSession(data.token, data.user);
            closeSubmenu();
            enterChatView();
        } catch (err) {
            showFeedback('Conectando con el servidor, intenta de nuevo en unos segundos...');
        }
    });

    // Guardar Opciones de la Cuenta (Correo electrónico y notificaciones de YouTube)
    accountSettingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearFeedback();

        const email = document.getElementById('settings-email').value.trim();
        const notifyYoutube = document.getElementById('settings-notify-yt').checked;

        try {
            const res = await fetch(`${API_BASE}/api/account/settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ email, notifyYoutube })
            });
            const data = await res.json();
            if (!res.ok) {
                return showFeedback(data.error || 'No se pudieron guardar las opciones.');
            }
            saveSession(authToken, data.user);
            showFeedback('¡Correo y notificaciones actualizados correctamente!', 'success');
        } catch (err) {
            showFeedback('Error de conexión al guardar opciones.');
        }
    });

    function saveSession(token, user) {
        authToken = token;
        currentUser = user;
        localStorage.setItem('huellas_chat_token', token);
        localStorage.setItem('huellas_chat_user', JSON.stringify(user));
    }

    function logout() {
        authToken = '';
        currentUser = null;
        selectedAdminUser = null;
        localStorage.removeItem('huellas_chat_token');
        localStorage.removeItem('huellas_chat_user');
        if (pollTimer) clearInterval(pollTimer);
        closeSubmenu();
        guestTopButtons.classList.remove('hidden');
        loggedTopButtons.classList.add('hidden');
        userChatView.classList.add('hidden');
        adminChatView.classList.add('hidden');
        chatGuestPrompt.classList.remove('hidden');
        updatePollAdminControls(false, null);
        loadPoll();
    }

    btnTopLogout.addEventListener('click', logout);

    function formatTime(isoStr) {
        try {
            const d = new Date(isoStr);
            return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return '';
        }
    }

    function renderMessages(container, messages) {
        container.innerHTML = '';
        if (!messages || messages.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'empty-conv-text';
            empty.textContent = 'No hay mensajes aún. ¡Escribe el primero!';
            container.appendChild(empty);
            return;
        }
        messages.forEach(m => {
            const bubble = document.createElement('div');
            const isFromAdmin = m.role === 'admin';
            bubble.className = `msg-bubble ${isFromAdmin ? 'from-admin' : 'from-user'}`;

            const meta = document.createElement('div');
            meta.className = 'msg-meta';
            const senderSpan = document.createElement('span');
            senderSpan.textContent = m.sender;
            const timeSpan = document.createElement('span');
            timeSpan.textContent = formatTime(m.createdAt);
            meta.appendChild(senderSpan);
            meta.appendChild(timeSpan);

            const textDiv = document.createElement('div');
            textDiv.textContent = m.text;

            bubble.appendChild(meta);
            bubble.appendChild(textDiv);
            container.appendChild(bubble);
        });
        container.scrollTop = container.scrollHeight;
    }

    async function loadUserMessages() {
        if (!authToken || !currentUser) return;
        try {
            const res = await fetch(`${API_BASE}/api/chat/messages`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (res.status === 401) return logout();
            const data = await res.json();
            const box = document.getElementById('user-messages-box');
            renderMessages(box, data.messages || []);
        } catch (e) {}
    }

    async function loadAdminConversations() {
        if (!authToken || !currentUser || currentUser.role !== 'admin') return;
        try {
            const res = await fetch(`${API_BASE}/api/admin/conversations`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (res.status === 401) return logout();
            const data = await res.json();
            const listEl = document.getElementById('admin-conversations-list');
            const convs = data.conversations || [];

            if (convs.length === 0) {
                listEl.innerHTML = '<p class="empty-conv-text">Aún no hay mensajes de seguidores.</p>';
                return;
            }

            listEl.innerHTML = '';
            convs.forEach(c => {
                const item = document.createElement('div');
                item.className = `conv-item ${selectedAdminUser === c.username ? 'active' : ''}`;

                const top = document.createElement('div');
                top.className = 'conv-item-top';
                const nameSpan = document.createElement('span');
                nameSpan.textContent = c.displayName;
                top.appendChild(nameSpan);

                if (c.unreadByAdmin > 0) {
                    const pill = document.createElement('span');
                    pill.className = 'unread-pill';
                    pill.textContent = c.unreadByAdmin;
                    top.appendChild(pill);
                }

                const preview = document.createElement('div');
                preview.className = 'conv-preview';
                preview.textContent = c.lastMessage ? c.lastMessage.text : 'Sin mensajes';

                item.appendChild(top);
                item.appendChild(preview);

                item.addEventListener('click', () => {
                    selectedAdminUser = c.username;
                    document.getElementById('admin-active-header').textContent = `Conversación con: ${c.displayName} (@${c.username})`;
                    document.getElementById('admin-msg-input').disabled = false;
                    document.getElementById('admin-send-btn').disabled = false;
                    loadAdminSelectedMessages();
                    loadAdminConversations();
                });

                listEl.appendChild(item);
            });

            if (selectedAdminUser) {
                loadAdminSelectedMessages();
            }
        } catch (e) {}
    }

    async function loadAdminSelectedMessages() {
        if (!selectedAdminUser) return;
        try {
            const res = await fetch(`${API_BASE}/api/chat/messages?user=${encodeURIComponent(selectedAdminUser)}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (!res.ok) return;
            const data = await res.json();
            const box = document.getElementById('admin-messages-box');
            renderMessages(box, data.messages || []);
        } catch (e) {}
    }

    // Enviar mensaje (Seguidor)
    const userChatForm = document.getElementById('user-chat-form');
    userChatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('user-msg-input');
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        try {
            const res = await fetch(`${API_BASE}/api/chat/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ text })
            });
            const data = await res.json();
            if (res.ok && data.messages) {
                renderMessages(document.getElementById('user-messages-box'), data.messages);
            }
        } catch (err) {}
    });

    // Enviar respuesta (Admin)
    const adminChatForm = document.getElementById('admin-chat-form');
    adminChatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedAdminUser) return;
        const input = document.getElementById('admin-msg-input');
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        try {
            const res = await fetch(`${API_BASE}/api/chat/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ text, targetUser: selectedAdminUser })
            });
            const data = await res.json();
            if (res.ok && data.messages) {
                renderMessages(document.getElementById('admin-messages-box'), data.messages);
                loadAdminConversations();
            }
        } catch (err) {}
    });

    function enterChatView() {
        if (!authToken || !currentUser) return;
        guestTopButtons.classList.add('hidden');
        loggedTopButtons.classList.remove('hidden');
        topUserDisplay.textContent = currentUser.role === 'admin'
            ? `${currentUser.username} (Admin)`
            : (currentUser.displayName || currentUser.username);

        chatGuestPrompt.classList.add('hidden');
        if (pollTimer) clearInterval(pollTimer);

        if (currentUser.role === 'admin') {
            userChatView.classList.add('hidden');
            adminChatView.classList.remove('hidden');
            document.getElementById('current-admin-label').textContent = currentUser.username;
            loadAdminConversations();
            pollTimer = setInterval(loadAdminConversations, 3500);
        } else {
            adminChatView.classList.add('hidden');
            userChatView.classList.remove('hidden');
            document.getElementById('current-user-label').textContent = currentUser.displayName || currentUser.username;
            loadUserMessages();
            pollTimer = setInterval(loadUserMessages, 3500);
        }
        updatePollAdminControls();
        loadPoll();
    }

    // ==========================================
    // SECCIÓN TEMA DEL PRÓXIMO VIDEO (5 TEMAS -> VOTACIÓN)
    // ==========================================
    let voterId = localStorage.getItem('huellas_voter_id');
    if (!voterId) {
        voterId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : ('v_' + Date.now() + '_' + Math.random().toString(36).slice(2));
        localStorage.setItem('huellas_voter_id', voterId);
    }

    const topicSuggestForm = document.getElementById('topic-suggest-form');
    const topicTitleInput = document.getElementById('topic-title-input');
    const pollTopicsList = document.getElementById('poll-topics-list');
    const pollStageBadge = document.getElementById('poll-stage-badge');
    const pollDescription = document.getElementById('poll-description');
    const pollFeedback = document.getElementById('poll-feedback');
    const pollAdminControls = document.getElementById('poll-admin-controls');
    const pollResetBtn = document.getElementById('poll-reset-btn');

    function showPollFeedback(msg, type = 'error') {
        if (!pollFeedback) return;
        pollFeedback.textContent = msg;
        pollFeedback.className = `auth-feedback ${type}`;
        setTimeout(() => {
            pollFeedback.className = 'auth-feedback hidden';
        }, 4500);
    }

    function updatePollAdminControls(serverIsAdmin = null) {
        const isAdmin = serverIsAdmin !== null
            ? Boolean(serverIsAdmin)
            : Boolean(authToken && currentUser && currentUser.role === 'admin');

        if (!pollAdminControls) return;
        if (isAdmin) {
            pollAdminControls.classList.remove('hidden');
        } else {
            pollAdminControls.classList.add('hidden');
        }
    }

    async function loadPoll() {
        try {
            const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
            const res = await fetch(`${API_BASE}/api/poll?voterId=${encodeURIComponent(voterId)}`, { headers });
            if (!res.ok) return;
            const data = await res.json();
            renderPoll(data);
        } catch (e) {}
    }

    function renderPoll(data) {
        const topics = data.topics || [];
        const isVoting = topics.length >= 5;
        const totalVotes = data.totalVotes || 0;
        const isAdmin = Boolean(data.isAdmin);
        updatePollAdminControls(isAdmin, data.currentUsername);

        if (isVoting) {
            pollStageBadge.textContent = `¡Votaciones Abiertas! (${totalVotes} ${totalVotes === 1 ? 'voto' : 'votos'})`;
            pollStageBadge.classList.add('voting-active');
            pollDescription.textContent = 'Ya se han establecido los 5 temas finalistas. ¡Vota por el documental que quieres ver en el próximo video!';
            topicSuggestForm.classList.add('hidden');
        } else {
            pollStageBadge.textContent = `Propuestas: ${topics.length} / 5`;
            pollStageBadge.classList.remove('voting-active');
            pollDescription.textContent = `Propón el suceso histórico, misterio o documental que quieres ver. Faltan ${5 - topics.length} ${5 - topics.length === 1 ? 'tema' : 'temas'} para abrir las votaciones.`;
            topicSuggestForm.classList.remove('hidden');
        }

        pollTopicsList.innerHTML = '';
        if (topics.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'empty-conv-text';
            empty.style.textAlign = 'center';
            empty.textContent = 'Aún no hay temas propuestos en esta ronda. ¡Sé el primero en proponer uno!';
            pollTopicsList.appendChild(empty);
            return;
        }

        topics.forEach((t, idx) => {
            const pct = totalVotes > 0 ? Math.round((t.votes / totalVotes) * 100) : 0;
            const card = document.createElement('div');
            card.className = `poll-topic-card ${t.votedByMe ? 'voted-by-me' : ''}`;

            const top = document.createElement('div');
            top.className = 'poll-topic-top';

            const info = document.createElement('div');
            info.className = 'poll-topic-info';

            const num = document.createElement('span');
            num.className = 'poll-topic-number';
            num.textContent = `Tema #${idx + 1}`;

            const title = document.createElement('div');
            title.className = 'poll-topic-title';
            title.textContent = t.title;

            const author = document.createElement('div');
            author.className = 'poll-topic-author';
            author.textContent = `Propuesto por: ${t.author || 'Seguidor'}`;

            info.appendChild(num);
            info.appendChild(title);
            info.appendChild(author);

            const actions = document.createElement('div');
            actions.className = 'poll-topic-actions';

            if (isVoting) {
                const voteBtn = document.createElement('button');
                voteBtn.type = 'button';
                voteBtn.className = `vote-btn ${t.votedByMe ? 'voted' : ''}`;
                voteBtn.innerHTML = t.votedByMe
                    ? '<i class="fa-solid fa-check"></i> Tu Voto'
                    : '<i class="fa-solid fa-check-to-slot"></i> Votar';
                voteBtn.addEventListener('click', () => castVote(t.id));
                actions.appendChild(voteBtn);
            }

            if (isAdmin) {
                const delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.className = 'delete-topic-btn';
                delBtn.title = 'Eliminar este tema (Admin)';
                delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
                delBtn.addEventListener('click', () => deleteTopic(t.id));
                actions.appendChild(delBtn);
            }

            top.appendChild(info);
            top.appendChild(actions);
            card.appendChild(top);

            if (isVoting) {
                const progressWrap = document.createElement('div');
                progressWrap.className = 'poll-progress-wrap';
                const bar = document.createElement('div');
                bar.className = 'poll-progress-bar';
                bar.style.width = `${pct}%`;
                progressWrap.appendChild(bar);

                const stats = document.createElement('div');
                stats.className = 'poll-stats-row';
                stats.innerHTML = `<span>${t.votes} ${t.votes === 1 ? 'voto' : 'votos'}</span><span>${pct}%</span>`;

                card.appendChild(progressWrap);
                card.appendChild(stats);
            }

            pollTopicsList.appendChild(card);
        });
    }

    if (topicSuggestForm) {
        topicSuggestForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = topicTitleInput.value.trim();
            if (!title) return;
            try {
                const headers = {
                    'Content-Type': 'application/json',
                    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
                };
                const res = await fetch(`${API_BASE}/api/poll/suggest`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ title })
                });
                const data = await res.json();
                if (!res.ok) {
                    return showPollFeedback(data.error || 'No se pudo registrar el tema.');
                }
                topicTitleInput.value = '';
                showPollFeedback('¡Tema propuesto con éxito!', 'success');
                loadPoll();
            } catch (err) {
                showPollFeedback('Conectando con el servidor, intenta de nuevo en unos segundos...');
            }
        });
    }

    async function castVote(topicId) {
        try {
            const headers = {
                'Content-Type': 'application/json',
                ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
            };
            const res = await fetch(`${API_BASE}/api/poll/vote`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ topicId, voterId })
            });
            const data = await res.json();
            if (!res.ok) {
                return showPollFeedback(data.error || 'No se pudo registrar tu voto.');
            }
            loadPoll();
        } catch (err) {}
    }

    async function deleteTopic(topicId) {
        if (!authToken) return;
        try {
            await fetch(`${API_BASE}/api/poll/delete-topic`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ topicId })
            });
            loadPoll();
        } catch (err) {}
    }

    if (pollResetBtn) {
        pollResetBtn.addEventListener('click', async () => {
            if (!authToken) return;
            try {
                await fetch(`${API_BASE}/api/poll/reset`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                showPollFeedback('Ronda reiniciada. Ya se pueden proponer 5 nuevos temas.', 'success');
                loadPoll();
            } catch (err) {}
        });
    }

    updatePollAdminControls();
    loadPoll();
    setInterval(loadPoll, 5000);

    if (authToken && currentUser) {
        enterChatView();
    }
});
