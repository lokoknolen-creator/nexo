// ============================================================
// NEXORA — Frontend API helper
// Server (backend/server.js) işə düşəndə real bazadan istifadə edir,
// işləməyəndə localStorage-ə düşür (offline demo rejimi).
// ============================================================
(function () {
  'use strict';

  var API = {
    baseUrl: '',   // eyni domaində: backend eyni origin-dən servis ediləndə boş olur
    token: null
  };

  // Deploy konfiqurasiyası: Netlify-dən ayrı backendə qoşulmaq üçün
  // window.NEXORA_BACKEND_URL script-dən əvvəl təyin edilə bilər.
  try {
    var cfgUrl = (window.NEXORA_BACKEND_URL || '').trim();
    if (cfgUrl) API.baseUrl = cfgUrl.replace(/\/$/, '');
  } catch (e) {}

  try { API.token = localStorage.getItem('nexora_token'); } catch (e) {}

  function isBackendUp() { return window.NEXORA_BACKEND_UP === true; }

  async function apiFetch(path, options) {
    options = options || {};
    var headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    if (API.token) headers['Authorization'] = 'Bearer ' + API.token;
    var res = await fetch(API.baseUrl + path, {
      method: options.method || 'GET',
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    var data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      var err = new Error((data && data.error) || ('Xəta: ' + res.status));
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // Detect backend at startup (and on localhost:3000 for file:// usage)
  async function detectBackend() {
    var candidates = [];
    if (API.baseUrl) candidates.push(API.baseUrl);       // konfiqurasiya edilmiş backend
    if (location.protocol.startsWith('http')) candidates.push('');  // eyni origin
    candidates.push('http://localhost:3000');             // lokal inkişaf
    for (var i = 0; i < candidates.length; i++) {
      try {
        var r = await fetch(candidates[i] + '/api/health', { method: 'GET' });
        if (r.ok) {
          API.baseUrl = candidates[i];
          window.NEXORA_BACKEND_UP = true;
          console.log('[nexora] Backend tapıldı:', candidates[i] || location.origin);
          return true;
        }
      } catch (e) { /* skip */ }
    }
    window.NEXORA_BACKEND_UP = false;
    console.log('[nexora] Backend tapılmadı — offline demo rejimi (localStorage).');
    return false;
  }

  // ---------- PUBLIC API ----------
  window.NexoraAPI = {
    isUp: isBackendUp,
    detect: detectBackend,
    getToken: function () { return API.token; },
    setToken: function (t) {
      API.token = t;
      try {
        if (t) localStorage.setItem('nexora_token', t);
        else localStorage.removeItem('nexora_token');
      } catch (e) {}
    },

    register: async function (fullname, email, password, finCode, phone) {
      if (!isBackendUp()) throw new Error('offline');
      var d = await apiFetch('/api/register', { method: 'POST', body: { fullname, email, password, finCode, phone } });
      this.setToken(d.token);
      return d;
    },
    login: async function (email, password) {
      if (!isBackendUp()) throw new Error('offline');
      var d = await apiFetch('/api/login', { method: 'POST', body: { email, password } });
      this.setToken(d.token);
      return d;
    },
    logout: async function () {
      try {
        if (isBackendUp() && API.token) await apiFetch('/api/logout', { method: 'POST' });
      } catch (e) {}
      this.setToken(null);
    },
    me: async function () {
      if (!isBackendUp()) throw new Error('offline');
      return apiFetch('/api/me');
    },
    purchase: async function (plan) {
      if (!isBackendUp()) throw new Error('offline');
      return apiFetch('/api/purchase', { method: 'POST', body: { plan } });
    },
    paymentInfo: async function () {
      if (!isBackendUp()) throw new Error('offline');
      return apiFetch('/api/payment-info');
    },
    submitReceipt: async function (body) {
      if (!isBackendUp()) throw new Error('offline');
      return apiFetch('/api/payment/receipt', { method: 'POST', body: body });
    },
    withdraw: async function (amount, method, target) {
      if (!isBackendUp()) throw new Error('offline');
      return apiFetch('/api/withdraw', { method: 'POST', body: { amount, method, target } });
    },
    telegramStart: async function () {
      if (!isBackendUp()) throw new Error('offline');
      return apiFetch('/api/telegram/start');
    },
    telegramDisconnect: async function () {
      if (!isBackendUp()) throw new Error('offline');
      return apiFetch('/api/telegram/disconnect', { method: 'POST' });
    }
  };
})();
