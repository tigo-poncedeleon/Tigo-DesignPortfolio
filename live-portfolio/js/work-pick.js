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

  const stage = pick.querySelector('.pick-stage');
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let at = 0;

  // ---- where the picture actually IS. The three shots share one box and
  // are letterboxed into it (object-fit: contain), so the box says nothing
  // about the monitor's corner or the phone's. Measure the painted
  // rectangle and hand it to the CSS, which hangs the open badge off it.
  // offsetWidth/Height, not getBoundingClientRect: the shell zooms the page
  // and a client rect would come back in zoomed pixels.
  const fit = () => {
    const img = pick.querySelector('.pick-shot.is-current img');
    if (!stage || !img || !img.naturalWidth) return;
    const s = Math.min(img.offsetWidth / img.naturalWidth,
                       img.offsetHeight / img.naturalHeight);
    stage.style.setProperty('--shot-w', `${Math.round(img.naturalWidth * s)}px`);
    stage.style.setProperty('--shot-h', `${Math.round(img.naturalHeight * s)}px`);
  };

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
      // the name of the case you are looking at, said out loud
      if (el.classList.contains('pick-row')) el.setAttribute('aria-current', on ? 'true' : 'false');
      // only the shown image is reachable by tab — the other two are decor
      if (el.classList.contains('pick-shot')) el.tabIndex = on ? 0 : -1;
    });
    mark(rows); mark(shots); mark(cards);
    fit();
  };

  rows.forEach((row, i) => {
    row.addEventListener('pointerenter', () => show(i));
    row.addEventListener('focus', () => show(i));
    // Browsing is still free — a pointer over a name, or an arrow key, only
    // switches the stage. But a name in a list of work is a door as much as
    // the picture is, and a click on one is a decision, not a look: it opens
    // the study. You are always already looking at what you click, because
    // the hover selected it on the way in.
    //
    // Nothing here opens anything: the rows are real <a href>s now, so the
    // browser does the navigating (and gives back the status bar, the
    // middle click and the context menu the buttons had swallowed). This
    // only keeps the stage honest for the frame before the page leaves.
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

  // ---- opening. A case study is a page, so opening one is a navigation;
  // these thumbnails are buttons, so they synthesise the link click the
  // markup would otherwise have made. (This used to be intercepted by the
  // case overlay, which expanded an iframe instead — see js/case-overlay.js
  // for why that went away.)
  const HREF = { vicino: 'vicino.html', pantrypal: 'pantrypal.html',
                 nextlevel: 'nextlevel.html' };
  const openCase = (id) => {
    const href = HREF[id];
    if (!href) return;
    const a = document.createElement('a');
    a.href = href;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();                        // a real navigation, to a real page
    a.remove();
  };

  // hovering a name primes the story behind it, the tabs.js idiom
  const primed = new Set();
  rows.forEach((row) => row.addEventListener('pointerover', () => {
    const href = HREF[row.dataset.case];
    if (!href || primed.has(href)) return;
    primed.add(href);
    const l = document.createElement('link');
    l.rel = 'prefetch'; l.as = 'document'; l.href = href;   // the URL the click will really go to
    document.head.appendChild(l);
  }, { passive: true }));

  // the shots are lazy, so the first measurement of one has to wait for the
  // pixels; the window can change what "contain" resolves to at any time
  pick.querySelectorAll('.pick-shot img').forEach((img) => {
    if (img.complete) return;
    img.addEventListener('load', fit, { once: true });
  });
  addEventListener('resize', fit, { passive: true });
  fit();

  if (reduced()) pick.classList.add('is-plain');
})();
