// ============================================================
// NEXORA — Shared Scripts
// Header scroll · Mobile menu · Reveal animations · Counters
// ============================================================

(function () {
  'use strict';

  // ---------- HEADER SCROLL ----------
  var header = document.getElementById('header');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('scrolled', window.scrollY > 20);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ---------- MOBILE MENU ----------
  var menuBtn = document.getElementById('menuBtn');
  var mobileMenu = document.getElementById('mobileMenu');

  if (menuBtn && mobileMenu) {
    function setMenu(open) {
      menuBtn.classList.toggle('open', open);
      mobileMenu.classList.toggle('open', open);
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.style.overflow = open ? 'hidden' : '';
    }

    menuBtn.addEventListener('click', function () {
      setMenu(!mobileMenu.classList.contains('open'));
    });

    var menuLinks = mobileMenu.querySelectorAll('a');
    for (var i = 0; i < menuLinks.length; i++) {
      menuLinks[i].addEventListener('click', function () {
        setMenu(false);
      });
    }
  }

  // ---------- REVEAL ON SCROLL ----------
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length > 0) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    for (var r = 0; r < revealEls.length; r++) {
      observer.observe(revealEls[r]);
    }
  } else {
    for (var r2 = 0; r2 < revealEls.length; r2++) {
      revealEls[r2].classList.add('visible');
    }
  }

  // ---------- COUNTERS (animate numbers) ----------
  var counters = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window && counters.length > 0) {
    var counterObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;

        var el = entry.target;
        var target = parseInt(el.getAttribute('data-count'), 10);
        if (isNaN(target)) {
          counterObserver.unobserve(el);
          return;
        }
        var suffix = el.getAttribute('data-suffix') || '';
        var duration = 1600;
        var start = null;

        function format(n) {
          return n.toLocaleString('en-US');
        }

        function tick(now) {
          if (start === null) start = now;
          var progress = Math.min((now - start) / duration, 1);
          var eased = 1 - Math.pow(1 - progress, 3);
          el.textContent = format(Math.round(target * eased)) + suffix;
          if (progress < 1) {
            requestAnimationFrame(tick);
          }
        }

        requestAnimationFrame(tick);
        counterObserver.unobserve(el);
      });
    }, { threshold: 0.6 });

    for (var c = 0; c < counters.length; c++) {
      counterObserver.observe(counters[c]);
    }
  }

  // ---------- BLOG FILTER (search + tags) ----------
  var blogSearch = document.getElementById('blogSearch');
  var blogCards = document.querySelectorAll('.blog-card[data-category]');

  if (blogSearch && blogCards.length > 0) {
    var activeTag = null;

    function getText(parent, selector) {
      var el = parent.querySelector(selector);
      return el ? el.textContent : '';
    }

    function applyFilter() {
      var query = (blogSearch.value || '').toLowerCase().trim();

      blogCards.forEach(function (card) {
        var title = getText(card, 'h3');
        var excerpt = getText(card, '.excerpt');
        var category = card.getAttribute('data-category') || '';
        var matchesQuery = title.toLowerCase().indexOf(query) !== -1 ||
          excerpt.toLowerCase().indexOf(query) !== -1;
        var matchesTag = !activeTag || category === activeTag;
        card.style.display = matchesQuery && matchesTag ? '' : 'none';
      });
    }

    blogSearch.addEventListener('input', applyFilter);

    var blogTags = document.querySelectorAll('.blog-tag');
    for (var t = 0; t < blogTags.length; t++) {
      blogTags[t].addEventListener('click', function () {
        var tag = this.getAttribute('data-tag');
        if (activeTag === tag) {
          activeTag = null;
          this.classList.remove('active');
        } else {
          activeTag = tag;
          for (var x = 0; x < blogTags.length; x++) {
            blogTags[x].classList.remove('active');
          }
          this.classList.add('active');
        }
        applyFilter();
      });
    }
  }

  // ---------- FOOTER YEAR ----------
  var yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  // ---------- AUTH STATE (persist session until explicit logout) ----------
  function syncAuthNavState() {
    var api = window.NexoraAPI;
    var hasToken = !!(api && api.getToken && api.getToken());
    var navCtas = document.querySelectorAll('.nav-cta');

    navCtas.forEach(function (nav) {
      if (!nav) return;

      var loginLink = nav.querySelector('a[href="login.html"]');
      var panelLink = nav.querySelector('a[href="dashboard.html"]');
      if (hasToken) {
        if (!panelLink) {
          var newPanelLink = document.createElement('a');
          newPanelLink.href = 'dashboard.html';
          newPanelLink.className = 'btn btn-ghost';
          newPanelLink.textContent = 'Panelim';
          if (loginLink) loginLink.replaceWith(newPanelLink);
          else nav.insertBefore(newPanelLink, nav.firstChild);
        }

        var logoutBtn = nav.querySelector('[data-logout-btn]');
        if (!logoutBtn) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'btn btn-ghost';
          btn.textContent = 'Çıxış';
          btn.setAttribute('data-logout-btn', 'true');
          btn.style.marginLeft = '8px';
          btn.addEventListener('click', async function (event) {
            event.preventDefault();
            if (window.NexoraAPI && window.NexoraAPI.logout) await window.NexoraAPI.logout();
            window.location.href = 'index.html';
          });
          nav.appendChild(btn);
        }
      } else {
        if (panelLink) panelLink.remove();
        var logoutBtn = nav.querySelector('[data-logout-btn]');
        if (logoutBtn) logoutBtn.remove();
        if (!loginLink) {
          var newLoginLink = document.createElement('a');
          newLoginLink.href = 'login.html';
          newLoginLink.className = 'btn btn-ghost';
          newLoginLink.textContent = 'Daxil ol';
          nav.insertBefore(newLoginLink, nav.firstChild);
        }
      }
    });
  }

  syncAuthNavState();
  window.addEventListener('load', syncAuthNavState);
})();


