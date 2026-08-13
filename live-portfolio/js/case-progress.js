// The reading rail — a case study's chapters, stacked in the top-right
// corner under the × and threaded together by the progress line. It answers
// three things at once: what the chapters are, which one you are in, and how
// far through the story you have read.
//
// The rail is built FROM the page, never from a list kept in step by hand:
// every `.case-slide` becomes a mark, sitting in document order, wearing the
// name off its aria-label and an icon off its id. Add a chapter to a case
// study and it appears here; reorder them and the rail reorders itself.
//
// It lives in the case page rather than the parent overlay, so it behaves
// identically read standalone or inside the overlay's iframe — no
// cross-frame messaging to keep in step. The colour is the CASE's own:
// --case-accent, declared by each case stylesheet.
//
// The thread does not track the scroll, it EASES toward it — a fifth of the
// remaining distance each frame, so it lands a beat after the page settles.
// A line locked to the pixel reads as a readout; one that follows reads as
// something keeping you company.
(() => {
  const doc = document.documentElement;
  const slides = [...document.querySelectorAll('.case-slide')];
  if (!slides.length) return;              // vicino: one card, nothing to thread

  // ---- one glyph per chapter, in the site's pen language: 16px box,
  // hairline stroke, round joins, currentColor. Keyed by the slide's id, so
  // a new chapter picks up its own the moment it is named.
  const G = (d) => '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" ' +
    'stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" ' +
    'aria-hidden="true">' + d + '</svg>';
  const ICONS = {
    // the whole map, seen at once
    overview: G('<rect x="2.6" y="2.6" width="4.6" height="4.6" rx="1.1"/>' +
      '<rect x="8.8" y="2.6" width="4.6" height="4.6" rx="1.1"/>' +
      '<rect x="2.6" y="8.8" width="4.6" height="4.6" rx="1.1"/>' +
      '<rect x="8.8" y="8.8" width="4.6" height="4.6" rx="1.1"/>'),
    // the thing that is wrong
    problem: G('<circle cx="8" cy="8" r="5.6"/><path d="M8 5.1 V8.7"/>' +
      '<path d="M8 10.9 L8 10.91"/>'),
    // the idea that answers it
    solution: G('<path d="M8 2.7a4 4 0 0 0-2.4 7.2c.4.3.6.7.6 1.1v.2h3.6v-.2' +
      'c0-.4.2-.8.6-1.1A4 4 0 0 0 8 2.7Z"/><path d="M6.7 13.4h2.6"/>'),
    // the route taken to get there
    process: G('<path d="M3.4 11.8C3.4 8 6.2 9.4 8 6.6c1.4-2.2 3.4-1 4.6-2.2"/>' +
      '<circle cx="3.4" cy="12.1" r="1.2"/><circle cx="12.8" cy="4.1" r="1.2"/>'),
    // the making — the site's own pen
    craft: G('<path d="M3.1 12.9 L4.9 8.1 L11.4 2.7a1.35 1.35 0 0 1 1.9 1.9' +
      'L7.9 11.1 Z"/><path d="M4.9 8.1 L7.9 11.1"/>'),
    // what came of it
    results: G('<path d="M3.6 12.6 V9.2"/><path d="M8 12.6 V5.9"/>' +
      '<path d="M12.4 12.6 V3.4"/>'),
    // the telling
    story: G('<path d="M8 4.5C6.6 3.4 5 3.1 3.4 3.3v7.9c1.6-.2 3.2.1 4.6 1.2' +
      '1.4-1.1 3-1.4 4.6-1.2V3.3C11 3.1 9.4 3.4 8 4.5Z"/><path d="M8 4.5v7.9"/>'),
    // the looking
    discovery: G('<circle cx="7.1" cy="7.1" r="4.2"/><path d="M10.2 10.2 L13.3 13.3"/>'),
    // the logo itself
    mark: G('<path d="M8 2.4 L13.6 8 L8 13.6 L2.4 8 Z"/><circle cx="8" cy="8" r="1.5"/>'),
    // out into the world
    rollout: G('<path d="M8 10.4 V3.3"/><path d="M5.3 6 L8 3.3 L10.7 6"/>' +
      '<path d="M3.2 12.8 h9.6"/>'),
    // looking back at it — the arrow that returns
    reflection: G('<path d="M4.4 6.4 H9.8a3.5 3.5 0 0 1 0 7H6.2"/>' +
      '<path d="M6.9 3.7 L4.2 6.4 L6.9 9.1"/>'),
    // two nodes, one wire — the board itself
    canvas: G('<rect x="2.2" y="2.6" width="5" height="4.2" rx="1.2"/>' +
      '<rect x="8.8" y="9.2" width="5" height="4.2" rx="1.2"/>' +
      '<path d="M7.2 4.7 C 10.6 4.7, 5.4 11.3, 8.8 11.3"/>'),
    // the machine: stations on a line
    context: G('<circle cx="3.4" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/>' +
      '<circle cx="12.6" cy="8" r="1.5"/><path d="M4.9 8 H6.5 M9.5 8 H11.1"/>' +
      '<path d="M12.6 9.5 C12.6 12.6, 3.4 12.6, 3.4 9.5"/>'),
    // the cursor, mid-gesture
    interactions: G('<path d="M3.6 2.6 L11.2 8.2 L7.8 8.9 L9.6 12.8 L7.9 13.6 L6.1 9.7 L3.6 12 Z"/>'),
    // the checked beaker — proof, distilled
    proof: G('<path d="M6 2.8 H10 M6.9 2.8 V6 L3.6 11.8 A1.6 1.6 0 0 0 5 14.2 H11 ' +
      'A1.6 1.6 0 0 0 12.4 11.8 L9.1 6 V2.8"/><path d="M6.2 10.6 L7.5 11.9 L9.9 9.5"/>'),
    // three tokens and a component — the system's two layers
    system: G('<circle cx="4.7" cy="4.7" r="2.1"/>' +
      '<circle cx="11.3" cy="4.7" r="2.1"/>' +
      '<circle cx="4.7" cy="11.3" r="2.1"/>' +
      '<rect x="8.9" y="8.9" width="4.6" height="4.6" rx="1.2"/>'),
    // the display the product lives on
    product: G('<rect x="2.4" y="3.2" width="11.2" height="7.6" rx="1.4"/>' +
      '<path d="M8 10.8 v2.2"/><path d="M5.4 13.2 h5.2"/>'),
    // three placed, one arriving — the library growing
    components: G('<rect x="2.6" y="2.6" width="4.6" height="4.6" rx="1.1"/>' +
      '<rect x="8.8" y="2.6" width="4.6" height="4.6" rx="1.1"/>' +
      '<rect x="2.6" y="8.8" width="4.6" height="4.6" rx="1.1"/>' +
      '<path d="M9.4 11.1 h3.4 M11.1 9.4 v3.4"/>'),
    // a terminal with the prompt mid-thought — the machine reading
    skill: G('<rect x="2.2" y="3" width="11.6" height="10" rx="1.6"/>' +
      '<path d="M4.8 6.6 L7 8.4 L4.8 10.2"/><path d="M8.6 10.4 h2.8"/>'),
    // one wire, two hands — the fork in the road
    paths: G('<circle cx="3.4" cy="8" r="1.5"/>' +
      '<path d="M4.9 8 C 7.5 8, 7.5 4.2, 10.1 4.2 M4.9 8 C 7.5 8, 7.5 11.8, 10.1 11.8"/>' +
      '<circle cx="11.6" cy="4.2" r="1.5"/><circle cx="11.6" cy="11.8" r="1.5"/>'),
    // a node under the glass — the part, examined
    anatomy: G('<rect x="2.4" y="3.4" width="8.4" height="7" rx="1.4"/>' +
      '<circle cx="10.8" cy="10.8" r="2.6"/><path d="M12.7 12.7 L14.4 14.4"/>'),
    // two candidates, one check — the study that settles it
    decisions: G('<rect x="2.4" y="2.6" width="4.8" height="4.8" rx="1.1"/>' +
      '<rect x="8.8" y="2.6" width="4.8" height="4.8" rx="1.1"/>' +
      '<path d="M4.6 11.4 L6.6 13.4 L11.4 8.9"/>'),
    // the doorway, and the arrow walking in — the way into the product
    onboarding: G('<path d="M6.6 2.8 H12 a1.2 1.2 0 0 1 1.2 1.2 V12 ' +
      'a1.2 1.2 0 0 1-1.2 1.2 H6.6"/>' +
      '<path d="M2.2 8 H9.2 M7 5.8 L9.4 8 L7 10.2"/>'),
  };
  const FALLBACK = G('<circle cx="8" cy="8" r="2.4"/>');

  const rail = document.createElement('nav');
  rail.className = 'read-rail';
  rail.setAttribute('aria-label', 'Chapters');
  rail.innerHTML = '<span class="read-thread"></span>' +
                   '<span class="read-fill"></span>';
  const fill = rail.querySelector('.read-fill');

  const marks = slides.map((slide, i) => {
    const name = slide.getAttribute('aria-label') || slide.id || '';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'read-mark';
    b.style.setProperty('--i', i);          // drives every stagger below
    // The name alone. The chapter NUMBER used to lead here and it was what
    // pushed the chip into the story: content reaches to ~130px from the
    // right edge in the process chapters, and a numbered chip's left edge
    // landed at ~139px. It was also saying twice what the reader can
    // already see — the stack is in order, and each chapter titles itself
    // with its own number a few inches to the left.
    b.innerHTML =
      '<span class="read-tag">' + name.replace(/[<&]/g, '') + '</span>' +
      '<span class="read-glyph">' + (ICONS[slide.id] || FALLBACK) + '</span>';
    b.setAttribute('aria-label', 'Go to ' + name);
    b.addEventListener('click', () => {
      slide.scrollIntoView({
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto' : 'smooth',
        block: 'start',
      });
    });
    rail.appendChild(b);
    return { slide, el: b };
  });
  document.body.appendChild(rail);

  let target = 0;      // where the scroll actually is, 0…1
  let shown = 0;       // where the thread has got to
  let riding = false;
  let idle = 0;

  const paint = () => {
    fill.style.transform = 'scaleY(' + shown.toFixed(4) + ')';
  };

  const ride = () => {
    const gap = target - shown;
    if (Math.abs(gap) < 0.0005) {       // closer than a pixel's worth
      shown = target;
      riding = false;
    } else {
      shown += gap * 0.2;
      requestAnimationFrame(ride);
    }
    paint();
  };

  // the chapter you are IN is the last one whose top has passed the upper
  // third of the window — the same reading line the site's scroll spies use
  const mark = () => {
    const line = window.scrollY + doc.clientHeight * 0.34;
    let cur = 0;
    marks.forEach((m, i) => {
      if (m.slide.getBoundingClientRect().top + window.scrollY <= line) cur = i;
    });
    marks.forEach((m, i) => {
      m.el.classList.toggle('is-current', i === cur);
      m.el.classList.toggle('is-past', i < cur);
    });
  };

  const measure = () => {
    const span = doc.scrollHeight - doc.clientHeight;
    // a story too short to scroll has no progress worth showing
    rail.classList.toggle('is-lit', span > 40);
    target = span > 0 ? Math.min(Math.max(window.scrollY / span, 0), 1) : 0;
    mark();
    if (!riding) { riding = true; requestAnimationFrame(ride); }
  };

  // ---- the rail OPENS on approach and stays open until the cursor has
  // truly left it. While closed its box is just the icon column, so it
  // cannot swallow a click meant for the story; while open the box takes in
  // the name chips too (CSS), which is what lets you move from an icon out
  // onto its own pill — and from pill to pill — without the hover dropping
  // through the gaps between them.
  const open = () => rail.classList.add('is-open');
  marks.forEach((m) => m.el.addEventListener('pointerenter', open));
  rail.addEventListener('pointerleave', () => rail.classList.remove('is-open'));
  // the keyboard gets the same courtesy: tabbing into the rail opens it
  rail.addEventListener('focusin', open);
  rail.addEventListener('focusout', (e) => {
    if (!rail.contains(e.relatedTarget)) rail.classList.remove('is-open');
  });

  window.addEventListener('scroll', () => {
    measure();
    rail.classList.add('is-moving');
    clearTimeout(idle);
    idle = setTimeout(() => rail.classList.remove('is-moving'), 900);
  }, { passive: true });
  window.addEventListener('resize', measure, { passive: true });
  // the story keeps growing as images decode and chapters reflow, and the
  // total is what the fraction is measured against
  if (window.ResizeObserver) new ResizeObserver(measure).observe(document.body);

  // land on the true value rather than easing up from zero on arrival, and
  // let the rows deal themselves in one frame later
  measure();
  shown = target;
  paint();
  requestAnimationFrame(() => rail.classList.add('is-dealt'));
})();
