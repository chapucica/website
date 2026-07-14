/* ============================================================
   CELEBRATION SITE — script.js
   Vanilla JS. No frameworks, no dependencies.
   ============================================================ */

'use strict';

/** WhatsApp — número y enlace general reutilizado (botón flotante, contacto) */
const CHAPUCICA_WHATSAPP_PHONE = '34623944601';
const CHAPUCICA_WHATSAPP_GENERAL_URL =
  `https://wa.me/${CHAPUCICA_WHATSAPP_PHONE}?text=${encodeURIComponent('¡Hola!\n\nMe gustaría información sobre chapas personalizadas.')}`;


/* ============================================================
   UTILITIES
   ============================================================ */

/** Shorthand for querySelector */
const $ = (sel, ctx = document) => ctx.querySelector(sel);

/** Shorthand for querySelectorAll → real array */
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

/**
 * Debounce a function so it only runs after `ms` ms of silence.
 * Used for scroll/resize handlers to reduce layout thrashing.
 */
function debounce(fn, ms = 120) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}


/* ============================================================
   NAV — Mobile drawer + scroll shadow
   ============================================================ */

function initNav() {
  const toggle = $('#nav-toggle');
  const menu   = $('#nav-menu');
  if (!toggle || !menu) return;

  /** Open / close the mobile drawer */
  function setOpen(open) {
    menu.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  }

  toggle.addEventListener('click', () => setOpen(!menu.classList.contains('is-open')));

  // Close on any nav link tap
  $$('.nav__link', menu).forEach(link => link.addEventListener('click', () => setOpen(false)));

  // Close when clicking outside the drawer
  document.addEventListener('click', e => {
    if (!menu.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
  });

  // Close on Escape
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
}


function initHeaderScroll() {
  const header = $('#site-header');
  if (!header) return;

  // Add a shadow class once the user scrolls past the fold
  window.addEventListener('scroll', debounce(() => {
    header.classList.toggle('is-scrolled', window.scrollY > 24);
  }, 50), { passive: true });
}


/* ============================================================
   OCCASIONS — Single-select toggle cards
   ============================================================ */

function initOccasionCards() {
  const cards = $$('.occasion-card__btn');
  if (!cards.length) return;

  cards.forEach(btn => {
    btn.addEventListener('click', () => {
      const wasSelected = btn.getAttribute('aria-pressed') === 'true';

      // Deselect all, then toggle the clicked card
      cards.forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', String(!wasSelected));
    });
  });
}


/* ============================================================
   MOMENTOS REALES — Infinite horizontal carousel
   Media list loaded from assets/moments/manifest.json.
   To add new media: copy files into assets/moments/ then run
   generate-manifest.py from the celebration-site folder.
   ============================================================ */

function initMomentsCarousel() {
  const carousel = $('#moments-carousel');
  const track    = $('#moments-track');
  if (!carousel || !track) return;

  /** pixels per second — lower = slower/more premium */
  const SPEED_PPS = 60;

  fetch('assets/moments/manifest.json')
    .then(r => r.ok ? r.json() : Promise.reject('manifest not found'))
    .then(files => {
      if (!files.length) return;

      /* Shuffle for freshness on every page load */
      const shuffled = [...files].sort(() => Math.random() - 0.5);

      /** Build a single <img> or <video> element for a file */
      function buildMedia(filename) {
        const src = 'assets/moments/' + filename;
        const ext = filename.split('.').pop().toLowerCase();

        if (ext === 'mp4') {
          const v = document.createElement('video');
          v.setAttribute('src', src);
          v.autoplay    = true;
          v.muted       = true;
          v.loop        = true;
          v.setAttribute('playsinline', '');
          v.preload     = 'none'; /* lazy — IntersectionObserver starts playback */
          return v;
        }

        const img    = document.createElement('img');
        img.src      = src;
        img.alt      = 'Celebración real — Chapucica';
        img.loading  = 'lazy';
        img.decoding = 'async';
        return img;
      }

      /** Append one full set of cards to the track */
      function appendSet(list) {
        list.forEach(file => {
          const li = document.createElement('li');
          li.className = 'moment-card';
          li.setAttribute('aria-hidden', 'true'); /* decorative */
          li.appendChild(buildMedia(file));
          track.appendChild(li);
        });
      }

      /* Original items + clone = seamless infinite loop */
      appendSet(shuffled);
      appendSet(shuffled);

      /* Wait one frame so the browser has laid out the track */
      requestAnimationFrame(() => {
        /* Read gap from computed styles — matches the CSS value */
        const gap   = parseInt(getComputedStyle(track).gap, 10) || 12;
        const cardW = track.querySelector('.moment-card')?.offsetWidth || 200;
        const itemStep  = cardW + gap;
        /* Loop resets when we've scrolled past all ORIGINAL items */
        const halfWidth = itemStep * shuffled.length;

        /* ── Animation state ── */
        let x        = 0;
        let hovered  = false;
        let dragging = false;
        let manualUntil = 0;
        let lastTs   = null;

        function wrapX() {
          if (x > 0)          x -= halfWidth;
          if (x < -halfWidth) x += halfWidth;
        }

        function bumpManual(ms = 1800) {
          manualUntil = Date.now() + ms;
        }

        function isAutoPaused() {
          return hovered || dragging || Date.now() < manualUntil;
        }

        function tick(ts) {
          if (lastTs !== null && !isAutoPaused()) {
            const dt = (ts - lastTs) / 1000;
            x -= SPEED_PPS * dt;
            if (x <= -halfWidth) x += halfWidth;
          }
          lastTs = ts;
          track.style.transform = `translateX(${x}px)`;
          requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);

        /* ── Hover pause (desktop) — manual control still works ── */
        carousel.addEventListener('mouseenter', () => { hovered = true; });
        carousel.addEventListener('mouseleave', () => { hovered = false; });

        /* ── Trackpad / mouse wheel horizontal scroll ── */
        carousel.addEventListener('wheel', e => {
          const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY)
            ? e.deltaX
            : (e.shiftKey ? e.deltaY : 0);
          if (!dx) return;

          e.preventDefault();
          bumpManual();
          x -= dx;
          wrapX();
        }, { passive: false });

        /* ── Pointer drag (mouse + touch) ── */
        let ptrActive   = false;
        let ptrLocked   = false;
        let ptrStartX   = 0;
        let ptrStartY   = 0;
        let xAtPtrStart = 0;

        function endPointerDrag() {
          ptrActive = false;
          ptrLocked = false;
          dragging  = false;
        }

        carousel.addEventListener('pointerdown', e => {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          ptrActive   = true;
          ptrLocked   = false;
          ptrStartX   = e.clientX;
          ptrStartY   = e.clientY;
          xAtPtrStart = x;
        });

        carousel.addEventListener('pointermove', e => {
          if (!ptrActive) return;

          const dx = e.clientX - ptrStartX;
          const dy = e.clientY - ptrStartY;

          if (!ptrLocked) {
            if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
              ptrLocked = true;
              dragging  = true;
              bumpManual(4000);
              carousel.setPointerCapture(e.pointerId);
            } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
              endPointerDrag();
              return;
            } else {
              return;
            }
          }

          e.preventDefault();
          x = xAtPtrStart + dx;
          wrapX();
        });

        carousel.addEventListener('pointerup', endPointerDrag);
        carousel.addEventListener('pointercancel', endPointerDrag);

        /* ── Keyboard arrows ── */
        carousel.addEventListener('keydown', e => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            bumpManual();
            x += itemStep;
            wrapX();
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            bumpManual();
            x -= itemStep;
            wrapX();
          }
        });

        /* ── Lazy video playback — only play when visible ── */
        if ('IntersectionObserver' in window) {
          const videoObs = new IntersectionObserver(entries => {
            entries.forEach(({ isIntersecting, target }) => {
              const v = target.querySelector('video');
              if (!v) return;
              if (isIntersecting) v.play().catch(() => {});
              else { v.pause(); v.currentTime = 0; }
            });
          }, { rootMargin: '120px', threshold: 0 });

          $$('.moment-card', track).forEach(card => videoObs.observe(card));
        }
      });
    })
    .catch(err => console.warn('Moments carousel — manifest.json:', err));
}


