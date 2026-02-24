/* ========================================================
   SmileAxis Orthodontics — script.js
   Step-by-step booking modal + calendar + success state
   ======================================================== */

// ── Force top on load ───────────────────────────────────────
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

// ── Utilities ──────────────────────────────────────────────
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function trackEvent(name, data = {}) {
  // Wire to gtag / analytics in production
  if (window.__SMILEAXIS_DEBUG__) console.log('[track]', name, data);
}

// ── Header helpers ──────────────────────────────────────────
function initHeader() {
  // Scroll class
  const header = $('.site-header');
  if (header) {
    const fn = () => header.classList.toggle('scrolled', window.scrollY > 6);
    fn();
    window.addEventListener('scroll', fn, { passive: true });
  }

  // Mobile nav toggle
  const toggle = $('#navToggle');
  const menu = $('#navMenu');
  if (!toggle || !menu) return;

  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('is-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  };

  toggle.addEventListener('click', () =>
    setOpen(toggle.getAttribute('aria-expanded') !== 'true'));

  $$(`.nav-menu a`, menu).forEach(a =>
    a.addEventListener('click', () => setOpen(false)));

  document.addEventListener('click', (e) => {
    if (!menu.classList.contains('is-open')) return;
    if (!menu.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });
}

// ── Year ───────────────────────────────────────────────────
function initYear() {
  const el = $('#year');
  if (el) el.textContent = new Date().getFullYear();
}

// ── Stats count-up ─────────────────────────────────────────
function initStats() {
  const items = $$('.stat-val[data-count]');
  if (!items.length) return;
  const reduced = window.matchMedia?.('(prefers-reduced-motion:reduce)').matches;

  const animate = (el) => {
    const raw = el.dataset.count ?? '0';
    const suffix = el.dataset.suffix ?? '';
    const target = Number(raw);
    const isFloat = raw.includes('.');
    if (!isFinite(target)) return;
    if (reduced) { el.textContent = raw + suffix; return; }
    const dur = 900 + Math.random() * 400;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - (1 - p) ** 3;
      const cur = target * eased;
      el.textContent = (isFloat ? cur.toFixed(1) : Math.round(cur)) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const seen = new WeakSet();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting || seen.has(e.target)) continue;
      seen.add(e.target);
      animate(e.target);
    }
  }, { threshold: 0.4 });
  items.forEach(el => io.observe(el));
}

// ── Reviews Carousel ───────────────────────────────────────
function initCarousel() {
  const track = $('#reviewTrack');
  const prev = $('#prevReview');
  const next = $('#nextReview');
  if (!track) return;
  const slides = $$('.quote', track);
  if (!slides.length) return;
  let idx = 0;
  const go = (i) => {
    idx = (i + slides.length) % slides.length;
    track.style.transform = `translateX(-${idx * 100}%)`;
  };
  prev?.addEventListener('click', () => go(idx - 1));
  next?.addEventListener('click', () => go(idx + 1));
  // Auto play
  let timer = setInterval(() => go(idx + 1), 6000);
  const stopAuto = () => clearInterval(timer);
  const startAuto = () => { timer = setInterval(() => go(idx + 1), 6000); };
  [track, prev, next].filter(Boolean).forEach(el => {
    el.addEventListener('mouseenter', stopAuto);
    el.addEventListener('mouseleave', startAuto);
  });
  // Touch swipe
  let sx = null;
  track.addEventListener('pointerdown', e => { sx = e.clientX; }, { passive: true });
  track.addEventListener('pointerup', e => {
    if (sx === null) return;
    const dx = e.clientX - sx; sx = null;
    if (Math.abs(dx) < 25) return;
    dx < 0 ? go(idx + 1) : go(idx - 1);
  }, { passive: true });
}

// ===========================================================
// BOOKING MODAL — Step-by-step with calendar + success state
// ===========================================================

const SLOT_WEEKDAY = [
  '8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '12:00 PM', '1:00 PM', '1:30 PM', '2:00 PM',
  '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM'
];
const SLOT_SAT = [
  '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM'
];

