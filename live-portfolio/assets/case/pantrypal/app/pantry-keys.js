// pantry-keys.js — the phone's keyboard, for the app the case study runs
// (pantry-app.js). PantryPal's screens are laid out around the keyboard (Type
// it in!'s bar rides on it, the pass's kitchen slides up out of its way), so
// the phone brings one: iOS 26's, measured off the 1.3 build's capture on an
// iPhone 16 (its glass taking the colour of the screen under it, the pale
// keys, the suggestion bar's two rules, the blue return that says done).
// It types into the field it is given, the keys pressed on it or the keys on
// a real keyboard alike, and on a phone it keeps the phone's own keyboard
// away (inputmode none), since this one is the app's.
//
// createKeyboard(screen) → { el, attach(input, { onReturn }), detach(),
// isUp(), on('show' | 'hide', fn) }. Attaching a field raises the keyboard
// and focuses the field; the field losing focus lowers it.

const LETTERS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const NUMBERS = ['1234567890', '-/:;()$&@"', '.,?!\''];

const SHIFT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2 2.6 13h5.2v7.6h8.4V13h5.2z" stroke-width="1.7" stroke-linejoin="round"/></svg>';
const DELETE = '<svg viewBox="0 0 30 22" aria-hidden="true"><path d="M9.2 2h17.6c1.2 0 2.2 1 2.2 2.2v13.6c0 1.2-1 2.2-2.2 2.2H9.2L1.4 11z" fill="none" stroke-width="1.8" stroke-linejoin="round"/><path d="m13.6 7.2 7.6 7.6m0-7.6-7.6 7.6" fill="none" stroke-width="1.8" stroke-linecap="round"/></svg>';
const RETURN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4.6 12.6 4.8 4.8 10-10.6" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const EMOJI = '<svg viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="12" fill="none" stroke-width="1.9"/><circle cx="9.6" cy="11" r="1.7" stroke="none"/><circle cx="18.4" cy="11" r="1.7" stroke="none"/><path d="M7.6 15.6c1.2 3.4 3.6 5.2 6.4 5.2s5.2-1.8 6.4-5.2z" stroke-linejoin="round"/></svg>';
const MIC = '<svg viewBox="0 0 20 28" aria-hidden="true"><rect x="6" y="1.6" width="8" height="15.4" rx="4" fill="none" stroke-width="1.9"/><path d="M2.6 12.6c0 4.4 3.3 7.6 7.4 7.6s7.4-3.2 7.4-7.6M10 20.2v5.6M6 25.8h8" fill="none" stroke-width="1.9" stroke-linecap="round"/></svg>';

export function createKeyboard(screen) {
  const el = document.createElement('div');
  el.className = 'pp-kbd';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<div class="pp-kbd-bar"><i></i><i></i></div><div class="pp-kbd-keys"></div>'
    + `<div class="pp-kbd-foot"><span>${EMOJI}</span><span>${MIC}</span></div>`;
  screen.append(el);
  const keys = el.querySelector('.pp-kbd-keys');
  const listeners = { show: [], hide: [] };
  let input = null;
  let onReturn = null;
  let numbers = false;
  let shift = true;
  let up = false;

  function paint() {
    const rows = numbers ? NUMBERS : LETTERS;
    const letter = (c) => `<button type="button" class="pp-key" data-k="${c === '"' ? '&quot;' : c}">${c === '"' ? '&quot;' : shift && !numbers ? c.toUpperCase() : c}</button>`;
    keys.innerHTML = `<div class="pp-krow">${[...rows[0]].map(letter).join('')}</div>`
      + `<div class="pp-krow is-two">${[...rows[1]].map(letter).join('')}</div>`
      + `<div class="pp-krow is-three"><button type="button" class="pp-key is-fn is-shift${shift && !numbers ? ' is-on' : ''}" data-k="shift">${numbers ? '#+=' : SHIFT}</button>`
      + `<span class="pp-kmid">${[...rows[2]].map(letter).join('')}</span>`
      + `<button type="button" class="pp-key is-fn is-del" data-k="del">${DELETE}</button></div>`
      + `<div class="pp-krow is-four"><button type="button" class="pp-key is-fn is-mode" data-k="mode">${numbers ? 'ABC' : '123'}</button>`
      + '<button type="button" class="pp-key is-space" data-k=" "></button>'
      + `<button type="button" class="pp-key is-return" data-k="return">${RETURN}</button></div>`;
  }
  // autocapitalization by words, as both of the app's fields ask: a capital
  // at the start, and after a space
  function autoShift() {
    if (!input) return;
    const before = input.value.slice(0, input.selectionStart ?? input.value.length);
    const next = before === '' || /\s$/.test(before);
    if (next !== shift) { shift = next; paint(); }
  }
  function type(text) {
    if (!input) return;
    const v = input.value;
    const a = input.selectionStart ?? v.length;
    const b = input.selectionEnd ?? v.length;
    let next;
    let at;
    if (text === null) {
      if (a === b && a === 0) return;
      next = a === b ? v.slice(0, a - 1) + v.slice(b) : v.slice(0, a) + v.slice(b);
      at = a === b ? a - 1 : a;
    } else {
      if (input.maxLength > 0 && v.length - (b - a) + text.length > input.maxLength) return;
      next = v.slice(0, a) + text + v.slice(b);
      at = a + text.length;
    }
    input.value = next;
    input.setSelectionRange(at, at);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    autoShift();
  }

  // a key never takes the focus from the field, so the caret stays put
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const key = e.target.closest('.pp-key');
    if (!key) return;
    key.classList.add('is-down');
    const release = () => key.classList.remove('is-down');
    key.addEventListener('pointerup', release, { once: true });
    key.addEventListener('pointerleave', release, { once: true });
  });
  el.addEventListener('click', (e) => {
    const key = e.target.closest('.pp-key');
    if (!key || !input) return;
    const k = key.dataset.k;
    if (k === 'shift') { if (!numbers) { shift = !shift; paint(); } return; }
    if (k === 'mode') { numbers = !numbers; paint(); return; }
    if (k === 'del') { type(null); return; }
    if (k === 'return') { onReturn?.(); return; }
    type(shift && !numbers ? k.toUpperCase() : k);
  });

  const onInput = () => autoShift();
  const onBlur = () => { if (up) lower(); };
  // a real keyboard's return is this one's return
  const onKey = (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); onReturn?.(); } };
  function raise() {
    if (up) return;
    up = true;
    el.classList.add('is-up');
    listeners.show.forEach((fn) => fn());
  }
  function lower() {
    if (!up) return;
    up = false;
    el.classList.remove('is-up');
    listeners.hide.forEach((fn) => fn());
  }

  paint();
  return {
    el,
    attach(field, opts = {}) {
      if (input !== field) {
        this.detach();
        input = field;
        field.setAttribute('inputmode', 'none');
        field.addEventListener('input', onInput);
        field.addEventListener('blur', onBlur);
        field.addEventListener('keydown', onKey);
      }
      onReturn = opts.onReturn || null;
      numbers = false;
      if (document.activeElement !== field) field.focus({ preventScroll: true });
      autoShift();
      paint();
      raise();
    },
    detach() {
      if (!input) return;
      input.removeEventListener('input', onInput);
      input.removeEventListener('blur', onBlur);
      input.removeEventListener('keydown', onKey);
      input = null;
      lower();
    },
    // the field keeps its keyboard while it has the focus
    bind(field, opts = {}) {
      field.setAttribute('inputmode', 'none');
      field.addEventListener('focus', () => this.attach(field, opts));
    },
    isUp: () => up,
    on(type, fn) { listeners[type].push(fn); },
  };
}