/* ============================================================
   GALLERY — Masonry filter (kept for legacy; no longer used)
   ============================================================ */

function initGalleryFilter() {
  const filterBtns = $$('.gallery__filter-btn');
  const masonry    = $('#gallery-masonry');
  if (!filterBtns.length || !masonry) return;

  let busy = false; // prevent double-clicks during animation

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (busy) return;
      busy = true;

      const filter = btn.dataset.filter;

      // Highlight active pill
      filterBtns.forEach(b => {
        b.classList.remove('is-active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-pressed', 'true');

      const items = $$('.gallery-item', masonry);

      // Phase 1 — fade out everything
      items.forEach(item => {
        item.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
        item.style.opacity    = '0';
        item.style.transform  = 'scale(0.96)';
      });

      // Phase 2 — swap visibility and fade matching items back in
      setTimeout(() => {
        items.forEach(item => {
          item.style.transition = '';
          item.style.opacity    = '';
          item.style.transform  = '';

          const match = filter === 'all' || item.dataset.tag === filter;
          if (match) {
            item.classList.remove('is-hidden');
            item.classList.add('is-appearing');
            item.addEventListener('animationend', () => item.classList.remove('is-appearing'), { once: true });
          } else {
            item.classList.add('is-hidden');
          }
        });

        busy = false;
      }, 220);
    });
  });
}


/* ============================================================
   GALLERY — Lightbox (enlarge on click, keyboard + swipe nav)
   ============================================================ */