function buildCalendar(container, { onSelect } = {}) {
  const today = new Date();
  let viewY = today.getFullYear();
  let viewM = today.getMonth();
  let selDateStr = '';

  const render = () => {
    container.innerHTML = '';

    // Header row
    const hdr = document.createElement('div');
    hdr.className = 'bc-header';
    hdr.innerHTML = `
      <button type="button" class="cal-nav-btn" id="calPrev" aria-label="Previous month">‹</button>
      <strong class="cal-month-year">${MONTHS[viewM]} ${viewY}</strong>
      <button type="button" class="cal-nav-btn" id="calNext" aria-label="Next month">›</button>`;
    container.appendChild(hdr);

    // Day labels
    const labels = document.createElement('div');
    labels.className = 'bc-day-labels';
    DAYS_SHORT.forEach(d => {
      const s = document.createElement('span');
      s.textContent = d;
      labels.appendChild(s);
    });
    container.appendChild(labels);

    // Grid
    const grid = document.createElement('div');
    grid.className = 'bc-grid';

    const firstDow = new Date(viewY, viewM, 1).getDay();
    const daysInM = new Date(viewY, viewM + 1, 0).getDate();

    // Blank cells
    for (let i = 0; i < firstDow; i++) {
      const e = document.createElement('div');
      e.className = 'bc-cell bc-empty';
      grid.appendChild(e);
    }
    for (let d = 1; d <= daysInM; d++) {
      const date = new Date(viewY, viewM, d);
      const dow = date.getDay();
      const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const isSun = dow === 0;
      const dateStr = `${MONTHS[viewM]} ${d}, ${viewY}`;
      const isToday = d === today.getDate() && viewM === today.getMonth() && viewY === today.getFullYear();
      const isSel = dateStr === selDateStr;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = ['bc-cell',
        isToday ? 'bc-today' : '',
        isSel ? 'bc-selected' : '',
        isPast ? 'bc-past' : '',
        isSun ? 'bc-closed' : ''
      ].join(' ').trim();
      btn.textContent = d;
      btn.setAttribute('aria-label', dateStr);
      if (isPast || isSun) { btn.disabled = true; }
      else {
        btn.addEventListener('click', () => {
          selDateStr = dateStr;
          render(); // re-render to update highlight
          onSelect?.({ dateStr, date, dow });
        });
      }
      grid.appendChild(btn);
    }
    container.appendChild(grid);

    // Nav handlers
    container.querySelector('#calPrev')?.addEventListener('click', () => {
      viewM--; if (viewM < 0) { viewM = 11; viewY--; } render();
    });
    container.querySelector('#calNext')?.addEventListener('click', () => {
      viewM++; if (viewM > 11) { viewM = 0; viewY++; } render();
    });
  };
  render();
}

function buildTimeSlots(container, dow, onSelect) {
  const slots = dow === 6 ? SLOT_SAT : SLOT_WEEKDAY;
  container.innerHTML = '';
  slots.forEach(time => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'time-slot';
    btn.textContent = time;
    btn.addEventListener('click', () => {
      $$('.time-slot', container).forEach(b => b.classList.remove('ts-selected'));
      btn.classList.add('ts-selected');
      onSelect?.(time);
    });
    container.appendChild(btn);
  });
}

