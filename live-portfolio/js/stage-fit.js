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

  const apply = (s) => {
    if (Math.abs(s - API.card) < 0.0005) return;
    API.card = s;
    card.style.setProperty('--card-scale', s);
    window.dispatchEvent(new CustomEvent('shell:fit', { detail: { card: s } }));
  };

  const fit = () => {
    if (window.innerWidth <= 700) {        // the phone layouts own it
      card.style.removeProperty('--card-scale');
      API.card = 1;
      return;
    }
    const pad = num('--card-pad', 0);
    const w = card.clientWidth - 2 * pad;
    const h = card.clientHeight - 2 * pad;
    if (w <= 0 || h <= 0) return;          // display:none, or mid-transition
    const s = Math.min(w / num('--card-w', 1280),
                       h / num('--card-h', 832),
                       num('--card-scale-max', 1.25));
    apply(Math.max(s, MIN));
  };

  window.__shellFit = fit;                 // js/shell.js calls this on rail toggle

  // A ResizeObserver, not a resize listener. The rail's width is a 0.3s
  // transition, and this is the only way the stage scales WITH it instead of
  // snapping when it lands. It also retires the frame arithmetic that used to
  // be duplicated out of the CSS tokens — the card measures itself, so moving
  // a token now needs no code change at all.
  if ('ResizeObserver' in window) new ResizeObserver(fit).observe(card);
  else window.addEventListener('resize', fit);
  fit();
})();