function initGalleryLightbox() {
  const masonry = $('#gallery-masonry');
  if (!masonry) return;

  /* Build the lightbox DOM once and reuse it */
  const lightbox = document.createElement('div');
  lightbox.className = 'lightbox';
  lightbox.id        = 'gallery-lightbox';
  lightbox.setAttribute('role', 'dialog');
  lightbox.setAttribute('aria-modal', 'true');
  lightbox.setAttribute('aria-label', 'Vista previa de imagen');
  lightbox.hidden = true;

  lightbox.innerHTML = `
    <div class="lightbox__backdrop"></div>
    <div class="lightbox__content">
      <button class="lightbox__close" aria-label="Cerrar vista previa" type="button">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
      <button class="lightbox__prev" aria-label="Imagen anterior" type="button">
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M10 12L6 8l4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <img class="lightbox__img" src="" alt="" />
      <button class="lightbox__next" aria-label="Imagen siguiente" type="button">
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <span class="lightbox__counter" id="lightbox-counter"></span>
    </div>
  `;

  document.body.appendChild(lightbox);

  const lbImg      = lightbox.querySelector('.lightbox__img');
  const lbClose    = lightbox.querySelector('.lightbox__close');
  const lbPrev     = lightbox.querySelector('.lightbox__prev');
  const lbNext     = lightbox.querySelector('.lightbox__next');
  const lbCounter  = lightbox.querySelector('.lightbox__counter');
  const lbBackdrop = lightbox.querySelector('.lightbox__backdrop');

  let visibleItems = [];
  let currentIdx   = 0;
  let isOpen       = false;

  /** Returns whichever items are currently visible (after filtering) */
  function getVisible() {
    return $$('.gallery-item:not(.is-hidden)', masonry);
  }

  /** Show a single image in the lightbox */
  function showImage(idx) {
    const item = visibleItems[idx];
    if (!item) return;

    const img = item.querySelector('.gallery-item__image');
    const src = img.dataset.full || img.src;

    // Brief fade when switching between images
    lbImg.style.cssText = 'opacity:0; transform:scale(0.97); transition:opacity .15s ease,transform .15s ease';

    setTimeout(() => {
      lbImg.src = src;
      lbImg.alt = img.alt;
      lbImg.style.cssText = 'opacity:1; transform:scale(1); transition:opacity .3s ease,transform .3s ease';
    }, 130);

    currentIdx = idx;
    lbCounter.textContent = `${idx + 1} / ${visibleItems.length}`;
    lbPrev.style.visibility = idx === 0 ? 'hidden' : 'visible';
    lbNext.style.visibility = idx === visibleItems.length - 1 ? 'hidden' : 'visible';
  }

  /** Open the lightbox at a specific index */
  function open(idx) {
    visibleItems = getVisible();
    showImage(Math.max(0, Math.min(idx, visibleItems.length - 1)));

    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => lightbox.classList.add('is-open'));

    isOpen = true;
    lbClose.focus();
  }

  /** Close and reset */
  function close() {
    lightbox.classList.remove('is-open');
    isOpen = false;
    setTimeout(() => {
      lightbox.hidden = true;
      document.body.style.overflow = '';
      lbImg.src = '';
    }, 380);
  }

  function prev() { if (currentIdx > 0) showImage(currentIdx - 1); }
  function next() { if (currentIdx < visibleItems.length - 1) showImage(currentIdx + 1); }

  /* Inject zoom icon overlay into each gallery item */
  $$('.gallery-item', masonry).forEach(item => {
    const figure = item.querySelector('.gallery-item__figure');

    const overlay = document.createElement('div');
    overlay.className = 'gallery-item__zoom';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <span class="gallery-item__zoom-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/>
          <path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M11 8v6M8 11h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </span>`;
    figure.appendChild(overlay);

    item.addEventListener('click', () => {
      visibleItems = getVisible();
      const idx = visibleItems.indexOf(item);
      open(idx === -1 ? 0 : idx);
    });
  });

  /* Controls */
  lbClose.addEventListener('click', close);
  lbBackdrop.addEventListener('click', close);
  lbPrev.addEventListener('click', e => { e.stopPropagation(); prev(); });
  lbNext.addEventListener('click', e => { e.stopPropagation(); next(); });

  /* Keyboard navigation */
  document.addEventListener('keydown', e => {
    if (!isOpen) return;
    if (e.key === 'Escape')     close();
    if (e.key === 'ArrowLeft')  prev();
    if (e.key === 'ArrowRight') next();
  });

  /* Touch swipe support */
  let touchStartX = 0;
  lightbox.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  lightbox.addEventListener('touchend',   e => {
    const delta = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 50) (delta > 0 ? next : prev)();
  }, { passive: true });
}


/* ============================================================
   GALLERY — Native lazy load + fade-in via IntersectionObserver
   ============================================================ */

function initGalleryLazyLoad() {
  if (!('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(({ isIntersecting, target }) => {
      if (!isIntersecting) return;
      target.style.transition = 'opacity 0.5s ease';
      if (target.complete) {
        target.style.opacity = '1';
      } else {
        target.style.opacity = '0';
        target.addEventListener('load', () => { target.style.opacity = '1'; }, { once: true });
      }
      observer.unobserve(target);
    });
  }, { rootMargin: '200px' });

  $$('.gallery-item__image').forEach(img => observer.observe(img));
}


/* ============================================================
   SECTION REVEAL — Subtle scroll-triggered entrance
   ============================================================ */

function initSectionReveal() {
  // Below-the-fold elements only — hero must show immediately on first visit
  const targets = $$([
    '.section-header',
    '.spotlight__header',
    '.spotlight-card__inner',
    '.wizard__header',
    '.gallery__filters',
    '.contact__inner',
    '.contact__panel',
    '.faq__list',
    '.pricing-accordion-wrap',
  ].join(','));

  if (!targets.length) return;

  targets.forEach((el) => {
    el.classList.add('reveal');
    const siblings = el.parentElement ? Array.from(el.parentElement.children) : [];
    const pos = siblings.indexOf(el);
    if (pos > 0) el.style.transitionDelay = `${pos * 0.07}s`;
  });

  /** Reveal elements already on screen without waiting for scroll */
  function revealIfInView(el) {
    const rect = el.getBoundingClientRect();
    return rect.top < window.innerHeight * 0.92 && rect.bottom > 0;
  }

  if (!('IntersectionObserver' in window)) {
    targets.forEach(el => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(({ isIntersecting, target }) => {
      if (!isIntersecting) return;
      target.classList.add('is-visible');
      observer.unobserve(target);
    });
  }, { rootMargin: '0px 0px', threshold: 0.05 });

  targets.forEach(el => {
    if (revealIfInView(el)) {
      el.classList.add('is-visible');
    } else {
      observer.observe(el);
    }
  });
}


/* ============================================================
   PRICING — Tabla única y calculadora de presupuesto
   ============================================================ */

const CHAPUCICA_PRICE_TABLE = {
  '38mm': {
    pin: {
      unit: 1.20,
      packs: { 25: 30, 50: 55, 100: 100, 150: 135, 200: 160 },
    },
    magnet: {
      unit: 1.50,
      packs: { 25: 37.50, 50: 70, 100: 130, 150: 180, 200: 220 },
    },
  },
  '50mm': {
    pin: {
      unit: 1.30,
      packs: { 25: 32.50, 50: 60, 100: 110, 150: 150, 200: 180 },
    },
    magnet: {
      unit: 1.70,
      packs: { 25: 42.50, 50: 80, 100: 150, 150: 210, 200: 260 },
    },
  },
  '59mm': {
    pin: {
      unit: 1.50,
      packs: { 25: 37.50, 50: 70, 100: 130, 150: 180, 200: 220 },
    },
    magnet: {
      unit: 1.90,
      packs: { 25: 47.50, 50: 90, 100: 170, 150: 240, 200: 300 },
    },
    opener: {
      unit: 2.50,
      packs: { 25: 62.50, 50: 120, 100: 230, 150: 330, 200: 420 },
    },
  },
};

const CHAPUCICA_PACK_SIZES = [200, 150, 100, 50, 25];
const CHAPUCICA_SHIPPING_FEE = 3;
const CHAPUCICA_FREE_SHIPPING_MIN = 50;

const WIZARD_FINISH_TO_PRICE_KEY = {
  'Imperdible': 'pin',
  'Imán': 'magnet',
  'Abridor de botellas': 'opener',
};

/** @returns {{ unit: number, packs: Record<number, number> }|null} */
function getPricingProfile(size, finish) {
  const sizeKey = size?.trim();
  const finishKey = WIZARD_FINISH_TO_PRICE_KEY[finish];
  if (!sizeKey || !finishKey) return null;
  return CHAPUCICA_PRICE_TABLE[sizeKey]?.[finishKey] ?? null;
}

/**
 * Calcula la combinación más barata para una cantidad exacta.
 * @returns {null|{
 *   quantity: number,
 *   packs: Record<number, number>,
 *   units: number,
 *   subtotal: number,
 *   shipping: number,
 *   total: number,
 *   shippingFree: boolean,
 *   lines: Array<{ kind: 'pack'|'units', size?: number, count: number, amount: number }>
 * }}
 */
function calculatePrice(size, finish, quantity) {
  const profile = getPricingProfile(size, finish);
  if (!profile || !Number.isInteger(quantity) || quantity < 1) return null;

  const dp = new Array(quantity + 1).fill(Infinity);
  const prev = new Array(quantity + 1).fill(null);
  dp[0] = 0;

  for (let i = 1; i <= quantity; i++) {
    let bestCost = dp[i - 1] + profile.unit;
    let bestStep = { kind: 'unit', from: i - 1 };

    for (const packSize of CHAPUCICA_PACK_SIZES) {
      if (i < packSize) continue;
      const packCost = dp[i - packSize] + profile.packs[packSize];
      if (packCost < bestCost) {
        bestCost = packCost;
        bestStep = { kind: 'pack', size: packSize, from: i - packSize };
      }
    }

    dp[i] = bestCost;
    prev[i] = bestStep;
  }

  const packs = { 25: 0, 50: 0, 100: 0, 150: 0, 200: 0 };
  let units = 0;
  let cursor = quantity;

  while (cursor > 0) {
    const step = prev[cursor];
    if (!step) return null;
    if (step.kind === 'unit') {
      units += 1;
      cursor -= 1;
    } else {
      packs[step.size] += 1;
      cursor -= step.size;
    }
  }

  const lines = [];
  for (const packSize of CHAPUCICA_PACK_SIZES.slice().reverse()) {
    const count = packs[packSize];
    if (!count) continue;
    lines.push({
      kind: 'pack',
      size: packSize,
      count,
      amount: profile.packs[packSize] * count,
    });
  }
  if (units > 0) {
    lines.push({
      kind: 'units',
      count: units,
      amount: profile.unit * units,
    });
  }

  const subtotal = dp[quantity];
  const shippingFree = quantity >= CHAPUCICA_FREE_SHIPPING_MIN;
  const shipping = shippingFree ? 0 : CHAPUCICA_SHIPPING_FEE;
  const total = subtotal + shipping;

  return {
    quantity,
    packs,
    units,
    subtotal,
    shipping,
    total,
    shippingFree,
    lines,
  };
}

function formatEuroES(amount) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getWizardQuoteInputs(answers) {
  const size = answers[2];
  const finish = answers[3];
  const quantity = answers[4];

  if (size === 'Aún no lo sé' || finish === 'Aún no lo sé' || quantity === 'Aún no lo sé') {
    return null;
  }
  if (!size || !finish || typeof quantity !== 'number' || quantity < 1) return null;
  if (!getPricingProfile(size, finish)) return null;

  return { size, finish, quantity };
}

function buildWhatsAppPriceLines(result) {
  if (!result) return [];

  const lines = ['', 'Precio calculado', ''];

  result.lines.forEach(item => {
    if (item.kind === 'pack') {
      const label = item.count > 1 ? `Pack${item.size} (×${item.count})` : `Pack${item.size}`;
      lines.push(`${label}: ${formatEuroES(item.amount)}`);
    } else {
      lines.push(`${item.count} unidad${item.count === 1 ? '' : 'es'}: ${formatEuroES(item.amount)}`);
    }
  });

  lines.push(`Envío: ${result.shippingFree ? 'Gratis' : formatEuroES(result.shipping)}`);
  lines.push(`Total: ${formatEuroES(result.total)}`);
  lines.push('');
  lines.push('El diseño personalizado está incluido en este precio.');

  return lines;
}


/* ============================================================
   WIZARD — 6-step quote assistant
   ============================================================ */

function initWizard() {
  const TOTAL_STEPS = 6;
  const AUTO_ADVANCE_DELAY = 280;
  const QTY_PRESETS = [25, 50, 75, 100, 150, 200];

  const progressFill  = document.getElementById('wizard-progress-fill');
  const progressTrack = document.getElementById('wizard-progress-track');
  const stepNumEl     = document.getElementById('wizard-step-num');
  const backBtn       = document.getElementById('wizard-back');
  const footerEl      = document.getElementById('wizard-footer');
  const waBtn         = document.getElementById('wizard-wa');
  const privacyNote   = document.getElementById('wizard-privacy-note');
  const qtyCustomCard = document.getElementById('wizard-qty-custom-card');
  const qtyCustomInput = document.getElementById('wizard-qty-input');
  const qtyCustomConfirm = document.getElementById('wizard-qty-confirm');
  const qtyCustomError = document.getElementById('wizard-qty-error');
  const priceSlot     = document.getElementById('wizard-price-slot');
  const priceCard     = document.getElementById('wizard-price');

  const QTY_CUSTOM = '__custom__';

  if (!progressFill || !backBtn || !waBtn) return;

  let currentStep = 1;
  let autoAdvanceTimer = null;

  const answers = { 1: null, 2: null, 3: null, 4: null, 5: null, 6: '' };

  function clearAutoAdvance() {
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = null;
    }
  }

  function scheduleAutoAdvance(fromStep, delay = AUTO_ADVANCE_DELAY) {
    if (fromStep >= TOTAL_STEPS) return;
    clearAutoAdvance();
    autoAdvanceTimer = setTimeout(() => {
      autoAdvanceTimer = null;
      if (currentStep !== fromStep) return;
      if (!canAdvanceFromStep(fromStep)) return;
      transitionTo(currentStep + 1, 'forward');
    }, delay);
  }

  /* ── Update progress bar and step counter ── */
  function updateProgress() {
    progressFill.style.width = `${(currentStep / TOTAL_STEPS) * 100}%`;
    progressTrack?.setAttribute('aria-valuenow', String(currentStep));
    if (stepNumEl) stepNumEl.textContent = currentStep;
  }

  /* ── Show / hide navigation buttons based on current step ── */
  function canAdvanceFromStep(stepNum) {
    if (stepNum === 4) {
      if (answers[4] === 'Aún no lo sé') return true;
      return typeof answers[4] === 'number' && answers[4] >= 1;
    }
    return answers[stepNum] !== null && answers[stepNum] !== '';
  }

  function updateNav() {
    backBtn.hidden = currentStep === 1;

    const viewport = document.getElementById('wizard-viewport');
    if (viewport) {
      viewport.classList.toggle('wizard__viewport--compact', currentStep === TOTAL_STEPS);
    }

    if (currentStep === TOTAL_STEPS) {
      if (footerEl) footerEl.hidden = false;
      waBtn.hidden = false;
      if (privacyNote) privacyNote.hidden = false;
      updatePriceEstimate();
    } else {
      if (footerEl) footerEl.hidden = true;
      waBtn.hidden = true;
      if (privacyNote) privacyNote.hidden = true;
      if (priceSlot) priceSlot.hidden = true;
    }
  }

  function priceLineHtml(label, value) {
    return `
      <div class="wizard__price-line">
        <span class="wizard__price-line-label">${label}</span>
        <span class="wizard__price-line-dots" aria-hidden="true"></span>
        <span class="wizard__price-line-value">${value}</span>
      </div>`;
  }

  function renderPriceEmptyState() {
    if (!priceCard) return;
    priceCard.className = 'wizard__price wizard__price--empty';
    priceCard.innerHTML = `
      <p class="wizard__price-empty-title">Todavía no podemos calcular el precio.</p>
      <p class="wizard__price-empty-text">Selecciona tamaño, acabado y cantidad para ver una estimación.</p>`;
  }

  function renderPriceReadyState(result) {
    if (!priceCard) return;
    priceCard.className = 'wizard__price wizard__price--ready';

    const breakdown = result.lines.map(item => {
      if (item.kind === 'pack') {
        const label = item.count > 1 ? `Pack ${item.size} (×${item.count})` : `Pack ${item.size}`;
        return priceLineHtml(label, formatEuroES(item.amount));
      }
      const unitLabel = item.count === 1 ? '1 unidad' : `${item.count} unidades`;
      return priceLineHtml(unitLabel, formatEuroES(item.amount));
    }).join('');

    const shippingLabel = result.shippingFree ? 'Gratis' : formatEuroES(result.shipping);

    priceCard.innerHTML = `
      <p class="wizard__price-eyebrow">Precio calculado</p>
      <p class="wizard__price-total">${formatEuroES(result.total)}</p>
      <p class="wizard__price-note">Diseño personalizado incluido.</p>
      <div class="wizard__price-breakdown">
        ${breakdown}
        ${priceLineHtml('Envío', shippingLabel)}
        ${priceLineHtml('Total', formatEuroES(result.total))}
      </div>`;
  }

  function updatePriceEstimate() {
    if (!priceSlot || !priceCard || currentStep !== TOTAL_STEPS) return;

    priceSlot.hidden = false;
    const inputs = getWizardQuoteInputs(answers);
    const result = inputs ? calculatePrice(inputs.size, inputs.finish, inputs.quantity) : null;

    if (!result) renderPriceEmptyState();
    else renderPriceReadyState(result);
  }

  function parsePositiveInt(value) {
    const trimmed = String(value).trim();
    if (!trimmed || !/^\d+$/.test(trimmed)) return null;
    const n = parseInt(trimmed, 10);
    if (!Number.isFinite(n) || n < 1) return null;
    return n;
  }

  function clearCustomQuantityInput() {
    if (!qtyCustomInput) return;
    qtyCustomInput.value = '';
    qtyCustomInput.classList.remove('has-error');
    if (qtyCustomError) qtyCustomError.hidden = true;
    updateCustomConfirmState();
  }

  function updateCustomConfirmState() {
    if (!qtyCustomConfirm || !qtyCustomInput) return;
    const valid = parsePositiveInt(qtyCustomInput.value) !== null;
    qtyCustomConfirm.disabled = !valid;
  }

  function confirmCustomQuantity() {
    if (!qtyCustomInput) return;
    const parsed = parsePositiveInt(qtyCustomInput.value.trim());

    if (parsed === null) {
      if (qtyCustomError) qtyCustomError.hidden = false;
      qtyCustomInput.classList.add('has-error');
      return;
    }

    if (qtyCustomError) qtyCustomError.hidden = true;
    qtyCustomInput.classList.remove('has-error');
    answers[4] = parsed;
    updatePriceEstimate();

    if (currentStep === 4) transitionTo(5, 'forward');
  }

  function selectCustomQuantityCard(focusInput = false) {
    const stepEl = document.getElementById('wizard-step-4');
    if (!stepEl || !qtyCustomCard) return;

    stepEl.querySelectorAll('.wizard__opt').forEach(b => b.classList.remove('is-selected'));
    qtyCustomCard.classList.add('is-selected');
    answers[4] = null;
    updateCustomConfirmState();
    if (focusInput) qtyCustomInput?.focus({ preventScroll: true });
    updatePriceEstimate();
  }

  function restoreQuantityStepUI() {
    const stepEl = document.getElementById('wizard-step-4');
    if (!stepEl || !qtyCustomCard) return;

    const qty = answers[4];
    stepEl.querySelectorAll('.wizard__opt').forEach(b => b.classList.remove('is-selected'));

    if (typeof qty === 'number' && !QTY_PRESETS.includes(qty)) {
      qtyCustomCard.classList.add('is-selected');
      qtyCustomInput.value = String(qty);
      updateCustomConfirmState();
      return;
    }

    if (qty === 'Aún no lo sé') {
      stepEl.querySelector('.wizard__opt[data-value="Aún no lo sé"]')?.classList.add('is-selected');
      clearCustomQuantityInput();
      return;
    }

    if (typeof qty === 'number') {
      const presetBtn = stepEl.querySelector(`.wizard__opt[data-value="${qty}"]`);
      if (presetBtn) {
        presetBtn.classList.add('is-selected');
        clearCustomQuantityInput();
        return;
      }
    }

    clearCustomQuantityInput();
  }

  function selectQuantityOption(btn) {
    const stepEl = document.getElementById('wizard-step-4');
    if (!stepEl) return;

    stepEl.querySelectorAll('.wizard__opt').forEach(b => b.classList.remove('is-selected'));
    btn.classList.add('is-selected');

    const value = btn.dataset.value;

    if (value === QTY_CUSTOM) {
      selectCustomQuantityCard(true);
      return;
    }

    clearCustomQuantityInput();

    if (value === 'Aún no lo sé') {
      answers[4] = 'Aún no lo sé';
    } else {
      answers[4] = parseInt(value, 10);
    }

    updatePriceEstimate();
    if (currentStep === 4) scheduleAutoAdvance(4);
  }

  /**
   * Animate from the current step to the next/previous one.
   * @param {number} to - target step number
   * @param {'forward'|'back'} direction
   */
  function transitionTo(to, direction) {
    clearAutoAdvance();
    const from = currentStep;
    const fromEl = document.getElementById(`wizard-step-${from}`);
    const toEl   = document.getElementById(`wizard-step-${to}`);
    if (!fromEl || !toEl) return;

    // Drop entry animations so inline transitions behave the same on every step
    fromEl.classList.remove('wizard__step--active', 'wizard__step--enter-back');
    toEl.classList.remove('wizard__step--active', 'wizard__step--enter-back');

    // Exit current step
    fromEl.style.cssText = `transition:opacity .18s ease,transform .18s ease;opacity:0;transform:translateY(${direction === 'forward' ? '-12px' : '12px'})`;

    setTimeout(() => {
      fromEl.hidden = true;
      fromEl.style.cssText = '';
      currentStep = to;
      if (to === 4) restoreQuantityStepUI();
      updateProgress();
      updateNav();

      // Prepare incoming step just off-screen
      toEl.style.cssText = `opacity:0;transform:translateY(${direction === 'forward' ? '12px' : '-12px'});transition:none`;
      toEl.hidden = false;

      // Force reflow so the transition fires
      void toEl.offsetWidth;

      toEl.style.cssText = 'opacity:1;transform:translateY(0);transition:opacity .35s cubic-bezier(.22,1,.36,1),transform .35s cubic-bezier(.22,1,.36,1)';
      toEl.addEventListener('transitionend', () => {
        toEl.style.cssText = '';
        const focusTarget = to === 4 && qtyCustomCard?.classList.contains('is-selected')
          ? qtyCustomInput
          : toEl.querySelector('.wizard__question, .wizard__opt, .wizard__textarea, .wizard__qty-custom-input');
        if (focusTarget) focusTarget.focus({ preventScroll: true });
      }, { once: true });
    }, 200);
  }

  /* ── Select an option card and update state ── */
  function selectOption(btn, stepNum) {
    const stepEl = document.getElementById(`wizard-step-${stepNum}`);
    if (!stepEl) return;

    // Deselect siblings, select this one
    stepEl.querySelectorAll('.wizard__opt').forEach(b => b.classList.remove('is-selected'));
    btn.classList.add('is-selected');
    answers[stepNum] = btn.dataset.value;

    // Special logic: show/hide Bottle opener option based on size
    if (stepNum === 2) {
      const bottleItem = document.getElementById('bottle-opener-option');
      if (bottleItem) {
        const show = btn.dataset.value === '59mm';
        bottleItem.hidden = !show;
        // Clear stale selection if the option is now hidden
        if (!show && answers[3] === 'Abridor de botellas') {
          answers[3] = null;
          document.getElementById('wizard-step-3')
            ?.querySelectorAll('.wizard__opt')
            .forEach(b => b.classList.remove('is-selected'));
        }
      }
    }

    if (stepNum === 2 || stepNum === 3) updatePriceEstimate();

    if (stepNum < TOTAL_STEPS) scheduleAutoAdvance(stepNum);
  }

  // Attach click handlers to every option in every step
  for (let s = 1; s <= TOTAL_STEPS; s++) {
    const stepEl = document.getElementById(`wizard-step-${s}`);
    if (!stepEl) continue;
    stepEl.querySelectorAll('.wizard__opt').forEach(btn => {
      if (btn.id === 'wizard-qty-custom-card') return;
      btn.addEventListener('click', () => {
        if (s === 4) selectQuantityOption(btn);
        else selectOption(btn, s);
      });
    });
  }

  qtyCustomCard?.addEventListener('click', e => {
    if (e.target === qtyCustomInput || e.target.closest('.wizard__qty-custom-confirm')) return;
    if (qtyCustomCard.classList.contains('is-selected')) {
      qtyCustomInput?.focus({ preventScroll: true });
      return;
    }
    selectCustomQuantityCard(true);
  });

  qtyCustomInput?.addEventListener('focus', () => {
    if (!qtyCustomCard?.classList.contains('is-selected')) {
      selectCustomQuantityCard(false);
    }
  });

  qtyCustomInput?.addEventListener('click', e => {
    e.stopPropagation();
  });

  qtyCustomConfirm?.addEventListener('click', e => {
    e.stopPropagation();
    if (!qtyCustomCard?.classList.contains('is-selected')) selectCustomQuantityCard(false);
    confirmCustomQuantity();
  });

  qtyCustomInput?.addEventListener('input', () => {
    qtyCustomInput.value = qtyCustomInput.value.replace(/\D/g, '');
    qtyCustomInput.classList.remove('has-error');
    if (qtyCustomError) qtyCustomError.hidden = true;
    updateCustomConfirmState();
  });

  qtyCustomInput?.addEventListener('keydown', e => {
    if (['e', 'E', '+', '-', '.', ','].includes(e.key)) e.preventDefault();
    if (e.key === 'Enter') e.preventDefault();
  });

  /* ── Back navigation (topbar link) ── */
  backBtn.addEventListener('click', () => {
    if (currentStep > 1) transitionTo(currentStep - 1, 'back');
  });

  /* ── WhatsApp message builder ── */
  const PHONE  = '34623944601';
  const UNSURE = 'Me gustaría que me recomendarais';

  const FIELD_LABELS = {
    1: 'Evento',
    2: 'Tamaño',
    3: 'Acabado',
    4: 'Cantidad',
    5: 'Diseño',
  };

  /** Returns the display value for an answer, substituting the UNSURE phrase when needed */
  function resolveAnswer(raw) {
    const text = raw?.toString().trim();
    if (!text || text === 'Aún no lo sé') return UNSURE;
    return text;
  }

  function formatQuantityAnswer() {
    if (answers[4] === 'Aún no lo sé') return 'Aún no lo sé';
    if (typeof answers[4] === 'number') return String(answers[4]);
    return UNSURE;
  }

  /**
   * Build the clean, professional WhatsApp message text.
   * Format inspired by the brand style — no emoji prefixes on data lines.
   * Notes are omitted entirely when empty.
   */
  function buildWhatsAppMessage() {
    const notesEl = document.getElementById('wizard-notes');
    if (notesEl) answers[6] = notesEl.value.trim();

    const lines = [
      '¡Hola, Chapucica!',
      '',
      'Me gustaría pedir presupuesto para unas chapas personalizadas.',
      '',
      'DATOS DEL PEDIDO',
      '',
    ];

    // Steps 1–5: one bullet per field
    for (let i = 1; i <= 5; i++) {
      if (i === 4) {
        lines.push(`• ${FIELD_LABELS[4]}: ${formatQuantityAnswer()}`);
        if (answers[4] === 'Aún no lo sé') {
          lines.push('• Nota: Me gustaría recibir vuestra recomendación sobre la cantidad.');
        }
      } else {
        lines.push(`• ${FIELD_LABELS[i]}: ${resolveAnswer(answers[i])}`);
      }
    }

    // Step 6: notes — optional
    const notes = answers[6]?.trim();
    if (notes) {
      lines.push(`• Notas: ${notes}`);
    }

    const quoteInputs = getWizardQuoteInputs(answers);
    const priceResult = quoteInputs
      ? calculatePrice(quoteInputs.size, quoteInputs.finish, quoteInputs.quantity)
      : null;
    if (priceResult) {
      lines.push(...buildWhatsAppPriceLines(priceResult));
    }

    lines.push('');
    lines.push('Quedo pendiente de vuestra respuesta. ¡Muchas gracias!');

    return lines.join('\n');
  }

  /** Returns the full wa.me URL with the encoded message */
  function buildWhatsAppURL() {
    return `https://wa.me/${PHONE}?text=${encodeURIComponent(buildWhatsAppMessage())}`;
  }

  /** Reset wizard to step 1 after WhatsApp handoff */
  function resetWizard() {
    currentStep = 1;
    for (let i = 1; i <= 5; i++) answers[i] = null;
    answers[6] = '';

    for (let s = 1; s <= TOTAL_STEPS; s++) {
      const stepEl = document.getElementById(`wizard-step-${s}`);
      if (!stepEl) continue;
      stepEl.hidden = s !== 1;
      stepEl.style.cssText = '';
      stepEl.classList.toggle('wizard__step--active', s === 1);
      stepEl.querySelectorAll('.wizard__opt').forEach(b => b.classList.remove('is-selected'));
    }

    const notesEl = document.getElementById('wizard-notes');
    if (notesEl) notesEl.value = '';

    clearCustomQuantityInput();

    const bottleItem = document.getElementById('bottle-opener-option');
    if (bottleItem) bottleItem.hidden = true;

    updateProgress();
    updateNav();
  }

  /**
   * Detects whether the user is on a touch/mobile device.
   * Uses pointer type (most reliable) with UA string as fallback.
   */
  function isMobileDevice() {
    if (window.matchMedia('(pointer: coarse)').matches) return true;
    return /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  /* ── Desktop WhatsApp modal ── */
  const waModal       = document.getElementById('wa-modal');
  const waModalBdrop  = document.getElementById('wa-modal-backdrop');
  const waModalCancel = document.getElementById('wa-modal-cancel');
  const waModalLink   = document.getElementById('wa-modal-confirm');

  function openWaModal(url) {
    if (!waModal || !waModalLink) return;
    waModalLink.href = url;
    waModal.hidden   = false;
    document.body.style.overflow = 'hidden';
    waModalCancel?.focus();
  }

  function closeWaModal() {
    if (!waModal) return;
    waModal.hidden = true;
    document.body.style.overflow = '';
  }

  waModalCancel?.addEventListener('click', closeWaModal);
  waModalBdrop?.addEventListener('click', closeWaModal);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && waModal && !waModal.hidden) closeWaModal();
  });

  /* ── Main WhatsApp button click ── */
  waBtn.addEventListener('click', e => {
    e.preventDefault();
    const url = buildWhatsAppURL();

    if (isMobileDevice()) {
      // Mobile: open WhatsApp app directly
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      // Desktop: show confirmation modal first
      openWaModal(url);
    }

    resetWizard();
  });

  // Keep notes in sync while typing
  document.getElementById('wizard-notes')
    ?.addEventListener('input', e => { answers[6] = e.target.value.trim(); });

  updateProgress();
  updateNav();
}


