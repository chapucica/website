/* Chapucica — evento GA4 para página 404 (solo 404.html, con consentimiento) */
(function () {
  'use strict';

  if (document.documentElement.dataset.error404Preview === 'true') return;

  function sanitizePath(path) {
    try {
      var p = String(path || '/').split('?')[0].split('#')[0];
      if (p.length > 200) p = p.slice(0, 200);
      return p || '/';
    } catch (_) {
      return '/';
    }
  }

  function canTrack() {
    try {
      if (window.ChapucicaCookies && typeof window.ChapucicaCookies.isAnalyticsDebug === 'function') {
        if (window.ChapucicaCookies.isAnalyticsDebug()) return false;
      }
      if (typeof gtag !== 'function') return false;
      if (!window.ChapucicaCookies || window.ChapucicaCookies.getConsent() !== 'accepted') return false;
      return true;
    } catch (_) {
      return false;
    }
  }

  function track404View() {
    if (!canTrack()) return;
    try {
      gtag('event', 'error_404_view', {
        requested_path: sanitizePath(window.location.pathname),
      });
    } catch (_) {
      /* sin analítica */
    }
  }

  function init() {
    if (canTrack()) {
      track404View();
      return;
    }
    document.addEventListener('chapucica:cookies-settled', function (e) {
      if (e.detail && e.detail.consent === 'accepted') track404View();
    }, { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
