/* ============================================================
   Chapucica — Google Analytics 4 (eventos personalizados)
   Solo gtag('event', …). Falla en silencio si GA no está disponible.
   ============================================================ */

'use strict';

const ChapucicaAnalytics = (function () {
  let formStarted = false;
  let priceShown = false;

  const SEASON_LABELS = {
    'ruta-moto': 'moteros',
    'motera': 'moteros',
    'vuelta-cole': 'vuelta_cole',
    'cartagineses': 'cartagineses',
    'murcianico': 'murcianico',
    'halloween': 'halloween',
  };

  function isAnalyticsDebug() {
    try {
      if (window.ChapucicaCookies && typeof window.ChapucicaCookies.isAnalyticsDebug === 'function') {
        return window.ChapucicaCookies.isAnalyticsDebug();
      }
      return localStorage.getItem('chapucica_analytics_debug') === '1';
    } catch (_) {
      return false;
    }
  }

  function hasAnalytics() {
    try {
      if (isAnalyticsDebug()) return false;
      return typeof gtag === 'function'
        && (!window.ChapucicaCookies || window.ChapucicaCookies.getConsent?.() === 'accepted');
    } catch (_) {
      return false;
    }
  }

  function trackEvent(eventName, params) {
    try {
      if (!hasAnalytics()) return;
      gtag('event', eventName, params || {});
    } catch (_) {
      /* sin analítica o bloqueada */
    }
  }

  function trackFormStart() {
    if (formStarted) return;
    formStarted = true;
    trackEvent('form_start');
  }

  function trackPriceShown() {
    if (priceShown) return;
    priceShown = true;
    trackEvent('price_shown');
  }

  function resetWizardSession() {
    formStarted = false;
    priceShown = false;
  }

  function resolveSeason(campaignId) {
    if (!campaignId) return 'unknown';
    return SEASON_LABELS[campaignId] || campaignId.replace(/-/g, '_');
  }

  function trackWhatsAppClick(payload) {
    trackEvent('whatsapp_click', {
      event_type: payload.event_type ?? '',
      badge_size: payload.badge_size ?? '',
      finish_type: payload.finish_type ?? '',
      quantity: payload.quantity ?? '',
      estimated_price: payload.estimated_price ?? '',
    });
  }

  function trackInstagramClick() {
    trackEvent('instagram_click');
  }

  function trackSeasonClick(season) {
    trackEvent('season_click', { season });
  }

  function initInstagramTracking() {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href*="instagram.com"]');
      if (!link) return;
      trackInstagramClick();
    });
  }

  function initSeasonTracking() {
    const spotlight = document.getElementById('spotlight');
    if (!spotlight) return;

    const season = resolveSeason(spotlight.dataset.campaign);
    spotlight.querySelectorAll('.spotlight-card').forEach((card) => {
      card.addEventListener('click', () => trackSeasonClick(season));
    });
  }

  function init() {
    initInstagramTracking();
    initSeasonTracking();
  }

  return {
    trackFormStart,
    trackPriceShown,
    trackWhatsAppClick,
    resetWizardSession,
    init,
  };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ChapucicaAnalytics.init());
} else {
  ChapucicaAnalytics.init();
}
