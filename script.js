/* ============================================================
   CELEBRATION SITE — script.js
   Vanilla JS. No frameworks, no dependencies.
   ============================================================ */

'use strict';


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
        let paused   = false;   /* hover pause */
        let dragging = false;   /* touch drag */
        let lastTs   = null;    /* previous timestamp for delta-time speed */

        function tick(ts) {
          if (lastTs !== null && !paused && !dragging) {
            const dt = (ts - lastTs) / 1000; /* seconds */
            x -= SPEED_PPS * dt;
            if (x <= -halfWidth) x += halfWidth; /* seamless reset */
          }
          lastTs = ts;
          track.style.transform = `translateX(${x}px)`;
          requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);

        /* ── Hover pause (desktop) ── */
        carousel.addEventListener('mouseenter', () => { paused = true;  });
        carousel.addEventListener('mouseleave', () => { paused = false; });

        /* Block accidental horizontal mouse-wheel hijack */
        carousel.addEventListener('wheel', e => {
          if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) e.preventDefault();
        }, { passive: false });

        /* ── Touch drag (mobile) ── */
        let touchStartX  = 0;
        let touchStartY  = 0;
        let xAtDragStart = 0;
        let touchLocked  = false;

        carousel.addEventListener('touchstart', e => {
          dragging     = false;
          touchLocked  = false;
          touchStartX  = e.touches[0].clientX;
          touchStartY  = e.touches[0].clientY;
          xAtDragStart = x;
        }, { passive: true });

        carousel.addEventListener('touchmove', e => {
          const touch = e.touches[0];
          const dx = touch.clientX - touchStartX;
          const dy = touch.clientY - touchStartY;

          if (!touchLocked && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
            touchLocked = true;
            dragging = true;
          }

          if (!dragging) return;

          e.preventDefault();
          x = xAtDragStart + dx;
          /* Wrap within the infinite range */
          if (x > 0)          x -= halfWidth;
          if (x < -halfWidth) x += halfWidth;
        }, { passive: false });

        carousel.addEventListener('touchend', () => {
          dragging = false;
          touchLocked = false;
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
    '.contact__info',
    '.contact__form-wrap',
    '.faq__list',
    '.pricing-card',
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
   WIZARD — 6-step quote assistant
   ============================================================ */

function initWizard() {
  const TOTAL_STEPS = 6;

  const progressFill  = document.getElementById('wizard-progress-fill');
  const progressTrack = document.getElementById('wizard-progress-track');
  const stepNumEl     = document.getElementById('wizard-step-num');
  const prevBtn       = document.getElementById('wizard-prev');
  const nextBtn       = document.getElementById('wizard-next');
  const waBtn         = document.getElementById('wizard-wa');

  if (!progressFill || !prevBtn || !nextBtn || !waBtn) return;

  let currentStep = 1;

  const answers = { 1: null, 2: null, 3: null, 4: null, 5: null, 6: '' };

  /* ── Update progress bar and step counter ── */
  function updateProgress() {
    progressFill.style.width = `${(currentStep / TOTAL_STEPS) * 100}%`;
    progressTrack?.setAttribute('aria-valuenow', String(currentStep));
    if (stepNumEl) stepNumEl.textContent = currentStep;
  }

  /* ── Show / hide navigation buttons based on current step ── */
  function updateNav() {
    prevBtn.hidden = currentStep === 1;

    if (currentStep === TOTAL_STEPS) {
      nextBtn.hidden = true;
      waBtn.hidden   = false;
    } else {
      nextBtn.hidden   = false;
      waBtn.hidden     = true;
      nextBtn.disabled = !answers[currentStep];
    }
  }

  /**
   * Animate from the current step to the next/previous one.
   * @param {number} to - target step number
   * @param {'forward'|'back'} direction
   */
  function transitionTo(to, direction) {
    const from = currentStep;
    const fromEl = document.getElementById(`wizard-step-${from}`);
    const toEl   = document.getElementById(`wizard-step-${to}`);
    if (!fromEl || !toEl) return;

    // Exit current step
    fromEl.style.cssText = `transition:opacity .18s ease,transform .18s ease;opacity:0;transform:translateY(${direction === 'forward' ? '-12px' : '12px'})`;

    setTimeout(() => {
      fromEl.hidden = true;
      fromEl.style.cssText = '';
      currentStep = to;
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
        // Move focus to the new step for keyboard and screen-reader users
        const focusTarget = toEl.querySelector('.wizard__question, .wizard__opt, .wizard__textarea');
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

    if (stepNum < TOTAL_STEPS) nextBtn.disabled = false;

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
  }

  // Attach click handlers to every option in every step
  for (let s = 1; s <= TOTAL_STEPS; s++) {
    const stepEl = document.getElementById(`wizard-step-${s}`);
    if (!stepEl) continue;
    stepEl.querySelectorAll('.wizard__opt').forEach(btn => {
      btn.addEventListener('click', () => selectOption(btn, s));
    });
  }

  /* ── Previous / Next navigation ── */
  prevBtn.addEventListener('click', () => {
    if (currentStep > 1) transitionTo(currentStep - 1, 'back');
  });

  nextBtn.addEventListener('click', () => {
    if (currentStep < TOTAL_STEPS && answers[currentStep] !== null)
      transitionTo(currentStep + 1, 'forward');
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
    if (!raw?.trim() || raw.trim() === 'Aún no lo sé') return UNSURE;
    return raw.trim();
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
      '¡Hola, Chapucica! 😊',
      '',
      'Me gustaría pedir presupuesto para unas chapas personalizadas.',
      '',
      'DATOS DEL PEDIDO',
      '',
    ];

    // Steps 1–5: one bullet per field
    for (let i = 1; i <= 5; i++) {
      lines.push(`• ${FIELD_LABELS[i]}: ${resolveAnswer(answers[i])}`);
    }

    // Step 6: notes — optional
    const notes = answers[6]?.trim();
    if (notes) {
      lines.push(`• Notas: ${notes}`);
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
   PRICING — Monthly / Annual toggle
   ============================================================ */

function initPricingToggle() {
  const toggleBtns = $$('.pricing__toggle-btn');
  const amounts    = $$('.pricing-card__amount');
  if (!toggleBtns.length) return;

  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const billing = btn.dataset.billing;

      toggleBtns.forEach(b => {
        b.classList.remove('is-active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-pressed', 'true');

      // Swap displayed prices using data attributes
      amounts.forEach(el => {
        const val = el.dataset[billing];
        if (val) el.textContent = val;
      });
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
   CONTACT FORM — Client-side validation
   ============================================================ */

function initContactForm() {
  const form    = $('#contact-form');
  const success = $('#contact-form-success');
  if (!form) return;

  const RULES = {
    'contact-name':    { test: v => v.trim().length > 0,                         msg: 'Por favor, introduce tu nombre completo.' },
    'contact-email':   { test: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()), msg: 'Por favor, introduce un email válido.' },
    'contact-message': { test: v => v.trim().length > 0,                         msg: 'Por favor, escribe un mensaje.' },
  };

  /** Show or clear an inline error for a field */
  function setError(id, msg) {
    const el = document.getElementById(`${id}-error`);
    if (el) el.textContent = msg;
  }

  function clearErrors() {
    Object.keys(RULES).forEach(id => setError(id, ''));
  }

  function validate() {
    clearErrors();
    let valid = true;
    Object.entries(RULES).forEach(([id, { test, msg }]) => {
      const input = document.getElementById(id);
      if (!input || !test(input.value)) {
        setError(id, msg);
        valid = false;
      }
    });
    return valid;
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!validate()) return;
    form.reset();
    if (success) {
      success.hidden = false;
      // Scroll into view and shift focus so screen readers announce the confirmation
      success.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      success.focus({ preventScroll: true });
    }
  });
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
  wa.href      = 'https://wa.me/34623944601?text=%C2%A1Hola%21%20%F0%9F%98%8A%0A%0AMe%20gustar%C3%ADa%20informaci%C3%B3n%20sobre%20chapas%20personalizadas.';
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
  initPricingToggle();
  initFaqAccordion();
  initContactForm();
  initNewsletterForm();
  initBackToTop();
  initFooterYear();
  initSmoothScroll();
  initWhatsAppButton();
});
