// Vicino AI case study — the STORY chapters' own interactions: the
// two-paths mini-board (04), the one-node anatomy tour (05), and the
// screenshot annotations (02). Page mechanics live in js/vicino.js; the
// working miniature lives in js/vicino-canvas.js.
(() => {
  const reduceMotion =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- 04 · paths: one mini-board, two looping stories. The DOM is
  // fixed; all choreography is [data-mode] + [data-step] in vicino.css.
  // This code advances the counter, types the brief, parks the loop
  // when the chapter scrolls away — and, until the reader touches a
  // tab or a step, flips the mode itself at the end of every lap so
  // both stories get seen without a click. ----
  const stage = document.getElementById('paths-stage');
  if (stage) {
    const typed = stage.querySelector('.ps-typed');
    const stepsBox = document.querySelector('.ps-steps');
    const tabsWrap = document.querySelector('.paths-tabs');
    const tabs = Array.from(document.querySelectorAll('.path-tab'));
    const BRIEF = 'a launch post for the new colorway';
    // per-step dwell (ms): the step just ENTERED holds this long. Hand
    // runs one step longer — its final stop is the finished render.
    // Generating steps hold ≥2.3s so the percent count-up (2.15s CSS)
    // lands; done steps hold ~3s, one full breathe of the clip.
    const PLAN = {
      agent: [1700, 2200, 2300, 2600, 3000],
      hand: [1400, 1400, 1600, 1600, 2600, 3000],
    };
    // what each stop is called at the scrubber — the story in six words.
    // No run button anywhere: a wired graph simply starts generating.
    const LABELS = {
      agent: ['the brief', 'the plan', 'the graph', 'generating', 'delivered'],
      hand: ['drop Text', 'drop Image', 'pull the wire', 'drop Video', 'generating', 'delivered'],
    };
    const last = () => PLAN[mode].length;
    const other = () => (mode === 'agent' ? 'hand' : 'agent');
    let mode = 'agent';
    let step = 0;
    let timer = 0;
    let typeTimer = 0;
    let running = false;
    let handsOff = true;   // the loop drives the toggle until the reader does
    let dots = [];

    const paintDots = (dwellMs) => {
      dots.forEach((d, i) => {
        const on = i + 1 === step;
        d.classList.toggle('is-on', on);
        // the active chip's underline fills over the real dwell
        if (on && dwellMs) d.style.setProperty('--dw', Math.round(dwellMs) + 'ms');
      });
    };
    const setStep = (n, dwellMs) => {
      step = n;
      stage.dataset.step = String(n);
      if (typed) {
        if (n === 0) typed.textContent = '';
        else if (mode === 'agent' && n === 1) typeBrief();
        else if (mode === 'agent' && n > 1 && typed.textContent.length < BRIEF.length) {
          // a jump landed past the typing — the brief is simply there
          clearInterval(typeTimer);
          typed.textContent = BRIEF;
        }
      }
      paintDots(dwellMs);
    };
    const typeBrief = () => {
      clearInterval(typeTimer);
      if (!typed) return;
      typed.textContent = '';
      let i = 0;
      typeTimer = setInterval(() => {
        i += 1;
        typed.textContent = BRIEF.slice(0, i);
        if (i >= BRIEF.length) clearInterval(typeTimer);
      }, 40);
    };
    const finalPose = () => {
      setStep(last());
      if (typed) typed.textContent = mode === 'agent' ? BRIEF : '';
    };
    const tick = () => {
      if (step < last()) {
        const ms = PLAN[mode][step];   // dwell of the step being entered
        setStep(step + 1, ms);
        timer = setTimeout(tick, ms);
      } else if (handsOff && !reduceMotion) {
        // lap done — the loop reaches over and flips the toggle itself
        applyMode(other());
      } else {
        setStep(0);
        timer = setTimeout(tick, 900);
      }
    };
    const start = () => {
      if (running) return;
      running = true;
      setStep(0);
      timer = setTimeout(tick, 500);
    };
    const stop = () => {
      running = false;
      clearTimeout(timer);
      clearInterval(typeTimer);
    };
    // one mode, everywhere at once: stage state, thumb, tabs, captions,
    // and a fresh set of labelled stops for that mode's plan
    const applyMode = (next) => {
      mode = next;
      stage.dataset.mode = mode;
      tabs.forEach((t) => {
        const on = t.dataset.mode === mode;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      if (tabsWrap) tabsWrap.classList.toggle('is-hand', mode === 'hand');
      stop();
      buildDots();
      if (reduceMotion) finalPose();
      else start();
    };
    // one labelled stop per step — clicking scrubs the story there and
    // the loop walks on from that point (a longer dwell to look around)
    const buildDots = () => {
      if (!stepsBox) return;
      stepsBox.textContent = '';
      dots = PLAN[mode].map((_, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ps-step';
        const coin = document.createElement('i');
        coin.textContent = String(i + 1);
        const label = document.createElement('span');
        label.textContent = LABELS[mode][i];
        b.append(coin, label);
        b.setAttribute('aria-label', 'Jump to step ' + (i + 1) + ' — ' + LABELS[mode][i]);
        b.addEventListener('click', () => {
          handsOff = false;              // the reader is driving now
          clearTimeout(timer);
          clearInterval(typeTimer);
          running = true;
          const ms = PLAN[mode][i] * 1.6;
          setStep(i + 1, ms);            // step 1 re-types the brief — the
                                         // typing IS what step 1 shows
          if (!reduceMotion) {
            timer = setTimeout(tick, ms);
          }
        });
        stepsBox.appendChild(b);
        return b;
      });
      paintDots();
    };

    tabs.forEach((tab) => tab.addEventListener('click', () => {
      handsOff = false;                  // their toggle now, not the loop's
      applyMode(tab.dataset.mode);
    }));

    buildDots();
    if (reduceMotion || !('IntersectionObserver' in window)) {
      // the story is simply, quietly, already told
      finalPose();
    } else {
      // the loop runs only while its chapter is on stage
      const io = new IntersectionObserver((entries) => entries.forEach((en) => {
        if (en.isIntersecting) start();
        else stop();
      }), { threshold: 0.15 });
      io.observe(stage.closest('.case-slide'));
    }
  }

  // ---- 05 · anatomy: ONE node on the plinth. The plaque reads the
  // card part by part; CSS crossfades the pages (.is-on), spotlights
  // the node ([data-active] dims everything else), and the hot part
  // performs its own micro-demo. Resting the pointer on a part turns
  // the plaque to it and HOLDS the tour; so does hovering the plaque
  // itself (nobody's reading gets advanced out from under them). ----
  const ana = document.querySelector('.ana-stage');
  if (ana) {
    const node = ana.querySelector('.ana-node');
    const plaque = ana.querySelector('.ana-plaque');
    const box = ana.querySelector('.ana-plq-items');
    const items = Array.from(ana.querySelectorAll('.ana-plq-item'));
    const dots = Array.from(ana.querySelectorAll('.ana-step'));
    const PARTS = items.map((el) => el.dataset.part);
    const DWELL = 5200;             // reading time for two short sentences
    let idx = 0;
    let timer = 0;
    let hoverTimer = 0;
    let held = false;

    // the plaque is only as tall as the page it holds, so the pager
    // never floats away from a short one (CSS transitions the height)
    const measure = () => {
      const h = items[idx].offsetHeight;
      if (h) box.style.setProperty('--plq-h', h + 'px');
    };
    const show = (n) => {
      idx = (n + PARTS.length) % PARTS.length;
      const part = PARTS[idx];
      ana.dataset.active = part;
      ana.classList.add('is-touring');
      items.forEach((el, i) => el.classList.toggle('is-on', i === idx));
      dots.forEach((d, i) => {
        d.classList.toggle('is-on', i === idx);
        if (i === idx) d.setAttribute('aria-current', 'true');
        else d.removeAttribute('aria-current');
      });
      node.querySelectorAll('.is-hot').forEach((el) => el.classList.remove('is-hot'));
      node.querySelectorAll('[data-part="' + part + '"]')
        .forEach((el) => el.classList.add('is-hot'));
      measure();
    };
    const schedule = (ms) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!held) show(idx + 1);
        schedule(DWELL);
      }, ms);
    };
    const stop = () => clearTimeout(timer);

    // the dots page the reading; a jump earns a longer look around
    dots.forEach((d, i) => d.addEventListener('click', () => {
      show(i);
      if (!reduceMotion) schedule(DWELL * 1.6);
    }));

    // resting the pointer on a part (150ms — a rest, not a pass-through)
    // turns the plaque there
    node.querySelectorAll('[data-part]').forEach((el) => {
      el.addEventListener('pointerenter', () => {
        held = true;
        clearTimeout(hoverTimer);
        const i = PARTS.indexOf(el.dataset.part);
        if (i > -1 && i !== idx) hoverTimer = setTimeout(() => show(i), 150);
      });
      el.addEventListener('pointerleave', () => {
        held = false;
        clearTimeout(hoverTimer);
      });
    });
    plaque.addEventListener('pointerenter', () => { held = true; });
    plaque.addEventListener('pointerleave', () => { held = false; });

    // the measured height only holds while the type does: webfonts
    // land late, and the column rewraps at every width
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    window.addEventListener('resize', measure);

    if (reduceMotion || !('IntersectionObserver' in window)) {
      show(0);          // the plate is simply set; the dots still page it
    } else {
      // the tour reads only while its chapter is on stage
      const io = new IntersectionObserver((entries) => entries.forEach((en) => {
        if (en.isIntersecting) { show(idx); schedule(DWELL); }
        else stop();
      }), { threshold: 0.15 });
      io.observe(ana.closest('.case-slide'));
    }
  }

  // ---- 02 · the sketchbook: three sheets, one on top. Tabs flip them
  // (roving tabindex, arrows walk the tablist); the shuffle is CSS ----
  const book = document.querySelector('.sketchbook');
  if (book) {
    const tabs = Array.from(book.querySelectorAll('.sheet-tab'));
    const sheets = Array.from(book.querySelectorAll('.sheet'));
    const show = (i) => {
      tabs.forEach((t, j) => {
        t.classList.toggle('is-active', j === i);
        t.setAttribute('aria-selected', j === i ? 'true' : 'false');
        t.tabIndex = j === i ? 0 : -1;
      });
      sheets.forEach((s, j) => s.classList.toggle('is-active', j === i));
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => show(i));
      tab.addEventListener('keydown', (e) => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        const n = (i + d + tabs.length) % tabs.length;
        show(n);
        tabs[n].focus();
      });
    });
  }
})();
