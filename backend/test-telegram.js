// Quick Telegram test: node test-telegram.js
const { sendTelegramMessage } = require('./telegram');

(async () => {
  const cfg = require('./config.json');
  if (cfg.TELEGRAM_BOT_TOKEN.startsWith('BURAYA') || cfg.TELEGRAM_CHAT_ID.startsWith('BURAYA')) {
    console.log('⚠ config.json-də bot token və chat ID doldurulmayıb.');
    console.log('  1) Telegram-da @BotFather açın → /newbot → token alın');
    console.log('  2) @userinfobot-a mesaj göndərin → chat ID alın');
    console.log('  3) config.json faylına yazın və yenidən işə salın');
    process.exit(0);
  }
  const ok = await sendTelegramMessage('✅ <b>Nexora</b> Telegram bağlantısı test edildi — uğurla işləyir!');
  console.log(ok ? '✅ Mesaj Telegram-a göndərildi!' : '❌ Göndərilmədi — token/ID-ni yoxlayın.');
})();