/* ============================================================
   PRICING — Size accordion (single-open)
   ============================================================ */

function initPricingAccordion() {
  const triggers = $$('.pricing-accordion__trigger');
  if (!triggers.length) return;

  triggers.forEach(trigger => {
    trigger.addEventListener('click', () => {
      const item     = trigger.closest('.pricing-accordion__item');
      const panelId  = trigger.getAttribute('aria-controls');
      const panel    = panelId ? document.getElementById(panelId) : null;
      const isOpen   = trigger.getAttribute('aria-expanded') === 'true';

      triggers.forEach(t => {
        const otherItem  = t.closest('.pricing-accordion__item');
        const otherPanel = document.getElementById(t.getAttribute('aria-controls'));
        t.setAttribute('aria-expanded', 'false');
        otherItem?.classList.remove('is-open');
        if (otherPanel) otherPanel.setAttribute('aria-hidden', 'true');
      });

      if (!isOpen) {
        trigger.setAttribute('aria-expanded', 'true');
        item?.classList.add('is-open');
        if (panel) panel.setAttribute('aria-hidden', 'false');
      }
    });
  });
}


/* ============================================================
   FAQ — Accessible accordion (single-open)
   ============================================================ */

function initFaqAccordion() {
  const toggles = $$('.faq__toggle');

  toggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
      const answerId = toggle.getAttribute('aria-controls');
      const answer   = document.getElementById(answerId);
      const isOpen   = toggle.getAttribute('aria-expanded') === 'true';

      // Close all others first
      toggles.forEach(t => {
        if (t === toggle) return;
        t.setAttribute('aria-expanded', 'false');
        const sib = document.getElementById(t.getAttribute('aria-controls'));
        if (sib) sib.hidden = true;
      });

      toggle.setAttribute('aria-expanded', String(!isOpen));
      if (answer) answer.hidden = isOpen;
    });
  });
}


