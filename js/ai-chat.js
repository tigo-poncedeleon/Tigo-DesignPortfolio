// AI chat card — standalone page version (ai.html).
//
// Backend contract (key + system prompt live only in the proxy, never here):
//   POST  AI_ENDPOINT (default /api/chat)
//     body: { messages: [{ role: 'user'|'assistant', content: string }, ...] }
//   ->  application/json — Anthropic Messages response; reply at content[0].text
//       (also tolerates streamed text/plain or { reply | text } for flexibility)
// Override the default with window.AI_ENDPOINT if needed. If the request fails
// — e.g. the key is unset — the panel falls back to the canned OFFLINE_ANSWERS.

(() => {
  const AI_ENDPOINT = window.AI_ENDPOINT || '/api/chat';

  const aiScroll   = document.getElementById('aiScroll');
  const aiPrompts  = document.getElementById('aiPrompts');
  const aiInputBar = document.getElementById('aiInputBar');
  const aiInput    = document.getElementById('aiInput');
  const aiCard     = document.querySelector('.ai-card');

  if (!aiScroll) return;

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const prefersReduced = () => motionQuery.matches;

  const history = [];
  let responding = false;

  const OFFLINE_ANSWERS = {
    'your hobbies?':
      "Outside of design I'm into film photography, basketball, and cooking — " +
      "anything that gets me making things with my hands.",
    'what tools do you use?':
      "Figma for design, plus hand-written HTML/CSS/JS for the web. I lean on " +
      "UX research, prototyping, and a bit of AI tooling to move faster.",
    'tell me your background!':
      "I am a Digital Product Designer studying Media Arts & Design and Computer " +
      "Science at the University of Chicago.\n\nI have worked at Vicino AI, " +
      "PantryPal, and Next Level Drone Cleaning.",
    'what is your design philosophy?':
      "Design should feel honest and a little playful. I care about clarity " +
      "first, then the small details that make a product feel alive.",
    _default:
      "Thanks for asking! Once my live assistant is connected I'll answer that " +
      "properly — for now, try one of the suggested prompts.",
  };

  /* ---- pills sliding away ---- */
  function slideAndHidePrompts(pillsToSlide, done) {
    if (!aiPrompts || aiPrompts.style.display === 'none') { done(); return; }
    if (prefersReduced() || pillsToSlide.length === 0) {
      aiPrompts.style.display = 'none';
      done();
      return;
    }
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      aiPrompts.style.display = 'none';
      done();
    };
    const last = pillsToSlide[pillsToSlide.length - 1];
    last.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, 450);
    pillsToSlide.forEach((p) => p.classList.add('pill-exit'));
  }

  function handlePillSelect(pill) {
    const text = pill.textContent.trim();
    const others = Array.from(aiPrompts.querySelectorAll('.prompt-pill')).filter(
      (p) => p !== pill
    );

    if (prefersReduced()) {
      slideAndHidePrompts(others, () => submitQuestion(text));
      return;
    }

    const startRect = pill.getBoundingClientRect();
    const cardRect  = aiCard.getBoundingClientRect();
    pill.style.opacity = '0';

    slideAndHidePrompts(others, () => {});

    const { staticPill, answerEl } = buildResponseShell(text, true);
    const endRect = staticPill.getBoundingClientRect();

    const cardBorderLeft = parseFloat(getComputedStyle(aiCard).borderLeftWidth);
    const cardBorderTop  = parseFloat(getComputedStyle(aiCard).borderTopWidth);

    const clone = document.createElement('span');
    clone.className = 'prompt-pill';
    clone.textContent = text;
    Object.assign(clone.style, {
      position:      'absolute',
      pointerEvents: 'none',
      zIndex:        '10',
      left:          `${startRect.left - cardRect.left - cardBorderLeft}px`,
      top:           `${startRect.top  - cardRect.top  - cardBorderTop}px`,
      transition:    'none',
    });
    aiCard.appendChild(clone);

    clone.offsetHeight;
    clone.style.transition = 'transform 380ms cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    clone.style.transform  = `translate(${endRect.left - startRect.left}px, ${endRect.top - startRect.top}px)`;

    clone.addEventListener('transitionend', () => {
      const xDur = '120ms ease';
      clone.style.transition      = `opacity ${xDur}`;
      clone.style.opacity         = '0';
      staticPill.style.transition = `opacity ${xDur}`;
      staticPill.style.opacity    = '1';
      clone.addEventListener('transitionend', () => clone.remove(), { once: true });
    }, { once: true });

    submitQuestion(text, answerEl);
  }

  function handleManualSubmit(text) {
    text = text.trim();
    if (!text) return;
    const promptsVisible = aiPrompts && aiPrompts.style.display !== 'none';
    if (promptsVisible) {
      const allPills = Array.from(aiPrompts.querySelectorAll('.prompt-pill'));
      slideAndHidePrompts(allPills, () => submitQuestion(text));
    } else {
      submitQuestion(text);
    }
  }

  /* ---- response rendering ---- */
  function buildDivider() {
    const div = document.createElement('div');
    div.className = 'ai-divider';
    return div;
  }

  function scrollToBottom() {
    if (aiScroll) aiScroll.scrollTop = aiScroll.scrollHeight;
  }

  /* ---- loading indicator (animated dots while awaiting the reply) ---- */
  function showThinking(el) {
    el.textContent = '';
    el.classList.add('ai-thinking');
  }
  function clearThinking(el) {
    el.classList.remove('ai-thinking');
  }

  function buildResponseShell(text, hidePill = false) {
    const wrap = document.createElement('div');
    wrap.className = 'ai-response';

    const q = document.createElement('span');
    q.className = 'prompt-pill prompt-pill--static';
    q.textContent = text;
    if (hidePill) q.style.opacity = '0';

    const answer = document.createElement('p');
    answer.className = 'ai-answer';

    wrap.append(q, buildDivider(), answer);
    aiScroll.appendChild(wrap);
    scrollToBottom();
    return { staticPill: q, answerEl: answer };
  }

  function renderResponse(text) {
    return buildResponseShell(text).answerEl;
  }

  function typewriter(el, text) {
    return new Promise((resolve) => {
      el.textContent = '';
      let i = 0;
      (function step() {
        if (i < text.length) {
          el.textContent += text.charAt(i++);
          scrollToBottom();
          setTimeout(step, 16);
        } else {
          resolve();
        }
      })();
    });
  }

  async function streamInto(answerEl, text) {
    // `history` already includes the just-pushed user turn (see submitQuestion),
    // and each entry is { role, content } — exactly the Anthropic messages shape.
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history }),
    });
    if (!res.ok) throw new Error('proxy responded ' + res.status);

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      const reply =
        (data && data.content && data.content[0] && data.content[0].text) ||
        data.reply || data.text || '';
      clearThinking(answerEl);
      if (prefersReduced()) answerEl.textContent = reply;
      else await typewriter(answerEl, reply);
      return reply;
    }

    if (!res.body || !res.body.getReader) {
      const reply = await res.text();
      clearThinking(answerEl);
      answerEl.textContent = reply;
      return reply;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      full += decoder.decode(value, { stream: true });
      clearThinking(answerEl);
      answerEl.textContent = full;
      scrollToBottom();
    }
    full += decoder.decode();
    answerEl.textContent = full;
    return full;
  }

  async function submitQuestion(text, prebuiltAnswerEl = null) {
    text = text.trim();
    if (!text || responding) return;
    responding = true;

    const answerEl = prebuiltAnswerEl ?? renderResponse(text);
    history.push({ role: 'user', content: text });
    showThinking(answerEl);

    let full = '';
    try {
      if (!AI_ENDPOINT) throw new Error('no endpoint configured');
      full = await streamInto(answerEl, text);
    } catch (err) {
      clearThinking(answerEl);
      full = OFFLINE_ANSWERS[text.toLowerCase()] || OFFLINE_ANSWERS._default;
      if (prefersReduced()) answerEl.textContent = full;
      else await typewriter(answerEl, full);
    }

    history.push({ role: 'assistant', content: full });
    scrollToBottom();
    responding = false;
    if (aiInput) aiInput.focus();
  }

  /* ---- wiring ---- */
  if (aiPrompts) {
    aiPrompts.querySelectorAll('.prompt-pill').forEach((pill) => {
      pill.addEventListener('click', () => handlePillSelect(pill));
    });
  }

  if (aiInputBar) {
    aiInputBar.addEventListener('submit', (e) => {
      e.preventDefault();
      const value = aiInput.value;
      aiInput.value = '';
      aiInput.classList.remove('is-scrolled'); // emptied field → no left fade on the placeholder
      handleManualSubmit(value);
    });
  }

  // Rainbow gradient — follows cursor via CSS custom properties on ::before
  if (aiCard) {
    aiCard.addEventListener('mousemove', (e) => {
      const r = aiCard.getBoundingClientRect();
      aiCard.style.setProperty('--rx', `${((e.clientX - r.left) / r.width) * 100}%`);
      aiCard.style.setProperty('--ry', `${((e.clientY - r.top) / r.height) * 100}%`);
      aiCard.style.setProperty('--rhue', `${((e.clientX - r.left) / r.width) * 360}`);
    });
  }

  // Custom fat caret — hides the browser's native caret and draws a wider one.
  // Uses a hidden mirror <span> with the same font to measure text width before
  // the cursor, then positions an absolutely-placed div on top of it.
  (function initFakeCaret() {
    if (!aiInput || !aiInputBar) return;

    const mirror = document.createElement('span');
    Object.assign(mirror.style, {
      position: 'fixed', top: '-9999px', left: '-9999px',
      visibility: 'hidden', whiteSpace: 'pre', pointerEvents: 'none',
    });
    document.body.appendChild(mirror);

    const fakeCaret = document.createElement('div');
    fakeCaret.className = 'fake-caret';
    aiInputBar.appendChild(fakeCaret);

    let fontSynced = false;
    function update() {
      if (!fontSynced) {
        const cs = getComputedStyle(aiInput);
        mirror.style.font = cs.font;
        mirror.style.letterSpacing = cs.letterSpacing;
        fontSynced = true;
      }
      mirror.textContent = aiInput.value.substring(0, aiInput.selectionStart ?? 0);

      // Use layout offsets (transform-independent), not getBoundingClientRect —
      // the card is scaled via transform on small laptops, which would otherwise
      // shrink the rect-based distances and misplace the caret. offsetLeft/Top are
      // measured against the shared offsetParent (.ai-inputbar) in unscaled local px.
      const pl    = parseFloat(getComputedStyle(aiInput).paddingLeft);
      const tw    = mirror.getBoundingClientRect().width;
      const sl    = aiInput.scrollLeft || 0;

      fakeCaret.style.left      = `${aiInput.offsetLeft + pl + tw - sl}px`;
      fakeCaret.style.top       = `${aiInput.offsetTop + aiInput.offsetHeight / 2}px`;
      fakeCaret.style.transform = 'translateY(-50%)';

      // Fade the left edge only while text is scrolled off — keeps the
      // placeholder and short text crisp.
      aiInput.classList.toggle('is-scrolled', sl > 0);
    }

    const raf = () => requestAnimationFrame(update);
    ['input', 'keydown', 'keyup', 'click', 'mouseup', 'select', 'scroll'].forEach(ev =>
      aiInput.addEventListener(ev, raf)
    );
    aiInput.addEventListener('focus', () => { fakeCaret.classList.add('active'); raf(); });
    aiInput.addEventListener('blur',  () => fakeCaret.classList.remove('active'));
  })();
})();
