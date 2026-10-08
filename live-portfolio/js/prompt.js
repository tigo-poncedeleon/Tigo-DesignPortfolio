// prompt.js — the composer's field, and its block caret.
//
// The text is a real <textarea>, so everything a text field does it still
// does natively: click to place, drag to select, IME composition, paste, the
// iOS loupe. Only the caret is drawn by hand: the frame's 9×26 block, blinking
// on the live caret's 1.06s, solid while you type. The textarea's own caret is
// transparent. The block is positioned from a hidden mirror of the textarea:
// the text up to the cursor, then a span holding the rest. The span lands
// where the next character would, because the mirror wraps exactly as the
// textarea does (same width, same white-space rules).
//
// The buttons around the field (photo, mood, microphone, send) are
// composer.js; this file only owns the text and the caret, and tells the
// composer whenever the text changes.
//
// The first time Home is in view, the caret types a greeting out on its own
// (greet, below), a key at a time at a person's uneven pace, lets it be
// read, and backspaces it away again, leaving itself blinking where you
// start: the textarea's data-greeting, "Hey there, ask me anything!". Not on
// a phone, or any screen that is tapped rather than pointed at: a line typing
// itself out while the page is still settling under your thumb read as a
// message arriving, not as an invitation. (It said "Hi, ask away!" there,
// which fit the pill's one line; Tigo took it out.) There the empty field
// says "Ask me anything!" instead, still, in the name's softer grey (the
// hint, below), until the first question.
//
// The caret blinks only where it is asked for. Before a conversation on a
// laptop the field has focus from the start, and the blinking block is the
// invitation. But once a question has gone, or on a phone at any time, the
// block is there only while the field has focus (css/home.css): a caret
// blinking under an answer you are reading, in a field nobody is typing in,
// pulled the eye away from the answer.

import { reduced } from './motion.js';

const FINE_POINTER = matchMedia('(hover: hover) and (pointer: fine)');
const PHONE = matchMedia('(max-width: 760px)');
const TAP = matchMedia('(hover: none)');
// where the greeting does not play, and the hint stands in for it
const quiet = () => PHONE.matches || TAP.matches;

