// Next Level Drone Cleaning case study — the site's chapter mechanics
// (stage fade-in, sidebar scroll-spy with the gliding cool
// chip, the reading thread) plus this page's own toy: the five-question
// brand interview (questions · answer card, driven by click / card-tap /
// arrow keys).
(() => {
  const reduceMotion =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stage = document.querySelector('.case-stage');
  if (stage) requestAnimationFrame(() => stage.classList.add('revealed'));

  // ---- the story polaroids: click (or tap) one to bring it to the front,
  // with a little paper-shuffle kick. An inline z-index outranks the
  // stylesheet's z-index:2 on the first card; clearing it on the others
  // drops them back to their CSS stacking. The class is stripped on
  // animationend (and re-added after a reflow) so the shuffle re-fires on
  // every click. ----
  const photoCards = document.querySelectorAll('.photo-card');
  photoCards.forEach((card) => {
    card.addEventListener('animationend', () => card.classList.remove('is-shuffling'));
    card.addEventListener('click', () => {
      photoCards.forEach((c) => { c.style.zIndex = ''; });
      card.style.zIndex = '5';
      card.classList.remove('is-shuffling');
      void card.offsetWidth;               // reflow so the animation restarts
      card.classList.add('is-shuffling');
    });
  });

  // ---- the hero badge leans toward the cursor — the about portrait's
  // manner, a coat of arms instead of a face ----
  const heroImg = document.querySelector('.case-hero img');
  if (heroImg && !reduceMotion) {
    let tx = 0, ty = 0, rx = 0, ry = 0, leanRaf = 0;
    window.addEventListener('mousemove', (e) => {
      const r = heroImg.getBoundingClientRect();
      tx = ((e.clientX - (r.left + r.width / 2)) / window.innerWidth) * 0.24;
      ty = ((e.clientY - (r.top + r.height / 2)) / window.innerHeight) * 0.14;
    });
    const lean = () => {
      // converged and idle = no write. The badge's station-keeping runs on
      // `translate`/`rotate` (nextlevel.css), so this owns `transform`
      // outright and the two compose instead of one silencing the other.
      const dx = tx - rx, dy = ty - ry;
      if (Math.abs(dx) > 1e-4 || Math.abs(dy) > 1e-4) {
        rx += dx * 0.06;
        ry += dy * 0.06;
        heroImg.style.transform =
          'perspective(900px) rotateY(' + rx + 'rad) rotateX(' + -ry + 'rad)';
      }
      leanRaf = requestAnimationFrame(lean);
    };
    // the loop belongs to the cover, not to seven chapters of scrolling
    const coverSlide = heroImg.closest('.case-slide');
    if (coverSlide && 'IntersectionObserver' in window) {
      new IntersectionObserver((entries) => entries.forEach((en) => {
        if (en.isIntersecting) { if (!leanRaf) leanRaf = requestAnimationFrame(lean); }
        else { cancelAnimationFrame(leanRaf); leanRaf = 0; }
      }), { rootMargin: '20% 0px' }).observe(coverSlide);
    } else {
      leanRaf = requestAnimationFrame(lean);
    }
  }

  // ---- every [data-count] number COUNTS UP the first time its chapter
  // arrives — the metrics on reflection ----
  const countGroups = new Map();
  document.querySelectorAll('[data-count]').forEach((el) => {
    const slide = el.closest('.case-slide');
    if (!slide) return;
    if (!countGroups.has(slide)) countGroups.set(slide, []);
    countGroups.get(slide).push(el);
  });
  if (countGroups.size && !reduceMotion && 'IntersectionObserver' in window) {
    const counted = new Set();
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting || counted.has(en.target)) return;
      counted.add(en.target);
      (countGroups.get(en.target) || []).forEach((el) => {
        const target = +el.dataset.count;
        const prefix = el.dataset.prefix || '';
        const suffix = el.dataset.suffix || '';
        const dur = +el.dataset.dur || 1100;
        const t0 = performance.now();
        const tick = (now) => {
          const k = Math.min(1, (now - t0) / dur);
          const eased = 1 - Math.pow(1 - k, 3);   // fast start, soft landing
          el.textContent = prefix + Math.round(target * eased) + suffix;
          if (k < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }), {
        // NOT threshold 0.6. A chapter is often taller than the window now
        // that the document scrolls, and a section that can never be 60%
        // visible never fires — it would sit at opacity 0 forever. Firing on
        // the section that straddles the middle of the screen is the same
        // intent and holds at any height.
        rootMargin: '-45% 0px -45% 0px', threshold: 0,
      });
    countGroups.forEach((_, slide) => io.observe(slide));
  }

  const scroller = document.getElementById('case-scroll');
  const slides = Array.from(document.querySelectorAll('.case-slide'));

  // ?reveal=1 — screenshot-harness hook: skip the entrances everywhere
  if (new URLSearchParams(location.search).has('reveal')) {
    slides.forEach((s) => s.classList.add('revealed'));
  }

  // one cool chip that glides between a column of items: measure the
  // target into CSS vars, follow hover/focus, settle on the current item
  const makeGlide = (container, glass, items, currentOf) => {
    let hovered = null;
    const place = (item) => {
      if (!glass || !item) return;
      glass.style.setProperty('--gt', item.offsetTop + 'px');
      glass.style.setProperty('--gx', item.offsetLeft + 'px');   /* mobile: the chips wrap into a row */
      glass.style.setProperty('--gw', item.offsetWidth + 'px');
      glass.style.setProperty('--gh', item.offsetHeight + 'px');
    };
    const settle = () => place(hovered || currentOf());
    settle();
    requestAnimationFrame(() =>
      requestAnimationFrame(() => glass.classList.add('is-ready')));
    container.addEventListener('pointerover', (e) => {
      const item = e.target.closest(items);
      if (item) { hovered = item; place(item); }
    });
    container.addEventListener('pointerleave', () => { hovered = null; settle(); });
    container.addEventListener('focusin', (e) => {
      const item = e.target.closest(items);
      if (item) place(item);
    });
    container.addEventListener('focusout', settle);
    return { settle: () => { if (!hovered) settle(); } };
  };

  // ≤700px the deck unrolls into one document scroll (see nextlevel.css) —
  // no sidebar chrome; slides reveal via a plain
  // viewport observer instead
  const MOBILE = window.matchMedia('(max-width: 700px)').matches;

  if (MOBILE && slides.length) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add('revealed');
      }),
      { threshold: 0.12 }
    );
    slides.forEach((s) => io.observe(s));

    // a slim reading-progress bar hugs the top edge — how far through the
    // seven chapters you've scrolled (long-form mobile polish; the desktop
    // shows this as the sidebar's reading thread instead)
    if (stage) {
      const bar = document.createElement('div');
      bar.className = 'read-progress';
      bar.setAttribute('aria-hidden', 'true');
      stage.appendChild(bar);
      let rpRaf = 0;
      const trackRP = () => {
        rpRaf = 0;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.setProperty('--rp', max > 0 ? Math.min(1, window.scrollY / max) : 0);
      };
      window.addEventListener('scroll', () => {
        if (!rpRaf) rpRaf = requestAnimationFrame(trackRP);
      }, { passive: true });
      trackRP();
    }
  } else if (scroller && slides.length) {
    const setCurrent = (id) => {
      // the sidebar hears where the page is. Emitted BEFORE the
      // __hashReady gate below, so the rail never lags the scroll.
      window.dispatchEvent(new CustomEvent('shell:section', { detail: { id: id } }));

      // mirror the chapter into the URL (replace, never push) so refresh
      // and back/forward land where the reader actually was
      if (window.__hashReady && location.hash.slice(1) !== id && (location.hash || id !== slides[0].id)) {
        history.replaceState(null, '', '#' + id);
      }
    };
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setCurrent(e.target.id);
            e.target.classList.add('revealed');
          }
        });
      },
      {
        // NOT threshold 0.6. A chapter is often taller than the window now
        // that the document scrolls, and a section that can never be 60%
        // visible never fires — it would sit at opacity 0 forever. Firing on
        // the section that straddles the middle of the screen is the same
        // intent and holds at any height.
        rootMargin: '-45% 0px -45% 0px', threshold: 0,
      }
    );
    slides.forEach((s) => observer.observe(s));

    // restore a deep link deterministically — the native anchor scroll can
    // lose the race against the scroll-spy; only after settling does the
    // spy start mirroring the hash back
    const target = slides.find((s) => '#' + s.id === location.hash);
    if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' });
    setTimeout(() => { window.__hashReady = true; }, 600);


    // how deep we have read + the scroll hint's exit. The stitch used to
    // ride this page's own hairline; the shell's sidebar owns that drawing
    // now, so this only reports the fraction.
    let threadRaf = 0;
    const trackScroll = () => {
      threadRaf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (stage) stage.classList.toggle('is-scrolled', window.scrollY > 40);
      window.dispatchEvent(new CustomEvent('shell:progress',
        { detail: { p: max ? window.scrollY / max : 0 } }));
    };
    window.addEventListener('scroll', () => {
      if (!threadRaf) threadRaf = requestAnimationFrame(trackScroll);
    }, { passive: true });
    trackScroll();
  }

  // ---- the brand interview: click a question (or the card, or ← →) and
  // the answer swaps in. Left alone, it DEMOS itself — auto-advancing
  // until the visitor takes the wheel. ----
  const qaSlide = document.getElementById('discovery');
  const stepsBox = document.querySelector('.flow-steps');
  const steps = Array.from(document.querySelectorAll('.step-item'));
  const caps = Array.from(document.querySelectorAll('.flow-cap'));
  const card = document.querySelector('.qa-card');
  if (steps.length && steps.length === caps.length) {
    const prefersReduced =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let cur = 0;
    let stepGlide = null;
    const setStep = (i) => {
      cur = (i + steps.length) % steps.length;
      steps.forEach((s, k) => {
        s.classList.toggle('is-current', k === cur);
        if (k === cur) s.setAttribute('aria-current', 'step');
        else s.removeAttribute('aria-current');
      });
      caps.forEach((c, k) => c.classList.toggle('is-on', k === cur));
      if (stepGlide) stepGlide.settle();
    };
    if (stepsBox && stepsBox.querySelector('.flow-glass')) {
      stepGlide = makeGlide(stepsBox, stepsBox.querySelector('.flow-glass'),
        '.step-item', () => steps[cur]);
    }

    // demo mode: starts when the discovery chapter arrives, pauses
    // off-screen, and retires for good the moment the visitor drives —
    // the hint line says which mode you're in
    const hint = document.querySelector('.flow-hint');
    const HINT_REST = hint ? hint.textContent : '';
    let auto = 0;
    let driven = false;
    const stopAuto = () => {
      clearInterval(auto);
      auto = 0;
      if (hint) hint.textContent = HINT_REST;
    };
    const startAuto = () => {
      if (driven || prefersReduced || auto) return;
      auto = setInterval(() => setStep(cur + 1), 5200);
      if (hint) hint.textContent = 'interviewing itself — click anything to take over';
    };
    const takeWheel = () => { driven = true; stopAuto(); };
    if (qaSlide && 'IntersectionObserver' in window) {
      new IntersectionObserver(
        (entries) => entries.forEach((e) =>
          e.isIntersecting ? startAuto() : stopAuto()),
        {
        // NOT threshold 0.6. A chapter is often taller than the window now
        // that the document scrolls, and a section that can never be 60%
        // visible never fires — it would sit at opacity 0 forever. Firing on
        // the section that straddles the middle of the screen is the same
        // intent and holds at any height.
        rootMargin: '-45% 0px -45% 0px', threshold: 0,
      }
      ).observe(qaSlide);
    }

    steps.forEach((s, k) => s.addEventListener('click', () => {
      takeWheel();
      setStep(k);
    }));
    if (card) card.addEventListener('click', () => {
      takeWheel();
      setStep(cur + 1);
    });
    // arrow keys page the interview while the discovery chapter is on screen
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      if (!qaSlide || !scroller) return;
      const i = Math.round(window.scrollY / scroller.clientHeight);
      if (slides[i] !== qaSlide) return;
      e.preventDefault();
      takeWheel();
      setStep(cur + (e.key === 'ArrowRight' ? 1 : -1));
    });
  }

  // ---- the rollout STUDIO BOARD: five surfaces pinned to the wall under
  // washi tape; hovering straightens one (pure CSS). Clicking lifts it off
  // the board — the surface is CLONED into the fixed .look overlay and
  // FLIPped from its board rect to centre stage, so the piece appears to
  // fly up off the wall. ← → (keys or the flanking arrows) walk the wall
  // while it's up; esc / the × / the veil fly it back onto its pin. ----
  const look = document.getElementById('look');
  const boardSlide = document.getElementById('rollout');
  if (look && boardSlide) {
    const pieces = Array.from(boardSlide.querySelectorAll('.board-piece'));
    const lookPiece = document.getElementById('look-piece');
    const catEl = document.getElementById('look-cat');
    const nameEl = document.getElementById('look-name');
    const indexEl = document.getElementById('look-index');
    const closeBtn = look.querySelector('.look-close');
    const N = pieces.length;
    let cur = -1;
    let closing = 0;

    const surfaceOf = (root) =>
      root.querySelector('.browser, .apparel-card, .board-shot');

    // rebuild the overlay figure as a clone of piece i (tape re-pinned)
    const fill = (i) => {
      cur = ((i % N) + N) % N;
      const piece = pieces[cur];
      lookPiece.className = 'look-piece is-' + piece.dataset.kind;
      lookPiece.replaceChildren(
        Object.assign(document.createElement('span'), { className: 'tape' }),
        surfaceOf(piece).cloneNode(true));
      catEl.textContent = piece.dataset.cat;
      nameEl.textContent = piece.dataset.name;
      indexEl.textContent = (cur + 1) + ' / ' + N;
    };

    // FLIP helper: the transform that lays the full-size clone back over
    // the board piece (centre-to-centre translate + scale + the pin tilt)
    const towardBoard = () => {
      const from = surfaceOf(pieces[cur]).getBoundingClientRect();
      const to = surfaceOf(lookPiece).getBoundingClientRect();
      // both rects are VISUAL px; the transform we return is applied in the
      // element's own layout space, so convert. ShellFit answers for the box
      // THIS node lives in — the board is inside the scaled card, so this
      // gets the card's scale. The scale factor below is a ratio of two
      // same-space widths and so is already correct either way.
      const F = window.ShellFit || { toLayout: (p) => p };
      const dx = F.toLayout(from.left + from.width / 2 - (to.left + to.width / 2), lookPiece);
      const dy = F.toLayout(from.top + from.height / 2 - (to.top + to.height / 2), lookPiece);
      const rot = getComputedStyle(pieces[cur]).rotate;
      return 'translate(' + dx + 'px, ' + dy + 'px)' +
        ' scale(' + from.width / to.width + ')' +
        (rot && rot !== 'none' ? ' rotate(' + rot + ')' : '');
    };

    const open = (piece) => {
      clearTimeout(closing);
      closing = 0;
      fill(pieces.indexOf(piece));
      look.hidden = false;
      lookPiece.style.opacity = '';
      if (!reduceMotion) {
        lookPiece.style.transition = 'none';       // start ON the board…
        lookPiece.style.transform = towardBoard();
        void lookPiece.offsetWidth;
        lookPiece.style.transition = '';           // …then fly to centre
        lookPiece.style.transform = '';
      }
      requestAnimationFrame(() => look.classList.add('is-open'));
      closeBtn.focus({ preventScroll: true });
    };

    const close = () => {
      if (look.hidden || closing) return;
      look.classList.remove('is-open');
      if (!reduceMotion) lookPiece.style.transform = towardBoard();
      closing = setTimeout(() => {
        closing = 0;
        look.hidden = true;
        lookPiece.style.transform = '';
      }, reduceMotion ? 250 : 560);
      pieces[cur].focus({ preventScroll: true });
    };

    // walking the wall: the piece drifts out the way it came, the next
    // one drifts in from the other side (a plain swap under reduce)
    const step = (dir) => {
      if (look.hidden || closing) return;
      if (reduceMotion) { fill(cur + dir); return; }
      lookPiece.style.transition = 'transform var(--t-micro) ease, opacity var(--t-micro) ease';
      lookPiece.style.transform =
        'translateX(' + -26 * dir + 'px) rotate(' + -1.2 * dir + 'deg)';
      lookPiece.style.opacity = '0';
      setTimeout(() => {
        fill(cur + dir);
        lookPiece.style.transition = 'none';
        lookPiece.style.transform =
          'translateX(' + 30 * dir + 'px) rotate(' + 1.6 * dir + 'deg)';
        void lookPiece.offsetWidth;
        lookPiece.style.transition = '';
        lookPiece.style.transform = '';
        lookPiece.style.opacity = '';
      }, 180);
    };

    pieces.forEach((p) => {
      p.addEventListener('click', () => open(p));
      p.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        open(p);
      });
    });
    look.querySelectorAll('.look-arrow').forEach((a) =>
      a.addEventListener('click', () => step(Number(a.dataset.dir))));
    closeBtn.addEventListener('click', close);
    look.querySelector('.look-veil').addEventListener('click', close);

    // while the overlay is up it owns the keyboard: esc closes, ← → walk,
    // tab stays inside the dialog's three buttons
    document.addEventListener('keydown', (e) => {
      if (look.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      else if (e.key === 'Tab') {
        const f = Array.from(look.querySelectorAll('button'));
        const i = f.indexOf(document.activeElement);
        if (i === -1 || (!e.shiftKey && i === f.length - 1)) {
          e.preventDefault();
          f[0].focus();
        } else if (e.shiftKey && i === 0) {
          e.preventDefault();
          f[f.length - 1].focus();
        }
      }
    });

    // ?look=N — screenshot-harness hook (the ?reveal=1 manner): open the
    // overlay on piece N straight away
    const lookParam = new URLSearchParams(location.search).get('look');
    if (lookParam !== null && pieces[+lookParam]) open(pieces[+lookParam]);
  }
})();
