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

  const panel    = document.getElementById('ai-panel');
  const scroll   = document.getElementById('ai-scroll');
  const prompts  = document.getElementById('ai-prompts');
  const inputBar = document.getElementById('ai-inputbar');
  const input    = document.getElementById('ai-input');
  const subEl    = document.getElementById('ai-sub');
  const liveEl   = document.getElementById('ai-live');
  const sendBtn  = inputBar ? inputBar.querySelector('.ai-send') : null;
  const hero     = document.getElementById('home');
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
     Idle, and asking.

     There is nothing to open. The chat is the home screen, so the only
     state it has is whether a conversation has started — and that is a
     class on #home, not on this stage, because #home is the parent of
     both the name pair and the composer. One class, one style
     recalculation, and the name's exit and the composer's travel are
     frame-locked to each other. (The sheet that used to live here had
     to sequence a pose measurement, an entrance and a content fade, and
     the sequencing is exactly what read as three events instead of one.)
     ============================================================ */
  let inflight = null;
  let asking = false;

  function activate(instant) {
    if (asking || !hero) return;
    asking = true;
    // `instant` is the restored transcript: the conversation did not just
    // happen, it is simply still there, so it must not replay. Two frames,
    // because one is not enough to guarantee the class landed before the
    // transition is handed back.
    if (instant) hero.classList.add('is-instant');
    hero.classList.add('is-asking');
    if (instant) {
      // two frames, then a timer that does the same thing. rAF does not
      // run in a background tab, and a page opened in one would otherwise
      // wear `is-instant` — a class whose whole job is to suppress
      // transitions — for the rest of the session.
      const unmute = () => hero.classList.remove('is-instant');
      requestAnimationFrame(() => requestAnimationFrame(unmute));
      setTimeout(unmute, 200);
    }
  }

  // the tab bar on a phone stands on the composer the moment the keyboard
  // is up. A class of its own, deliberately: `ai-open` used to mean "a
  // modal is over the page" and is read by five other files as a keyboard
  // guard — this means only "the caret is in the field".
  if (input) {
    input.addEventListener('focus', () =>
      document.documentElement.classList.add('ai-typing'));
    input.addEventListener('blur', () =>
      document.documentElement.classList.remove('ai-typing'));
  }

  // the sheet's geometry was written down between visits; there is no
  // sheet to remember the shape of now
  try { sessionStorage.removeItem('ai.box'); } catch {}

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
        if (input) input.focus({ preventScroll: true });
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

  /* (GONE: dismissEmpty / restoreEmpty — the empty-state spark's exit and
     its way back. The hero has no spark: the name pair IS the empty state,
     and two of those on one screen is an echo, not emphasis.) */

  /* ---- exchange rendering: two chat bubbles per exchange — the question
     right-aligned, the answer left-aligned, same styling (see .ai-msg) ---- */
  function buildExchange(question, photoUrl) {
    // the single funnel — both a typed question and a tapped chip arrive
    // here — so this is the one place the hero has to change state
    activate(false);
    removeFollowups();

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

      // glide the thread along while the bubble grows — but only while the
      // reader is still AT the bottom. This used to pin scrollTop every
      // frame unconditionally, which meant scrolling up to re-read a long
      // answer mid-reveal yanked you straight back down. Tolerable in a
      // 620px sheet nobody read twice; not on the landing page.
      let following = true;
      (function follow() {
        if (!following) return;
        const slack = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight;
        if (slack < 40) scrollToBottom();
        requestAnimationFrame(follow);
      })();

      setTimeout(() => {
        following = false;
        el.style.overflow = '';
        el.style.maxHeight = '';
        el.style.transition = '';
        el.textContent = text;   // collapse the spans — clean copy/paste
        if (scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 40) {
          scrollToBottom();
        }
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
    // panel expects, answering for the box THIS node lives in. That answer
    // USED to be 1 — the sheet floated outside the scaled card — and it is
    // not any more: the panel is inside .shell-card > main, which `zoom`
    // scales, so the division is doing real work on every screen that is
    // not exactly 1280 wide. The call site is unchanged; only the reason is.
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
      /* no −1 here: the sheet had a 1px border to discount and the panel
         has none, so the correction would now BE the error */
      left: px(startRect.left - panelRect.left) + 'px',
      top: px(startRect.top - panelRect.top) + 'px',
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
      // NO AbortError branch. It used to swallow the abort that closing the
      // sheet fired, into a panel nobody was looking at — and there is no
      // closing any more, so the only abort left is fetchReply's own 20s
      // timeout, which is precisely the case the canned answers exist for.
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
    // instant: the conversation is still there from earlier in the session,
    // it is not happening now, so the hero must not replay its travel
    activate(true);
    if (prompts) prompts.style.display = 'none';
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

  window.AIChat = { ask: submitQuestion };

  // ai.html survives as a redirect for every OG card and external link that
  // already exists in the world. It lands here now rather than opening a
  // sheet: ?q= asks the question outright, a bare ?ask= just takes the caret
  // to the field and lets the visitor write their own.
  const P = new URLSearchParams(location.search);
  if (P.has('q')) {
    if (prompts) prompts.style.display = 'none';   // the question is already asked
    submitQuestion(P.get('q'));
  } else if (P.has('ask') && input) {
    input.focus({ preventScroll: true });
  }
})();
