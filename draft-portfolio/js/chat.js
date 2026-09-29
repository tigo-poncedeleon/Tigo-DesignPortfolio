// chat.js — the conversation on Home.
//
// It talks to the live site's own proxy, the same Claude Haiku behind the
// same system prompt, and nothing is deployed for it: that proxy answers any
// origin, and its CORS comment expects a draft on localhost to call it
// directly (live-portfolio/api/chat.js:71-74). window.AI_ENDPOINT overrides it
// for testing, as it does on the live site.
//
// The conversation is a thread down the left side of the page, as in the Muse
// reference: each question in a light blue bubble, each answer in a grey one
// under it, the newest at the foot, scrolling as it grows. The bubbles hang
// out into the gutter by their own padding, so their words stand on the same
// axis as the name and the composer.
//
// Asking is one movement. The question lifts out of the composer and flies up
// into its bubble, which opens around it; a small grey bubble pops in under
// it, and the caret goes up too, to wait in it. The caret is ONE caret
// throughout: it leaves the composer with the question, breathes in the grey
// bubble while the answer is on its way (thinking, not asking), rides the end
// of the answer as the bubble grows around it a line at a time, and drops
// back down into the composer when it is done.
//
// While there is a conversation, the menu square gives its place to a clear
// button (js/nav.js); this file says when.

import { SPRING, EASE, animate, reduced, u } from './motion.js';

const ENDPOINT = window.AI_ENDPOINT || 'https://tigo-design-portfolio.vercel.app/api/chat';
const STORE = 'draft.chat';
const TIMEOUT = 20000;