export function createPrompt(form, { onSubmit, onChange } = {}) {
  const input = form.querySelector('.prompt-input');
  const caret = form.querySelector('.prompt-caret');
  const mirror = form.querySelector('.prompt-mirror');

  let raf = 0;
  let typingTimer = 0;
  let line = -1;          // the caret's line last frame, to glide within a line and jump between
  let composing = false;
  let typeAnywhere = false;
  let chatting = false;
  let hinting = false;

  // ---- where the caret goes ----
  function place() {
    raf = 0;
    const value = input.value;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const at = input.selectionDirection === 'backward' ? start : end;

    // an empty field showing the greeting holds the caret at the greeting's
    // end, where the typing left it (the hint is not typed, so the caret
    // stays at the start)
    const greeting = value || hinting ? '' : input.placeholder;
    mirror.textContent = greeting || value.slice(0, at);
    const tail = document.createElement('span');
    // a zero-width space stands in for "the end", so the tail has a position
    // without taking any room that could push it onto a new line
    tail.textContent = (!greeting && value.slice(at)) || '​';
    mirror.append(tail);

    const lh = parseFloat(getComputedStyle(mirror).lineHeight);
    const box = mirror.getBoundingClientRect();
    const first = tail.getClientRects()[0] || tail.getBoundingClientRect();
    const x = first.left - box.left;
    // snap to the line grid: an inline box's top is its font's content area,
    // a hair off the line box, and the block belongs on the line
    const row = Math.max(0, Math.round((first.top - box.top) / lh));
    const y = row * lh;

    caret.classList.toggle('is-gliding', row === line);
    caret.style.setProperty('--caret-x', x + 'px');
    caret.style.setProperty('--caret-y', y + 'px');
    line = row;

    // grow with the question, upward (the status row is bottom-aligned)
    const h = Math.max(lh, Math.round(mirror.getBoundingClientRect().height));
    if (input.style.height !== h + 'px') input.style.height = h + 'px';

    caret.classList.toggle('is-hidden', start !== end || composing);
    form.classList.toggle('has-text', value.length > 0);
    onChange?.(value);
  }

  function schedule() {
    if (!raf) raf = requestAnimationFrame(place);
  }

  // ---- solid while typing, blinking again 530ms after the last key ----
  function typing() {
    caret.classList.add('is-typing');
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => caret.classList.remove('is-typing'), 530);
  }

  input.addEventListener('input', () => {
    // your first key ends the greeting, for good
    if (input.value) hush();
    // one line of question: a pasted newline becomes a space
    if (/[\r\n]/.test(input.value)) {
      const at = input.selectionStart;
      input.value = input.value.replace(/\r?\n|\r/g, ' ');
      input.setSelectionRange(at, at);
    }
    typing();
    schedule();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      // Enter while an IME is composing confirms the composition; it must not
      // send. Safari ends the composition BEFORE the committing keydown, so
      // isComposing alone misses it — keyCode 229 catches that one.
      if (e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      if (!e.shiftKey) submit();
      return;
    }
    if (e.key === 'Escape') {
      input.blur();
      return;
    }
    if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End' || e.key === 'Backspace' || e.key === 'Delete') {
      typing();
    }
    schedule();
  });
  input.addEventListener('keyup', schedule);
  input.addEventListener('select', schedule);
  input.addEventListener('focus', schedule);
  input.addEventListener('blur', schedule);
  input.addEventListener('compositionstart', () => { composing = true; schedule(); });
  input.addEventListener('compositionend', () => { composing = false; schedule(); });
  document.addEventListener('selectionchange', () => {
    if (document.activeElement === input) schedule();
  });
  new ResizeObserver(schedule).observe(form);
  document.fonts?.ready.then(schedule);

  // ---- the block's height, from the type itself ----
  // The block spans exactly what a capital letter spans: from the cap line
  // down to the baseline, so it stands beside a word like one more letter.
  // Both are measured rather than written as em. The cap height is the
  // font's own (0.7046em for SF), but where the baseline lands inside a 43px
  // line is the engine's business: Chrome puts it on a whole pixel, 35 of 43
  // at 36px, not the 34.3 the font's metrics would say. The block used to be
  // 0.72em hung 0.33em down, which started 2.4px under the capitals and ran
  // 3px past the baseline. The numbers are written on the root, where the
  // block's own rule (css/home.css) reads them.
  const field = form.querySelector('.prompt-field');
  function measureType() {
    const size = parseFloat(getComputedStyle(field).fontSize);
    if (!size) return;
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;white-space:nowrap;pointer-events:none';
    probe.innerHTML = 'H<span style="display:inline-block;width:0;height:0"></span>';
    field.append(probe);
    const baseline = probe.lastChild.getBoundingClientRect().top - probe.getBoundingClientRect().top;
    probe.remove();
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = `${getComputedStyle(field).fontWeight} ${size}px ${getComputedStyle(field).fontFamily}`;
    const cap = ctx.measureText('H').actualBoundingBoxAscent || size * 0.7046;
    const root = document.documentElement.style;
    root.setProperty('--caret-top', (baseline - cap).toFixed(2) + 'px');
    root.setProperty('--caret-h', cap.toFixed(2) + 'px');
    schedule();
  }
  new ResizeObserver(measureType).observe(field);
  document.fonts?.ready.then(measureType);

  // ---- the greeting ----
  // Typed into the field's placeholder, so it shows only while the field is
  // empty, and goes the moment you type: for good then (hush), even if it
  // was still being written. Each key comes 55 to 110ms after the last, a
  // word's first a little later than the rest of it, with a breath after
  // the comma and a beat before the "!". Then it stands for a moment to be
  // read, and is taken back a key at a time, more slowly than it went down,
  // as a hand on backspace does, a little faster once it gets going and
  // catching at the start of each word. The caret is solid while it types
  // and while it deletes, as it is for your own typing, and blinks through
  // the pause between. Under reduced motion the whole line is simply there,
  // and stays until you type.
  let greeted = false;
  let greetTimer = 0;
  const HOLD = 1700;
  function pace(text, i) {
    let ms = 55 + Math.random() * 55;
    if (text[i - 1] === ',') ms += 240;
    else if (text[i - 1] === ' ') ms += 30 + Math.random() * 60;
    if (text[i] === '!') ms += 140;
    return ms;
  }
  function unpace(text, i, done) {
    // the first few presses are the slowest, then the hand finds its rhythm
    let ms = 80 + Math.random() * 50 + Math.max(0, 4 - done) * 25;
    if (text[i - 1] === ' ') ms += 60 + Math.random() * 80;
    return ms;
  }
  function greet({ delay = 0 } = {}) {
    const text = input.dataset.greeting;
    if (greeted || !text || input.value || quiet()) return;
    greeted = true;
    if (reduced()) { input.placeholder = text; schedule(); return; }
    let i = 0;
    const show = () => { input.placeholder = text.slice(0, i); typing(); schedule(); };
    const erase = () => {
      i -= 1;
      show();
      greetTimer = i > 0 ? setTimeout(erase, unpace(text, i, text.length - i)) : 0;
    };
    const key = () => {
      i += 1;
      show();
      greetTimer = setTimeout(i < text.length ? key : erase, i < text.length ? pace(text, i) : HOLD);
    };
    greetTimer = setTimeout(key, delay);
  }
  function hush() {
    greeted = true;
    clearTimeout(greetTimer);
    greetTimer = 0;
    if (input.placeholder && !hinting) { input.placeholder = ''; schedule(); }
  }

  // ---- the hint ----
  // The textarea's data-hint, as its placeholder, in --ink-2 (the grey of
  // the line under the name) rather than the words' own ink, so it reads as
  // a label on the field and not as something already typed. It is there
  // only while the caret is not: a tap into the field fades it out for the
  // blinking block, and leaving the field empty brings it back, so the field
  // always shows exactly one invitation. It goes for good with the first
  // question, and comes back when the conversation is cleared.
  function paintHint() {
    const on = quiet() && !chatting && !!input.dataset.hint;
    if (on === hinting) return;
    hinting = on;
    form.classList.toggle('is-hinting', on);
    if (on) {
      clearTimeout(greetTimer);
      greetTimer = 0;
      input.placeholder = input.dataset.hint;
    } else if (input.placeholder === input.dataset.hint) {
      input.placeholder = '';
    }
    schedule();
  }
  PHONE.addEventListener('change', paintHint);
  TAP.addEventListener('change', paintHint);
  paintHint();

  // Enter hands over to the composer, which knows whether there is a photo
  // too, and so whether an empty field still has something to send.
  function submit() {
    onSubmit?.(input.value.trim());
  }

  // ---- type anywhere on Home ----
  // A printable key pressed while nothing editable has focus moves focus into
  // the prompt. It does NOT preventDefault: the browser delivers the keypress
  // to whatever holds focus when it gets there, so the letter itself lands in
  // the textarea with nothing re-typed by hand, and nothing is lost.
  document.addEventListener('keydown', (e) => {
    if (!typeAnywhere || e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key.length !== 1) return;
    const t = e.target;
    if (t === input || t.isContentEditable || t.closest?.('input, textarea, select')) return;
    // Space or Enter on a focused link or button is that control's own key
    if ((e.key === ' ') && t.closest?.('a, button')) return;
    focus();
  });

  // atEnd: a press beside the words rather than on them goes on from the
  // end of them, unless the field had focus already, when the cursor (or a
  // selection dragged out past the words) stays where it is
  function focus({ atEnd = false } = {}) {
    const had = document.activeElement === input;
    input.focus({ preventScroll: true });
    if (atEnd && !had) input.setSelectionRange(input.value.length, input.value.length);
    schedule();
  }

  schedule();

  return {
    input,
    caret,
    get value() { return input.value; },
    set value(v) { input.value = v; input.setSelectionRange(v.length, v.length); schedule(); },
    focus,
    // Auto-focus only where a pointer and a real keyboard are likely. A phone
    // is never focused programmatically: the keyboard would spring up and
    // cover the page it was meant to invite you into.
    focusIfDesk() { if (FINE_POINTER.matches) focus(); },
    blur() { input.blur(); },
    clear() { input.value = ''; line = -1; schedule(); },
    greet,
    hush,
    // the frame's data-chat (js/main.js): a conversation ends the greeting
    // and the hint, and clearing it puts the hint back
    setChatting(on) {
      chatting = on;
      paintHint();
      if (on) hush();
    },
    setTypeAnywhere(on) { typeAnywhere = on; if (!on && document.activeElement === input) input.blur(); },
  };
}
