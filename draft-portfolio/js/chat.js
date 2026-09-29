// chat.js — the conversation on Home.
//
// It talks to the live site's own proxy, the same Claude Haiku behind the
// same system prompt, and nothing is deployed for it: that proxy answers any
// origin, and its CORS comment expects a draft on localhost to call it
// directly (live-portfolio/api/chat.js:71-74). window.AI_ENDPOINT overrides it
// for testing, as it does on the live site.
//
// Asking takes the page over. The question lifts out of the prompt and flies
// up into the NAME'S place, where a light blue bubble (the Messenger
// reference's) opens around it, and a grey "clear" pill pops in beside it to
// give the name back. The answer writes itself in the band underneath. The
// caret is ONE caret throughout: it leaves the prompt with the question,
// waits at the head of the answer (breathing, not blinking — it is thinking,
// not asking), rides the end of the answer as it arrives, and drops back down
// into the prompt when it is done.
//
// The page shows one exchange at a time, the one you just asked, because the
// question has one place to stand. The conversation behind it is still kept
// and sent, so a follow-up is answered in context.

import { SPRING, EASE, animate, reduced, settle, clearInline, u } from './motion.js';

const ENDPOINT = window.AI_ENDPOINT || 'https://tigo-design-portfolio.vercel.app/api/chat';
const STORE = 'draft.chat';
const TIMEOUT = 20000;

