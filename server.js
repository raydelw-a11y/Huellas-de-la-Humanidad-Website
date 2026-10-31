const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

const PORT = process.env.PORT || 3000;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const DB_REPO = process.env.DB_REPO || 'raydelw-a11y/huellas-chat-db';
const DB_FILE_PATH = 'db.json';
const LOCAL_DB_FILE = path.join(__dirname, 'chat-db.local.json');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, originalHash] = stored.split(':');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
}

function validatePasswordRules(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'La contraseña debe tener mínimo 8 caracteres.';
  }
  if (!/[0-9]/.test(password)) {
    return 'La contraseña debe incluir al menos un número.';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'La contraseña debe incluir al menos un símbolo (ej. !@#$%&*).';
  }
  return null;
}

const ADMIN_DEFAULT_PWD = process.env.ADMIN_PASSWORD || 'Huellas#2026';

// Estado en memoria
let db = {
  users: {
    raydeladmin: {
      username: 'raydeladmin',
      displayName: 'Huellas de la Humanidad',
      passwordHash: hashPassword(ADMIN_DEFAULT_PWD),
      email: 'raydelw@yahoo.com',
      notifyYoutube: true,
      role: 'admin',
      createdAt: new Date().toISOString()
    }
  },
  conversations: {}, // { [username]: { username, updatedAt, unreadByAdmin: 0, unreadByUser: 0, messages: [ { id, sender, role, text, createdAt } ] } }
  poll: {
    maxTopics: 5,
    topics: [] // [ { id, title, author, createdAt, voters: [] } ]
  },
  youtubeNotifier: {
    lastVideoId: '7oexZOHGQ8k',
    lastHorizontalVideoId: '7oexZOHGQ8k',
    lastVideoTitle: 'Así Era Vivir en la Corte Real del Siglo XIII: El Oscuro Precio de la Corona',
    lastNotifiedAt: null,
    notifiedVideoIds: ['rJdAGfxEYkw', 'PPgK7kuznm0', '7oexZOHGQ8k']
  },
  autoDocumentaries: [],
  nextRelease: null,
  trivia: {
    id: 'trivia-louvre-1200',
    question: '¿Alrededor de qué año se erigió originalmente el Louvre como una fortaleza medieval para defender París?',
    options: [
      'Año 1200 (bajo el rey Felipe II Augusto)',
      'Año 1546 (durante el Renacimiento francés)',
      'Año 1789 (al estallar la Revolución Francesa)',
      'Año 1358 (durante la Guerra de los Cien Años)'
    ],
    correctIndex: 0,
    answeredBy: {} // { [voterKey]: selectedIndex }
  },
  scores: {}, // { [displayName]: points }
  socialStats: {
    youtube: 1060,
    tiktok: 10600,
    facebook: 22792,
    instagram: 1128,
    total: 35580,
    updatedAt: new Date().toISOString()
  },
  comments: [
    {
      id: 'welcome-comment-1',
      author: 'Huellas de la Humanidad',
      role: 'admin',
      text: '¡Bienvenid@s al Muro de Debate de la Comunidad! Comparte aquí tus teorías, impresiones o conversaciones libres sobre la historia.',
      createdAt: new Date().toISOString()
    }
  ],
  videoComments: {}, // { [videoId]: [ { id, author, role, text, createdAt } ] }
  notifications: {} // { [username]: [ { id, type, titleEs, titleEn, bodyEs, bodyEn, thumbUrl, videoId, postId, chatUser, createdAt, read } ] }
};

const TOKEN_SECRET = process.env.TOKEN_SECRET || 'huellas-secret-key-2026-ancient-history';
let githubFileSha = null;
let savePending = false;
let isSaving = false;