/* ---- Step rendering ---- */
function renderStep1(mount, { prefill = {} }) {
  mount.innerHTML = `
    <div class="bp-step-panel" id="bpStep1">
      <div class="fgroup">
        <label for="m_interest">I'm interested in</label>
        <select id="m_interest" name="interest" required>
          <option value="" disabled selected>Select treatment…</option>
          <option ${prefill.interest === 'Invisalign® Clear Aligners' ? 'selected' : ''}>Invisalign® Clear Aligners</option>
          <option ${prefill.interest === 'Traditional Braces' ? 'selected' : ''}>Traditional Braces</option>
          <option ${prefill.interest === 'Ceramic Braces' ? 'selected' : ''}>Ceramic Braces</option>
          <option ${prefill.interest === 'Teen Orthodontics' ? 'selected' : ''}>Teen Orthodontics</option>
          <option ${prefill.interest === 'Children (Age 7+)' ? 'selected' : ''}>Children (Age 7+)</option>
          <option>Not sure — recommend for me</option>
        </select>
      </div>
      <div class="fgroup">
        <label for="m_location">Preferred location</label>
        <select id="m_location" name="location" required>
          <option value="" disabled selected>Choose clinic…</option>
          <option ${prefill.location === 'Central Austin' ? 'selected' : ''}>Central Austin</option>
          <option ${prefill.location === 'South Lamar' ? 'selected' : ''}>South Lamar</option>
          <option ${prefill.location === 'Round Rock' ? 'selected' : ''}>Round Rock</option>
        </select>
      </div>
    </div>`;
}

function renderStep2(mount) {
  mount.innerHTML = `
    <div class="bp-step-panel" id="bpStep2">
      <div class="two-up">
        <div class="fgroup">
          <label for="m_first">First name</label>
          <input id="m_first" name="first" autocomplete="given-name" placeholder="Sarah" required />
        </div>
        <div class="fgroup">
          <label for="m_last">Last name</label>
          <input id="m_last" name="last" autocomplete="family-name" placeholder="Johnson" required />
        </div>
      </div>
      <div class="fgroup">
        <label for="m_email">Email address</label>
        <input id="m_email" name="email" type="email" autocomplete="email" placeholder="sarah@example.com" required />
      </div>
      <div class="fgroup">
        <label for="m_phone">Phone number</label>
        <input id="m_phone" name="phone" inputmode="tel" autocomplete="tel" placeholder="(512) 555-0123" required />
      </div>
    </div>`;
}

function renderStep3(mount) {
  mount.innerHTML = `
    <div class="bp-step-panel" id="bpStep3">
      <p style="color:var(--muted);font-size:.88rem;margin:0 0 .5rem">
        Pick an available date — then choose your preferred time slot.
      </p>
      <div id="modalCalendar" style="border:1.5px solid var(--border);border-radius:14px;overflow:hidden;"></div>
      <div id="modalTimeSection" hidden>
        <p style="font-size:.85rem;font-weight:600;color:var(--muted);margin:.85rem 0 .45rem" id="modalDateLabel"></p>
        <div id="modalTimeGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:.4rem;"></div>
      </div>
      <input type="hidden" name="appointmentDate" id="m_date" />
      <input type="hidden" name="appointmentTime" id="m_time" />
    </div>`;
}

function renderSuccess(mount, data) {
  mount.innerHTML = `
    <div class="bp-success">
      <div class="bp-success-icon">🎉</div>
      <h3>You're all set, ${data.first || 'there'}!</h3>
      <p>We've received your request for <strong>${data.interest || 'a consultation'}</strong>
         at <strong>${data.location || 'your chosen clinic'}</strong>.<br><br>
         <strong>${data.appointmentDate || ''} at ${data.appointmentTime || 'your chosen time'}</strong><br><br>
         We'll text & email a confirmation shortly. See you soon! 😊</p>
      <button class="btn btn-ghost" type="button" id="bookAnother">Book another</button>
    </div>`;
}