// the live client's pace: 3.5s for a whole answer, but never faster than
// 12ms or slower than 30ms a word (live-portfolio/js/ai-chat.js revealWords)
const cadence = (words) => Math.min(30, Math.max(12, 3500 / words));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function createChat({ prompt, promptForm, name, ask, answerBox, announcer, onFail }) {
  const bubble = ask.querySelector('.ask-bubble');
  const bubbleText = ask.querySelector('.ask-text');
  const bubbleThumb = ask.querySelector('.ask-thumb');
  const clearBtn = ask.querySelector('.ask-clear');
  const answer = answerBox.querySelector('.answer-text');
  const placeholder = promptForm.querySelector('.prompt-placeholder');

  let turns = load();   // completed pairs only: [{ q, a, photo }] (photo: a small thumbnail, or null)
  let epoch = 0;        // bumped by "clear"; a reply from an older epoch is dropped
  let busy = false;
  let controller = null;
  let hurry = false;    // leaving Home: finish any reveal at once
  let onHome = true;
  let asking = false;   // the question is standing in the name's place
  let failed = false;   // the last question could not be sent
  let following = true;

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

  function caretBlock(cls) {
    const c = document.createElement('span');
    c.className = 'answer-caret ' + cls;
    c.setAttribute('aria-hidden', 'true');
    return c;
  }

  // ---- the name's place: the name, or the question ----
  // Both stand in one grid cell. The one leaving goes up and out of focus;
  // the one arriving comes up from below and sharpens. Neither is ever
  // display:none, so the cell never changes height and the tiles never move.
  function hide(el, { instant = false } = {}) {
    settle(el);
    el.inert = true;
    const done = () => { el.classList.remove('is-on'); if (el === name) el.style.visibility = 'hidden'; clearInline(el); };
    if (instant || reduced()) {
      if (!instant) el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160 }).finished.then(done, () => {});
      else done();
      return;
    }
    const k = u();
    el.animate([{}, { opacity: 0, translate: `0 ${-10 * k}px`, filter: 'blur(4px)' }],
      { duration: 220, easing: EASE.exit, fill: 'forwards' })
      .finished.then((a) => { done(); a.cancel?.(); }, () => {});
  }
  function show(el, { instant = false, delay = 0 } = {}) {
    settle(el);
    el.inert = false;
    el.style.visibility = '';
    el.classList.add('is-on');
    if (instant) { clearInline(el); return; }
    const k = u();
    animate(el, [
      { opacity: 0, translate: `0 ${10 * k}px`, filter: 'blur(4px)' },
      { opacity: 1, translate: '0 0', filter: 'blur(0px)' },
    ], { ...SPRING.settle, delay, fill: 'backwards' });
  }

  function setAsking(on, { instant = false } = {}) {
    if (asking === on) return;
    asking = on;
    if (on) {
      hide(name, { instant });
      settle(ask);
      ask.inert = false;
      ask.classList.add('is-on');
      clearInline(ask);
      if (!instant && !reduced()) {
        // the bubble opens around the arriving question; "clear" pops in after
        animate(bubble, [{ opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1 }],
          { ...SPRING.pop, delay: 140, fill: 'backwards' });
        animate(clearBtn, [{ opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1 }],
          { ...SPRING.pop, delay: 300, fill: 'backwards' });
      }
    } else {
      hide(ask, { instant });
      show(name, { instant, delay: instant ? 0 : 120 });
    }
  }

  // ---- keeping the newest line in view ----
  // While an answer writes itself, a long one is kept scrolled to its foot.
  // Any scroll of the user's own lets go; scrolling back down takes hold.
  let pinning = 0;
  function pin(on) {
    cancelAnimationFrame(pinning);
    if (!on) return;
    const tick = () => {
      if (following) answerBox.scrollTop = answerBox.scrollHeight;
      pinning = requestAnimationFrame(tick);
    };
    tick();
  }
  const release = () => { following = false; };
  answerBox.addEventListener('wheel', release, { passive: true });
  answerBox.addEventListener('touchstart', release, { passive: true });
  answerBox.addEventListener('scroll', () => {
    if (answerBox.scrollHeight - answerBox.clientHeight - answerBox.scrollTop < 2) following = true;
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
    hurry = false;
    failed = false;
    const mine = epoch;
    const still = () => mine === epoch;
    const motion = !reduced();
    const k = u();

    // FIRST: where the typed question and the caret are now, in the composer
    const from = prompt.textRect();
    const fromCaret = prompt.caretRect();
    const oldWidth = asking ? bubble.getBoundingClientRect().width : 0;
    const hadAnswer = answer.textContent.trim().length > 0;

    prompt.clear();
    prompt.setWaiting(true);

    // the last answer steps aside
    if (hadAnswer && motion) {
      const leaving = answer.cloneNode(true);
      const r = answer.getBoundingClientRect();
      Object.assign(leaving.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', margin: '0', pointerEvents: 'none', zIndex: '4' });
      document.body.append(leaving);
      leaving.animate([{ opacity: 1 }, { opacity: 0, translate: `0 ${-12 * k}px`, filter: 'blur(4px)' }],
        { duration: 220, easing: EASE.exit, fill: 'forwards' }).finished.then(() => leaving.remove(), () => leaving.remove());
    }
    answer.classList.remove('is-error');
    answer.textContent = '';
    answerBox.scrollTop = 0;

    // the question goes up into the name's place, with its photo if it has one
    bubbleText.textContent = text;
    bubbleThumb.hidden = !photo;
    if (photo) bubbleThumb.src = photo.thumb;
    else bubbleThumb.removeAttribute('src');
    const wasAsking = asking;
    setAsking(true);
    const thinking = caretBlock('is-thinking');
    answer.classList.add('is-thinking');
    answer.append(thinking);
    following = true;

    if (motion) {
      // A second question into an open bubble: the bubble resizes to it on
      // the spring, and "clear" rides along beside it.
      if (wasAsking && oldWidth) {
        const newWidth = bubble.getBoundingClientRect().width;
        if (Math.abs(newWidth - oldWidth) > 1) {
          bubble.animate([{ width: oldWidth + 'px' }, { width: newWidth + 'px' }], SPRING.settle);
        }
      }

      // The question itself flies: a copy of it, set as it will be in the
      // bubble, goes from where it was typed to where it lands, and the real
      // text is shown the moment it arrives. It is a fixed copy over
      // everything, since it crosses the whole page.
      const to = bubbleText.getBoundingClientRect();
      const ghost = bubbleText.cloneNode(true);
      if (!text) ghost.style.display = 'none';
      Object.assign(ghost.style, {
        position: 'fixed', left: to.left + 'px', top: to.top + 'px', width: to.width + 'px',
        margin: '0', zIndex: '5', pointerEvents: 'none', color: getComputedStyle(bubbleText).color,
      });
      ghost.className = bubbleText.className;
      document.body.append(ghost);
      bubbleText.style.visibility = 'hidden';
      const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink');
      ghost.animate([
        { translate: `${from.left - to.left}px ${from.top - to.top}px`, color: ink },
        { translate: '0 0' },
      ], { ...SPRING.settle, fill: 'backwards' })
        .finished.finally(() => { ghost.remove(); bubbleText.style.visibility = ''; });

      // The emptied field's placeholder comes back, a beat behind.
      animate(placeholder, [
        { opacity: 0, translate: `0 ${8 * k}px` },
        { opacity: 1, translate: '0 0' },
      ], { duration: 520, easing: EASE.rise, delay: 160, fill: 'backwards' });

      // And the caret goes up too, to wait at the head of the answer.
      const at = thinking.getBoundingClientRect();
      animate(thinking, [
        { translate: `${fromCaret.left - at.left}px ${fromCaret.top - at.top}px` },
        { translate: '0 0' },
      ], { ...SPRING.settle, fill: 'backwards' });
    }

    let reply;
    try {
      reply = await request(text, photo, mood);
    } catch {
      if (!still()) return;
      showError(text, photo);
      return;
    }
    if (!still()) return;

    await reveal(reply, still);
    if (!still()) return;

    turns.push({ q: text, a: reply, photo: photo ? photo.thumb : null });
    save();
    announcer.textContent = '';
    announcer.textContent = reply;
    await caretHome();
    if (!still()) return;
    busy = false;
  }

  function showError(text, photo) {
    answer.classList.remove('is-thinking');
    answer.classList.add('is-error');
    answer.textContent = 'couldn’t reach the assistant — press enter to try again, or clear';
    failed = true;
    busy = false;
    prompt.setWaiting(false);
    // the question (and its photo) go back into the composer, so Enter sends
    // them again
    if (onFail) onFail({ text, photo });
    else prompt.value = text;
  }

  // ---- the answer, arriving ----
  // Every word is laid out at once, invisible, so the answer's lines are
  // settled before any of it shows; then the words resolve one at a time,
  // with the caret riding the end. It grows downward from the top of the band,
  // so nothing above it ever has to move.
  async function reveal(text, still) {
    answer.classList.remove('is-thinking');
    const caret = answer.querySelector('.answer-caret');
    caret.classList.remove('is-thinking');
    caret.classList.add('is-riding');

    if (reduced()) {
      linkify(answer, text);
      answer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
      return;
    }

    const words = [];
    const frag = document.createDocumentFragment();
    for (const part of text.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) { frag.append(part); continue; }
      const w = document.createElement('span');
      w.className = 'w';
      w.textContent = part;
      words.push(w);
      frag.append(w);
    }
    answer.textContent = '';
    answer.append(frag, caret);
    if (words.length > 80) answer.classList.add('is-long'); // no blur on a long answer

    const lh = parseFloat(getComputedStyle(answer).lineHeight);
    const top0 = words[0]?.offsetTop ?? 0;
    const lineOf = words.map((w) => Math.round((w.offsetTop - top0) / lh));
    pin(true);

    const step = cadence(words.length);
    for (let i = 0; i < words.length; i++) {
      if (!still()) { pin(false); return; }
      const w = words[i];
      w.classList.add('on');
      caret.style.translate = `${w.offsetLeft + w.offsetWidth}px ${lineOf[i] * lh}px`;
      if (!hurry) await wait(step);
    }
    if (!hurry) await wait(520);
    pin(false);
    if (!still()) return;

    // flatten: plain text again, so a copy is clean, with its links in place
    answer.classList.remove('is-long');
    linkify(answer, text);
    answer.append(caret);
  }

  // The caret's way home: from the end of the answer down into the prompt,
  // where it picks up its blink again.
  async function caretHome() {
    const caret = answer.querySelector('.answer-caret');
    prompt.setWaiting(false);
    if (!caret) return;
    if (reduced() || hurry || !onHome) { caret.remove(); return; }
    const from = caret.getBoundingClientRect();
    const home = prompt.caret;
    const to = home.getBoundingClientRect();
    caret.remove();
    const ghost = document.createElement('span');
    ghost.className = 'answer-caret is-flying';
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

  // ---- clearing: the name comes back ----
  function clear() {
    epoch++;
    controller?.abort();
    busy = false;
    failed = false;
    turns = [];
    save();
    pin(false);
    prompt.setWaiting(false);
    prompt.caret.classList.remove('is-away');
    setAsking(false);
    if (answer.textContent.trim() && !reduced()) {
      const r = answer.getBoundingClientRect();
      const leaving = answer.cloneNode(true);
      Object.assign(leaving.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', margin: '0', pointerEvents: 'none' });
      document.body.append(leaving);
      leaving.animate([{ opacity: 1 }, { opacity: 0, translate: `0 ${-14 * u()}px`, filter: 'blur(4px)' }],
        { duration: 260, easing: EASE.exit, fill: 'forwards' }).finished.then(() => leaving.remove(), () => leaving.remove());
    }
    answer.classList.remove('is-error', 'is-thinking', 'is-long');
    answer.textContent = '';
    answerBox.scrollTop = 0;
    prompt.focusIfDesk();
  }
  clearBtn.addEventListener('click', clear);

  // ---- coming back to a conversation ----
  // A reload restores the last exchange in place, still, with no flight.
  if (turns.length) {
    const last = turns.at(-1);
    bubbleText.textContent = last.q;
    if (last.photo) { bubbleThumb.src = last.photo; bubbleThumb.hidden = false; }
    linkify(answer, last.a);
    setAsking(true, { instant: true });
  }

  return {
    submit,
    clear,
    // Leaving Home finishes any answer at once and gives the name back to the
    // header, which every page shares; coming back puts the question up again.
    setVisible(on) {
      if (onHome === on) return;
      onHome = on;
      hurry = !on;
      const live = turns.length > 0 || busy || failed;
      if (!live) return;
      setAsking(on);
    },
    get busy() { return busy; },
    get asking() { return asking; },
  };
}