function createSessionToken(payloadObj) {
  const data = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifySessionToken(token) {
  if (!token || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(data).digest('base64url');
  if (sig !== expected) return null;
  try {
    return JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  } catch (e) {
    return null;
  }
}

function githubRequest(method, apiPath, bodyObj) {
  return new Promise((resolve, reject) => {
    if (!GITHUB_TOKEN) return resolve(null);
    const payload = bodyObj ? JSON.stringify(bodyObj) : null;
    const req = https.request({
      hostname: 'api.github.com',
      path: apiPath,
      method,
      headers: {
        'User-Agent': 'Huellas-Chat-Server',
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null });
        } catch (e) {
          resolve({ status: res.statusCode, body: null });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function loadDatabase() {
  // 1. Try local file first
  try {
    if (fs.existsSync(LOCAL_DB_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(LOCAL_DB_FILE, 'utf8'));
      if (parsed && parsed.users) {
        db.users = { ...db.users, ...parsed.users };
        db.conversations = parsed.conversations || {};
        if (parsed.poll && Array.isArray(parsed.poll.topics)) {
          db.poll = parsed.poll;
        }
        if (parsed.youtubeNotifier) {
          db.youtubeNotifier = { ...db.youtubeNotifier, ...parsed.youtubeNotifier };
        }
        if (Array.isArray(parsed.autoDocumentaries)) {
          db.autoDocumentaries = parsed.autoDocumentaries;
        }
        if ('nextRelease' in parsed) db.nextRelease = parsed.nextRelease;
        if (parsed.trivia) db.trivia = parsed.trivia;
        if (parsed.scores) db.scores = parsed.scores;
        if (Array.isArray(parsed.comments)) db.comments = parsed.comments;
        if (parsed.videoComments && typeof parsed.videoComments === 'object') db.videoComments = parsed.videoComments;
        if (parsed.notifications && typeof parsed.notifications === 'object') db.notifications = parsed.notifications;
        if (parsed.socialStats && typeof parsed.socialStats === 'object') {
          db.socialStats = { ...db.socialStats, ...parsed.socialStats };
        }
      }
    }
  } catch (e) {
    console.error('Error reading local DB:', e.message);
  }

  // 2. Try GitHub cloud backup
  if (GITHUB_TOKEN) {
    try {
      const res = await githubRequest('GET', `/repos/${DB_REPO}/contents/${DB_FILE_PATH}`);
      if (res && res.status === 200 && res.body && res.body.content) {
        githubFileSha = res.body.sha;
        const decoded = Buffer.from(res.body.content, 'base64').toString('utf8');
        const parsed = JSON.parse(decoded);
        if (parsed && parsed.users) {
          db.users = { ...db.users, ...parsed.users };
          db.conversations = parsed.conversations || {};
          if (parsed.poll && Array.isArray(parsed.poll.topics)) {
            db.poll = parsed.poll;
          }
          if (parsed.youtubeNotifier) {
            db.youtubeNotifier = { ...db.youtubeNotifier, ...parsed.youtubeNotifier };
          }
          if (Array.isArray(parsed.autoDocumentaries)) {
            db.autoDocumentaries = parsed.autoDocumentaries;
          }
          if ('nextRelease' in parsed) db.nextRelease = parsed.nextRelease;
          if (parsed.trivia) db.trivia = parsed.trivia;
          if (parsed.scores) db.scores = parsed.scores;
          if (Array.isArray(parsed.comments)) db.comments = parsed.comments;
          if (parsed.videoComments && typeof parsed.videoComments === 'object') db.videoComments = parsed.videoComments;
          if (parsed.notifications && typeof parsed.notifications === 'object') db.notifications = parsed.notifications;
          if (parsed.socialStats && typeof parsed.socialStats === 'object') {
            db.socialStats = { ...db.socialStats, ...parsed.socialStats };
          }
          console.log('Database loaded from GitHub cloud backup.');
        }
      }
    } catch (e) {
      console.error('Error loading GitHub DB:', e.message);
    }
  }

  // Limpiar cualquier próximo estreno automático que no haya sido confirmado explícitamente por el Admin
  if (
    db.nextRelease &&
    (!db.nextRelease.confirmedByAdmin ||
      db.nextRelease.title === 'Próximo Documental Especial en Producción' ||
      db.nextRelease.title === 'Próximo Gran Documental Histórico')
  ) {
    db.nextRelease = null;
    saveDatabase();
  }

  // Garantizar siempre que la cuenta maestra raydeladmin exista con su contraseña oficial
  db.users.raydeladmin = {
    username: 'raydeladmin',
    displayName: 'Huellas de la Humanidad',
    passwordHash: hashPassword(ADMIN_DEFAULT_PWD),
    email: (db.users.raydeladmin && db.users.raydeladmin.email) || 'raydelw@yahoo.com',
    notifyYoutube: (db.users.raydeladmin && db.users.raydeladmin.notifyYoutube) !== false,
    role: 'admin',
    createdAt: (db.users.raydeladmin && db.users.raydeladmin.createdAt) || new Date().toISOString()
  };
  delete db.users.admin;
  delete db.users.raydel;

  // Actualizar saludo automático existente a Bienvenid@
  Object.values(db.conversations || {}).forEach(conv => {
    if (conv && Array.isArray(conv.messages)) {
      conv.messages.forEach(m => {
        if (m.role === 'admin' && typeof m.text === 'string' && m.text.startsWith('¡Bienvenido,')) {
          m.text = m.text.replace('¡Bienvenido,', '¡Bienvenid@,');
        }
      });
    }
  });
}

async function saveDatabase() {
  try {
    fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (e) {
    // Ignore local write error
  }

  if (!GITHUB_TOKEN) return;
  if (isSaving) {
    savePending = true;
    return;
  }
  isSaving = true;
  try {
    const contentBase64 = Buffer.from(JSON.stringify(db, null, 2), 'utf8').toString('base64');
    const payload = {
      message: `sync: actualizar base de datos de chat (${new Date().toISOString()})`,
      content: contentBase64,
      ...(githubFileSha ? { sha: githubFileSha } : {})
    };
    const res = await githubRequest('PUT', `/repos/${DB_REPO}/contents/${DB_FILE_PATH}`, payload);
    if (res && (res.status === 200 || res.status === 201) && res.body && res.body.content) {
      githubFileSha = res.body.content.sha;
    } else if (res && res.status === 409) {
      // Refresh SHA and retry
      const getRes = await githubRequest('GET', `/repos/${DB_REPO}/contents/${DB_FILE_PATH}`);
      if (getRes && getRes.status === 200 && getRes.body) {
        githubFileSha = getRes.body.sha;
        savePending = true;
      }
    }
  } catch (e) {
    console.error('Error saving DB to GitHub:', e.message);
  } finally {
    isSaving = false;
    if (savePending) {
      savePending = false;
      saveDatabase();
    }
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 6e6) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

function getAuthSession(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  const payload = verifySessionToken(token);
  if (!payload || !payload.username || !db.users[payload.username]) {
    return null;
  }
  const u = db.users[payload.username];
  return {
    username: u.username,
    displayName: u.displayName || u.username,
    role: u.role
  };
}

function resolveUsernameByAuthor(authorName, role, authorUsername) {
  if (authorUsername && db.users && db.users[authorUsername]) {
    return authorUsername;
  }
  if (role === 'admin' || authorName === 'Huellas de la Humanidad') {
    return 'raydeladmin';
  }
  const clean = String(authorName || '').trim().toLowerCase();
  if (!clean || !db.users) return null;
  if (db.users[clean]) return clean;
  const found = Object.values(db.users).find(
    u => u && (
      String(u.username || '').toLowerCase() === clean ||
      String(u.displayName || '').toLowerCase() === clean
    )
  );
  return found ? found.username : null;
}

function addUserNotification(username, notif) {
  if (!username) return false;
  const cleanUser = String(username).trim().toLowerCase();
  if (!db.users || !db.users[cleanUser]) return false;
  if (!db.notifications || typeof db.notifications !== 'object') {
    db.notifications = {};
  }
  if (!Array.isArray(db.notifications[cleanUser])) {
    db.notifications[cleanUser] = [];
  }
  const list = db.notifications[cleanUser];
  const id = notif.id || crypto.randomUUID();
  const existingIdx = list.findIndex(item => item && item.id === id);
  if (existingIdx >= 0) {
    return false;
  }
  list.unshift({
    id,
    type: notif.type || 'info',
    titleEs: notif.titleEs || 'Nueva notificación',
    titleEn: notif.titleEn || notif.titleEs || 'New notification',
    bodyEs: notif.bodyEs || '',
    bodyEn: notif.bodyEn || notif.bodyEs || '',
    thumbUrl: notif.thumbUrl || '',
    videoId: notif.videoId || '',
    postId: notif.postId || '',
    chatUser: notif.chatUser || '',
    createdAt: notif.createdAt || new Date().toISOString(),
    read: Boolean(notif.read)
  });
  if (list.length > 60) {
    db.notifications[cleanUser] = list.slice(0, 60);
  }
  return true;
}

function ensureUserBaseNotifications(username) {
  if (!username) return [];
  const cleanUser = String(username).trim().toLowerCase();
  const userObj = db.users && db.users[cleanUser];
  if (!userObj) return [];
  if (!db.notifications || typeof db.notifications !== 'object') {
    db.notifications = {};
  }
  if (!Array.isArray(db.notifications[cleanUser])) {
    db.notifications[cleanUser] = [];
  }

  let changed = false;

  // 1. Notificaciones de subida de videos nuevos (imagen en miniatura + texto al lado)
  const latestVid = (db.youtubeNotifier && (db.youtubeNotifier.lastHorizontalVideoId || db.youtubeNotifier.lastVideoId)) || 'PPgK7kuznm0';
  const latestTitle = (db.youtubeNotifier && db.youtubeNotifier.lastVideoTitle) || 'Así Fue el Brutal Asedio de Antioquía en 1098: Hambre, Traición y Fe';

  const recentVideos = [
    {
      id: latestVid,
      titleEs: latestTitle,
      titleEn: latestVid === 'PPgK7kuznm0'
        ? 'The Brutal Siege of Antioch in 1098: Famine, Betrayal, and Faith'
        : latestTitle,
      createdAt: (db.youtubeNotifier && db.youtubeNotifier.lastNotifiedAt) || '2026-10-27T12:00:00.000Z'
    },
    {
      id: 'rJdAGfxEYkw',
      titleEs: 'El Louvre en el año 1200: La fortaleza olvidada de París',
      titleEn: 'The Louvre in 1200: The Forgotten Fortress of Paris',
      createdAt: '2026-10-20T12:00:00.000Z'
    }
  ];

  // Agregar cualquier otro video horizontal detectado automáticamente en autoDocumentaries
  if (Array.isArray(db.autoDocumentaries)) {
    db.autoDocumentaries.slice(0, 4).forEach(doc => {
      if (doc && doc.id && !recentVideos.some(v => v.id === doc.id)) {
        recentVideos.unshift({
          id: doc.id,
          titleEs: doc.titleEs || 'Nuevo Documental',
          titleEn: doc.titleEn || doc.titleEs || 'New Documentary',
          createdAt: doc.publishedAt || new Date().toISOString()
        });
      }
    });
  }

  for (let i = recentVideos.length - 1; i >= 0; i--) {
    const v = recentVideos[i];
    const added = addUserNotification(cleanUser, {
      id: `yt-video-${v.id}`,
      type: 'video',
      titleEs: '🎬 Nuevo documental subido a YouTube',
      titleEn: '🎬 New documentary uploaded to YouTube',
      bodyEs: `«${v.titleEs}»`,
      bodyEn: `“${v.titleEn}”`,
      thumbUrl: `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`,
      videoId: v.id,
      createdAt: v.createdAt,
      read: i > 0 // El último documental estrenado aparece sin leer inicialmente para avisar al usuario
    });
    if (added) changed = true;
  }

  // 2. Mensajes directos con los administradores (Chat en vivo)
  if (userObj.role === 'admin') {
    Object.values(db.conversations || {}).forEach(conv => {
      if (conv && conv.unreadByAdmin > 0 && Array.isArray(conv.messages) && conv.messages.length > 0) {
        const lastMsg = conv.messages[conv.messages.length - 1];
        if (lastMsg && lastMsg.role !== 'admin') {
          const added = addUserNotification(cleanUser, {
            id: `chat-msg-${lastMsg.id}`,
            type: 'chat_message',
            chatUser: conv.username,
            titleEs: `✉️ Mensaje de ${conv.displayName || conv.username}`,
            titleEn: `✉️ Message from ${conv.displayName || conv.username}`,
            bodyEs: `«${String(lastMsg.text || '').slice(0, 110)}»`,
            bodyEn: `“${String(lastMsg.text || '').slice(0, 110)}”`,
            createdAt: lastMsg.createdAt || conv.updatedAt,
            read: false
          });
          if (added) changed = true;
        }
      }
    });
  } else {
    const myConv = db.conversations && db.conversations[cleanUser];
    if (myConv && Array.isArray(myConv.messages) && myConv.messages.length > 0) {
      const adminMsgs = myConv.messages.filter(m => m && m.role === 'admin');
      if (adminMsgs.length > 0) {
        const latestAdminMsg = adminMsgs[adminMsgs.length - 1];
        const added = addUserNotification(cleanUser, {
          id: `chat-msg-${latestAdminMsg.id}`,
          type: 'chat_message',
          titleEs: '✉️ Mensaje de los Administradores',
          titleEn: '✉️ Message from the Administrators',
          bodyEs: `«${String(latestAdminMsg.text || '').slice(0, 110)}»`,
          bodyEn: `“${String(latestAdminMsg.text || '').slice(0, 110)}”`,
          createdAt: latestAdminMsg.createdAt || myConv.updatedAt,
          read: !(myConv.unreadByUser > 0)
        });
        if (added) changed = true;
      }
    }
  }

  // 3. Notificaciones personales del Muro de Debate (respuestas a publicaciones del usuario)
  if (Array.isArray(db.comments)) {
    db.comments.forEach(post => {
      if (!post) return;
      const postOwner = resolveUsernameByAuthor(post.author, post.role, post.authorUsername);
      const replies = Array.isArray(post.replies) ? post.replies : [];
      if (postOwner === cleanUser) {
        replies.forEach(r => {
          const replyOwner = resolveUsernameByAuthor(r.author, r.role, r.authorUsername);
          if (replyOwner !== cleanUser) {
            const added = addUserNotification(cleanUser, {
              id: `wall-reply-${r.id}`,
              type: 'wall_reply',
              postId: post.id,
              titleEs: `💬 ${r.author} comentó en tu publicación del Muro`,
              titleEn: `💬 ${r.author} commented on your Wall post`,
              bodyEs: `«${String(r.text || '').slice(0, 100)}»`,
              bodyEn: `“${String(r.text || '').slice(0, 100)}”`,
              createdAt: r.createdAt || post.createdAt,
              read: false
            });
            if (added) changed = true;
          }
        });
      }
    });
  }

  if (changed) {
    saveDatabase();
  }

  return db.notifications[cleanUser];
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4'
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // --- API ROUTES ---
  if (pathname === '/api/register' && req.method === 'POST') {
    const { username, password, email } = await parseBody(req);
    const cleanUser = String(username || '').trim().toLowerCase();
    const cleanEmail = String(email || '').trim().toLowerCase();

    const looksLikeEmail =
      cleanUser.includes('@') ||
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanUser) ||
      /\.(com|net|org|es|edu|gov|io|co|us|mx|ar|cl|pe|ve|cu|info|biz|me|live|outlook|hotmail|gmail|yahoo|icloud)$/i.test(cleanUser) ||
      (cleanEmail && cleanUser === cleanEmail);

    if (looksLikeEmail) {
      return sendJson(res, 400, {
        error: 'El correo electrónico no se puede usar como nombre de usuario. Elige un apodo único (tu correo es privado y solo es visible para ti).'
      });
    }

    if (!cleanUser || cleanUser.length < 3 || cleanUser.length > 30 || !/^[a-z0-9_.-]+$/.test(cleanUser)) {
      return sendJson(res, 400, { error: 'El usuario debe tener entre 3 y 30 caracteres (letras, números, punto o guion, sin usar un correo).' });
    }

    const pwdError = validatePasswordRules(password);
    if (pwdError) {
      return sendJson(res, 400, { error: pwdError });
    }

    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return sendJson(res, 400, { error: 'El formato del correo electrónico no es válido.' });
    }

    if (db.users[cleanUser]) {
      return sendJson(res, 409, { error: 'Ese nombre de usuario ya está registrado. Elige otro o inicia sesión.' });
    }

    const currentLatestVid = (db.youtubeNotifier && (db.youtubeNotifier.lastHorizontalVideoId || db.youtubeNotifier.lastVideoId)) || 'PPgK7kuznm0';
    const currentLatestTitle = (db.youtubeNotifier && db.youtubeNotifier.lastVideoTitle) || 'Así Fue el Brutal Asedio de Antioquía en 1098: Hambre, Traición y Fe';

    db.users[cleanUser] = {
      username: cleanUser,
      displayName: String(username).trim(),
      passwordHash: hashPassword(password),
      email: cleanEmail || '',
      notifyYoutube: Boolean(cleanEmail),
      welcomeVideoFollowup: cleanEmail ? {
        dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        videoIdAtSignup: currentLatestVid,
        videoTitleAtSignup: currentLatestTitle,
        sent: false,
        cancelledByNewRelease: false
      } : null,
      role: 'user',
      createdAt: new Date().toISOString()
    };

    if (!db.conversations[cleanUser]) {
      db.conversations[cleanUser] = {
        username: cleanUser,
        displayName: String(username).trim(),
        updatedAt: new Date().toISOString(),
        unreadByAdmin: 0,
        unreadByUser: 1,
        messages: [
          {
            id: crypto.randomUUID(),
            sender: 'Huellas de la Humanidad',
            role: 'admin',
            text: `¡Bienvenid@, ${String(username).trim()}! Gracias por unirte a Huellas de la Humanidad. Escríbenos aquí cualquier mensaje, sugerencia o consulta y te responderemos directamente.`,
            createdAt: new Date().toISOString()
          }
        ]
      };
    }

    saveDatabase();

    if (cleanEmail) {
      sendSubscriptionWelcomeEmail(cleanEmail, db.users[cleanUser].displayName);
    }

    const userPayload = {
      username: cleanUser,
      displayName: db.users[cleanUser].displayName,
      email: db.users[cleanUser].email || '',
      notifyYoutube: Boolean(db.users[cleanUser].notifyYoutube),
      role: 'user'
    };
    const token = createSessionToken({ username: cleanUser, role: 'user' });

    return sendJson(res, 201, {
      token,
      user: userPayload
    });
  }

  if (pathname === '/api/login' && req.method === 'POST') {
    const { username, password } = await parseBody(req);
    const cleanUser = String(username || '').trim().toLowerCase();

    if (cleanUser.includes('@')) {
      return sendJson(res, 400, { error: 'Inicia sesión con tu nombre de usuario, no con tu correo electrónico.' });
    }

    const userRecord = db.users[cleanUser];

    if (!userRecord || !verifyPassword(String(password || ''), userRecord.passwordHash)) {
      return sendJson(res, 401, { error: 'Usuario o contraseña incorrectos.' });
    }

    const userPayload = {
      username: userRecord.username,
      displayName: userRecord.displayName,
      email: userRecord.email || '',
      notifyYoutube: Boolean(userRecord.notifyYoutube),
      role: userRecord.role
    };
    const token = createSessionToken({ username: userRecord.username, role: userRecord.role });

    return sendJson(res, 200, {
      token,
      user: userPayload
    });
  }

  if (pathname === '/api/account/me' && req.method === 'GET') {
    const session = getAuthSession(req);
    if (!session) return sendJson(res, 401, { error: 'Sesión no válida.' });
    const u = db.users[session.username];
    return sendJson(res, 200, {
      user: {
        username: u.username,
        displayName: u.displayName || u.username,
        email: u.email || '',
        notifyYoutube: Boolean(u.notifyYoutube),
        role: u.role
      }
    });
  }

  if (pathname === '/api/account/settings' && req.method === 'POST') {
    const session = getAuthSession(req);
    if (!session) return sendJson(res, 401, { error: 'Inicia sesión para actualizar tu cuenta.' });

    const { email, notifyYoutube } = await parseBody(req);
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return sendJson(res, 400, { error: 'Ingresa un correo electrónico válido (ej: nombre@correo.com).' });
    }

    const u = db.users[session.username];
    const hadEmailBefore = Boolean(u.email);
    u.email = cleanEmail;
    u.notifyYoutube = cleanEmail ? Boolean(notifyYoutube) : false;

    if (cleanEmail && u.notifyYoutube && !hadEmailBefore && !u.welcomeVideoFollowup) {
      const currentLatestVid = (db.youtubeNotifier && (db.youtubeNotifier.lastHorizontalVideoId || db.youtubeNotifier.lastVideoId)) || 'PPgK7kuznm0';
      const currentLatestTitle = (db.youtubeNotifier && db.youtubeNotifier.lastVideoTitle) || 'Así Fue el Brutal Asedio de Antioquía en 1098: Hambre, Traición y Fe';
      u.welcomeVideoFollowup = {
        dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        videoIdAtSignup: currentLatestVid,
        videoTitleAtSignup: currentLatestTitle,
        sent: false,
        cancelledByNewRelease: false
      };
    }

    saveDatabase();

    if (cleanEmail && u.notifyYoutube) {
      sendSubscriptionWelcomeEmail(cleanEmail, u.displayName || u.username);
    }

    return sendJson(res, 200, {
      ok: true,
      user: {
        username: u.username,
        displayName: u.displayName || u.username,
        email: u.email,
        notifyYoutube: u.notifyYoutube,
        role: u.role
      }
    });
  }

  if (pathname === '/api/chat/messages' && req.method === 'GET') {
    const session = getAuthSession(req);
    if (!session) return sendJson(res, 401, { error: 'Sesión no válida. Inicia sesión de nuevo.' });

    const targetUser = session.role === 'admin'
      ? String(parsedUrl.searchParams.get('user') || '').trim().toLowerCase()
      : session.username;

    if (!targetUser) {
      return sendJson(res, 200, { messages: [] });
    }

    const conv = db.conversations[targetUser];
    if (!conv) {
      return sendJson(res, 200, { messages: [] });
    }

    if (session.role === 'admin') {
      conv.unreadByAdmin = 0;
    } else {
      conv.unreadByUser = 0;
    }

    return sendJson(res, 200, {
      username: conv.username,
      displayName: conv.displayName || conv.username,
      messages: conv.messages || []
    });
  }

  if (pathname === '/api/chat/send' && req.method === 'POST') {
    const session = getAuthSession(req);
    if (!session) return sendJson(res, 401, { error: 'Sesión no válida. Inicia sesión de nuevo.' });

    const { text, targetUser } = await parseBody(req);
    const cleanText = String(text || '').trim();
    if (!cleanText) {
      return sendJson(res, 400, { error: 'El mensaje no puede estar vacío.' });
    }

    const convOwner = session.role === 'admin'
      ? String(targetUser || '').trim().toLowerCase()
      : session.username;

    if (!convOwner) {
      return sendJson(res, 400, { error: 'Selecciona un usuario para responder.' });
    }

    if (!db.conversations[convOwner]) {
      db.conversations[convOwner] = {
        username: convOwner,
        displayName: db.users[convOwner] ? db.users[convOwner].displayName : convOwner,
        updatedAt: new Date().toISOString(),
        unreadByAdmin: 0,
        unreadByUser: 0,
        messages: []
      };
    }

    const conv = db.conversations[convOwner];
    const msg = {
      id: crypto.randomUUID(),
      sender: session.role === 'admin' ? 'Huellas de la Humanidad (Admin)' : session.displayName,
      role: session.role,
      text: cleanText.slice(0, 1500),
      createdAt: new Date().toISOString()
    };

    conv.messages.push(msg);
    conv.updatedAt = msg.createdAt;
    if (session.role === 'admin') {
      conv.unreadByUser = (conv.unreadByUser || 0) + 1;
      conv.unreadByAdmin = 0;
      addUserNotification(convOwner, {
        id: `chat-msg-${msg.id}`,
        type: 'chat_message',
        titleEs: '✉️ Nuevo mensaje de los Administradores',
        titleEn: '✉️ New message from the Administrators',
        bodyEs: `«${cleanText.slice(0, 110)}»`,
        bodyEn: `“${cleanText.slice(0, 110)}”`,
        createdAt: msg.createdAt,
        read: false
      });
    } else {
      conv.unreadByAdmin = (conv.unreadByAdmin || 0) + 1;
      conv.unreadByUser = 0;
      Object.values(db.users || {}).forEach(u => {
        if (u && u.role === 'admin') {
          addUserNotification(u.username, {
            id: `chat-msg-${msg.id}`,
            type: 'chat_message',
            chatUser: convOwner,
            titleEs: `✉️ Mensaje de ${session.displayName || session.username}`,
            titleEn: `✉️ Message from ${session.displayName || session.username}`,
            bodyEs: `«${cleanText.slice(0, 110)}»`,
            bodyEn: `“${cleanText.slice(0, 110)}”`,
            createdAt: msg.createdAt,
            read: false
          });
        }
      });
    }

    saveDatabase();
    return sendJson(res, 201, { message: msg, messages: conv.messages });
  }

  // --- CENTRO DE NOTIFICACIONES DEL USUARIO (CAMPANITA) ---
  if (pathname === '/api/notifications' && req.method === 'GET') {
    const session = getAuthSession(req);
    if (!session) {
      return sendJson(res, 401, { error: 'Inicia sesión para ver tus notificaciones.' });
    }
    const list = ensureUserBaseNotifications(session.username);
    const sorted = [...list].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const unreadCount = sorted.filter(n => n && !n.read).length;
    return sendJson(res, 200, {
      notifications: sorted,
      unreadCount
    });
  }

  if (pathname === '/api/notifications/read' && req.method === 'POST') {
    const session = getAuthSession(req);
    if (!session) {
      return sendJson(res, 401, { error: 'Inicia sesión para gestionar tus notificaciones.' });
    }
    const { notificationId, all } = await parseBody(req);
    const list = ensureUserBaseNotifications(session.username);
    let updated = false;

    if (all) {
      list.forEach(n => {
        if (n && !n.read) {
          n.read = true;
          updated = true;
        }
      });
      if (session.role === 'admin') {
        Object.values(db.conversations || {}).forEach(c => {
          if (c && c.unreadByAdmin > 0) c.unreadByAdmin = 0;
        });
      } else if (db.conversations && db.conversations[session.username]) {
        db.conversations[session.username].unreadByUser = 0;
      }
    } else if (notificationId) {
      const target = list.find(n => n && n.id === notificationId);
      if (target && !target.read) {
        target.read = true;
        updated = true;
        if (target.type === 'chat_message') {
          if (session.role === 'admin' && target.chatUser && db.conversations && db.conversations[target.chatUser]) {
            db.conversations[target.chatUser].unreadByAdmin = 0;
          } else if (session.role !== 'admin' && db.conversations && db.conversations[session.username]) {
            db.conversations[session.username].unreadByUser = 0;
          }
        }
      }
    }

    if (updated) {
      saveDatabase();
    }
    const sorted = [...list].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const unreadCount = sorted.filter(n => n && !n.read).length;
    return sendJson(res, 200, {
      ok: true,
      notifications: sorted,
      unreadCount
    });
  }

  if (pathname === '/api/admin/conversations' && req.method === 'GET') {
    const session = getAuthSession(req);
    if (!session || session.role !== 'admin') {
      return sendJson(res, 403, { error: 'Acceso exclusivo para el Administrador.' });
    }

    const list = Object.values(db.conversations)
      .map(c => ({
        username: c.username,
        displayName: c.displayName || c.username,
        updatedAt: c.updatedAt,
        unreadByAdmin: c.unreadByAdmin || 0,
        lastMessage: c.messages && c.messages.length > 0 ? c.messages[c.messages.length - 1] : null
      }))
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

    return sendJson(res, 200, { conversations: list });
  }

  // --- ENCUESTA / TEMA DEL PRÓXIMO VIDEO (5 TEMAS + VOTACIÓN) ---
  if (pathname === '/api/poll' && req.method === 'GET') {
    recordActiveVisitor(req, parsedUrl);
    const voterId = String(parsedUrl.searchParams.get('voterId') || '').trim();
    const session = getAuthSession(req);
    const effectiveVoter = session ? `user:${session.username}` : (voterId ? `anon:${voterId}` : '');

    if (!db.poll) db.poll = { maxTopics: 5, topics: [] };
    const topics = (db.poll.topics || []).map(t => ({
      id: t.id,
      title: t.title,
      author: t.author,
      createdAt: t.createdAt,
      votes: Array.isArray(t.voters) ? t.voters.length : 0,
      votedByMe: effectiveVoter ? (Array.isArray(t.voters) && t.voters.includes(effectiveVoter)) : false
    }));

    const totalVotes = topics.reduce((sum, t) => sum + t.votes, 0);
    return sendJson(res, 200, {
      maxTopics: 5,
      status: topics.length >= 5 ? 'voting' : 'suggesting',
      totalVotes,
      isAdmin: Boolean(session && session.role === 'admin'),
      currentUsername: session ? (session.role === 'admin' ? session.username : (session.displayName || session.username)) : null,
      activeVisitors: getActiveVisitorCount(),
      topics
    });
  }

  if (pathname === '/api/poll/suggest' && req.method === 'POST') {
    const { title } = await parseBody(req);
    const session = getAuthSession(req);
    const cleanTitle = String(title || '').trim();

    if (!cleanTitle || cleanTitle.length < 4 || cleanTitle.length > 140) {
      return sendJson(res, 400, { error: 'El tema debe tener entre 4 y 140 caracteres.' });
    }

    if (!db.poll) db.poll = { maxTopics: 5, topics: [] };
    if (db.poll.topics.length >= 5) {
      return sendJson(res, 400, { error: 'Ya se establecieron los 5 temas. ¡Ahora puedes votar por tu favorito!' });
    }

    const exists = db.poll.topics.some(t => t.title.toLowerCase() === cleanTitle.toLowerCase());
    if (exists) {
      return sendJson(res, 409, { error: 'Ese tema ya fue propuesto en esta ronda.' });
    }

    // Sin cuenta -> 'Seguidor'; desde una cuenta activa -> nombre de usuario
    const author = session
      ? (session.role === 'admin' ? session.username : (session.displayName || session.username))
      : 'Seguidor';

    db.poll.topics.push({
      id: crypto.randomUUID(),
      title: cleanTitle,
      author,
      createdAt: new Date().toISOString(),
      voters: []
    });

    saveDatabase();
    return sendJson(res, 201, { ok: true, count: db.poll.topics.length, author });
  }

  if (pathname === '/api/poll/vote' && req.method === 'POST') {
    const { topicId, voterId } = await parseBody(req);
    const session = getAuthSession(req);
    const effectiveVoter = session ? `user:${session.username}` : (voterId ? `anon:${String(voterId).trim()}` : '');

    if (!effectiveVoter) {
      return sendJson(res, 400, { error: 'No se pudo identificar tu voto.' });
    }

    if (!db.poll || !Array.isArray(db.poll.topics) || db.poll.topics.length < 5) {
      return sendJson(res, 400, { error: 'Las votaciones se abren automáticamente al completarse los 5 temas.' });
    }

    const target = db.poll.topics.find(t => t.id === topicId);
    if (!target) {
      return sendJson(res, 404, { error: 'Tema no encontrado.' });
    }

    // Permitir 1 voto por persona (si cambia de opinión, mueve su voto al nuevo tema)
    db.poll.topics.forEach(t => {
      if (!Array.isArray(t.voters)) t.voters = [];
      t.voters = t.voters.filter(v => v !== effectiveVoter);
    });
    target.voters.push(effectiveVoter);

    saveDatabase();
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/poll/delete-topic' && req.method === 'POST') {
    const session = getAuthSession(req);
    if (!session || session.role !== 'admin') {
      return sendJson(res, 403, { error: 'Solo el Administrador puede eliminar un tema.' });
    }
    const { topicId } = await parseBody(req);
    if (db.poll && Array.isArray(db.poll.topics)) {
      db.poll.topics = db.poll.topics.filter(t => t.id !== topicId);
      saveDatabase();
    }
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/poll/reset' && req.method === 'POST') {
    const session = getAuthSession(req);
    if (!session || session.role !== 'admin') {
      return sendJson(res, 403, { error: 'Solo el Administrador puede reiniciar la ronda de temas.' });
    }
    db.poll = { maxTopics: 5, topics: [] };
    saveDatabase();
    return sendJson(res, 200, { ok: true });
  }

  // --- PRÓXIMO ESTRENO EN PRODUCCIÓN (COUNTDOWN) ---
  if (pathname === '/api/release' && req.method === 'GET') {
    const session = getAuthSession(req);
    const validRelease = (db.nextRelease && db.nextRelease.confirmedByAdmin) ? db.nextRelease : null;
    return sendJson(res, 200, {
      nextRelease: validRelease,
      isAdmin: Boolean(session && session.role === 'admin')
    });
  }

  if (pathname === '/api/release' && req.method === 'POST') {
    const session = getAuthSession(req);
    if (!session || session.role !== 'admin') {
      return sendJson(res, 403, { error: 'Solo el Administrador puede configurar el próximo estreno.' });
    }
    const { title, targetDate, thumbnailData, reset } = await parseBody(req);
    if (reset) {
      db.nextRelease = null;
      saveDatabase();
      return sendJson(res, 200, { ok: true, nextRelease: null });
    }
    const cleanTitle = String(title || '').trim().slice(0, 180);
    let cleanThumb = (db.nextRelease && db.nextRelease.thumbnailData) || '';
    if (thumbnailData === '') {
      cleanThumb = '';
    } else if (typeof thumbnailData === 'string' && thumbnailData.startsWith('data:image/')) {
      cleanThumb = thumbnailData;
    }

    let isoDate = null;
    if (targetDate) {
      const parsedDate = new Date(targetDate);
      if (!isNaN(parsedDate.getTime())) {
        isoDate = parsedDate.toISOString();
      }
    }

    if (!cleanTitle && !cleanThumb && !isoDate) {
      return sendJson(res, 400, { error: 'Sube una miniatura o escribe el título del próximo video.' });
    }

    db.nextRelease = {
      title: cleanTitle,
      thumbnailData: cleanThumb,
      targetDate: isoDate,
      confirmedByAdmin: true,
      updatedAt: new Date().toISOString()
    };
    saveDatabase();
    return sendJson(res, 200, { ok: true, nextRelease: db.nextRelease });
  }

  // --- TRIVIA HISTÓRICA SEMANAL Y CUADRO DE HONOR ---
  if (pathname === '/api/trivia' && req.method === 'GET') {
    const voterId = String(parsedUrl.searchParams.get('voterId') || '').trim();
    const session = getAuthSession(req);
    const voterKey = session ? `user:${session.username}` : (voterId ? `anon:${voterId}` : '');

    if (!db.trivia) {
      db.trivia = {
        id: 'trivia-1',
        question: '¿Alrededor de qué año se erigió originalmente el Louvre como una fortaleza medieval para defender París?',
        options: ['Año 1200 (bajo Felipe II Augusto)', 'Año 1546', 'Año 1789', 'Año 1358'],
        correctIndex: 0,
        answeredBy: {}
      };
    }
    const answeredBy = db.trivia.answeredBy || {};
    const myAnswer = voterKey && answeredBy[voterKey] !== undefined ? answeredBy[voterKey] : null;

    const leaderboard = Object.entries(db.scores || {})
      .map(([name, points]) => ({ name, points }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 5);

    return sendJson(res, 200, {
      id: db.trivia.id,
      question: db.trivia.question,
      options: db.trivia.options,
      myAnswer,
      correctIndex: myAnswer !== null ? db.trivia.correctIndex : null,
      leaderboard,
      isAdmin: Boolean(session && session.role === 'admin')
    });
  }

  if (pathname === '/api/trivia/answer' && req.method === 'POST') {
    const { optionIndex, voterId } = await parseBody(req);
    const session = getAuthSession(req);
    const voterKey = session ? `user:${session.username}` : (voterId ? `anon:${String(voterId).trim()}` : '');

    if (!voterKey) return sendJson(res, 400, { error: 'No se pudo registrar la respuesta.' });
    if (!db.trivia) return sendJson(res, 404, { error: 'No hay trivia activa.' });
    if (!db.trivia.answeredBy) db.trivia.answeredBy = {};

    if (db.trivia.answeredBy[voterKey] !== undefined) {
      return sendJson(res, 409, { error: 'Ya respondiste el reto histórico de esta semana.' });
    }

    const idx = Number(optionIndex);
    db.trivia.answeredBy[voterKey] = idx;
    const isCorrect = idx === Number(db.trivia.correctIndex);

    if (isCorrect) {
      const displayHolder = session
        ? (session.role === 'admin' ? session.username : (session.displayName || session.username))
        : 'Seguidor';
      if (!db.scores) db.scores = {};
      if (displayHolder !== 'Seguidor') {
        db.scores[displayHolder] = (db.scores[displayHolder] || 0) + 10;
      }
    }

    saveDatabase();
    return sendJson(res, 200, {
      ok: true,
      isCorrect,
      correctIndex: db.trivia.correctIndex
    });
  }

  if (pathname === '/api/trivia/update' && req.method === 'POST') {
    const session = getAuthSession(req);
    if (!session || session.role !== 'admin') {
      return sendJson(res, 403, { error: 'Solo el Administrador puede cambiar la pregunta de trivia.' });
    }
    const { question, options, correctIndex } = await parseBody(req);
    if (!question || !Array.isArray(options) || options.length < 2) {
      return sendJson(res, 400, { error: 'Ingresa la pregunta y las opciones.' });
    }
    db.trivia = {
      id: 'trivia-' + Date.now(),
      question: String(question).trim(),
      options: options.map(o => String(o).trim()).filter(Boolean),
      correctIndex: Number(correctIndex) || 0,
      answeredBy: {}
    };
    saveDatabase();
    return sendJson(res, 200, { ok: true });
  }

  // --- MURO DE COMENTARIOS / DEBATE DE LA COMUNIDAD (CONVERSACIONES LIBRES, REQUIERE CUENTA) ---
  if (pathname === '/api/comments' && req.method === 'GET') {
    const session = getAuthSession(req);
    const voterId = parsedUrl.searchParams.get('voterId') || '';
    const voterKey = session ? `user:${session.username}` : `v:${voterId}`;

    if (!Array.isArray(db.comments)) db.comments = [];
    if (db.comments.length === 0) {
      db.comments.push({
        id: 'welcome-debate-post',
        author: 'Huellas de la Humanidad',
        role: 'admin',
        text: '¡Bienvenid@s al Muro de Debate de Huellas de la Humanidad! ¿Qué época histórica o suceso del pasado te gustaría debatir con la comunidad? Comparte tu reflexión, dale «Me gusta» o responde a otros miembros.',
        likes: [],
        replies: [],
        createdAt: new Date().toISOString()
      });
    }

    const formattedPosts = db.comments.slice(-80).reverse().map(post => {
      const likesArr = Array.isArray(post.likes) ? post.likes : [];
      const repliesArr = Array.isArray(post.replies) ? post.replies : [];
      return {
        id: post.id,
        author: post.author || 'Seguidor',
        role: post.role || 'user',
        text: post.text || '',
        createdAt: post.createdAt,
        likesCount: likesArr.length,
        likedByMe: Boolean(voterKey && likesArr.includes(voterKey)),
        replies: repliesArr.map(r => {
          const rLikes = Array.isArray(r.likes) ? r.likes : [];
          return {
            id: r.id,
            parentId: r.parentId || null,
            replyToAuthor: r.replyToAuthor || '',
            author: r.author || 'Seguidor',
            role: r.role || 'user',
            text: r.text || '',
            createdAt: r.createdAt,
            likesCount: rLikes.length,
            likedByMe: Boolean(voterKey && rLikes.includes(voterKey))
          };
        })
      };
    });

    return sendJson(res, 200, {
      comments: formattedPosts,
      isAdmin: Boolean(session && session.role === 'admin')
    });
  }

  if (pathname === '/api/comments/add' && req.method === 'POST') {
    const session = getAuthSession(req);
    if (!session) {
      return sendJson(res, 401, { error: 'Debes crear una cuenta o iniciar sesión para publicar en el Muro de Debate.' });
    }
    const { text } = await parseBody(req);
    const cleanText = String(text || '').trim();
    if (!cleanText || cleanText.length < 2) {
      return sendJson(res, 400, { error: 'Escribe una publicación antes de enviarla.' });
    }
    const author = session.role === 'admin'
      ? 'Huellas de la Humanidad'
      : (session.displayName || session.username);

    if (!Array.isArray(db.comments)) db.comments = [];
    const newPost = {
      id: crypto.randomUUID(),
      author,
      authorUsername: session.username,
      role: session.role,
      text: cleanText.slice(0, 1500),
      likes: [],
      replies: [],
      createdAt: new Date().toISOString()
    };
    db.comments.push(newPost);
    if (db.comments.length > 100) {
      db.comments = db.comments.slice(-100);
    }

    // Si un seguidor publica en el Muro de Debate, notificar al Administrador
    if (session.role !== 'admin') {
      Object.values(db.users || {}).forEach(u => {
        if (u && u.role === 'admin') {
          addUserNotification(u.username, {
            id: `wall-post-${newPost.id}`,
            type: 'wall_reply',
            postId: newPost.id,
            titleEs: `🏛️ ${author} publicó en el Muro de Debate`,
            titleEn: `🏛️ ${author} posted on the Debate Wall`,
            bodyEs: `«${newPost.text.slice(0, 100)}»`,
            bodyEn: `“${newPost.text.slice(0, 100)}”`,
            createdAt: newPost.createdAt,
            read: false
          });
        }
      });
    }

    saveDatabase();
    return sendJson(res, 201, { ok: true });
  }

  if (pathname === '/api/comments/like' && req.method === 'POST') {
    const session = getAuthSession(req);
    if (!session) {
      return sendJson(res, 401, { error: 'Debes crear una cuenta o iniciar sesión para usar el Muro de Debate.' });
    }
    const { postId, replyId } = await parseBody(req);
    const voterKey = `user:${session.username}`;
    const actorName = session.role === 'admin'
      ? 'Huellas de la Humanidad'
      : (session.displayName || session.username);

    if (!Array.isArray(db.comments)) db.comments = [];
    const post = db.comments.find(p => p.id === postId);
    if (!post) {
      return sendJson(res, 404, { error: 'Publicación no encontrada.' });
    }

    if (replyId) {
      if (!Array.isArray(post.replies)) post.replies = [];
      const reply = post.replies.find(r => r.id === replyId);
      if (!reply) return sendJson(res, 404, { error: 'Comentario no encontrado.' });
      if (!Array.isArray(reply.likes)) reply.likes = [];
      const idx = reply.likes.indexOf(voterKey);
      if (idx >= 0) {
        reply.likes.splice(idx, 1);
      } else {
        reply.likes.push(voterKey);
        const replyOwner = resolveUsernameByAuthor(reply.author, reply.role, reply.authorUsername);
        if (replyOwner && replyOwner !== session.username) {
          addUserNotification(replyOwner, {
            id: `wall-like-reply-${reply.id}-${session.username}`,
            type: 'wall_like',
            postId: post.id,
            titleEs: `❤️ A ${actorName} le gustó tu comentario en el Muro`,
            titleEn: `❤️ ${actorName} liked your comment on the Wall`,
            bodyEs: `«${String(reply.text || '').slice(0, 95)}»`,
            bodyEn: `“${String(reply.text || '').slice(0, 95)}”`,
            createdAt: new Date().toISOString(),
            read: false
          });
        }
      }
    } else {
      if (!Array.isArray(post.likes)) post.likes = [];
      const idx = post.likes.indexOf(voterKey);
      if (idx >= 0) {
        post.likes.splice(idx, 1);
      } else {
        post.likes.push(voterKey);
        const postOwner = resolveUsernameByAuthor(post.author, post.role, post.authorUsername);
        if (postOwner && postOwner !== session.username) {
          addUserNotification(postOwner, {
            id: `wall-like-post-${post.id}-${session.username}`,
            type: 'wall_like',
            postId: post.id,
            titleEs: `❤️ A ${actorName} le gustó tu publicación en el Muro`,
            titleEn: `❤️ ${actorName} liked your post on the Wall`,
            bodyEs: `«${String(post.text || '').slice(0, 95)}»`,
            bodyEn: `“${String(post.text || '').slice(0, 95)}”`,
            createdAt: new Date().toISOString(),
            read: false
          });
        }
      }
    }

    saveDatabase();
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/comments/reply' && req.method === 'POST') {
    const session = getAuthSession(req);
    if (!session) {
      return sendJson(res, 401, { error: 'Debes crear una cuenta o iniciar sesión para comentar en el Muro de Debate.' });
    }
    const { postId, parentId, replyToAuthor, text } = await parseBody(req);
    const cleanText = String(text || '').trim();
    if (!cleanText) {
      return sendJson(res, 400, { error: 'Escribe tu comentario.' });
    }

    if (!Array.isArray(db.comments)) db.comments = [];
    const post = db.comments.find(p => p.id === postId);
    if (!post) {
      return sendJson(res, 404, { error: 'Publicación no encontrada.' });
    }

    const author = session.role === 'admin'
      ? 'Huellas de la Humanidad'
      : (session.displayName || session.username);

    if (!Array.isArray(post.replies)) post.replies = [];
    const newReply = {
      id: crypto.randomUUID(),
      parentId: parentId || null,
      replyToAuthor: String(replyToAuthor || '').trim().slice(0, 60),
      author,
      authorUsername: session.username,
      role: session.role,
      text: cleanText.slice(0, 1000),
      likes: [],
      createdAt: new Date().toISOString()
    };
    post.replies.push(newReply);

    // Notificar al autor de la publicación original en el Muro
    const postOwner = resolveUsernameByAuthor(post.author, post.role, post.authorUsername);
    if (postOwner && postOwner !== session.username) {
      addUserNotification(postOwner, {
        id: `wall-reply-${newReply.id}`,
        type: 'wall_reply',
        postId: post.id,
        titleEs: `💬 ${author} comentó en tu publicación del Muro`,
        titleEn: `💬 ${author} commented on your Wall post`,
        bodyEs: `«${newReply.text.slice(0, 100)}»`,
        bodyEn: `“${newReply.text.slice(0, 100)}”`,
        createdAt: newReply.createdAt,
        read: false
      });
    }

    // Si es respuesta directa a otro comentario, notificar también al autor de ese comentario
    let parentOwner = null;
    if (parentId) {
      const parentComment = post.replies.find(r => r.id === parentId);
      if (parentComment) {
        parentOwner = resolveUsernameByAuthor(parentComment.author, parentComment.role, parentComment.authorUsername);
      }
    }
    if (!parentOwner && replyToAuthor) {
      parentOwner = resolveUsernameByAuthor(replyToAuthor, null, null);
    }
    if (parentOwner && parentOwner !== session.username && parentOwner !== postOwner) {
      addUserNotification(parentOwner, {
        id: `wall-reply-target-${newReply.id}`,
        type: 'wall_reply',
        postId: post.id,
        titleEs: `💬 ${author} respondió a tu comentario en el Muro`,
        titleEn: `💬 ${author} replied to your comment on the Wall`,
        bodyEs: `«${newReply.text.slice(0, 100)}»`,
        bodyEn: `“${newReply.text.slice(0, 100)}”`,
        createdAt: newReply.createdAt,
        read: false
      });
    }

    saveDatabase();
    return sendJson(res, 201, { ok: true });
  }

  // --- COMENTARIOS PROPIOS DE CADA VIDEO DE YOUTUBE (REQUIERE CUENTA PARA COMENTAR) ---
  if (pathname === '/api/video-comments' && req.method === 'GET') {
    const session = getAuthSession(req);
    const videoId = String(parsedUrl.searchParams.get('videoId') || '').trim();
    if (!db.videoComments || typeof db.videoComments !== 'object') db.videoComments = {};
    const list = Array.isArray(db.videoComments[videoId]) ? db.videoComments[videoId] : [];
    const formatted = list.slice(-100).reverse().map(c => ({
      id: c.id,
      author: c.author || 'Usuario',
      role: c.role || 'user',
      text: c.text || '',
      createdAt: c.createdAt
    }));
    return sendJson(res, 200, {
      videoId,
      comments: formatted,
      isAdmin: Boolean(session && session.role === 'admin')
    });
  }

  if (pathname === '/api/video-comments/add' && req.method === 'POST') {
    const session = getAuthSession(req);
    if (!session) {
      return sendJson(res, 401, { error: 'Debes crear una cuenta o iniciar sesión para comentar los videos.' });
    }
    const { videoId, text } = await parseBody(req);
    const cleanVid = String(videoId || '').trim().slice(0, 32);
    const cleanText = String(text || '').trim();
    if (!cleanVid || !cleanText) {
      return sendJson(res, 400, { error: 'Escribe un comentario antes de publicarlo.' });
    }
    const author = session.role === 'admin'
      ? 'Huellas de la Humanidad'
      : (session.displayName || session.username);

    if (!db.videoComments || typeof db.videoComments !== 'object') db.videoComments = {};
    if (!Array.isArray(db.videoComments[cleanVid])) db.videoComments[cleanVid] = [];

    db.videoComments[cleanVid].push({
      id: crypto.randomUUID(),
      author,
      role: session.role,
      text: cleanText.slice(0, 1200),
      createdAt: new Date().toISOString()
    });
    if (db.videoComments[cleanVid].length > 150) {
      db.videoComments[cleanVid] = db.videoComments[cleanVid].slice(-150);
    }
    saveDatabase();
    return sendJson(res, 201, { ok: true });
  }

  if (pathname === '/api/video-comments/delete' && req.method === 'POST') {
    const session = getAuthSession(req);
    if (!session || session.role !== 'admin') {
      return sendJson(res, 403, { error: 'Solo el Administrador puede eliminar comentarios.' });
    }
    const { videoId, commentId } = await parseBody(req);
    const cleanVid = String(videoId || '').trim();
    if (db.videoComments && Array.isArray(db.videoComments[cleanVid])) {
      db.videoComments[cleanVid] = db.videoComments[cleanVid].filter(c => c.id !== commentId);
      saveDatabase();
    }
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/comments/delete' && req.method === 'POST') {
    const session = getAuthSession(req);
    if (!session || session.role !== 'admin') {
      return sendJson(res, 403, { error: 'Solo el Administrador puede eliminar publicaciones o comentarios.' });
    }
    const { commentId, replyId } = await parseBody(req);
    if (Array.isArray(db.comments)) {
      if (replyId) {
        const post = db.comments.find(c => c.id === commentId);
        if (post && Array.isArray(post.replies)) {
          post.replies = post.replies.filter(r => r.id !== replyId && r.parentId !== replyId);
        }
      } else {
        db.comments = db.comments.filter(c => c.id !== commentId);
      }
      saveDatabase();
    }
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/presence/leave' && (req.method === 'POST' || req.method === 'GET')) {
    const vid = String(parsedUrl.searchParams.get('vid') || parsedUrl.searchParams.get('voterId') || '').trim();
    if (vid) {
      activeVisitors.delete(vid);
    }
    return sendJson(res, 200, { ok: true, activeVisitors: getActiveVisitorCount() });
  }

  if (pathname === '/api/youtube-videos' && req.method === 'GET') {
    recordActiveVisitor(req, parsedUrl);
    if (Date.now() - lastYoutubeCheckTime > 60 * 1000) {
      await checkYoutubeAndNotify();
    }
    const autoDocs = Array.isArray(db.autoDocumentaries) ? db.autoDocumentaries : [];
    const latestId = (db.youtubeNotifier && (db.youtubeNotifier.lastHorizontalVideoId || db.youtubeNotifier.lastVideoId)) || 'PPgK7kuznm0';
    const latestTitle = (db.youtubeNotifier && db.youtubeNotifier.lastVideoTitle) || 'Así Fue el Brutal Asedio de Antioquía en 1098: Hambre, Traición y Fe';
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return sendJson(res, 200, {
      latestVideoId: latestId,
      latestVideoTitle: latestTitle,
      autoDocumentaries: autoDocs
    });
  }

  if (pathname === '/api/social-stats' && req.method === 'GET') {
    recordActiveVisitor(req, parsedUrl);
    if (Date.now() - lastYoutubeCheckTime > 90 * 1000) {
      checkYoutubeAndNotify();
    }
    if (Date.now() - lastSocialRefreshTime > 15000) {
      await refreshSocialFollowerCounts();
    }
    const stats = db.socialStats || { youtube: 1060, tiktok: 10600, facebook: 22792, instagram: 1128, total: 35580 };
    const yt = Math.max(1060, Number(stats.youtube) || 1060);
    const tk = Math.max(10600, Number(stats.tiktok) || 10600);
    const fb = Math.max(22792, Number(stats.facebook) || 22792);
    const ig = Math.max(1128, Number(stats.instagram) || 1128);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return sendJson(res, 200, {
      youtube: yt,
      tiktok: tk,
      facebook: fb,
      instagram: ig,
      total: yt + tk + fb + ig,
      activeVisitors: getActiveVisitorCount(),
      updatedAt: stats.updatedAt || new Date().toISOString()
    });
  }

  // --- STATIC FILES ---
  let filePath = pathname === '/' ? '/index.html' : pathname;
  const safePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
  const fullPath = path.join(__dirname, safePath);

  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    const ext = path.extname(fullPath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    return fs.createReadStream(fullPath).pipe(res);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('No encontrado');
});

const activeVisitors = new Map(); // visitorKey -> timestampMs

function recordActiveVisitor(req, parsedUrl) {
  const vid = String(parsedUrl.searchParams.get('vid') || parsedUrl.searchParams.get('voterId') || '').trim();
  if (vid) {
    activeVisitors.set(vid, Date.now());
    return;
  }
  const ua = String(req.headers['user-agent'] || '');
  if (/bot|crawl|spider|uptime|render|curl/i.test(ua)) return;
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (ip) {
    activeVisitors.set(`ip:${ip}`, Date.now());
  }
}

function getActiveVisitorCount() {
  const now = Date.now();
  for (const [key, lastSeen] of activeVisitors.entries()) {
    if (now - lastSeen > 22000) {
      activeVisitors.delete(key);
    }
  }
  return Math.max(1, activeVisitors.size);
}

let lastSocialRefreshTime = 0;

function fetchHtmlWithUA(url, ua) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': ua || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
        'Cache-Control': 'no-cache'
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const nextUrl = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href;
        return fetchHtmlWithUA(nextUrl, ua).then(resolve);
      }
      let data = '';
      res.on('data', chunk => {
        data += chunk;
        if (data.length > 2.5e6) res.destroy();
      });
      res.on('end', () => resolve(data));
      res.on('error', () => resolve(''));
    });
    req.setTimeout(8000, () => {
      req.destroy();
      resolve('');
    });
    req.on('error', () => resolve(''));
  });
}

