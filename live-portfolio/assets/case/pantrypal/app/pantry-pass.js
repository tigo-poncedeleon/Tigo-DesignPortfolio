// pantry-pass.js — the Season Pass (Screens/PaywallSheet.swift), for the app
// the case study runs (pantry-app.js): the printed ticket Settings' promo
// raises, as a sheet over the screen that raised it.
//
// It is drawn from the Swift source's own numbers and the 1.3 build's words
// (three free shelves, then the pass), and laid over the layout sweep's
// capture of it (tools/ui-sweep/shots/final/16/paywall.png): the sheet's
// edge 59 down with corners of 38, over the screen behind it dimmed by a
// fifth, as iOS 26 presents a large sheet; then the title band, the card
// that scrolls, and the plans and the button pinned under it.
//
// Everything on it does what the app's does but the sale itself. The two
// stubs choose a plan, and the button and its fine print follow; Restore
// asks, and finds no pass, as a phone that never bought one does; Terms and
// Privacy open the app's own pages. The buy button is the one thing a page
// cannot have, since only the App Store sells the pass, so it says so in
// the system's own alert, and the sheet stays up. Close, a swipe down the
// band, or Escape puts it away.
//
// buildPass(ctx) returns { open(), close(), isOpen(), reset() }.

import { HERE, h, esc, img, reduced, spring, GLYPH, rule } from './pantry-draw.js';

// SeasonPassProduct's fallbacks, which the sheet shows until StoreKit
// answers (and here StoreKit never does)
const ANNUAL = '$29.99';
const MONTHLY = '$4.99';
const PER_MONTH = '$2.50';
// the sheet's spring in and out, and how far down a hand has to pull it
const RISE = spring(0.42, 0.92);
const PULL = 120;

// ScallopSeal: sixteen bumps under a disc, so only their outer arcs show,
// and a white ring inside it
function seal() {
  let bumps = '';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * 2 * Math.PI;
    bumps += `<circle cx="${(36 + Math.cos(a) * 29.5).toFixed(2)}" cy="${(36 + Math.sin(a) * 29.5).toFixed(2)}" r="4.7" />`;
  }
  return `<span class="pp-pw-seal" aria-hidden="true"><svg viewBox="0 0 72 72"><g fill="#ff4b4b" stroke="#000" stroke-width="1.4">${bumps}</g>`
    + '<circle cx="36" cy="36" r="28.5" fill="#ff4b4b" stroke="#000" stroke-width="2" />'
    + '<circle cx="36" cy="36" r="23.25" fill="none" stroke="#fff" stroke-width="1.5" /></svg><b>ALL<br />YEAR</b></span>';
}

// BenefitRow: the free limit each one lifts, named, in the 1.3 words
const PERKS = [
  [`${HERE}hat.webp`, 'Shelves without counting', 'three free, then the chef never stops'],
  [`${HERE}art/broccoli.webp`, 'Scan as often as you shop', 'every trip, not just the first three'],
  [`${HERE}art/cheddar-cheeseburger.webp`, 'A new dish every shelf', 'written the moment it fills'],
];

// PassStub: a radio, the plan, its price, and a punch at either end that
// the unchosen stub's wash does not reach
const stub = (plan, title, subtitle, amount, unit) => `
  <button type="button" class="pp-pw-stub" data-plan="${plan}" role="radio" aria-label="${esc(`${title}, ${amount}${unit}. ${subtitle}`)}">
    <span class="pp-pw-ticket"><span class="pp-pw-radio"></span><span class="pp-pw-plan"><b>${esc(title)}</b><small>${esc(subtitle)}</small></span><span class="pp-pw-price"><b>${esc(amount)}</b><small>${esc(unit)}</small></span></span>
    <i class="is-l"></i><i class="is-r"></i>
  </button>`;

