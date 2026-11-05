// ============================================================
// NEXORA Backend — Express + SQLite + Telegram reports
// ============================================================
const express = require('express');
const cors = require('cors');
const Database = require('node:sqlite').DatabaseSync;
const crypto = require('crypto');
const path = require('path');
const { sendTelegramMessage, sendTelegramPhoto, pollForCodes } = require('./telegram');
const config = require('./config.json');
// Cloud deploy üçün env dəyişənləri config.json-ü üstələyir (Render/Railway)
if (process.env.TELEGRAM_BOT_TOKEN) config.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (process.env.TELEGRAM_CHAT_ID) config.TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
if (process.env.TELEGRAM_BOT_USERNAME) config.TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME;
const PAYMENT_CARD_NUMBER = String(process.env.PAYMENT_CARD_NUMBER || config.PAYMENT_CARD_NUMBER || '').replace(/\D/g, '');
const PAYMENT_CARDHOLDER = String(process.env.PAYMENT_CARDHOLDER || config.PAYMENT_CARDHOLDER || '').trim();
const PAYMENT_TEST_MODE = PAYMENT_CARD_NUMBER === '1234567812341234';

const app = express();
app.use(cors());
app.use(express.json({ limit: '8mb' }));

// Serve the static site from the parent directory
const SITE_ROOT = path.join(__dirname, '..');
app.use(express.static(SITE_ROOT));