// the live client's pace: 3.5s for a whole answer, but never faster than
// 12ms or slower than 30ms a word (live-portfolio/js/ai-chat.js revealWords)
const cadence = (words) => Math.min(30, Math.max(12, 3500 / words));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function createChat({ prompt, promptForm, thread, announcer, onFail, onLive }) {
  const inner = thread.querySelector('.thread-inner');

  let turns = load();   // completed pairs only: [{ q, a, photo }] (photo: a small copy, or null)
  let epoch = 0;        // bumped by "clear"; a reply from an older epoch is dropped
  let busy = false;
  let controller = null;
  let hurry = false;    // leaving Home: finish any reveal at once
  let onHome = true;
  let live = false;     // there is a conversation on screen, so the clear button is up
  let failed = null;    // the turn whose question could not be sent
  let following = true; // the thread is kept scrolled to its foot
  let lastScroll = 0;

  // ---- memory: the session keeps the conversation across reloads ----
  function load() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE));
      return saved?.v === 1 && Array.isArray(saved.turns) ? saved.turns : [];
    } catch { return []; }
  }
  function save() {
    try { sessionStorage.setItem(STORE, JSON.stringify({ v: 1, turns })); } catch { /* private mode, or full */ }
  }

  // ---- the request ----
  // The payload is the last nine pairs and the new question: nineteen
  // messages at most, and always starting on a question. (The live client
  // takes the last twenty messages, which from the eleventh question on
  // starts the window on an answer.)
  // A photo goes only with the question it was sent with, as an image block
  // ahead of the words; earlier ones are remembered in words, so a follow-up
  // still knows there was one without sending it again.
  async function request(text, photo, mood) {
    controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    try {
      const said = (t) => (t.photo ? (t.q ? t.q + ' (with a photo)' : '(sent a photo)') : t.q);
      const messages = turns.slice(-9).flatMap((t) => [
        { role: 'user', content: said(t) },
        { role: 'assistant', content: t.a },
      ]);
      const content = [];
      if (photo) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: photo.data } });
      if (text) content.push({ type: 'text', text });
      messages.push({ role: 'user', content: photo ? content : text });
      // Content-Type is the only header the proxy's preflight allows.
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, persona: mood || 'friendly' }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error('proxy answered ' + res.status);
      // the 20s covers reading the body too, not just the headers
      const data = await res.json();
      const reply = data?.content?.[0]?.text || data?.reply || data?.text || '';
      if (!reply) throw new Error('empty reply');
      // The type is one weight of SF Pro: markdown emphasis the model slips
      // in anyway would show as literal asterisks.
      return reply
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*\n]+)\*/g, '$1')
        .trim();
    } finally {
      clearTimeout(timer);
    }
  }

  // Emails and web addresses in an answer become links. Built as nodes,
  // never as HTML: this is model output.
  const LINK = /\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b|\bhttps?:\/\/[^\s<>"')\]]*[^\s<>"')\].,;:!?]/gi;
  function linkify(el, text) {
    el.textContent = '';
    let last = 0;
    for (const m of text.matchAll(LINK)) {
      if (m.index > last) el.append(text.slice(last, m.index));
      const a = document.createElement('a');
      a.textContent = m[0];
      if (m[1]) {
        a.href = 'mailto:' + m[1];
      } else {
        a.href = m[0];
        a.target = '_blank';
        a.rel = 'noopener';
      }
      el.append(a);
      last = m.index + m[0].length;
    }
    if (last < text.length) el.append(text.slice(last));
  }

  // ---- one turn of the thread: the question, and the answer under it ----
  function make(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  }
  function buildTurn(q, photo) {
    const turn = make('div', 'turn');
    let pic = null;
    let bubble = null;
    let words = null;
    if (photo) {
      pic = make('img', 'turn-photo');
      pic.src = photo;
      pic.alt = 'A photo you sent';
      turn.append(pic);
    }
    if (q) {
      bubble = make('p', 'bubble bubble-q');
      words = make('span', 'bubble-words', q);
      bubble.append(make('span', 'sr-only', 'You asked: '), words);
      turn.append(bubble);
    }
    const reply = make('div', 'bubble bubble-a');
    const body = make('p', 'bubble-text');
    reply.append(make('span', 'sr-only', 'Answer: '), body);
    turn.append(reply);
    return { turn, pic, bubble, words, reply, body };
  }

  function caretBlock() {
    const c = make('span', 'reply-caret');
    c.setAttribute('aria-hidden', 'true');
    return c;
  }

  // ---- the clear button: up whenever there is a conversation to clear ----
  function paintLive() {
    const on = onHome && inner.childElementCount > 0;
    if (on === live) return;
    live = on;
    onLive?.(on);
  }

  // ---- the thread's edges ----
  // Words scrolled past the top, or waiting below the foot, fade out at that
  // edge; an edge with nothing beyond it is left sharp.
  function paintEdges() {
    const below = thread.scrollHeight - thread.clientHeight - thread.scrollTop;
    thread.classList.toggle('is-scrolled', thread.scrollTop > 1);
    thread.classList.toggle('has-more', below > 1);
  }
  new ResizeObserver(paintEdges).observe(inner);

  // ---- keeping the newest line in view ----
  // While a turn plays, the thread is eased down to its foot every frame, so
  // it glides along with the bubbles as they grow rather than jumping a line
  // at a time. Any scroll of the user's own lets go; scrolling back down to
  // the foot takes hold again.
  let pinning = 0;
  function pin(on) {
    cancelAnimationFrame(pinning);
    pinning = 0;
    if (!on) return;
    const tick = () => {
      if (following) {
        const d = thread.scrollHeight - thread.clientHeight - thread.scrollTop;
        if (d > 0.5) thread.scrollTop += reduced() ? d : Math.max(1, d * 0.2);
      }
      pinning = requestAnimationFrame(tick);
    };
    tick();
  }
  function toFoot() {
    thread.scrollTop = thread.scrollHeight;
    paintEdges();
  }
  // at the end of a turn, whatever the frame rate managed, the thread comes
  // to rest at its foot (unless you have scrolled away from it)
  function settleFoot() {
    if (!following || !onHome) return;
    thread.scrollTo({ top: thread.scrollHeight, behavior: reduced() ? 'auto' : 'smooth' });
  }
  // a window that changes size keeps the newest line in view too
  new ResizeObserver(() => { if (following && !pinning) toFoot(); }).observe(thread);
  const release = () => { following = false; };
  thread.addEventListener('wheel', (e) => { if (e.deltaY < 0) release(); }, { passive: true });
  thread.addEventListener('touchstart', release, { passive: true });
  thread.addEventListener('scroll', () => {
    if (thread.scrollHeight - thread.clientHeight - thread.scrollTop < 2) following = true;
    paintEdges();
  }, { passive: true });

  // ---- flights ----
  // A fixed copy crosses the page from a rect down in the composer to where
  // its target sits in the thread. The thread may be scrolling while it
  // goes, so the copy moves with the scroll and lands where the target has
  // got to. The target is measured once, before anything around it starts to
  // pop in: a scaled rect would send the copy to the wrong size and place.
  function fly(ghost, from, target, { size = false, frames = [{}, {}], delay = 0 } = {}) {
    const to = target.getBoundingClientRect();
    const scroll0 = thread.scrollTop;
    ghost.classList.add('is-flight');
    Object.assign(ghost.style, {
      position: 'fixed', left: to.left + 'px', top: to.top + 'px',
      width: to.width + 'px', height: size ? to.height + 'px' : '',
      margin: '0', zIndex: '5', pointerEvents: 'none',
    });
    document.body.append(ghost);
    const first = { translate: `${from.left - to.left}px ${from.top - to.top}px`, ...frames[0] };
    const last = { translate: '0 0', ...frames[1] };
    if (size) {
      Object.assign(first, { width: from.width + 'px', height: from.height + 'px' });
      Object.assign(last, { width: to.width + 'px', height: to.height + 'px' });
    }
    const flight = ghost.animate([first, last], { ...SPRING.settle, delay, fill: 'backwards' });
    let raf = 0;
    const follow = () => {
      ghost.style.top = to.top - (thread.scrollTop - scroll0) + 'px';
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    return flight.finished.catch(() => {}).finally(() => {
      cancelAnimationFrame(raf);
      ghost.remove();
    });
  }

  // ---- sending ----
  // One question at a time: while an answer is on its way, submit says no
  // (returns false) and what you typed waits in the composer.
  function submit({ text = '', photo = null, mood = 'friendly' } = {}) {
    if (busy) return false;
    busy = true;
    send(text, photo, mood);
    return true;
  }

  async function send(text, photo, mood) {
    hurry = false;
    const mine = epoch;
    const still = () => mine === epoch;
    const motion = !reduced();

    // FIRST: where the question, its photo and the caret are now, down in the
    // composer (the photo is still showing there; it goes once this returns)
    const from = prompt.textRect();
    const fromCaret = prompt.caretRect();
    const fromPhoto = photo ? promptForm.querySelector('.composer-thumb img')?.getBoundingClientRect() : null;

    // a question that could not be sent gives its place to this one
    failed?.remove();
    failed = null;

    prompt.clear();
    prompt.setWaiting(true);

    const t = buildTurn(text, photo?.thumb);
    const caret = caretBlock();
    caret.classList.add('is-thinking');
    t.body.append(caret);
    t.reply.classList.add('is-thinking');
    inner.append(t.turn);
    paintLive();
    following = true;
    pin(true);

    if (motion) {
      const k = u();
      const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink');
      // The question flies up into its bubble: a copy of the whole bubble,
      // with no fill, so its words wrap exactly as they will, leaving from
      // where they were typed. The bubble opens around them as they come.
      if (t.bubble) {
        const pad = getComputedStyle(t.bubble);
        const ghost = t.bubble.cloneNode(true);
        ghost.classList.add('is-ghost');
        t.words.style.visibility = 'hidden';
        fly(ghost, {
          left: from.left - parseFloat(pad.paddingLeft),
          top: from.top - parseFloat(pad.paddingTop),
        }, t.bubble, { frames: [{ color: ink }, {}] })
          .then(() => { t.words.style.visibility = ''; });
      }
      // The photo flies up from its place in the composer, opening out from
      // the square crop there to its own shape. It has to know its shape
      // first; its height is fixed (css/home.css), so nothing moves meanwhile.
      if (t.pic && fromPhoto) {
        t.pic.style.visibility = 'hidden';
        const go = () => {
          const ghost = t.pic.cloneNode();
          ghost.alt = '';
          fly(ghost, fromPhoto, t.pic, { size: true, frames: [{ borderRadius: 12 * k + 'px' }, {}] })
            .then(() => { t.pic.style.visibility = ''; });
        };
        t.pic.decode().then(go, () => { t.pic.style.visibility = ''; });
      }
      // The caret goes up too, into the answer's bubble, to wait.
      caret.style.visibility = 'hidden';
      fly(make('span', 'reply-caret is-flying'), fromCaret, caret, { size: true, delay: 80 })
        .then(() => { caret.style.visibility = ''; });

      // Only now, with every target measured, do the bubbles pop in.
      if (t.bubble) animate(t.bubble, [{ opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1 }], SPRING.pop);
      animate(t.reply, [{ opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1 }], { ...SPRING.pop, delay: 200, fill: 'backwards' });
    }

    let reply;
    try {
      reply = await request(text, photo, mood);
    } catch {
      if (!still()) return;
      showError(t, text, photo);
      return;
    }
    if (!still()) return;

    await reveal(t, caret, reply, still);
    if (!still()) return;

    turns.push({ q: text, a: reply, photo: photo ? photo.thumb : null });
    save();
    announcer.textContent = '';
    announcer.textContent = reply;
    await caretHome(caret);
    if (!still()) return;
    pin(false);
    settleFoot();
    busy = false;
  }

  function showError(t, text, photo) {
    t.body.querySelector('.reply-caret')?.remove();
    t.reply.classList.remove('is-thinking');
    t.reply.classList.add('is-error');
    t.body.textContent = 'couldn’t reach the assistant — press enter to try again';
    failed = t.turn;
    busy = false;
    pin(false);
    prompt.setWaiting(false);
    // the question (and its photo) go back into the composer, so Enter sends
    // them again
    if (onFail) onFail({ text, photo });
    else prompt.value = text;
  }

  // ---- the answer, arriving ----
  // Every word is laid out at once, invisible, so the answer's lines are
  // settled before any of it shows. The grey bubble then opens from its small
  // thinking size to the answer's full width, but only one line tall, and
  // grows downward a line at a time as the words resolve into it, the caret
  // riding the end.
  async function reveal(t, caret, text, still) {
    const { reply, body } = t;
    caret.classList.remove('is-thinking');
    caret.classList.add('is-riding');

    if (reduced()) {
      reply.classList.remove('is-thinking');
      linkify(body, text);
      reply.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
      return;
    }

    // FIRST: the thinking bubble's size (its layout size, not its rect: it
    // may still be popping in)
    const w0 = reply.offsetWidth;
    const h0 = reply.offsetHeight;

    const words = [];
    const frag = document.createDocumentFragment();
    for (const part of text.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) { frag.append(part); continue; }
      const w = make('span', 'w', part);
      words.push(w);
      frag.append(w);
    }
    body.textContent = '';
    body.append(frag, caret);
    reply.classList.remove('is-thinking');
    if (words.length > 80) body.classList.add('is-long'); // no blur on a long answer

    // LAST: the finished bubble, and where every word falls in it
    const boxStyle = getComputedStyle(reply);
    const W = parseFloat(boxStyle.width);
    const H = parseFloat(boxStyle.height);
    const textW = parseFloat(getComputedStyle(body).width);
    const lh = parseFloat(getComputedStyle(body).lineHeight);
    const pad = H - parseFloat(getComputedStyle(body).height);
    const top0 = words[0]?.offsetTop ?? 0;
    const lineOf = words.map((w) => Math.round((w.offsetTop - top0) / lh));

    // Hold the words where they wrap, and let the bubble grow around them.
    body.style.width = textW + 'px';
    reply.style.width = w0 + 'px';
    reply.style.height = h0 + 'px';
    reply.classList.add('is-growing');
    void reply.offsetWidth;
    reply.style.width = W + 'px';
    let shown = 0;
    reply.style.height = pad + lh + 'px';

    const step = cadence(words.length);
    for (let i = 0; i < words.length; i++) {
      if (!still()) return;
      const w = words[i];
      if (lineOf[i] > shown) {
        shown = lineOf[i];
        reply.style.height = Math.min(H, pad + (shown + 1) * lh) + 'px';
      }
      w.classList.add('on');
      caret.style.translate = `${w.offsetLeft + w.offsetWidth}px ${lineOf[i] * lh}px`;
      if (!hurry) await wait(step);
    }
    reply.style.height = H + 'px';
    if (!hurry) await wait(600);
    if (!still()) return;

    // flatten: plain text again, so a copy is clean, with its links in place
    body.classList.remove('is-long');
    linkify(body, text);
    body.append(caret);
    reply.classList.remove('is-growing');
    reply.style.width = '';
    reply.style.height = '';
    body.style.width = '';
  }

  // The caret's way home: from the end of the answer down into the composer,
  // where it picks up its blink again.
  async function caretHome(caret) {
    prompt.setWaiting(false);
    if (reduced() || hurry || !onHome) { caret.remove(); return; }
    const from = caret.getBoundingClientRect();
    const home = prompt.caret;
    const to = home.getBoundingClientRect();
    caret.remove();
    const ghost = make('span', 'reply-caret is-flying is-flight');
    Object.assign(ghost.style, {
      position: 'fixed', left: to.left + 'px', top: to.top + 'px',
      width: to.width + 'px', height: to.height + 'px', zIndex: '5',
    });
    document.body.append(ghost);
    home.classList.add('is-away');
    await ghost.animate([
      { translate: `${from.left - to.left}px ${from.top - to.top}px` },
      { translate: '0 0' },
    ], SPRING.settle).finished.catch(() => {});
    ghost.remove();
    home.classList.remove('is-away');
    prompt.refresh();
    // restart the blink from lit
    home.style.animation = 'none';
    void home.offsetWidth;
    home.style.animation = '';
  }

  // ---- clearing: the thread lifts away and the menu comes back ----
  function clear() {
    epoch++;
    controller?.abort();
    busy = false;
    failed = null;
    turns = [];
    save();
    pin(false);
    prompt.setWaiting(false);
    prompt.caret.classList.remove('is-away');
    for (const g of document.querySelectorAll('.is-flight')) g.remove();

    // what was on screen goes up and out of focus, as a copy laid over the
    // thread, so the thread itself is empty at once and ready for a question
    if (inner.childElementCount && !reduced()) {
      const r = thread.getBoundingClientRect();
      const leaving = thread.cloneNode(true);
      leaving.removeAttribute('role');
      leaving.setAttribute('aria-hidden', 'true');
      Object.assign(leaving.style, {
        position: 'fixed', left: r.left + 'px', top: r.top + 'px',
        width: r.width + 'px', height: r.height + 'px', margin: '0',
        pointerEvents: 'none', zIndex: '1',
      });
      document.body.append(leaving);
      leaving.scrollTop = thread.scrollTop;
      leaving.animate([{ opacity: 1 }, { opacity: 0, translate: `0 ${-16 * u()}px`, filter: 'blur(4px)' }],
        { duration: 280, easing: EASE.exit, fill: 'forwards' })
        .finished.then(() => leaving.remove(), () => leaving.remove());
    }
    inner.textContent = '';
    following = true;
    thread.scrollTop = 0;
    paintEdges();
    paintLive();
    prompt.focusIfDesk();
  }

  // ---- coming back to a conversation ----
  // A reload restores the whole thread in place, still, scrolled to its foot.
  for (const turn of turns) {
    const t = buildTurn(turn.q, turn.photo);
    linkify(t.body, turn.a);
    inner.append(t.turn);
  }
  paintLive();
  if (turns.length) {
    toFoot();
    document.fonts?.ready.then(() => { if (following) toFoot(); });
  }

  return {
    submit,
    clear,
    // Leaving Home finishes any answer at once and gives the menu back;
    // coming back puts the clear button up again, and the thread where it was.
    setVisible(on) {
      if (onHome === on) return;
      onHome = on;
      hurry = !on;
      if (!on) lastScroll = thread.scrollTop;
      paintLive();
      if (on) {
        requestAnimationFrame(() => {
          thread.scrollTop = following ? thread.scrollHeight : lastScroll;
          paintEdges();
        });
      }
    },
    get busy() { return busy; },
    get live() { return live; },
  };
}
