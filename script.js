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

    // ==========================================
    // SISTEMA BILINGÜE: ESPAÑOL (POR DEFECTO) / INGLÉS
    // ==========================================
    let currentLang = localStorage.getItem('huellas_lang') || 'es';
    if (currentLang !== 'es' && currentLang !== 'en') currentLang = 'es';

    const I18N = {
        es: {
            header_bio: '«Si quieres seguir cruzando el umbral del tiempo para vivir la historia desde dentro, suscríbete hoy. Cada historia deja una huella. Aquí seguimos sus rastros.»',
            btn_login: 'Iniciar Sesión',
            btn_register: 'Crear Cuenta',
            btn_settings: 'Opciones de la Cuenta',
            btn_logout: 'Cerrar Sesión',
            label_username: 'Usuario',
            ph_login_user: 'Ingresa tu usuario',
            label_password: 'Contraseña',
            ph_login_pwd: 'Ingresa tu contraseña',
            btn_enter_account: 'Entrar a mi Cuenta',
            label_choose_user: 'Elige tu Nombre de Usuario',
            ph_reg_user: 'Ej: historiador_99 (no uses tu correo)',
            hint_user_no_email: 'El correo electrónico no se puede usar como nombre de usuario.',
            label_create_pwd: 'Crea tu Contraseña',
            ph_reg_pwd: 'Mínimo 8 caracteres, 1 número y 1 símbolo',
            rule_len: 'Mínimo 8 caracteres',
            rule_num: 'Al menos 1 número (0-9)',
            rule_sym: 'Al menos 1 símbolo (!@#$%^&*...)',
            label_email: 'Correo Electrónico',
            label_email_opt: '(Opcional · Solo visible para ti)',
            ph_reg_email: 'tucorreo@ejemplo.com (privado, solo visible para ti)',
            hint_email_yt: 'Tu correo electrónico es privado (solo visible para ti) y sirve para avisarte cuando subamos un nuevo video a YouTube.',
            label_settings_email: 'Correo Electrónico para Notificaciones',
            label_only_visible_you: '(Solo visible para ti)',
            hint_settings_email_priv: 'Tu correo electrónico es confidencial y únicamente visible para ti en esta sección.',
            err_email_as_user: 'El correo electrónico no se puede usar como nombre de usuario. Elige un apodo único (tu correo es privado y solo es visible para ti).',
            err_login_no_email: 'Inicia sesión con tu nombre de usuario, no con tu correo electrónico.',
            ph_settings_email: 'tucorreo@ejemplo.com',
            label_notify_chk: 'Recibir una notificación por correo electrónico cuando se suba un nuevo video a YouTube',
            btn_save_settings: 'Guardar Opciones',
            poll_title: 'Tema del Próximo Video',
            ph_suggest_topic: 'Escribe tu propuesta de tema...',
            btn_suggest_topic: 'Proponer Tema',
            btn_reset_poll: 'Reiniciar Ronda (5 temas)',
            countdown_title: 'Próximo Estreno',
            release_default_sub: 'Próximo Documental Especial en Producción',
            countdown_tbd: 'Por decidir',
            cd_days: 'Días',
            cd_hours: 'Horas',
            cd_mins: 'Min',
            cd_secs: 'Seg',
            ephemeris_title: 'Un Día Como Hoy',
            trivia_title: 'Reto Histórico',
            leaderboard_title: 'Cuadro de Honor de Historiadores',
            socials_title: 'Nuestras Redes',
            latest_yt_title: 'Último en YouTube',
            watching_prefix: 'Viendo:',
            map_title: 'Mapa Interactivo de las «Huellas»',
            map_subtitle: 'Pasa el puntero o toca con el dedo cualquier punto dorado del mapa terrestre para desplegar su línea flotante con el título, ubicación e historia.',
            region_world: '🌍 Mapa Mundial (25)',
            region_europe: '🏛️ Europa y Mediterráneo (12)',
            region_americas: '🌎 América y Caribe (11)',
            region_asia: '🌏 Asia e Indonesia (2)',
            btn_watch_doc: 'Ver Documental',
            btn_watch_here: 'Ver Documental Aquí',
            btn_play: 'Reproducir',
            library_title: 'Biblioteca de Documentales',
            cat_all: 'Todos (25)',
            cat_ancient: 'Edad Antigua y Media',
            cat_modern: 'Tragedias e Historia Moderna',
            cat_mysteries: 'Casos y Misterios Reales',
            latest_tiktok_title: 'Últimos en TikTok',
            latest_fb_title: 'Último en Facebook',
            chat_title: 'Ponte en Contacto',
            chat_subtitle: 'Escríbenos en directo a través del chat.',
            chat_guest_msg: 'Para conversar en directo con nosotros, inicia sesión o crea tu cuenta en el menú superior.',
            connected_as: 'Conectado como',
            ph_chat_msg: 'Escribe tu mensaje...',
            btn_send: 'Enviar',
            admin_convs_title: 'Conversaciones de Seguidores',
            admin_no_msgs: 'Aún no hay mensajes de seguidores.',
            admin_select_prompt: 'Selecciona un seguidor arriba para responder',
            ph_admin_reply: 'Escribe tu respuesta...',
            btn_reply: 'Responder',
            wall_title: 'Muro de Debate',
            wall_subtitle: 'Comparte tu opinión o teoría sobre nuestros documentales con toda la comunidad.',
            ph_wall_comment: '¿Qué teoría, pregunta o reflexión sobre nuestros documentales quieres compartir hoy?',
            btn_post_wall: 'Publicar en el Muro',
            nav_home: 'Inicio y Documentales',
            btn_open_wall_full: 'Entrar al Muro de Debate',
            btn_back_home: 'Volver a Inicio y Documentales',
            opt_general_topic: '📌 Tema general del canal',
            fb_like: 'Me gusta',
            fb_comment: 'Comentar',
            fb_reply: 'Responder',
            fb_comments_count: 'comentarios',
            fb_comment_singular: 'comentario',
            fb_replying_to: 'Respondiendo a',
            fb_write_comment: 'Escribe un comentario...',
            fb_write_reply: 'Escribe tu respuesta a',
            fb_cancel: 'Cancelar',
            footer_rights: 'Todos los derechos reservados.',
            poll_voting_open: '¡Votaciones Abiertas!',
            poll_vote_singular: 'voto',
            poll_vote_plural: 'votos',
            poll_voting_desc: 'Ya se han establecido los 5 temas finalistas. ¡Vota por el documental que quieres ver en el próximo video!',
            poll_proposals_badge: 'Propuestas',
            poll_Empty: 'Aún no hay temas propuestos en esta ronda. ¡Sé el primero en proponer uno!',
            poll_topic_label: 'Tema',
            poll_proposed_by: 'Propuesto por:',
            poll_follower: 'Seguidor',
            poll_your_vote: 'Tu Voto',
            poll_vote_btn: 'Votar',
            wall_empty: 'Sé el primero en crear una publicación en el Muro de Debate.',
            lb_empty: 'Inicia sesión y acierta para inaugurar el Cuadro de Honor',
            map_docs_count: '25 Documentales',
            btn_bg_audio_on: 'Audio Fondo: ON',
            btn_bg_audio_off: 'Audio Fondo: OFF'
        },
        en: {
            header_bio: '“If you want to keep crossing the threshold of time to experience history from within, subscribe today. Every story leaves a footprint. Here we follow their traces.”',
            btn_login: 'Sign In',
            btn_register: 'Create Account',
            btn_settings: 'Account Settings',
            btn_logout: 'Log Out',
            label_username: 'Username',
            ph_login_user: 'Enter your username',
            label_password: 'Password',
            ph_login_pwd: 'Enter your password',
            btn_enter_account: 'Sign In to My Account',
            label_choose_user: 'Choose Your Username',
            ph_reg_user: 'E.g. historian_99 (do not use your email)',
            hint_user_no_email: 'An email address cannot be used as a username.',
            label_create_pwd: 'Create Your Password',
            ph_reg_pwd: 'Min 8 characters, 1 number & 1 symbol',
            rule_len: 'Minimum 8 characters',
            rule_num: 'At least 1 number (0-9)',
            rule_sym: 'At least 1 symbol (!@#$%^&*...)',
            label_email: 'Email Address',
            label_email_opt: '(Optional · Only visible to you)',
            ph_reg_email: 'youremail@example.com (private, only visible to you)',
            hint_email_yt: 'Your email address is private (only visible to you) and used to notify you when we upload a new documentary to YouTube.',
            label_settings_email: 'Email Address for Notifications',
            label_only_visible_you: '(Only visible to you)',
            hint_settings_email_priv: 'Your email address is confidential and only visible to you in this section.',
            err_email_as_user: 'An email address cannot be used as a username. Please choose a unique nickname (your email is private and only visible to you).',
            err_login_no_email: 'Please sign in with your username, not your email address.',
            ph_settings_email: 'youremail@example.com',
            label_notify_chk: 'Receive an email notification whenever a new video is uploaded to YouTube',
            btn_save_settings: 'Save Settings',
            poll_title: 'Next Video Topic',
            ph_suggest_topic: 'Write your topic suggestion...',
            btn_suggest_topic: 'Suggest Topic',
            btn_reset_poll: 'Reset Round (5 topics)',
            countdown_title: 'Next Premiere',
            release_default_sub: 'Next Special Documentary in Production',
            countdown_tbd: 'To Be Decided',
            cd_days: 'Days',
            cd_hours: 'Hours',
            cd_mins: 'Min',
            cd_secs: 'Sec',
            ephemeris_title: 'On This Day',
            trivia_title: 'Historical Challenge',
            leaderboard_title: 'Historians Hall of Fame',
            socials_title: 'Our Social Networks',
            latest_yt_title: 'Latest on YouTube',
            watching_prefix: 'Watching:',
            map_title: 'Interactive “Footprints” World Map',
            map_subtitle: 'Hover your pointer or touch any golden point on the real Earth map to display a floating leader line with the video title and location.',
            region_world: '🌍 Full World Map (25)',
            region_europe: '🏛️ Europe & Mediterranean (12)',
            region_americas: '🌎 Americas & Caribbean (11)',
            region_asia: '🌏 Asia & Indonesia (2)',
            btn_watch_doc: 'Watch Documentary',
            btn_watch_here: 'Watch Documentary Here',
            btn_play: 'Play',
            library_title: 'Documentary Library',
            cat_all: 'All (25)',
            cat_ancient: 'Ancient & Middle Ages',
            cat_modern: 'Tragedies & Modern History',
            cat_mysteries: 'True Cases & Mysteries',
            latest_tiktok_title: 'Latest on TikTok',
            latest_fb_title: 'Latest on Facebook',
            chat_title: 'Get in Touch',
            chat_subtitle: 'Write to us live via chat.',
            chat_guest_msg: 'To chat live with us, please sign in or create an account in the top menu.',
            connected_as: 'Connected as',
            ph_chat_msg: 'Write your message...',
            btn_send: 'Send',
            admin_convs_title: 'Follower Conversations',
            admin_no_msgs: 'No messages from followers yet.',
            admin_select_prompt: 'Select a follower above to reply',
            ph_admin_reply: 'Write your reply...',
            btn_reply: 'Reply',
            wall_title: 'Community Debate Wall',
            wall_subtitle: 'Share your thoughts or theories about our documentaries with the community.',
            ph_wall_comment: 'What historical theory, question, or thought about our documentaries do you want to share today?',
            btn_post_wall: 'Post to Wall',
            nav_home: 'Home & Documentaries',
            btn_open_wall_full: 'Enter Debate Wall',
            btn_back_home: 'Back to Home & Documentaries',
            opt_general_topic: '📌 General channel topic',
            fb_like: 'Like',
            fb_comment: 'Comment',
            fb_reply: 'Reply',
            fb_comments_count: 'comments',
            fb_comment_singular: 'comment',
            fb_replying_to: 'Replying to',
            fb_write_comment: 'Write a comment...',
            fb_write_reply: 'Write your reply to',
            fb_cancel: 'Cancel',
            footer_rights: 'All rights reserved.',
            poll_voting_open: 'Voting Open!',
            poll_vote_singular: 'vote',
            poll_vote_plural: 'votes',
            poll_voting_desc: 'The 5 finalist topics are set. Vote for the documentary you want to see next!',
            poll_proposals_badge: 'Proposals',
            poll_Empty: 'No topics suggested in this round yet. Be the first to propose one!',
            poll_topic_label: 'Topic',
            poll_proposed_by: 'Suggested by:',
            poll_follower: 'Follower',
            poll_your_vote: 'Your Vote',
            poll_vote_btn: 'Vote',
            wall_empty: 'Be the first to create a post on the Debate Wall.',
            lb_empty: 'Sign in and answer correctly to inaugurate the Hall of Fame',
            map_docs_count: '25 Documentaries',
            btn_bg_audio_on: 'BG Audio: ON',
            btn_bg_audio_off: 'BG Audio: OFF'
        }
    };

    function t(key) {
        return (I18N[currentLang] && I18N[currentLang][key]) || I18N.es[key] || key;
    }

    // ==========================================
    // VIDEO DE FONDO VERTICAL 9:16 (RECORRIDO VERTICAL CON SCROLL + AUDIO)
    // ==========================================
    const bgScrollVideo = document.getElementById('bg-scroll-video');
    const bgAudioToggleBtn = document.getElementById('bg-audio-toggle-btn');
    const bgAudioIcon = document.getElementById('bg-audio-icon');
    const bgAudioLabel = document.getElementById('bg-audio-label');
    let userManuallyMutedBg = false;

    function updateBgAudioButtonUI() {
        if (!bgScrollVideo || !bgAudioToggleBtn) return;
        const isMuted = bgScrollVideo.muted;
        bgAudioToggleBtn.classList.toggle('muted', isMuted);
        if (bgAudioIcon) {
            bgAudioIcon.className = isMuted ? 'fa-solid fa-volume-xmark' : 'fa-solid fa-volume-high';
        }
        if (bgAudioLabel) {
            bgAudioLabel.setAttribute('data-i18n', isMuted ? 'btn_bg_audio_off' : 'btn_bg_audio_on');
            bgAudioLabel.textContent = t(isMuted ? 'btn_bg_audio_off' : 'btn_bg_audio_on');
        }
    }

    function updateBgVideoVerticalScroll() {
        if (!bgScrollVideo) return;
        const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const scrollProgress = Math.max(0, Math.min(1, window.scrollY / maxScroll));
        const videoHeight = bgScrollVideo.offsetHeight || window.innerHeight;
        const maxPanY = Math.max(0, videoHeight - window.innerHeight);
        const translateY = -(scrollProgress * maxPanY);
        bgScrollVideo.style.transform = `translate3d(-50%, ${translateY.toFixed(1)}px, 0)`;
    }

    if (bgScrollVideo) {
        bgScrollVideo.volume = 0.75;
        bgScrollVideo.muted = false;

        // Intentar reproducir con audio desde el inicio; si el navegador requiere interacción previa, arrancar en reproducción y activar audio al primer gesto
        const playPromise = bgScrollVideo.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                updateBgAudioButtonUI();
            }).catch(() => {
                bgScrollVideo.muted = true;
                bgScrollVideo.play().catch(() => {});
                updateBgAudioButtonUI();

                const unlockAudioOnFirstGesture = () => {
                    if (!userManuallyMutedBg && bgScrollVideo.muted) {
                        bgScrollVideo.muted = false;
                        bgScrollVideo.play().catch(() => {});
                        updateBgAudioButtonUI();
                    }
                    window.removeEventListener('click', unlockAudioOnFirstGesture);
                    window.removeEventListener('touchstart', unlockAudioOnFirstGesture);
                    window.removeEventListener('keydown', unlockAudioOnFirstGesture);
                };
                window.addEventListener('click', unlockAudioOnFirstGesture, { passive: true });
                window.addEventListener('touchstart', unlockAudioOnFirstGesture, { passive: true });
                window.addEventListener('keydown', unlockAudioOnFirstGesture, { passive: true });
            });
        }

        if (bgAudioToggleBtn) {
            bgAudioToggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                bgScrollVideo.muted = !bgScrollVideo.muted;
                userManuallyMutedBg = bgScrollVideo.muted;
                if (!bgScrollVideo.muted) {
                    bgScrollVideo.play().catch(() => {});
                }
                updateBgAudioButtonUI();
            });
        }

        bgScrollVideo.addEventListener('loadedmetadata', updateBgVideoVerticalScroll);
        window.addEventListener('scroll', updateBgVideoVerticalScroll, { passive: true });
        window.addEventListener('resize', updateBgVideoVerticalScroll, { passive: true });
        setTimeout(updateBgVideoVerticalScroll, 150);
    }

    function playDocumentaryInMainPlayer(videoId, title) {
        if (!ytIframe) return;
        // Silenciar el video de fondo al reproducir un documental para que no se crucen los audios
        if (bgScrollVideo && !bgScrollVideo.muted) {
            bgScrollVideo.muted = true;
            userManuallyMutedBg = true;
            updateBgAudioButtonUI();
        }
        ytIframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
        if (mainYtHeading) {
            mainYtHeading.innerHTML = `<i class="fa-brands fa-youtube"></i> ${t('watching_prefix')} ${title}`;
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

    function isEmailLikeUsername(username, email = '') {
        const clean = String(username || '').trim().toLowerCase();
        const cleanMail = String(email || '').trim().toLowerCase();
        if (!clean) return false;
        if (clean.includes('@')) return true;
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return true;
        if (/\.(com|net|org|es|edu|gov|io|co|us|mx|ar|cl|pe|ve|cu|info|biz|me|live|outlook|hotmail|gmail|yahoo|icloud)$/i.test(clean)) return true;
        if (cleanMail && clean === cleanMail) return true;
        return false;
    }

    const regUsernameInput = document.getElementById('reg-username');
    if (regUsernameInput) {
        regUsernameInput.addEventListener('input', () => {
            if (regUsernameInput.value.includes('@')) {
                showFeedback(t('err_email_as_user'));
            } else {
                clearFeedback();
            }
        });
    }

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearFeedback();

        const username = document.getElementById('reg-username').value.trim();
        const password = regPasswordInput.value;
        const email = document.getElementById('reg-email').value.trim();

        if (isEmailLikeUsername(username, email)) {
            return showFeedback(t('err_email_as_user'));
        }

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

        if (username.includes('@')) {
            return showFeedback(t('err_login_no_email'));
        }

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

        // Sincronizar datos privados de la cuenta (correo solo visible para el propio usuario)
        fetch(`${API_BASE}/api/account/me`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data && data.user) {
                    saveSession(authToken, data.user);
                    const emailEl = document.getElementById('settings-email');
                    if (emailEl && activeSubmenu === 'settings') {
                        emailEl.value = data.user.email || '';
                    }
                }
            })
            .catch(() => {});
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

    let lastPollData = null;

    function renderPoll(data) {
        if (!data) return;
        lastPollData = data;
        const topics = data.topics || [];
        const isVoting = topics.length >= 5;
        const totalVotes = data.totalVotes || 0;
        const isAdmin = Boolean(data.isAdmin);
        updatePollAdminControls(isAdmin);

        if (isVoting) {
            pollStageBadge.textContent = `${t('poll_voting_open')} (${totalVotes} ${totalVotes === 1 ? t('poll_vote_singular') : t('poll_vote_plural')})`;
            pollStageBadge.classList.add('voting-active');
            pollDescription.textContent = t('poll_voting_desc');
            topicSuggestForm.classList.add('hidden');
        } else {
            pollStageBadge.textContent = `${t('poll_proposals_badge')}: ${topics.length} / 5`;
            pollStageBadge.classList.remove('voting-active');
            const remaining = 5 - topics.length;
            pollDescription.textContent = currentLang === 'en'
                ? `Suggest the historical event, mystery, or documentary you want to see. ${remaining} more ${remaining === 1 ? 'topic' : 'topics'} needed to open voting.`
                : `Propón el suceso histórico, misterio o documental que quieres ver. Faltan ${remaining} ${remaining === 1 ? 'tema' : 'temas'} para abrir las votaciones.`;
            topicSuggestForm.classList.remove('hidden');
        }

        pollTopicsList.innerHTML = '';
        if (topics.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'empty-conv-text';
            empty.style.textAlign = 'center';
            empty.textContent = t('poll_Empty');
            pollTopicsList.appendChild(empty);
            return;
        }

        topics.forEach((topicItem, idx) => {
            const pct = totalVotes > 0 ? Math.round((topicItem.votes / totalVotes) * 100) : 0;
            const card = document.createElement('div');
            card.className = `poll-topic-card ${topicItem.votedByMe ? 'voted-by-me' : ''}`;

            const top = document.createElement('div');
            top.className = 'poll-topic-top';

            const info = document.createElement('div');
            info.className = 'poll-topic-info';

            const num = document.createElement('span');
            num.className = 'poll-topic-number';
            num.textContent = `${t('poll_topic_label')} #${idx + 1}`;

            const title = document.createElement('div');
            title.className = 'poll-topic-title';
            title.textContent = topicItem.title;

            const author = document.createElement('div');
            author.className = 'poll-topic-author';
            const authorName = (!topicItem.author || topicItem.author === 'Seguidor')
                ? t('poll_follower')
                : topicItem.author;
            author.textContent = `${t('poll_proposed_by')} ${authorName}`;

            info.appendChild(num);
            info.appendChild(title);
            info.appendChild(author);

            const actions = document.createElement('div');
            actions.className = 'poll-topic-actions';

            if (isVoting) {
                const voteBtn = document.createElement('button');
                voteBtn.type = 'button';
                voteBtn.className = `vote-btn ${topicItem.votedByMe ? 'voted' : ''}`;
                voteBtn.innerHTML = topicItem.votedByMe
                    ? `<i class="fa-solid fa-check"></i> ${t('poll_your_vote')}`
                    : `<i class="fa-solid fa-check-to-slot"></i> ${t('poll_vote_btn')}`;
                voteBtn.addEventListener('click', () => castVote(topicItem.id));
                actions.appendChild(voteBtn);
            }

            if (isAdmin) {
                const delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.className = 'delete-topic-btn';
                delBtn.title = 'Eliminar este tema (Admin)';
                delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
                delBtn.addEventListener('click', () => deleteTopic(topicItem.id));
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
                stats.innerHTML = `<span>${topicItem.votes} ${topicItem.votes === 1 ? t('poll_vote_singular') : t('poll_vote_plural')}</span><span>${pct}%</span>`;

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
                showPollFeedback(currentLang === 'en' ? 'Topic submitted successfully!' : '¡Tema propuesto con éxito!', 'success');
                loadPoll();
            } catch (err) {
                showPollFeedback(currentLang === 'en' ? 'Connecting to server, please try again...' : 'Conectando con el servidor, intenta de nuevo en unos segundos...');
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
                showPollFeedback(currentLang === 'en' ? 'Round reset. 5 new topics can now be suggested.' : 'Ronda reiniciada. Ya se pueden proponer 5 nuevos temas.', 'success');
                loadPoll();
            } catch (err) {}
        });
    }

    // ==========================================
    // 2. PRÓXIMO ESTRENO EN PRODUCCIÓN (COUNTDOWN / POR DECIDIR)
    // ==========================================
    let releaseTargetTimestamp = null;

    function updateCountdownDisplayMode() {
        const tbdBox = document.getElementById('countdown-tbd-box');
        const gridBox = document.getElementById('countdown-grid');
        const hasValidFutureDate = Boolean(releaseTargetTimestamp && releaseTargetTimestamp > Date.now());
        if (tbdBox) tbdBox.classList.toggle('hidden', hasValidFutureDate);
        if (gridBox) gridBox.classList.toggle('hidden', !hasValidFutureDate);
    }

    async function loadReleaseCountdown() {
        try {
            const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
            const res = await fetch(`${API_BASE}/api/release`, { headers });
            if (!res.ok) return;
            const data = await res.json();
            const titleEl = document.getElementById('release-title-display');
            const rel = data.nextRelease;
            const isDefaultPlaceholder = !rel ||
                !rel.confirmedByAdmin ||
                rel.title === 'Próximo Documental Especial en Producción' ||
                rel.title === 'Próximo Gran Documental Histórico';

            if (!isDefaultPlaceholder && rel.targetDate) {
                const ts = new Date(rel.targetDate).getTime();
                if (!isNaN(ts) && ts > Date.now()) {
                    if (titleEl) titleEl.textContent = `«${rel.title}»`;
                    releaseTargetTimestamp = ts;
                    updateCountdownDisplayMode();
                    tickCountdown();
                    return;
                }
            }
            releaseTargetTimestamp = null;
            if (titleEl) titleEl.textContent = t('release_default_sub');
            updateCountdownDisplayMode();
        } catch (e) {}
    }

    function tickCountdown() {
        if (!releaseTargetTimestamp || releaseTargetTimestamp <= Date.now()) {
            updateCountdownDisplayMode();
            return;
        }
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
    updateCountdownDisplayMode();

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

    const adminReleaseResetBtn = document.getElementById('admin-release-reset-btn');
    if (adminReleaseResetBtn) {
        adminReleaseResetBtn.addEventListener('click', async () => {
            try {
                const res = await fetch(`${API_BASE}/api/release`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ reset: true })
                });
                if (res.ok) {
                    loadReleaseCountdown();
                }
            } catch (err) {}
        });
    }

    // ==========================================
    // 3. UN DÍA COMO HOY EN LA HISTORIA (BILINGÜE)
    // ==========================================
    function renderEphemeris() {
        const now = new Date();
        const monthsEs = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const day = now.getDate();
        document.getElementById('ephemeris-date-badge').textContent = currentLang === 'en'
            ? `${monthsEn[now.getMonth()]} ${day} in History`
            : `${day} de ${monthsEs[now.getMonth()]} en la Historia`;

        const milestones = currentLang === 'en'
            ? [
                { year: 'Year 79 AD', text: 'Mount Vesuvius buries the Roman city of Pompeii under burning ash and pumice, freezing daily life of the Empire in time.' },
                { year: 'Year 1200', text: 'King Philip II Augustus orders the construction of the medieval fortress of the Louvre on the banks of the Seine to defend Paris.' },
                { year: 'Year 1912', text: 'At the Harland & Wolff shipyards in Belfast, final sea trials are completed on the RMS Titanic before its fateful maiden voyage.' }
            ]
            : [
                { year: 'Año 79 d.C.', text: 'El Monte Vesubio sepulta la ciudad romana de Pompeya bajo un manto ardiente de ceniza y piedra pómez, congelando en el tiempo la vida cotidiana del Imperio.' },
                { year: 'Año 1200', text: 'El rey Felipe II Augusto ordena levantar la imponente fortaleza medieval del Louvre a orillas del Sena para proteger las murallas de París.' },
                { year: 'Año 1912', text: 'En los astilleros de Harland & Wolff culminan las pruebas del RMS Titanic, el coloso transatlántico cuyo viaje inaugural marcaría la historia marítima.' }
            ];

        const container = document.getElementById('ephemeris-list');
        container.innerHTML = '';
        milestones.forEach(item => {
            const div = document.createElement('div');
            div.className = 'ephemeris-item';
            div.innerHTML = `<div class="ephemeris-year">${item.year}</div><div class="ephemeris-text">${item.text}</div>`;
            container.appendChild(div);
        });
    }
    renderEphemeris();

    // ==========================================
    // 4. RETO HISTÓRICO SEMANAL (TRIVIA + RANKING)
    // ==========================================
    let lastTriviaData = null;

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
        if (!data) return;
        lastTriviaData = data;
        const defaultQuestionEs = '¿Con qué propósito original se construyó el edificio del Louvre en París en el año 1200?';
        const isDefaultQ = (data.question || '').includes('Louvre');

        document.getElementById('trivia-question-text').textContent = (currentLang === 'en' && isDefaultQ)
            ? 'For what original purpose was the Louvre building constructed in Paris in the year 1200?'
            : (data.question || defaultQuestionEs);

        const defaultOptionsEn = [
            'A defensive military fortress',
            'A public art museum',
            'A summer royal garden',
            'A university library'
        ];

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
            btn.textContent = (currentLang === 'en' && isDefaultQ && defaultOptionsEn[idx]) ? defaultOptionsEn[idx] : optText;
            btn.addEventListener('click', () => submitTriviaAnswer(idx));
            box.appendChild(btn);
        });

        const lbList = document.getElementById('leaderboard-list');
        lbList.innerHTML = '';
        const lb = data.leaderboard || [];
        if (lb.length === 0) {
            lbList.innerHTML = `<li><span>${t('lb_empty')}</span><span>+10 pts</span></li>`;
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
                    ? (currentLang === 'en' ? 'Correct answer! Great historical knowledge.' : '¡Respuesta correcta! Has demostrado gran conocimiento histórico.')
                    : (currentLang === 'en' ? 'Incorrect answer. Keep exploring our documentaries!' : 'Respuesta incorrecta. ¡Sigue explorando nuestros documentales!');
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
    // 5. MAPA INTERACTIVO REAL DE LA TIERRA Y 6. LOS 25 DOCUMENTALES DEL CANAL
    // ==========================================
    const LIBRARY_CATEGORIES = [
        { key: 'all', es: 'Todos', en: 'All' },
        { key: 'antigua', es: 'Civilizaciones Antiguas', en: 'Ancient Civilizations' },
        { key: 'medieval', es: 'Edad Media y Victoriana', en: 'Middle Ages & Victorian' },
        { key: 'ww2', es: 'Segunda Guerra Mundial', en: 'World War II' },
        { key: 'cuba', es: 'Historia de Cuba', en: 'History of Cuba' },
        { key: 'wtc', es: 'Torres Gemelas y 11-S', en: 'Twin Towers & 9/11' },
        { key: 'catastrofes', es: 'Grandes Catástrofes', en: 'Great Catastrophes' },
        { key: 'misterios', es: 'Crímenes y Prisiones', en: 'Crime & Prisons' }
    ];

    const DOCUMENTARIES = [
        {
            id: 'rJdAGfxEYkw',
            titleEs: 'El Louvre en el año 1200: La fortaleza olvidada de París',
            titleEn: 'The Louvre in 1200: The Forgotten Fortress of Paris',
            eraEs: 'París, Francia · Año 1200',
            eraEn: 'Paris, France · Year 1200',
            category: 'medieval',
            region: 'europe',
            lon: 2.34,
            lat: 48.86
        },
        {
            id: 'PVVdxqlf5XQ',
            titleEs: 'El Horno Térmico de Pompeya: La Falsa Salvación de la Élite Romana',
            titleEn: 'Pompeii’s Thermal Furnace: The False Salvation of the Roman Elite',
            eraEs: 'Pompeya, Italia · 79 d.C.',
            eraEn: 'Pompeii, Italy · 79 AD',
            category: 'antigua',
            region: 'europe',
            lon: 14.49,
            lat: 40.75
        },
        {
            id: '27AZ11nTUz0',
            titleEs: 'El Secreto de los Constructores de Giza: 2570 a.C.',
            titleEn: 'The Secret of the Builders of Giza: 2570 BC',
            eraEs: 'Meseta de Giza, Egipto · 2570 a.C.',
            eraEn: 'Giza Plateau, Egypt · 2570 BC',
            category: 'antigua',
            region: 'europe',
            lon: 31.13,
            lat: 29.98
        },
        {
            id: 'muZvqVzTTQ4',
            titleEs: 'Así era ser oficinista en las Torres Gemelas',
            titleEn: 'What It Was Like to Be an Office Worker in the Twin Towers',
            eraEs: 'Nueva York, EE. UU. · World Trade Center',
            eraEn: 'New York, USA · World Trade Center',
            category: 'wtc',
            region: 'americas',
            lon: -74.01,
            lat: 40.71
        },
        {
            id: 'O-ewFhxFahk',
            titleEs: 'Así era vivir en Nazaret antes de Cristo',
            titleEn: 'What Life Was Like in Nazareth Before Christ',
            eraEs: 'Nazaret, Galilea · Siglo I a.C.',
            eraEn: 'Nazareth, Galilee · 1st Century BC',
            category: 'antigua',
            region: 'europe',
            lon: 35.30,
            lat: 32.70
        },
        {
            id: 'T8BdFd4Zm7Q',
            titleEs: 'El Restaurante en las Alturas de las Torres Gemelas',
            titleEn: 'The Restaurant at the Top of the Twin Towers',
            eraEs: 'Nueva York, EE. UU. · Piso 107 (WTC)',
            eraEn: 'New York, USA · 107th Floor (WTC)',
            category: 'wtc',
            region: 'americas',
            lon: -71.2,
            lat: 42.3
        },
        {
            id: 'OT_2LgSxUtY',
            titleEs: '11 de septiembre de 2001: La evacuación de Manhattan',
            titleEn: 'September 11, 2001: The Evacuation of Manhattan',
            eraEs: 'Manhattan, Nueva York · 11 de Septiembre 2001',
            eraEn: 'Manhattan, New York · September 11, 2001',
            category: 'wtc',
            region: 'americas',
            lon: -76.5,
            lat: 38.8
        },
        {
            id: '8I2sy6C4l10',
            titleEs: 'La vida cotidiana en las Torres Gemelas antes del colapso',
            titleEn: 'Daily Life Inside the Twin Towers Before the Collapse',
            eraEs: 'Nueva York, EE. UU. · Años 90',
            eraEn: 'New York, USA · The 1990s',
            category: 'wtc',
            region: 'americas',
            lon: -77.2,
            lat: 43.2
        },
        {
            id: 'AdulsJeHVIU',
            titleEs: 'El hombre que fingió ser médico durante 18 años: La Gran Mentira',
            titleEn: 'The Man Who Pretended to Be a Doctor for 18 Years: The Great Lie',
            eraEs: 'Ginebra / Francia · Caso Real (1993)',
            eraEn: 'Geneva / France · True Case (1993)',
            category: 'misterios',
            region: 'europe',
            lon: 6.14,
            lat: 46.20
        },
        {
            id: '7lgpnoQpDXc',
            titleEs: 'Así se Construyó el Titanic: La Negligencia que Sepultó un Gigante',
            titleEn: 'How the Titanic Was Built: The Negligence That Sank a Giant',
            eraEs: 'Belfast, Irlanda del Norte · 1909–1912',
            eraEn: 'Belfast, Northern Ireland · 1909–1912',
            category: 'catastrofes',
            region: 'europe',
            lon: -5.93,
            lat: 54.60
        },
        {
            id: 'FPvbJ3RdC38',
            titleEs: 'La erupción del volcán Krakatoa: El Desastre Más Ruidoso de la Historia',
            titleEn: 'The Eruption of Krakatoa: The Loudest Disaster in History',
            eraEs: 'Estrecho de la Sonda, Indonesia · 1883',
            eraEn: 'Sunda Strait, Indonesia · 1883',
            category: 'catastrofes',
            region: 'asia',
            lon: 105.42,
            lat: -6.10
        },
        {
            id: 'fovp3_GHPWU',
            titleEs: 'El último Neandertal: La verdad oculta en nuestro ADN',
            titleEn: 'The Last Neanderthal: The Hidden Truth in Our DNA',
            eraEs: 'Peñón de Gibraltar, Iberia · 40.000 a.C.',
            eraEn: 'Rock of Gibraltar, Iberia · 40,000 BC',
            category: 'antigua',
            region: 'europe',
            lon: -5.35,
            lat: 36.14
        },
        {
            id: 'CF3K2EjrpqY',
            titleEs: 'Cómo la Peste Negra parió al mundo moderno (Ep. 13)',
            titleEn: 'How the Black Death Gave Birth to the Modern World (Ep. 13)',
            eraEs: 'Florencia, Italia / Europa · 1347',
            eraEn: 'Florence, Italy / Europe · 1347',
            category: 'medieval',
            region: 'europe',
            lon: 11.25,
            lat: 43.77
        },
        {
            id: 'DYkaMwKC5u8',
            titleEs: 'El macabro arte de la fotografía post mortem: Inglaterra Victoriana (Ep. 12)',
            titleEn: 'The Macabre Art of Post-Mortem Photography: Victorian England (Ep. 12)',
            eraEs: 'Londres, Inglaterra · Siglo XIX',
            eraEn: 'London, England · 19th Century',
            category: 'medieval',
            region: 'europe',
            lon: -0.13,
            lat: 51.51
        },
        {
            id: 'zIAwu_FxrFA',
            titleEs: 'El mito del Reichstag: Asfixia y acero en la oscuridad (Ep. 11)',
            titleEn: 'The Myth of the Reichstag: Asphyxiation and Steel in the Dark (Ep. 11)',
            eraEs: 'Berlín, Alemania · 1945',
            eraEn: 'Berlin, Germany · 1945',
            category: 'ww2',
            region: 'europe',
            lon: 13.38,
            lat: 52.52
        },
        {
            id: 'bhEAI_6xEgo',
            titleEs: 'Así fue el terremoto de San Francisco de 1906: Fuego y Acero (Ep. 10)',
            titleEn: 'The 1906 San Francisco Earthquake: Fire and Steel (Ep. 10)',
            eraEs: 'San Francisco, California · 1906',
            eraEn: 'San Francisco, California · 1906',
            category: 'catastrofes',
            region: 'americas',
            lon: -122.42,
            lat: 37.77
        },
        {
            id: 'rOfrwwANg9k',
            titleEs: 'Así era La Habana de los 50’s: Casinos, Neón y Hormigón (Ep. 09)',
            titleEn: 'Havana in the 1950s: Casinos, Neon, and Concrete (Ep. 09)',
            eraEs: 'La Habana, Cuba · Años 1950',
            eraEn: 'Havana, Cuba · The 1950s',
            category: 'cuba',
            region: 'americas',
            lon: -82.37,
            lat: 23.11
        },
        {
            id: 'CLxnnVoseeg',
            titleEs: 'Así fue la Construcción de Teotihuacán: El Día en que Movieron una Montaña (Ep. 08)',
            titleEn: 'The Construction of Teotihuacan: The Day Humans Moved a Mountain (Ep. 08)',
            eraEs: 'Teotihuacán, México · Siglo II d.C.',
            eraEn: 'Teotihuacan, Mexico · 2nd Century AD',
            category: 'antigua',
            region: 'americas',
            lon: -98.84,
            lat: 19.69
        },
        {
            id: 'dn-cp5YPNuY',
            titleEs: 'El Tsunami de 2004: La Trampa Mortal que Engañó al Mundo (Ep. 07)',
            titleEn: 'The 2004 Tsunami: The Deadly Trap That Deceived the World (Ep. 07)',
            eraEs: 'Sumatra, Océano Índico · 2004',
            eraEn: 'Sumatra, Indian Ocean · 2004',
            category: 'catastrofes',
            region: 'asia',
            lon: 95.32,
            lat: 5.55
        },
        {
            id: 'S4hg8P0gtzg',
            titleEs: 'La invasión a Polonia: El nacimiento de la guerra relámpago (Ep. 06)',
            titleEn: 'The Invasion of Poland: Birth of the Blitzkrieg (Ep. 06)',
            eraEs: 'Varsovia / Gdańsk, Polonia · 1939',
            eraEn: 'Warsaw / Gdansk, Poland · 1939',
            category: 'ww2',
            region: 'europe',
            lon: 21.01,
            lat: 52.23
        },
        {
            id: '9MtSnB7sBog',
            titleEs: 'Los 100 días más brutales del Día D a la liberación de París (Ep. 05)',
            titleEn: 'The 100 Most Brutal Days from D-Day to the Liberation of Paris (Ep. 05)',
            eraEs: 'Playas de Normandía, Francia · 1944',
            eraEn: 'Normandy Beaches, France · 1944',
            category: 'ww2',
            region: 'europe',
            lon: -2.50,
            lat: 49.34
        },
        {
            id: 'oRXFu8r5wHU',
            titleEs: 'Así era vivir dentro de Alcatraz: La prisión más temida de todas (Ep. 04)',
            titleEn: 'Life Inside Alcatraz: The Most Feared Prison of All (Ep. 04)',
            eraEs: 'Isla de Alcatraz, California · Siglo XX',
            eraEn: 'Alcatraz Island, California · 20th Century',
            category: 'misterios',
            region: 'americas',
            lon: -124.8,
            lat: 40.5
        },
        {
            id: 'qCwGXLfWWuE',
            titleEs: 'Cómo era La Habana antes de 1959 (Ep. 03 Cap. 1)',
            titleEn: 'What Havana Was Like Before 1959 (Ep. 03 Pt. 1)',
            eraEs: 'La Habana, Cuba · Antes de 1959',
            eraEn: 'Havana, Cuba · Before 1959',
            category: 'cuba',
            region: 'americas',
            lon: -79.4,
            lat: 21.9
        },
        {
            id: 'Q1Rjnt5_Gr4',
            titleEs: 'Así se vivió el Mariel: La travesía cubana que cambió a miles (Ep. 02)',
            titleEn: 'The Mariel Boatlift: The Cuban Crossing That Changed Thousands (Ep. 02)',
            eraEs: 'Puerto del Mariel / Estrecho de la Florida · 1980',
            eraEn: 'Mariel Harbor / Straits of Florida · 1980',
            category: 'cuba',
            region: 'americas',
            lon: -83.8,
            lat: 24.8
        },
        {
            id: 'HTqDUWWZE7s',
            titleEs: 'Así era la vida de un cubano común en La Habana de 1910 (Ep. 01)',
            titleEn: 'Daily Life of an Ordinary Cuban in 1910 Havana (Ep. 01)',
            eraEs: 'La Habana, Cuba · Año 1910',
            eraEn: 'Havana, Cuba · Year 1910',
            category: 'cuba',
            region: 'americas',
            lon: -76.2,
            lat: 20.3
        }
    ];

    function docTitle(doc) {
        return currentLang === 'en' ? doc.titleEn : doc.titleEs;
    }
    function docEra(doc) {
        return currentLang === 'en' ? doc.eraEn : doc.eraEs;
    }

    const MAP_VIEWBOXES = {
        world: [0, 0, 1000, 480],
        europe: [455, 65, 175, 130],
        americas: [140, 115, 200, 125],
        asia: [700, 220, 160, 115]
    };

    let currentMapRegion = 'world';
    let currentViewBox = [...MAP_VIEWBOXES.world];
    let selectedMapDoc = null;
    let mapCalloutPinned = false;
    let mapHoverHideTimer = null;
    let currentFilterCat = 'all';

    function initRealEarthCountries() {
        const group = document.getElementById('real-earth-countries-group');
        if (!group || !window.WORLD_MAP_COUNTRIES) return;
        group.innerHTML = '';
        window.WORLD_MAP_COUNTRIES.forEach(c => {
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', c.d);
            path.setAttribute('class', 'real-earth-country');
            if (c.name) {
                path.setAttribute('data-country', c.name);
            }
            group.appendChild(path);
        });
    }

    function projectLonLatToViewBoxPct(lon, lat, vb) {
        const svgX = ((lon + 180) / 360) * 1000;
        const svgY = ((82 - lat) / 140) * 480;
        const leftPct = ((svgX - vb[0]) / vb[2]) * 100;
        const topPct = ((svgY - vb[1]) / vb[3]) * 100;
        return { leftPct, topPct };
    }

    function hideMapFloatingCallout() {
        if (mapHoverHideTimer) {
            clearTimeout(mapHoverHideTimer);
            mapHoverHideTimer = null;
        }
        const polyline = document.getElementById('map-leader-polyline');
        const originDot = document.getElementById('map-leader-origin-dot');
        const endDot = document.getElementById('map-leader-end-dot');
        const callout = document.getElementById('map-floating-callout');
        if (polyline) polyline.classList.add('hidden');
        if (originDot) originDot.classList.add('hidden');
        if (endDot) endDot.classList.add('hidden');
        if (callout) callout.classList.add('hidden');
        document.querySelectorAll('.map-pin-btn').forEach(b => b.classList.remove('active'));
        selectedMapDoc = null;
    }

    // Mantener abierta la tarjeta flotante cuando el puntero entra en ella para dar clic en "Ver Documental"
    const mapFloatingCalloutEl = document.getElementById('map-floating-callout');
    if (mapFloatingCalloutEl) {
        mapFloatingCalloutEl.addEventListener('mouseenter', () => {
            if (mapHoverHideTimer) {
                clearTimeout(mapHoverHideTimer);
                mapHoverHideTimer = null;
            }
        });
        mapFloatingCalloutEl.addEventListener('mouseleave', () => {
            if (mapCalloutPinned) return;
            mapHoverHideTimer = setTimeout(() => {
                hideMapFloatingCallout();
            }, 350);
        });
    }

    function showMapFloatingCallout(doc, leftPct, topPct) {
        const stage = document.getElementById('world-map-stage');
        const leaderSvg = document.getElementById('map-leader-svg');
        const polyline = document.getElementById('map-leader-polyline');
        const originDot = document.getElementById('map-leader-origin-dot');
        const endDot = document.getElementById('map-leader-end-dot');
        const callout = document.getElementById('map-floating-callout');
        const locEl = document.getElementById('callout-location');
        const titleEl = document.getElementById('callout-title');
        const watchBtn = document.getElementById('callout-watch-btn');

        if (!stage || !leaderSvg || !polyline || !callout) return;

        const rect = stage.getBoundingClientRect();
        const w = rect.width || 680;
        const h = rect.height || 326;

        leaderSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);

        const px = (leftPct / 100) * w;
        const py = (topPct / 100) * h;

        const dirX = leftPct < 52 ? 1 : -1;
        const dirY = topPct < 45 ? 1 : -1;

        const elbowX = px + dirX * 26;
        const elbowY = py + dirY * 22;
        const endX = elbowX + dirX * 18;
        const endY = elbowY;

        polyline.setAttribute('points', `${px.toFixed(1)},${py.toFixed(1)} ${elbowX.toFixed(1)},${elbowY.toFixed(1)} ${endX.toFixed(1)},${endY.toFixed(1)}`);
        polyline.classList.remove('hidden');

        originDot.setAttribute('cx', px.toFixed(1));
        originDot.setAttribute('cy', py.toFixed(1));
        originDot.classList.remove('hidden');

        endDot.setAttribute('cx', endX.toFixed(1));
        endDot.setAttribute('cy', endY.toFixed(1));
        endDot.classList.remove('hidden');

        locEl.innerHTML = `<i class="fa-solid fa-location-dot"></i> ${docEra(doc)}`;
        titleEl.textContent = docTitle(doc);
        watchBtn.innerHTML = `<i class="fa-solid fa-play"></i> ${t('btn_watch_doc')}`;
        watchBtn.onclick = (e) => {
            e.stopPropagation();
            playDocumentaryInMainPlayer(doc.id, docTitle(doc));
        };

        callout.classList.remove('hidden');

        const cardW = Math.min(245, w - 20);
        const cardH = callout.offsetHeight || 105;

        let cardLeft = dirX === 1 ? endX + 2 : endX - cardW - 2;
        let cardTop = endY - cardH / 2;

        cardLeft = Math.max(8, Math.min(w - cardW - 8, cardLeft));
        cardTop = Math.max(8, Math.min(h - cardH - 8, cardTop));

        callout.style.left = `${cardLeft}px`;
        callout.style.top = `${cardTop}px`;
    }

    function renderInteractiveMap(preserveCallout = false) {
        const svg = document.getElementById('real-earth-svg');
        const pinsLayer = document.getElementById('map-pins-layer');
        const badge = document.getElementById('map-count-badge');
        if (!svg || !pinsLayer) return;

        if (badge) badge.textContent = t('map_docs_count');

        const vb = currentViewBox;
        svg.setAttribute('viewBox', vb.map(n => n.toFixed(2)).join(' '));

        pinsLayer.innerHTML = '';
        if (!preserveCallout) {
            hideMapFloatingCallout();
        }

        let activeCoords = null;

        DOCUMENTARIES.forEach((doc) => {
            const { leftPct, topPct } = projectLonLatToViewBoxPct(doc.lon, doc.lat, vb);
            if (leftPct < 0.5 || leftPct > 99.5 || topPct < 0.5 || topPct > 99.5) return;

            const isSelected = Boolean(selectedMapDoc && selectedMapDoc.id === doc.id);
            const pin = document.createElement('button');
            pin.type = 'button';
            pin.className = `map-pin-btn ${isSelected ? 'active' : ''}`;
            pin.style.left = `${leftPct}%`;
            pin.style.top = `${topPct}%`;
            pin.setAttribute('aria-label', `${docEra(doc)} — ${docTitle(doc)}`);

            // Al pasar el puntero encima aparece la línea y el texto
            pin.addEventListener('mouseenter', () => {
                if (mapHoverHideTimer) {
                    clearTimeout(mapHoverHideTimer);
                    mapHoverHideTimer = null;
                }
                selectedMapDoc = doc;
                document.querySelectorAll('.map-pin-btn').forEach(b => b.classList.remove('active'));
                pin.classList.add('active');
                showMapFloatingCallout(doc, leftPct, topPct);
            });

            // Al retirar el puntero da tiempo suficiente (750ms) para mover el cursor hacia el botón "Ver Documental"
            pin.addEventListener('mouseleave', () => {
                if (mapCalloutPinned) return;
                mapHoverHideTimer = setTimeout(() => {
                    hideMapFloatingCallout();
                }, 750);
            });

            // Si se hace tap con el dedo o click, queda visible hasta tocar/clicar en otro lugar de la pantalla
            pin.addEventListener('touchstart', (e) => {
                e.stopPropagation();
                if (mapHoverHideTimer) clearTimeout(mapHoverHideTimer);
                mapCalloutPinned = true;
                selectedMapDoc = doc;
                document.querySelectorAll('.map-pin-btn').forEach(b => b.classList.remove('active'));
                pin.classList.add('active');
                showMapFloatingCallout(doc, leftPct, topPct);
            }, { passive: true });

            pin.addEventListener('click', (e) => {
                e.stopPropagation();
                if (mapHoverHideTimer) clearTimeout(mapHoverHideTimer);
                mapCalloutPinned = true;
                selectedMapDoc = doc;
                document.querySelectorAll('.map-pin-btn').forEach(b => b.classList.remove('active'));
                pin.classList.add('active');
                showMapFloatingCallout(doc, leftPct, topPct);
            });

            pinsLayer.appendChild(pin);
            if (isSelected) {
                activeCoords = { doc, leftPct, topPct };
            }
        });

        if (preserveCallout && activeCoords) {
            showMapFloatingCallout(activeCoords.doc, activeCoords.leftPct, activeCoords.topPct);
        } else if (preserveCallout && selectedMapDoc) {
            hideMapFloatingCallout();
        }
    }

    // Zoom en el mapa interactivo con la rueda del ratón (scroll) + arrastrar + pellizco con 2 dedos (pinch-to-zoom)
    const worldMapStage = document.getElementById('world-map-stage');
    if (worldMapStage) {
        function clampViewBox(x, y, w, h) {
            const clampedW = Math.max(160, Math.min(1000, w));
            const clampedH = clampedW * 0.48;
            const clampedX = Math.max(0, Math.min(1000 - clampedW, x));
            const clampedY = Math.max(0, Math.min(480 - clampedH, y));
            return [clampedX, clampedY, clampedW, clampedH];
        }

        // 1. Zoom equilibrado con scroll del mouse / trackpad
        worldMapStage.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = worldMapStage.getBoundingClientRect();
            const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / (rect.width || 1)));
            const relY = Math.max(0, Math.min(1, (e.clientY - rect.top) / (rect.height || 1)));

            const [vbX, vbY, vbW, vbH] = currentViewBox;
            const rawDelta = e.deltaMode === 1 ? e.deltaY * 22 : e.deltaY;
            const clampedDelta = Math.max(-75, Math.min(75, rawDelta));
            // Sensibilidad equilibrada (~8%–15% por paso de rueda)
            const zoomFactor = Math.exp(clampedDelta * 0.0024);
            const newW = Math.max(160, Math.min(1000, vbW * zoomFactor));
            const newH = newW * 0.48;
            const newX = vbX + (vbW - newW) * relX;
            const newY = vbY + (vbH - newH) * relY;

            currentViewBox = clampViewBox(newX, newY, newW, newH);
            renderInteractiveMap(Boolean(selectedMapDoc));
        }, { passive: false });

        // 2. Arrastrar mapa con el ratón cuando tiene zoom
        let isDraggingMap = false;
        let dragStartClient = { x: 0, y: 0 };
        let dragStartVb = null;

        worldMapStage.addEventListener('mousedown', (e) => {
            if (e.target.closest('.map-pin-btn') || e.target.closest('#map-floating-callout')) return;
            isDraggingMap = true;
            dragStartClient = { x: e.clientX, y: e.clientY };
            dragStartVb = [...currentViewBox];
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDraggingMap || !dragStartVb) return;
            const rect = worldMapStage.getBoundingClientRect();
            const dxPct = (e.clientX - dragStartClient.x) / (rect.width || 1);
            const dyPct = (e.clientY - dragStartClient.y) / (rect.height || 1);
            const newX = dragStartVb[0] - dxPct * dragStartVb[2];
            const newY = dragStartVb[1] - dyPct * dragStartVb[3];
            currentViewBox = clampViewBox(newX, newY, dragStartVb[2], dragStartVb[3]);
            renderInteractiveMap(Boolean(selectedMapDoc));
        });

        window.addEventListener('mouseup', () => {
            isDraggingMap = false;
            dragStartVb = null;
        });

        // 3. Zoom con 2 dedos (pinch-to-zoom) y desplazamiento táctil en móvil/tablet
        let pinchStartDist = 0;
        let pinchStartVb = null;
        let pinchStartMid = { x: 0.5, y: 0.5 };
        let touchPanStart = null;

        worldMapStage.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const t0 = e.touches[0];
                const t1 = e.touches[1];
                pinchStartDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
                pinchStartVb = [...currentViewBox];
                const rect = worldMapStage.getBoundingClientRect();
                pinchStartMid = {
                    x: (((t0.clientX + t1.clientX) / 2) - rect.left) / (rect.width || 1),
                    y: (((t0.clientY + t1.clientY) / 2) - rect.top) / (rect.height || 1)
                };
                touchPanStart = null;
            } else if (e.touches.length === 1 && currentViewBox[2] < 995) {
                if (!e.target.closest('.map-pin-btn') && !e.target.closest('#map-floating-callout')) {
                    touchPanStart = {
                        x: e.touches[0].clientX,
                        y: e.touches[0].clientY,
                        vb: [...currentViewBox]
                    };
                }
            }
        }, { passive: false });

        worldMapStage.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2 && pinchStartDist > 0 && pinchStartVb) {
                e.preventDefault();
                const t0 = e.touches[0];
                const t1 = e.touches[1];
                const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
                const rawScale = pinchStartDist / Math.max(20, dist);
                const dampedScale = 1 + (rawScale - 1) * 0.72;
                const newW = Math.max(160, Math.min(1000, pinchStartVb[2] * dampedScale));
                const newH = newW * 0.48;
                const newX = pinchStartVb[0] + (pinchStartVb[2] - newW) * pinchStartMid.x;
                const newY = pinchStartVb[1] + (pinchStartVb[3] - newH) * pinchStartMid.y;
                currentViewBox = clampViewBox(newX, newY, newW, newH);
                renderInteractiveMap(Boolean(selectedMapDoc));
            } else if (e.touches.length === 1 && touchPanStart) {
                e.preventDefault();
                const rect = worldMapStage.getBoundingClientRect();
                const dxPct = (e.touches[0].clientX - touchPanStart.x) / (rect.width || 1);
                const dyPct = (e.touches[0].clientY - touchPanStart.y) / (rect.height || 1);
                const newX = touchPanStart.vb[0] - dxPct * touchPanStart.vb[2];
                const newY = touchPanStart.vb[1] - dyPct * touchPanStart.vb[3];
                currentViewBox = clampViewBox(newX, newY, touchPanStart.vb[2], touchPanStart.vb[3]);
                renderInteractiveMap(Boolean(selectedMapDoc));
            }
        }, { passive: false });

        worldMapStage.addEventListener('touchend', () => {
            pinchStartDist = 0;
            pinchStartVb = null;
            touchPanStart = null;
        });
    }

    // Si el usuario hace tap o click en cualquier otro lugar de la pantalla, desaparece la línea y el texto
    function handleGlobalMapDismiss(e) {
        if (!selectedMapDoc) return;
        const callout = document.getElementById('map-floating-callout');
        if (e.target.closest('.map-pin-btn') || (callout && callout.contains(e.target))) {
            return;
        }
        mapCalloutPinned = false;
        hideMapFloatingCallout();
    }
    document.addEventListener('click', handleGlobalMapDismiss);
    document.addEventListener('touchstart', handleGlobalMapDismiss, { passive: true });

    document.querySelectorAll('.map-region-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.map-region-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMapRegion = btn.getAttribute('data-region') || 'world';
            currentViewBox = [...(MAP_VIEWBOXES[currentMapRegion] || MAP_VIEWBOXES.world)];
            mapCalloutPinned = false;
            renderInteractiveMap();
        });
    });

    window.addEventListener('resize', () => {
        if (selectedMapDoc) {
            const { leftPct, topPct } = projectLonLatToViewBoxPct(selectedMapDoc.lon, selectedMapDoc.lat, currentViewBox);
            if (leftPct >= 0.5 && leftPct <= 99.5 && topPct >= 0.5 && topPct <= 99.5) {
                showMapFloatingCallout(selectedMapDoc, leftPct, topPct);
            }
        }
    });

    function renderLibraryCategoryFilters() {
        const filtersBox = document.getElementById('library-filters');
        if (!filtersBox) return;
        filtersBox.innerHTML = '';

        LIBRARY_CATEGORIES.forEach(cat => {
            const count = cat.key === 'all'
                ? DOCUMENTARIES.length
                : DOCUMENTARIES.filter(d => d.category === cat.key).length;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `lib-filter-btn ${currentFilterCat === cat.key ? 'active' : ''}`;
            const label = currentLang === 'en' ? cat.en : cat.es;
            btn.textContent = `${label} (${count})`;
            btn.addEventListener('click', () => {
                currentFilterCat = cat.key;
                renderLibraryCategoryFilters();
                renderDocumentaryLibrary(cat.key);
            });
            filtersBox.appendChild(btn);
        });
    }

    function renderDocumentaryLibrary(filterCat = currentFilterCat) {
        currentFilterCat = filterCat;
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
                    <img src="https://i.ytimg.com/vi/${doc.id}/hqdefault.jpg" alt="${docTitle(doc)}" loading="lazy">
                    <span class="doc-play-badge"><i class="fa-solid fa-play"></i> ${t('btn_play')}</span>
                </div>
                <div class="doc-card-body">
                    <span class="doc-card-era">${docEra(doc)}</span>
                    <div class="doc-card-title">${docTitle(doc)}</div>
                </div>
            `;
            card.addEventListener('click', () => {
                playDocumentaryInMainPlayer(doc.id, docTitle(doc));
            });
            grid.appendChild(card);
        });
    }

    initRealEarthCountries();
    renderInteractiveMap();
    renderLibraryCategoryFilters();
    renderDocumentaryLibrary('all');

    // ==========================================
    // NAVEGACIÓN ENTRE VISTA PRINCIPAL Y MURO DE DEBATE A PANTALLA COMPLETA
    // ==========================================
    const homeThreeColumns = document.getElementById('home-three-columns');
    const debateWallFullscreen = document.getElementById('debate-wall-fullscreen');
    const navBtnHome = document.getElementById('nav-btn-home');
    const navBtnDebate = document.getElementById('nav-btn-debate');
    const openFullscreenWallBtn = document.getElementById('open-fullscreen-wall-btn');
    const backToHomeBtn = document.getElementById('back-to-home-btn');

    function switchMainView(viewName) {
        const isDebate = viewName === 'debate';
        if (homeThreeColumns) homeThreeColumns.classList.toggle('hidden', isDebate);
        if (debateWallFullscreen) debateWallFullscreen.classList.toggle('hidden', !isDebate);
        if (navBtnHome) navBtnHome.classList.toggle('active', !isDebate);
        if (navBtnDebate) navBtnDebate.classList.toggle('active', isDebate);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (isDebate) {
            updateComposerIdentity();
            loadComments();
        } else {
            setTimeout(() => renderInteractiveMap(), 60);
        }
    }

    if (navBtnHome) navBtnHome.addEventListener('click', () => switchMainView('home'));
    if (navBtnDebate) navBtnDebate.addEventListener('click', () => switchMainView('debate'));
    if (openFullscreenWallBtn) openFullscreenWallBtn.addEventListener('click', () => switchMainView('debate'));
    if (backToHomeBtn) backToHomeBtn.addEventListener('click', () => switchMainView('home'));

    // ==========================================
    // MURO DE DEBATE TIPO FACEBOOK (PUBLICACIONES, LIKES Y COMENTARIOS ANIDADOS CON @REFERENCIA)
    // ==========================================
    const communityForm = document.getElementById('community-comment-form');
    const communityInput = document.getElementById('community-comment-input');
    const communityDocSelect = document.getElementById('community-doc-tag');
    const communityList = document.getElementById('community-comments-list');
    let lastCommentsData = { comments: [], isAdmin: false };
    let activeReplyTargets = {}; // postId -> { parentId, replyToAuthor }

    function populateDocSelect() {
        if (!communityDocSelect) return;
        const currentVal = communityDocSelect.value;
        communityDocSelect.innerHTML = `<option value="">${t('opt_general_topic')}</option>`;
        DOCUMENTARIES.forEach(doc => {
            const opt = document.createElement('option');
            opt.value = docTitle(doc);
            opt.textContent = `🎬 ${docTitle(doc)}`;
            communityDocSelect.appendChild(opt);
        });
        communityDocSelect.value = currentVal;
    }

    function updateComposerIdentity() {
        const avatarEl = document.getElementById('composer-avatar');
        const labelEl = document.getElementById('composer-author-label');
        if (!avatarEl || !labelEl) return;
        if (authToken && currentUser) {
            const name = currentUser.role === 'admin' ? 'Huellas de la Humanidad (Admin)' : (currentUser.displayName || currentUser.username);
            labelEl.textContent = name;
            avatarEl.textContent = name.charAt(0).toUpperCase();
        } else {
            const guestName = t('poll_follower');
            labelEl.textContent = guestName;
            avatarEl.textContent = guestName.charAt(0).toUpperCase();
        }
    }

    let lastPostsSignature = '';

    async function loadComments(isBackgroundPoll = false) {
        try {
            const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
            const res = await fetch(`${API_BASE}/api/comments?voterId=${encodeURIComponent(voterId)}`, { headers });
            if (!res.ok) return;
            const data = await res.json();
            const posts = data.comments || [];
            const badge = document.getElementById('nav-debate-badge');
            if (badge) badge.textContent = posts.length;

            const sig = JSON.stringify(posts) + '|' + Boolean(data.isAdmin) + '|' + currentLang;
            if (isBackgroundPoll) {
                const activeEl = document.activeElement;
                if (activeEl && activeEl.id && activeEl.id.startsWith('reply-input-')) {
                    return;
                }
                if (sig === lastPostsSignature) {
                    return;
                }
            }
            lastPostsSignature = sig;
            renderComments(posts, Boolean(data.isAdmin));
        } catch (e) {}
    }

    function renderComments(posts, isAdmin) {
        lastCommentsData = { comments: posts, isAdmin };
        updateComposerIdentity();
        if (!communityList) return;
        communityList.innerHTML = '';

        if (posts.length === 0) {
            communityList.innerHTML = `<p class="empty-conv-text">${t('wall_empty')}</p>`;
            return;
        }

        posts.forEach(post => {
            const card = document.createElement('article');
            card.className = 'fb-post-card';

            const displayAuthor = (!post.author || post.author === 'Seguidor') ? t('poll_follower') : post.author;
            const initial = displayAuthor.charAt(0).toUpperCase();

            // 1. Cabecera de la publicación
            const header = document.createElement('div');
            header.className = 'fb-post-header';

            const authorWrap = document.createElement('div');
            authorWrap.className = 'fb-post-author-wrap';

            const avatar = document.createElement('div');
            avatar.className = 'fb-avatar';
            avatar.textContent = initial;

            const metaDiv = document.createElement('div');
            const nameLine = document.createElement('div');
            nameLine.className = 'fb-post-author-name';
            nameLine.textContent = displayAuthor;
            if (post.role === 'admin') {
                const badge = document.createElement('span');
                badge.className = 'admin-badge';
                badge.innerHTML = '<i class="fa-solid fa-crown"></i> ADMIN';
                nameLine.appendChild(badge);
            }

            const timeLine = document.createElement('div');
            timeLine.className = 'fb-post-time';
            timeLine.textContent = formatTime(post.createdAt);

            metaDiv.appendChild(nameLine);
            metaDiv.appendChild(timeLine);

            if (post.docTag) {
                const docPill = document.createElement('div');
                docPill.className = 'fb-doc-pill';
                docPill.innerHTML = `<i class="fa-solid fa-film"></i> ${post.docTag}`;
                metaDiv.appendChild(docPill);
            }

            authorWrap.appendChild(avatar);
            authorWrap.appendChild(metaDiv);
            header.appendChild(authorWrap);

            if (isAdmin) {
                const delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.className = 'delete-topic-btn';
                delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
                delBtn.addEventListener('click', () => deleteComment(post.id));
                header.appendChild(delBtn);
            }

            card.appendChild(header);

            // 2. Cuerpo de la publicación
            const body = document.createElement('div');
            body.className = 'fb-post-body';
            body.textContent = post.text;
            card.appendChild(body);

            // 3. Barra de estadísticas (Likes y total de comentarios)
            const replies = Array.isArray(post.replies) ? post.replies : [];
            const stats = document.createElement('div');
            stats.className = 'fb-post-stats';
            stats.innerHTML = `
                <span><i class="fa-solid fa-thumbs-up" style="color:var(--primary-color);"></i> ${post.likesCount || 0} ${t('fb_like')}</span>
                <span>${replies.length} ${replies.length === 1 ? t('fb_comment_singular') : t('fb_comments_count')}</span>
            `;
            card.appendChild(stats);

            // 4. Botones de Acción (Me gusta / Comentar)
            const actions = document.createElement('div');
            actions.className = 'fb-post-actions';

            const likeBtn = document.createElement('button');
            likeBtn.type = 'button';
            likeBtn.className = `fb-action-btn ${post.likedByMe ? 'liked' : ''}`;
            likeBtn.innerHTML = `<i class="fa-solid fa-thumbs-up"></i> ${t('fb_like')} (${post.likesCount || 0})`;
            likeBtn.addEventListener('click', () => toggleLike(post.id, null));

            const commentFocusBtn = document.createElement('button');
            commentFocusBtn.type = 'button';
            commentFocusBtn.className = 'fb-action-btn';
            commentFocusBtn.innerHTML = `<i class="fa-solid fa-comment"></i> ${t('fb_comment')}`;

            actions.appendChild(likeBtn);
            actions.appendChild(commentFocusBtn);
            card.appendChild(actions);

            // 5. Hilo de Comentarios y Respuestas Anidadas (con referencia @Persona)
            const thread = document.createElement('div');
            thread.className = 'fb-comments-thread';

            replies.forEach(r => {
                const rAuthor = (!r.author || r.author === 'Seguidor') ? t('poll_follower') : r.author;
                const row = document.createElement('div');
                row.className = `fb-comment-row ${r.parentId ? 'is-nested-reply' : ''}`;

                const rAvatar = document.createElement('div');
                rAvatar.className = 'fb-avatar small';
                rAvatar.textContent = rAuthor.charAt(0).toUpperCase();

                const contentWrap = document.createElement('div');
                contentWrap.className = 'fb-comment-content-wrap';

                const bubble = document.createElement('div');
                bubble.className = 'fb-comment-bubble';

                const rHeader = document.createElement('div');
                rHeader.className = 'fb-comment-author';
                const rNameSpan = document.createElement('span');
                rNameSpan.textContent = rAuthor;
                const rTimeSpan = document.createElement('span');
                rTimeSpan.style.fontWeight = '400';
                rTimeSpan.style.color = 'var(--text-muted)';
                rTimeSpan.textContent = formatTime(r.createdAt);
                rHeader.appendChild(rNameSpan);
                rHeader.appendChild(rTimeSpan);

                const rText = document.createElement('div');
                rText.className = 'fb-comment-text';
                if (r.replyToAuthor) {
                    const mention = document.createElement('span');
                    mention.className = 'fb-reply-mention';
                    mention.textContent = `@${r.replyToAuthor}`;
                    rText.appendChild(mention);
                }
                rText.appendChild(document.createTextNode(r.text));

                bubble.appendChild(rHeader);
                bubble.appendChild(rText);
                contentWrap.appendChild(bubble);

                // Sub-acciones de cada comentario: Me gusta, Responder a esta persona, Eliminar (Admin)
                const subActions = document.createElement('div');
                subActions.className = 'fb-comment-subactions';

                const rLikeBtn = document.createElement('button');
                rLikeBtn.type = 'button';
                rLikeBtn.className = `fb-subaction-link ${r.likedByMe ? 'liked' : ''}`;
                rLikeBtn.innerHTML = `<i class="fa-solid fa-thumbs-up"></i> ${t('fb_like')} (${r.likesCount || 0})`;
                rLikeBtn.addEventListener('click', () => toggleLike(post.id, r.id));

                const rReplyBtn = document.createElement('button');
                rReplyBtn.type = 'button';
                rReplyBtn.className = 'fb-subaction-link';
                rReplyBtn.innerHTML = `<i class="fa-solid fa-reply"></i> ${t('fb_reply')}`;
                rReplyBtn.addEventListener('click', () => {
                    activeReplyTargets[post.id] = {
                        parentId: r.id,
                        replyToAuthor: rAuthor
                    };
                    renderComments(lastCommentsData.comments, lastCommentsData.isAdmin);
                    setTimeout(() => {
                        const inp = document.getElementById(`reply-input-${post.id}`);
                        if (inp) inp.focus();
                    }, 40);
                });

                subActions.appendChild(rLikeBtn);
                subActions.appendChild(rReplyBtn);

                if (isAdmin) {
                    const rDelBtn = document.createElement('button');
                    rDelBtn.type = 'button';
                    rDelBtn.className = 'fb-subaction-link';
                    rDelBtn.style.color = '#ff9da6';
                    rDelBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
                    rDelBtn.addEventListener('click', () => deleteComment(post.id, r.id));
                    subActions.appendChild(rDelBtn);
                }

                contentWrap.appendChild(subActions);
                row.appendChild(rAvatar);
                row.appendChild(contentWrap);
                thread.appendChild(row);
            });

            // 6. Formulario para comentar la publicación o responder a un comentario específico (@Persona)
            const replyTarget = activeReplyTargets[post.id] || null;
            const replyForm = document.createElement('form');
            replyForm.className = 'fb-inline-reply-form';

            if (replyTarget) {
                const pill = document.createElement('div');
                pill.className = 'fb-replying-to-pill';
                pill.innerHTML = `
                    <span><i class="fa-solid fa-reply"></i> ${t('fb_replying_to')} <strong>@${replyTarget.replyToAuthor}</strong></span>
                `;
                const cancelBtn = document.createElement('button');
                cancelBtn.type = 'button';
                cancelBtn.className = 'fb-subaction-link';
                cancelBtn.textContent = t('fb_cancel');
                cancelBtn.addEventListener('click', () => {
                    delete activeReplyTargets[post.id];
                    renderComments(lastCommentsData.comments, lastCommentsData.isAdmin);
                });
                pill.appendChild(cancelBtn);
                replyForm.appendChild(pill);
            }

            const replyInput = document.createElement('input');
            replyInput.type = 'text';
            replyInput.id = `reply-input-${post.id}`;
            replyInput.maxLength = 900;
            replyInput.required = true;
            replyInput.placeholder = replyTarget
                ? `${t('fb_write_reply')} @${replyTarget.replyToAuthor}...`
                : t('fb_write_comment');

            const replySubmit = document.createElement('button');
            replySubmit.type = 'submit';
            replySubmit.innerHTML = `<i class="fa-solid fa-paper-plane"></i> ${replyTarget ? t('fb_reply') : t('fb_comment')}`;

            commentFocusBtn.addEventListener('click', () => {
                delete activeReplyTargets[post.id];
                replyInput.focus();
            });

            replyForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const text = replyInput.value.trim();
                if (!text) return;
                replyInput.value = '';
                const target = activeReplyTargets[post.id] || null;
                delete activeReplyTargets[post.id];
                await submitReply(post.id, target ? target.parentId : null, target ? target.replyToAuthor : '', text);
            });

            replyForm.appendChild(replyInput);
            replyForm.appendChild(replySubmit);
            thread.appendChild(replyForm);

            card.appendChild(thread);
            communityList.appendChild(card);
        });
    }

    async function toggleLike(postId, replyId = null) {
        try {
            const headers = {
                'Content-Type': 'application/json',
                ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
            };
            await fetch(`${API_BASE}/api/comments/like`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ postId, replyId, voterId })
            });
            loadComments();
        } catch (err) {}
    }

    async function submitReply(postId, parentId, replyToAuthor, text) {
        try {
            const headers = {
                'Content-Type': 'application/json',
                ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
            };
            const res = await fetch(`${API_BASE}/api/comments/reply`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ postId, parentId, replyToAuthor, text })
            });
            if (res.ok) {
                loadComments();
            }
        } catch (err) {}
    }

    if (communityForm) {
        communityForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = communityInput.value.trim();
            const docTag = communityDocSelect ? communityDocSelect.value : '';
            if (!text) return;
            communityInput.value = '';
            if (communityDocSelect) communityDocSelect.value = '';
            try {
                const headers = {
                    'Content-Type': 'application/json',
                    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
                };
                const res = await fetch(`${API_BASE}/api/comments/add`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ text, docTag })
                });
                if (res.ok) {
                    loadComments();
                }
            } catch (err) {}
        });
    }

    async function deleteComment(commentId, replyId = null) {
        if (!authToken) return;
        try {
            await fetch(`${API_BASE}/api/comments/delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ commentId, replyId })
            });
            loadComments();
        } catch (err) {}
    }

    // ==========================================
    // APLICAR CAMBIO DE IDIOMA (ES / EN)
    // ==========================================
    function applyLanguage(lang) {
        currentLang = (lang === 'en') ? 'en' : 'es';
        localStorage.setItem('huellas_lang', currentLang);
        document.documentElement.lang = currentLang;

        const btnEs = document.getElementById('lang-btn-es');
        const btnEn = document.getElementById('lang-btn-en');
        if (btnEs) btnEs.classList.toggle('active', currentLang === 'es');
        if (btnEn) btnEn.classList.toggle('active', currentLang === 'en');

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key) el.textContent = t(key);
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (key) el.setAttribute('placeholder', t(key));
        });

        populateDocSelect();
        renderEphemeris();
        if (lastPollData) renderPoll(lastPollData);
        if (lastTriviaData) renderTrivia(lastTriviaData);
        renderInteractiveMap();
        renderLibraryCategoryFilters();
        renderDocumentaryLibrary(currentFilterCat);
        renderComments(lastCommentsData.comments, lastCommentsData.isAdmin);
    }

    const langBtnEs = document.getElementById('lang-btn-es');
    const langBtnEn = document.getElementById('lang-btn-en');
    if (langBtnEs) langBtnEs.addEventListener('click', () => applyLanguage('es'));
    if (langBtnEn) langBtnEn.addEventListener('click', () => applyLanguage('en'));

    populateDocSelect();
    applyLanguage(currentLang);
    updatePollAdminControls();
    loadPoll();
    loadReleaseCountdown();
    loadTrivia();
    loadComments();

    setInterval(() => {
        loadPoll();
        loadComments(true);
    }, 6000);

    if (authToken && currentUser) {
        enterChatView();
    }
});
