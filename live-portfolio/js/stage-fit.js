// Card fit — the shell is FULL-BLEED.
//
// The chrome strip and the sidebar render at true 1:1 against the viewport:
// no transform, no radius, no border, no shadow. Only the page's own
// 1280×832 stage still scales, into whatever the chrome and the rail leave
// behind. That makes this a one-transform site — `.shell-card > main` is
// the ONLY scaled element on the page.
//
// The contract, in one sentence: never read a global scale. Ask
// ShellFit.scaleOf(node) for the scale of the BOX THAT NODE LIVES IN.
// Inside main you get the card's scale; anywhere else — the chrome, the
// rail, the AI sheet — you get 1. A getBoundingClientRect delta becomes
// layout px with ShellFit.toLayout(px, node), and no call site ever has to
// know which side of the line it is on. That is the whole point: the old
// global could be read correctly by one consumer and wrongly by another,
// and neither would throw.
(() => {
  const card = document.getElementById('shell-card');
  const stage = card && card.querySelector(':scope > main');

  const num = (name, fallback) => {
    const v = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(name));
    return Number.isFinite(v) ? v : fallback;
  };

  // published even when there is no card, so callers need no null checks
  const API = {
    card: 1,
    scaleOf(node) { return (stage && node && stage.contains(node)) ? API.card : 1; },
    toLayout(px, node) { return px / API.scaleOf(node); },
  };
  window.ShellFit = API;
  if (!card || !stage) return;

  const MIN = 0.35;               // below this the stage is unreadable anyway,
                                  // and ≤700px the phone layout has taken over

  // A scale change is a LAYOUT change. `zoom` reflows the whole document, so
  // the page gets taller or shorter — while the reader's scroll offset stays
  // exactly where the browser left it, now pointing at different content.
  // Closing the rail moves the scale ~13%, which on a ten-chapter case study
  // dragged the paragraph you were reading some 400px up the screen; browser
  // zoom did the same. Nothing was broken. The page just lurched.
  //
  // So hold the reading line still across the change. The point of the page
  // under the middle of the reading area, measured in the stage's own 1280
  // grid, is scale-free — putting it back after the new scale lands is one
  // multiply. Cheap enough to run on every frame of the rail's 0.3s slide,
  // which is exactly what it has to do.
  //
  // Two rules learned in a LIVE browser (the frozen QA pane hid both):
  // · never trust a scroll offset across a layout write. Chrome's own scroll
  //   anchoring moves scrollY DURING the relayout, so document positions must
  //   be rebuilt from a fresh scrollY after the write, never the one from
  //   before it. (shell.css also turns anchoring off — two correctors tugging
  //   the same scroller every frame of the slide WAS the glitch — but the
  //   math stays live-read so it cannot regress if that rule moves.)
  // · the eye line is a VIEWPORT coordinate: half the window. It used to
  //   carry the chrome strip's 40px on the front of it; the strip is gone
  //   and the card runs to y=0, so the reading area IS the window.
  const apply = (s) => {
    if (Math.abs(s - API.card) < 0.0005) return;
    const prev = API.card;
    const eye = window.innerHeight / 2;
    // how far the reading line sits INTO the stage, in the stage's own grid
    // px. Layout is clean here (fit() just read clientWidth), so it is free.
    const held = window.scrollY > 0;
    const u = held ? (eye - stage.getBoundingClientRect().top) / prev : 0;

    API.card = s;
    card.style.setProperty('--card-scale', s);

    // at the very top there is nothing to hold — the top IS the anchor
    if (held) {
      const rect = stage.getBoundingClientRect();          // one forced layout
      const y = window.scrollY;              // fresh — anchoring may have moved it
      const want = Math.max(0, rect.top + y + u * s - eye);
      // 'instant' on purpose: this is a CORRECTION, not a journey. A page
      // that ever picks up scroll-behavior: smooth would otherwise animate
      // the hold and the content would swim after the zoom instead of
      // staying under it. left:scrollX so the correction never also
      // yanks a horizontally scrolled page back to the margin.
      if (Math.abs(want - y) > 0.5) {
        window.scrollTo({ top: want, left: window.scrollX, behavior: 'instant' });
      }
    }
    window.dispatchEvent(new CustomEvent('shell:fit', { detail: { card: s } }));
  };

  // The document scrolls, so the fit is a WIDTH fit: the stage keeps its
  // 1280 grid and grows as tall as its content. Nothing has to be handed
  // back — `zoom` participates in layout, so the page reserves the scaled
  // height by itself.
  let lastW = -1;
  // Browser zoom is deliberately REFIT, not obeyed. A "let the zoom be
  // native" pass was tried and reverted: the shell is full-bleed, so the
  // stage's physical width is pinned to the glass minus the rail — there
  // is no room for anything to get bigger. Skipping the refit just left
  // the stage wider than the zoomed viewport (131px of horizontal
  // overflow at 110%, 332px at 130%) and broke the frame. Refitting
  // cancels the zoom to the same physical geometry it had — with the
  // reading-line hold above, a settled zoom step is a visual no-op, which
  // is the only stable meaning zoom can have inside this design.
  const compute = () => {
    const pad = num('--card-pad', 0);
    const w = card.clientWidth - 2 * pad;
    if (w <= 0) return API.card;           // display:none, or mid-transition
    // A page whose chapters run down the document is TALLER than the card by
    // design, so it is fitted on width alone. A single-screen page is still
    // fitted on both, or scaling it up on a wide monitor would push its one
    // screen past the fold and invent a scrollbar that has nothing in it.
    const cardH = num('--card-h', 832);
    const flowing = stage.offsetHeight > cardH + 2;
    const h = window.innerHeight;
    return Math.max(Math.min(w / num('--card-w', 1280),
                             flowing ? Infinity : h / cardH,
                             num('--card-scale-max', 1.25)), MIN);
  };
  const fit = () => {
    if (window.innerWidth <= 700) {        // the phone layouts own it
      card.style.removeProperty('--card-scale');
      API.card = 1;
      return;
    }
    apply(compute());
  };

  // js/shell.js calls this on rail toggle — including reaching into this
  // document when it is the case overlay's iframe, so the story re-fits in
  // the same frame as the shell around it
  window.__shellFit = fit;

  // A ResizeObserver, not a resize listener — the card measures itself, so
  // moving a CSS token needs no code change. It is watched for WIDTH only:
  // fit() writes the card's height, so reacting to height here would be a
  // feedback loop that never settles.
  //
  // It fits IMMEDIATELY. A 120ms debounce lived here for a while, so that a
  // browser-zoom burst would play natively and settle once — but a delayed
  // correction is a second, separate movement, and that two-phase motion is
  // exactly what read as "it adjusts, then it jumps". One fit per box
  // change, in the frame the box changed, is both simpler and quieter: the
  // chapters are cheap to raster now (content-visibility + baked exhibits),
  // so a relayout costs well under a millisecond, and apply()'s reading-line
  // hold means the reader's paragraph does not move when it happens.
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      const w = card.clientWidth;
      if (w === lastW) return;
      lastW = w;
      fit();
    }).observe(card);
  } else {
    window.addEventListener('resize', fit);
  }
  fit();
})();
