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

  const done = () => {
    // dropping intro-pending releases the rail: it slides in from behind
    // the card's edge on its own 0.3s transition while the card reflows
    root.classList.remove('intro-pending');
    root.classList.add('intro-run');
    try { sessionStorage.setItem(KEY, '1'); } catch (err) { /* private mode */ }
    window.dispatchEvent(new CustomEvent('shell:intro-done'));
  };

  const settle = () => {                      // every skip path ends here
    if (caret) caret.remove();                // BEFORE the writes below, so
    lines.forEach((el) => {                   // "same finished state" is
      el.textContent = el.dataset.text || ''; // literally true and not just
    });                                       // incidentally true
    done();
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
    done();
  })();
})();
