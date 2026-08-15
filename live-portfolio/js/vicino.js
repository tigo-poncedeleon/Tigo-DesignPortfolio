// Vicino AI case study — the site's chapter mechanics (stage fade-in,
// sidebar scroll-spy, the reading thread) in the nextlevel.js manner. The
// page's own toy — the working canvas — lives in js/vicino-canvas.js.
(() => {
  const reduceMotion =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stage = document.querySelector('.case-stage');
  if (stage) requestAnimationFrame(() => stage.classList.add('revealed'));

  // ---- chapter 01's parallax, all three surfaces off ONE pointer and ONE
  // rAF: the display leans toward the cursor (the about portrait's manner,
  // a studio display instead of a face), the canvas floor drifts AGAINST
  // the lean so the grid reads as a surface the display stands on, and a
  // specular highlight tracks the pointer across the glass. ----
  const heroStage = document.querySelector('.hero-stage');
  if (heroStage && !reduceMotion) {
    let tx = 0, ty = 0, rx = 0, ry = 0, leanRaf = 0;
    const floor = document.querySelector('.canvas-floor');
    const dots = floor && floor.querySelector('.cf-dots');
    const spot = floor && floor.querySelector('.cf-spot');
    const sheen = heroStage.querySelector('.hs-sheen');
    window.addEventListener('mousemove', (e) => {
      const r = heroStage.getBoundingClientRect();
      tx = ((e.clientX - (r.left + r.width / 2)) / window.innerWidth) * 0.22;
      ty = ((e.clientY - (r.top + r.height / 2)) / window.innerHeight) * 0.12;
      // the sheen is a paint on a hovered element only, so it costs nothing
      // to keep current — and it must not wait on the eased lean below
      if (sheen && r.width) {
        sheen.style.setProperty('--sx',
          (((e.clientX - r.left) / r.width) * 100).toFixed(1) + '%');
        sheen.style.setProperty('--sy',
          (((e.clientY - r.top) / r.height) * 100).toFixed(1) + '%');
      }
      // the pool of bright dots follows the cursor with no easing at all —
      // a light you are holding lags nothing. Measured against the spot's
      // OWN rect so the drift below is already accounted for.
      if (spot) {
        const f = floor.getBoundingClientRect();
        const inside = e.clientX >= f.left && e.clientX <= f.right &&
                       e.clientY >= f.top && e.clientY <= f.bottom;
        floor.classList.toggle('is-lit', inside);
        if (inside) {
          // the card is drawn under a zoom (js/stage-fit.js), so client
          // pixels have to be divided back into the element's own units
          // before they can be handed to a CSS length
          const s = spot.getBoundingClientRect();
          const k = spot.offsetWidth ? s.width / spot.offsetWidth : 1;
          spot.style.setProperty('--mx', Math.round((e.clientX - s.left) / k) + 'px');
          spot.style.setProperty('--my', Math.round((e.clientY - s.top) / k) + 'px');
        }
      }
    });
    const lean = () => {
      // converged and idle = no write. The old loop rewrote the transform
      // every frame forever; and while the page scrolls the lean waits
      // entirely.
      if (!document.documentElement.classList.contains('is-scrolling')) {
        const dx = tx - rx, dy = ty - ry;
        if (Math.abs(dx) > 1e-4 || Math.abs(dy) > 1e-4) {
          rx += dx * 0.06;
          ry += dy * 0.06;
          heroStage.style.transform =
            'perspective(900px) rotateY(' + rx + 'rad) rotateX(' + -ry + 'rad)';
          // 150px per radian ≈ 16px of travel at the corners of the window
          if (dots) {
            dots.style.translate =
              (-rx * 150).toFixed(2) + 'px ' + (ry * 150).toFixed(2) + 'px';
          }
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
      leanIO.observe(heroStage.closest('.case-slide') || heroStage);
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

  // ---- the design-system exhibits (chapters 06–10) are STILLS THAT ARE
  // LINKS: a picture of the real document, and the whole card opens that
  // document in its own tab. No iframes, nothing embedded, nothing to
  // scroll inside a pane — the markup carries the whole behaviour. All
  // that is left in JS is the tab switching, and the tabs are the page's
  // one segmented control (the paths chapter's object): --seg-n sizes
  // the thumb, --seg-i slides it. Arrows walk the tablist, like the
  // sketchbook's. ----
  document.querySelectorAll('.exhibit-tabs').forEach((tabset) => {
    const slide = tabset.closest('.case-slide');
    const tabs = Array.from(tabset.querySelectorAll('.ex-tab'));
    const panes = Array.from(slide.querySelectorAll('.ex-pane'));
    tabset.style.setProperty('--seg-n', tabs.length);
    const show = (idx) => {
      tabset.style.setProperty('--seg-i', idx);
      tabs.forEach((t, j) => {
        t.classList.toggle('is-active', j === idx);
        t.setAttribute('aria-selected', j === idx ? 'true' : 'false');
        t.tabIndex = j === idx ? 0 : -1;
      });
      panes.forEach((p) => p.classList.toggle('is-active', p.id === tabs[idx].dataset.pane));
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
    show(Math.max(0, tabs.findIndex((t) => t.classList.contains('is-active'))));
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

    // ---- and it ANSWERS when the cover sends you here. shell.js turns the
    // cover's "try the working canvas" into a smooth scroll; without a
    // landing the reader arrives at a board that looks like every other
    // still on the page. The ring blooms once, timed to bloom as the scroll
    // is settling rather than while it is still travelling. ----
    const jump = document.querySelector('.case-pitch .site-link[href="#canvas"]');
    if (jump && !reduceMotion) {
      jump.addEventListener('click', () => {
        vcTile.classList.remove('is-landed');
        void vcTile.offsetWidth;            // restart the animation, not queue it
        vcTile.classList.add('is-landed');
      });
      vcTile.addEventListener('animationend', () =>
        vcTile.classList.remove('is-landed'));
    }
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
