// About page — the hedcut portrait, and the chapter spy. The EXACT pipeline
// from working-portfolio/js/line-portrait.js. A regular photo
// (Media/face_cutout.webp) is baked at runtime into an engraving on an
// offscreen 2D canvas — ~150 roughly-horizontal ink ribbons whose
// THICKNESS encodes tone, percentile-normalized so skin reads light —
// then shown on a visible canvas that tilts toward the cursor with the
// original's exact motion (no three.js here; the site stays zero-dep, so
// the old curved-plane renderer becomes a CSS perspective tilt).
(() => {
  // the stage is not lit any more, but the thread below still marks it
  // once you have moved (.is-scrolled retires the bio's scroll hint)
  const stage = document.querySelector('.about-stage');

  // ---- the chapter stack: natural scroll down the sections, the
  // sidebar menu tracking the current one (Figma 1436:260). The chapters
  // have no entrance to arm — they are on the page (css/styles.css) — so
  // the only thing watching them now is the spy. ----
  const scroller = document.getElementById('about-scroll');
  const slides = Array.from(document.querySelectorAll('.about-slide'));

  // ≤700px the chapters unroll into one document scroll (see about.css) —
  // no sidebar chrome, no thread; the shared site-nav bottom bar
  // (styles.css) is the mobile nav, and there is nothing here to observe.
  const MOBILE = window.matchMedia('(max-width: 700px)').matches;

  if (!MOBILE && slides.length) {
    // ---- the reading thread: map how far down the chapters we are onto
    // --p. The stitch used to ride this page's own hairline; the shell's
    // sidebar owns that drawing now, so this only reports the fraction
    // (and still lets the bio's scroll hint bow out once you've moved) ----
    let threadRaf = 0;
    const trackScroll = () => {
      threadRaf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const y = window.scrollY;
      // relative to the stage's own top — About no longer sits at the top of
      // the document, so a raw scrollY check would already be true on arrival
      if (stage) stage.classList.toggle('is-scrolled', stage.getBoundingClientRect().top < -40);
      window.dispatchEvent(new CustomEvent('shell:progress',
        { detail: { p: max ? y / max : 0 } }));
    };
    window.addEventListener('scroll', () => {
      if (!threadRaf) threadRaf = requestAnimationFrame(trackScroll);
    }, { passive: true });
    trackScroll();

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
          if (e.isIntersecting) setCurrent(e.target.id);
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
    // #resume was its own chapter until the experience column moved into the
    // story spread — old links still land where the experience now lives
    const wanted = location.hash === '#resume' ? '#bio' : location.hash;
    const target = slides.find((s) => '#' + s.id === wanted);
    // a pixel-exact tab restore (js/shell.js) outranks the section jump
    // …at the rail's own resting place, and HELD there while the page
    // finishes assembling (Shell.land): block:'start' lands the chapter's top
    // edge at y=0, which is UNDER the sticky strip, and landing once left it
    // wherever the intro's last reflow pushed it afterwards.
    if (target && !window.__pixelRestore) {
      if (window.Shell && window.Shell.land) window.Shell.land(target);
      else target.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
    setTimeout(() => { window.__hashReady = true; }, 600);

  }

  // ---- the letter: the visitor leaves their address on the from line
  // and the FormSubmit relay delivers the message straight to Tigo's
  // inbox (their address rides along as the reply-to). The old mailto
  // survives only as the fallback when the relay can't be reached. ----
  const compose = document.getElementById('compose');
  if (compose) {
    const draft = document.getElementById('compose-body');
    const from = document.getElementById('compose-from');
    const status = document.getElementById('compose-status');
    const button = compose.querySelector('.compose-send');
    const RELAY = 'https://formsubmit.co/ajax/tigoponcedeleon@gmail.com';
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const RESTING = status.textContent;
    let resetTimer = 0;

    const say = (msg, cls) => {
      status.textContent = msg;
      status.classList.remove('is-error', 'is-sent');
      if (cls) status.classList.add(cls);
      clearTimeout(resetTimer);
      if (msg !== RESTING) {
        resetTimer = setTimeout(() => say(RESTING), 4000);
      }
    };

    compose.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = draft.value.trim();
      const email = from.value.trim();
      if (!text) {
        say('write a little something first', 'is-error');
        draft.focus({ preventScroll: true });
        return;
      }
      if (!EMAIL_RE.test(email)) {
        say('add your email so I can reply', 'is-error');
        from.focus({ preventScroll: true });
        return;
      }
      button.disabled = true;
      say('sending…');
      try {
        const res = await fetch(RELAY, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({
            email,
            message: text,
            _replyto: email,
            _subject: 'Portfolio message',
            _template: 'table',
            _captcha: 'false',
          }),
        });
        if (!res.ok) throw new Error('relay said ' + res.status);
        await res.json();
        say('sent — thank you', 'is-sent');
        // the arrow launches out of the chip and slips back in (css)
        button.classList.add('is-sent-anim');
        setTimeout(() => button.classList.remove('is-sent-anim'), 850);
        draft.value = '';
      } catch {
        // never lose the letter: hand it to their mail app instead
        say('mail service unreachable — opened your mail app instead', 'is-error');
        window.location.href = 'mailto:tigoponcedeleon@gmail.com?body=' +
          encodeURIComponent(text);
      } finally {
        button.disabled = false;
      }
    });
  }

  // ---- the portrait. The engine lives in js/portrait.js so the rail's 26px
  // head and this 330px one are the same renderer at two sizes; the knobs
  // below are still line-portrait.js's, passed through unchanged. ----
  //
  // …AND NOT ON A PHONE. The face is cut below 700px (css/about.css hides
  // the figure), so everything from here down is work for something nobody
  // will see: a 16KB engine, a source image decoded, a canvas baked at
  // device resolution, a ResizeObserver, and a pointer loop turning a head
  // toward a cursor that does not exist on a touch screen. MOBILE is
  // already measured at the top of this file.
  if (MOBILE) return;

  const view = document.getElementById('about-face');
  const fallback = document.querySelector('.about-portrait img');
  if (!view || !view.getContext || !window.Portrait) return;

  // In CSS PIXELS OF THE FINISHED FACE, not texture px — these used to be
  // measured against a fixed 1024px sheet, which meant they only meant what
  // they were tuned to mean at one size, and a wide monitor (which scales the
  // whole stage with zoom) is not that size. The line COUNT is no longer here
  // at all: portrait.js derives it from the pixels the box actually gets, so
  // the engraving is never finer than the screen can draw it.
  const HEDCUT = {
    sampleW: 320,
    pitch: 1.8,          // CSS px between ribbons, snapped to whole device px
    step: 0.36,          // how often a ribbon re-reads the tone beneath it
    minThick: 0.16,      // the hairline it thins to on lit skin
    maxThickFrac: 0.92,  // and the share of the gap the darkest ink fills
    waveAmp: 0.15,       // the hand-wobble that keeps it from reading printed
    waveLen: 4.7,
  };

  const bakeFace = () => window.Portrait.render(view, HEDCUT).then((painted) => {
    // ONLY on a real paint. render() resolves either way, and hiding the
    // pre-baked webp over a canvas that had no box to draw into leaves a
    // hole in the letter where the face should be.
    if (!painted) return;
    if (fallback) fallback.style.display = 'none';
    // and from here on it re-bakes itself: the stage rescales on every window
    // resize, and the dpr changes the moment the window is dragged onto a
    // second monitor. Either leaves the buffer sized for a face that is no
    // longer the one on screen.
    window.Portrait.watch(view, HEDCUT);
  }).catch(() => {
    // a tainted canvas (file://) or a missing source: the pre-baked webp
    // underneath is already showing, so there is nothing to undo
    window.Portrait.kill();
  });

  // (The two-listener arm below was written for the PHONE: About is a
  // screen you tap to, so this canvas sat in a display:none section at load
  // with no pixels to bake into, and it needed telling when a box arrived.
  // The face is cut on phones now and this file returns above, so what is
  // left here answers the ordinary case — a box that is not ready on the
  // first pass — and armFace's own guard is what it leans on.)
  //
  // TWO ways of hearing about it, deliberately. The pager's own event is
  // the one that is guaranteed: it is dispatched synchronously the instant
  // the screen goes on, so it cannot be throttled and cannot be missed.
  // The ResizeObserver is the general case behind it — any other way a box
  // can appear — but it is delivered by the rendering pipeline, which a
  // backgrounded tab does not run, and the face is not something to make
  // conditional on the tab being watched.
  let baked = false;
  const armFace = () => {
    if (baked || !view.clientWidth || !view.clientHeight) return baked;
    baked = true;
    bakeFace();
    return true;
  };

  if (!armFace()) {
    window.addEventListener('phone:screen', function onScreen() {
      if (!armFace()) return;
      window.removeEventListener('phone:screen', onScreen);
    });
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => { if (armFace()) ro.disconnect(); });
      ro.observe(view);
    }
  }

  // click the face and it takes a full spin — one revolution, then back
  // to quietly watching the cursor
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const figEl = document.querySelector('.about-portrait');
  if (figEl && !reduceMotion) {
    figEl.addEventListener('click', () => {
      if (figEl.classList.contains('is-spun')) return;
      figEl.classList.add('is-spun');
      figEl.addEventListener('animationend',
        () => figEl.classList.remove('is-spun'), { once: true });
    });
  }

  // look range: livelier than the first cut (32°/18° read as barely awake at
  // 148px) but still short of MINI_LOOK's near-profile sweep, which would
  // swing the face across the letter's words. Most of the felt sensitivity
  // is the lerp — the head answers the cursor sooner, not just farther.
  window.Portrait.look(view, {
    maxY: 0.85,          // rad ~ 49 deg
    maxX: 0.5,           // rad ~ 29 deg
    perspective: 700,    // a touch more depth so the bigger turn reads as 3D
    lerp: 0.1,
    idleDelay: 400,
    idleAmpY: 0.08,
    idleAmpX: 0.04,
    idleSpeedY: 0.5,
    idleSpeedX: 0.4,
  });

})();