function initBookingModal() {
  const modal = $('#bookingModal');
  const backdrop = $('.modal-backdrop', modal);
  const closeBtn = $('.modal-close', modal);
  const content = $('#modalContent');
  const progress = $('#modalProgress');
  if (!modal) return;

  let step = 1;
  let formData = {};
  let lastFocus = null;

  const STEP_LABELS = ['Treatment', 'Your Details', 'Date & Time'];

  function updateProgress() {
    if (!progress) return;
    progress.innerHTML = STEP_LABELS.map((label, i) => {
      const n = i + 1;
      const cls = n < step ? 'bp-step-dot done' : n === step ? 'bp-step-dot active' : 'bp-step-dot';
      const line = i < STEP_LABELS.length - 1 ? '<div class="bp-step-line"></div>' : '';
      return `<div class="${cls}">
        <div class="bp-step-num">${n < step ? '✓' : n}</div>
        <span class="bp-step-label">${label}</span>
      </div>${line}`;
    }).join('');
  }

  function updateFooter() {
    const footer = $('#modalFooter');
    if (!footer) return;
    if (step === 1) {
      footer.innerHTML = `<button class="btn btn-block" id="mNext1" type="button">Continue to Details →</button>`;
      $('#mNext1')?.addEventListener('click', () => advanceTo(2));
    } else if (step === 2) {
      footer.innerHTML = `
        <div class="bp-footer-row">
          <button class="btn btn-ghost" id="mBack1" type="button">← Back</button>
          <button class="btn" id="mNext2" type="button">Pick Date & Time →</button>
        </div>`;
      $('#mBack1')?.addEventListener('click', () => advanceTo(1));
      $('#mNext2')?.addEventListener('click', () => advanceTo(3));
    } else if (step === 3) {
      footer.innerHTML = `
        <div class="bp-footer-row">
          <button class="btn btn-ghost" id="mBack2" type="button">← Back</button>
          <button class="btn" id="mSubmit" type="button" disabled>Confirm Booking ✓</button>
        </div>`;
      $('#mBack2')?.addEventListener('click', () => advanceTo(2));
      // submit wired after calendar built
    }
  }

  function validateStep(s) {
    const panel = $(`#bpStep${s}`, modal);
    if (!panel) return true;
    const fields = $$('input[required],select[required]', panel);
    for (const f of fields) {
      if (!f.checkValidity()) { f.reportValidity(); return false; }
    }
    return true;
  }

  function collectStep(s) {
    const panel = $(`#bpStep${s}`, modal);
    if (!panel) return;
    const form = document.createElement('form');
    $$('input,select,textarea', panel).forEach(el => {
      const clone = el.cloneNode(true);
      form.appendChild(clone);
    });
    const fd = new FormData(form);
    for (const [k, v] of fd.entries()) formData[k] = v;
    // Also grab direct inputs since they aren't in a real form
    $$('[name]', panel).forEach(el => { if (el.name) formData[el.name] = el.value; });
  }

  function advanceTo(s) {
    if (s > step && !validateStep(step)) return;
    collectStep(step);
    step = s;
    renderCurrentStep();
  }

  function renderCurrentStep() {
    updateProgress();
    if (!content) return;
    content.innerHTML = '';
    if (step === 1) renderStep1(content, { prefill: formData });
    if (step === 2) renderStep2(content);
    if (step === 3) renderStep3(content);
    updateFooter();

    // Pre-fill step2
    if (step === 2 && formData.first) { const el = $('#m_first', modal); if (el) el.value = formData.first; }
    if (step === 2 && formData.last) { const el = $('#m_last', modal); if (el) el.value = formData.last; }
    if (step === 2 && formData.email) { const el = $('#m_email', modal); if (el) el.value = formData.email; }
    if (step === 2 && formData.phone) { const el = $('#m_phone', modal); if (el) el.value = formData.phone; }

    // Build calendar for step 3
    if (step === 3) {
      const calEl = $('#modalCalendar', modal);
      if (calEl) {
        buildCalendar(calEl, {
          onSelect: ({ dateStr, date, dow }) => {
            const dateLabel = $('#modalDateLabel', modal);
            const timeSection = $('#modalTimeSection', modal);
            const timeGrid = $('#modalTimeGrid', modal);
            const dateInput = $('#m_date', modal);
            if (dateInput) dateInput.value = dateStr;
            if (dateLabel) dateLabel.textContent = `Available times for ${dateStr}:`;
            if (timeSection) timeSection.hidden = false;
            if (timeGrid) {
              buildTimeSlots(timeGrid, dow, (time) => {
                const tInput = $('#m_time', modal);
                if (tInput) tInput.value = time;
                formData.appointmentDate = dateStr;
                formData.appointmentTime = time;
                // Enable confirm button
                const sub = $('#mSubmit', modal);
                if (sub) {
                  sub.disabled = false;
                  sub.addEventListener('click', handleSubmit, { once: true });
                }
              });
            }
          }
        });
      }
    }
    // Focus first field
    setTimeout(() => {
      const first = $('select,input', content);
      first?.focus();
    }, 30);
  }

  function handleSubmit() {
    collectStep(step);
    trackEvent('booking_submitted', formData);
    // Show success
    if (content) renderSuccess(content, formData);
    if (progress) progress.innerHTML = '';
    const footer = $('#modalFooter', modal);
    if (footer) footer.innerHTML = '';
    $('#bookAnother', modal)?.addEventListener('click', () => {
      step = 1; formData = {};
      renderCurrentStep();
    });
  }

  // Open modal
  function openModal({ interest, location, cta } = {}) {
    lastFocus = document.activeElement;
    if (interest) formData.interest = interest;
    if (location) formData.location = location;
    step = 1;
    renderCurrentStep();
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    trackEvent('booking_modal_open', { interest, location, cta });
  }
  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    lastFocus?.focus?.();
  }

  // Wire all [data-open-booking] buttons
  $$('[data-open-booking]').forEach(btn => {
    btn.addEventListener('click', () => openModal({
      interest: btn.dataset.interest,
      location: btn.dataset.location,
      cta: btn.dataset.cta,
    }));
  });

  backdrop?.addEventListener('click', closeModal);
  closeBtn?.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });
}

