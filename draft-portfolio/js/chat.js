// chat.js — the conversation on Home.
//
// It talks to the live site's own proxy, the same Claude Haiku behind the
// same system prompt, and nothing is deployed for it: that proxy answers any
// origin, and its CORS comment expects a draft on localhost to call it
// directly (live-portfolio/api/chat.js:71-74). window.AI_ENDPOINT overrides it
// for testing, as it does on the live site.
//
// It reads like a shell's history. A question goes up as the whole line it
// was, "ask me anything: …", with the label faded right back, and the answer
// types itself out under it. The caret is ONE caret: it leaves the prompt
// with the question, waits at the head of the answer (breathing, not
// blinking — it is thinking, not asking), rides the end of the answer as it
// arrives, and drops back down into the prompt when it is done.

import { SPRING, EASE, animate, reduced, u } from './motion.js';

const ENDPOINT = window.AI_ENDPOINT || 'https://tigo-design-portfolio.vercel.app/api/chat';
const STORE = 'draft.chat';
const LABEL = 'ask me anything:';
const TIMEOUT = 20000;

// the live client's pace: 3.5s for a whole answer, but never faster than
// 12ms or slower than 30ms a word (live-portfolio/js/ai-chat.js revealWords)
const cadence = (words) => Math.min(30, Math.max(12, 3500 / words));

