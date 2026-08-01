// About page — stage fade-in, plus the hedcut portrait: the EXACT pipeline
// from working-portfolio/js/line-portrait.js. A regular photo
// (Media/face_cutout.webp) is baked at runtime into an engraving on an
// offscreen 2D canvas — ~150 roughly-horizontal ink ribbons whose
// THICKNESS encodes tone, percentile-normalized so skin reads light —
// then shown on a visible canvas that tilts toward the cursor with the
// original's exact motion (no three.js here; the site stays zero-dep, so
// the old curved-plane renderer becomes a CSS perspective tilt).
(() => {
  const stage = document.querySelector('.about-stage');
  if (stage) requestAnimationFrame(() => stage.classList.add('revealed'));

  // ---- the chapter stack: natural scroll down the sections, the
  // sidebar menu tracking the current one (Figma 1436:260) + a
  // .revealed class per slide for the entrance ----
  const scroller = document.getElementById('about-scroll');
  const slides = Array.from(document.querySelectorAll('.about-slide'));

  // ?reveal=1 — screenshot-harness hook: skip the entrances everywhere
  if (new URLSearchParams(location.search).has('reveal')) {
    slides.forEach((s) => s.classList.add('revealed'));
  }

  // ≤700px the chapters unroll into one document scroll (see about.css) —
  // no sidebar chrome, no thread; the shared site-nav
  // bottom bar (styles.css) is the mobile nav. Slides reveal via a plain
  // viewport observer instead.
  const MOBILE = window.matchMedia('(max-width: 700px)').matches;

  if (MOBILE && slides.length) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add('revealed');
      }),
      { threshold: 0.12 }
    );
    slides.forEach((s) => io.observe(s));
  } else if (scroller && slides.length) {
    // ---- the reading thread: map how far down the chapters we are onto
    // --p. The stitch used to ride this page's own hairline; the shell's
    // sidebar owns that drawing now, so this only reports the fraction
    // (and still lets the bio's scroll hint bow out once you've moved) ----
    let threadRaf = 0;
    const trackScroll = () => {
      threadRaf = 0;
      const max = scroller.scrollHeight - scroller.clientHeight;
      if (stage) stage.classList.toggle('is-scrolled', scroller.scrollTop > 40);
      window.dispatchEvent(new CustomEvent('shell:progress',
        { detail: { p: max ? scroller.scrollTop / max : 0 } }));
    };
    scroller.addEventListener('scroll', () => {
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
  const view = document.getElementById('about-face');
  const fallback = document.querySelector('.about-portrait img');
  if (!view || !view.getContext || !window.Portrait) return;

  window.Portrait.render(view, {
    sampleW: 320,
    texW: 1024,
    nLines: 150,
    step: 2,
    minThick: 0.7,
    maxThickFrac: 0.92,
    waveAmp: 0.8,
    waveLen: 26,
  }).then(() => {
    if (fallback) fallback.style.display = 'none';
  }).catch(() => {
    // a tainted canvas (file://) or a missing source: the pre-baked webp
    // underneath is already showing, so there is nothing to undo
    window.Portrait.kill();
  });

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

  // full-screen look range: the far edge of the screen turns the head to a
  // near-profile (83° / 46°) — hard-capped below 90°, where a flat plane
  // would mirror-invert (the "flip" this replaces)
  window.Portrait.look(view, {
    maxY: 1.45,          // rad ~ 83 deg
    maxX: 0.8,           // rad ~ 46 deg
    perspective: 900,
    lerp: 0.06,
    idleDelay: 400,
    idleAmpY: 0.06,
    idleAmpX: 0.03,
    idleSpeedY: 0.5,
    idleSpeedX: 0.4,
  });

})();