// ── Inline booking form (homepage section) ──────────────────
function initInlineBooking() {
  const form = $('#bookingForm');
  if (!form) return;

  const panels = $$('[data-step]', form);
  const progressDots = $$('.bp-step-dot', form);
  // Nav blocks per step
  const nav1 = $('#ilNav1', form);
  const nav2 = $('#ilNav2', form);
  const nav3 = $('#ilNav3', form);
  let current = 1;
  let userInteracted = false;

  const showPanel = (s) => {
    current = s;
    // Show/hide step panels
    panels.forEach(p => { p.hidden = Number(p.dataset.step) !== s; });
    // Update progress dots
    progressDots.forEach((d, i) => {
      d.classList.toggle('active', i + 1 === s);
      d.classList.toggle('done', i + 1 < s);
    });
    // Show/hide nav blocks
    if (nav1) nav1.hidden = s !== 1;
    if (nav2) nav2.hidden = s !== 2;
    if (nav3) nav3.hidden = s !== 3;

    if (s === 3) {
      const calEl = $('#inlineCalendar', form);
      if (calEl && !calEl.dataset.built) {
        calEl.dataset.built = '1';
        buildCalendar(calEl, {
          onSelect: ({ dateStr, date, dow }) => {
            const ts = $('#inlineTimeSection', form);
            const tg = $('#inlineTimeGrid', form);
            const dl = $('#inlineDateLabel', form);
            const di = $('#il_date', form);
            if (di) di.value = dateStr;
            if (dl) dl.textContent = `Times for ${dateStr}:`;
            if (ts) ts.hidden = false;
            if (tg) {
              buildTimeSlots(tg, dow, (time) => {
                const ti = $('#il_time', form);
                if (ti) ti.value = time;
                const sub = $('#ilSubmit', form);
                if (sub) {
                  sub.disabled = false;
                  sub.removeEventListener('click', handleInlineSubmit);
                  sub.addEventListener('click', handleInlineSubmit, { once: true });
                }
              });
            }
          }
        });
      }
    }
    if (userInteracted) form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const validate = () => {
    const panel = panels.find(p => Number(p.dataset.step) === current);
    if (!panel) return true;
    for (const el of $$('input[required],select[required]', panel)) {
      if (!el.checkValidity()) { el.reportValidity(); return false; }
    }
    return true;
  };

  $$('[data-next]', form).forEach(btn => {
    btn.addEventListener('click', () => {
      userInteracted = true;
      if (validate()) showPanel(Number(btn.dataset.next));
    });
  });
  $$('[data-back]', form).forEach(btn => {
    btn.addEventListener('click', () => { userInteracted = true; showPanel(Number(btn.dataset.back)); });
  });

  function handleInlineSubmit() {
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());
    trackEvent('inline_booking_submit', data);
    // Show success
    const panel = form.closest('.booking-panel');
    if (panel) {
      panel.innerHTML = `<div class="bp-success">
        <div class="bp-success-icon">🎉</div>
        <h3>You're booked, ${data.firstName || data.first || 'there'}!</h3>
        <p>We've received your request for <strong>${data.interest || 'a consultation'}</strong>
           at <strong>${data.location || 'your chosen clinic'}</strong>.<br><br>
           <strong>${data.appointmentDate || ''} at ${data.appointmentTime || data.time || 'your chosen time'}</strong><br><br>
           Confirmation on its way. See you soon! 😊</p>
        <button class="btn btn-ghost" onclick="location.reload()">Start a new booking</button>
      </div>`;
    }
  }

  showPanel(1);
}

