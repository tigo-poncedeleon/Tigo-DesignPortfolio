// pantry-screens.js — every screen of the app the case study runs but Home
// (pantry-home.js), each as the Swift screen of its name draws it and does
// what it does:
//
//   signup     SignUpScreen, the Kitchen Pass: a name, "Join for free", the
//              kitchen sliding up out of the keyboard's way
//   howto      OnboardingScreen, "How it works!": three tickets falling onto
//              the rail, lit, and the stamp (TicketRailBoard)
//   scanner    ScannerScreen: the two doors, the shot, "Scan it", the
//              beam while the kitchen reads it, and "Found these!" to keep
//              or leave off; each door takes the picture the page carries
//              (a receipt, Tigo's fridge), and the library a real file
//   typein     ManualAddScreen, Type it in! and On the shelf!: the art well
//              finding a food's drawing as it is typed, "Did you mean…",
//              the shelf and the quantity, the staples, the chips to undo
//   shelf      ShelfScreen, My shelf: the wood shelves, a pick to cook with,
//              "Find recipes", a long press to change or remove
//   myrecipes  RecipesScreen, My recipes: the batch just written, and the
//              recipes kept from the cook screen
//   cook       CookScreen, the recipe: its foods, its steps to tick off
//   settings   SettingsScreen, behind the chef
//
// buildScreens(ctx) returns them by name, each { name, view, enter(arg),
// shown(), uncover(), leave(), reset(), stage(), resize() }.

import * as chef from './pantry-chef.js';
import * as kitchen from './pantry-kitchen.js';
import {
  HERE, h, esc, img, reduced, spring, GLYPH, badge, PLUS_BADGE, plate, cardHTML, fitLine,
  art, hydrate, chipName, chipPastel, rule, stepper, inkMark, EXPECTED,
} from './pantry-draw.js';

