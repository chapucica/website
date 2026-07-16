/* Chapucica — consentimiento de cookies (RGPD) */
(function () {
  'use strict';

  var GA_ID = 'G-7SVBBR84WK';
  var STORAGE_KEY = 'chapucica_cookie_consent';

  function getConsent() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      return null;
    }
  }

  function setConsent(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (err) {
      /* localStorage no disponible */
    }
  }

  function loadAnalytics() {
    if (window.__chapucicaGaLoaded) return;
    window.__chapucicaGaLoaded = true;

    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, { anonymize_ip: true });

    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(script);
  }

  function notifySettled() {
    document.dispatchEvent(new CustomEvent('chapucica:cookies-settled', {
      detail: { consent: getConsent() }
    }));
  }

  function notifyBannerOpen() {
    document.dispatchEvent(new CustomEvent('chapucica:cookies-banner-open'));
  }

  function hideBanner() {
    var banner = document.getElementById('cookie-banner');
    if (!banner) return;
    banner.hidden = true;
    banner.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('cookie-banner-open');
  }

  function showBanner() {
    buildBanner();
    var banner = document.getElementById('cookie-banner');
    if (!banner) return;
    banner.hidden = false;
    banner.removeAttribute('aria-hidden');
    document.documentElement.classList.add('cookie-banner-open');
    notifyBannerOpen();
  }

  function accept() {
    setConsent('accepted');
    hideBanner();
    loadAnalytics();
    notifySettled();
  }

  function reject() {
    var hadAccepted = getConsent() === 'accepted';
    setConsent('rejected');
    hideBanner();
    notifySettled();
    if (hadAccepted) window.location.reload();
  }

  function buildBanner() {
    if (document.getElementById('cookie-banner')) return;

    var banner = document.createElement('aside');
    banner.id = 'cookie-banner';
    banner.className = 'cookie-banner';
    banner.hidden = true;
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-labelledby', 'cookie-banner-title');
    banner.setAttribute('aria-describedby', 'cookie-banner-desc');
    banner.setAttribute('aria-live', 'polite');

    banner.innerHTML =
      '<div class="cookie-banner__inner">' +
        '<span class="cookie-banner__emoji" aria-hidden="true">🍪</span>' +
        '<div class="cookie-banner__copy">' +
          '<p class="cookie-banner__title" id="cookie-banner-title">¿Una galletita?</p>' +
          '<p class="cookie-banner__desc" id="cookie-banner-desc">' +
            'Usamos cookies de analítica para mejorar la web. Tú mandas — ' +
            '<a class="cookie-banner__link" href="cookies.html">más info</a>.' +
          '</p>' +
        '</div>' +
        '<div class="cookie-banner__actions">' +
          '<button type="button" class="btn btn--primary cookie-banner__btn" data-cookie-accept>Vale</button>' +
          '<button type="button" class="btn btn--secondary cookie-banner__btn" data-cookie-reject>No gracias</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(banner);

    banner.querySelector('[data-cookie-accept]').addEventListener('click', accept);
    banner.querySelector('[data-cookie-reject]').addEventListener('click', reject);
  }

  function bindPreferenceTriggers() {
    document.querySelectorAll('[data-cookie-preferences]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        showBanner();
      });
    });
  }

  function init() {
    buildBanner();
    bindPreferenceTriggers();

    var consent = getConsent();
    if (consent === 'accepted') {
      loadAnalytics();
      queueSettledNotice();
      return;
    }
    if (consent === 'rejected') {
      queueSettledNotice();
      return;
    }

    showBanner();
  }

  function queueSettledNotice() {
    setTimeout(notifySettled, 0);
  }

  window.ChapucicaCookies = {
    openPreferences: showBanner,
    accept: accept,
    reject: reject,
    getConsent: getConsent
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
