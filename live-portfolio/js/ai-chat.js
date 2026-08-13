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
  // the composer's tools (absent on an older page that predates them)
  const personaBtn   = document.getElementById('ai-persona');
  const personaMenu  = document.getElementById('ai-persona-menu');
  const personaLabel = document.getElementById('ai-persona-label');
  const micBtn    = document.getElementById('ai-mic');
  const addBtn    = document.getElementById('ai-add');
  const fileInput = document.getElementById('ai-file');
  const attachRow = document.getElementById('ai-attach-row');
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
    requestAnimationFrame(() => stage.classList.add('revealed'));
    document.addEventListener('keydown', onKey, true);
    if (input) input.focus({ preventScroll: true });
    if (seed) submitQuestion(seed);
  }

  function close() {
    if (!overlay || !isOpen) return;
    isOpen = false;
    if (inflight) inflight.abort();
    stopListening();
    closePersonaMenu();
    stage.classList.remove('revealed');
    document.removeEventListener('keydown', onKey, true);
    if (card) card.removeAttribute('inert');
    document.documentElement.classList.remove('ai-open');
    setTimeout(() => { if (!isOpen) overlay.hidden = true; }, 500);  // --t-stage
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  // capture phase, so Escape closes the sheet before any game sees it —
  // and the mood menu before the sheet, innermost thing first
  function onKey(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (personaMenu && !personaMenu.hidden) { closePersonaMenu(true); return; }
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    // the trap must not hand focus to what cannot take it: the closed mood
    // menu's rows, the hidden mic, the file input behind the + button
    const f = Array.prototype.filter.call(stage.querySelectorAll(
      'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'),
      (el) => !el.hidden && el.type !== 'file' && el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }


  /* ============================================================
     Drag and resize.

     Position and size live in inline left/top/width/height once the
     visitor has touched them, which means CSS owns the defaults until
     they do — nothing is written down until there is a preference to
     write. Both are clamped into the viewport on every move AND on
     resize, so a sheet dragged to the corner of a wide window cannot
     strand itself off-screen when the window narrows.

     The sheet takes a drag from the header (move) or from any of its
     eight edges and corners (resize). Below 700px none of it applies:
     the sheet is full-bleed there, and an inline box would outrank the
     media query and strand a phone at desktop geometry.
     ============================================================ */
  const GEO_KEY = 'ai.box';
  const MINW = 340, MINH = 320;
  const GAP = 8;                        // the sheet never touches the edge
  const isPhone = () => matchMedia('(max-width: 700px)').matches;

  const clampBox = (b) => {
    const w = Math.max(MINW, Math.min(b.w, window.innerWidth - 2 * GAP));
    const h = Math.max(MINH, Math.min(b.h, window.innerHeight - 2 * GAP));
    return {
      w: w, h: h,
      x: Math.max(GAP, Math.min(b.x, window.innerWidth - w - GAP)),
      y: Math.max(GAP, Math.min(b.y, window.innerHeight - h - GAP)),
    };
  };

  const clearBox = () => {
    ['left', 'top', 'right', 'bottom', 'width', 'height']
      .forEach((k) => stage.style.removeProperty(k));
  };

  const applyBox = (b) => {
    const c = clampBox(b);
    stage.style.left = c.x + 'px';
    stage.style.top = c.y + 'px';
    stage.style.right = 'auto';
    stage.style.bottom = 'auto';
    stage.style.width = c.w + 'px';
    stage.style.height = c.h + 'px';
    try { sessionStorage.setItem(GEO_KEY, JSON.stringify(c)); } catch (err) { /* private mode */ }
    return c;
  };

  const savedBox = () => {
    try {
      const b = JSON.parse(sessionStorage.getItem(GEO_KEY) || 'null');
      return (b && b.w && b.h) ? b : null;
    } catch (err) { return null; }
  };

  // the sheet's current box, read from layout the first time it is moved
  const liveBox = () => {
    const r = stage.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  };

  // A resize drag grows the sheet from the edge you grabbed: pulling the
  // north or west side moves that side and pins the opposite one, so the
  // sheet never creeps across the screen while you size it. Each of those
  // two is clamped BEFORE the anchor is worked out — at the minimum the
  // dragged edge simply stops, rather than pushing the far edge along.
  const resize = (dir, box, dx, dy) => {
    let x = box.x, y = box.y, w = box.w, h = box.h;
    // east/south stop at the window edge rather than growing past it and
    // letting clampBox slide the whole sheet left to compensate
    if (dir.indexOf('e') > -1) w = Math.min(box.w + dx, window.innerWidth - box.x - GAP);
    if (dir.indexOf('s') > -1) h = Math.min(box.h + dy, window.innerHeight - box.y - GAP);
    if (dir.indexOf('w') > -1) {
      w = Math.max(MINW, Math.min(box.w - dx, box.x + box.w - GAP));
      x = box.x + box.w - w;                    // the right edge stays put
    }
    if (dir.indexOf('n') > -1) {
      h = Math.max(MINH, Math.min(box.h - dy, box.y + box.h - GAP));
      y = box.y + box.h - h;                    // the bottom edge stays put
    }
    return { x: x, y: y, w: w, h: h };
  };

  const wireDrag = () => {
    const head = stage.querySelector('.ai-sheet-head');

    // eight invisible strips straddling the border, plus the header. The
    // sheet draws no corner mark — the resize cursor is the whole tell.
    const handles = ['n', 's', 'e', 'w', 'ne', 'nw', 'sw', 'se'].map((d) => {
      const el = document.createElement('div');
      el.className = 'ai-resize';
      el.dataset.dir = d;
      stage.appendChild(el);
      return el;
    });

    let mode = null, id = null, start = null, box = null, grabbed = null;

    const begin = (el, m) => (e) => {
      if (isPhone()) return;                    // full-bleed: nothing to drag
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (e.target.closest('.ai-x')) return;    // the close button is not a handle
      mode = m; id = e.pointerId; grabbed = el;
      box = liveBox();
      start = { x: e.clientX, y: e.clientY };
      try { el.setPointerCapture(id); } catch (err) { /* no live pointer */ }
      document.documentElement.classList.add('ai-dragging');
      // hold the handle's own cursor for the whole drag, wherever the
      // pointer wanders
      document.documentElement.style.cursor = getComputedStyle(el).cursor;
      e.preventDefault();
    };
    const move = (e) => {
      if (mode === null || e.pointerId !== id) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (mode === 'move') applyBox({ x: box.x + dx, y: box.y + dy, w: box.w, h: box.h });
      else applyBox(resize(mode, box, dx, dy));
    };
    const end = () => {
      if (mode === null) return;
      try { grabbed.releasePointerCapture(id); } catch (err) { /* gone */ }
      mode = null; id = null; grabbed = null;
      document.documentElement.classList.remove('ai-dragging');
      document.documentElement.style.removeProperty('cursor');
    };

    head.addEventListener('pointerdown', begin(head, 'move'));
    handles.forEach((el) => el.addEventListener('pointerdown', begin(el, el.dataset.dir)));
    [head].concat(handles).forEach((el) => {
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    });
    // double-click the header to put the sheet back where it started
    head.addEventListener('dblclick', () => {
      clearBox();
      try { sessionStorage.removeItem(GEO_KEY); } catch (err) { /* fine */ }
    });
    // a window that narrows must not strand the sheet outside it — and once
    // it is phone-width the inline box has to go entirely, or it would
    // outrank the full-bleed media query
    window.addEventListener('resize', () => {
      if (!stage.style.width) return;
      if (isPhone()) clearBox(); else applyBox(liveBox());
    });
  };

  if (overlay) {
    const scrim = document.getElementById('ai-scrim');
    if (scrim) scrim.addEventListener('click', close);
    const x = overlay.querySelector('.ai-x');
    if (x) x.addEventListener('click', close);
    wireDrag();
    const b = savedBox();
    if (b && !isPhone()) applyBox(b);          // where the visitor last left it
  } else {
    // no shell (or an older page): behave exactly as before
    requestAnimationFrame(() => stage && stage.classList.add('revealed'));
  }

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const prefersReduced = () => motionQuery.matches;

  const history = [];
  let responding = false;
  let offline = false;

  /* ============================================================
     The mood toggle — how the assistant answers. Friendly is the
     house voice; whimsical and suspicious are a reward for whoever
     opens the toggle. The client only ever sends one of these three
     words — what each one means lives in the proxy (api/chat.js),
     next to the system prompt it flavours.
     ============================================================ */
  const PERSONAS = ['friendly', 'whimsical', 'suspicious'];
  const PERSONA_KEY = 'ai.persona';
  let persona = 'friendly';
  try {
    const savedP = sessionStorage.getItem(PERSONA_KEY);
    if (PERSONAS.indexOf(savedP) > -1) persona = savedP;
  } catch (err) { /* private mode */ }

  function paintPersona() {
    if (personaLabel) personaLabel.textContent = persona;
    if (personaMenu) {
      personaMenu.querySelectorAll('.persona-row').forEach((row) => {
        row.classList.toggle('is-active', row.dataset.persona === persona);
      });
    }
  }

  function closePersonaMenu(refocus) {
    if (!personaMenu || personaMenu.hidden) return;
    personaMenu.hidden = true;
    document.removeEventListener('pointerdown', onOutsidePersona, true);
    if (personaBtn) {
      personaBtn.setAttribute('aria-expanded', 'false');
      if (refocus) personaBtn.focus({ preventScroll: true });
    }
  }

  function onOutsidePersona(e) {
    if (e.target.closest('#ai-persona-menu, #ai-persona')) return;
    closePersonaMenu();
  }

  if (personaBtn && personaMenu) {
    paintPersona();
    personaBtn.addEventListener('click', () => {
      if (!personaMenu.hidden) { closePersonaMenu(); return; }
      paintPersona();
      personaMenu.hidden = false;
      personaBtn.setAttribute('aria-expanded', 'true');
      document.addEventListener('pointerdown', onOutsidePersona, true);
    });
    personaMenu.addEventListener('click', (e) => {
      const row = e.target.closest('.persona-row');
      if (!row) return;
      persona = row.dataset.persona;
      try { sessionStorage.setItem(PERSONA_KEY, persona); } catch (err) { /* fine */ }
      paintPersona();
      closePersonaMenu();
      if (input) input.focus({ preventScroll: true });
    });
  }

  /* ============================================================
     Dictation — the browser's own SpeechRecognition where it exists
     (Chrome, Safari). Where it doesn't, the mic button never appears;
     typing is the other way in. The transcript lands in the input
     rather than sending itself: you see what it heard, then decide.
     ============================================================ */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const PLACEHOLDER = 'ask me anything!';
  let rec = null;
  let listening = false;

  function stopListening() {
    const r = rec;
    rec = null;                        // before stop(): its onend re-enters here
    listening = false;
    if (r) { try { r.stop(); } catch (err) { /* already stopped */ } }
    if (micBtn) {
      micBtn.classList.remove('is-listening');
      micBtn.setAttribute('aria-pressed', 'false');
    }
    if (input) input.placeholder = PLACEHOLDER;
  }

  if (SR && micBtn) {
    micBtn.hidden = false;
    micBtn.addEventListener('click', () => {
      if (listening) { stopListening(); return; }
      listening = true;
      micBtn.classList.add('is-listening');
      micBtn.setAttribute('aria-pressed', 'true');
      if (input) input.placeholder = 'listening…';
      const base = input ? input.value.trim() : '';
      rec = new SR();
      rec.lang = document.documentElement.lang || 'en-US';
      rec.interimResults = true;
      rec.onresult = (e) => {
        let heard = '';
        for (let i = 0; i < e.results.length; i++) heard += e.results[i][0].transcript;
        if (input) input.value = base ? base + ' ' + heard.trimStart() : heard.trimStart();
        paintSend();                   // programmatic set fires no input event
      };
      rec.onerror = () => stopListening();
      rec.onend = () => {
        stopListening();
        if (isOpen && input) input.focus({ preventScroll: true });
      };
      try { rec.start(); } catch (err) { stopListening(); }
    });
  }

  /* ============================================================
     A photo for context. Downscaled on a canvas before it goes
     anywhere — the proxy forwards messages verbatim, so the image
     rides as a standard Anthropic image block, and a 12-megapixel
     phone photo has no business crossing the wire at full size.
     ============================================================ */
  let pendingPhoto = null;             // { url, mediaType, data }

  // the send circle answers the bar's state: it only wears the accent when
  // there is actually something to send (css .ai-inputbar.is-ready)
  function paintSend() {
    if (!inputBar) return;
    const ready = !!pendingPhoto || (input && input.value.trim().length > 0);
    inputBar.classList.toggle('is-ready', ready);
  }

  function clearPhoto() {
    pendingPhoto = null;
    if (attachRow) { attachRow.innerHTML = ''; attachRow.hidden = true; }
    if (fileInput) fileInput.value = '';
    paintSend();
  }

  function showPhotoChip() {
    if (!attachRow || !pendingPhoto) return;
    attachRow.innerHTML = '';
    const chip = document.createElement('span');
    chip.className = 'attach-thumb';
    const img = document.createElement('img');
    img.src = pendingPhoto.url;
    img.alt = 'photo waiting to send';
    const x = document.createElement('button');
    x.className = 'attach-x';
    x.type = 'button';
    x.setAttribute('aria-label', 'Remove photo');
    x.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" ' +
      'stroke="currentColor" stroke-width="3" stroke-linecap="round">' +
      '<path d="M5 5 L19 19" /><path d="M19 5 L5 19" /></svg>';
    x.addEventListener('click', clearPhoto);
    chip.append(img, x);
    attachRow.appendChild(chip);
    attachRow.hidden = false;
  }

  function acceptPhoto(file) {
    if (!file || file.type.indexOf('image/') !== 0) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // longest side capped at 1200px — plenty to look at, kind to the wire
        const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const url = canvas.toDataURL('image/jpeg', 0.85);
        pendingPhoto = {
          url: url,
          mediaType: 'image/jpeg',
          data: url.slice(url.indexOf(',') + 1),
        };
        showPhotoChip();
        paintSend();
        if (input) input.focus({ preventScroll: true });
      };
      img.src = reader.result;         // a format the browser can't decode
    };                                 // simply never fires onload — no photo
    reader.readAsDataURL(file);
  }

  if (addBtn && fileInput) {
    addBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => acceptPhoto(fileInput.files[0]));
  }

  /* a message's readable text, whether it is a plain string or blocks */
  const msgText = (m) =>
    typeof m.content === 'string'
      ? m.content
      : m.content.filter((b) => b.type === 'text').map((b) => b.text).join(' ');

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

  /* ---- transcript persistence (sessionStorage, like the play tallies).
     Photos are NOT persisted — base64 would blow the quota for nothing —
     so a photo message flattens to its words plus an honest note. ---- */
  function saveHistory() {
    const flat = history.map((m) => {
      if (typeof m.content === 'string') return m;
      const t = msgText(m);
      return { role: m.role, content: t ? t + '\n(sent a photo)' : '(sent a photo)' };
    });
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(flat)); } catch {}
  }

  function askedAlready(text) {
    const t = text.trim().toLowerCase();
    return history.some((m) => m.role === 'user' && msgText(m).toLowerCase() === t);
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
  function buildExchange(question, photoUrl) {
    removeFollowups();
    dismissEmpty(false);

    const q = document.createElement('p');
    q.className = 'ai-msg ai-msg-user';
    if (photoUrl) {
      const img = document.createElement('img');
      img.className = 'ai-msg-photo';
      img.src = photoUrl;
      img.alt = 'photo sent for context';
      q.appendChild(img);
      if (question) {
        const t = document.createElement('span');
        t.className = 'ai-msg-text';
        t.textContent = question;
        q.appendChild(t);
      }
    } else {
      q.textContent = question;
    }

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
    // a pending photo makes this a photo message — skip the fly (the clone
    // has no photo in it, so the trick would land on a bubble it doesn't match)
    if (pendingPhoto) {
      const all = Array.from(prompts.querySelectorAll('.prompt-chip'));
      hidePrompts(all, () => submitQuestion(text));
      return;
    }
    const others = Array.from(prompts.querySelectorAll('.prompt-chip'))
      .filter((p) => p !== chip);

    if (prefersReduced()) {
      hidePrompts(others.concat(chip), () => submitQuestion(text));
      return;
    }

    // fly the picked chip to where the question lands in the new bubble.
    // Rect deltas are visual px; ShellFit converts them to the layout px the
    // panel expects, answering for the box THIS node lives in. The sheet sits
    // outside the scaled card, so the answer is 1 and the division vanishes —
    // which is exactly right, and neither this file nor nextlevel.js has to
    // know that about itself.
    const F = window.ShellFit || { toLayout: (p) => p };
    const px = (v) => F.toLayout(v, panel);
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
      left: (px(startRect.left - panelRect.left) - 1) + 'px',   /* −1: panel border */
      top: (px(startRect.top - panelRect.top) - 1) + 'px',
      transition: 'none',
    });
    panel.appendChild(clone);
    clone.offsetHeight;
    clone.style.transition = 'transform var(--t-lift) var(--ease-lift)';
    clone.style.transform =
      'translate(' + px(endRect.left - startRect.left) + 'px, ' +
                     px(endRect.top - startRect.top) + 'px)';
    clone.addEventListener('transitionend', () => {
      questionEl.style.opacity = '1';
      clone.remove();
    }, { once: true });

    submitQuestion(text, answerEl);
  }

  /* ---- ask the proxy. A sheet can be closed mid-question, so the request
     is abortable — without it `responding` would stay true and the send
     arrow would still be disabled on reopen. ---- */
  // the last 20 turns ride along, but images only in the newest few — a
  // photo asked about three questions ago has been answered, and base64
  // is far too heavy to re-send with every message after it
  function apiMessages() {
    const recent = history.slice(-20);
    const keepFrom = recent.length - 4;
    return recent.map((m, i) => {
      if (typeof m.content === 'string' || i >= keepFrom) return m;
      return { role: m.role, content: msgText(m) || '(sent a photo)' };
    });
  }

  async function fetchReply() {
    if (inflight) inflight.abort();
    inflight = new AbortController();
    const to = setTimeout(() => inflight && inflight.abort(), 20000);
    let res;
    try {
      res = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages(), persona: persona }),
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
    const photo = pendingPhoto;             // consumed by THIS send
    if ((!text && !photo) || responding) return;
    responding = true;
    if (sendBtn) sendBtn.disabled = true;   // the arrow rests while replying
    stopListening();
    closePersonaMenu();

    const answerEl = prebuiltAnswerEl ||
      buildExchange(text, photo && photo.url).answerEl;
    if (photo) {
      // the Anthropic image block, passed through the proxy verbatim
      const blocks = [{
        type: 'image',
        source: { type: 'base64', media_type: photo.mediaType, data: photo.data },
      }];
      if (text) blocks.push({ type: 'text', text: text });
      history.push({ role: 'user', content: blocks });
      clearPhoto();
    } else {
      history.push({ role: 'user', content: text });
    }
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

  if (input) input.addEventListener('input', paintSend);
  paintSend();

  if (inputBar) {
    inputBar.addEventListener('submit', (e) => {
      e.preventDefault();
      const value = input.value.trim();
      if (!value && !pendingPhoto) return;  // a photo alone is a fine question
      input.value = '';
      paintSend();
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

  // The AI has no page of its own any more — it is an overlay over whatever
  // you are reading. ai.html survives as a redirect that arrives with ?ask=1,
  // so every OG card and external link still opens the sheet on landing, and
  // ?q=… still seeds the first question.
  if (overlay && new URLSearchParams(location.search).has('ask')) {
    // no rAF here — open() already waits a frame for its own entrance, and
    // gating the OPEN on a frame means a page that never paints never opens
    open(new URLSearchParams(location.search).get('q') || undefined);
  }
})();
