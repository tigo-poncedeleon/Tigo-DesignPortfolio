// The year column on About — arithmetic only. The MECHANIC is two lines of
// CSS (.tl-item { height } + .tl-body { position: sticky }): each posting
// owns a block of the axis and its text pins to the top of that block until
// the next posting's rule shoves it out. This file only decides how tall each
// block is, where the year numerals sit on the axis, and whose turn it is —
// so the markup stays the source of truth and the page degrades to a plain
// ruled chronology with scripting off.
(() => {
  const tl = document.getElementById('tl');
  const track = document.getElementById('tl-track');
  if (!tl || !track) return;

  const items = Array.from(track.querySelectorAll('.tl-item'));
  if (!items.length) return;

  // ---- the knobs ----
  // PX_PER_MONTH is how much axis a month is worth. MIN_DWELL is how far you
  // must scroll with a posting PINNED before the next one is allowed to shove
  // it out — the floor that makes the bump read as a bump. Several gaps here
  // are one to three months; on a purely proportional axis those postings
  // would be gone before they had settled. Every block is therefore at least
  // as tall as its own type plus this, so the dwell is the same everywhere
  // and only the long gaps stretch.
  const PX_PER_MONTH = 26;
  const MIN_DWELL = 88;

  const yearsBox = document.getElementById('tl-years');

  // ---- dates → months before today. Recomputed every load, so "Present"
  // stays honest as the calendar moves under the page. ----
  const now = new Date();
  const nowIdx = now.getFullYear() * 12 + now.getMonth();
  const monthsAgo = (spec) => {
    if (!spec || spec === 'now') return 0;
    const m = /^(\d{4})-(\d{2})$/.exec(spec);
    if (!m) return 0;
    return nowIdx - (Number(m[1]) * 12 + (Number(m[2]) - 1));
  };
  const yearOf = (d) => (d === 'now' ? now.getFullYear() : Number(String(d).slice(0, 4)));

  // Postings are authored newest-first; the axis reads their END date, so
  // "closer to now" always sits higher and two roles from the same year bump
  // in the right order.
  const rows = items.map((el) => ({
    el,
    body: el.querySelector('.tl-body'),
    end: monthsAgo(el.dataset.end),
    year: yearOf(el.dataset.end),
  }));

  // Measure the type BEFORE any height is imposed, so the floor is
  // per-posting: a block is never shorter than the words it holds plus its
  // dwell. Copy written later buys its own room automatically instead of
  // running through the next posting's rule.
  rows.forEach((r) => { r.bodyH = r.body.offsetHeight; });

  // A rule is drawn ONLY where the year turns over, so two roles from the
  // same year read as one run. The masthead hairline opens the first year.
  rows.forEach((r, i) => {
    if (i > 0 && r.year !== rows[i - 1].year) r.el.classList.add('is-year-start');
  });

  // ---- lay the axis out ----
  const ys = [0];
  for (let i = 1; i < rows.length; i++) {
    const span = Math.max(
      (rows[i].end - rows[i - 1].end) * PX_PER_MONTH, rows[i - 1].bodyH + MIN_DWELL
    );
    ys[i] = ys[i - 1] + span;
    rows[i - 1].el.style.setProperty('--h', span + 'px');
  }
  const tail = rows[rows.length - 1].bodyH + MIN_DWELL;
  rows[rows.length - 1].el.style.setProperty('--h', tail + 'px');
  rows.forEach((r, i) => { r.y = ys[i]; });

  const contentH = ys[ys.length - 1] + tail;
  const axis = track.querySelector('.tl-axis');
  if (axis) axis.style.height = contentH + 'px';

  // ---- the ruler: one numeral per year, each its OWN text, each anchored to
  // the axis at the middle of its own run of postings. They ride the track, so
  // they travel up the screen with everything else instead of hanging in the
  // frame while the postings slide past underneath. ----
  if (yearsBox) {
    const starts = rows.filter((r, i) => i === 0 || r.el.classList.contains('is-year-start'));
    Array.from(yearsBox.children).forEach((span) => {
      const y = Number(span.dataset.year);
      const at = starts.findIndex((r) => r.year === y);
      if (at < 0) { span.style.display = 'none'; return; }
      const from = starts[at].y;
      const to = at + 1 < starts.length ? starts[at + 1].y : contentH;
      span.style.top = Math.round((from + to) / 2 - 7) + 'px';
    });
  }

  // ---- whose turn it is. A posting takes over at CONTACT — the instant the
  // rule below reaches the one above and the shove starts — not when it
  // finally reaches the top of the frame. So it is already in full ink while
  // it is still doing the pushing, which is the part you watch. ----
  const takeOver = rows.map((r, i) => (i === 0 ? -Infinity : r.y - rows[i - 1].bodyH));

  // NOT `parseFloat(...) || 0` — the pin offset IS 0, which is falsy.
  const topPx = parseFloat(getComputedStyle(rows[0].body).top);
  const STICK = Number.isFinite(topPx) ? topPx : 0;

  // ---- the tail: enough for the last posting to REACH the pin line, and no
  // more. The letter beside it is sticky too and a taller element runs out of
  // parent sooner, so the track is padded by the difference in their heights —
  // that is what makes the two let go on the same pixel. ----
  const fitTail = () => {
    const last = rows[rows.length - 1];
    // It has to go on the last BLOCK, not on the track: a sticky body is
    // bounded by its own .tl-item, so padding under the list would extend the
    // page without extending the pin, and the posting would be carried off on
    // the way in. Exactly its own type tall makes the pin zero-length — the
    // last role touches the top and the page is immediately free to move.
    const h = last.bodyH;
    last.el.style.setProperty('--h', h + 'px');
    if (axis) axis.style.height = (last.y + h) + 'px';
    // The letter is sticky too, and a taller element runs out of parent
    // sooner — it would slide away while the last posting was still pinned
    // beside it. Padding the column by the difference in their heights makes
    // the two let go on the same pixel.
    const letter = document.querySelector('.letter-col');
    if (letter) {
      track.style.paddingBottom =
        Math.max(0, Math.round(letter.offsetHeight - last.bodyH)) + 'px';
    }
  };
  fitTail();
  window.addEventListener('resize', fitTail, { passive: true });
  window.addEventListener('shell:fit', fitTail);

  let current = -1;
  let raf = 0;

  const settle = () => {
    raf = 0;
    // The page is the scroller, so the probe is how far the track has
    // travelled past the pin line. ShellFit.toLayout converts the rect
    // delta out of screen px, since the stage is zoomed.
    const raw = STICK - window.ShellFit.toLayout(
      track.getBoundingClientRect().top, track);
    const probe = raw;

    let i = 0;
    while (i + 1 < rows.length && takeOver[i + 1] <= probe) i++;
    if (i === current) return;
    if (current >= 0) rows[current].el.classList.remove('is-current');
    current = i;
    rows[i].el.classList.add('is-current');
  };

  const onScroll = () => { if (!raf) raf = requestAnimationFrame(settle); };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  settle();
  tl.classList.add('is-live');
})();