// ── Init all ────────────────────────────────────────────────
initYear();
initHeader();
initStats();
initCarousel();
initBookingModal();
initInlineBooking();

/* ── Calendar CSS injected dynamically ────── */
(function injectCalCSS() {
  const style = document.createElement('style');
  style.textContent = `
    .bc-header{display:flex;align-items:center;justify-content:space-between;
      padding:.75rem 1rem;background:linear-gradient(135deg,rgba(13,148,136,.07),rgba(8,145,178,.06));
      border-bottom:1px solid var(--border);}
    .cal-month-year{font-weight:800;font-size:.97rem;}
    .cal-nav-btn{width:32px;height:32px;border-radius:8px;border:1.5px solid var(--border);
      background:var(--white);cursor:pointer;font-size:1rem;font-weight:700;
      display:flex;align-items:center;justify-content:center;color:var(--text);
      transition:background 140ms,transform 120ms;}
    .cal-nav-btn:hover{background:var(--brand-light);color:var(--brand);transform:scale(1.08);}
    .bc-day-labels{display:grid;grid-template-columns:repeat(7,1fr);
      padding:.5rem .5rem .2rem;background:var(--bg);}
    .bc-day-labels span{text-align:center;font-size:.72rem;font-weight:700;
      color:var(--muted);text-transform:uppercase;letter-spacing:.04em;}
    .bc-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;padding:.5rem;}
    .bc-cell{aspect-ratio:1;display:flex;align-items:center;justify-content:center;
      border-radius:8px;font-size:.85rem;font-weight:600;cursor:pointer;
      border:none;background:transparent;color:var(--text);transition:all 140ms;}
    .bc-cell:hover:not(:disabled){background:rgba(13,148,136,.12);color:var(--brand);transform:scale(1.1);}
    .bc-today{border:2px solid var(--brand);color:var(--brand);}
    .bc-selected{background:linear-gradient(135deg,var(--brand),var(--brand-mid))!important;
      color:#fff!important;font-weight:800;box-shadow:0 4px 12px rgba(13,148,136,.35);}
    .bc-past,.bc-closed{color:var(--faint)!important;cursor:not-allowed!important;}
    .bc-empty{cursor:default;}
    .time-slot{padding:.6rem .4rem;border-radius:8px;border:1.5px solid var(--border);
      background:var(--white);font-size:.8rem;font-weight:700;cursor:pointer;
      text-align:center;color:var(--text);transition:all 140ms;}
    .time-slot:hover{border-color:var(--brand);color:var(--brand);
      background:rgba(13,148,136,.07);transform:translateY(-1px);}
    .time-slot.ts-selected{background:linear-gradient(135deg,var(--brand),var(--brand-mid));
      border-color:var(--brand);color:#fff;box-shadow:0 4px 10px rgba(13,148,136,.3);}
    #mSubmit:disabled{opacity:.4;cursor:not-allowed;transform:none!important;box-shadow:none!important;}
    #ilSubmit:disabled{opacity:.4;cursor:not-allowed;transform:none!important;box-shadow:none!important;}
  `;
  document.head.appendChild(style);
})();
