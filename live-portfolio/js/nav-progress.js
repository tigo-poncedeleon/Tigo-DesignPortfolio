// The nav thread — an orange line down the gutter beside Home · Work ·
// About · Play, drawing itself as the page is read.
//
// The line is measured in ROWS, not in scroll. A straight scrollY/total
// fraction is the obvious thing and it is wrong here: the sections are
// wildly different lengths — Home is one screen, About is many — so at the
// top of Work the raw fraction is still only a tenth of the way down and
// the line sits beside Home, naming a section you left a screen ago. What
// the line has to say is WHERE you are, and the rows are what say that.
//
// So each section owns exactly one row's worth of the line, and progress
// WITHIN a section is what travels across its row: enter Work and the tip
// steps into Work's row, read to the end of Work and it reaches that row's
// bottom, whatever the section's length. The tip is therefore always beside
// the row you are actually on, and it never stops moving while you scroll.
//
// It rides the rail's own left gutter — the column the disclosure twisties
// would occupy if the tree were still nested — so it costs the rows no
// room and sits naturally to the left of their icons. The fill EASES toward
// its mark, a fifth of the remaining distance each frame, so the step from
// one row to the next is a glide rather than a jump.
(() => {
  if (!document.getElementById('home')) return;      // the one page only
  const doc = document.documentElement;

  const build = () => {
    const group = document.querySelector('.side-group[data-group="pages"]');
    if (!group) return false;
    const rows = [...group.querySelectorAll('.side-row')];
    if (rows.length < 2) return false;
    // each row's section, read off the row's own link — the rail already
    // knows which part of the page it points at
    const parts = rows.map((row) => {
      const a = row.querySelector('.side-link[href*="#"]');
      const id = a && (a.getAttribute('href').split('#')[1] || '').trim();
      return id ? document.getElementById(id) : null;
    });
    if (!parts.filter(Boolean).length) return false;

    const track = document.createElement('span');
    track.className = 'side-thread';
    track.setAttribute('aria-hidden', 'true');       // the rows already say it
    track.innerHTML = '<i></i>';
    group.appendChild(track);
    const fill = track.querySelector('i');

    // the thread spans the rows themselves, first top to last bottom, so it
    // reads as belonging to the list rather than to the panel
    const fit = () => {
      const g = group.getBoundingClientRect();
      const a = rows[0].getBoundingClientRect();
      const b = rows[rows.length - 1].getBoundingClientRect();
      if (!a.height) return;
      track.style.top = (a.top - g.top).toFixed(1) + 'px';
      track.style.height = (b.bottom - a.top).toFixed(1) + 'px';
      track.classList.add('is-lit');
    };

    let target = 0, shown = 0, riding = false;
    const paint = () => { fill.style.transform = 'scaleY(' + shown.toFixed(4) + ')'; };
    const ride = () => {
      const gap = target - shown;
      if (Math.abs(gap) < 0.0005) { shown = target; riding = false; }
      else { shown += gap * 0.2; requestAnimationFrame(ride); }
      paint();
    };

    // where a section starts, in document px
    const topOf = (el) => el.getBoundingClientRect().top + window.scrollY;

    const measure = () => {
      // the reading line: a third down the window, the same one the site's
      // scroll spies use to decide which section you are "on"
      const y = window.scrollY + doc.clientHeight * 0.34;
      const tops = parts.map((p) => (p ? topOf(p) : Infinity));

      let i = 0;
      for (let k = 0; k < tops.length; k++) if (y >= tops[k]) i = k;

      // how far through THIS section — its end is the next section's start,
      // or the document's, so the last one is measured honestly too
      const start = tops[i];
      const end = i + 1 < tops.length && isFinite(tops[i + 1])
        ? tops[i + 1] : doc.scrollHeight;
      const p = end > start ? Math.min(Math.max((y - start) / (end - start), 0), 1) : 0;

      // …mapped onto that section's own row. The tip enters the row a third
      // of the way in — far enough to read as beside it the moment you
      // arrive — and leaves at its bottom edge.
      const g = group.getBoundingClientRect();
      const first = rows[0].getBoundingClientRect();
      const last = rows[rows.length - 1].getBoundingClientRect();
      const r = rows[i].getBoundingClientRect();
      const span = last.bottom - first.top;
      if (span <= 0) return;
      const px = (r.top - first.top) + r.height * (0.34 + 0.66 * p);
      target = Math.min(Math.max(px / span, 0), 1);
      // the group may have reflowed under us (rail slide, seam drag)
      track.style.top = (first.top - g.top).toFixed(1) + 'px';
      track.style.height = span.toFixed(1) + 'px';
      if (!riding) { riding = true; requestAnimationFrame(ride); }
    };

    let raf = 0;
    window.addEventListener('scroll', () => {
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; measure(); });
    }, { passive: true });
    window.addEventListener('resize', () => { fit(); measure(); }, { passive: true });
    // the rail slides, the seam drags, the page grows as images land — the
    // rows move under the thread for all of it
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => { fit(); measure(); });
      ro.observe(group);
      ro.observe(document.body);
    }

    fit();
    measure();
    shown = target;
    paint();
    return true;
  };

  // the sidebar is built by js/shell.js; if this runs first, wait a frame
  const boot = () => { if (!build()) requestAnimationFrame(boot); };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