export function buildPass(ctx) {
  let wrap = null;
  let plan = 'annual';
  let error = '';
  let working = false;
  let opener = null;
  // the restore asked for last, so one that answers after its sheet has
  // gone answers nothing
  let asks = 0;

  function paint() {
    if (!wrap) return;
    const annual = plan === 'annual';
    wrap.classList.toggle('is-monthly', !annual);
    wrap.querySelectorAll('.pp-pw-stub').forEach((b) => {
      const on = b.dataset.plan === plan;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', String(on));
    });
    const cta = wrap.querySelector('.pp-pw-cta');
    cta.disabled = working;
    cta.innerHTML = working ? '<span class="pp-spin"></span>'
      : `${GLYPH.star}<span>${annual ? 'Start 7-day free trial' : 'Subscribe'}</span>`;
    // the one line under the button: a live error, or the renewal terms
    const note = wrap.querySelector('.pp-pw-note');
    note.classList.toggle('is-error', !!error);
    note.textContent = error || (annual
      ? `Free for 7 days, then ${ANNUAL}/year. Renews yearly until cancelled. Cancel anytime.`
      : `${MONTHLY}/month. Renews monthly until cancelled. Cancel anytime.`);
  }

  function build() {
    const el = h('div', 'pp-pw', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Season pass' });
    el.innerHTML = `
      <span class="pp-pw-dim"></span>
      <div class="pp-pw-sheet">
        <div class="pp-pw-band">
          <button type="button" class="pp-pw-close" aria-label="Close"><span>${GLYPH.xmark}</span></button>
          <p class="pp-pw-title" role="heading" aria-level="2">Season pass</p>
          ${rule()}
        </div>
        <div class="pp-pw-scroll">
          <div class="pp-pw-card">
            <div class="pp-pw-head" role="img" aria-label="Season pass, all year">
              <p class="pp-pw-shop">PANTRYPAL KITCHEN</p>
              <span class="pp-pw-ornament"></span>
              <p class="pp-pw-word pp-outlined">SEASON PASS</p>
              <p class="pp-pw-serial">No. 0 0 4 8 2 1</p>
            </div>
            <div class="pp-pw-perf" aria-hidden="true"><i class="is-l"></i><i class="is-r"></i></div>
            <ul class="pp-pw-perks">${PERKS.map(([src, title, detail]) => `
              <li aria-label="${esc(`${title}. ${detail}`)}"><span class="pp-pw-perk-art">${img(src)}</span><span class="pp-pw-perk-words"><b>${esc(title)}</b><small>${esc(detail)}</small></span></li>`).join('')}
            </ul>
            ${seal()}
          </div>
        </div>
        <div class="pp-pw-plans">
          <p class="pp-pw-tear">TEAR ONE OFF</p>
          <div class="pp-pw-stubs" role="radiogroup" aria-label="Plan">
            <div class="pp-pw-annual"><p class="pp-pw-cap">7 DAYS FREE, THEN ${ANNUAL}/YEAR</p>${stub('annual', 'One season', `${PER_MONTH} a month, renews yearly`, ANNUAL, '/year')}</div>
            ${stub('monthly', 'One month', 'Renews monthly', MONTHLY, '/month')}
          </div>
        </div>
        <div class="pp-pw-foot">
          ${rule('is-top')}
          <button type="button" class="pp-btn pp-pw-cta"></button>
          <p class="pp-pw-note" aria-live="polite"></p>
          <p class="pp-pw-links"><button type="button" class="pp-pw-restore">Restore</button><a href="https://pantrypal-proxy.vercel.app/terms" target="_blank" rel="noopener">Terms</a><a href="https://pantrypal-proxy.vercel.app/privacy" target="_blank" rel="noopener">Privacy</a></p>
        </div>
      </div>`;
    el.querySelector('.pp-pw-close').addEventListener('click', () => close());
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } });
    el.querySelector('.pp-pw-stubs').addEventListener('click', (e) => {
      const b = e.target.closest('.pp-pw-stub');
      if (!b || b.dataset.plan === plan) return;
      plan = b.dataset.plan;
      paint();
    });
    // Only the App Store sells the pass, so its button says as much, and
    // the sheet stays up for another look.
    el.querySelector('.pp-pw-cta').addEventListener('click', () => {
      if (working) return;
      error = '';
      paint();
      ctx.alert({
        title: 'The pass is on the house here',
        message: 'On a phone, the App Store takes it from here. On this page, every shelf is already free.',
        buttons: [{ label: 'OK' }],
      });
    });
    // Restore asks the store and finds nothing, in SeasonPassStore's words
    el.querySelector('.pp-pw-restore').addEventListener('click', () => {
      if (working) return;
      working = true;
      error = '';
      paint();
      const mine = ++asks;
      setTimeout(() => {
        if (mine !== asks) return;
        working = false;
        error = 'No pass found on this Apple ID.';
        paint();
      }, reduced() ? 0 : 900);
    });
    dragToDismiss(el);
    return el;
  }

  // A pull down the band follows the hand, and let go past PULL it is put
  // away; short of that the sheet springs back up.
  function dragToDismiss(el) {
    const band = el.querySelector('.pp-pw-band');
    const sheet = el.querySelector('.pp-pw-sheet');
    let from = null;
    band.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button')) return;
      from = { y: e.clientY, t: performance.now() };
      band.setPointerCapture(e.pointerId);
    });
    band.addEventListener('pointermove', (e) => {
      if (!from) return;
      const dy = Math.max(0, e.clientY - from.y);
      sheet.style.translate = `0 ${dy}px`;
    });
    const end = (e) => {
      if (!from) return;
      const dy = Math.max(0, e.clientY - from.y);
      const quick = dy / Math.max(1, performance.now() - from.t) > 0.8;
      from = null;
      if (dy > PULL * ctx.pt() || (quick && dy > 24 * ctx.pt())) { close(); return; }
      const at = sheet.style.translate || '0 0';
      sheet.style.translate = '';
      if (!reduced()) sheet.animate([{ translate: at }, { translate: '0 0' }], RISE);
    };
    band.addEventListener('pointerup', end);
    band.addEventListener('pointercancel', end);
  }

  function open() {
    if (wrap) return;
    plan = 'annual';
    error = '';
    working = false;
    opener = document.activeElement;
    wrap = build();
    paint();
    ctx.layer.append(wrap);
    ctx.appEl.querySelector('.pp-stack').inert = true;
    const sheet = wrap.querySelector('.pp-pw-sheet');
    if (!reduced()) {
      wrap.querySelector('.pp-pw-dim').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' });
      sheet.animate([{ translate: '0 100%' }, { translate: '0 0' }], RISE);
    }
    wrap.querySelector('.pp-pw-close').focus({ preventScroll: true });
    ctx.live('Season pass.');
    ctx.stage();
  }

  function close() {
    if (!wrap) return;
    const el = wrap;
    wrap = null;
    working = false;
    asks++;
    el.inert = true;
    ctx.appEl.querySelector('.pp-stack').inert = false;
    if (opener?.isConnected && ctx.root.contains(opener)) opener.focus({ preventScroll: true });
    opener = null;
    ctx.stage();
    if (reduced()) { el.remove(); return; }
    const sheet = el.querySelector('.pp-pw-sheet');
    const at = sheet.style.translate || '0 0';
    el.querySelector('.pp-pw-dim').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease-in', fill: 'forwards' });
    sheet.animate([{ translate: at }, { translate: '0 100%' }], { duration: 320, easing: 'cubic-bezier(0.4, 0, 0.9, 0.6)', fill: 'forwards' })
      .finished.then(() => el.remove(), () => el.remove());
  }

  return {
    open,
    close,
    isOpen: () => !!wrap,
    // a new phone, or a cold launch: nothing up, the layer already cleared
    reset() {
      wrap?.remove();
      wrap = null;
      opener = null;
      working = false;
      asks++;
      ctx.appEl.querySelector('.pp-stack').inert = false;
    },
  };
}
