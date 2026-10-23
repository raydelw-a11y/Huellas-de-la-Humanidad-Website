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
    lastVideoId: 'rJdAGfxEYkw',
    lastVideoTitle: '',
    lastNotifiedAt: null
  },
  nextRelease: {
    title: 'Próximo Documental Especial en Producción',
    targetDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
  },
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
  comments: [
    {
      id: 'welcome-comment-1',
      author: 'Huellas de la Humanidad',
      role: 'admin',
      text: '¡Bienvenid@s al Muro de Debate de la Comunidad! Comparte aquí tus teorías, impresiones o momentos favoritos de nuestros documentales.',
      createdAt: new Date().toISOString()
    }
  ]
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
          db.youtubeNotifier = parsed.youtubeNotifier;
        }
        if (parsed.nextRelease) db.nextRelease = parsed.nextRelease;
        if (parsed.trivia) db.trivia = parsed.trivia;
        if (parsed.scores) db.scores = parsed.scores;
        if (Array.isArray(parsed.comments)) db.comments = parsed.comments;
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
            db.youtubeNotifier = parsed.youtubeNotifier;
          }
          if (parsed.nextRelease) db.nextRelease = parsed.nextRelease;
          if (parsed.trivia) db.trivia = parsed.trivia;
          if (parsed.scores) db.scores = parsed.scores;
          if (Array.isArray(parsed.comments)) db.comments = parsed.comments;
          console.log('Database loaded from GitHub cloud backup.');
        }
      }
    } catch (e) {
      console.error('Error loading GitHub DB:', e.message);
    }
  }

  // Garantizar siempre que la cuenta maestra raydeladmin exista con su contraseña oficial
  db.users.raydeladmin = {
    username: 'raydeladmin',
    displayName: 'Huellas de la Humanidad',
    passwordHash: hashPassword(ADMIN_DEFAULT_PWD),
    email: (db.users.raydeladmin && db.users.raydeladmin.email) || '',
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
      if (body.length > 1e5) req.destroy();
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

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8'
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

    if (!cleanUser || cleanUser.length < 3 || cleanUser.length > 30 || !/^[a-z0-9_.-]+$/.test(cleanUser)) {
      return sendJson(res, 400, { error: 'El usuario debe tener entre 3 y 30 caracteres (letras, números, punto o guion).' });
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

    db.users[cleanUser] = {
      username: cleanUser,
      displayName: String(username).trim(),
      passwordHash: hashPassword(password),
      email: cleanEmail || '',
      notifyYoutube: Boolean(cleanEmail),
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
    u.email = cleanEmail;
    u.notifyYoutube = cleanEmail ? Boolean(notifyYoutube) : false;

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
    } else {
      conv.unreadByAdmin = (conv.unreadByAdmin || 0) + 1;
      conv.unreadByUser = 0;
    }

    saveDatabase();
    return sendJson(res, 201, { message: msg, messages: conv.messages });
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
    return sendJson(res, 200, {
      nextRelease: db.nextRelease || null,
      isAdmin: Boolean(session && session.role === 'admin')
    });
  }

  if (pathname === '/api/release' && req.method === 'POST') {
    const session = getAuthSession(req);
    if (!session || session.role !== 'admin') {
      return sendJson(res, 403, { error: 'Solo el Administrador puede configurar el próximo estreno.' });
    }
    const { title, targetDate, reset } = await parseBody(req);
    if (reset) {
      db.nextRelease = null;
      saveDatabase();
      return sendJson(res, 200, { ok: true, nextRelease: null });
    }
    const cleanTitle = String(title || '').trim();
    const parsedDate = new Date(targetDate);
    if (!cleanTitle || isNaN(parsedDate.getTime())) {
      return sendJson(res, 400, { error: 'Ingresa un título y una fecha válida.' });
    }
    db.nextRelease = {
      title: cleanTitle.slice(0, 140),
      targetDate: parsedDate.toISOString()
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

  // --- MURO DE COMENTARIOS / DEBATE DE LA COMUNIDAD (ESTILO FACEBOOK: POSTS, LIKES Y RESPUESTAS ANIDADAS) ---
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
        docTag: 'El Louvre en el año 1200',
        text: '¡Bienvenid@s al Muro de Debate de Huellas de la Humanidad! ¿Qué época histórica o documental del canal te ha impactado más hasta ahora? Comparte tu teoría, dale «Me gusta» o responde a los comentarios de otros seguidores.',
        likes: [],
        replies: [],
        createdAt: new Date().toISOString()
      });
    }

    const formattedPosts = db.comments.slice(-60).reverse().map(post => {
      const likesArr = Array.isArray(post.likes) ? post.likes : [];
      const repliesArr = Array.isArray(post.replies) ? post.replies : [];
      return {
        id: post.id,
        author: post.author || 'Seguidor',
        role: post.role || 'guest',
        docTag: post.docTag || '',
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
            role: r.role || 'guest',
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
    const { text, docTag } = await parseBody(req);
    const session = getAuthSession(req);
    const cleanText = String(text || '').trim();
    if (!cleanText || cleanText.length < 2) {
      return sendJson(res, 400, { error: 'Escribe una publicación antes de enviarla.' });
    }
    const author = session
      ? (session.role === 'admin' ? 'Huellas de la Humanidad' : (session.displayName || session.username))
      : 'Seguidor';

    if (!Array.isArray(db.comments)) db.comments = [];
    db.comments.push({
      id: crypto.randomUUID(),
      author,
      role: session ? session.role : 'guest',
      docTag: String(docTag || '').trim().slice(0, 120),
      text: cleanText.slice(0, 1500),
      likes: [],
      replies: [],
      createdAt: new Date().toISOString()
    });
    if (db.comments.length > 100) {
      db.comments = db.comments.slice(-100);
    }
    saveDatabase();
    return sendJson(res, 201, { ok: true });
  }

  if (pathname === '/api/comments/like' && req.method === 'POST') {
    const { postId, replyId, voterId } = await parseBody(req);
    const session = getAuthSession(req);
    const voterKey = session ? `user:${session.username}` : `v:${String(voterId || 'anon').slice(0, 80)}`;

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
      if (idx >= 0) reply.likes.splice(idx, 1);
      else reply.likes.push(voterKey);
    } else {
      if (!Array.isArray(post.likes)) post.likes = [];
      const idx = post.likes.indexOf(voterKey);
      if (idx >= 0) post.likes.splice(idx, 1);
      else post.likes.push(voterKey);
    }

    saveDatabase();
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/comments/reply' && req.method === 'POST') {
    const { postId, parentId, replyToAuthor, text } = await parseBody(req);
    const session = getAuthSession(req);
    const cleanText = String(text || '').trim();
    if (!cleanText) {
      return sendJson(res, 400, { error: 'Escribe tu comentario.' });
    }

    if (!Array.isArray(db.comments)) db.comments = [];
    const post = db.comments.find(p => p.id === postId);
    if (!post) {
      return sendJson(res, 404, { error: 'Publicación no encontrada.' });
    }

    const author = session
      ? (session.role === 'admin' ? 'Huellas de la Humanidad' : (session.displayName || session.username))
      : 'Seguidor';

    if (!Array.isArray(post.replies)) post.replies = [];
    post.replies.push({
      id: crypto.randomUUID(),
      parentId: parentId || null,
      replyToAuthor: String(replyToAuthor || '').trim().slice(0, 60),
      author,
      role: session ? session.role : 'guest',
      text: cleanText.slice(0, 1000),
      likes: [],
      createdAt: new Date().toISOString()
    });

    saveDatabase();
    return sendJson(res, 201, { ok: true });
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

loadDatabase().then(() => {
  server.listen(PORT, () => {
    console.log(`Servidor Huellas de la Humanidad activo en puerto ${PORT}`);
  });
  // Vigilar automáticamente nuevos videos en el canal de YouTube cada 10 minutos
  setInterval(checkYoutubeAndNotify, 10 * 60 * 1000);
});

const YT_CHANNEL_ID = 'UCayIhjKhh0KFaJlzRIRkSZQ';
const EMAIL_LOGO_URL = 'https://huellasdelahumanidad.com/logo.png';

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
  https.get(`https://www.youtube.com/feeds/videos.xml?channel_id=${YT_CHANNEL_ID}`, (res) => {
    let xml = '';
    res.on('data', chunk => xml += chunk);
    res.on('end', async () => {
      const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/);
      if (!entryMatch) return;
      const entry = entryMatch[1];
      const idMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
      const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
      if (!idMatch) return;
      const latestId = idMatch[1].trim();
      const latestTitle = titleMatch ? titleMatch[1].trim() : 'Nuevo Documental';

      if (!db.youtubeNotifier) {
        db.youtubeNotifier = { lastVideoId: latestId, lastVideoTitle: latestTitle, lastNotifiedAt: new Date().toISOString() };
        saveDatabase();
        return;
      }

      if (db.youtubeNotifier.lastVideoId && db.youtubeNotifier.lastVideoId !== latestId) {
        db.youtubeNotifier.lastVideoId = latestId;
        db.youtubeNotifier.lastVideoTitle = latestTitle;
        db.youtubeNotifier.lastNotifiedAt = new Date().toISOString();
        saveDatabase();

        const subscribers = Object.values(db.users).filter(u => u.email && u.notifyYoutube);
        for (const sub of subscribers) {
          const thumbUrl = `https://i.ytimg.com/vi/${latestId}/hqdefault.jpg`;
          const html = buildBrandEmailHtml({
            title: 'Nuevo Documental en YouTube',
            greetingName: sub.displayName || sub.username,
            bodyHtml: `
              <p style="margin:0 0 14px;">Acabamos de publicar un nuevo video en nuestro canal de YouTube:</p>
              <h3 style="color:#f5df98;font-size:19px;margin:0 0 14px;">«${latestTitle}»</h3>
              <a href="https://huellasdelahumanidad.com" target="_blank" style="text-decoration:none;">
                <img src="${thumbUrl}" alt="${latestTitle}" width="460" style="width:100%;max-width:460px;height:auto;border-radius:10px;border:1px solid #d4af37;display:block;margin:0 auto;" />
              </a>
            `,
            ctaText: 'Ver Video Ahora',
            ctaUrl: 'https://huellasdelahumanidad.com'
          });
          await sendEmailViaResend(sub.email, `Nuevo video: ${latestTitle} - Huellas de la Humanidad`, html);
        }
      }
    });
  }).on('error', () => {});
}