/* ============================================================
   CONTACT — WhatsApp CTA + secondary channels
   ============================================================ */

function initContactSection() {
  const waBtn = $('#contact-wa-btn');
  if (waBtn) waBtn.href = CHAPUCICA_WHATSAPP_GENERAL_URL;
}


/* ============================================================
   NEWSLETTER — Stub submit handler
   ============================================================ */

function initNewsletterForm() {
  const form = $('#footer-newsletter-form');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    if (btn) { btn.textContent = '¡Suscrito!'; btn.disabled = true; }
  });
}


/* ============================================================
   BACK TO TOP — Appears after scrolling 400px
   ============================================================ */

function initBackToTop() {
  const btn = $('#back-to-top');
  if (!btn) return;

  window.addEventListener('scroll', debounce(() => {
    btn.hidden = window.scrollY < 400;
  }, 80), { passive: true });

  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}


/* ============================================================
   FOOTER — Dynamic copyright year
   ============================================================ */

function initFooterYear() {
  const el = $('#footer-year');
  if (el) el.textContent = new Date().getFullYear();
}


/* ============================================================
   SMOOTH SCROLL — Polyfill for <a href="#..."> links
   ============================================================ */

function initSmoothScroll() {
  $$('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      const id = link.getAttribute('href');
      if (id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}


/* ============================================================
   WHATSAPP BUTTON — Sticky floating button (injected via JS)
   ============================================================ */

function initWhatsAppButton() {
  const wa = document.createElement('a');
  wa.className = 'whatsapp-btn';
  wa.href      = CHAPUCICA_WHATSAPP_GENERAL_URL;
  wa.target    = '_blank';
  wa.rel       = 'noopener noreferrer';
  wa.setAttribute('aria-label', 'Escríbenos por WhatsApp');

  wa.innerHTML = `
    <svg class="whatsapp-btn__icon" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path fill="#fff" d="M16 2.667C8.636 2.667 2.667 8.636 2.667 16c0 2.333.627 4.62 1.82 6.627L2.667 29.333l6.9-1.8A13.253 13.253 0 0016 29.333c7.364 0 13.333-5.97 13.333-13.333S23.364 2.667 16 2.667zm0 24a10.57 10.57 0 01-5.373-1.467l-.387-.227-3.986 1.04 1.067-3.88-.253-.4A10.573 10.573 0 015.333 16C5.333 10.12 10.12 5.333 16 5.333S26.667 10.12 26.667 16 21.88 26.667 16 26.667zm5.787-7.88c-.32-.16-1.887-.933-2.18-1.04-.293-.107-.507-.16-.72.16s-.827 1.04-.987 1.253c-.187.213-.373.24-.693.08-.32-.16-1.347-.493-2.56-1.573-.947-.84-1.587-1.88-1.773-2.2-.187-.32-.02-.493.14-.653.147-.147.32-.373.48-.56.16-.187.213-.32.32-.533.107-.213.053-.4-.027-.56-.08-.16-.72-1.733-.987-2.373-.253-.627-.52-.547-.72-.56l-.613-.013a1.173 1.173 0 00-.853.4c-.293.32-1.12 1.093-1.12 2.667s1.147 3.093 1.307 3.307c.16.213 2.253 3.44 5.46 4.827.76.333 1.36.533 1.827.68.76.24 1.453.213 2 .133.613-.093 1.887-.773 2.153-1.52.267-.747.267-1.387.187-1.52-.08-.133-.293-.213-.613-.373z"/>
    </svg>
    <span class="whatsapp-btn__label">Escríbenos</span>
  `;

  document.body.appendChild(wa);
}


/* ============================================================
   INIT — Boot all modules on DOM ready
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initHeaderScroll();
  initOccasionCards();
  initMomentsCarousel();  /* new: real-moments infinite carousel */
  initSectionReveal();
  initWizard();
  initPricingAccordion();
  initFaqAccordion();
  initContactSection();
  initNewsletterForm();
  initBackToTop();
  initFooterYear();
  initSmoothScroll();
  initWhatsAppButton();
});
