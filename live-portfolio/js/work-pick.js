// The work stepper — three projects as an index, one shown large, its note
// beside it. The same shape the case studies use for their own screens,
// turned on the work that contains them: browse the row of names and the
// stage answers, then click through to the study itself.
//
// Selecting is HOVER as well as click, so the whole row is browsable
// without committing to anything, and the arrow keys walk it. Only a real
// click opens a case — js/case-overlay.js takes it from there, and this
// file deliberately knows nothing about how a case opens.
(() => {
  const pick = document.getElementById('work-pick');
  if (!pick) return;

  const rows = [...pick.querySelectorAll('.pick-row')];
  const shots = [...pick.querySelectorAll('.pick-shot')];
  const cards = [...pick.querySelectorAll('.pick-card')];
  if (!rows.length) return;

  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let at = 0;

  const show = (i) => {
    if (i < 0 || i >= rows.length || i === at) return;
    at = i;
    const id = rows[i].dataset.case;
    const mark = (els) => els.forEach((el) => {
      const on = el.dataset.case === id;
      el.classList.toggle('is-current', on);
      if (el.hasAttribute('role') && el.getAttribute('role') === 'tab') {
        el.setAttribute('aria-selected', on ? 'true' : 'false');
      }
      // only the shown image is reachable by tab — the other two are decor
      if (el.classList.contains('pick-shot')) el.tabIndex = on ? 0 : -1;
    });
    mark(rows); mark(shots); mark(cards);
  };

  rows.forEach((row, i) => {
    row.addEventListener('pointerenter', () => show(i));
    row.addEventListener('focus', () => show(i));
    // The names only SWITCH. Opening a case study is a bigger move than
    // browsing the row of them, so it gets its own target — the picture —
    // and the list stays somewhere you can look around without committing.
    row.addEventListener('click', () => show(i));
    row.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault(); rows[Math.min(i + 1, rows.length - 1)].focus();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault(); rows[Math.max(i - 1, 0)].focus();
      }
    });
  });

  shots.forEach((shot) => {
    shot.addEventListener('click', () => openCase(shot.dataset.case));
    shot.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      openCase(shot.dataset.case);
    });
  });

  // the arrows walk the row while Work is the section you are on, so the
  // stepper can be browsed without ever touching the mouse
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const el = document.activeElement;
    if (el && /^(INPUT|TEXTAREA)$/.test(el.tagName)) return;
    if (document.documentElement.className.match(/ai-open|case-open|theater-open/)) return;
    const stage = pick.closest('.work-stage');
    if (!stage) return;
    const r = stage.getBoundingClientRect();
    // only while Work actually holds the screen
    if (r.top > innerHeight * 0.5 || r.bottom < innerHeight * 0.5) return;
    e.preventDefault();
    show(at + (e.key === 'ArrowRight' ? 1 : -1));
  });

  // ---- opening. The case overlay listens for clicks on links to the case
  // pages; these are buttons, so hand it a real link click rather than
  // reaching into its internals.
  const HREF = { vicino: 'vicino.html', pantrypal: 'pantrypal.html',
                 nextlevel: 'nextlevel.html' };
  const openCase = (id) => {
    const href = HREF[id];
    if (!href) return;
    const a = document.createElement('a');
    a.href = href;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();                        // case-overlay.js intercepts and expands
    a.remove();
  };

  // hovering a name primes the story behind it, the tabs.js idiom
  const primed = new Set();
  rows.forEach((row) => row.addEventListener('pointerover', () => {
    const href = HREF[row.dataset.case];
    if (!href || primed.has(href)) return;
    primed.add(href);
    const l = document.createElement('link');
    l.rel = 'prefetch'; l.as = 'document'; l.href = href + '?embed=1';
    document.head.appendChild(l);
  }, { passive: true }));

  if (reduced()) pick.classList.add('is-plain');
})();