function decodeHtmlEntities(str) {
  return String(str || '')
    .replace(/&#xa0;/gi, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ');
}

function parseAbbreviatedCount(rawStr) {
  if (!rawStr) return 0;
  const clean = decodeHtmlEntities(rawStr).trim();
  const m = clean.match(/([0-9]+(?:[.,\s][0-9]+)*)\s*([KMBkmb])?/);
  if (!m) return 0;
  let numStr = m[1].trim();
  const suffix = (m[2] || '').toUpperCase();
  if (suffix) {
    numStr = numStr.replace(/\s+/g, '').replace(',', '.');
    const val = parseFloat(numStr);
    if (isNaN(val)) return 0;
    if (suffix === 'K') return Math.round(val * 1000);
    if (suffix === 'M') return Math.round(val * 1000000);
    if (suffix === 'B') return Math.round(val * 1000000000);
  }
  const digitsOnly = parseInt(numStr.replace(/[.,\s]/g, ''), 10);
  return isNaN(digitsOnly) ? 0 : digitsOnly;
}

const FB_PLUGIN_URL = 'https://www.facebook.com/plugins/page.php?href=https%3A%2F%2Fwww.facebook.com%2Fhuellasdelahumanidaddocumentales&tabs&width=340&height=130&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=false';

async function refreshSocialFollowerCounts() {
  lastSocialRefreshTime = Date.now();
  try {
    if (!db.socialStats) {
      db.socialStats = { youtube: 1060, tiktok: 10600, facebook: 22792, instagram: 1128, total: 35580, updatedAt: new Date().toISOString() };
    }
    const prevTotal = db.socialStats.total || 0;

    const [ytHtml, tkHtml, fbPluginHtml, fbPageHtml, igHtml, igFallbackHtml] = await Promise.all([
      fetchHtmlWithUA('https://www.youtube.com/@huellas_de_la_humanidad'),
      fetchHtmlWithUA('https://www.tiktok.com/@huellas_de_la_humanidad'),
      fetchHtmlWithUA(FB_PLUGIN_URL),
      fetchHtmlWithUA('https://www.facebook.com/huellasdelahumanidaddocumentales', 'facebookexternalhit/1.1'),
      fetchHtmlWithUA('https://www.instagram.com/huellasdelahumanidadvideos/', 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'),
      fetchHtmlWithUA('https://www.instagram.com/huellasdelahumanidadvideos/', 'TelegramBot (like TwitterBot)')
    ]);

    // 1. YouTube
    const ytClean = decodeHtmlEntities(ytHtml);
    const ytMatch = ytClean.match(/"subscriberCountText":\{"accessibility":\{"accessibilityData":\{"label":"([^"]+)"\}\},"simpleText":"([^"]+)"\}/) ||
                    ytClean.match(/([0-9.,]+\s*[KMBkmb]?)\s*(?:subscribers|suscriptores)/i);
    if (ytMatch) {
      const parsedYt = parseAbbreviatedCount(ytMatch[2] || ytMatch[1]);
      if (parsedYt >= 100) db.socialStats.youtube = parsedYt;
    }

    // 2. TikTok
    const tkMatch = tkHtml.match(/"followerCount":(\d+)/);
    if (tkMatch) {
      const parsedTk = parseInt(tkMatch[1], 10);
      if (parsedTk >= 100) db.socialStats.tiktok = parsedTk;
    }

    // 3. Facebook (usa el plugin oficial embebido que nunca redirige a login en servidores cloud + respaldo og:description)
    const fbClean = decodeHtmlEntities(fbPluginHtml) + '\n' + decodeHtmlEntities(fbPageHtml);
    const fbMatch = fbClean.match(/([0-9][0-9.,\s]*\s*[KMBkmb]?)\s*(?:followers|seguidores)/i);
    if (fbMatch) {
      const parsedFb = parseAbbreviatedCount(fbMatch[1]);
      if (parsedFb >= 100) db.socialStats.facebook = parsedFb;
    }

    // 4. Instagram (@huellasdelahumanidadvideos)
    const igClean = decodeHtmlEntities(igHtml) + '\n' + decodeHtmlEntities(igFallbackHtml);
    const igMatch = igClean.match(/([0-9][0-9.,\s]*\s*[KMBkmb]?)\s*(?:Followers|followers|seguidores)/i);
    if (igMatch) {
      const parsedIg = parseAbbreviatedCount(igMatch[1]);
      if (parsedIg >= 100) db.socialStats.instagram = parsedIg;
    }

    db.socialStats.youtube = Math.max(1060, Number(db.socialStats.youtube) || 1060);
    db.socialStats.tiktok = Math.max(10600, Number(db.socialStats.tiktok) || 10600);
    db.socialStats.facebook = Math.max(22792, Number(db.socialStats.facebook) || 22792);
    db.socialStats.instagram = Math.max(1128, Number(db.socialStats.instagram) || 1128);
    db.socialStats.total = db.socialStats.youtube + db.socialStats.tiktok + db.socialStats.facebook + db.socialStats.instagram;
    db.socialStats.updatedAt = new Date().toISOString();

    if (db.socialStats.total !== prevTotal) {
      saveDatabase();
    }
  } catch (e) {}
}

loadDatabase().then(() => {
  refreshSocialFollowerCounts();
  checkYoutubeAndNotify();
  server.listen(PORT, () => {
    console.log(`Servidor Huellas de la Humanidad activo en puerto ${PORT}`);
  });
  // Actualizar contadores de seguidores de YouTube, TikTok, Facebook e Instagram cada 20 segundos en vivo
  setInterval(refreshSocialFollowerCounts, 20 * 1000);
  // Vigilar automáticamente nuevos videos horizontales en el canal de YouTube cada 2 minutos
  setInterval(checkYoutubeAndNotify, 2 * 60 * 1000);
});

const YT_CHANNEL_ID = 'UCayIhjKhh0KFaJlzRIRkSZQ';
const EMAIL_LOGO_URL = 'https://huellasdelahumanidad.com/logo.png';
let lastYoutubeCheckTime = 0;
let isCheckingYoutube = false;

const BASE_DOCUMENTARY_IDS = new Set([
  '7oexZOHGQ8k', 'PPgK7kuznm0', 'rJdAGfxEYkw', 'PVVdxqlf5XQ', '27AZ11nTUz0', 'muZvqVzTTQ4',
  'O-ewFhxFahk', 'T8BdFd4Zm7Q', 'OT_2LgSxUtY', '8I2sy6C4l10', 'AdulsJeHVIU',
  '7lgpnoQpDXc', 'FPvbJ3RdC38', 'fovp3_GHPWU', 'CF3K2EjrpqY', 'DYkaMwKC5u8',
  'zIAwu_FxrFA', 'bhEAI_6xEgo', 'rOfrwwANg9k', 'CLxnnVoseeg', 'dn-cp5YPNuY',
  'S4hg8P0gtzg', '9MtSnB7sBog', 'oRXFu8r5wHU', 'qCwGXLfWWuE', 'Q1Rjnt5_Gr4',
  'HTqDUWWZE7s'
]);

const KNOWN_PLACES_GAZETTEER = [
  { re: /antioqu[ií]a/i, es: 'Antioquía, Siria', en: 'Antioch, Syria', lon: 36.16, lat: 36.20, region: 'europe' },
  { re: /jerusal[eé]n/i, es: 'Jerusalén', en: 'Jerusalem', lon: 35.21, lat: 31.77, region: 'europe' },
  { re: /constantinopla|estambul|bizancio/i, es: 'Constantinopla', en: 'Constantinople', lon: 28.98, lat: 41.01, region: 'europe' },
  { re: /babilonia|mesopotamia|bagdad/i, es: 'Babilonia, Mesopotamia', en: 'Babylon, Mesopotamia', lon: 44.42, lat: 32.54, region: 'europe' },
  { re: /pompeya|vesubio/i, es: 'Pompeya, Italia', en: 'Pompeii, Italy', lon: 14.49, lat: 40.75, region: 'europe' },
  { re: /\broma\b|coliseo|vaticano/i, es: 'Roma, Italia', en: 'Rome, Italy', lon: 12.49, lat: 41.89, region: 'europe' },
  { re: /florencia/i, es: 'Florencia, Italia', en: 'Florence, Italy', lon: 11.25, lat: 43.77, region: 'europe' },
  { re: /venecia/i, es: 'Venecia, Italia', en: 'Venice, Italy', lon: 12.33, lat: 45.44, region: 'europe' },
  { re: /atenas|esparta|grecia|acrópolis|acropolis|creta/i, es: 'Atenas, Grecia', en: 'Athens, Greece', lon: 23.73, lat: 37.98, region: 'europe' },
  { re: /giza|el cairo|pir[aá]mides|egipto|alejandr[ií]a|tebas|luxor/i, es: 'Egipto', en: 'Egypt', lon: 31.13, lat: 29.98, region: 'europe' },
  { re: /nazaret|galilea/i, es: 'Nazaret, Galilea', en: 'Nazareth, Galilee', lon: 35.30, lat: 32.70, region: 'europe' },
  { re: /par[ií]s|louvre|versalles|bastilla/i, es: 'París, Francia', en: 'Paris, France', lon: 2.34, lat: 48.86, region: 'europe' },
  { re: /normand[ií]a/i, es: 'Normandía, Francia', en: 'Normandy, France', lon: -0.85, lat: 49.34, region: 'europe' },
  { re: /londres|inglaterra| Reino Unido/i, es: 'Londres, Inglaterra', en: 'London, England', lon: -0.13, lat: 51.51, region: 'europe' },
  { re: /belfast|irlanda/i, es: 'Belfast, Irlanda', en: 'Belfast, Ireland', lon: -5.93, lat: 54.60, region: 'europe' },
  { re: /escocia|edimburgo/i, es: 'Edimburgo, Escocia', en: 'Edinburgh, Scotland', lon: -3.19, lat: 55.95, region: 'europe' },
  { re: /madrid|toledo|escorial/i, es: 'Madrid, España', en: 'Madrid, Spain', lon: -3.70, lat: 40.42, region: 'europe' },
  { re: /granada|alhambra|sevilla|c[oó]rdoba|andaluc[ií]a/i, es: 'Andalucía, España', en: 'Andalusia, Spain', lon: -3.60, lat: 37.18, region: 'europe' },
  { re: /barcelona|catalu[ñn]a/i, es: 'Barcelona, España', en: 'Barcelona, Spain', lon: 2.17, lat: 41.39, region: 'europe' },
  { re: /lisboa|portugal/i, es: 'Lisboa, Portugal', en: 'Lisbon, Portugal', lon: -9.14, lat: 38.72, region: 'europe' },
  { re: /berl[ií]n|reichstag|alemania/i, es: 'Berlín, Alemania', en: 'Berlin, Germany', lon: 13.38, lat: 52.52, region: 'europe' },
  { re: /viena|austria/i, es: 'Viena, Austria', en: 'Vienna, Austria', lon: 16.37, lat: 48.21, region: 'europe' },
  { re: /varsovia|polonia|auschwitz|cracovia/i, es: 'Polonia', en: 'Poland', lon: 21.01, lat: 52.23, region: 'europe' },
  { re: /mosc[uú]|stalingrado|rusia|san petersburgo/i, es: 'Moscú, Rusia', en: 'Moscow, Russia', lon: 37.62, lat: 55.75, region: 'europe' },
  { re: /chern[oó]bil|pr[ií]piat|ucrania|kiev/i, es: 'Chernóbil, Ucrania', en: 'Chernobyl, Ukraine', lon: 30.10, lat: 51.39, region: 'europe' },
  { re: /la habana|mariel|\bcuba\b|santiago de cuba/i, es: 'La Habana, Cuba', en: 'Havana, Cuba', lon: -82.37, lat: 23.11, region: 'americas' },
  { re: /torres gemelas|manhattan|nueva york|world trade center/i, es: 'Nueva York, EE. UU.', en: 'New York, USA', lon: -74.01, lat: 40.71, region: 'americas' },
  { re: /san francisco|alcatraz|california/i, es: 'San Francisco, California', en: 'San Francisco, California', lon: -122.42, lat: 37.77, region: 'americas' },
  { re: /washington|chicago|boston|filadelfia|estados unidos/i, es: 'Estados Unidos', en: 'United States', lon: -77.04, lat: 38.90, region: 'americas' },
  { re: /teotihuac[aá]n|tenochtitl[aá]n|m[eé]xico|chich[eé]n itz[aá]|yucat[aá]n/i, es: 'México', en: 'Mexico', lon: -99.13, lat: 19.43, region: 'americas' },
  { re: /machu picchu|cusco|per[uú]|inca/i, es: 'Cusco, Perú', en: 'Cusco, Peru', lon: -72.54, lat: -13.16, region: 'americas' },
  { re: /colombia|bogot[aá]|cartagena/i, es: 'Colombia', en: 'Colombia', lon: -74.07, lat: 4.71, region: 'americas' },
  { re: /argentina|buenos aires|los andes/i, es: 'Buenos Aires, Argentina', en: 'Buenos Aires, Argentina', lon: -58.38, lat: -34.60, region: 'americas' },
  { re: /tokio|hiroshima|nagasaki|kioto|jap[oó]n/i, es: 'Japón', en: 'Japan', lon: 139.69, lat: 35.68, region: 'asia' },
  { re: /pek[ií]n|china|shangh[aá]i|muralla china/i, es: 'China', en: 'China', lon: 116.40, lat: 39.90, region: 'asia' },
  { re: /krakatoa|sumatra|indonesia|java/i, es: 'Indonesia', en: 'Indonesia', lon: 105.42, lat: -6.10, region: 'asia' },
  { re: /india|nueva delhi|taj mahal/i, es: 'India', en: 'India', lon: 77.21, lat: 28.61, region: 'asia' },
  { re: /camboya|angkor|vietnam/i, es: 'Sudeste Asiático', en: 'Southeast Asia', lon: 103.86, lat: 13.41, region: 'asia' }
];

function decodeXmlEntities(str) {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function verifyIsHorizontalYoutubeVideo(videoId) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'www.youtube.com',
      path: `/shorts/${encodeURIComponent(videoId)}`,
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      }
    }, (res) => {
      // YouTube devuelve 303 Redirect hacia /watch?v= para videos horizontales y 200 OK para Shorts verticales
      resolve(res.statusCode >= 300 && res.statusCode < 400);
    });
    req.setTimeout(5000, () => {
      req.destroy();
      resolve(true);
    });
    req.on('error', () => resolve(true));
    req.end();
  });
}