// what the app says when the kitchen does not answer (ScannerScreen,
// ShelfScreen), by the kind of not answering
const SCAN_SAYS = {
  offline: 'You’re offline — scanning needs a connection.',
  slow: 'That took too long — try again.',
  busy: 'That’s a lot of scanning at once — give it a minute.',
  slammed: 'The kitchen’s slammed right now — try again in a minute.',
  snag: 'Couldn’t read that — try another shot.',
};
const COOK_SAYS = {
  offline: 'You’re offline — the chef can’t reach the kitchen.',
  slow: 'That took too long — give it another go.',
  busy: 'That’s a lot of cooking at once — give it a minute.',
  slammed: 'The kitchen’s slammed right now — try again in a minute.',
  snag: 'Recipe generation hit a snag — try again.',
};
const counted = (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`;
const PRESS = (el, fn) => el.addEventListener('click', fn);

// EstimatedProgressBar: 0.9 · (1 − e^(−t/τ)), never full, the caption over it
function progress(caption, expected = EXPECTED) {
  const el = h('div', 'pp-wait is-free');
  el.innerHTML = `<p>${esc(caption)}</p><span class="pp-track"><i></i></span>`;
  const fill = el.querySelector('i');
  const start = performance.now();
  const at = (s) => 0.9 * (1 - Math.exp(-s / (expected / 1.8)));
  const paint = () => { fill.style.width = `max(calc(10 * var(--pt)), ${(at((performance.now() - start) / 1000) * 100).toFixed(2)}%)`; };
  paint();
  const tick = setInterval(() => { if (!el.isConnected) { clearInterval(tick); return; } paint(); }, reduced() ? 800 : 50);
  el.caption = (text) => { el.querySelector('p').textContent = text; };
  return el;
}

export function buildScreens(ctx) {
  const { MEAL } = ctx;
  const st = () => ctx.state;

  // ======================================================================
  // the Kitchen Pass (SignUpScreen)
  // ======================================================================
  const signup = (() => {
    const view = h('section', 'pp-view pp-signup', { 'aria-label': 'Join the kitchen', inert: '' });
    view.innerHTML = `
      <div class="pp-scene">${img(`${HERE}kitchen-scene.webp`, 'pp-kitchen')}${img(`${HERE}chrome-signup.webp`, 'pp-chrome')}</div>
      <div class="pp-passroll">
        <div class="pp-pass">
          <div class="pp-pass-band"><span class="pp-pass-dot"></span><span class="pp-outlined">KITCHEN PASS</span>${img(`${HERE}hat.webp`)}</div>
          <div class="pp-pass-body">
            <label class="pp-field"><span class="pp-ph">Your name</span><input class="pp-input" type="text" maxlength="30" autocomplete="off" autocapitalize="words" spellcheck="false" enterkeyhint="done" aria-label="Your name" /></label>
            <p class="pp-ferr" role="alert" hidden></p>
            <button type="button" class="pp-btn pp-join"><span class="pp-outlined is-thin">Join for free</span></button>
            <p class="pp-consent">By continuing you agree to the <a href="https://pantrypal-proxy.vercel.app/terms" target="_blank" rel="noopener">Terms</a> and the <a href="https://pantrypal-proxy.vercel.app/privacy" target="_blank" rel="noopener">Privacy Policy</a>.</p>
          </div>
          <div class="pp-pass-foot"><span class="pp-pass-no">No. 001</span><span class="pp-pass-pick" hidden>Already here? <button type="button">Pick a chef</button></span></div>
        </div>
      </div>`;
    const input = view.querySelector('.pp-input');
    const field = view.querySelector('.pp-field');
    const err = view.querySelector('.pp-ferr');
    const join = view.querySelector('.pp-join');
    const pass = view.querySelector('.pp-pass');
    const pick = view.querySelector('.pp-pass-pick');
    let adding = false;
    const paintField = () => field.classList.toggle('is-empty', input.value === '');
    input.addEventListener('input', () => {
      paintField();
      if (input.value.trim()) { err.hidden = true; field.classList.remove('is-error'); }
    });
    ctx.kbd.bind(input, { onReturn: () => (input.value.trim() ? submit() : input.blur()) });
    // Typing: the kitchen, the header and the band slide up out of the way,
    // and the pass rides up until its foot is 24 over the keyboard
    // (keepsSubmitAboveKeyboard anchors the scroll at the bottom).
    ctx.kbd.on('show', () => {
      if (ctx.top() !== api) return;
      view.classList.add('is-typing');
      const k = ctx.pt();
      const bottom = (pass.offsetTop + pass.offsetHeight) / k;
      pass.style.translate = `0 ${Math.min(0, 517 - 24 - bottom) * k}px`;
    });
    ctx.kbd.on('hide', () => {
      view.classList.remove('is-typing');
      pass.style.translate = '';
    });
    input.addEventListener('focus', () => field.classList.add('is-focused'));
    input.addEventListener('blur', () => field.classList.remove('is-focused'));
    // a press on the pass off the field puts the keyboard away
    view.querySelector('.pp-passroll').addEventListener('pointerdown', (e) => {
      if (!e.target.closest('.pp-field, .pp-btn, a, button')) input.blur();
    });
    PRESS(join, submit);
    PRESS(pick.querySelector('button'), () => ctx.pop());
    function submit() {
      const name = input.value.trim();
      if (!name) {
        err.textContent = 'Tell us what to call you.';
        err.hidden = false;
        field.classList.add('is-error');
        input.focus({ preventScroll: true });
        return;
      }
      input.blur();
      ctx.kbd.detach();
      if (adding) ctx.newChef(name);
      else ctx.enterApp(name);
    }
    const api = {
      name: 'signup',
      view,
      enter(arg = {}) {
        adding = !!arg.adding;
        input.value = '';
        err.hidden = true;
        field.classList.remove('is-error');
        paintField();
        pick.hidden = !adding;
        view.querySelector('.pp-pass-no').textContent = `No. ${String(st().chefs + 1).padStart(3, '0')}`;
      },
      leave() { input.blur(); },
      stage: () => 'signup',
      reset() { input.value = ''; paintField(); },
    };
    return api;
  })();

  // ======================================================================
  // How it works! (OnboardingScreen, TicketRailBoard)
  // ======================================================================
  const howto = (() => {
    const view = ctx.chromeView('pp-howto', 'chrome-howto.webp', { label: 'How it works', logo: false });
    const tickets = [
      [art('Tomato', { cls: 'is-food' }), 'YOUR INGREDIENTS'],
      [img(`${HERE}wardrobe.webp`, 'pp-art is-wardrobe'), 'PANTRYPAL THINKS'],
      [art(MEAL.showcase, { cls: 'is-food', dish: true }), MEAL.flap],
    ];
    const bulbs = (side) => Array.from({ length: 5 }, (_, i) => `<i class="${i % 2 ? 'is-coral' : ''}"></i>`).join('');
    view.insertAdjacentHTML('beforeend', `
      <div class="pp-tourwrap">
        <div class="pp-tour">
          <div class="pp-tour-head">${img(`${HERE}tab-wood.webp`, 'pp-tour-wood')}<span class="pp-outlined">${MEAL.header}</span></div>
          <div class="pp-tickets">${tickets.map(([a, word], i) => `<div class="pp-ticket${i === 2 ? ' is-payoff' : ''}" data-i="${i}"><span class="pp-stub">${a}</span><span class="pp-perf"></span><span class="pp-tword">${word}</span></div>`).join('')}</div>
          <span class="pp-bulbs is-left">${bulbs()}</span><span class="pp-bulbs is-right">${bulbs()}</span><span class="pp-bulbs is-bottom">${bulbs()}</span>
          <span class="pp-stamp">EVERY MEAL!</span>
        </div>
        <span class="pp-tour-shadow"></span>
      </div>
      <div class="pp-foot">${rule('is-top')}<button type="button" class="pp-btn pp-start">Get started</button></div>`);
    const board = view.querySelector('.pp-tour');
    const ticketEls = [...view.querySelectorAll('.pp-ticket')];
    const stamp = view.querySelector('.pp-stamp');
    const start = view.querySelector('.pp-start');
    let timers = [];
    const after = (s, fn) => timers.push(setTimeout(fn, s * 1000));
    function stop() { timers.forEach(clearTimeout); timers = []; }
    // a tap anywhere on the tour, or Get started, is done with it
    view.addEventListener('click', (e) => {
      if (e.target.closest('.pp-hit')) return;
      finish();
    });
    function finish() {
      if (ctx.top() !== api) return;
      st().seenTour = true;
      ctx.popToRoot();
    }
    function shake() {
      for (const [delay, y] of [[0, 7], [0.07, -4], [0.14, 2], [0.2, 0]]) {
        after(delay, () => board.animate([{}, { translate: `0 ${y * ctx.pt()}px` }], { duration: 60, easing: 'ease-out', fill: 'forwards' }));
      }
    }
    // Each ticket arrives oversized and see-through, drops onto the rail,
    // squashes on the hit while the board dips, and lights a beat later;
    // the stamp lands last. The show runs once a visit.
    function land(i) {
      const t = ticketEls[i];
      t.classList.add('is-landed');
      t.animate([{ scale: 1.75, rotate: '-8deg', opacity: 0.35 }, { scale: 1, rotate: '0deg', opacity: 1 }], { duration: 200, easing: 'ease-in', fill: 'backwards' });
      after(0.2, () => {
        t.animate([{ scale: '1 1' }, { scale: '1.05 0.9', offset: 0.3 }, { scale: '1 1' }], { duration: 400, easing: 'ease-out' });
        t.classList.add('is-hit');
        after(0.3, () => t.classList.remove('is-hit'));
        shake();
      });
      after(0.42, () => t.classList.add('is-lit'));
    }
    function run() {
      stop();
      ticketEls.forEach((t) => t.classList.remove('is-landed', 'is-lit', 'is-hit'));
      stamp.classList.remove('is-stamped');
      if (reduced()) {
        ticketEls.forEach((t) => t.classList.add('is-landed', 'is-lit'));
        stamp.classList.add('is-stamped');
        return;
      }
      let t = 0.45;
      ticketEls.forEach((_, i) => { after(t, () => land(i)); t += 0.85; });
      after(t - 0.15, () => {
        stamp.classList.add('is-stamped');
        stamp.animate([{ scale: 1.8, opacity: 0 }, { scale: 1, opacity: 1 }], spring(0.3, 0.5));
        shake();
      });
    }
    function fit() {
      // the board at its reference size, shrunk only if the room is short
      const k = ctx.pt();
      const room = (view.querySelector('.pp-tourwrap').clientHeight / k) - 29;
      board.parentElement.style.scale = String(Math.min(1, room / 464, (393 - 48) / 336));
    }
    const api = {
      name: 'howto',
      view,
      enter() { hydrate(view, { generate: false }); fit(); run(); },
      leave: stop,
      stage: () => 'howto',
      resize: fit,
    };
    return api;
  })();

  // ======================================================================
  // the scanner (ScannerScreen)
  // ======================================================================
  const scanner = (() => {
    const view = ctx.chromeView('pp-scanner', 'chrome-scan.webp', { label: 'Scan it in', back: () => back() });
    view.insertAdjacentHTML('beforeend', `
      <div class="pp-doors">
        ${img(`${HERE}scan-doors.webp`, 'pp-doorart')}
        <button type="button" class="pp-hit is-receipt" aria-label="Photograph a receipt"></button>
        <button type="button" class="pp-hit is-food" aria-label="Photograph your food"></button>
        <div class="pp-library"><button type="button" class="pp-btn pp-libbtn">${GLYPH.photo}<span>Choose from library</span></button></div>
      </div>
      <div class="pp-review">
        <div class="pp-shot"><img alt="" draggable="false" /><span class="pp-beam"><i></i></span><svg class="pp-shotline"><rect /></svg></div>
        <p class="pp-serr" role="alert"></p>
        <div class="pp-decide">
          <button type="button" class="pp-tab is-reject">${inkMark(false, '#ff4b4b')}<span>Retake</span></button>
          <button type="button" class="pp-tab is-accept">${inkMark(true, '#fff')}<span class="pp-outlined is-tab">Scan it</span></button>
        </div>
        <div class="pp-reading"><p class="pp-outlined">Scanning it…</p></div>
      </div>
      <div class="pp-found">
        <div class="pp-found-head"><p>Tap one to leave it off.</p><span class="pp-found-count"></span></div>
        <div class="pp-found-list"></div>
        <div class="pp-found-foot">${rule('is-top')}<button type="button" class="pp-btn pp-keep"></button></div>
      </div>
      <input class="pp-file" type="file" accept="image/*" hidden />
      <span class="pp-flash" aria-hidden="true"></span>`);
    const chrome = view.querySelector('.pp-chrome');
    const shotImg = view.querySelector('.pp-shot img');
    const serr = view.querySelector('.pp-serr');
    const reading = view.querySelector('.pp-reading');
    const list = view.querySelector('.pp-found-list');
    const countEl = view.querySelector('.pp-found-count');
    const keep = view.querySelector('.pp-keep');
    const file = view.querySelector('.pp-file');
    const accept = view.querySelector('.is-accept');
    const STAGES = { framing: ['chrome-scan.webp', 'Scan it in'], captured: ['chrome-looks.webp', 'Looks good?'], reading: ['chrome-scanning.webp', 'Scanning…'], confirming: ['chrome-found.webp', 'Found these!'] };
    // the pictures the page carries for the camera: a receipt from the
    // corner shop, and the photo of Tigo's fridge the App Store listing
    // shows, each with the name the kitchen knows it by
    const PICTURES = { receipt: [`${HERE}scan-receipt.webp`, 'receipt'], food: [`${HERE}../fridge.webp`, 'fridge'] };
    let stage = 'framing';
    let intent = 'receipt';
    let shot = null;
    let shotName = null;
    let found = [];
    let attempt = 0;
    let bar = null;
    const noun = () => (intent === 'receipt' ? 'receipt' : 'photo');
    function go(next) {
      stage = next;
      view.dataset.stage = next;
      chrome.src = `${HERE}${STAGES[next][0]}`;
      view.setAttribute('aria-label', STAGES[next][1]);
      ctx.stage();
    }
    // a door is the camera; here it is the shutter, and the picture
    function capture(kind) {
      intent = kind;
      const flash = view.querySelector('.pp-flash');
      if (!reduced()) flash.animate([{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }], { duration: 420, easing: 'ease-out' });
      setTimeout(() => take(...PICTURES[kind]), reduced() ? 0 : 160);
    }
    function take(src, name = null) {
      attempt++;
      shot = src;
      shotName = name;
      shotImg.src = src;
      serr.textContent = '';
      go('captured');
    }
    PRESS(view.querySelector('.is-receipt'), () => capture('receipt'));
    PRESS(view.querySelector('.is-food'), () => capture('food'));
    PRESS(view.querySelector('.pp-libbtn'), () => { file.value = ''; file.click(); });
    file.addEventListener('change', () => {
      const f = file.files?.[0];
      if (!f) return;
      intent = 'food';
      take(URL.createObjectURL(f));
    });
    PRESS(view.querySelector('.is-reject'), () => capture(intent));
    PRESS(accept, runScan);
    function back() {
      if (stage === 'framing') { ctx.pop(); return; }
      attempt++;
      if (stage === 'captured') { shot = null; serr.textContent = ''; go('framing'); return; }
      bar?.remove();
      go('captured');
    }
    // The beam sweeps the shot every 1.7 seconds (ScanBeam), and a reading
    // that comes back sooner still lets it sweep twice: the kitchen answers
    // the page's own pictures faster than a phone's upload would let it.
    const BEAM_PASSES = 2 * 1700 + 150;
    async function runScan() {
      if (!shot) return;
      const mine = ++attempt;
      const began = performance.now();
      const beamed = () => new Promise((done) => setTimeout(done, Math.max(0, BEAM_PASSES - (performance.now() - began))));
      serr.textContent = '';
      go('reading');
      bar?.remove();
      bar = progress(`Packing up your ${noun()}…`, 8);
      reading.append(bar);
      try {
        let items;
        if (shotName) {
          // one of the page's own pictures: only its name goes
          bar.caption(`Reading the ${noun()}…`);
          items = await kitchen.scanPicture(shotName);
        } else {
          const blob = await (await fetch(shot)).blob();
          const jpeg = await kitchen.photoJPEG(blob);
          if (mine !== attempt) return;
          bar.caption(`Reading the ${noun()}…`);
          items = await kitchen.scan(jpeg);
        }
        await beamed();
        if (mine !== attempt) return;
        if (!items.length) {
          serr.textContent = `No food found in that ${noun()} — try again.`;
          go('captured');
          return;
        }
        present(items);
      } catch (err) {
        if (mine !== attempt) return;
        console.warn('PantryPal: the scan did not come back:', err?.kind || err);
        // one of the page's own pictures is never a dead end: what the
        // kitchen read off it before stands in for what it would read now
        if (shotName) {
          const kept = await kitchen.recordedReading(shotName).catch(() => []);
          await beamed();
          if (mine !== attempt) return;
          if (kept.length) { present(kept); return; }
        }
        serr.textContent = SCAN_SAYS[err?.kind] || SCAN_SAYS.snag;
        go('captured');
      }
    }
    // "Found these!": every row kept until it is tapped, its quantity
    // stepped down to nothing and back by its pill
    function present(items) {
      found = items.map((it, i) => ({ ...it, id: i, original: it.quantity, rejected: false }));
      list.innerHTML = found.map((it) => `
        <div class="pp-frow" data-id="${it.id}" role="button" tabindex="0">
          <span class="pp-frow-art">${art(it.name, { tile: chef.PASTEL[it.shelf] })}</span>
          <span class="pp-frow-name"><b>${esc(it.name)}</b><small>${chef.SHELF_TITLE[it.shelf]}</small></span>
          <button type="button" class="pp-frow-qty" aria-label="Quantity"></button>
          <span class="pp-frow-mark">${badge(28)}<svg class="pp-ring" viewBox="0 0 28 25"><ellipse cx="14" cy="12.5" rx="13.5" ry="12" /></svg></span>
        </div>`).join('');
      hydrate(list);
      paintFound();
      go('confirming');
      list.scrollTop = 0;
    }
    const keeping = () => found.filter((it) => !it.rejected && it.quantity > 0);
    function paintFound() {
      for (const it of found) {
        const row = list.querySelector(`[data-id="${it.id}"]`);
        const kept = !it.rejected && it.quantity > 0;
        row.classList.toggle('is-off', !kept);
        row.querySelector('.pp-frow-qty').textContent = `×${it.quantity}`;
        row.setAttribute('aria-label', `${it.name}, ${chef.SHELF_TITLE[it.shelf]}, quantity ${it.quantity}${kept ? '' : ', left off'}`);
      }
      const n = keeping().length;
      countEl.textContent = `${n} of ${found.length}`;
      keep.disabled = n === 0;
      keep.innerHTML = n ? `${GLYPH.plus}<span>Add ${n} to my shelf</span>` : `${GLYPH.plus}<span>Nothing selected</span>`;
    }
    list.addEventListener('click', (e) => {
      const row = e.target.closest('.pp-frow');
      if (!row) return;
      const it = found[Number(row.dataset.id)];
      if (e.target.closest('.pp-frow-qty')) {
        it.quantity = it.quantity > 0 ? it.quantity - 1 : it.original;
      } else {
        it.rejected = !it.rejected;
      }
      paintFound();
    });
    list.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('pp-frow')) { e.preventDefault(); e.target.click(); }
    });
    PRESS(keep, () => {
      const items = keeping();
      if (!items.length) return;
      for (const it of items) ctx.add(it.name, it.shelf, it.quantity);
      st().held = false;
      ctx.changed(items.map((it) => it.name));
      ctx.live(`${counted(items.length, 'ingredient')} on your shelf.`);
      ctx.pop();
    });
    const api = {
      name: 'scanner',
      view,
      enter() { attempt++; shot = null; found = []; go('framing'); },
      leave() { attempt++; bar?.remove(); },
      stage: () => `scan-${stage}`,
    };
    return api;
  })();

  return { signup, howto, scanner, ...buildMore(ctx) };
}

// the rest, in the order a chef meets them
function buildMore(ctx) {
  const { MEAL } = ctx;
  const st = () => ctx.state;
  const capitalized = (s) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

  // ======================================================================
  // Type it in! and On the shelf! (ManualAddScreen)
  // ======================================================================
  const typein = (() => {
    const view = ctx.chromeView('pp-typein', 'chrome-typein.webp', { label: 'Type it in', back: () => leave() });
    view.insertAdjacentHTML('beforeend', `
      <span class="pp-onshelf" aria-hidden="true"><span>On the shelf!</span></span>
      <div class="pp-tscroll"><div class="pp-tin">
        <div class="pp-entry">
          <svg class="pp-dash"><rect /></svg>
          <span class="pp-well">${GLYPH.well}<img class="pp-wellart" alt="" draggable="false" /></span>
          <input class="pp-tinput" type="text" placeholder="Ingredient name" maxlength="60" autocomplete="off" autocapitalize="words" spellcheck="false" enterkeyhint="done" aria-label="Ingredient name" />
          <button type="button" class="pp-addbadge" aria-label="Add ingredient">${PLUS_BADGE}</button>
          <div class="pp-entry-row">
            <button type="button" class="pp-catchip" aria-haspopup="true"><span></span>${GLYPH.chevron}</button>
            <span class="pp-qty">
              <button type="button" class="pp-stepbtn is-minus" aria-label="Decrease quantity">${stepper(true, 14)}</button>
              <span class="pp-qn" aria-live="polite">1</span>
              <button type="button" class="pp-stepbtn is-plus" aria-label="Increase quantity">${stepper(false, 14)}</button>
            </span>
          </div>
        </div>
        <div class="pp-picker" hidden>${chef.SHELVES.map((s) => `<button type="button" class="pp-shelfchip" data-shelf="${s}" aria-label="${chef.SHELF_TITLE[s]} shelf"><span style="background: ${chef.PASTEL[s]}"><span class="pp-outlined">${chef.SHELF_TITLE[s]}</span></span></button>`).join('')}</div>
        <div class="pp-suggest" hidden><p class="pp-tlabel is-quiet">Did you mean…</p><div class="pp-srow"></div></div>
        <div class="pp-added" hidden><p class="pp-tlabel">On your shelf now<span> · tap to undo</span></p><div class="pp-tgrid is-added" role="group" aria-label="On your shelf now"></div></div>
        <div class="pp-staples" hidden><p class="pp-tlabel is-quiet">Or grab a staple</p><div class="pp-tgrid is-staples" role="group" aria-label="Or grab a staple"></div></div>
      </div></div>
      <div class="pp-donebar">${rule('is-top')}<button type="button" class="pp-btn pp-bar"></button></div>`);
    const $ = (q) => view.querySelector(q);
    const input = $('.pp-tinput');
    const entry = $('.pp-entry');
    const wellArt = $('.pp-wellart');
    const addBadge = $('.pp-addbadge');
    const catChip = $('.pp-catchip');
    const qn = $('.pp-qn');
    const minus = $('.is-minus');
    const picker = $('.pp-picker');
    const suggest = $('.pp-suggest');
    const srow = $('.pp-srow');
    const addedGrid = $('.pp-tgrid.is-added');
    const stapleGrid = $('.pp-tgrid.is-staples');
    const tscroll = $('.pp-tscroll');
    const bar = $('.pp-bar');
    let batch = false;
    let added = [];
    let category = 'produce';
    let pinned = false;
    let qty = 1;
    let pickerOpen = false;
    const trimmed = () => input.value.trim();

    const nameChip = (text) => `<button type="button" class="pp-tchip is-staple" data-name="${esc(text)}" aria-label="Add ${esc(text)}">${GLYPH.plus}${art(text)}<span>${esc(text)}</span></button>`;
    function slot() {
      if (trimmed()) return 'add';
      return ctx.kbd.isUp() ? 'hide' : 'see';
    }
    function paintBar() {
      const s = slot();
      bar.className = `pp-btn pp-bar is-${s === 'hide' ? 'secondary' : 'primary'}`;
      if (s === 'add') { bar.innerHTML = '<span>Add</span>'; bar.setAttribute('aria-label', `Add ${trimmed()} to the shelf`); }
      else if (s === 'hide') { bar.innerHTML = `<span>Hide keyboard</span>${GLYPH.chevron}`; bar.setAttribute('aria-label', 'Hide keyboard'); }
      else if (st().held) { bar.innerHTML = `${GLYPH.fork}<span>See what I can cook</span>`; bar.setAttribute('aria-label', 'See what I can cook'); }
      else { bar.innerHTML = `${GLYPH.check}<span>Done</span>`; bar.setAttribute('aria-label', 'Done'); }
    }
    // the field and what hangs off it, as the name stands now
    function paintEntry() {
      const name = trimmed();
      const can = !!name;
      entry.classList.toggle('is-ready', can);
      // the art well finds the drawing as the name is typed, and never asks
      // for a new one while it is being typed
      const url = can ? kitchen.drawingNow(capitalized(name)) : null;
      entry.classList.toggle('is-named', can);
      wellArt.hidden = !url;
      if (url && wellArt.getAttribute('src') !== url) wellArt.src = url;
      addBadge.disabled = !can;
      addBadge.setAttribute('aria-label', can ? `Add ${name}` : 'Add ingredient');
      catChip.firstElementChild.textContent = chef.SHELF_TITLE[category];
      catChip.style.background = chef.PASTEL[category];
      catChip.setAttribute('aria-label', `Shelf: ${chef.SHELF_TITLE[category]}`);
      catChip.classList.toggle('is-open', pickerOpen);
      qn.textContent = String(qty);
      minus.disabled = qty === 1;
      picker.hidden = !(can && pickerOpen);
      picker.querySelectorAll('.pp-shelfchip').forEach((b) => b.classList.toggle('is-on', b.dataset.shelf === category));
      const ideas = chef.suggestions(name);
      suggest.hidden = !ideas.length;
      srow.innerHTML = ideas.map(nameChip).join('');
      hydrate(srow, { generate: false });
      const staples = chef.QUICK_ADD.filter((n) => !added.some((a) => a.name.toLowerCase() === n.toLowerCase()));
      $('.pp-staples').hidden = !!name || !staples.length;
      stapleGrid.innerHTML = staples.map(nameChip).join('');
      hydrate(stapleGrid, { generate: false });
      paintBar();
    }
    function paintAdded() {
      $('.pp-added').hidden = !added.length;
      addedGrid.innerHTML = added.map((a, i) => `<button type="button" class="pp-tchip" data-i="${i}" style="background: ${chef.PASTEL[a.shelf]}" aria-label="Remove ${esc(a.name)}">${art(a.name)}<span>${esc(a.quantity > 1 ? `${a.name} ×${a.quantity}` : a.name)}</span>${GLYPH.x}</button>`).join('');
      hydrate(addedGrid);
    }
    input.addEventListener('input', () => {
      if (!pinned) {
        const completion = chef.suggestions(trimmed(), new Set(), 1)[0];
        category = chef.shelfOf(completion || trimmed());
      }
      if (!trimmed()) pickerOpen = false;
      paintEntry();
    });
    ctx.kbd.bind(input, { onReturn: () => (trimmed() ? add(trimmed()) : input.blur()) });
    ctx.kbd.on('show', () => { if (ctx.top() === api) { view.classList.add('is-keyed'); paintBar(); } });
    ctx.kbd.on('hide', () => { view.classList.remove('is-keyed'); paintBar(); });
    PRESS(addBadge, () => add(trimmed()));
    PRESS($('.pp-well'), () => { if (trimmed()) add(trimmed()); });
    PRESS(catChip, () => { pickerOpen = !pickerOpen; paintEntry(); });
    PRESS(minus, () => { qty = Math.max(1, qty - 1); paintEntry(); });
    PRESS($('.is-plus'), () => { qty = Math.min(99, qty + 1); paintEntry(); });
    picker.addEventListener('click', (e) => {
      const b = e.target.closest('.pp-shelfchip');
      if (!b) return;
      category = b.dataset.shelf;
      pinned = true;
      pickerOpen = false;
      paintEntry();
    });
    for (const grid of [srow, stapleGrid]) {
      grid.addEventListener('click', (e) => {
        const b = e.target.closest('.pp-tchip');
        if (b) add(b.dataset.name);
      });
    }
    addedGrid.addEventListener('click', (e) => {
      const b = e.target.closest('.pp-tchip');
      if (b) undo(added[Number(b.dataset.i)]);
    });
    // keys a hand presses on the page's own keyboard keep the caret
    for (const el of [addBadge, catChip, minus, $('.is-plus'), picker, srow, stapleGrid, addedGrid, bar]) {
      el.addEventListener('pointerdown', (e) => { if (document.activeElement === input) e.preventDefault(); });
    }
    PRESS(bar, () => {
      const s = slot();
      if (s === 'add') add(trimmed());
      else if (s === 'hide') input.blur();
      else if (st().held) { ctx.releaseHome(); ctx.popToRoot(); }
      else leave();
    });
    // A name onto the shelf: the field's own shelf and count for what was
    // typed, the guess and one for a suggestion or a staple; the field
    // cleared for the next, the keyboard kept up.
    function add(raw, refocus = true) {
      const cleaned = chef.smartCapitalized(raw.trim());
      if (!cleaned) return;
      const fromField = cleaned.toLowerCase() === trimmed().toLowerCase();
      const shelf = fromField ? category : chef.shelfOf(cleaned);
      const count = fromField ? qty : 1;
      ctx.add(cleaned, shelf, count);
      const had = added.find((a) => a.name.toLowerCase() === cleaned.toLowerCase() && a.shelf === shelf);
      if (had) had.quantity += count;
      else added.push({ name: cleaned, shelf, quantity: count });
      input.value = '';
      qty = 1;
      pinned = false;
      pickerOpen = false;
      paintAdded();
      paintEntry();
      ctx.changed([cleaned]);
      ctx.live(`${cleaned} is on the shelf.`);
      const chip = addedGrid.querySelector(`[data-i="${added.indexOf(had || added[added.length - 1])}"]`);
      if (chip && !reduced()) chip.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
      if (refocus && ctx.kbd.isUp()) input.focus({ preventScroll: true });
    }
    function undo(item) {
      const row = st().shelf.find((s) => s.name.toLowerCase() === item.name.toLowerCase() && s.shelf === item.shelf);
      if (row) {
        row.quantity -= item.quantity;
        if (row.quantity <= 0) ctx.remove([row]);
      }
      added = added.filter((a) => a !== item);
      paintAdded();
      paintEntry();
      ctx.changed([]);
      ctx.live(`Took ${item.name} off the shelf.`);
    }
    function leave() { ctx.pop(); }
    const api = {
      name: 'typein',
      view,
      enter(arg = {}) {
        batch = !!arg.batch;
        view.classList.toggle('is-batch', batch);
        view.setAttribute('aria-label', batch ? 'On the shelf' : 'Type it in');
        added = [];
        category = arg.shelf || 'produce';
        pinned = false;
        qty = 1;
        pickerOpen = false;
        input.value = '';
        // reopened while the welcome holds, everything on the shelf was
        // added here, so the page remembers it all
        if (!batch && st().held) added = st().shelf.map((s) => ({ name: s.name, shelf: s.shelf, quantity: s.quantity }));
        paintAdded();
        paintEntry();
        tscroll.scrollTop = 0;
        if (batch) for (const name of arg.batch) add(name, false);
      },
      shown() { if (!batch) input.focus({ preventScroll: true }); },
      leave() { input.blur(); },
      stage: () => (batch ? 'onshelf' : 'typein'),
    };
    return api;
  })();

  // ======================================================================
  // My shelf (ShelfScreen)
  // ======================================================================
  const shelf = (() => {
    const view = ctx.chromeView('pp-shelf', 'chrome-shelf.webp', { label: 'My shelf', back: () => ctx.pop() });
    view.insertAdjacentHTML('beforeend', `
      <button type="button" class="pp-hit is-add" aria-label="Add ingredients"></button>
      <div class="pp-sscroll"><div class="pp-cats"></div><div class="pp-clearwrap"><button type="button" class="pp-btn pp-clear is-danger">${GLYPH.trash}<span>Clear my shelf</span></button></div></div>
      <div class="pp-sempty" hidden>${img(`${HERE}mascot.webp`, 'pp-sempty-chef')}<p class="pp-sempty-title">Your shelf is empty.</p><p class="pp-sempty-body">Scan a receipt or type a few things in, and I’ll start suggesting ${MEAL.noun} ideas.</p><button type="button" class="pp-btn pp-sempty-add">Add ingredients</button></div>
      <div class="pp-drawer" hidden>
        <p class="pp-drawer-label"><b>${MEAL.leading} picks</b><span> · tap one to drop it</span></p>
        <div class="pp-picks"></div>
        <button type="button" class="pp-btn pp-find"></button>
        <button type="button" class="pp-btn pp-removesel is-danger"></button>
        <div class="pp-drawer-note"></div>
      </div>
      <div class="pp-modal" hidden></div>`);
    const $ = (q) => view.querySelector(q);
    const cats = $('.pp-cats');
    const scroll = $('.pp-sscroll');
    const empty = $('.pp-sempty');
    const drawer = $('.pp-drawer');
    const picksEl = $('.pp-picks');
    const find = $('.pp-find');
    const removeSel = $('.pp-removesel');
    const note = $('.pp-drawer-note');
    const modal = $('.pp-modal');
    let generating = null;
    let asked = 0;
    const picks = () => st().shelf.filter((s) => s.selected);
    // the grid's three columns, as the shelf's rails divide it
    const CELL = (s) => `
      <button type="button" class="pp-cell${s.selected ? ' is-picked' : ''}" data-id="${s.id}" aria-pressed="${s.selected}" aria-label="${esc(s.name)}, quantity ${s.quantity}">
        <span class="pp-tagwrap"><span class="pp-tag">${esc(s.name)}</span></span>
        <span class="pp-cellart">${art(s.name, { tile: chef.PASTEL[s.shelf] })}<span class="pp-badges">${s.selected ? badge(25) : ''}<span class="pp-qbadge">${s.quantity}</span></span></span>
      </button>`;
    function paint() {
      const rows = st().shelf;
      const stocked = chef.SHELVES.filter((c) => rows.some((s) => s.shelf === c));
      empty.hidden = rows.length > 0;
      scroll.hidden = rows.length === 0;
      cats.innerHTML = stocked.map((c) => {
        const items = rows.filter((s) => s.shelf === c);
        const lines = Math.max(1, Math.ceil((items.length + 1) / 3));
        return `<section class="pp-cat" aria-label="${chef.SHELF_TITLE[c]} shelf">
          <h3 class="pp-wood"><span class="pp-outlined">${chef.SHELF_TITLE[c]}</span></h3>
          <div class="pp-sgrid" style="--rows: ${lines}">${items.map(CELL).join('')}<button type="button" class="pp-addcell" data-shelf="${c}" aria-label="Add to the ${chef.SHELF_TITLE[c]} shelf">${stepper(false, 24)}<span>Add</span></button></div>
        </section>`;
      }).join('');
      hydrate(cats);
      paintDrawer();
    }
    function paintDrawer() {
      const p = picks();
      drawer.hidden = !p.length;
      view.classList.toggle('has-drawer', p.length > 0);
      if (!p.length) return;
      picksEl.innerHTML = p.map((s) => `<button type="button" class="pp-pick" data-id="${s.id}" aria-label="Remove ${esc(s.name)} from ${MEAL.possessive} picks">${art(s.name, { tile: chef.PASTEL[s.shelf] })}</button>`).join('');
      hydrate(picksEl);
      find.disabled = !!generating;
      removeSel.disabled = !!generating;
      find.innerHTML = generating ? '<span class="pp-spin"></span><span>Chef’s thinking…</span>' : `${GLYPH.search}<span>Find recipes with ${counted(p.length, 'item')}</span>`;
      removeSel.innerHTML = `<span>Remove ${p.length} from shelf</span>`;
      requestAnimationFrame(() => { scroll.style.paddingBottom = `${drawer.offsetHeight}px`; });
    }
    const byId = (id) => st().shelf.find((s) => s.id === Number(id));
    // a tap picks; a long press (or a right click) opens the editor
    let pressTimer = 0;
    let pressed = null;
    cats.addEventListener('pointerdown', (e) => {
      const cell = e.target.closest('.pp-cell');
      if (!cell) return;
      pressed = { cell, x: e.clientX, y: e.clientY, long: false };
      pressTimer = setTimeout(() => { if (pressed) { pressed.long = true; editor(byId(cell.dataset.id)); } }, 500);
    });
    cats.addEventListener('pointermove', (e) => {
      if (pressed && Math.hypot(e.clientX - pressed.x, e.clientY - pressed.y) > 10) { clearTimeout(pressTimer); pressed = null; }
    });
    const lift = () => clearTimeout(pressTimer);
    cats.addEventListener('pointerup', lift);
    cats.addEventListener('pointercancel', () => { lift(); pressed = null; });
    cats.addEventListener('contextmenu', (e) => {
      const cell = e.target.closest('.pp-cell');
      if (!cell) return;
      e.preventDefault();
      lift();
      editor(byId(cell.dataset.id));
    });
    cats.addEventListener('click', (e) => {
      const add = e.target.closest('.pp-addcell');
      if (add) { chooser(add.dataset.shelf); return; }
      const cell = e.target.closest('.pp-cell');
      if (!cell) return;
      if (pressed?.long) { pressed = null; return; }
      pressed = null;
      const row = byId(cell.dataset.id);
      if (!row || generating) return;
      row.selected = !row.selected;
      paint();
    });
    PRESS(picksEl, (e) => {
      const b = e.target.closest('.pp-pick');
      if (!b || generating) return;
      byId(b.dataset.id).selected = false;
      paint();
    });
    PRESS($('.is-add'), () => chooser(chef.SHELVES.find((c) => st().shelf.some((s) => s.shelf === c)) || 'meat'));
    PRESS($('.pp-sempty-add'), () => chooser('meat'));
    PRESS($('.pp-clear'), () => {
      const n = st().shelf.length;
      ctx.alert({
        title: `Clear ${counted(n, 'ingredient')} off your shelf?`,
        message: 'Everything comes off, quantities and all — you’d have to add it all back.',
        buttons: [{ label: 'Clear shelf', role: 'destructive', action: () => { ctx.remove([...st().shelf]); ctx.changed([]); paint(); } }, { label: 'Cancel', role: 'cancel' }],
      });
    });
    PRESS(removeSel, () => {
      const p = picks();
      ctx.alert({
        title: `Take ${counted(p.length, 'ingredient')} off the shelf?`,
        message: 'They come off your shelf, quantities and all — add them back any time.',
        buttons: [{ label: 'Remove', role: 'destructive', action: () => { ctx.remove(p); ctx.changed([]); paint(); } }, { label: 'Cancel', role: 'cancel' }],
      });
    });
    // "Find recipes": the kitchen writes two for the picks, and My recipes
    // opens on them, if the chef is still here to see it
    PRESS(find, async () => {
      if (generating) return;
      const names = picks().map((s) => s.name);
      const shelfNames = ctx.names();
      const mine = ++asked;
      note.innerHTML = '';
      generating = progress(`Writing ${MEAL.possessive} menu…`, 10);
      note.append(generating);
      paintDrawer();
      try {
        const written = await kitchen.recipes(names, chef.CATERED_SLOTS);
        if (mine !== asked) return;
        st().generated = chef.reconcile(written.slice(0, chef.CATERED_SLOTS), shelfNames);
        generating = null;
        note.innerHTML = '';
        paintDrawer();
        if (ctx.top() === api) ctx.push('myrecipes', { batch: true });
      } catch (err) {
        if (mine !== asked) return;
        generating = null;
        note.innerHTML = `<p class="pp-drawer-err">${esc(COOK_SAYS[err?.kind] || COOK_SAYS.snag)}</p>`;
        paintDrawer();
      }
    });
    // ---- the two cards over a scrim ----
    function openModal(html, onClose) {
      modal.innerHTML = `<span class="pp-scrim"></span><div class="pp-mcard">${html}</div>`;
      modal.hidden = false;
      const close = () => { modal.hidden = true; modal.innerHTML = ''; onClose?.(); };
      modal.querySelector('.pp-scrim').addEventListener('click', close);
      if (!reduced()) {
        modal.querySelector('.pp-scrim').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
        modal.querySelector('.pp-mcard').animate([{ scale: 0.85, opacity: 0 }, { scale: 1, opacity: 1 }], spring(0.3, 0.8));
      }
      return close;
    }
    function chooser(shelfName) {
      const close = openModal(`
        <button type="button" class="pp-choose" data-go="scan"><b>Scan my groceries</b><span>A receipt or the food itself</span></button>
        <span class="pp-mdash"></span>
        <button type="button" class="pp-choose" data-go="type"><b>Type my groceries</b><span>Add to the ${chef.SHELF_TITLE[shelfName]} shelf</span></button>`);
      modal.querySelectorAll('.pp-choose').forEach((b) => PRESS(b, () => {
        close();
        if (b.dataset.go === 'scan') ctx.push('scanner');
        else ctx.push('typein', { shelf: shelfName });
      }));
    }
    function editor(row) {
      if (!row) return;
      const close = openModal(`
        <span class="pp-medit-art">${art(row.name, { tile: chef.PASTEL[row.shelf] })}</span>
        <p class="pp-medit-name">${esc(row.name)}</p>
        <span class="pp-medit-qty"><button type="button" class="pp-mstep is-minus" aria-label="Decrease quantity">${stepper(true, 16)}</button><b>${row.quantity}</b><button type="button" class="pp-mstep is-plus" aria-label="Increase quantity">${stepper(false, 16)}</button></span>
        <button type="button" class="pp-mremove">Remove from shelf</button>
        <button type="button" class="pp-btn pp-mdone">Done</button>`, () => { ctx.changed([]); paint(); });
      hydrate(modal);
      const qtyEl = modal.querySelector('.pp-medit-qty b');
      const minusEl = modal.querySelector('.is-minus');
      const paintQty = () => { qtyEl.textContent = String(row.quantity); minusEl.disabled = row.quantity <= 1; };
      paintQty();
      PRESS(minusEl, () => { row.quantity = Math.max(1, row.quantity - 1); paintQty(); });
      PRESS(modal.querySelector('.is-plus'), () => { row.quantity = Math.min(99, row.quantity + 1); paintQty(); });
      PRESS(modal.querySelector('.pp-mremove'), () => { ctx.remove([row]); close(); });
      PRESS(modal.querySelector('.pp-mdone'), close);
    }
    const api = {
      name: 'shelf',
      view,
      enter() { paint(); scroll.scrollTop = 0; },
      uncover() { paint(); },
      leave() { asked++; generating = null; note.innerHTML = ''; modal.hidden = true; },
      stage: () => 'shelf',
    };
    return api;
  })();

  // ======================================================================
  // My recipes (RecipesScreen)
  // ======================================================================
  const myrecipes = (() => {
    const view = ctx.chromeView('pp-myrecipes', 'chrome-myrecipes.webp', { label: 'My recipes', back: () => ctx.pop() });
    view.insertAdjacentHTML('beforeend', '<span class="pp-mcluster" aria-hidden="true"></span><div class="pp-mscroll"></div><div class="pp-mempty" hidden></div>');
    const scroll = view.querySelector('.pp-mscroll');
    const emptyEl = view.querySelector('.pp-mempty');
    const cluster = view.querySelector('.pp-mcluster');
    let showsBatch = false;
    let listed = [];
    function paint() {
      const picks = st().shelf.filter((s) => s.selected);
      const against = picks.length ? picks.map((s) => s.name) : ctx.names();
      const batch = (showsBatch ? st().generated : []).map((r) => chef.pickFor(r, against));
      const shownTitles = new Set(batch.map((p) => chef.matchKey(p.recipe.title)));
      const kept = st().kept.filter((r) => !shownTitles.has(chef.matchKey(r.title))).map((r) => chef.pickFor(r, ctx.names()));
      listed = [...batch, ...kept];
      cluster.innerHTML = picks.slice(0, 6).map((s) => art(s.name)).join('');
      hydrate(cluster, { generate: false });
      const line = (title, detail) => `<p class="pp-secline"><b>${title}</b><span> · ${detail}</span></p>`;
      let html = '';
      if (batch.length && kept.length) html += line(`${MEAL.leading} batch`, 'just generated');
      html += batch.map((p, i) => recipeCard(p, i)).join('');
      if (kept.length) html += line('Your kept recipes', 'from the cook screen');
      html += kept.map((p, i) => recipeCard(p, batch.length + i)).join('');
      scroll.innerHTML = html;
      scroll.hidden = !listed.length;
      emptyEl.hidden = listed.length > 0;
      emptyEl.innerHTML = `<div class="pp-mempty-card">${img(`${HERE}mascot.webp`, 'pp-mempty-chef')}<p class="pp-mempty-title">Nothing cooked up yet.</p><p>Pick a few ingredients on your shelf and I’ll write you some recipes. Keep one from the cook screen and it lives here for good.</p></div>`;
      hydrate(scroll);
      scroll.querySelectorAll('.pp-title .pp-outlined').forEach((t) => fitLine(t, 0.55));
    }
    const recipeCard = (p, i) => `<div class="pp-lcard" data-i="${i}"><div class="pp-card is-list${p.stocked ? ' is-stocked' : ''}">${cardHTML(p)}</div>`
      + `<button type="button" class="pp-btn pp-lgo" data-i="${i}" aria-label="Start cooking, ${esc(p.recipe.title)}">${GLYPH.pan}<span>Start cooking</span></button></div>`;
    scroll.addEventListener('click', (e) => {
      const host = e.target.closest('[data-i]');
      if (!host) return;
      const p = listed[Number(host.dataset.i)];
      if (e.target.closest('.pp-missing')) { ctx.push('typein', { batch: p.missing }); return; }
      if (e.target.closest('.pp-lgo, .pp-card-open')) ctx.push('cook', p.recipe);
    });
    const api = {
      name: 'myrecipes',
      view,
      enter(arg = {}) {
        showsBatch = !!arg.batch;
        paint();
        scroll.scrollTop = 0;
      },
      shown() {
        if (!st().seenDisclaimer && showsBatch && st().generated.length) {
          ctx.alert({
            title: 'A note on AI recipes',
            message: 'Recipes and nutrition are AI-generated estimates. Cook meat, poultry, seafood, and eggs to safe temperatures, and double-check anything involving allergies.',
            buttons: [{ label: 'Got it', action: () => { st().seenDisclaimer = true; } }],
          });
        }
      },
      uncover() { paint(); },
      stage: () => 'myrecipes',
      resize() { scroll.querySelectorAll('.pp-title .pp-outlined').forEach((t) => fitLine(t, 0.55)); },
    };
    return api;
  })();

  // ======================================================================
  // the recipe (CookScreen)
  // ======================================================================
  const cook = (() => {
    const view = ctx.chromeView('pp-recipe', 'chrome-recipe.webp', { label: 'Recipe', back: () => ctx.pop() });
    view.insertAdjacentHTML('beforeend', '<div class="pp-scroll"></div>');
    const scroller = view.querySelector('.pp-scroll');
    let cooking = null;
    let done = new Set();
    function stripHTML(list) {
      // six to a row at most, and a longer list balanced over two
      const rows = list.length > 6 ? Math.ceil(list.length / 6) : 1;
      const per = Math.ceil(list.length / rows);
      let out = '';
      for (let i = 0; i < list.length; i += per) {
        out += `<div class="pp-strip-row">${list.slice(i, i + per).map((n) =>
          `<span class="pp-chip">${art(n, { tile: chef.PASTEL[chef.shelfOf(n)] })}<span style="background:${chipPastel(n)}"><span class="pp-outlined">${esc(chipName(n))}</span></span></span>`).join('')}</div>`;
      }
      return `<div class="pp-strip" aria-label="Ingredients: ${esc(list.join(', '))}">${out}</div>`;
    }
    function recipeHTML(r) {
      const steps = r.steps.map((s, i) => `
        <button type="button" class="pp-step" aria-pressed="false" aria-label="Step ${i + 1}: ${esc(s.title)}. ${esc(s.body)}">
          <span class="pp-step-head"><span class="pp-step-num">${i + 1}.</span><span class="pp-step-title">${esc(s.title)}</span><span class="pp-step-tick"><svg class="pp-ring" viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="13.5" /></svg>${badge(30)}</span></span>
          <span class="pp-step-body"><span><span>${esc(s.body)}</span></span></span>
        </button>`).join('');
      const kept = st().kept.some((k) => chef.matchKey(k.title) === chef.matchKey(r.title));
      return `
        ${stripHTML(r.ingredientNames)}
        <div class="pp-rhero">
          <p class="pp-rtitle"><span class="pp-outlined">${esc(r.title)}</span></p>
          ${plate(r)}
          <div class="pp-macros"><span class="pp-macro">${r.calories} cal</span><span class="pp-macro">${r.proteinGrams}g protein</span>${r.minutes ? `<span class="pp-macro">${r.minutes} min</span>` : ''}</div>
          ${rule()}
        </div>
        <div class="pp-steps-head"><span class="pp-outlined">Let’s cook</span><span class="pp-count"></span></div>
        <div class="pp-steps">${steps}</div>
        <div class="pp-finish">
          ${rule('is-top')}
          ${img(`${HERE}mascot.webp`, 'pp-finish-chef', '')}
          <span class="pp-outlined">Bon appétit!</span>
          <p>Made it? The chef has another idea waiting.</p>
          <button type="button" class="pp-btn pp-save${kept ? ' is-kept' : ''}">${GLYPH.save}${badge(22)}<span class="pp-save-word">${kept ? 'Saved to My recipes' : 'Save recipe'}</span></button>
          <button type="button" class="pp-btn pp-done">Done cooking</button>
        </div>`;
    }
    function paintCount() {
      const c = scroller.querySelector('.pp-count');
      if (!c || !cooking) return;
      const n = cooking.steps.length;
      c.textContent = done.size === n ? 'all done!' : `${done.size}/${n} done · tap a step to tick it`;
      c.classList.toggle('is-done', done.size === n);
    }
    scroller.addEventListener('click', (e) => {
      const step = e.target.closest('.pp-step');
      if (step) {
        const i = [...scroller.querySelectorAll('.pp-step')].indexOf(step);
        if (done.has(i)) done.delete(i); else done.add(i);
        step.classList.toggle('is-done', done.has(i));
        step.setAttribute('aria-pressed', String(done.has(i)));
        paintCount();
        return;
      }
      const save = e.target.closest('.pp-save');
      if (save) {
        const key = chef.matchKey(cooking.title);
        const has = st().kept.some((k) => chef.matchKey(k.title) === key);
        if (has) st().kept = st().kept.filter((k) => chef.matchKey(k.title) !== key);
        else st().kept.unshift(cooking);
        save.classList.toggle('is-kept', !has);
        save.querySelector('.pp-save-word').textContent = has ? 'Save recipe' : 'Saved to My recipes';
        return;
      }
      if (e.target.closest('.pp-done')) ctx.pop();
    });
    const api = {
      name: 'cook',
      view,
      enter(recipe) {
        cooking = recipe;
        done = new Set();
        scroller.innerHTML = recipeHTML(recipe);
        scroller.scrollTop = 0;
        hydrate(scroller);
        fitLine(scroller.querySelector('.pp-rtitle .pp-outlined'), 0.5);
        paintCount();
      },
      stage: () => 'recipe',
      resize() { const t = scroller.querySelector('.pp-rtitle .pp-outlined'); if (t) fitLine(t, 0.5); },
    };
    return api;
  })();

  // ======================================================================
  // Settings (SettingsScreen)
  // ======================================================================
  const settings = (() => {
    const view = ctx.chromeView('pp-settings', 'chrome-settings.webp', { label: 'Settings', back: () => ctx.pop(), gear: false });
    view.insertAdjacentHTML('beforeend', '<div class="pp-setscroll"></div>');
    const scroll = view.querySelector('.pp-setscroll');
    const sw = (key, label, on) => `<button type="button" class="pp-switch${on ? ' is-on' : ''}" role="switch" aria-checked="${on}" aria-label="${label}" data-key="${key}"><i></i></button>`;
    const row = (title, { value = '', note = '', right = '' } = {}) => `<div class="pp-setrow"><div><p class="pp-setrow-title">${esc(title)}${value ? ` <span>${esc(value)}</span>` : ''}</p>${note ? `<p class="pp-setrow-note">${esc(note)}</p>` : ''}</div>${right}</div>`;
    const clear = (label, key, title = 'Clear') => `<button type="button" class="pp-clearbtn" data-do="${key}" aria-label="${label}">${title}</button>`;
    function paint() {
      const s = st();
      const shelfN = s.shelf.length;
      const drawnBytes = 0;
      scroll.innerHTML = `
        <div class="pp-promo" aria-hidden="true">
          <p class="pp-promo-top">THE WHOLE KITCHEN, ALL YEAR</p>
          <div class="pp-promo-body"><span class="pp-promo-hat">${img(`${HERE}hat.webp`)}</span><span class="pp-promo-words"><b class="pp-outlined is-butter">SEASON PASS</b><span>Unlimited shelves, scanning, and a dish the moment your shelf fills.</span></span><svg class="pp-promo-arrow" viewBox="0 0 32 20"><path d="M1 6.5h17V1l13 9-13 9v-5.5H1z" fill="#ff7e7d" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/></svg></div>
          <i class="is-l"></i><i class="is-r"></i>
        </div>
        <section class="pp-group"><h3>The app</h3>
          ${row('Haptics', { note: 'A small tap when something lands', right: sw('haptics', 'Haptics', s.haptics) })}<hr />
          ${row('Animations', { note: 'The opening spill, card slides, the scan beam', right: sw('animations', 'Animations', s.animations) })}
        </section>
        <section class="pp-group"><h3>Season pass</h3>
          ${row('Free shelves left', { value: '3 of 3', note: 'Every time you open PantryPal your shelf starts empty. The first three you stock are on the house — scanning, typing, every recipe and every drawing for that shelf, uncounted. Your 50-dish ChefBook is always free.' })}<hr />
          ${row('Already have a pass?', { note: 'Restore one bought with this Apple ID.', right: clear('Restore purchases', 'restore', 'Restore') })}
        </section>
        <section class="pp-group"><h3>My kitchen</h3>
          ${row('Shelf', { value: counted(shelfN, 'ingredient'), right: shelfN ? clear('Clear the shelf', 'shelf') : '' })}<hr />
          <div class="pp-setrow is-link" data-do="recipes"><div><p class="pp-setrow-title">Saved recipes <span>${s.kept.length ? s.kept.length : 'Empty'}</span></p></div><span class="pp-disclose">${GLYPH.chevron}</span></div><hr />
          ${row('Illustration cache', { value: drawnBytes ? `${drawnBytes} KB` : 'Zero KB' })}
        </section>
        <section class="pp-group"><h3>Chef</h3>
          ${row('Cooking as', { value: s.chef || '' })}<hr />
          <button type="button" class="pp-btn pp-setbtn" data-do="add">Add a chef</button>
          <button type="button" class="pp-setdelete" data-do="delete">Delete this chef</button>
        </section>`;
    }
    scroll.addEventListener('click', (e) => {
      const t = e.target.closest('[data-key], [data-do]');
      if (!t) return;
      if (t.dataset.key === 'haptics') { st().haptics = !st().haptics; paint(); return; }
      if (t.dataset.key === 'animations') { ctx.setAnimations(!st().animations); paint(); return; }
      const what = t.dataset.do;
      if (what === 'recipes') ctx.push('myrecipes', { batch: false });
      else if (what === 'add') ctx.push('signup', { adding: true });
      else if (what === 'shelf') {
        ctx.alert({ title: `Clear ${counted(st().shelf.length, 'ingredient')} off your shelf?`, message: 'Everything comes off, quantities and all — you’d have to add it all back.', buttons: [{ label: 'Clear shelf', role: 'destructive', action: () => { ctx.remove([...st().shelf]); ctx.changed([]); paint(); } }, { label: 'Cancel', role: 'cancel' }] });
      } else if (what === 'delete') {
        ctx.alert({ title: `Delete ${st().chef}?`, message: 'This chef’s shelf and saved recipes are removed from this phone for good.', buttons: [{ label: 'Delete', role: 'destructive', action: () => ctx.signOut() }, { label: 'Cancel', role: 'cancel' }] });
      }
    });
    return { name: 'settings', view, enter: paint, uncover: paint, stage: () => 'settings' };
  })();

  return { typein, shelf, myrecipes, cook, settings };
}
