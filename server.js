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
  }
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
    role: 'admin',
    createdAt: (db.users.raydeladmin && db.users.raydeladmin.createdAt) || new Date().toISOString()
  };
  delete db.users.admin;
  delete db.users.raydel;
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
            text: `¡Bienvenido, ${String(username).trim()}! Gracias por unirte a Huellas de la Humanidad. Escríbenos aquí cualquier mensaje, sugerencia o consulta y te responderemos directamente.`,
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
    const prevEmail = u.email;
    u.email = cleanEmail;
    u.notifyYoutube = cleanEmail ? Boolean(notifyYoutube) : false;

    saveDatabase();

    if (cleanEmail && u.notifyYoutube && cleanEmail !== prevEmail) {
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

function sendSubscriptionWelcomeEmail(toEmail, displayName) {
  const html = `
    <div style="background:#0c0a08;color:#f4ebd9;padding:28px;font-family:Georgia,serif;border:1px solid #d4af37;border-radius:12px;max-width:560px;margin:0 auto;">
      <h2 style="color:#d4af37;text-transform:uppercase;letter-spacing:2px;">Huellas de la Humanidad</h2>
      <p>Hola <strong>${displayName}</strong>,</p>
      <p>Tu correo electrónico ha quedado registrado exitosamente para recibir notificaciones automáticas cada vez que publiquemos un nuevo documental en nuestro canal de YouTube.</p>
      <p style="margin:24px 0;">
        <a href="https://huellasdelahumanidad.com" style="background:#d4af37;color:#0c0a08;padding:12px 22px;text-decoration:none;font-weight:bold;border-radius:8px;">Visitar Huellas de la Humanidad</a>
      </p>
      <p style="font-size:12px;color:#a09580;">«Cada historia deja una huella. Aquí seguimos sus rastros.»</p>
    </div>
  `;
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
          const html = `
            <div style="background:#0c0a08;color:#f4ebd9;padding:28px;font-family:Georgia,serif;border:1px solid #d4af37;border-radius:12px;max-width:560px;margin:0 auto;">
              <h2 style="color:#d4af37;text-transform:uppercase;letter-spacing:2px;">Huellas de la Humanidad</h2>
              <p>Hola <strong>${sub.displayName || sub.username}</strong>,</p>
              <p>Acabamos de publicar un nuevo documental en nuestro canal de YouTube:</p>
              <h3 style="color:#f5df98;">«${latestTitle}»</h3>
              <p style="margin:24px 0;">
                <a href="https://huellasdelahumanidad.com" style="background:#d4af37;color:#0c0a08;padding:12px 22px;text-decoration:none;font-weight:bold;border-radius:8px;">Ver Ahora en Huellas de la Humanidad</a>
              </p>
              <p style="font-size:12px;color:#a09580;">Cada historia deja una huella. Aquí seguimos sus rastros.</p>
            </div>
          `;
          await sendEmailViaResend(sub.email, `Nuevo video: ${latestTitle} - Huellas de la Humanidad`, html);
        }
      }
    });
  }).on('error', () => {});
}
