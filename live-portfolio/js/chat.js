// chat.js — the conversation on Home.
//
// It talks to the site's own proxy, api/chat.js: Claude Haiku behind the
// system prompt written there. On the site that is the page's own /api/chat.
// A copy of the site on this machine (tools/serve.py) has no /api of its own,
// so it asks production's, which lets localhost in and no other origin. That
// is the www address, not the bare domain: the bare domain redirects to www,
// and a preflight cannot follow a redirect. window.AI_ENDPOINT overrides
// either, for testing.
//
// The conversation is a thread down the page from its top, as in Messenger:
// each question in a light blue bubble on the right, each answer in a grey
// one on the left under it, the newest at the foot; past the band's height
// it scrolls.
//
// It is kept as plain as a thread can be. The question appears in its
// bubble the moment it is sent, and under it the answer's bubble with three
// dots in it; when the answer comes, the dots give way to all of it at once.
// Each of those fades in where it will stay and nothing else moves. (It was
// choreographed: the question flew up out of the composer in an arc, the
// caret flew up after it to wait in the answer, and the answer was typed out
// word by word, the bubble growing a line at a time. Every piece of that was
// tuned, and together it was too much to watch while trying to read.)
//
// While there is a conversation, the menu square gives its place to a clear
// button, the name steps aside and the composer's pill stays open
// (js/main.js); this file says when.

import { EASE, animate, reduced, u } from './motion.js';

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const ENDPOINT = window.AI_ENDPOINT || (LOCAL ? 'https://www.tigoponcedeleon.com/api/chat' : '/api/chat');
const STORE = 'draft.chat';
const TIMEOUT = 20000;

export function createChat({ prompt, thread, announcer, onFail, onLive }) {
  const inner = thread.querySelector('.thread-inner');

  let turns = load();   // completed pairs only: [{ q, a, photo }] (photo: a small copy, or null)
  let epoch = 0;        // bumped by "clear"; a reply from an older epoch is dropped
  let busy = false;
  let controller = null;
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
  // messages at most, and always starting on a question. (The old site's
  // client took the last twenty messages, which from the eleventh question
  // on started the window on an answer, and a window has to start on a
  // question: api/chat.js turns one away that doesn't.)
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
    if (photo) {
      const pic = make('img', 'turn-photo');
      pic.src = photo;
      pic.alt = 'A photo you sent';
      turn.append(pic);
    }
    if (q) {
      const bubble = make('p', 'bubble bubble-q');
      bubble.append(make('span', 'sr-only', 'You asked: '), make('span', 'bubble-words', q));
      turn.append(bubble);
    }
    const reply = make('div', 'bubble bubble-a');
    const body = make('p', 'bubble-text');
    reply.append(make('span', 'sr-only', 'Answer: '), body);
    turn.append(reply);
    return { turn, reply, body };
  }

  // While the answer is on its way, its bubble holds three dots, the sign
  // every messenger uses for the other side writing (css/home.css).
  function thinking(t) {
    const dots = make('span', 'dots');
    dots.setAttribute('aria-hidden', 'true');
    dots.append(make('i'), make('i'), make('i'));
    t.body.replaceChildren(dots);
    t.reply.classList.add('is-thinking');
  }

  // Everything that comes into the thread comes in the same one way: it
  // fades in where it will stay, rising the last few pixels on an ease-out.
  // Nothing flies, types, grows or blurs.
  function arrive(el, delay = 0) {
    return animate(el, [
      { opacity: 0, translate: `0 ${6 * u()}px` },
      { opacity: 1, translate: '0 0' },
    ], { duration: 260, easing: EASE.rise, delay, fill: 'backwards' });
  }

  // ---- the clear button: up whenever there is a conversation to clear ----
  function paintLive() {
    const on = onHome && inner.childElementCount > 0;
    if (on === live) return;
    live = on;
    onLive?.(on);
  }

  // ---- keeping the newest turn in view ----
  // Whenever something comes in, the thread goes down to its foot, unless
  // you have scrolled up to read; scrolling back down to the foot takes hold
  // again. A window that changes size keeps the foot in view too.
  function toFoot({ smooth = false } = {}) {
    if (!following || !onHome) return;
    thread.scrollTo({ top: thread.scrollHeight, behavior: smooth && !reduced() ? 'smooth' : 'auto' });
  }
  new ResizeObserver(() => toFoot()).observe(thread);
  const release = () => { following = false; };
  thread.addEventListener('wheel', (e) => { if (e.deltaY < 0) release(); }, { passive: true });
  thread.addEventListener('touchstart', release, { passive: true });
  thread.addEventListener('scroll', () => {
    if (thread.scrollHeight - thread.clientHeight - thread.scrollTop < 2) following = true;
  }, { passive: true });

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
    const mine = epoch;
    const still = () => mine === epoch;

    // a question that could not be sent gives its place to this one
    failed?.remove();
    failed = null;
    prompt.clear();

    // The question (and its photo) come in at once, and the answer's bubble,
    // with its dots, a beat after.
    const t = buildTurn(text, photo?.thumb);
    thinking(t);
    inner.append(t.turn);
    paintLive();
    for (const el of t.turn.children) if (el !== t.reply) arrive(el);
    arrive(t.reply, 160);
    following = true;
    toFoot({ smooth: true });

    let reply;
    try {
      reply = await request(text, photo, mood);
    } catch {
      if (!still()) return;
      showError(t, text, photo);
      return;
    }
    if (!still()) return;

    // The answer takes the dots' place, the whole of it at once. (It used to
    // be typed out word by word, the bubble growing a line at a time with the
    // caret riding its end; a thread of answers read better arriving whole.)
    t.reply.classList.remove('is-thinking');
    linkify(t.body, reply);
    arrive(t.reply);
    toFoot({ smooth: true });

    turns.push({ q: text, a: reply, photo: photo ? photo.thumb : null });
    save();
    announcer.textContent = '';
    announcer.textContent = reply;
    busy = false;
  }

  function showError(t, text, photo) {
    t.reply.classList.remove('is-thinking');
    t.reply.classList.add('is-error');
    t.body.textContent = 'couldn’t reach the assistant — press enter to try again';
    failed = t.turn;
    busy = false;
    // the question (and its photo) go back into the composer, so Enter sends
    // them again
    if (onFail) onFail({ text, photo });
    else prompt.value = text;
  }

  // ---- clearing: the thread fades away, and the name and the menu come back ----
  function clear() {
    epoch++;
    controller?.abort();
    busy = false;
    failed = null;
    turns = [];
    save();

    // what was on screen fades out, as a copy laid over the thread, so the
    // thread itself is empty at once and ready for a question
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
      leaving.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-out', fill: 'forwards' })
        .finished.then(() => leaving.remove(), () => leaving.remove());
    }
    inner.textContent = '';
    following = true;
    thread.scrollTop = 0;
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
    document.fonts?.ready.then(() => toFoot());
  }

  return {
    submit,
    clear,
    // Leaving Home gives the menu back; coming back puts the clear button up
    // again, and the thread where it was.
    setVisible(on) {
      if (onHome === on) return;
      onHome = on;
      if (!on) lastScroll = thread.scrollTop;
      paintLive();
      if (on) {
        requestAnimationFrame(() => {
          thread.scrollTop = following ? thread.scrollHeight : lastScroll;
        });
      }
    },
    get busy() { return busy; },
    get live() { return live; },
  };
}