// ---------- DATABASE ----------
const db = new Database(path.join(__dirname, 'nexora.db'));
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fullname TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  company TEXT,
  fin_code TEXT,
  telegram_username TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  plan_name TEXT NOT NULL,
  price REAL NOT NULL,
  daily REAL NOT NULL,
  txn_id TEXT UNIQUE NOT NULL,
  amount_paid REAL NOT NULL,
  payment_verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS withdrawals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  amount REAL NOT NULL,
  method TEXT NOT NULL,
  target TEXT NOT NULL,
  wd_id TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS payment_receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  plan_name TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  auto_approve_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS daily_earnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  earning_date TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  UNIQUE(purchase_id, earning_date)
);
`);

// Migration: add telegram column to existing DBs
try { db.exec("ALTER TABLE users ADD COLUMN telegram_username TEXT"); } catch (e) { /* already exists */ }
try { db.exec("ALTER TABLE users ADD COLUMN fin_code TEXT"); } catch (e) { /* already exists */ }
try { db.exec("ALTER TABLE users ADD COLUMN phone TEXT"); } catch (e) { /* already exists */ }
try { db.exec('ALTER TABLE purchases ADD COLUMN payment_verified INTEGER NOT NULL DEFAULT 0'); } catch (e) { /* already exists */ }
try { db.exec('ALTER TABLE payment_receipts ADD COLUMN auto_approve_at TEXT'); } catch (e) { /* already exists */ }
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_fin_code ON users(fin_code)');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone)');

const PLANS = {
  'Başlanğıc': { price: 13, daily: 2 },
  'Standart':  { price: 30, daily: 5 },
  'Biznes':    { price: 67, daily: 8 },
  'Premium':   { price: 96, daily: 12 }
};

// ---------- HELPERS ----------
function hashPassword(pw) {
  // PBKDF2 — köhnə sha256 hash-ləri avtomatik yenilənir (migrasiya login zamanı)
  return crypto.pbkdf2Sync(String(pw), 'nexora::' + String(pw).slice(0, 8), 120000, 32, 'sha256').toString('hex');
}
function legacyHashPassword(pw) {
  return crypto.createHash('sha256').update('nexora::' + pw).digest('hex');
}
function parseSqlDate(value) {
  if (!value) return null;
  var text = String(value).trim();
  if (!text) return null;
  var iso = text.includes('T') ? text : text.replace(' ', 'T');
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso)) iso += 'Z';
  var date = new Date(iso);
  return Number.isFinite(date.getTime()) ? date : null;
}
function bakuDate(date) {
  var parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Baku', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date).reduce(function (result, part) {
    result[part.type] = part.value;
    return result;
  }, {});
  return parts.year + '-' + parts.month + '-' + parts.day;
}
function normalizePhone(value) {
  var digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('994')) digits = digits.slice(3);
  else if (digits.length === 10 && digits.charAt(0) === '0') digits = digits.slice(1);
  if (digits.length !== 9) return '';
  return '+994 ' + digits.slice(0, 2) + ' ' + digits.slice(2, 5) + ' ' + digits.slice(5, 7) + ' ' + digits.slice(7, 9);
}
function getToken(req) {
  var h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : (req.query.token || '');
}
// telegram connect codes: userId -> { code, created }
const codes = new Map();
function authUser(req) {
  var t = getToken(req);
  if (!t) return null;
  var session = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(t);
  if (!session) return null;
  return db.prepare('SELECT id, fullname, email, phone, fin_code, telegram_username AS telegram_chat_id, created_at FROM users WHERE id = ?').get(session.user_id);
}

function accrueDailyEarnings(userId) {
  var purchases = db.prepare('SELECT id, daily, created_at FROM purchases WHERE user_id = ? AND payment_verified = 1').all(userId);
  var insertCredit = db.prepare('INSERT OR IGNORE INTO daily_earnings (purchase_id, user_id, earning_date, amount_cents) VALUES (?,?,?,?)');
  var today = bakuDate(new Date());
  purchases.forEach(function (purchase) {
    var purchasedAt = parseSqlDate(purchase.created_at);
    if (!purchasedAt) return;
    var latest = db.prepare('SELECT MAX(earning_date) AS day FROM daily_earnings WHERE purchase_id = ?').get(purchase.id).day;
    var day = new Date((latest || bakuDate(purchasedAt)) + 'T00:00:00Z');
    if (latest) day.setUTCDate(day.getUTCDate() + 1);
    var todayStart = new Date(today + 'T00:00:00Z');
    while (day <= todayStart) {
      insertCredit.run(purchase.id, userId, day.toISOString().slice(0, 10), Math.round(Number(purchase.daily) * 100));
      day.setUTCDate(day.getUTCDate() + 1);
    }
  });
  var result = db.prepare('SELECT COALESCE(SUM(amount_cents), 0) AS cents FROM daily_earnings WHERE user_id = ?').get(userId);
  return result.cents / 100;
}

function totalEarned(userId) {
  return accrueDailyEarnings(userId);
}
function totalWithdrawn(userId) {
  return db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM withdrawals WHERE user_id = ? AND status != 'rejected'").get(userId).s;
}

// ---------- AUTH ----------
app.post('/api/register', (req, res) => {
  var { fullname, email, password, finCode, phone } = req.body || {};
  if (!fullname || !email || !password || !finCode || !phone) return res.status(400).json({ error: 'Bütün sahələr tələb olunur.' });
  if (password.length < 6) return res.status(400).json({ error: 'Şifrə minimum 6 simvol olmalıdır.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'E-poçt formatı yanlışdır.' });
  phone = normalizePhone(phone);
  if (!/^\+994\s\d{2}\s\d{3}\s\d{2}\s\d{2}$/.test(phone)) return res.status(400).json({ error: 'Mobil nömrə formatı +994 xx xxx xx xx olmalıdır.' });
  finCode = String(finCode).trim().toUpperCase();
  if (!/^[A-Z0-9]{7}$/.test(finCode)) return res.status(400).json({ error: 'FIN kodu 7 hərf və ya rəqəmdən ibarət olmalıdır.' });
  try {
    var info = db.prepare('INSERT INTO users (fullname, email, phone, password_hash, fin_code) VALUES (?,?,?,?,?)')
      .run(fullname.trim(), email.trim().toLowerCase(), phone, hashPassword(password), finCode);
    var token = crypto.randomBytes(24).toString('hex');
    db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, info.lastInsertRowid);
    res.json({ ok: true, token, user: { id: info.lastInsertRowid, fullname: fullname.trim(), email: email.trim().toLowerCase(), phone } });
  } catch (e) {
    if (String(e.message).includes('users.email')) return res.status(409).json({ error: 'Bu e-poçt artıq qeydiyyatdan keçib.' });
    if (String(e.message).includes('users.phone')) return res.status(409).json({ error: 'Bu mobil nömrə artıq qeydiyyatdan keçib.' });
    if (String(e.message).includes('users.fin_code')) return res.status(409).json({ error: 'Bu FIN kodu artıq qeydiyyatdan keçib.' });
    res.status(500).json({ error: 'Qeydiyyat alınmadı.' });
  }
});

app.post('/api/login', (req, res) => {
  var { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'E-poçt və şifrə tələb olunur.' });
  var user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (user && user.password_hash && user.password_hash.length === 64 && user.password_hash === legacyHashPassword(password)) {
    // Köhnə sha256 → PBKDF2 migrasiyası
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), user.id);
    user.password_hash = hashPassword(password);
  }
  if (!user || user.password_hash !== hashPassword(password)) {
    return res.status(401).json({ error: 'E-poçt və ya şifrə yanlışdır.' });
  }
  var token = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);
  res.json({ ok: true, token, user: { id: user.id, fullname: user.fullname, email: user.email } });
});

app.post('/api/logout', (req, res) => {
  var token = getToken(req);
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.json({ ok: true });
});

// ---------- ME / WALLET ----------
app.get('/api/payment-info', (req, res) => {
  var configured = /^\d{13,19}$/.test(PAYMENT_CARD_NUMBER);
  res.json({
    configured,
    cardNumber: configured ? PAYMENT_CARD_NUMBER.replace(/(\d{4})(?=\d)/g, '$1 ') : '',
    cardHolder: configured ? PAYMENT_CARDHOLDER : '',
    testMode: configured && PAYMENT_TEST_MODE
  });
});

app.get('/api/me', (req, res) => {
  var user = authUser(req);
  if (!user) return res.status(401).json({ error: 'Avtorizasiya tələb olunur.' });
  var purchases = db.prepare('SELECT plan_name, price, daily, txn_id, amount_paid, created_at FROM purchases WHERE user_id = ? ORDER BY created_at DESC').all(user.id);
  var withdrawals = db.prepare('SELECT wd_id, amount, method, target, status, created_at FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC').all(user.id);
  var earned = totalEarned(user.id);
  var withdrawn = totalWithdrawn(user.id);
  res.json({
    user,
    purchases,
    withdrawals,
    balance: Math.max(0, earned - withdrawn),
    totalEarned: earned,
    totalWithdrawn: withdrawn
  });
});

// ---------- PURCHASE ----------
app.post('/api/purchase', (req, res) => {
  var user = authUser(req);
  if (!user) return res.status(401).json({ error: 'Avtorizasiya tələb olunur.' });
  res.status(409).json({ error: 'Paket yalnız ödəniş qəbzi göndərilib təsdiqləndikdən sonra aktivləşdirilir.' });
});

app.post('/api/payment/receipt', async (req, res) => {
  var user = authUser(req);
  if (!user) return res.status(401).json({ error: 'Avtorizasiya tələb olunur.' });
  if (!/^\d{13,19}$/.test(PAYMENT_CARD_NUMBER)) {
    return res.status(503).json({ error: 'Alıcı kartı hələ konfiqurasiya edilməyib.' });
  }

  var body = req.body || {};
  var plan = PLANS[body.plan];
  var amount = Number(body.amount);
  if (!plan || !Number.isFinite(amount) || amount <= 0 || amount > plan.price) {
    return res.status(400).json({ error: 'Paket və ya ödəniş məbləği yanlışdır.' });
  }

  var imageMatch = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.imageData || ''));
  if (!imageMatch) return res.status(400).json({ error: 'JPG, PNG və ya WebP qəbz şəkli tələb olunur.' });
  var imageType = imageMatch[1];
  var image = Buffer.from(imageMatch[2], 'base64');
  if (!image.length || image.length > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'Şəkil boşdur və ya 5 MB limitini keçir.' });
  }
  var validSignature = imageType === 'jpeg'
    ? image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff
    : imageType === 'png'
      ? image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      : image.subarray(0, 4).toString() === 'RIFF' && image.subarray(8, 12).toString() === 'WEBP';
  if (!validSignature) return res.status(400).json({ error: 'Faylın məzmunu şəkil formatına uyğun deyil.' });

  var requestId = 'PAY-' + crypto.randomBytes(5).toString('hex').toUpperCase();
  var autoApproveAt = PAYMENT_TEST_MODE ? new Date(Date.now() + 60 * 1000).toISOString() : null;
  db.prepare('INSERT INTO payment_receipts (request_id, user_id, plan_name, amount, auto_approve_at) VALUES (?,?,?,?,?)')
    .run(requestId, user.id, body.plan, amount, autoApproveAt);
  var caption = [
    (PAYMENT_TEST_MODE ? 'TEST QƏBZİ · ' : 'Ödəniş qəbzi · ') + requestId,
    'İstifadəçi: ' + user.fullname,
    'E-poçt: ' + user.email,
    'Paket: ' + body.plan,
    'Məbləğ: ' + amount.toFixed(2) + ' AZN',
    PAYMENT_TEST_MODE ? 'Test rejimi: 60 saniyəyə avtomatik təsdiqlənəcək' : 'Status: təsdiq gözləyir',
    'Əl ilə işlətmək: /approve ' + requestId + ' və ya /reject ' + requestId
  ].join('\n');
  var extension = imageType === 'jpeg' ? 'jpg' : imageType;
  var sent = await sendTelegramPhoto(image, 'receipt-' + requestId + '.' + extension, 'image/' + imageType, caption);
  if (!sent) {
    db.prepare("UPDATE payment_receipts SET status = 'delivery_failed' WHERE request_id = ?").run(requestId);
    return res.status(502).json({ error: 'Qəbz Telegram-a göndərilmədi. Yenidən cəhd edin.' });
  }
  res.json({ ok: true, requestId, status: 'pending', autoApproveInSeconds: PAYMENT_TEST_MODE ? 60 : null });
});

// ---------- WITHDRAW (with Telegram report) ----------
app.post('/api/withdraw', (req, res) => {
  var user = authUser(req);
  if (!user) return res.status(401).json({ error: 'Avtorizasiya tələb olunur.' });
  var { amount, method, target } = req.body || {};
  amount = parseFloat(amount);

  if (!target || !String(target).trim()) return res.status(400).json({ error: 'Çıxarış detallarını daxil edin.' });
  if (isNaN(amount) || amount < 1) return res.status(400).json({ error: 'Minimum çıxarış məbləği 1₼-dır.' });

  var balance = totalEarned(user.id) - totalWithdrawn(user.id);
  if (amount > balance) {
    return res.status(400).json({ error: 'Balansda kifayət qədər vəsait yoxdur. Əlçatan: ₼' + Math.max(0, balance).toFixed(2) });
  }

  var wdId;
  try {
    db.prepare("INSERT INTO withdrawals (user_id, amount, method, target, wd_id) VALUES (?,?,?,?,?)")
      .run(user.id, amount, method || 'card', String(target).trim(), (wdId = 'WD-' + crypto.randomBytes(3).toString('hex').toUpperCase()));
  } catch (e) {
    if (String(e.message).includes('withdrawals.wd_id')) {
      return res.status(409).json({ error: 'Təkrar sifariş IDsi yarandı, yenidən cəhd edin.' });
    }
    throw e;
  }

  var methodLabels = { card: 'Bank Kartı', m10: 'm10 / E-Wallet', crypto: 'USDT (TRC-20)' };

  // >>> TELEGRAM REPORT <<<
  sendTelegramMessage(
    '💸 <b>YENİ ÇIXARIŞ SORĞUSU</b>\n\n' +
    '👤 İstifadəçi: <b>' + user.fullname + '</b>\n' +
    '📧 E-poçt: ' + user.email + '\n' +
    '💰 Məbləğ: <b>₼' + amount.toFixed(2) + '</b>\n' +
    '🏦 Üsul: ' + (methodLabels[method] || method) + '\n' +
    '🎯 Detallar: <code>' + String(target).trim() + '</code>\n' +
    '🧾 Sifariş: <code>' + wdId + '</code>\n' +
    '🕒 ' + new Date().toLocaleString('az-AZ') + '\n\n' +
    '⚠️ Balansda qalan: ₼' + Math.max(0, balance - amount).toFixed(2)
  );

  // Şəxsi bildiriş: istifadəçinin öz Telegram-a da göndər
  var uRow = db.prepare('SELECT telegram_username FROM users WHERE id = ?').get(user.id);
  if (uRow && uRow.telegram_username) {
    sendTelegramMessage(
      '💸 <b>Çıxarış sorğunuz qəbul edildi</b>\n\n' +
      '🧾 Sifariş: <code>' + wdId + '</code>\n' +
      '💰 Məbləğ: ₼' + amount.toFixed(2) + '\n' +
      '🏦 ' + (methodLabels[method] || method) + ' · <code>' + String(target).trim() + '</code>\n\n' +
      '✅ 10 dəqiqə ərzində göndəriləcək.',
      uRow.telegram_username
    );
  }

  res.json({ ok: true, wdId, remaining: Math.max(0, balance - amount) });
});

// ---------- HEALTH ----------
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'nexora-backend', time: new Date().toISOString() }));

// ---------- TELEGRAM ACCOUNT CONNECTION ----------
// User connects their own TG: they get a one-time code, send it to our bot,
// bot replies confirming. Withdrawal confirmations also go to their chat.
app.get('/api/telegram/start', (req, res) => {
  var user = authUser(req);
  if (!user) return res.status(401).json({ error: 'Avtorizasiya tələb olunur.' });
  var code = 'NX' + crypto.randomBytes(3).toString('hex').toUpperCase().padStart(6, '0');
  codes.set(user.id, { code, created: Date.now() });
  res.json({ ok: true, code, botUsername: config.TELEGRAM_BOT_USERNAME || null });
});

app.post('/api/telegram/confirm', (req, res) => {
  var user = authUser(req);
  if (!user) return res.status(401).json({ error: 'Avtorizasiya tələb olunur.' });
  var { chatId } = req.body || {};
  var entry = codes.get(user.id);
  if (!entry || Date.now() - entry.created > 15 * 60 * 1000) {
    return res.status(400).json({ error: 'Kod müddəti bitib. Yeni kod alın.' });
  }
  if (!chatId) return res.status(400).json({ error: 'chatId tələb olunur.' });
  db.prepare('UPDATE users SET telegram_username = ? WHERE id = ?').run(String(chatId), user.id);
  codes.delete(user.id);
  sendTelegramMessage('🔗 <b>Telegram hesabı bağlandı!</b>\n\n👤 ' + user.fullname + ' (ID: ' + user.id + ') — çıxarış bildirişləri bu chat-ə göndəriləcək.', chatId);
  res.json({ ok: true, connected: chatId });
});

app.post('/api/telegram/disconnect', (req, res) => {
  var user = authUser(req);
  if (!user) return res.status(401).json({ error: 'Avtorizasiya tələb olunur.' });
  db.prepare('UPDATE users SET telegram_username = NULL WHERE id = ?').run(user.id);
  res.json({ ok: true });
});

// Bot polls for user codes → links their chat to their account
function handlePaymentCommand(action, requestId, chatId) {
  if (String(chatId) !== String(config.TELEGRAM_CHAT_ID)) {
    sendTelegramMessage('Bu əmri yerinə yetirmək icazəniz yoxdur.', chatId);
    return;
  }
  var receipt = db.prepare('SELECT * FROM payment_receipts WHERE request_id = ?').get(requestId);
  if (!receipt) {
    sendTelegramMessage('Qəbz sorğusu tapılmadı: ' + requestId, chatId);
    return;
  }
  if (receipt.status !== 'pending') {
    sendTelegramMessage(requestId + ' artıq işlənib. Status: ' + receipt.status, chatId);
    return;
  }

  var plan = PLANS[receipt.plan_name];
  if (action === 'approve' && !plan) {
    sendTelegramMessage('Paket məlumatı tapılmadı; təsdiq edilmədi.', chatId);
    return;
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    var status = action === 'approve' ? 'approved' : 'rejected';
    var result = db.prepare("UPDATE payment_receipts SET status = ? WHERE request_id = ? AND status = 'pending'")
      .run(status, requestId);
    if (result.changes !== 1) throw new Error('Qəbz sorğusu artıq işlənib.');
    if (action === 'approve') {
      db.prepare('INSERT INTO purchases (user_id, plan_name, price, daily, txn_id, amount_paid, payment_verified) VALUES (?,?,?,?,?,?,1)')
        .run(receipt.user_id, receipt.plan_name, plan.price, plan.daily, '#' + requestId, receipt.amount);
      totalEarned(receipt.user_id);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    sendTelegramMessage(error.message || 'Qəbz emal olunmadı.', chatId);
    return;
  }

  var message = action === 'approve'
    ? 'Təsdiqləndi: ' + requestId + '\nPaket: ' + receipt.plan_name + '\nGündəlik gəlir: ' + plan.daily.toFixed(2) + ' AZN. İlk kredit Bakı tarixinə uyğun hesablandı.'
    : 'Rədd edildi: ' + requestId + '. Paket aktivləşdirilmədi.';
  sendTelegramMessage(message, chatId);
}

function processTestAutoApprovals() {
  if (!PAYMENT_TEST_MODE) return;
  var due = db.prepare("SELECT request_id FROM payment_receipts WHERE status = 'pending' AND auto_approve_at <= ?")
    .all(new Date().toISOString());
  due.forEach(function (receipt) {
    handlePaymentCommand('approve', receipt.request_id, config.TELEGRAM_CHAT_ID);
  });
}

pollForCodes(function (code, chatId) {
  for (const [userId, entry] of codes.entries()) {
    if (entry.code === code) {
      if (Date.now() - entry.created > 15 * 60 * 1000) {
        sendTelegramMessage('⏰ Kodun müddəti bitib. Dashboard-da yeniləyin.', chatId);
        return;
      }
      db.prepare('UPDATE users SET telegram_username = ? WHERE id = ?').run(chatId, userId);
      codes.delete(userId);
      sendTelegramMessage('✅ <b>Hesabınız bağlandı!</b> Artıq çıxarış bildirişləri buraya gələcək.', chatId);
      return;
    }
  }
  sendTelegramMessage('❓ Bu kod tapılmadı və ya istifadə edilib. Dashboard-da yeni kod alın.', chatId);
}, handlePaymentCommand);

const PORT = process.env.PORT || 3000;

// ---------- 24/7 RESILIENCE ----------
// A stray unhandled error or rejected promise must never take the server down.
process.on('uncaughtException', function (error) {
  console.error('[fatal] uncaughtException — server qalır:', error);
});
process.on('unhandledRejection', function (reason) {
  console.error('[fatal] unhandledRejection — server qalır:', reason);
});

function accrueAllDailyEarnings() {
  db.prepare('SELECT DISTINCT user_id FROM purchases').all().forEach(function (row) {
    try { totalEarned(row.user_id); }
    catch (error) { console.error('[earnings] Gündəlik kredit yazılmadı:', error.message); }
  });
}
accrueAllDailyEarnings();
setInterval(function () { try { accrueAllDailyEarnings(); } catch (e) { console.error('[earnings] tick xətası:', e.message); } }, 60 * 1000);
setInterval(processTestAutoApprovals, 1000);
app.listen(PORT, () => {
  console.log('✅ Nexora backend işə düşdü: http://localhost:' + PORT);
  console.log('📊 Bazanın yerləşdiyi yer: backend/nexora.db');
  console.log('🤖 Telegram: config.json faylında token və chat ID doldurun.');
});