// ============================================================
// PRO PAYMENT & CHECKOUT MODAL SYSTEM
// ============================================================
(function () {
  'use strict';

  // Backend aşkarlanması (varsa real bazadan istifadə)
  if (window.NexoraAPI && window.NexoraAPI.detect) window.NexoraAPI.detect();

  var NEXORA_PLANS = [
    { name: 'Başlanğıc', price: 13, daily: 2 },
    { name: 'Standart', price: 30, daily: 5 },
    { name: 'Biznes', price: 67, daily: 8 },
    { name: 'Premium', price: 96, daily: 12 }
  ];

  var state = {
    plan: { name: 'Standart', price: 30, daily: 5 },
    activeTab: 'card',
    discount: 0,
    promoCode: '',
    promoRate: 0,
    activeTxnId: null,
    paymentInfo: null
  };

  // Azerbaijani date formatting (avoids broken 'az-AZ' month tokens like "M10" in some engines)
  var AZ_MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun', 'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
  function formatAzDate(d) {
    return d.getDate() + ' ' + AZ_MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }

  function createPaymentModalHTML() {
    if (document.getElementById('payModalBackdrop')) return;

    var modalHTML = `
    <div class="pay-modal-backdrop" id="payModalBackdrop">
      <div class="pay-modal-container" role="dialog" aria-modal="true" aria-labelledby="payModalTitle">
        <!-- Header -->
        <div class="pay-modal-header">
          <h3 id="payModalTitle">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Təhlükəsiz Ödəniş
            <span class="pay-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              256-Bit SSL Şifrələnmə
            </span>
          </h3>
          <button class="pay-close-btn" id="payCloseBtn" aria-label="Bağla">&times;</button>
        </div>

        <!-- Body -->
        <div class="pay-modal-body" style="position: relative;">
          <!-- Left: Payment Form -->
          <div class="pay-main-content">
            <div id="payErrorBanner" class="pay-error-banner" style="display: none;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span id="payErrorText">Zəhmət olmasa daxil edilən məlumatları yoxlayın.</span>
            </div>

            <!-- Express Checkout -->
            <div class="express-pay-box">
              <button class="express-pay-btn" type="button" id="expressAppleBtn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.32c.63-.77 1.06-1.84.94-2.92-.91.04-2.03.61-2.68 1.37-.58.68-1.1 1.77-.96 2.83 1.02.08 2.07-.51 2.7-1.28z"/></svg>
                Apple Pay ilə ödə
              </button>
              <button class="express-pay-btn gpay" type="button" id="expressGPayBtn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.24 10.285V13.8h6.81c-.27 1.755-2.055 5.145-6.81 5.145-4.11 0-7.47-3.39-7.47-7.5s3.36-7.5 7.47-7.5c2.34 0 3.915.99 4.815 1.845l2.76-2.7C17.985 1.395 15.345 0 12.24 0 5.475 0 0 5.475 0 12.24S5.475 24.48 12.24 24.48c7.065 0 11.76-4.965 11.76-11.97 0-.81-.09-1.425-.21-2.225H12.24z"/></svg>
                GPay ilə ödə
              </button>
            </div>

            <!-- Payment Methods (professional selector) -->
            <div class="pay-methods">
              <button class="pay-method active" data-tab="card" type="button">
                <span class="pm-radio"></span>
                <span class="pm-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                </span>
                <span class="pm-text">
                  <span class="pm-name">Bank Kartı</span>
                  <span class="pm-sub">VISA · Mastercard · Maestro</span>
                </span>
                <span class="pm-brand">3D&nbsp;Secure</span>
              </button>
              <button class="pay-method" data-tab="m10" type="button">
                <span class="pm-radio"></span>
                <span class="pm-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                </span>
                <span class="pm-text">
                  <span class="pm-name">m10 · E-Wallet</span>
                  <span class="pm-sub">Balans transfer · Ani təsdiq</span>
                </span>
                <span class="pm-brand">m10</span>
              </button>
              <button class="pay-method" data-tab="crypto" type="button">
                <span class="pm-radio"></span>
                <span class="pm-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                </span>
                <span class="pm-text">
                  <span class="pm-name">Crypto (USDT)</span>
                  <span class="pm-sub">TRC-20 · Şəbəkə təsdiqi ilə</span>
                </span>
                <span class="pm-brand">USDT</span>
              </button>
            </div>

            <!-- Trust strip -->
            <div class="pay-trust-strip">
              <span>
                <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                256-Bit SSL
              </span>
              <span>
                <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                PCI DSS Uyğun
              </span>
              <span>
                <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                3D Secure qorunması
              </span>
              <span>
                <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                Məlumatlar saxlanılmır
              </span>
            </div>

            <!-- TAB 1: Bank Card -->
            <div id="tabContentCard" class="pay-tab-panel">
              <!-- Live Card Visual -->
              <div class="virtual-card-wrapper">
                <div class="virtual-card" id="virtualCard">
                  <div class="card-front">
                    <div class="card-top">
                      <div class="card-chip"></div>
                      <div class="card-brand-logo" id="cardBrandLogo">VISA</div>
                    </div>
                    <div class="card-number-display" id="cardNumberDisplay">•••• •••• •••• ••••</div>
                    <div class="card-bottom">
                      <div>
                        <div class="card-label">KART SAHİBİ</div>
                        <div class="card-val" id="cardHolderDisplay">AD SOYAD</div>
                      </div>
                      <div>
                        <div class="card-label">BİTMƏ TARİXİ</div>
                        <div class="card-val" id="cardExpDisplay">MM/YY</div>
                      </div>
                    </div>
                  </div>
                  <div class="card-back">
                    <div class="card-stripe"></div>
                    <div style="padding: 0 22px;">
                      <div class="card-label">CVV / CVC</div>
                      <div class="card-cvv-box" id="cardCvvDisplay">•••</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Card Inputs -->
              <form id="cardPayForm" onsubmit="return false;" novalidate>
                <div class="pay-form-grid full" style="margin-bottom: 12px;">
                  <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label">Kart nömrəsi</label>
                    <input type="text" id="cardNumInput" class="form-input" placeholder="0000 0000 0000 0000" maxlength="19" autocomplete="cc-number">
                    <div class="form-input-error" id="errCardNum">Düzgün 16 rəqəmli kart nömrəsi daxil edin</div>
                  </div>
                </div>
                <div class="pay-form-grid full" style="margin-bottom: 12px;">
                  <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label">Kart sahibinin adı və soyadı</label>
                    <input type="text" id="cardNameInput" class="form-input" placeholder="ELVIN MAMMADOV" autocomplete="cc-name">
                    <div class="form-input-error" id="errCardName">Kart üzərindəki ad və soyadı daxil edin</div>
                  </div>
                </div>
                <div class="pay-form-grid">
                  <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label">Bitmə tarixi</label>
                    <input type="text" id="cardExpInput" class="form-input" placeholder="MM/YY" maxlength="5" autocomplete="cc-exp">
                    <div class="form-input-error" id="errCardExp">Düzgün tarix (MM/YY) daxil edin</div>
                  </div>
                  <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label">CVV / CVC</label>
                    <input type="password" id="cardCvvInput" class="form-input" placeholder="123" maxlength="4" autocomplete="cc-csc">
                    <div class="form-input-error" id="errCardCvv">3 və ya 4 rəqəmli CVV daxil edin</div>
                  </div>
                </div>
              </form>
            </div>

            <!-- TAB 2: m10 / E-Wallet -->
            <div id="tabContentM10" class="pay-tab-panel" style="display: none;">
              <div class="qr-container">
                <div style="font-weight: 600; font-size: 15px; color: #fff;">m10 / E-Wallet ilə ödəniş</div>
                <p style="font-size: 13px; color: var(--text-dim);">Aşağıdakı m10 nömrəsinə məbləği köçürün və göndərən nömrənizi daxil edin:</p>
                <div class="qr-code-img">
                  <svg viewBox="0 0 100 100" width="120" height="120">
                    <path d="M0,0 h30 v30 h-30 z M40,0 h20 v10 h-20 z M70,0 h30 v30 h-30 z M10,10 h10 v10 h-10 z M80,10 h10 v10 h-10 z M0,40 h10 v20 h-10 z M20,40 h30 v10 h-30 z M60,40 h40 v10 h-40 z M0,70 h30 v30 h-30 z M10,80 h10 v10 h-10 z M40,70 h20 v20 h-20 z M70,70 h20 v10 h-20 z M90,80 h10 v20 h-10 z" fill="#000"/>
                  </svg>
                </div>
                <div class="crypto-copy-box">
                  <span>+994 50 888 12 34</span>
                  <button class="crypto-copy-btn" id="copyM10Btn" type="button">Kopyala</button>
                </div>
                <div class="form-group" style="width: 100%; margin-top: 10px; text-align: left;">
                  <label class="form-label">Göndərən m10 / Telefon Nömrəniz</label>
                  <input type="text" id="m10PhoneInput" class="form-input" placeholder="+994 50 123 45 67">
                  <div class="form-input-error" id="errM10Phone">Ödəniş etdiyiniz nömrəni daxil edin</div>
                </div>
              </div>
            </div>

            <!-- TAB 3: Crypto -->
            <div id="tabContentCrypto" class="pay-tab-panel" style="display: none;">
              <div class="qr-container">
                <div style="font-weight: 600; font-size: 15px; color: #fff;">USDT (TRC-20) ilə Ödəniş</div>
                <p style="font-size: 13px; color: var(--text-dim);">Aşağıdakı TRC-20 cüzdan ünvanına dəqiq məbləği göndərin:</p>
                <div class="crypto-copy-box">
                  <span style="overflow: hidden; text-overflow: ellipsis;" id="cryptoAddressSpan">TY83kxP92sLnQ7z2mBx9K2vW4R1a</span>
                  <button class="crypto-copy-btn" id="copyCryptoBtn" type="button">Kopyala</button>
                </div>
                <div style="font-size: 12px; color: var(--accent); margin-top: 2px;">⚡ Şəbəkə təsdiqindən sonra avtomatik aktivləşəcək</div>
                <div class="form-group" style="width: 100%; margin-top: 10px; text-align: left;">
                  <label class="form-label">TRC-20 Cüzdan Ünvanınız və ya TxHash (Tranzaksiya ID)</label>
                  <input type="text" id="cryptoTxnInput" class="form-input" placeholder="T..." maxlength="64">
                  <div class="form-input-error" id="errCryptoTxn">Cüzdan ünvanı və ya TxHash daxil edin</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right: Order Summary -->
          <div class="pay-sidebar">
            <div class="order-summary-box">
              <h4>Sifariş Xülasəsi</h4>

              <!-- Package Picker Chips -->
              <div>
                <div class="plan-picker-title">Paket Seçimi</div>
                <div class="plan-picker-grid" id="planPickerGrid">
                  <!-- Dynamically rendered -->
                </div>
              </div>

              <div class="plan-summary-card">
                <div>
                  <div class="name" id="summaryPlanName">Standart</div>
                  <div class="sub" id="summaryDailyIncome">+₼5 / gün gəlir</div>
                </div>
                <div class="price-tag" id="summaryBasePrice">₼30</div>
              </div>

              <!-- Promo Code -->
              <div>
                <label class="form-label" style="font-size: 12.5px;">PROMO KOD / ENDİRİM KUPONU</label>
                <div class="promo-box">
                  <input type="text" id="promoInput" class="form-input promo-input" placeholder="Məs: PRO10" style="text-transform: uppercase;">
                  <button class="btn btn-ghost promo-btn" id="applyPromoBtn" type="button">Tətbiq et</button>
                </div>
                <div id="promoMsg" style="font-size: 12px; margin-top: 5px; display: none;"></div>
              </div>

              <div class="summary-details">
                <div class="summary-row">
                  <span>Paket qiyməti</span>
                  <span id="summaryPriceText">₼30.00</span>
                </div>
                <div class="summary-row" id="discountRow" style="display: none; color: var(--accent);">
                  <span>Kupon endirimi</span>
                  <span id="discountText">-₼0.00</span>
                </div>
                <div class="summary-row">
                  <span>Komissiya</span>
                  <span style="color: var(--accent);">0.00₼ (Pulsuz)</span>
                </div>
                <div class="summary-row total">
                  <span>Yekun ödəniləcək:</span>
                  <span class="amount" id="summaryFinalTotal">₼30.00</span>
                </div>
              </div>
            </div>

            <div>
              <button class="btn btn-primary btn-block btn-lg" id="submitPayBtn" type="button" disabled>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Qəbzi göndər
              </button>

              <div class="pay-guarantees" style="margin-top: 16px;">
                <div class="guarantee-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>
                  <span>Gündəlik avtomatik gəlir yüklənməsi</span>
                </div>
                <div class="guarantee-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>
                  <span>İstənilən an balansı karta çıxarış</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Status / Success Overlay -->
          <div class="pay-status-overlay" id="payStatusOverlay">
            <div id="payStatusLoading">
              <div class="pay-spinner"></div>
              <h3 style="font-size: 22px; margin-bottom: 8px;" id="statusLoadingTitle">Ödəniş icra olunur...</h3>
              <p style="color: var(--text-dim); font-size: 14.5px;" id="statusLoadingSub">Bankla təhlükəsiz 3D-Secure əlaqəsi yaradılır</p>
            </div>

            <div id="payStatusSuccess" style="display: none; flex-direction: column; align-items: center;">
              <div class="pay-success-icon">✓</div>
              <h3 style="font-size: 26px; margin-bottom: 8px; color: #fff;">Ödəniş Uğurla Tamamlandı!</h3>
              <p style="color: var(--text-dim); font-size: 15px; max-width: 440px; margin-bottom: 24px;">
                Təbriklər! <strong id="successPlanName" style="color: var(--accent);">Standart</strong> paketiniz aktivləşdirildi. Gündəlik gəliriniz balansınıza yüklənəcək.
              </p>
              <div style="background: var(--card); border: 1px solid var(--border); padding: 18px 24px; border-radius: 14px; margin-bottom: 24px; text-align: left; width: 100%; max-width: 400px;">
                <div class="summary-row" style="margin-bottom: 8px;"><span>Tranzaksiya ID:</span><strong style="color: #fff;" id="successTxnId">#NX-892104</strong></div>
                <div class="summary-row" style="margin-bottom: 8px;"><span>Aktivləşmə tarixi:</span><strong style="color: #fff;" id="successTxnDate">Bu gün</strong></div>
                <div class="summary-row" style="margin-bottom: 8px;"><span>Ödənilən məbləğ:</span><strong style="color: #fff;" id="successTxnAmount">30.00₼</strong></div>
                <div class="summary-row"><span>Gündəlik qazanc:</span><strong style="color: var(--accent);" id="successDailyRate">+₼5 / gün</strong></div>
              </div>
              <div style="display: flex; gap: 12px; width: 100%; max-width: 400px;">
                <button type="button" class="btn btn-ghost" id="printReceiptBtn" style="flex: 1;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                  Qəbzi Çap Et
                </button>
                <a href="dashboard.html" class="btn btn-primary" style="flex: 1;">Kabinetə Keç</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    var paymentContent = document.querySelector('#payModalBackdrop .pay-main-content');
    if (paymentContent) {
      paymentContent.innerHTML = `
        <div id="payErrorBanner" class="pay-error-banner" style="display:none;">
          <span id="payErrorText">Zəhmət olmasa daxil edilən məlumatları yoxlayın.</span>
        </div>
        <section class="transfer-instructions" aria-labelledby="transferTitle">
          <h4 id="transferTitle">Bank kartına köçürmə</h4>
          <p>Göstərilən məbləği karta köçürün, sonra ödəniş qəbzinin şəklini yükləyin.</p>
          <div class="crypto-copy-box">
            <span id="paymentCardDetails">Kart rekvizitləri yüklənir...</span>
            <button class="crypto-copy-btn" id="copyPaymentCardBtn" type="button" disabled>Kopyala</button>
          </div>
          <div id="paymentCardHolder" class="transfer-card-holder"></div>
          <div id="paymentConfigMessage" class="withdraw-hint" role="status"></div>
          <div class="form-group" style="margin-top:18px;">
            <label class="form-label" for="paymentReceipt">Ödəniş qəbzi (JPG, PNG və ya WebP)</label>
            <input class="form-input" type="file" id="paymentReceipt" accept="image/jpeg,image/png,image/webp">
            <div id="receiptFileName" class="withdraw-hint" aria-live="polite">Maksimum fayl ölçüsü: 5 MB</div>
            <img id="receiptPreview" alt="Yüklənəcək qəbzin önbaxışı" style="display:none; max-width:100%; max-height:220px; margin-top:12px; border-radius:8px;">
          </div>
        </section>`;
    }
    renderPlanPicker();
    bindModalEvents();
    loadPaymentInfo();
  }

  async function loadPaymentInfo() {
    var api = window.NexoraAPI;
    var cardDetails = document.getElementById('paymentCardDetails');
    var cardHolder = document.getElementById('paymentCardHolder');
    var message = document.getElementById('paymentConfigMessage');
    var copyButton = document.getElementById('copyPaymentCardBtn');
    try {
      if (!api) throw new Error('Server bağlantısı yoxdur.');
      if (!api.isUp()) await api.detect();
      if (!api.isUp()) throw new Error('Ödəniş məlumatı üçün server əlçatan deyil.');
      state.paymentInfo = await api.paymentInfo();
      if (!state.paymentInfo.configured) throw new Error('Kart rekvizitləri hələ administrator tərəfindən əlavə edilməyib.');
      if (cardDetails) cardDetails.textContent = state.paymentInfo.cardNumber;
      if (cardHolder) cardHolder.textContent = state.paymentInfo.cardHolder ? 'Kart sahibi: ' + state.paymentInfo.cardHolder : '';
      if (message) message.textContent = state.paymentInfo.testMode
        ? 'TEST / NÜMUNƏ KARTIDIR. Bu nömrəyə real ödəniş etməyin.'
        : 'Köçürməni etdikdən sonra qəbz şəklini yükləyin.';
      if (copyButton) copyButton.disabled = false;
      updateReceiptSubmitState();
    } catch (error) {
      state.paymentInfo = null;
      if (cardDetails) cardDetails.textContent = 'Kart rekvizitləri mövcud deyil';
      if (message) message.textContent = error.message || 'Ödəniş məlumatı yüklənmədi.';
      if (copyButton) copyButton.disabled = true;
      updateReceiptSubmitState();
    }
  }

  function updateReceiptSubmitState() {
    var button = document.getElementById('submitPayBtn');
    var fileInput = document.getElementById('paymentReceipt');
    if (button) button.disabled = !state.paymentInfo || !state.paymentInfo.configured || !fileInput || !fileInput.files.length;
  }

  function renderPlanPicker() {
    var grid = document.getElementById('planPickerGrid');
    if (!grid) return;
    grid.innerHTML = '';

    NEXORA_PLANS.forEach(function (p) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'plan-chip-btn' + (p.name.toLowerCase() === state.plan.name.toLowerCase() ? ' active' : '');
      btn.innerHTML = `<span class="chip-name">${p.name}</span><span class="chip-price">₼${p.price} (+₼${p.daily}/gün)</span>`;
      btn.addEventListener('click', function () {
        state.plan = { name: p.name, price: p.price, daily: p.daily };
        renderPlanPicker();
        updateModalSummary();
      });
      grid.appendChild(btn);
    });
  }

  function updateModalSummary() {
    var base = state.plan.price;
    state.discount = base * state.promoRate;
    var finalPrice = Math.max(0, base - state.discount);

    var summaryPlanName = document.getElementById('summaryPlanName');
    var summaryDailyIncome = document.getElementById('summaryDailyIncome');
    var summaryBasePrice = document.getElementById('summaryBasePrice');
    var summaryPriceText = document.getElementById('summaryPriceText');
    var discountRow = document.getElementById('discountRow');
    var discountText = document.getElementById('discountText');
    var summaryFinalTotal = document.getElementById('summaryFinalTotal');

    if (summaryPlanName) summaryPlanName.textContent = state.plan.name;
    if (summaryDailyIncome) summaryDailyIncome.textContent = '+' + state.plan.daily + '₼ / gün gəlir';
    if (summaryBasePrice) summaryBasePrice.textContent = '₼' + base;
    if (summaryPriceText) summaryPriceText.textContent = '₼' + base.toFixed(2);

    if (state.discount > 0) {
      if (discountRow) discountRow.style.display = 'flex';
      if (discountText) discountText.textContent = '-₼' + state.discount.toFixed(2);
    } else {
      if (discountRow) discountRow.style.display = 'none';
    }

    if (summaryFinalTotal) summaryFinalTotal.textContent = '₼' + finalPrice.toFixed(2);
  }

  function hideErrors() {
    var banner = document.getElementById('payErrorBanner');
    if (banner) banner.style.display = 'none';
    var errEls = document.querySelectorAll('.form-input-error');
    errEls.forEach(function (el) { el.classList.remove('visible'); });
    var inputEls = document.querySelectorAll('.form-input');
    inputEls.forEach(function (el) { el.classList.remove('is-invalid'); });
  }

  function showError(inputEl, errElId, msg) {
    if (inputEl) inputEl.classList.add('is-invalid');
    var errEl = document.getElementById(errElId);
    if (errEl) {
      if (msg) errEl.textContent = msg;
      errEl.classList.add('visible');
    }
  }

  function validateCheckout() {
    hideErrors();
    var fileInput = document.getElementById('paymentReceipt');
    var file = fileInput && fileInput.files[0];
    var error = !state.paymentInfo || !state.paymentInfo.configured
      ? 'Kart rekvizitləri konfiqurasiya edilməyib.'
      : !file
        ? 'Davam etmək üçün ödəniş qəbzinin şəklini yükləyin.'
        : file.size > 5 * 1024 * 1024
          ? 'Qəbz şəkli 5 MB-dan kiçik olmalıdır.'
          : !/^image\/(jpeg|png|webp)$/.test(file.type)
            ? 'Yalnız JPG, PNG və ya WebP şəkli qəbul edilir.'
            : '';
    if (error) {
      var banner = document.getElementById('payErrorBanner');
      var errorText = document.getElementById('payErrorText');
      if (errorText) errorText.textContent = error;
      if (banner) banner.style.display = 'flex';
      if (fileInput) fileInput.focus();
      return false;
    }
    return true;
  }

  async function executePayment() {
    if (!validateCheckout()) return;

    var payStatusOverlay = document.getElementById('payStatusOverlay');
    var payStatusLoading = document.getElementById('payStatusLoading');
    var payStatusSuccess = document.getElementById('payStatusSuccess');
    var title = document.getElementById('statusLoadingTitle');
    var sub = document.getElementById('statusLoadingSub');

    if (payStatusOverlay) payStatusOverlay.classList.add('active');
    if (payStatusLoading) payStatusLoading.style.display = 'flex';
    if (payStatusSuccess) payStatusSuccess.style.display = 'none';

    if (title) title.textContent = 'Qəbz göndərilir...';
    if (sub) sub.textContent = 'Şəkil yoxlama üçün Telegram-a ötürülür';

    var submitButton = document.getElementById('submitPayBtn');
    if (submitButton) submitButton.disabled = true;
    try {
      var api = window.NexoraAPI;
      if (!api) throw new Error('Server bağlantısı tapılmadı.');
      if (!api.isUp()) await api.detect();
      if (!api.isUp()) throw new Error('Qəbzi göndərmək üçün server əlçatan deyil.');
      if (!api.getToken()) {
        localStorage.setItem('nexora_pending_purchase', JSON.stringify(state.plan));
        window.location.href = 'login.html';
        return;
      }
      var file = document.getElementById('paymentReceipt').files[0];
      var imageData = await new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () { resolve(reader.result); };
        reader.onerror = function () { reject(new Error('Qəbz faylı oxunmadı.')); };
        reader.readAsDataURL(file);
      });
      var result = await api.submitReceipt({
        plan: state.plan.name,
        amount: Math.max(0, state.plan.price - state.discount),
        imageData: imageData
      });
      state.activeTxnId = result.requestId;
      if (payStatusLoading) payStatusLoading.style.display = 'none';
      if (payStatusSuccess) payStatusSuccess.style.display = 'flex';
      var successTitle = document.querySelector('#payStatusSuccess h3');
      var successCopy = document.querySelector('#payStatusSuccess p');
      var successPlanName = document.getElementById('successPlanName');
      var successDailyRate = document.getElementById('successDailyRate');
      var successTxnId = document.getElementById('successTxnId');
      var successTxnDate = document.getElementById('successTxnDate');
      var successTxnAmount = document.getElementById('successTxnAmount');
      if (result.autoApproveInSeconds) {
        if (successTitle) successTitle.textContent = 'Test qəbzi qəbul edildi';
        if (successCopy) successCopy.textContent = 'Test rejimində paket 60 saniyə sonra avtomatik aktivləşəcək.';
      } else {
        if (successTitle) successTitle.textContent = 'Qəbz yoxlamaya göndərildi';
        if (successCopy) successCopy.textContent = 'Ödəniş təsdiqlənəndən sonra paket aktivləşdiriləcək.';
      }
      if (successPlanName) successPlanName.textContent = state.plan.name;
      if (successDailyRate) successDailyRate.textContent = '+' + state.plan.daily + '₼ / gün';
      if (successTxnId) successTxnId.textContent = result.requestId;
      if (successTxnDate) successTxnDate.textContent = formatAzDate(new Date());
      if (successTxnAmount) successTxnAmount.textContent = '₼' + Math.max(0, state.plan.price - state.discount).toFixed(2);
    } catch (err) {
      if (payStatusOverlay) payStatusOverlay.classList.remove('active');
      var errorBanner = document.getElementById('payErrorBanner');
      var errorText = document.getElementById('payErrorText');
      if (err.status === 401 && window.NexoraAPI) {
        window.NexoraAPI.setToken(null);
        if (errorText) errorText.textContent = 'Sessiya bitib. Yenidən daxil olun, sonra qəbzi seçib göndərin.';
      } else if (errorText) {
        errorText.textContent = err.message || 'Qəbz göndərilmədi. Yenidən cəhd edin.';
      }
      if (errorBanner) errorBanner.style.display = 'flex';
    } finally {
      updateReceiptSubmitState();
    }
  }

  function bindModalEvents() {
    var backdrop = document.getElementById('payModalBackdrop');
    var closeBtn = document.getElementById('payCloseBtn');

    if (closeBtn) closeBtn.addEventListener('click', closePaymentModal);
    if (backdrop) {
      backdrop.addEventListener('click', function (e) {
        if (e.target === backdrop) closePaymentModal();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && backdrop && backdrop.classList.contains('active')) {
        closePaymentModal();
      }
    });

    var copyPaymentCardBtn = document.getElementById('copyPaymentCardBtn');
    if (copyPaymentCardBtn) {
      copyPaymentCardBtn.addEventListener('click', async function () {
        try {
          await navigator.clipboard.writeText(state.paymentInfo.cardNumber);
          copyPaymentCardBtn.textContent = 'Kopyalandı';
          setTimeout(function () { copyPaymentCardBtn.textContent = 'Kopyala'; }, 1800);
        } catch (error) {
          var message = document.getElementById('paymentConfigMessage');
          if (message) message.textContent = 'Kart nömrəsini əl ilə seçib kopyalayın.';
        }
      });
    }

    var receiptInput = document.getElementById('paymentReceipt');
    if (receiptInput) {
      receiptInput.addEventListener('change', function () {
        var file = this.files[0];
        var fileName = document.getElementById('receiptFileName');
        var preview = document.getElementById('receiptPreview');
        if (fileName) fileName.textContent = file ? file.name + ' · ' + (file.size / 1024 / 1024).toFixed(2) + ' MB' : 'Maksimum fayl ölçüsü: 5 MB';
        if (preview) {
          preview.style.display = file && /^image\/(jpeg|png|webp)$/.test(file.type) ? 'block' : 'none';
          if (preview.style.display === 'block') preview.src = URL.createObjectURL(file);
        }
        updateReceiptSubmitState();
      });
    }

    // Payment Method Selector
    var methods = document.querySelectorAll('.pay-method');
    methods.forEach(function (method) {
      method.addEventListener('click', function () {
        methods.forEach(function (m) { m.classList.remove('active'); });
        this.classList.add('active');

        state.activeTab = this.getAttribute('data-tab');
        hideErrors();

        document.getElementById('tabContentCard').style.display = state.activeTab === 'card' ? 'block' : 'none';
        document.getElementById('tabContentM10').style.display = state.activeTab === 'm10' ? 'block' : 'none';
        document.getElementById('tabContentCrypto').style.display = state.activeTab === 'crypto' ? 'block' : 'none';
      });
    });

    // Card Input Syncing & Formatting
    var cardNumInput = document.getElementById('cardNumInput');
    var cardNameInput = document.getElementById('cardNameInput');
    var cardExpInput = document.getElementById('cardExpInput');
    var cardCvvInput = document.getElementById('cardCvvInput');
    var virtualCard = document.getElementById('virtualCard');

    if (cardNumInput) {
      cardNumInput.addEventListener('input', function () {
        var raw = this.value.replace(/\D/g, '').substring(0, 16);
        var formatted = raw.replace(/(.{4})/g, '$1 ').trim();
        this.value = formatted;

        var display = document.getElementById('cardNumberDisplay');
        if (display) display.textContent = formatted || '•••• •••• •••• ••••';

        var logo = document.getElementById('cardBrandLogo');
        if (logo) {
          if (raw.startsWith('4')) logo.textContent = 'VISA';
          else if (/^(5[1-5]|2[2-7])/.test(raw)) logo.textContent = 'MASTER';
          else if (/^3[47]/.test(raw)) logo.textContent = 'AMEX';
          else if (/^(50|5[6-8]|6)/.test(raw)) logo.textContent = 'MAESTRO';
          else logo.textContent = 'CARD';
        }
      });
    }

    if (cardNameInput) {
      cardNameInput.addEventListener('input', function () {
        this.value = this.value.toUpperCase();
        var display = document.getElementById('cardHolderDisplay');
        if (display) display.textContent = this.value || 'AD SOYAD';
      });
    }

    if (cardExpInput) {
      cardExpInput.addEventListener('input', function (e) {
        var raw = this.value.replace(/\D/g, '').substring(0, 4);
        if (raw.length >= 3) {
          this.value = raw.substring(0, 2) + '/' + raw.substring(2);
        } else if (raw.length === 2 && e.inputType !== 'deleteContentBackward') {
          this.value = raw + '/';
        } else {
          this.value = raw;
        }

        var display = document.getElementById('cardExpDisplay');
        if (display) display.textContent = this.value || 'MM/YY';
      });
    }

    if (cardCvvInput) {
      cardCvvInput.addEventListener('focus', function () {
        if (virtualCard) virtualCard.classList.add('flipped');
      });
      cardCvvInput.addEventListener('blur', function () {
        if (virtualCard) virtualCard.classList.remove('flipped');
      });
      cardCvvInput.addEventListener('input', function () {
        var raw = this.value.replace(/\D/g, '').substring(0, 4);
        this.value = raw;
        var display = document.getElementById('cardCvvDisplay');
        if (display) display.textContent = raw ? '•'.repeat(raw.length) : '•••';
      });
    }

    // Copy buttons
    var copyM10 = document.getElementById('copyM10Btn');
    if (copyM10) {
      copyM10.addEventListener('click', function () {
        navigator.clipboard.writeText('+994508881234');
        copyM10.textContent = 'Kopyalandı! ✓';
        setTimeout(function () { copyM10.textContent = 'Kopyala'; }, 2000);
      });
    }

    var copyCrypto = document.getElementById('copyCryptoBtn');
    if (copyCrypto) {
      copyCrypto.addEventListener('click', function () {
        navigator.clipboard.writeText('TY83kxP92sLnQ7z2mBx9K2vW4R1a');
        copyCrypto.textContent = 'Kopyalandı! ✓';
        setTimeout(function () { copyCrypto.textContent = 'Kopyala'; }, 2000);
      });
    }

    // Promo Code
    var applyPromoBtn = document.getElementById('applyPromoBtn');
    var promoInput = document.getElementById('promoInput');
    var promoMsg = document.getElementById('promoMsg');

    function applyPromoCode() {
      if (!promoInput) return;
      var code = (promoInput.value || '').trim().toUpperCase();
      if (!code) return;

      if (code === 'PRO10' || code === 'NEXORA10') {
        state.promoCode = code;
        state.promoRate = 0.10;
        updateModalSummary();
        if (promoMsg) {
          promoMsg.style.display = 'block';
          promoMsg.style.color = 'var(--accent)';
          promoMsg.textContent = '✓ 10% promo endirimi tətbiq edildi!';
        }
      } else if (code === 'START20') {
        state.promoCode = code;
        state.promoRate = 0.20;
        updateModalSummary();
        if (promoMsg) {
          promoMsg.style.display = 'block';
          promoMsg.style.color = 'var(--accent)';
          promoMsg.textContent = '✓ 20% xüsusi endirim tətbiq edildi!';
        }
      } else if (code === 'VIP30') {
        state.promoCode = code;
        state.promoRate = 0.30;
        updateModalSummary();
        if (promoMsg) {
          promoMsg.style.display = 'block';
          promoMsg.style.color = 'var(--accent)';
          promoMsg.textContent = '✓ 30% VIP endirimi tətbiq edildi!';
        }
      } else {
        if (promoMsg) {
          promoMsg.style.display = 'block';
          promoMsg.style.color = '#ff6b6b';
          promoMsg.textContent = 'Daxil edilən promo kod keçərsizdir.';
        }
      }
    }

    if (applyPromoBtn) applyPromoBtn.addEventListener('click', applyPromoCode);
    if (promoInput) {
      promoInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          applyPromoCode();
        }
      });
    }

    // Submit Payment
    var submitPayBtn = document.getElementById('submitPayBtn');
    if (submitPayBtn) {
      submitPayBtn.addEventListener('click', executePayment);
    }

    // Print Receipt
    var printBtn = document.getElementById('printReceiptBtn');
    if (printBtn) {
      printBtn.addEventListener('click', function () {
        window.print();
      });
    }
  }

  function openPaymentModal(planData) {
    createPaymentModalHTML();

    if (planData && planData.name) {
      var found = NEXORA_PLANS.find(function (p) { return p.name.toLowerCase() === planData.name.toLowerCase(); });
      if (found) {
        state.plan = { name: found.name, price: found.price, daily: found.daily };
      } else {
        state.plan = {
          name: planData.name || 'Standart',
          price: planData.price || 30,
          daily: planData.daily || 5
        };
      }
    }

    renderPlanPicker();
    updateModalSummary();
    hideErrors();

    // Reset promo state for a fresh checkout
    state.promoCode = '';
    state.promoRate = 0;
    state.discount = 0;
    var promoInputEl = document.getElementById('promoInput');
    var promoMsgEl = document.getElementById('promoMsg');
    if (promoInputEl) promoInputEl.value = '';
    if (promoMsgEl) { promoMsgEl.style.display = 'none'; promoMsgEl.textContent = ''; }
    updateModalSummary();

    // Reset payment tab to the card tab and clear the previous form state
    var methods = document.querySelectorAll('.pay-method');
    methods.forEach(function (m) { m.classList.toggle('active', m.getAttribute('data-tab') === 'card'); });
    state.activeTab = 'card';
    var tc = document.getElementById('tabContentCard');
    var tm = document.getElementById('tabContentM10');
    var ty = document.getElementById('tabContentCrypto');
    if (tc) tc.style.display = 'block';
    if (tm) tm.style.display = 'none';
    if (ty) ty.style.display = 'none';

    ['cardNumInput', 'cardNameInput', 'cardExpInput', 'cardCvvInput', 'm10PhoneInput', 'cryptoTxnInput'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    var numDisp = document.getElementById('cardNumberDisplay');
    var holderDisp = document.getElementById('cardHolderDisplay');
    var expDisp = document.getElementById('cardExpDisplay');
    var cvvDisp = document.getElementById('cardCvvDisplay');
    if (numDisp) numDisp.textContent = '•••• •••• •••• ••••';
    if (holderDisp) holderDisp.textContent = 'AD SOYAD';
    if (expDisp) expDisp.textContent = 'MM/YY';
    if (cvvDisp) cvvDisp.textContent = '•••';
    var vCard = document.getElementById('virtualCard');
    if (vCard) vCard.classList.remove('flipped');

    var backdrop = document.getElementById('payModalBackdrop');
    var overlay = document.getElementById('payStatusOverlay');
    if (overlay) overlay.classList.remove('active');

    if (backdrop) {
      backdrop.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  function closePaymentModal() {
    var backdrop = document.getElementById('payModalBackdrop');
    if (backdrop) {
      backdrop.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  // Intercept Buy Plan Buttons
  document.addEventListener('click', async function (e) {
    var target = e.target.closest('a, button');
    if (!target) return;

    var isBuyBtn = false;
    var card = target.closest('.price-card');
    var planName = 'Standart';
    var price = 30;
    var daily = 5;

    if (card) {
      isBuyBtn = true;
      var nameEl = card.querySelector('.plan-name');
      var priceEl = card.querySelector('.price');
      var dailyEl = card.querySelector('.daily-income');

      if (nameEl) planName = nameEl.textContent.trim();
      if (priceEl) {
        var num = parseInt(priceEl.textContent.replace(/\D/g, ''), 10);
        if (!isNaN(num)) price = num;
      }
      if (dailyEl) {
        var dNum = parseInt(dailyEl.textContent.replace(/\D/g, ''), 10);
        if (!isNaN(dNum)) daily = dNum;
      }
    } else if (target.getAttribute('href') === 'index.html#paketler' || target.getAttribute('href') === 'qeydiyyat.html') {
      if (target.textContent.toLowerCase().indexOf('paketi al') !== -1 || target.textContent.toLowerCase().indexOf('yeni paket al') !== -1) {
        isBuyBtn = true;
      }
    }

    if (isBuyBtn) {
      e.preventDefault();
      var selectedPlan = {
        name: planName,
        price: price,
        daily: daily
      };
      var api = window.NexoraAPI;
      var authenticated = false;
      if (api) {
        try {
          await api.detect();
          if (api.isUp() && api.getToken()) {
            await api.me();
            authenticated = true;
          }
        } catch (err) {
          // Do not force a logout here; session stays active until the user clicks the logout action.
        }
      }
      if (!authenticated) {
        try { localStorage.setItem('nexora_pending_purchase', JSON.stringify(selectedPlan)); } catch (err) {}
        window.location.href = 'login.html';
        return;
      }
      openPaymentModal(selectedPlan);
    }
  });

  try {
    var query = new URLSearchParams(window.location.search);
    if (query.get('resumePurchase') === '1') {
      var pendingPlan = JSON.parse(localStorage.getItem('nexora_pending_purchase') || 'null');
      localStorage.removeItem('nexora_pending_purchase');
      if (pendingPlan) openPaymentModal(pendingPlan);
      window.history.replaceState(null, '', window.location.pathname + window.location.hash);
    }
  } catch (err) {}

  // Expose global window helper
  window.openNexoraCheckout = openPaymentModal;
})();

