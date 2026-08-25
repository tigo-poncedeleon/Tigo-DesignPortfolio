// The opening: the name types itself, then the furniture arrives.
//
// This replaces the old cover→nav-frame glide. The pill of words retired
// with it — the sidebar is the nav now — so the home card holds just the
// name pair, and the one thing that happens on arrival is that it gets
// written.
//
// Cadence is hand-typed, not metronomic: a jittered per-character delay
// with an extra beat after each space. One caret, moved between the two
// lines, so it DROPS from the name to the role instead of two carets
// blinking at each other.
//
// Plays once per session. Every skip path lands in the same place —
// both strings set, caret gone, furniture lit — so there is exactly one
// finished state to reason about.
(() => {
  const root = document.documentElement;
  const head = document.getElementById('type-head');
  const caret = document.getElementById('tw-caret');
  const lines = head ? Array.from(head.querySelectorAll('.tw')) : [];
  if (!lines.length) return;

  const KEY = 'shell.intro';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const harness = new URLSearchParams(location.search).has('reveal');

  // ---- the frame arrives.
  //
  // A FLIP, for the reason the rail toggle is one (js/shell.js): the layout
  // and the stage's zoom LAND first, in a single frame, and the only thing
  // that moves afterwards is a compositor transform over the top of a page
  // that is already final. Nothing can fall out of step with anything,
  // because by the time the first frame of movement runs there is nothing
  // left to step.
  //
  // Three pieces ride it, on one clock: the rail in from the left, the strip
  // down from the top, and — the part that was missing — the NAME, which is
  // the only thing the eye is actually on. The rail's arrival narrows the
  // card, which re-fits the 1280 stage, so the name it just watched being
  // typed used to change position AND size in a single frame at the exact
  // moment the furniture started moving. Now it travels with the frame that
  // is closing around it.
  //
  // TRANSFORM ONLY. Never opacity in these transitions: a layer mid-opacity
  // is non-opaque, and both Chrome and Firefox drop subpixel text
  // antialiasing on a non-opaque layer — the rail's labels go thin for the
  // length of the ride and then snap crisp. Nothing needs to fade anyway,
  // since both pieces of furniture start wholly off-screen.
  const poses = [];
  const pose = (el, dx, dy, s) => {
    if (!el) return;
    const scaled = s && Math.abs(s - 1) > 0.002;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && !scaled) return;
    el.getAnimations().forEach((a) => {
      if (a.transitionProperty === 'transform') a.cancel();
    });
    el.style.transition = 'none';
    el.style.transform = 'translate(' + dx.toFixed(2) + 'px, ' + dy.toFixed(2) + 'px)' +
      (scaled ? ' scale(' + s.toFixed(4) + ')' : '');
    poses.push(el);
  };
  const release = () => {
    if (!poses.length) { root.classList.remove('intro-glide'); return; }
    void root.offsetWidth;              // ONE commit for all of them, so the
    poses.forEach((el) => {             // three starts are the same instant
      el.style.transition = 'transform var(--t-intro) var(--ease-intro)';
      el.style.transform = '';
    });
    const secs = parseFloat(
      getComputedStyle(root).getPropertyValue('--t-intro')) || 0.52;
    // one shared timer rather than three transitionends: they are on one
    // clock by construction, and transitionend has no delivery guarantee
    setTimeout(() => {
      poses.forEach((el) => { el.style.transition = el.style.transform = ''; });
      poses.length = 0;
      root.classList.remove('intro-glide');   // the seam settles onto the frame
    }, secs * 1000 + 90);
  };

  // `ride` is passed, not inferred: only the path that actually typed the
  // name has anything to glide from. Every skip — a returning visitor,
  // reduced motion, the ?reveal harness — settles synchronously at parse
  // time, before shell.js has even hung the furniture, and wants the frame
  // to be simply already there. The phone has no frame to assemble.
  const done = (ride) => {
    const side = document.querySelector('.shell-side');
    const stage = document.getElementById('home');
    const eased = ride && window.innerWidth > 700;
    const was = eased && {
      side: side && side.getBoundingClientRect(),
      stage: stage && stage.getBoundingClientRect(),
    };

    if (eased) root.classList.add('intro-glide');
    root.classList.remove('intro-pending');
    root.classList.add('intro-run');
    try { sessionStorage.setItem(KEY, '1'); } catch (err) { /* private mode */ }
    // the zoom in the SAME task as the layout that changed it, before anything
    // measures: stage-fit's own observer would not run until after this one
    if (window.__shellFit) window.__shellFit();
    // …and now the listeners (shell.js lights the furniture, main.js re-measures
    // the hero's height), still synchronously, so `is` below sees a settled page
    window.dispatchEvent(new CustomEvent('shell:intro-done'));
    if (!eased) return;

    const is = {
      side: side && side.getBoundingClientRect(),
      stage: stage && stage.getBoundingClientRect(),
    };
    // ONE piece now, and one direction. The assembly used to be two — the
    // rail in from the left and the chrome strip down from the top,
    // perpendicular, on one clock — and the strip's half had to be AUTHORED
    // rather than measured, because it was sticky at top:0 and had been
    // sitting at y=0 the whole time, merely invisible. With the strip gone
    // the frame is the rail, and the rail's arrival is a real measurement.
    if (was.side && is.side) pose(side, was.side.left - is.side.left, 0);
    if (was.stage && is.stage && is.stage.width > 0) {
      // The stage lives inside `main`'s zoom, so a viewport delta has to be
      // spent in the stage's own grid px or it travels by the scale factor
      // too far. ShellFit.toLayout answers for the box the node is in.
      const px = (v) => (window.ShellFit ? window.ShellFit.toLayout(v, stage) : v);
      // centre to centre, and the size change with it: transform-origin is
      // the box's middle and the name is centred in it, so one scale about
      // that point puts the whole hero back where it was typed
      pose(stage,
        px((was.stage.left + was.stage.width / 2) - (is.stage.left + is.stage.width / 2)),
        px((was.stage.top + was.stage.height / 2) - (is.stage.top + is.stage.height / 2)),
        was.stage.width / is.stage.width);
    }
    release();
  };

  const settle = () => {                      // every skip path ends here
    if (caret) caret.remove();                // BEFORE the writes below, so
    lines.forEach((el) => {                   // "same finished state" is
      el.textContent = el.dataset.text || ''; // literally true and not just
    });                                       // incidentally true
    done(false);
  };

  let seen = false;
  try { seen = sessionStorage.getItem(KEY) === '1'; } catch (err) { /* private mode */ }
  if (seen || reduce || harness) { settle(); return; }

  // ---- the typing itself
  const CHAR = 58, JITTER = 44, SPACE = 40;
  const HOLD_BETWEEN = 420;                   // one caret blink, then line two
  const HOLD_END = 260;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const type = async (el) => {
    const text = el.dataset.text || '';
    // a text node the loop mutates, with the caret as its SIBLING inside
    // .tw — el.textContent would detach the caret on the first character
    const t = document.createTextNode('');
    el.replaceChildren(t);
    if (caret) {
      el.appendChild(caret);                       // the caret drops to this line
      caret.classList.add('is-typing');            // real terminals hold while typing
    }
    for (let i = 0; i < text.length; i++) {
      t.nodeValue = text.slice(0, i + 1);
      await wait(CHAR + (Math.random() * JITTER - JITTER / 2) +
        (text[i] === ' ' ? SPACE : 0));
    }
    if (caret) caret.classList.remove('is-typing');
  };

  (async () => {
    await wait(320);                          // let the stage's own fade get going
    for (let i = 0; i < lines.length; i++) {
      await type(lines[i]);
      if (i < lines.length - 1) await wait(HOLD_BETWEEN);
    }
    await wait(HOLD_END);
    if (caret) caret.classList.add('is-done');
    await wait(220);
    if (caret) caret.remove();
    done(true);
  })();
})();