export function createChat({ thread, prompt, promptForm, clearBtn, announcer }) {
  const inner = thread.querySelector('.thread-inner');
  const promptLabel = promptForm.querySelector('.prompt-label');

  let turns = load();     // completed pairs only: [{ q, a }]
  let epoch = 0;          // bumped by "clear"; a reply from an older epoch is dropped
  let busy = false;
  let controller = null;
  let following = true;   // keep the newest line in view while an answer grows
  let hurry = false;      // leaving Home: finish any reveal at once
  let failed = null;      // the turn element of a question that could not be sent

  // ---- memory: the session keeps the conversation across reloads ----
  function load() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE));
      return saved?.v === 1 && Array.isArray(saved.turns) ? saved.turns : [];
    } catch { return []; }
  }
  function save() {
    try { sessionStorage.setItem(STORE, JSON.stringify({ v: 1, turns })); } catch { /* private mode */ }
  }

  // ---- the request ----
  // The payload is the last nine pairs and the new question: nineteen
  // messages at most, and always starting on a question. (The live client
  // takes the last twenty messages, which from the eleventh question on
  // starts the window on an answer.)
  async function ask(text) {
    controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    try {
      const messages = turns.slice(-9).flatMap((t) => [
        { role: 'user', content: t.q },
        { role: 'assistant', content: t.a },
      ]);
      messages.push({ role: 'user', content: text });
      // Content-Type is the only header the proxy's preflight allows.
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, persona: 'friendly' }),
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

  // ---- building lines ----
  function questionLine(text) {
    const q = document.createElement('p');
    q.className = 'turn-q';
    const label = document.createElement('span');
    label.className = 'turn-q-label';
    label.setAttribute('aria-hidden', 'true');
    label.textContent = LABEL;
    q.append(label, document.createTextNode(text));
    return q;
  }

  function turnElement(q, a) {
    const turn = document.createElement('div');
    turn.className = 'turn';
    turn.append(questionLine(q));
    const answer = document.createElement('p');
    answer.className = 'turn-a';
    if (a != null) linkify(answer, a);
    turn.append(answer);
    return turn;
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

  function caretBlock(cls) {
    const c = document.createElement('span');
    c.className = 'turn-caret ' + cls;
    c.setAttribute('aria-hidden', 'true');
    return c;
  }

  // ---- keeping the newest line in view ----
  // While an answer grows, the thread is pinned to its foot every frame. Any
  // scroll of the user's own lets go of it, and scrolling back down to the
  // foot takes hold again.
  let pinning = 0;
  function pin(on) {
    cancelAnimationFrame(pinning);
    if (!on) return;
    const tick = () => {
      if (following) thread.scrollTop = thread.scrollHeight;
      pinning = requestAnimationFrame(tick);
    };
    tick();
  }
  const release = () => { following = false; };
  thread.addEventListener('wheel', release, { passive: true });
  thread.addEventListener('touchstart', release, { passive: true });
  thread.addEventListener('scroll', () => {
    if (thread.scrollHeight - thread.clientHeight - thread.scrollTop < 2) following = true;
  }, { passive: true });

  // ---- sending ----
  async function submit(text) {
    if (busy) return; // one question at a time; what you typed waits in the prompt
    busy = true;
    hurry = false;
    const mine = epoch;
    const still = () => mine === epoch;
    const motion = !reduced();

    if (failed) { failed.remove(); failed = null; }

    // FIRST: where the question and the caret are now, in the prompt
    const fromLine = promptForm.getBoundingClientRect();
    const fromCaret = prompt.caretRect();
    const older = [...inner.children];
    const oldTop = older.at(-1)?.getBoundingClientRect().top;

    // the new turn: the echoed question, and an answer line with the caret
    const turn = document.createElement('div');
    turn.className = 'turn';
    const q = questionLine(text);
    const a = document.createElement('p');
    a.className = 'turn-a is-thinking';
    const thinking = caretBlock('is-thinking');
    a.append(thinking);
    turn.append(q, a);
    inner.append(turn);
    clearBtn.hidden = false;
    following = true;
    thread.scrollTop = thread.scrollHeight;

    prompt.clear();
    prompt.setWaiting(true);

    if (motion) {
      const k = u();
      // LAST, then play. Older turns slide up from where they were.
      if (older.length) {
        const dy = oldTop - older.at(-1).getBoundingClientRect().top;
        for (const t of older) animate(t, [{ translate: `0 ${dy}px` }, { translate: '0 0' }], SPRING.settle);
      }

      // The question itself flies. A copy of the whole line — label and all,
      // so it wraps exactly as it did in the prompt — goes from the prompt to
      // its place in the thread, fading from ink to history as it rises. It
      // is a fixed copy over everything because the thread clips its own
      // edges, and the flight starts outside them.
      const to = q.getBoundingClientRect();
      const ghost = q.cloneNode(true);
      ghost.classList.add('turn-ghost');
      Object.assign(ghost.style, {
        position: 'fixed', left: to.left + 'px', top: to.top + 'px', width: to.width + 'px',
        margin: '0', zIndex: '5', pointerEvents: 'none',
      });
      document.body.append(ghost);
      q.style.visibility = 'hidden';
      const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink');
      const flight = ghost.animate([
        { translate: `${fromLine.left - to.left}px ${fromLine.top - to.top}px`, color: ink },
        { translate: '0 0', color: getComputedStyle(q).color },
      ], { ...SPRING.settle, fill: 'backwards' });
      ghost.querySelector('.turn-q-label').animate(
        [{ color: ink }, { color: getComputedStyle(q.querySelector('.turn-q-label')).color }],
        { duration: 420, easing: 'ease', fill: 'backwards' },
      );
      flight.finished.finally(() => { ghost.remove(); q.style.visibility = ''; });

      // A fresh label rises into the emptied prompt, a beat behind.
      animate(promptLabel, [
        { opacity: 0, translate: `0 ${12 * k}px` },
        { opacity: 1, translate: '0 0' },
      ], { duration: 520, easing: EASE.rise, delay: 120, fill: 'backwards' });

      // And the caret goes up with it, to wait at the head of the answer.
      const at = thinking.getBoundingClientRect();
      animate(thinking, [
        { translate: `${fromCaret.left - at.left}px ${fromCaret.top - at.top}px`, opacity: 1 },
        { translate: '0 0', opacity: 1 },
      ], { ...SPRING.settle, fill: 'backwards' });
    }

    let reply;
    try {
      reply = await ask(text);
    } catch (err) {
      if (!still()) return;
      showError(turn, a, text);
      return;
    }
    if (!still()) return;

    await reveal(a, reply, still);
    if (!still()) return;

    turns.push({ q: text, a: reply });
    save();
    announcer.textContent = '';
    announcer.textContent = reply;
    await caretHome(a);
    if (!still()) return;
    busy = false;
  }

  function showError(turn, a, text) {
    a.classList.remove('is-thinking');
    a.classList.add('is-error');
    a.textContent = 'couldn’t reach the assistant — press enter to try again';
    failed = turn;
    busy = false;
    prompt.setWaiting(false);
    // the question goes back into the prompt, so Enter sends it again; and
    // "clear" stays, so the failed line can be dismissed without a retry
    prompt.value = text;
  }

  // ---- the answer, arriving ----
  // Every word is laid out at once (invisible), so the lines are known before
  // any of them shows. The answer is then clipped to the lines revealed so
  // far, and its height grows a line at a time on the settling spring: the
  // history above drifts up as the answer needs room, like a teleprompter,
  // instead of jumping once by the whole answer's height.
  async function reveal(a, text, still) {
    const motion = !reduced();
    a.classList.remove('is-thinking');
    const caret = a.querySelector('.turn-caret');
    caret.classList.remove('is-thinking');
    caret.classList.add('is-riding');

    if (!motion) {
      linkify(a, text);
      a.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
      return;
    }

    const parts = text.split(/(\s+)/);
    const words = [];
    const frag = document.createDocumentFragment();
    for (const part of parts) {
      if (!part) continue;
      if (/^\s+$/.test(part)) { frag.append(part); continue; }
      const w = document.createElement('span');
      w.className = 'w';
      w.textContent = part;
      words.push(w);
      frag.append(w);
    }
    a.textContent = '';
    a.append(frag, caret);
    if (words.length > 80) a.classList.add('is-long'); // no blur on a long answer

    const lh = parseFloat(getComputedStyle(a).lineHeight);
    const top0 = words[0]?.offsetTop ?? 0;
    const lineOf = words.map((w) => Math.round((w.offsetTop - top0) / lh));
    let shown = 0; // lines visible
    a.style.height = lh + 'px';
    a.classList.add('is-growing');
    pin(true);

    const step = cadence(words.length);
    for (let i = 0; i < words.length; i++) {
      if (!still()) { pin(false); return; }
      const w = words[i];
      w.classList.add('on');
      if (lineOf[i] + 1 > shown) {
        shown = lineOf[i] + 1;
        a.style.height = shown * lh + 'px';
      }
      caret.style.translate = `${w.offsetLeft + w.offsetWidth}px ${lineOf[i] * lh}px`;
      if (!hurry) await wait(step);
    }
    if (!hurry) await wait(520);
    pin(false);
    if (!still()) return;

    // flatten: plain text again, so a copy is clean, with its links in place
    a.classList.remove('is-growing', 'is-long');
    a.style.height = '';
    const rest = caret;
    linkify(a, text);
    a.append(rest);
  }

  // The caret's way home: from the end of the answer down into the prompt,
  // where it picks up its blink again.
  async function caretHome(a) {
    const caret = a.querySelector('.turn-caret');
    prompt.setWaiting(false);
    if (!caret) return;
    if (reduced() || hurry) { caret.remove(); return; }
    const from = caret.getBoundingClientRect();
    const home = prompt.caret;
    const to = home.getBoundingClientRect();
    caret.remove();
    const ghost = document.createElement('span');
    ghost.className = 'turn-caret is-flying';
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

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---- clearing ----
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
    clearBtn.hidden = true;
    const gone = [...inner.children];
    if (reduced() || !gone.length) { inner.replaceChildren(); return; }
    const k = u();
    Promise.allSettled(gone.map((t, i) => t.animate([
      { opacity: 1, translate: '0 0' },
      { opacity: 0, translate: `0 ${-16 * k}px` },
    ], { duration: 280, easing: EASE.exit, delay: Math.min(i, 6) * 20, fill: 'forwards' }).finished))
      .then(() => { for (const t of gone) t.remove(); });
    prompt.focusIfDesk();
  }
  clearBtn.addEventListener('click', clear);

  // ---- coming back to a conversation ----
  function restore() {
    if (!turns.length) return;
    inner.replaceChildren(...turns.map((t) => turnElement(t.q, t.a)));
    clearBtn.hidden = false;
    requestAnimationFrame(() => { thread.scrollTop = thread.scrollHeight; });
  }
  restore();

  return {
    submit,
    clear,
    // leaving Home in the middle of an answer finishes it at once
    setVisible(on) { hurry = !on; },
    get busy() { return busy; },
  };
}
