// composer.js — everything in the pill around the field.
//
//   (photo)     no button: a photo comes in by pasting it into the field
//               or dropping it onto the pill, and waits beside the words. It
//               is shrunk to 1200px on its longest side and sent as a JPEG,
//               the old site's recipe (archive/v2-live-portfolio/js/ai-chat.js:
//               305-316): the proxy (api/chat.js) passes it on to Claude,
//               which can see it. (A + at the head of the tools opened the file
//               picker; Tigo took it out, and the row is the lighter for it.)
//   friendly ⌄  the chat's mood: friendly, whimsical or suspicious, the three
//               the proxy knows (api/chat.js, PERSONAS). The
//               choice is kept in this browser.
//   mic         ask out loud, where the browser can listen (its own speech
//               recognition; the button is not shown where there is none).
//               What you say is written into the field and waits for you to
//               send it, as on the old site: speech is often a little wrong.
//   send        pale until there is something to send, then ink.

const MOODS = ['friendly', 'whimsical', 'suspicious'];
const MOOD_KEY = 'draft.mood';
const MAX_SIDE = 1200;

export function createComposer(form, { prompt, onSend }) {
  const thumb = form.querySelector('.composer-thumb');
  const thumbImg = thumb.querySelector('img');
  const thumbRemove = thumb.querySelector('.composer-thumb-remove');
  const mood = form.querySelector('.composer-mood');
  const chip = form.querySelector('.composer-chip');
  const chipWord = form.querySelector('.composer-chip-word');
  const options = [...form.querySelectorAll('.mood-menu [data-mood]')];
  const mic = form.querySelector('.composer-mic');
  const send = form.querySelector('.composer-send');

  let photo = null; // { data: base64 JPEG, thumb: small data URL }

  // Where nothing can hover, the pill cannot wait to be pointed at: it
  // stays open (css/home.css).
  const touch = matchMedia('(hover: none)');
  const paintTouch = () => form.classList.toggle('is-touch', touch.matches);
  touch.addEventListener('change', paintTouch);
  paintTouch();

  // ---- send: lit when there is text or a photo ----
  function paintSend() {
    const ready = prompt.value.trim().length > 0 || !!photo;
    send.disabled = !ready;
    form.classList.toggle('has-image', !!photo);
  }

  function submit() {
    const text = prompt.value.trim();
    if (!text && !photo) return;
    const sent = onSend({ text, photo, mood: currentMood });
    if (sent === false) return; // the chat is still answering; nothing is lost
    setPhoto(null);
    // On a touch screen the keyboard goes down once the question is away,
    // whether it went by the send key or the keyboard's own, so the answer
    // has the whole screen to arrive in rather than the strip above the
    // keyboard; the composer rides down with it (js/keyboard.js), and a tap
    // anywhere on Home brings it back for the next question.
    if (touch.matches) prompt.blur();
  }
  form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });

  // ---- the photo ----
  // Shrunk on a canvas to 1200px on its longest side and re-encoded as a JPEG
  // at .85, which keeps a phone photo to a few hundred kilobytes.
  async function readPhoto(blob) {
    if (!blob || !blob.type.startsWith('image/')) return null;
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL('image/jpeg', 0.85);
    // and a small copy for the thread, so a reload can show it without
    // keeping the whole photo in the session: 360px on its longest side,
    // enough for the 168px print to stay sharp on a Retina screen
    const small = document.createElement('canvas');
    const s = Math.min(1, 360 / Math.max(canvas.width, canvas.height));
    small.width = Math.round(canvas.width * s);
    small.height = Math.round(canvas.height * s);
    small.getContext('2d').drawImage(canvas, 0, 0, small.width, small.height);
    return { data: url.split(',')[1], url, thumb: small.toDataURL('image/jpeg', 0.8) };
  }

  function setPhoto(p) {
    photo = p;
    thumb.hidden = !p;
    if (p) thumbImg.src = p.url || p.thumb;
    else thumbImg.removeAttribute('src');
    paintSend();
  }

  async function take(blob) {
    const p = await readPhoto(blob).catch(() => null);
    if (!p) return;
    setPhoto(p);
    thumb.animate([{ opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1 }],
      { duration: 420, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
    prompt.focus();
  }

  thumbRemove.addEventListener('click', () => { setPhoto(null); prompt.focus(); });
  prompt.input.addEventListener('paste', (e) => {
    const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
    if (!item) return;
    e.preventDefault();
    take(item.getAsFile());
  });
  form.addEventListener('dragover', (e) => {
    if (![...(e.dataTransfer?.items || [])].some((i) => i.type.startsWith('image/'))) return;
    e.preventDefault();
    form.classList.add('is-dropping');
  });
  form.addEventListener('dragleave', () => form.classList.remove('is-dropping'));
  form.addEventListener('drop', (e) => {
    const f = [...(e.dataTransfer?.files || [])].find((x) => x.type.startsWith('image/'));
    form.classList.remove('is-dropping');
    if (!f) return;
    e.preventDefault();
    take(f);
  });

  // ---- the mood ----
  let currentMood = 'friendly';
  try {
    const saved = localStorage.getItem(MOOD_KEY);
    if (MOODS.includes(saved)) currentMood = saved;
  } catch { /* private mode */ }

  function paintMood() {
    chipWord.textContent = currentMood;
    chip.dataset.mood = currentMood; // the chip's dot takes the mood's pastel
    chip.setAttribute('aria-label', 'Mood: ' + currentMood);
    for (const o of options) o.setAttribute('aria-checked', String(o.dataset.mood === currentMood));
  }
  paintMood();

  function openMood({ focus = false } = {}) {
    mood.classList.add('is-open');
    chip.setAttribute('aria-expanded', 'true');
    if (focus) (options.find((o) => o.dataset.mood === currentMood) || options[0]).focus();
  }
  function closeMood({ focus = false } = {}) {
    if (!mood.classList.contains('is-open')) return;
    mood.classList.remove('is-open');
    chip.setAttribute('aria-expanded', 'false');
    if (focus) chip.focus();
  }
  chip.addEventListener('click', (e) => {
    if (mood.classList.contains('is-open')) closeMood();
    else openMood({ focus: e.detail === 0 });
  });
  for (const o of options) {
    o.addEventListener('click', () => {
      currentMood = o.dataset.mood;
      try { localStorage.setItem(MOOD_KEY, currentMood); } catch { /* private mode */ }
      paintMood();
      closeMood();
      prompt.focusIfDesk();
    });
  }
  // arrows walk the three; Esc shuts the card and goes back to the chip
  mood.addEventListener('keydown', (e) => {
    if (!mood.classList.contains('is-open')) return;
    const i = options.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = (i + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      options[i < 0 ? 0 : next].focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeMood({ focus: true });
    }
  });
  document.addEventListener('pointerdown', (e) => {
    if (!mood.contains(e.target)) closeMood();
  });

  // ---- the microphone ----
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let listening = null;
  if (Recognition) {
    mic.hidden = false;
    mic.addEventListener('click', () => {
      if (listening) { listening.stop(); return; }
      const rec = new Recognition();
      rec.lang = navigator.language || 'en-US';
      rec.interimResults = true;
      rec.continuous = false;
      const before = prompt.value ? prompt.value.replace(/\s*$/, ' ') : '';
      rec.onresult = (e) => {
        let said = '';
        for (const r of e.results) said += r[0].transcript;
        prompt.value = before + said;
      };
      const done = () => {
        listening = null;
        mic.setAttribute('aria-pressed', 'false');
        mic.setAttribute('aria-label', 'Ask out loud');
        // back to the field on a laptop; a phone keeps its keyboard down,
        // since what was said is there to be sent, and a focus from here
        // (no tap behind it) would raise none anyway
        prompt.focusIfDesk();
      };
      rec.onend = done;
      rec.onerror = done;
      listening = rec;
      mic.setAttribute('aria-pressed', 'true');
      mic.setAttribute('aria-label', 'Stop listening');
      try { rec.start(); } catch { done(); }
    });
  }

  paintSend();

  return {
    get mood() { return currentMood; },
    // after a failed send, the photo comes back with the words
    restore({ text, photo: p }) {
      prompt.value = text || '';
      setPhoto(p || null);
    },
    paintSend,
    submit,
  };
}
