document.addEventListener('DOMContentLoaded', () => {
    // Scroll Reveal Animation
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.08
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
    const mainYtHeading = document.getElementById('main-youtube-heading');
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

    function playDocumentaryInMainPlayer(videoId, title) {
        if (!ytIframe) return;
        ytIframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
        if (mainYtHeading) {
            mainYtHeading.innerHTML = `<i class="fa-brands fa-youtube"></i> Viendo: ${title}`;
        }
        const card = document.getElementById('main-youtube-card');
        if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
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
    let activeSubmenu = null;

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

    [loginForm, registerForm, accountSettingsForm].forEach(form => {
        if (!form) return;
        form.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                form.requestSubmit();
            }
        });
    });

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
        updatePollAdminControls(false);
        loadPoll();
        loadReleaseCountdown();
        loadTrivia();
        loadComments();
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
        loadReleaseCountdown();
        loadTrivia();
        loadComments();
    }

    // ==========================================
    // 1. TEMA DEL PRÓXIMO VIDEO (5 TEMAS -> VOTACIÓN)
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

        if (pollAdminControls) {
            pollAdminControls.classList.toggle('hidden', !isAdmin);
        }
        const adminReleaseForm = document.getElementById('admin-release-form');
        if (adminReleaseForm) {
            adminReleaseForm.classList.toggle('hidden', !isAdmin);
        }
        const adminTriviaForm = document.getElementById('admin-trivia-form');
        if (adminTriviaForm) {
            adminTriviaForm.classList.toggle('hidden', !isAdmin);
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
        updatePollAdminControls(isAdmin);

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

    // ==========================================
    // 2. PRÓXIMO ESTRENO EN PRODUCCIÓN (COUNTDOWN)
    // ==========================================
    let releaseTargetTimestamp = Date.now() + 5 * 86400000;
    async function loadReleaseCountdown() {
        try {
            const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
            const res = await fetch(`${API_BASE}/api/release`, { headers });
            if (!res.ok) return;
            const data = await res.json();
            if (data.nextRelease) {
                document.getElementById('release-title-display').textContent = `«${data.nextRelease.title}»`;
                releaseTargetTimestamp = new Date(data.nextRelease.targetDate).getTime();
            }
        } catch (e) {}
    }

    function tickCountdown() {
        const diff = Math.max(0, releaseTargetTimestamp - Date.now());
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        document.getElementById('cd-days').textContent = String(d).padStart(2, '0');
        document.getElementById('cd-hours').textContent = String(h).padStart(2, '0');
        document.getElementById('cd-mins').textContent = String(m).padStart(2, '0');
        document.getElementById('cd-secs').textContent = String(s).padStart(2, '0');
    }
    setInterval(tickCountdown, 1000);
    tickCountdown();

    const adminReleaseForm = document.getElementById('admin-release-form');
    if (adminReleaseForm) {
        adminReleaseForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('admin-release-title').value.trim();
            const targetDate = document.getElementById('admin-release-date').value;
            if (!title || !targetDate) return;
            try {
                const res = await fetch(`${API_BASE}/api/release`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ title, targetDate: new Date(targetDate).toISOString() })
                });
                if (res.ok) {
                    loadReleaseCountdown();
                }
            } catch (err) {}
        });
    }

    // ==========================================
    // 3. UN DÍA COMO HOY EN LA HISTORIA (AUTOMÁTICO)
    // ==========================================
    function renderEphemeris() {
        const now = new Date();
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const day = now.getDate();
        const monthName = months[now.getMonth()];
        document.getElementById('ephemeris-date-badge').textContent = `${day} de ${monthName} en la Historia`;

        const milestones = [
            { year: '79 d.C.', text: 'El Monte Vesubio sepulta la ciudad romana de Pompeya bajo un manto ardiente de ceniza y piedra pómez, congelando en el tiempo la vida cotidiana del Imperio.' },
            { year: '1200', text: 'El rey Felipe II Augusto ordena levantar la imponente fortaleza medieval del Louvre a orillas del Sena para proteger las murallas de París.' },
            { year: '1912', text: 'En los astilleros de Harland & Wolff culminan las pruebas del RMS Titanic, el coloso transatlántico cuyo viaje inaugural marcaría la historia marítima.' }
        ];

        const container = document.getElementById('ephemeris-list');
        container.innerHTML = '';
        milestones.forEach(item => {
            const div = document.createElement('div');
            div.className = 'ephemeris-item';
            div.innerHTML = `<div class="ephemeris-year">Año ${item.year}</div><div class="ephemeris-text">${item.text}</div>`;
            container.appendChild(div);
        });
    }
    renderEphemeris();

    // ==========================================
    // 4. RETO HISTÓRICO SEMANAL (TRIVIA + RANKING)
    // ==========================================
    async function loadTrivia() {
        try {
            const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
            const res = await fetch(`${API_BASE}/api/trivia?voterId=${encodeURIComponent(voterId)}`, { headers });
            if (!res.ok) return;
            const data = await res.json();
            renderTrivia(data);
        } catch (e) {}
    }

    function renderTrivia(data) {
        document.getElementById('trivia-question-text').textContent = data.question || '';
        const box = document.getElementById('trivia-options-box');
        box.innerHTML = '';
        const answered = data.myAnswer !== null && data.myAnswer !== undefined;

        (data.options || []).forEach((optText, idx) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'trivia-opt-btn';
            if (answered) {
                btn.disabled = true;
                if (idx === data.correctIndex) btn.classList.add('correct');
                else if (idx === data.myAnswer) btn.classList.add('wrong');
            }
            btn.textContent = optText;
            btn.addEventListener('click', () => submitTriviaAnswer(idx));
            box.appendChild(btn);
        });

        const lbList = document.getElementById('leaderboard-list');
        lbList.innerHTML = '';
        const lb = data.leaderboard || [];
        if (lb.length === 0) {
            lbList.innerHTML = '<li><span>Inicia sesión y acierta para inaugurar el Cuadro de Honor</span><span>+10 pts</span></li>';
        } else {
            lb.forEach((entry, i) => {
                const li = document.createElement('li');
                li.innerHTML = `<span>#${i + 1} · <strong>${entry.name}</strong></span><span>${entry.points} pts</span>`;
                lbList.appendChild(li);
            });
        }
    }

    async function submitTriviaAnswer(optionIndex) {
        const fb = document.getElementById('trivia-feedback');
        try {
            const headers = {
                'Content-Type': 'application/json',
                ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
            };
            const res = await fetch(`${API_BASE}/api/trivia/answer`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ optionIndex, voterId })
            });
            const data = await res.json();
            if (res.ok) {
                fb.textContent = data.isCorrect
                    ? '¡Respuesta correcta! Has demostrado gran conocimiento histórico.'
                    : 'Respuesta incorrecta. ¡Sigue explorando nuestros documentales!';
                fb.className = `auth-feedback ${data.isCorrect ? 'success' : 'error'}`;
                loadTrivia();
            }
        } catch (err) {}
    }

    const adminTriviaForm = document.getElementById('admin-trivia-form');
    if (adminTriviaForm) {
        adminTriviaForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const question = document.getElementById('admin-trivia-q').value.trim();
            const options = [
                document.getElementById('admin-trivia-o0').value.trim(),
                document.getElementById('admin-trivia-o1').value.trim(),
                document.getElementById('admin-trivia-o2').value.trim(),
                document.getElementById('admin-trivia-o3').value.trim()
            ];
            try {
                const res = await fetch(`${API_BASE}/api/trivia/update`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ question, options, correctIndex: 0 })
                });
                if (res.ok) {
                    adminTriviaForm.reset();
                    loadTrivia();
                }
            } catch (err) {}
        });
    }

    // ==========================================
    // 5. MAPA INTERACTIVO Y 6. BIBLIOTECA DE DOCUMENTALES REALES
    // ==========================================
    const DOCUMENTARIES = [
        {
            id: 'rJdAGfxEYkw',
            title: 'El Louvre en el año 1200: La fortaleza olvidada de París',
            era: 'París, Francia · Año 1200',
            category: 'antigua',
            mapX: 48.5,
            mapY: 23.5,
            desc: 'Descubre los cimientos subterráneos y la vida militar dentro de la fortaleza medieval antes de convertirse en palacio y museo.'
        },
        {
            id: 'PVVdxqlf5XQ',
            title: 'El Horno Térmico de Pompeya: La Falsa Salvación de la Élite Romana',
            era: 'Pompeya, Italia · 79 d.C.',
            category: 'antigua',
            mapX: 52.2,
            mapY: 28.0,
            desc: 'La reconstrucción minuto a minuto del destino de los habitantes de Pompeya ante la furia piroclástica del Vesubio.'
        },
        {
            id: '27AZ11nTUz0',
            title: 'El Secreto de los Constructores de Giza: 2570 a.C.',
            era: 'Giza, Egipto · 2570 a.C.',
            category: 'antigua',
            mapX: 56.8,
            mapY: 36.5,
            desc: '¿Cómo vivían, comían y trabajaban los miles de artesanos e ingenieros que levantaron la Gran Pirámide?'
        },
        {
            id: 'O-ewFhxFahk',
            title: 'Así era vivir en Nazaret antes de Cristo',
            era: 'Galilea · Siglo I a.C.',
            category: 'antigua',
            mapX: 59.2,
            mapY: 34.0,
            desc: 'Un viaje arqueológico a las casas excavadas en roca, costumbres y oficios de una aldea judía del siglo I.'
        },
        {
            id: 'OT_2LgSxUtY',
            title: '11 de septiembre de 2001: La evacuación de Manhattan',
            era: 'Nueva York, EE. UU. · 2001',
            category: 'tragedias',
            mapX: 27.5,
            mapY: 27.5,
            desc: 'La mayor evacuación marítima y civil en la historia moderna de Nueva York narrada desde dentro.'
        },
        {
            id: 'T8BdFd4Zm7Q',
            title: 'El Restaurante en las Alturas de las Torres Gemelas',
            era: 'Nueva York, EE. UU. · Piso 107',
            category: 'tragedias',
            mapX: 28.2,
            mapY: 26.8,
            desc: 'La historia de Windows on the World, el legendario restaurante en la cima de la Torre Norte.'
        },
        {
            id: 'muZvqVzTTQ4',
            title: 'Así era ser oficinista en las Torres Gemelas',
            era: 'Nueva York · Años 80 y 90',
            category: 'tragedias',
            mapX: 26.8,
            mapY: 28.2,
            desc: 'Una inmersión en los ascensores expresos, pasillos y rutinas de la ciudad vertical más famosa del siglo XX.'
        },
        {
            id: '8I2sy6C4l10',
            title: 'La vida cotidiana en las Torres Gemelas antes del colapso',
            era: 'Manhattan · Historia Contemporánea',
            category: 'tragedias',
            mapX: 27.2,
            mapY: 29.0,
            desc: 'Cómo funcionaba por dentro el complejo que albergaba a más de 50,000 trabajadores cada día.'
        },
        {
            id: '7lgpnoQpDXc',
            title: 'Así se Construyó el Titanic: La Negligencia que Sepultó un Gigante',
            era: 'Belfast / Atlántico Norte · 1909–1912',
            category: 'tragedias',
            mapX: 45.2,
            mapY: 20.5,
            desc: 'Los secretos industriales, remaches y decisiones de diseño detrás del transatlántico más famoso de la historia.'
        },
        {
            id: 'AdulsJeHVIU',
            title: 'El hombre que fingió ser médico durante 18 años: La Gran Mentira',
            era: 'Ginebra / Francia · Caso Forense Real',
            category: 'misterios',
            mapX: 49.8,
            mapY: 25.2,
            desc: 'El impactante caso psicológico y criminal de una vida entera construida sobre una farsa.'
        }
    ];

    function renderInteractiveMap() {
        const pinsLayer = document.getElementById('map-pins-layer');
        const infoBox = document.getElementById('map-selected-info');
        if (!pinsLayer || !infoBox) return;

        pinsLayer.innerHTML = '';
        DOCUMENTARIES.forEach((doc, idx) => {
            const pin = document.createElement('button');
            pin.type = 'button';
            pin.className = `map-pin-btn ${idx === 0 ? 'active' : ''}`;
            pin.style.left = `${doc.mapX}%`;
            pin.style.top = `${doc.mapY}%`;
            pin.title = `${doc.era} — ${doc.title}`;
            pin.innerHTML = '<i class="fa-solid fa-shoe-prints"></i>';
            pin.addEventListener('click', () => {
                document.querySelectorAll('.map-pin-btn').forEach(b => b.classList.remove('active'));
                pin.classList.add('active');
                selectMapLocation(doc);
            });
            pinsLayer.appendChild(pin);
        });

        selectMapLocation(DOCUMENTARIES[0]);
    }

    function selectMapLocation(doc) {
        const infoBox = document.getElementById('map-selected-info');
        if (!infoBox) return;
        infoBox.innerHTML = `
            <div style="flex:1;min-width:220px;">
                <div class="doc-card-era">${doc.era}</div>
                <div style="font-size:1.2rem;font-weight:700;color:var(--gold-light);margin:2px 0 4px;">${doc.title}</div>
                <div style="font-size:1.02rem;color:var(--text-muted);">${doc.desc}</div>
            </div>
            <button type="button" class="gold-submit-btn" id="map-play-selected-btn">
                <i class="fa-solid fa-play"></i> Ver Documental Aquí
            </button>
        `;
        document.getElementById('map-play-selected-btn').addEventListener('click', () => {
            playDocumentaryInMainPlayer(doc.id, doc.title);
        });
    }

    function renderDocumentaryLibrary(filterCat = 'all') {
        const grid = document.getElementById('library-grid');
        if (!grid) return;
        grid.innerHTML = '';

        const filtered = filterCat === 'all'
            ? DOCUMENTARIES
            : DOCUMENTARIES.filter(d => d.category === filterCat);

        filtered.forEach(doc => {
            const card = document.createElement('div');
            card.className = 'doc-card';
            card.innerHTML = `
                <div class="doc-thumb-wrap">
                    <img src="https://i.ytimg.com/vi/${doc.id}/hqdefault.jpg" alt="${doc.title}" loading="lazy">
                    <span class="doc-play-badge"><i class="fa-solid fa-play"></i> Reproducir</span>
                </div>
                <div class="doc-card-body">
                    <span class="doc-card-era">${doc.era}</span>
                    <div class="doc-card-title">${doc.title}</div>
                </div>
            `;
            card.addEventListener('click', () => {
                playDocumentaryInMainPlayer(doc.id, doc.title);
            });
            grid.appendChild(card);
        });
    }

    document.querySelectorAll('.lib-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.lib-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderDocumentaryLibrary(btn.getAttribute('data-cat'));
        });
    });

    renderInteractiveMap();
    renderDocumentaryLibrary('all');

    // ==========================================
    // MURO DE COMENTARIOS / DEBATE DE LA COMUNIDAD
    // ==========================================
    const communityForm = document.getElementById('community-comment-form');
    const communityInput = document.getElementById('community-comment-input');
    const communityList = document.getElementById('community-comments-list');

    async function loadComments() {
        try {
            const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
            const res = await fetch(`${API_BASE}/api/comments`, { headers });
            if (!res.ok) return;
            const data = await res.json();
            renderComments(data.comments || [], Boolean(data.isAdmin));
        } catch (e) {}
    }

    function renderComments(comments, isAdmin) {
        if (!communityList) return;
        communityList.innerHTML = '';
        if (comments.length === 0) {
            communityList.innerHTML = '<p class="empty-conv-text">Sé el primero en dejar tu comentario sobre nuestros documentales.</p>';
            return;
        }
        comments.forEach(c => {
            const div = document.createElement('div');
            div.className = 'community-comment-item';
            const top = document.createElement('div');
            top.className = 'community-comment-top';

            const authorSpan = document.createElement('span');
            authorSpan.textContent = c.author || 'Seguidor';
            top.appendChild(authorSpan);

            const rightWrap = document.createElement('div');
            rightWrap.style.display = 'flex';
            rightWrap.style.alignItems = 'center';
            rightWrap.style.gap = '8px';

            const dateSpan = document.createElement('span');
            dateSpan.textContent = formatTime(c.createdAt);
            rightWrap.appendChild(dateSpan);

            if (isAdmin) {
                const delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.className = 'delete-topic-btn';
                delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
                delBtn.addEventListener('click', () => deleteComment(c.id));
                rightWrap.appendChild(delBtn);
            }

            top.appendChild(rightWrap);

            const textDiv = document.createElement('div');
            textDiv.className = 'community-comment-text';
            textDiv.textContent = c.text;

            div.appendChild(top);
            div.appendChild(textDiv);
            communityList.appendChild(div);
        });
    }

    if (communityForm) {
        communityForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = communityInput.value.trim();
            if (!text) return;
            communityInput.value = '';
            try {
                const headers = {
                    'Content-Type': 'application/json',
                    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
                };
                const res = await fetch(`${API_BASE}/api/comments/add`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ text })
                });
                if (res.ok) {
                    loadComments();
                }
            } catch (err) {}
        });
    }

    async function deleteComment(commentId) {
        if (!authToken) return;
        try {
            await fetch(`${API_BASE}/api/comments/delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ commentId })
            });
            loadComments();
        } catch (err) {}
    }

    updatePollAdminControls();
    loadPoll();
    loadReleaseCountdown();
    loadTrivia();
    loadComments();

    setInterval(() => {
        loadPoll();
        loadComments();
    }, 6000);

    if (authToken && currentUser) {
        enterChatView();
    }
});
