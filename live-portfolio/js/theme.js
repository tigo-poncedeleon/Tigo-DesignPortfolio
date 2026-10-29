// theme.js — the page's colours, and the dot beside the name that turns them.
//
// Seven, in a ring:
//   paper   the frame's own #fafafa, and where the ring starts and ends
//   apricot, rose, lilac, sky, sage   five washes, in the order they go
//           round the colour wheel: an orange, and then the menu's pink,
//           lavender, blue and green poured thin over the paper
//   ink     the dark, a plain charcoal grey
// (the colours themselves are in css/tokens.css, and the dots in
// css/theme.css). The one you leave it on is remembered in this browser and
// worn by every page of the site: the case studies and the 404 page as well
// as this one (css/case.css says how a case study wears each). The script
// in each page's head puts it on before the first paint, so no page shows
// the paper first, and followSaved, below, keeps a page up with it after
// that.
//
// The dot after "Tigo Ponce de León" is always the next colour round the
// ring, and pressing it pours that colour over the page. Where there is a
// pointer that can hover, coming onto the dot deals the rest of the ring out
// in a line beside it, in the order they would come, so the dot itself
// never moves from under the pointer and pressing it again and again goes
// all the way round. The colour the page is wearing is not in the line: it
// is the page. Pressing one pours it out of its dot, and the colour it
// covers goes back into the line at the far end, the others closing up to
// make room.
//
// The pour spreads out from the dot: the new page is laid over the old one
// whole and uncovered in a circle growing from the dot's middle until it
// covers the window (a view transition; css/base.css turns off the
// browser's own crossfade). Where there are no view transitions, or motion
// is unwelcome, the colours simply change.
//
// (The colours were first turned by the Home frame's gradient art, a field of
// colour off the page's left edge, and then by a rainbow dot the size of a
// letter at the head of the prompt, which stepped through them one press at
// a time with nothing to say what came next. To take this one out, delete
// the .hues block in index.html, css/theme.css's link, the call to
// initTheme in js/main.js and the dot's pop in js/entrance.js; and to take
// the colours off the site altogether, the line in every page's head that
// reads the colour back, the calls to followSaved in js/case.js and
// 404.html, and "the case studies in ink" at the foot of css/case.css.)

import { EASE, reduced } from './motion.js';

export const THEMES = ['paper', 'apricot', 'rose', 'lilac', 'sky', 'sage', 'ink'];
const NAMES = { paper: 'Paper', apricot: 'Apricot', rose: 'Rose', lilac: 'Lilac', sky: 'Sky', sage: 'Sage', ink: 'Ink' };
const KEY = 'draft.theme';
const root = document.documentElement;
const hover = matchMedia('(hover: hover)');

// Put a colour on the page, and on the browser's own chrome around it, which
// on a phone takes the page's paper too.
function wear(theme) {
  if (theme === 'paper') delete root.dataset.theme;
  else root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg').trim());
}
const saved = () => {
  try { const t = localStorage.getItem(KEY); return THEMES.includes(t) ? t : 'paper'; } catch { return 'paper'; }
};

// The colour saved in this browser, worn again whenever the page may have
// fallen behind it: brought back from the browser's back-and-forward cache
// (Home changed after a case study was left, say, and Forward taken), or
// changed in another tab. Every page calls it; Home's dot hears of the
// change through onChange, so the line deals itself out from the new colour.
export function followSaved(onChange) {
  const follow = () => {
    const theme = saved();
    if (theme === (root.dataset.theme || 'paper')) return;
    wear(theme);
    onChange?.(theme);
  };
  wear(saved());
  addEventListener('pageshow', (e) => { if (e.persisted) follow(); });
  addEventListener('storage', (e) => { if (e.key === KEY || e.key === null) follow(); });
}

