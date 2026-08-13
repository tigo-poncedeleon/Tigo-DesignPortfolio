// Vicino AI case study — the site's chapter mechanics (stage fade-in,
// sidebar scroll-spy, the reading thread) in the nextlevel.js manner. The
// page's own toy — the working canvas — lives in js/vicino-canvas.js.
(() => {
  const reduceMotion =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stage = document.querySelector('.case-stage');
  if (stage) requestAnimationFrame(() => stage.classList.add('revealed'));

  // ---- the hero laptop leans toward the cursor — the about portrait's
  // manner, a studio display instead of a face ----
  const heroImg = document.querySelector('.case-hero img');
  if (heroImg && !reduceMotion) {
    let tx = 0, ty = 0, rx = 0, ry = 0, leanRaf = 0;
    window.addEventListener('mousemove', (e) => {
      const r = heroImg.getBoundingClientRect();
      tx = ((e.clientX - (r.left + r.width / 2)) / window.innerWidth) * 0.22;
      ty = ((e.clientY - (r.top + r.height / 2)) / window.innerHeight) * 0.12;
    });
    const lean = () => {
      // converged and idle = no write. The old loop rewrote the transform
      // every frame forever (on a mix-blend-mode image, so every write was
      // a re-blend); and while the page scrolls the lean waits entirely.
      if (!document.documentElement.classList.contains('is-scrolling')) {
        const dx = tx - rx, dy = ty - ry;
        if (Math.abs(dx) > 1e-4 || Math.abs(dy) > 1e-4) {
          rx += dx * 0.06;
          ry += dy * 0.06;
          heroImg.style.transform =
            'perspective(900px) rotateY(' + rx + 'rad) rotateX(' + -ry + 'rad)';
        }
      }
      leanRaf = requestAnimationFrame(lean);
    };
    // the loop runs only while the hero's chapter is anywhere near the
    // viewport — nine chapters of scrolling shouldn't pay for a parked lean
    if ('IntersectionObserver' in window) {
      const leanIO = new IntersectionObserver((entries) => entries.forEach((en) => {
        if (en.isIntersecting) { if (!leanRaf) leanRaf = requestAnimationFrame(lean); }
        else { cancelAnimationFrame(leanRaf); leanRaf = 0; }
      }), { rootMargin: '20% 0px' });
      leanIO.observe(heroImg.closest('.case-slide') || heroImg);
    } else {
      leanRaf = requestAnimationFrame(lean);
    }
  }

  // ---- every [data-count] number COUNTS UP the first time its chapter
  // arrives — the metrics on results ----
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
        const dur = +el.dataset.dur || 1100;
        const t0 = performance.now();
        const tick = (now) => {
          const k = Math.min(1, (now - t0) / dur);
          const eased = 1 - Math.pow(1 - k, 3);   // fast start, soft landing
          el.textContent = Math.round(target * eased).toLocaleString('en-US');
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
  } else {
    // reduced motion (or no observer): the numbers simply are themselves
    document.querySelectorAll('[data-count]').forEach((el) => {
      el.textContent = (+el.dataset.count).toLocaleString('en-US');
    });
  }

  // ---- the design-system exhibits (chapters 06–09) are STILLS THAT ARE
  // LINKS: a picture of the real document, and the whole card opens that
  // document in its own tab. No iframes, nothing embedded, nothing to
  // scroll inside a pane — the markup carries the whole behaviour. All
  // that is left in JS is the tab switching. ----
  document.querySelectorAll('.exhibit-tabs').forEach((tabset) => {
    const slide = tabset.closest('.case-slide');
    const tabs = Array.from(tabset.querySelectorAll('.ex-tab'));
    const panes = Array.from(slide.querySelectorAll('.ex-pane'));
    tabs.forEach((tab) => tab.addEventListener('click', () => {
      tabs.forEach((t) => {
        t.classList.toggle('is-active', t === tab);
        t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
      });
      panes.forEach((p) => p.classList.toggle('is-active', p.id === tab.dataset.pane));
    }));
  });

  // ---- the skill chapter's card TYPES its frontmatter in when the
  // chapter arrives — reduced motion reads the finished file ----
  const skillCode = document.querySelector('.skill-code');
  if (skillCode && !reduceMotion && 'IntersectionObserver' in window) {
    const full = skillCode.textContent;
    skillCode.textContent = '';
    skillCode.classList.add('is-typing');
    let typed = false;
    const sio = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting || typed) return;
      typed = true;
      sio.disconnect();
      let i = 0;
      const step = () => {
        i = Math.min(full.length, i + 2);
        skillCode.textContent = full.slice(0, i);
        if (i < full.length) requestAnimationFrame(step);
        else setTimeout(() => skillCode.classList.remove('is-typing'), 1600);
      };
      requestAnimationFrame(step);
    }), { rootMargin: '-30% 0px -30% 0px', threshold: 0 });
    sio.observe(skillCode.closest('.case-slide'));
  }

  // ---- the canvas tile fits its chapter: the board keeps its 1920×1080
  // design px and the seat's zoom does the scaling (the games' trick) ----
  const vcTile = document.getElementById('vc-tile');
  if (vcTile) {
    const slide = vcTile.closest('.case-slide');
    const fitTile = () => {
      const room = Math.max(280, (slide ? slide.clientWidth : 1280) - 48);
      vcTile.style.setProperty('--tile-z',
        Math.min(0.5, room / 1920).toFixed(4));
    };
    fitTile();
    window.addEventListener('resize', fitTile, { passive: true });
    window.addEventListener('shell:fit', fitTile, { passive: true });
  }

  // ---- the node marquee laps only while its chapter is on screen —
  // an infinite animation shouldn't composite under nine other chapters
  const strip = document.querySelector('.node-strip');
  if (strip && 'IntersectionObserver' in window) {
    const sio = new IntersectionObserver((entries) => entries.forEach((en) => {
      strip.classList.toggle('is-parked', !en.isIntersecting);
    }), { rootMargin: '10% 0px' });
    sio.observe(strip);
  }

  const scroller = document.getElementById('case-scroll');
  const slides = Array.from(document.querySelectorAll('.case-slide'));

  // Every chapter is REVEALED AT LOAD. The scroll-gated entrance system
  // (reveal when a chapter reaches the viewport) meant a reader moving at
  // reading speed constantly caught content mid-fade — and under the
  // shell's zoom the compositor turned those entrances into visible
  // glitches. The page keeps its one stage fade-in on arrival; after
  // that, the story is simply there. (?reveal=1 stays a harmless alias.)
  slides.forEach((s) => s.classList.add('revealed'));

  // ≤700px the deck unrolls into one document scroll (see vicino.css) —
  // no sidebar chrome; slides reveal via a plain viewport observer instead
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
    // seven chapters you've scrolled (the desktop shows this as the
    // sidebar's reading thread instead)
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
        // NOT threshold 0.6 — same reasoning as the counter observer above.
        rootMargin: '-45% 0px -45% 0px', threshold: 0,
      }
    );
    slides.forEach((s) => observer.observe(s));

    // restore a deep link deterministically — the native anchor scroll can
    // lose the race against BOTH the scroll-spy and the browser's own
    // scroll restoration (which re-applies the previous session's offset a
    // beat later and lands the wrong chapter). The spy mirrors the chapter
    // into the hash, so the hash IS the restore point — manual is safe.
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const target = slides.find((s) => '#' + s.id === location.hash);
    if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' });
    setTimeout(() => { window.__hashReady = true; }, 600);

    // how deep we have read + the scroll hint's exit; the shell's sidebar
    // draws the thread, this only reports the fraction
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
})();
