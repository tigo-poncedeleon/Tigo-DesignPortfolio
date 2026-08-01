// Tigo AI chat — draft-portfolio version of working-portfolio/js/ai-chat.js.
//
// Backend: the SAME Vercel proxy as working-portfolio (api/chat.js there):
//   POST AI_ENDPOINT  body: { messages: [{ role, content }, ...] }
//   ->   Anthropic Messages JSON — reply at data.content[0].text
// The key + system prompt live only in the proxy. The endpoint is absolute so
// the page works from localhost and from any deploy; override with
// window.AI_ENDPOINT if needed. On any failure the canned OFFLINE_ANSWERS
// keep the panel alive and the subtitle says so, honestly.
//
// This version adds: the empty-state spark's exit, bobbing thinking dots,
// word-by-word answer reveal, follow-up chips that ride the conversation,
// and a sessionStorage transcript so the chat survives hopping home and
// back (the play tallies' manner).
(() => {
  const AI_ENDPOINT =
    window.AI_ENDPOINT || 'https://tigo-design-portfolio.vercel.app/api/chat';
  const STORE_KEY = 'ai.history';
  const SUB_LIVE = 'powered by Claude Haiku 4.5';
  const SUB_OFFLINE = 'offline — canned answers for now';

  const stage    = document.getElementById('ai-stage');
  const panel    = document.getElementById('ai-panel');
  const scroll   = document.getElementById('ai-scroll');
  const prompts  = document.getElementById('ai-prompts');
  const inputBar = document.getElementById('ai-inputbar');
  const input    = document.getElementById('ai-input');
  const emptyEl  = document.getElementById('ai-empty');
  const subEl    = document.getElementById('ai-sub');
  const liveEl   = document.getElementById('ai-live');
  const sendBtn  = inputBar ? inputBar.querySelector('.ai-send') : null;
  const overlay  = document.getElementById('ai-overlay');
  const card     = document.getElementById('shell-card');
  if (!scroll) return;

  /* ============================================================
     Open / close
     The chat is a sheet now, not a page, so .revealed has to fire on
     every OPEN rather than once on load — otherwise the spark only ever
     draws itself the first time. The reflow flush between remove and add
     is load-bearing: without it the class toggle coalesces into nothing.
     ============================================================ */
  let isOpen = false;
  let lastFocus = null;
  let inflight = null;

  function open(seed) {
    if (!overlay || isOpen) return;
    isOpen = true;
    lastFocus = document.activeElement;
    overlay.hidden = false;
    restoreEmpty();
    // inert kills focus, clicks and key bleed into the page underneath in
    // one move — which on play.html means the games stop hearing the
    // keyboard the moment the sheet is up
    if (card) card.setAttribute('inert', '');
    document.documentElement.classList.add('ai-open');
    stage.classList.remove('revealed');
    stage.offsetHeight;                       // commit before re-adding
    requestAnimationFrame(() => {
      stage.classList.add('revealed');
      const sc = document.getElementById('ai-scrim');
      if (sc) sc.classList.add('is-lit');
    });
    document.addEventListener('keydown', onKey, true);
    if (input) input.focus({ preventScroll: true });
    if (seed) submitQuestion(seed);
  }

  function close() {
    if (!overlay || !isOpen) return;
    isOpen = false;
    if (inflight) inflight.abort();
    stage.classList.remove('revealed');
    const sc = document.getElementById('ai-scrim');
    if (sc) sc.classList.remove('is-lit');
    document.removeEventListener('keydown', onKey, true);
    if (card) card.removeAttribute('inert');
    document.documentElement.classList.remove('ai-open');
    setTimeout(() => { if (!isOpen) overlay.hidden = true; }, 500);  // --t-stage
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  // capture phase, so Escape closes the sheet before any game sees it
  function onKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = stage.querySelectorAll(
      'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])');
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  if (overlay) {
    const scrim = document.getElementById('ai-scrim');
    if (scrim) scrim.addEventListener('click', close);
    const x = overlay.querySelector('.ai-x');
    if (x) x.addEventListener('click', close);
  } else {
    // no shell (or an older page): behave exactly as before
    requestAnimationFrame(() => stage && stage.classList.add('revealed'));
  }

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const prefersReduced = () => motionQuery.matches;

  const history = [];
  let responding = false;
  let offline = false;

  const OFFLINE_ANSWERS = {
    'tell me your background!':
      'I am a Digital Product Designer studying Media Arts & Design and Computer ' +
      'Science at the University of Chicago.\n\nI have worked at Vicino AI, ' +
      'PantryPal, and Next Level Drone Cleaning.',
    'what is your design philosophy?':
      'Design should feel honest and a little playful. I care about clarity ' +
      'first, then the small details that make a product feel alive.',
    'your toolset?':
      'Figma for design, plus hand-written HTML/CSS/JS for the web. I lean on ' +
      'UX research, prototyping, and a bit of AI tooling to move faster.',
    'hobbies?':
      "Outside of design I'm into soccer — especially following Real Madrid — " +
      'and anything that gets me making things with my hands.',
    _default:
      "I couldn't reach my live assistant just now — try again in a moment, " +
      'or tap one of the suggested prompts.',
  };

  // conversation starters that keep going after the first answer; each is
  // offered once, and never one the visitor already asked
  const FOLLOWUPS = [
    'What is PantryPal?',
    'Tell me about Vicino AI',
    'The drone-brand story?',
    'Are you open to full-time roles?',
    'What are you studying?',
    'Where did you grow up?',
    'Real Madrid or bust?',
    'How was this site built?',
  ];
  const offered = new Set();

  /* ---- honesty in the header: the subtitle says when the line is down ---- */
  function setSubtitle(text) {
    if (!subEl || subEl.textContent === text) return;
    if (prefersReduced()) { subEl.textContent = text; return; }
    subEl.classList.add('is-swapping');
    setTimeout(() => {
      subEl.textContent = text;
      subEl.classList.remove('is-swapping');
    }, 300);
  }

  /* ---- transcript persistence (sessionStorage, like the play tallies) ---- */
  function saveHistory() {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(history)); } catch {}
  }

  function askedAlready(text) {
    const t = text.trim().toLowerCase();
    return history.some((m) => m.role === 'user' && m.content.toLowerCase() === t);
  }

  /* ---- the empty-state spark bows out on the first question. It used to
     be REMOVED, which was fine for a page you only saw once; a sheet can
     be closed and reopened, so it hides instead and comes back when the
     transcript is empty. The visibility step also stops a dismissed spark
     taking pointer or focus — an a11y win the .remove() got by accident. ---- */
  function dismissEmpty(instant) {
    if (!emptyEl) return;
    emptyEl.classList.toggle('is-instant', !!instant || prefersReduced());
    emptyEl.classList.add('is-gone');
  }

  function restoreEmpty() {
    if (emptyEl && !history.length) {
      emptyEl.classList.remove('is-gone', 'is-instant');
    }
  }

  /* ---- exchange rendering: two chat bubbles per exchange — the question
     right-aligned, the answer left-aligned, same styling (see .ai-msg) ---- */
  function buildExchange(question) {
    removeFollowups();
    dismissEmpty(false);

    const q = document.createElement('p');
    q.className = 'ai-msg ai-msg-user';
    q.textContent = question;

    const answer = document.createElement('p');
    answer.className = 'ai-msg ai-msg-ai';

    scroll.append(q, answer);
    scrollToBottom();
    return { questionEl: q, answerEl: answer };
  }

  function scrollToBottom() {
    scroll.scrollTop = scroll.scrollHeight;
  }

  function showThinking(el) {
    el.textContent = '';
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('span');
      dot.className = 'think-dot';
      dot.style.setProperty('--td', i);
      el.appendChild(dot);
    }
  }

  /* ---- the reveal: the WHOLE answer is laid out invisibly first, so the
     text never reflows (that reflow was the old shake). The bubble then
     GROWS smoothly on a clipped max-height animation while the words wash
     in on a matching stagger, and the scroll glides along underneath. ---- */
  function revealWords(el, text) {
    return new Promise((resolve) => {
      el.textContent = '';
      const tokens = text.split(/(\s+)/).filter((t) => t.length);
      const words = tokens.filter((t) => !/^\s+$/.test(t)).length;
      // long answers tighten the cadence so the wave never drags
      const cadence = Math.min(30, Math.max(12, 3500 / Math.max(words, 1)));
      const total = (words - 1) * cadence + 520;
      let i = 0;
      const spans = [];
      tokens.forEach((t) => {
        if (/^\s+$/.test(t)) {
          el.appendChild(document.createTextNode(t));
          return;
        }
        const span = document.createElement('span');
        span.className = 'ai-word';
        span.textContent = t;
        span.style.transitionDelay = (i++ * cadence) + 'ms';
        el.appendChild(span);
        spans.push(span);
      });

      // grow from one line to the measured height, clipped — the words are
      // already in place beneath, so nothing shifts as the curtain lifts
      const fullH = el.scrollHeight;
      el.style.overflow = 'hidden';
      // start at ONE bubble's height — read from the stylesheet rather than
      // hardcoded, because the sheet sizes its bubbles smaller than the page did
      const startH = parseFloat(getComputedStyle(el).minHeight) || 63;
      el.style.maxHeight = startH + 'px';
      el.offsetHeight;                       // commit the start height
      el.style.transition = 'max-height ' + total + 'ms linear';
      el.style.maxHeight = (fullH + 60) + 'px';
      requestAnimationFrame(() => spans.forEach((s) => s.classList.add('is-in')));

      // glide the thread along while the bubble grows
      let following = true;
      (function follow() {
        if (!following) return;
        scrollToBottom();
        requestAnimationFrame(follow);
      })();

      setTimeout(() => {
        following = false;
        el.style.overflow = '';
        el.style.maxHeight = '';
        el.style.transition = '';
        el.textContent = text;   // collapse the spans — clean copy/paste
        scrollToBottom();
        resolve();
      }, total + 80);
    });
  }

  /* ---- follow-up chips: three fresh questions ride along under the
     latest answer; each is offered once across the session ---- */
  function removeFollowups() {
    const row = scroll.querySelector('.ai-followups');
    if (row) row.remove();
  }

  function showFollowups() {
    removeFollowups();
    const picks = FOLLOWUPS
      .filter((f) => !offered.has(f) && !askedAlready(f))
      .slice(0, 3);
    if (!picks.length) return;

    const row = document.createElement('div');
    row.className = 'ai-followups';
    picks.forEach((text) => {
      offered.add(text);
      const chip = document.createElement('button');
      chip.className = 'fu-chip';
      chip.type = 'button';
      chip.textContent = text;
      chip.addEventListener('click', () => {
        if (responding) return;
        submitQuestion(text);
      });
      row.appendChild(chip);
    });
    scroll.appendChild(row);
    scrollToBottom();
  }

  /* ---- chips: slide away; the picked one flies into the new exchange ---- */
  function hidePrompts(pillsToSlide, done) {
    if (!prompts || prompts.style.display === 'none') { done(); return; }
    if (prefersReduced() || pillsToSlide.length === 0) {
      prompts.style.display = 'none';
      done();
      return;
    }
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      prompts.style.display = 'none';
      done();
    };
    pillsToSlide[pillsToSlide.length - 1]
      .addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, 450);
    pillsToSlide.forEach((p) => p.classList.add('chip-exit'));
  }

  function handleChipSelect(chip) {
    if (responding) return;
    const text = chip.textContent.trim();
    const others = Array.from(prompts.querySelectorAll('.prompt-chip'))
      .filter((p) => p !== chip);

    if (prefersReduced()) {
      hidePrompts(others.concat(chip), () => submitQuestion(text));
      return;
    }

    // fly the picked chip to where the question lands in the new bubble
    // (rect deltas are visual px; ÷ the stage-fit scale converts them to
    // the layout px the scaled panel expects)
    const fs = window.__stageFitScale || 1;
    const startRect = chip.getBoundingClientRect();
    chip.style.opacity = '0';
    hidePrompts(others, () => {});

    const { questionEl, answerEl } = buildExchange(text);
    questionEl.style.opacity = '0';
    const endRect = questionEl.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();

    const clone = document.createElement('span');
    clone.className = 'prompt-chip chip-clone';
    clone.textContent = text;
    Object.assign(clone.style, {
      position: 'absolute',
      pointerEvents: 'none',
      zIndex: '10',
      left: ((startRect.left - panelRect.left) / fs - 1) + 'px',   /* −1: panel border */
      top: ((startRect.top - panelRect.top) / fs - 1) + 'px',
      transition: 'none',
    });
    panel.appendChild(clone);
    clone.offsetHeight;
    clone.style.transition = 'transform var(--t-lift) var(--ease-lift)';
    clone.style.transform =
      'translate(' + (endRect.left - startRect.left) / fs + 'px, ' +
                     (endRect.top - startRect.top) / fs + 'px)';
    clone.addEventListener('transitionend', () => {
      questionEl.style.opacity = '1';
      clone.remove();
    }, { once: true });

    submitQuestion(text, answerEl);
  }

  /* ---- ask the proxy. A sheet can be closed mid-question, so the request
     is abortable — without it `responding` would stay true and the send
     arrow would still be disabled on reopen. ---- */
  async function fetchReply() {
    if (inflight) inflight.abort();
    inflight = new AbortController();
    const to = setTimeout(() => inflight && inflight.abort(), 20000);
    let res;
    try {
      res = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-20) }),
        signal: inflight.signal,
      });
    } finally {
      clearTimeout(to);
    }
    if (!res.ok) throw new Error('proxy responded ' + res.status);
    const data = await res.json();
    const reply =
      (data && data.content && data.content[0] && data.content[0].text) ||
      data.reply || data.text || '';
    if (!reply) throw new Error('empty reply');
    // The design renders one weight of SF Pro — strip markdown emphasis the
    // model sometimes adds so ** doesn't appear literally.
    return reply.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*\n]+)\*/g, '$1');
  }

  async function submitQuestion(text, prebuiltAnswerEl = null) {
    text = text.trim();
    if (!text || responding) return;
    responding = true;
    if (sendBtn) sendBtn.disabled = true;   // the arrow rests while replying

    const answerEl = prebuiltAnswerEl || buildExchange(text).answerEl;
    history.push({ role: 'user', content: text });
    showThinking(answerEl);

    let full = '';
    try {
      full = await fetchReply();
      offline = false;
      setSubtitle(SUB_LIVE);
    } catch (err) {
      // a request the visitor cancelled by closing the sheet must not print
      // an offline apology into a panel nobody is looking at
      if (err.name === 'AbortError' && !isOpen) {
        responding = false;
        if (sendBtn) sendBtn.disabled = false;
        return;
      }
      full = OFFLINE_ANSWERS[text.toLowerCase()] || OFFLINE_ANSWERS._default;
      offline = true;
      setSubtitle(SUB_OFFLINE);
    }

    if (prefersReduced()) answerEl.textContent = full;
    else await revealWords(answerEl, full);

    history.push({ role: 'assistant', content: full });
    saveHistory();
    showFollowups();
    scrollToBottom();
    // announce the finished answer once, off-screen — the word-by-word
    // reveal above stays visual-only
    if (liveEl) liveEl.textContent = full;
    responding = false;
    if (sendBtn) sendBtn.disabled = false;
    // preventScroll: focus() otherwise scrolls even overflow:hidden ancestors,
    // shoving the whole stage up on short viewports
    if (input) input.focus({ preventScroll: true });
  }

  /* ---- restore a transcript from earlier in the session ---- */
  function restore() {
    let saved = [];
    try { saved = JSON.parse(sessionStorage.getItem(STORE_KEY)) || []; } catch {}
    if (!Array.isArray(saved) || !saved.length) return;
    saved.forEach((m) => {
      if (!m || !m.role || typeof m.content !== 'string') return;
      history.push({ role: m.role, content: m.content });
      const p = document.createElement('p');
      p.className = 'ai-msg is-restored ' +
        (m.role === 'user' ? 'ai-msg-user' : 'ai-msg-ai');
      p.textContent = m.content;
      scroll.appendChild(p);
    });
    if (!history.length) return;
    if (prompts) prompts.style.display = 'none';
    dismissEmpty(true);
    showFollowups();
    scrollToBottom();
  }

  /* ---- wiring ---- */
  if (prompts) {
    prompts.querySelectorAll('.prompt-chip').forEach((chip) => {
      chip.addEventListener('click', () => handleChipSelect(chip));
    });
  }

  if (inputBar) {
    inputBar.addEventListener('submit', (e) => {
      e.preventDefault();
      const value = input.value.trim();
      if (!value) return;
      input.value = '';
      const visible = prompts && prompts.style.display !== 'none';
      if (visible) {
        const all = Array.from(prompts.querySelectorAll('.prompt-chip'));
        hidePrompts(all, () => submitQuestion(value));
      } else {
        submitQuestion(value);
      }
    });
  }

  restore();

  window.AIChat = { open, close, isOpen: () => isOpen };

  // ai.html is still a real page — every OG card, the nav-touch icon map and
  // any external link point at it. Landing there opens the sheet straight
  // away, and ?q=… seeds the first question.
  if (overlay && document.getElementById('shell') &&
      document.getElementById('shell').dataset.page === 'ai') {
    // no rAF here — open() already waits a frame for its own entrance, and
    // gating the OPEN on a frame means a page that never paints never opens
    open(new URLSearchParams(location.search).get('q') || undefined);
  }
})();
