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

const FINE_POINTER = matchMedia('(hover: hover) and (pointer: fine)');

export function createPrompt(form, { onSubmit, onChange } = {}) {
  const input = form.querySelector('.prompt-input');
  const caret = form.querySelector('.prompt-caret');
  const mirror = form.querySelector('.prompt-mirror');

  let raf = 0;
  let typingTimer = 0;
  let line = -1;          // the caret's line last frame, to glide within a line and jump between
  let composing = false;
  let typeAnywhere = false;

  // ---- where the caret goes ----
  function place() {
    raf = 0;
    const value = input.value;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const at = input.selectionDirection === 'backward' ? start : end;

    mirror.textContent = value.slice(0, at);
    const tail = document.createElement('span');
    // a zero-width space stands in for "the end", so the tail has a position
    // without taking any room that could push it onto a new line
    tail.textContent = value.slice(at) || '​';
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
  // down to the baseline, so it stands beside "Ask" like one more letter.
  // Both are measured rather than written as em. The cap height is the
  // font's own (0.7046em for SF), but where the baseline lands inside a 43px
  // line is the engine's business: Chrome puts it on a whole pixel, 35 of 43
  // at 36px, not the 34.3 the font's metrics would say. The block used to be
  // 0.72em hung 0.33em down, which started 2.4px under the capitals and ran
  // 3px past the baseline. The numbers are written on the root, where the
  // answer's caret (the same block, riding the same type) reads them too.
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

  function focus() {
    input.focus({ preventScroll: true });
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
    setWaiting(on) { form.classList.toggle('is-waiting', on); },
    setTypeAnywhere(on) { typeAnywhere = on; if (!on && document.activeElement === input) input.blur(); },
    refresh: schedule,
    // where the caret block is on screen, for the chat's travelling caret
    caretRect() { return caret.getBoundingClientRect(); },
    // the prompt's box, where a question's flight up into the bubble begins
    textRect() { return input.getBoundingClientRect(); },
  };
}
