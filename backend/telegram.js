// Telegram notification helper
const https = require('https');
const crypto = require('crypto');
const config = require('./config.json');

function sendTelegramMessage(html, toChatId) {
  const token = process.env.TELEGRAM_BOT_TOKEN || config.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || config.TELEGRAM_CHAT_ID;
  const target = toChatId || chatId;
  if (!token || token.startsWith('BURAYA') || !target || String(target).startsWith('BURAYA')) {
    console.warn('[telegram] Token/chat ID konfiqurasiya edilməyib — mesaj göndərilmədi.');
    return Promise.resolve(false);
  }
  const payload = JSON.stringify({
    chat_id: target,
    text: html,
    parse_mode: 'HTML'
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 10000
    }, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        if (res.statusCode === 200) resolve(true);
        else {
          console.error('[telegram] Göndərilmədi:', res.statusCode, body.slice(0, 200));
          resolve(false);
        }
      });
    });
    req.on('error', (e) => { console.error('[telegram] Xəta:', e.message); resolve(false); });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.write(payload);
    req.end();
  });
}

function sendTelegramPhoto(photo, filename, mimeType, caption, toChatId) {
  const token = process.env.TELEGRAM_BOT_TOKEN || config.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || config.TELEGRAM_CHAT_ID;
  const target = toChatId || chatId;
  if (!token || token.startsWith('BURAYA') || !target || String(target).startsWith('BURAYA')) {
    console.warn('[telegram] Token/chat ID konfiqurasiya edilməyib — şəkil göndərilmədi.');
    return Promise.resolve(false);
  }

  const boundary = '----NexoraReceipt' + crypto.randomBytes(12).toString('hex');
  const fields = [
    ['chat_id', String(target)],
    ['caption', caption || 'Ödəniş qəbzi']
  ];
  const parts = fields.map(([name, value]) => Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
  ));
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
  ));
  parts.push(photo, Buffer.from(`\r\n--${boundary}--\r\n`));
  const body = Buffer.concat(parts);

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}/sendPhoto`,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length
      },
      timeout: 15000
    }, (res) => {
      let response = '';
      res.on('data', (chunk) => response += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(response);
          if (res.statusCode === 200 && result.ok === true) resolve(true);
          else {
            console.error('[telegram] Şəkil göndərilmədi:', res.statusCode, response.slice(0, 200));
            resolve(false);
          }
        } catch (e) {
          console.error('[telegram] Şəkil cavabı oxunmadı:', res.statusCode, response.slice(0, 200));
          resolve(false);
        }
      });
    });
    req.on('error', (error) => { console.error('[telegram] Şəkil göndərilmədi:', error.message); resolve(false); });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end(body);
  });
}

// ============================================================
// Bot polling: listens for user codes so they can connect
// their own Telegram account from the dashboard.
// ============================================================
let lastUpdateId = 0;

async function getUpdates() {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${config.TELEGRAM_BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=25`,
      method: 'GET',
      timeout: 30000
    }, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        try {
          const d = JSON.parse(body);
          if (d.ok && d.result) {
            d.result.forEach((u) => { lastUpdateId = Math.max(lastUpdateId, u.update_id); });
            resolve(d.result);
          } else resolve([]);
        } catch (e) { resolve([]); }
      });
    });
    req.on('error', () => resolve([]));
    req.on('timeout', () => { req.destroy(); resolve([]); });
    req.end();
  });
}

async function pollForCodes(onCode, onPaymentCommand) {
  if (!config.TELEGRAM_BOT_TOKEN || config.TELEGRAM_BOT_TOKEN.startsWith('BURAYA')) return;
  while (true) {
    try {
      const updates = await getUpdates();
      for (const u of updates) {
        const msg = u.message;
        if (!msg || !msg.text) continue;
        const chatId = String(msg.chat.id);
        const text = msg.text.trim();
        // Handle /start
        if (text === '/start') {
          sendTelegramMessage(
            '👋 <b>Nexora Bot-a xoş gəlmisiniz!</b>\n\n' +
            'Sizin chat ID: <code>' + chatId + '</code>\n\n' +
            '🔗 Hesabınızı bağlamaq üçün:\n' +
            '1. Dashboard-da "Telegram qoş" bölməsinə girin\n' +
            '2. Orada göstərilən 6 rəqəmli kodu buraya göndərin (məsələn: <code>NX123456</code>)\n\n' +
            'Kod 15 dəqiqə ərzində keçərlidir.',
            chatId
          );
          continue;
        }
        const paymentCommand = /^\/(approve|reject)(?:@\w+)?\s+(PAY-[A-F0-9]{10})$/i.exec(text);
        if (paymentCommand && onPaymentCommand) {
          onPaymentCommand(paymentCommand[1].toLowerCase(), paymentCommand[2].toUpperCase(), chatId);
          continue;
        }
        // Handle NX codes
        if (/^NX\d{6}$/.test(text)) {
          const code = text;
          onCode(code, chatId);
        } else {
          sendTelegramMessage('❓ Anlaşılmadı. Zəhmət olmasa dashboard-dan aldığınız kodu göndərin (format: NX123456).', chatId);
        }
      }
    } catch (e) { /* keep polling */ }
    await new Promise((r) => setTimeout(r, 500));
  }
}

module.exports = { sendTelegramMessage, sendTelegramPhoto, pollForCodes };
