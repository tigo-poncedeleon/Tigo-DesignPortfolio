// PantryPal case study — the about page's chapter mechanics (stage
// fade-in, sidebar scroll-spy with the gliding warm chip,
// the reading thread) plus this page's own toy: the six-step flow
// walkthrough (steps · phone · caption, driven by click / phone-tap /
// arrow keys).
(() => {
  const reduceMotion =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stage = document.querySelector('.case-stage');
  if (stage) requestAnimationFrame(() => stage.classList.add('revealed'));

  // ---- the hero phone leans toward the cursor — the about portrait's
  // manner, an aluminium slab instead of a face ----
  const heroImg = document.querySelector('.case-hero img');
  if (heroImg && !reduceMotion) {
    let tx = 0, ty = 0, rx = 0, ry = 0;
    window.addEventListener('mousemove', (e) => {
      const r = heroImg.getBoundingClientRect();
      tx = ((e.clientX - (r.left + r.width / 2)) / window.innerWidth) * 0.24;
      ty = ((e.clientY - (r.top + r.height / 2)) / window.innerHeight) * 0.14;
    });
    (function lean() {
      rx += (tx - rx) * 0.06;
      ry += (ty - ry) * 0.06;
      heroImg.style.transform =
        'perspective(900px) rotateY(' + rx + 'rad) rotateX(' + -ry + 'rad)';
      requestAnimationFrame(lean);
    })();
  }

  // ---- every [data-count] number COUNTS UP the first time its chapter
  // arrives — the 35% in the problem arc, the metrics on results ----
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
    }), { threshold: 0.6 });
    countGroups.forEach((_, slide) => io.observe(slide));
  }

  const scroller = document.getElementById('case-scroll');
  const slides = Array.from(document.querySelectorAll('.case-slide'));
  const dots = Array.from(document.querySelectorAll('.menu-item'));

  // ?reveal=1 — screenshot-harness hook: skip the entrances everywhere
  if (new URLSearchParams(location.search).has('reveal')) {
    slides.forEach((s) => s.classList.add('revealed'));
  }

  // one warm chip that glides between a column of items: measure the
  // target into CSS vars, follow hover/focus, settle on the current item
  const makeGlide = (container, glass, items, currentOf) => {
    let hovered = null;
    const place = (item) => {
      if (!glass || !item) return;
      glass.style.setProperty('--gx', item.offsetLeft + 'px');   /* mobile: the chips wrap into a row */
      glass.style.setProperty('--gt', item.offsetTop + 'px');
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

  // ≤700px the deck unrolls into one document scroll (see pantry.css) —
  // no sidebar chrome; slides reveal via a plain
  // viewport observer instead
  const MOBILE = window.matchMedia('(max-width: 700px)').matches;

  let menuGlide = null;
  const menu = document.querySelector('.case-menu');
  if (!MOBILE && menu && menu.querySelector('.menu-glass')) {
    menuGlide = makeGlide(menu, menu.querySelector('.menu-glass'), '.menu-item',
      () => dots.find((d) => d.classList.contains('is-current')));
  }

  if (MOBILE && slides.length) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add('revealed');
      }),
      { threshold: 0.12 }
    );
    slides.forEach((s) => io.observe(s));

    // a slim reading-progress bar hugs the top edge — how far through the
    // six chapters you've scrolled (long-form mobile polish; the desktop
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
  } else if (scroller && slides.length && dots.length === slides.length) {
    const setCurrent = (id) => {
      // the sidebar hears where the page is. Emitted BEFORE the
      // __hashReady gate below, so the rail never lags the scroll.
      window.dispatchEvent(new CustomEvent('shell:section', { detail: { id: id } }));
      dots.forEach((dot) => {
        const on = dot.getAttribute('href') === '#' + id;
        if (on) dot.setAttribute('aria-current', 'page');
        else dot.removeAttribute('aria-current');
        dot.classList.toggle('is-current', on);
      });
      if (menuGlide) menuGlide.settle();
    
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
      { root: scroller, threshold: 0.6 }
    );
    slides.forEach((s) => observer.observe(s));

    // restore a deep link deterministically — the native anchor scroll can
    // lose the race against the scroll-spy; only after settling does the
    // spy start mirroring the hash back
    const target = slides.find((s) => '#' + s.id === location.hash);
    if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' });
    setTimeout(() => { window.__hashReady = true; }, 600);


    // the reading thread + the scroll hint's exit
    const thread = document.querySelector('.case-thread');
    let threadRaf = 0;
    const trackScroll = () => {
      threadRaf = 0;
      const max = scroller.scrollHeight - scroller.clientHeight;
      if (thread) {
        thread.style.setProperty('--p', max ? scroller.scrollTop / max : 0);
      }
      if (stage) stage.classList.toggle('is-scrolled', scroller.scrollTop > 40);
      // the same fraction the reading thread used to pour down the
      // hairline now feeds the sidebar's chapter rail
      window.dispatchEvent(new CustomEvent('shell:progress',
        { detail: { p: max ? scroller.scrollTop / max : 0 } }));
    };
    scroller.addEventListener('scroll', () => {
      if (!threadRaf) threadRaf = requestAnimationFrame(trackScroll);
    }, { passive: true });
    trackScroll();
  }

  // ---- the flow walkthrough: click a step (or the phone, or ← →) and
  // the screen + caption swap in. Left alone, it DEMOS itself — auto-
  // advancing every few seconds until the visitor takes the wheel. ----
  const flowSlide = document.getElementById('solution');
  const stepsBox = document.querySelector('.flow-steps');
  const steps = Array.from(document.querySelectorAll('.step-item'));
  const shots = Array.from(document.querySelectorAll('.flow-phone img'));
  const caps = Array.from(document.querySelectorAll('.flow-cap'));
  const phone = document.querySelector('.flow-phone');
  if (steps.length && steps.length === shots.length && steps.length === caps.length) {
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
      shots.forEach((s, k) => s.classList.toggle('is-on', k === cur));
      caps.forEach((c, k) => c.classList.toggle('is-on', k === cur));
      if (stepGlide) stepGlide.settle();
    };
    if (stepsBox && stepsBox.querySelector('.flow-glass')) {
      stepGlide = makeGlide(stepsBox, stepsBox.querySelector('.flow-glass'),
        '.step-item', () => steps[cur]);
    }

    // demo mode: starts when the flow chapter arrives, pauses off-screen,
    // and retires for good the moment the visitor drives — the hint line
    // says which mode you're in
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
      auto = setInterval(() => setStep(cur + 1), 3800);
      if (hint) hint.textContent = 'walking itself — click anything to take over';
    };
    const takeWheel = () => { driven = true; stopAuto(); };
    if (flowSlide && 'IntersectionObserver' in window) {
      new IntersectionObserver(
        (entries) => entries.forEach((e) =>
          e.isIntersecting ? startAuto() : stopAuto()),
        { threshold: 0.6 }
      ).observe(flowSlide);
    }

    steps.forEach((s, k) => s.addEventListener('click', () => {
      takeWheel();
      setStep(k);
    }));
    if (phone) phone.addEventListener('click', () => {
      takeWheel();
      setStep(cur + 1);
    });
    // arrow keys page the walkthrough while the flow chapter is on screen
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      if (!flowSlide || !scroller) return;
      const i = Math.round(scroller.scrollTop / scroller.clientHeight);
      if (slides[i] !== flowSlide) return;
      e.preventDefault();
      takeWheel();
      setStep(cur + (e.key === 'ArrowRight' ? 1 : -1));
    });
  }
})();