export function initTheme(hues, { name } = {}) {
  if (!hues) return null;
  const dots = Object.fromEntries([...hues.querySelectorAll('[data-hue]')].map((b) => [b.dataset.hue, b]));
  let current = THEMES.includes(root.dataset.theme) ? root.dataset.theme : 'paper';
  // the line, in the order the colours would come from here: slot 0 is the
  // dot beside the name, and the page's own colour has no slot
  const line = () => THEMES.map((_, i) => THEMES[(THEMES.indexOf(current) + 1 + i) % THEMES.length]).slice(0, -1);
  // the line's last slot, which the stylesheet staggers and sizes by
  hues.style.setProperty('--last', THEMES.length - 2);

  // The dot sits a space after the name's first line, which is shorter than
  // the second, so where it stands is read off the words themselves, and
  // again whenever their size changes (the frame's unit, the font arriving).
  const firstLine = name?.querySelector('.name-line');
  function place() {
    if (!firstLine) return;
    const words = document.createRange();
    words.selectNodeContents(firstLine);
    hues.style.setProperty('--name-end', `${words.getBoundingClientRect().width}px`);
  }
  place();
  if (name) new ResizeObserver(place).observe(name);
  document.fonts?.ready.then(place);

  function slot({ still = false } = {}) {
    const order = line();
    for (const [theme, dot] of Object.entries(dots)) {
      const at = order.indexOf(theme);
      const isPage = at < 0;
      // the colour that goes back into the line arrives at its far end
      // already, and only then swells in: it does not slide there from
      // wherever it was poured
      if (!isPage && dot.classList.contains('is-page')) {
        dot.style.transition = 'none';
        dot.style.setProperty('--slot', at);
        void dot.offsetWidth;
        dot.style.transition = '';
      }
      if (!isPage) {
        dot.style.setProperty('--slot', at);
        dot.dataset.slot = at;
      } else delete dot.dataset.slot;
      if (still) dot.style.transition = 'none';
      dot.classList.toggle('is-page', isPage);
      dot.inert = isPage;
      dot.tabIndex = at === 0 ? 0 : -1;
      dot.setAttribute('aria-label', NAMES[theme]);
      if (still) { void dot.offsetWidth; dot.style.transition = ''; }
    }
    hues.setAttribute('aria-label', `The page's colour, now ${NAMES[current].toLowerCase()}`);
  }

  const paint = () => wear(current);
  paint();
  slot({ still: true });
  followSaved((theme) => {
    current = theme;
    slot({ still: true });
  });

  // ---- the line, dealt out and gathered in ----
  // Out as soon as a pointer comes onto the dot, or the keyboard does; back
  // in a moment after the pointer has left, so a hand that overshoots the
  // last dot by a little does not lose the line. While a colour is pouring
  // the line stays out whatever the pointer does.
  //
  // Whether the pointer has left is read off where it is, not off the
  // browser's hover: the pour lays a picture of the page over the page, and
  // for as long as it runs the pointer is over that picture and not the
  // dots, so the browser says it has left the line, and once the picture has
  // gone it does not always say it is back until the pointer next moves.
  let pouring = false;
  let gathering = 0;
  let px = -1;
  let py = -1;
  const isOpen = () => hues.hasAttribute('data-open');
  const open = () => { clearTimeout(gathering); gathering = 0; hues.setAttribute('data-open', ''); };
  const close = () => { clearTimeout(gathering); gathering = 0; hues.removeAttribute('data-open'); };
  function onLine() {
    const box = hues.getBoundingClientRect();
    return px >= box.left && px <= box.right && py >= box.top && py <= box.bottom;
  }
  function maybeClose({ wait = 0 } = {}) {
    clearTimeout(gathering);
    gathering = setTimeout(() => {
      gathering = 0;
      if (pouring || onLine() || hues.querySelector(':focus-visible')) return;
      close();
    }, wait);
  }
  hues.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'touch' || !hover.matches) return;
    px = e.clientX;
    py = e.clientY;
    open();
  });
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    px = e.clientX;
    py = e.clientY;
    if (!isOpen()) return;
    if (onLine()) { clearTimeout(gathering); gathering = 0; }
    else if (!gathering) maybeClose({ wait: 220 });
  }, { passive: true });
  // and a pointer that leaves the window from the line has left the line
  root.addEventListener('pointerleave', () => {
    px = py = -1;
    if (isOpen()) maybeClose({ wait: 220 });
  });
  hues.addEventListener('focusin', () => {
    if (hues.querySelector(':focus-visible')) open();
  });
  hues.addEventListener('focusout', (e) => {
    if (!hues.contains(e.relatedTarget)) maybeClose();
  });

  // From the keyboard the line is one stop: Tab lands on the dot beside the
  // name, the arrows walk along the line, and Escape gathers it in again.
  hues.addEventListener('keydown', (e) => {
    const order = line();
    const at = order.indexOf(document.activeElement?.dataset.hue);
    if (e.key === 'Escape' && isOpen()) {
      close();
      return;
    }
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step || at < 0) return;
    e.preventDefault();
    open();
    const next = dots[order[(at + step + order.length) % order.length]];
    for (const d of Object.values(dots)) d.tabIndex = d === next ? 0 : -1;
    next.focus();
  });

  // ---- the pour ----
  // The colours change in one step, with every transition on the page held
  // off for it (css/base.css, html.recolouring): anything that eases its own
  // colour (the prompt's field, the composer) would otherwise be caught by
  // the reveal half-way between the old paper and the new. The line moves
  // once that is lifted, so its dots can slide.
  function pour(theme, from) {
    if (theme === current) return;
    const box = from.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    // (a press from the pointer never takes the focus: see mousedown, below)
    const fromKeys = hues.contains(document.activeElement);
    const apply = () => {
      root.classList.add('recolouring');
      current = theme;
      paint();
      requestAnimationFrame(() => requestAnimationFrame(() => {
        root.classList.remove('recolouring');
        slot();
        // A press from the keyboard hands the focus to the dot beside the
        // name, the colour after the one just poured, so pressing again
        // goes on round the ring from there.
        if (fromKeys) dots[line()[0]].focus({ preventScroll: true });
      }));
      try {
        if (current === 'paper') localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, current);
      } catch { /* private mode */ }
    };
    if (!document.startViewTransition || reduced()) { apply(); return; }
    const reach = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    pouring = true;
    const change = document.startViewTransition(apply);
    change.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${reach}px at ${x}px ${y}px)`] },
        { duration: 760, easing: EASE.rise, pseudoElement: '::view-transition-new(root)' },
      );
    }).catch(() => {});
    change.finished.finally(() => {
      pouring = false;
      maybeClose();
    });
  }

  for (const [theme, dot] of Object.entries(dots)) {
    dot.addEventListener('click', () => pour(theme, dot.querySelector('.hue-dot') || dot));
    // A press on a dot leaves the typing where it was: whatever you had
    // started to ask keeps its caret, and the next key still lands in it.
    dot.addEventListener('mousedown', (e) => e.preventDefault());
  }

  return { get theme() { return current; } };
}
