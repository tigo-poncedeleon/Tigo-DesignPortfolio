// theme.js — the page's colours, and the rainbow dot at the head of the
// prompt that turns them.
//
// Five, in a ring, one press of the dot each:
//   paper   the frame's own #fafafa, and where the ring starts and ends
//   night   the dark
//   rose, sky, sage   three soft tints, a pink, a blue and a green
// (the colours themselves are in css/tokens.css). The one you leave it on is
// remembered in this browser, and put on before the first paint by the
// script in index.html's head, so the page never shows the paper first.
//
// The change spreads out from where the dot was pressed: the new page is laid
// over the old one whole and uncovered in a circle growing from that point
// until it covers the window (a view transition; css/base.css turns off the
// browser's own crossfade). From the keyboard it spreads from the dot's
// middle. Where there are no view transitions, or motion is unwelcome, the
// colours simply change.
//
// (The colours were first turned by the Home frame's gradient art, a field of
// colour off the page's left edge, and then by a rainbow dot the size of a
// letter at the head of the prompt. Tigo has taken both out for now, so
// nothing on the page calls initTheme, and index.html no longer puts the
// remembered colours on before the first paint. To bring the ring back, hand
// initTheme a button from js/main.js, and restore the head script: read
// localStorage 'draft.theme' and set it as <html data-theme>.)

import { EASE, reduced } from './motion.js';

const THEMES = ['paper', 'night', 'rose', 'sky', 'sage'];
const KEY = 'draft.theme';
const root = document.documentElement;

export function initTheme(dot) {
  if (!dot) return;
  const meta = document.querySelector('meta[name="theme-color"]');
  let current = THEMES.includes(root.dataset.theme) ? root.dataset.theme : 'paper';
  const after = (t) => THEMES[(THEMES.indexOf(t) + 1) % THEMES.length];

  function paint() {
    if (current === 'paper') delete root.dataset.theme;
    else root.dataset.theme = current;
    // the browser's own chrome, on a phone, takes the paper too
    meta?.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg').trim());
    dot.setAttribute('aria-label', `Change the page's colours (now ${current}; next, ${after(current)})`);
  }
  paint();

  // The colours change in one step, with every transition on the page held
  // off for it (css/base.css, html.recolouring): anything that eases its own
  // colour (the prompt's field, the composer) would otherwise be caught by
  // the reveal half-way between the old paper and the new.
  function turn(x, y) {
    const apply = () => {
      root.classList.add('recolouring');
      current = after(current);
      paint();
      requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('recolouring')));
      try {
        if (current === 'paper') localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, current);
      } catch { /* private mode */ }
    };
    if (!document.startViewTransition || reduced()) { apply(); return; }
    const reach = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const change = document.startViewTransition(apply);
    change.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${reach}px at ${x}px ${y}px)`] },
        { duration: 760, easing: EASE.rise, pseudoElement: '::view-transition-new(root)' },
      );
    }).catch(() => {});
  }

  dot.addEventListener('click', (e) => {
    const box = dot.getBoundingClientRect();
    // e.detail is 0 for Enter or Space: then the colour comes from the middle
    const x = e.detail ? e.clientX : box.left + box.width / 2;
    const y = e.detail ? e.clientY : box.top + box.height / 2;
    turn(x, y);
  });
  // A press on the dot leaves the typing where it was: whatever you had
  // started to ask keeps its caret, and the next key still lands in it.
  dot.addEventListener('mousedown', (e) => e.preventDefault());

  return { get theme() { return current; } };
}
