export default async function run(page, ui) {
  const r = {};
  // Backend detection on served site
  r.backendDetected = await page.evaluate(async () => {
    if (window.NexoraAPI) await window.NexoraAPI.detect();
    return window.NexoraAPI ? window.NexoraAPI.isUp() : false;
  });
  // Register a fresh user via UI
  await page.goto('http://localhost:3000/qeydiyyat.html');
  await page.evaluate(async () => { if (window.NexoraAPI) await window.NexoraAPI.detect(); });
  await page.fill('#fullname', 'Elvin Məmmədov');
  await page.fill('#workemail', 'elvin@nexora.az');
  await page.fill('#regpassword', 'password123');
  await page.check('input[name="terms"]');
  await page.click('#registerForm button[type="submit"]');
  await page.waitForTimeout(1500);
  r.afterRegister = page.url();
  r.token = await page.evaluate(() => localStorage.getItem('nexora_token') ? 'saved' : 'missing');
  // Dashboard should show real user data
  await page.goto('http://localhost:3000/dashboard.html');
  await page.waitForTimeout(1200);
  r.dashboard = await page.evaluate(() => ({
    header: (document.querySelector('.dash-head h1') || {}).textContent,
    balance: document.getElementById('totalBalance').textContent,
    wallet: document.getElementById('walletBalance').textContent
  }));
  // Buy plan via modal
  await page.goto('http://localhost:3000/index.html');
  await page.waitForTimeout(600);
  await page.evaluate(async () => { if (window.NexoraAPI) await window.NexoraAPI.detect(); });
  await page.evaluate(() => document.querySelector('.price-card .btn').click());
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); } };
    set('cardNumInput', '4111111111111111');
    set('cardNameInput', 'ELVIN MAMMADOV');
    set('cardExpInput', '1230');
    set('cardCvvInput', '123');
  });
  await page.evaluate(() => document.getElementById('submitPayBtn').click());
  await page.waitForTimeout(2800);
  r.purchase = await page.evaluate(() => ({
    successShown: document.getElementById('payStatusSuccess').style.display,
    stored: !!localStorage.getItem('nexora_active_plan')
  }));
  // Check server side: /api/me with token from localStorage
  r.serverMe = await page.evaluate(async () => {
    const t = localStorage.getItem('nexora_token');
    if (!t) return 'no token';
    const res = await fetch('/api/me', { headers: { Authorization: 'Bearer ' + t } });
    const d = await res.json();
    return { balance: d.balance, purchases: d.purchases.length, withdrawals: d.withdrawals.length };
  });
  // Withdraw via dashboard
  await page.goto('http://localhost:3000/dashboard.html');
  await page.waitForTimeout(1200);
  await page.fill('#withdrawTarget', '4111 1111 1111 1111');
  await page.fill('#withdrawAmount', '2');
  await page.evaluate(() => document.getElementById('withdrawBtn').click());
  await page.waitForTimeout(1200);
  r.withdraw = await page.evaluate(() => ({
    msg: document.getElementById('withdrawMsg').textContent,
    wallet: document.getElementById('walletBalance').textContent
  }));
  return r;
}