function inferDocumentaryMetadata(videoId, rawTitle, description, publishedAt) {
  if (videoId === 'PPgK7kuznm0') {
    return {
      id: 'PPgK7kuznm0',
      titleEs: 'Así Fue el Brutal Asedio de Antioquía en 1098: Hambre, Traición y Fe',
      titleEn: 'The Brutal Siege of Antioch in 1098: Famine, Betrayal, and Faith',
      eraEs: 'Antioquía, Siria · Año 1098',
      eraEn: 'Antioch, Syria · Year 1098',
      category: 'medieval',
      region: 'europe',
      lon: 36.16,
      lat: 36.20,
      publishedAt: publishedAt || new Date().toISOString()
    };
  }

  const cleanTitleEs = decodeXmlEntities(rawTitle)
    .replace(/\s*\|\s*Documental Completo.*$/i, '')
    .replace(/\s*\|\s*Huellas de la Humanidad.*$/i, '')
    .trim();
  const fullText = `${cleanTitleEs} ${decodeXmlEntities(description || '')}`;

  // 1. Detectar año o época histórica
  let yearEs = '';
  let yearEn = '';
  const bcMatch = fullText.match(/\b(\d{1,4})\s*a\.\s*C\./i);
  const adMatch = fullText.match(/\b(\d{1,4})\s*d\.\s*C\./i);
  const yearMatch = fullText.match(/(?:en el a[ñn]o|en|de|a[ñn]o)\s+(\d{3,4})\b/i) || cleanTitleEs.match(/\b(1\d{3}|20[0-2]\d)\b/);
  const centuryMatch = fullText.match(/siglo\s+([IVX]+(?:\s*a\.\s*C\.)?)/i);

  if (bcMatch) {
    yearEs = `${bcMatch[1]} a.C.`;
    yearEn = `${bcMatch[1]} BC`;
  } else if (adMatch) {
    yearEs = `${adMatch[1]} d.C.`;
    yearEn = `${adMatch[1]} AD`;
  } else if (yearMatch) {
    yearEs = `Año ${yearMatch[1]}`;
    yearEn = `Year ${yearMatch[1]}`;
  } else if (centuryMatch) {
    yearEs = `Siglo ${centuryMatch[1].toUpperCase()}`;
    yearEn = `${centuryMatch[1].toUpperCase()} Century`;
  }

  // 2. Detectar lugar y coordenadas en el mapa
  let place = KNOWN_PLACES_GAZETTEER.find(p => p.re.test(cleanTitleEs)) ||
              KNOWN_PLACES_GAZETTEER.find(p => p.re.test(fullText));
  if (!place) {
    place = { es: 'Archivo Histórico', en: 'Historical Archive', lon: 12.49, lat: 41.89, region: 'europe' };
  }

  // 3. Clasificar categoría para la Biblioteca de Documentales
  let category = 'medieval';
  if (/torres gemelas|11 de septiembre|11-s|world trade center|manhattan/i.test(fullText)) {
    category = 'wtc';
  } else if (/\bcuba\b|habana|mariel|cubano/i.test(fullText)) {
    category = 'cuba';
  } else if (/segunda guerra mundial|1939|1940|1941|1942|1943|1944|1945|reichstag|normand[ií]a|polonia|blitzkrieg|nazi|stalingrado/i.test(fullText)) {
    category = 'ww2';
  } else if (/terremoto|tsunami|volc[aá]n|erupci[oó]n|titanic|naufragio|cat[aá]strofe|desastre|chern[oó]bil/i.test(fullText)) {
    category = 'catastrofes';
  } else if (/prisi[oó]n|alcatraz|crimen|fingi[oó]|misterio|caso real/i.test(fullText)) {
    category = 'misterios';
  } else if (/a\.\s*c\.|egipto|giza|pompeya|roma\b|grecia|mesopotamia|babilonia|neandertal|nazaret|antes de cristo|teotihuac[aá]n/i.test(fullText)) {
    category = 'antigua';
  }

  const eraEs = yearEs ? `${place.es} · ${yearEs}` : place.es;
  const eraEn = yearEn ? `${place.en} · ${yearEn}` : place.en;

  return {
    id: videoId,
    titleEs: cleanTitleEs,
    titleEn: cleanTitleEs,
    eraEs,
    eraEn,
    category,
    region: place.region,
    lon: place.lon,
    lat: place.lat,
    publishedAt: publishedAt || new Date().toISOString()
  };
}

function buildBrandEmailHtml({ title, greetingName, bodyHtml, ctaText, ctaUrl }) {
  return `
    <div style="background-color:#0c0a08;color:#f4ebd9;padding:28px 22px;font-family:Georgia,'Times New Roman',serif;border:1px solid #d4af37;border-radius:16px;max-width:580px;margin:0 auto;text-align:center;">
      <!-- Logotipo Completo en el Cuerpo del Correo -->
      <div style="margin-bottom:20px;">
        <a href="https://huellasdelahumanidad.com" target="_blank" style="text-decoration:none;">
          <img src="${EMAIL_LOGO_URL}" alt="Huellas de la Humanidad" width="165" style="width:165px;max-width:165px;height:auto;display:block;margin:0 auto;border:0;" />
        </a>
      </div>
      <div style="border-top:1px solid #d4af37;margin:16px auto 22px;max-width:320px;"></div>
      <h2 style="color:#d4af37;text-transform:uppercase;letter-spacing:2px;font-size:20px;margin:0 0 16px;">${title}</h2>
      <p style="font-size:17px;color:#f4ebd9;margin:0 0 14px;">¡Bienvenid@, <strong>${greetingName}</strong>!</p>
      <div style="font-size:16px;line-height:1.6;color:#dfd2b8;margin-bottom:26px;">
        ${bodyHtml}
      </div>
      <!-- Botón Dorado Compatible con todos los Clientes de Correo (Yahoo, Gmail, Apple Mail, Outlook) -->
      <table role="presentation" align="center" cellspacing="0" cellpadding="0" border="0" style="margin:28px auto;">
        <tr>
          <td align="center" bgcolor="#d4af37" style="background-color:#d4af37;border:2px solid #f5df98;border-radius:8px;">
            <a href="${ctaUrl}" target="_blank" style="background-color:#d4af37;color:#0c0a08 !important;padding:14px 28px;text-decoration:none;font-weight:bold;border-radius:6px;display:inline-block;letter-spacing:1px;text-transform:uppercase;font-size:14px;font-family:Georgia,'Times New Roman',serif;">
              <span style="color:#0c0a08;text-decoration:none;">${ctaText}</span>
            </a>
          </td>
        </tr>
      </table>
      <div style="border-top:1px solid rgba(212,175,55,0.45);margin:24px auto 14px;max-width:260px;"></div>
      <p style="font-size:13px;font-style:italic;color:#a09580;margin:0;">
        «Si quieres seguir cruzando el umbral del tiempo para vivir la historia desde dentro, suscríbete hoy. Cada historia deja una huella. Aquí seguimos sus rastros.»
      </p>
    </div>
  `;
}

function sendSubscriptionWelcomeEmail(toEmail, displayName) {
  const html = buildBrandEmailHtml({
    title: 'Notificaciones Activadas',
    greetingName: displayName,
    bodyHtml: '<p style="margin:0;">Tu correo electrónico ha quedado registrado exitosamente para recibir notificaciones automáticas cada vez que publiquemos un nuevo documental en nuestro canal de YouTube.</p>',
    ctaText: 'Visitar Huellas de la Humanidad',
    ctaUrl: 'https://huellasdelahumanidad.com'
  });
  return sendEmailViaResend(toEmail, 'Notificaciones activadas · Huellas de la Humanidad', html);
}

function sendEmailViaResend(toEmail, subject, htmlBody) {
  const apiKey = process.env.RESEND_API_KEY || '';
  if (!apiKey) return Promise.resolve(false);
  const fromAddress = process.env.EMAIL_FROM || 'Huellas de la Humanidad <notificaciones@huellasdelahumanidad.com>';
  const payload = JSON.stringify({
    from: fromAddress,
    to: [toEmail],
    subject,
    html: htmlBody
  });
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve(res.statusCode >= 200 && res.statusCode < 300));
    });
    req.on('error', () => resolve(false));
    req.write(payload);
    req.end();
  });
}

function checkYoutubeAndNotify() {
  if (isCheckingYoutube) return Promise.resolve();
  isCheckingYoutube = true;
  lastYoutubeCheckTime = Date.now();

  return new Promise((resolve) => {
    https.get(`https://www.youtube.com/feeds/videos.xml?channel_id=${YT_CHANNEL_ID}`, (res) => {
      let xml = '';
      res.on('data', chunk => xml += chunk);
      res.on('end', async () => {
        try {
          const rawEntries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(m => m[1]);
          if (rawEntries.length === 0) {
            isCheckingYoutube = false;
            return resolve();
          }

          const horizontalEntries = [];
          for (const entryXml of rawEntries) {
            const idMatch = entryXml.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
            const titleMatch = entryXml.match(/<title>([^<]+)<\/title>/);
            const linkMatch = entryXml.match(/<link[^>]+rel="alternate"[^>]+href="([^"]+)"/i) ||
                              entryXml.match(/<link[^>]+href="([^"]+)"/i);
            const descMatch = entryXml.match(/<media:description>([\s\S]*?)<\/media:description>/);
            const pubMatch = entryXml.match(/<published>([^<]+)<\/published>/);

            if (!idMatch) continue;
            const vid = idMatch[1].trim();
            const rawTitle = decodeXmlEntities(titleMatch ? titleMatch[1].trim() : 'Nuevo Documental');
            const href = linkMatch ? linkMatch[1].trim() : '';
            const desc = descMatch ? descMatch[1].trim() : '';
            const pub = pubMatch ? pubMatch[1].trim() : new Date().toISOString();

            // Descartar inmediatamente cualquier YouTube Short (/shorts/ en el enlace o #short en el título)
            if (/\/shorts\//i.test(href) || /#shorts?\b/i.test(rawTitle)) {
              continue;
            }

            horizontalEntries.push({ id: vid, rawTitle, href, desc, pub });
          }

          if (horizontalEntries.length === 0) {
            isCheckingYoutube = false;
            return resolve();
          }

          if (!Array.isArray(db.autoDocumentaries)) {
            db.autoDocumentaries = [];
          }

          let dbChanged = false;
          // Registrar automáticamente cualquier video horizontal nuevo para el Mapa Interactivo y la Biblioteca
          for (const item of horizontalEntries) {
            const alreadyInAuto = db.autoDocumentaries.some(d => d && d.id === item.id);
            if (!alreadyInAuto && (!BASE_DOCUMENTARY_IDS.has(item.id) || item.id === '7oexZOHGQ8k' || item.id === 'PPgK7kuznm0')) {
              const meta = inferDocumentaryMetadata(item.id, item.rawTitle, item.desc, item.pub);
              db.autoDocumentaries.unshift(meta);
              dbChanged = true;
            }
          }

          const latest = horizontalEntries[0];
          const latestId = latest.id;
          const cleanLatestTitle = latest.rawTitle.replace(/\s*\|\s*Documental Completo.*$/i, '').trim() || latest.rawTitle;

          if (!db.youtubeNotifier || typeof db.youtubeNotifier !== 'object') {
            db.youtubeNotifier = {
              lastVideoId: latestId,
              lastHorizontalVideoId: latestId,
              lastVideoTitle: cleanLatestTitle,
              lastNotifiedAt: new Date().toISOString(),
              notifiedVideoIds: [...BASE_DOCUMENTARY_IDS, latestId]
            };
            saveDatabase();
            isCheckingYoutube = false;
            return resolve();
          }

          if (!Array.isArray(db.youtubeNotifier.notifiedVideoIds)) {
            db.youtubeNotifier.notifiedVideoIds = [...BASE_DOCUMENTARY_IDS];
          } else {
            for (const baseId of BASE_DOCUMENTARY_IDS) {
              if (!db.youtubeNotifier.notifiedVideoIds.includes(baseId)) {
                db.youtubeNotifier.notifiedVideoIds.push(baseId);
              }
            }
          }
          if (!db.youtubeNotifier.lastHorizontalVideoId) {
            db.youtubeNotifier.lastHorizontalVideoId = latestId;
          }

          const alreadyNotified = db.youtubeNotifier.notifiedVideoIds.includes(latestId) || BASE_DOCUMENTARY_IDS.has(latestId);
          const pubTimeMs = new Date(latest.pub || 0).getTime();
          const isRecentUpload = pubTimeMs > 0 && (Date.now() - pubTimeMs) <= 24 * 60 * 60 * 1000;

          if (db.youtubeNotifier.lastHorizontalVideoId !== latestId) {
            db.youtubeNotifier.lastVideoId = latestId;
            db.youtubeNotifier.lastHorizontalVideoId = latestId;
            db.youtubeNotifier.lastVideoTitle = cleanLatestTitle;
            dbChanged = true;
          }

          // SOLO enviar correos si el video JAMÁS ha sido notificado, NO está en la biblioteca base y se subió hace menos de 24 horas
          if (!alreadyNotified && isRecentUpload) {
            db.youtubeNotifier.lastVideoId = latestId;
            db.youtubeNotifier.lastHorizontalVideoId = latestId;
            db.youtubeNotifier.lastVideoTitle = cleanLatestTitle;
            db.youtubeNotifier.lastNotifiedAt = new Date().toISOString();
            if (!db.youtubeNotifier.notifiedVideoIds.includes(latestId)) {
              db.youtubeNotifier.notifiedVideoIds.push(latestId);
            }

            // Si se estrena un nuevo video antes de cumplirse las 24h de un nuevo seguidor, cancelar el envío diferido del video anterior
            Object.values(db.users || {}).forEach(u => {
              if (!u) return;
              if (u.welcomeVideoFollowup && !u.welcomeVideoFollowup.sent) {
                u.welcomeVideoFollowup.cancelledByNewRelease = true;
                u.welcomeVideoFollowup.sent = true;
              }
              // Agregar notificación en la campanita del sitio con miniatura y título del nuevo video
              addUserNotification(u.username, {
                id: `yt-video-${latestId}`,
                type: 'video',
                titleEs: '🎬 Nuevo documental subido a YouTube',
                titleEn: '🎬 New documentary uploaded to YouTube',
                bodyEs: `«${cleanLatestTitle}»`,
                bodyEn: `“${cleanLatestTitle}”`,
                thumbUrl: `https://i.ytimg.com/vi/${latestId}/mqdefault.jpg`,
                videoId: latestId,
                createdAt: new Date().toISOString(),
                read: false
              });
            });

            saveDatabase();

            // Enviar correo de notificación a cada seguidor registrado con notificaciones activas
            const subscribers = Object.values(db.users || {}).filter(u => u && u.email && u.notifyYoutube);
            const seenEmails = new Set();
            for (const sub of subscribers) {
              const targetEmail = String(sub.email || '').trim().toLowerCase();
              if (!targetEmail || seenEmails.has(targetEmail)) continue;
              seenEmails.add(targetEmail);

              const thumbUrl = `https://i.ytimg.com/vi/${latestId}/hqdefault.jpg`;
              const youtubeVideoUrl = `https://www.youtube.com/watch?v=${latestId}`;
              const html = buildBrandEmailHtml({
                title: 'Nuevo Documental en YouTube',
                greetingName: sub.displayName || sub.username,
                bodyHtml: `
                  <p style="margin:0 0 14px;">Acabamos de publicar un nuevo documental completo en nuestro canal de YouTube:</p>
                  <h3 style="color:#f5df98;font-size:19px;margin:0 0 14px;">«${cleanLatestTitle}»</h3>
                  <a href="${youtubeVideoUrl}" target="_blank" style="text-decoration:none;">
                    <img src="${thumbUrl}" alt="${cleanLatestTitle}" width="460" style="width:100%;max-width:460px;height:auto;border-radius:10px;border:1px solid #d4af37;display:block;margin:0 auto;" />
                  </a>
                `,
                ctaText: 'Ver Documental en YouTube',
                ctaUrl: youtubeVideoUrl
              });
              await sendEmailViaResend(targetEmail, `Nuevo documental: ${cleanLatestTitle} - Huellas de la Humanidad`, html);
              // Pausa de 650ms entre envíos para respetar el límite de velocidad de Resend y garantizar entrega al 100%
              await new Promise(r => setTimeout(r, 650));
            }
          } else {
            // Revisar seguidores nuevos que cumplieron 24 horas desde su registro sin que se haya estrenado otro video antes
            let followupUpdated = false;
            const nowMs = Date.now();
            for (const u of Object.values(db.users || {})) {
              if (!u || !u.welcomeVideoFollowup || u.welcomeVideoFollowup.sent || u.welcomeVideoFollowup.cancelledByNewRelease) {
                continue;
              }
              if (!u.email || !u.notifyYoutube) {
                continue;
              }
              if (u.welcomeVideoFollowup.videoIdAtSignup && u.welcomeVideoFollowup.videoIdAtSignup !== latestId) {
                u.welcomeVideoFollowup.cancelledByNewRelease = true;
                u.welcomeVideoFollowup.sent = true;
                followupUpdated = true;
                continue;
              }
              const dueMs = new Date(u.welcomeVideoFollowup.dueAt || 0).getTime();
              if (dueMs > 0 && nowMs >= dueMs) {
                u.welcomeVideoFollowup.sent = true;
                u.welcomeVideoFollowup.sentAt = new Date().toISOString();
                followupUpdated = true;
                saveDatabase();

                const targetVid = latestId;
                const targetTitle = cleanLatestTitle || u.welcomeVideoFollowup.videoTitleAtSignup || 'Último Documental';
                const thumbUrl = `https://i.ytimg.com/vi/${targetVid}/hqdefault.jpg`;
                const youtubeVideoUrl = `https://www.youtube.com/watch?v=${targetVid}`;
                const html = buildBrandEmailHtml({
                  title: 'Último Documental Estrenado en YouTube',
                  greetingName: u.displayName || u.username,
                  bodyHtml: `
                    <p style="margin:0 0 14px;">Te compartimos nuestro último documental completo estrenado en el canal de YouTube por si aún no lo has visto:</p>
                    <h3 style="color:#f5df98;font-size:19px;margin:0 0 14px;">«${targetTitle}»</h3>
                    <a href="${youtubeVideoUrl}" target="_blank" style="text-decoration:none;">
                      <img src="${thumbUrl}" alt="${targetTitle}" width="460" style="width:100%;max-width:460px;height:auto;border-radius:10px;border:1px solid #d4af37;display:block;margin:0 auto;" />
                    </a>
                  `,
                  ctaText: 'Ver Documental en YouTube',
                  ctaUrl: youtubeVideoUrl
                });
                await sendEmailViaResend(String(u.email).trim().toLowerCase(), `Último documental: ${targetTitle} - Huellas de la Humanidad`, html);
                await new Promise(r => setTimeout(r, 650));
              }
            }
            if (dbChanged || followupUpdated) {
              saveDatabase();
            }
          }
        } catch (err) {
          console.error('Error in checkYoutubeAndNotify:', err.message);
        } finally {
          isCheckingYoutube = false;
          resolve();
        }
      });
    }).on('error', () => {
      isCheckingYoutube = false;
      resolve();
    });
  });
}
