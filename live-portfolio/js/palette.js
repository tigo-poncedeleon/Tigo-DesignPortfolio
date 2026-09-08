/* ============================================================
   Palette — the site in eighteen colours, chosen from the rail's foot.

   The two neutrals first, then sixteen hues walked evenly round the
   wheel. The six left out — coral, apricot, chartreuse, emerald, azure,
   rose — are each the nearest neighbour of one that stayed, so dropping
   them thins the wheel without tearing a hole in it; their blocks are
   still in css/palettes.css, one line away from coming back. Pick one and
   the whole document changes under you — every sheet speaks in tokens,
   and a palette is a swap of the :root (css/palettes.css). The choice is
   remembered in localStorage['shell.theme'] and put on <html> before
   first paint by the inline script in each page's <head>, so there is
   nothing to flash.

   IT IS A ROW AT THE FOOT OF THE RAIL, not furniture on the page and
   not a tool in the composer's tray. It was both: a strip, an orb, a
   ring, then a tray tool beside the mood and beside the attach — every
   one of them a SITE setting living in the hero, reachable nowhere else.
   The sidebar's foot is where an app keeps its settings, and the rail is
   on every shell page at every scroll depth. So it is a .side-row cut
   like the rows above it (css/shell.css §THE PALETTE): the orb where the
   glyph goes, the palette's name where the label goes. Pressed, the
   eighteen discs pop out to the right of the rail over the page, in a
   card mounted on <body> — outside the card's zoom — and placed from the
   row's own rect. The row's label follows the hand over the discs and
   falls back to the palette you wear.

   The orb's gradient is built here out of THEMES, so the thing you press
   is made of the colours it is about to offer you.

   Unlike the mood menu the card does NOT close when you pick: choosing a
   palette is a thing you do by eye, and shutting the tray after every
   try would make you reopen it to compare. Escape, the toggle, or a
   pointer anywhere else all close it.

   ?theme=ink in the URL sets it and strips itself, the way ?va-ignore
   does — a themed link you can hand someone.

   ON THE PHONE the rail is display:none and the drawer is the rail
   (js/drawer.js). So the same setting goes to the same place there: a
   foot pinned under the drawer's nav, cut in the drawer's own idiom —
   a group label ("palette") and the eighteen discs laid out nine by two, all of them
   on screen at once, because a thumb cannot hover for a name and should
   not have to open a second thing to see a colour. No orb: the drawer is
   one ink and the discs are already its one bright object. It does not
   close on pick either — the drawer wears the palette too, so it IS the
   swatch you compare by. css/drawer.css §THE FOOT.
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'shell.theme';

  /* name → canvas colour (the disc) and theme-color meta. Paper is the
     default and wears no attribute; its value is styles.css's --bg. */
  var THEMES = [
    { id: '',       name: 'paper',  bg: '#f6f6f6' },
    { id: 'ink',    name: 'ink',    bg: '#161616' },
    { id: 'red', name: 'red', bg: '#eb7770' },
    { id: 'orange', name: 'orange', bg: '#f19446' },
    { id: 'amber', name: 'amber', bg: '#efc64a' },
    { id: 'yellow', name: 'yellow', bg: '#d6d054' },
    { id: 'lime', name: 'lime', bg: '#b9da69' },
    { id: 'green', name: 'green', bg: '#71e6a2' },
    { id: 'mint', name: 'mint', bg: '#09e8dd' },
    { id: 'teal', name: 'teal', bg: '#00e5f7' },
    { id: 'cyan', name: 'cyan', bg: '#03cefc' },
    { id: 'sky', name: 'sky', bg: '#34b3f7' },
    { id: 'blue', name: 'blue', bg: '#7c98f8' },
    { id: 'indigo', name: 'indigo', bg: '#998ef3' },
    { id: 'violet', name: 'violet', bg: '#b186e8' },
    { id: 'purple', name: 'purple', bg: '#c57fd6' },
    { id: 'magenta', name: 'magenta', bg: '#d579c1' },
    { id: 'pink', name: 'pink', bg: '#e175a7' },
  ];
  var byId = function (id) {
    for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) return THEMES[i];
    return THEMES[0];
  };

  var root = document.documentElement;
  var card = null, grid = null, toggle = null, caption = null, side = null;
  var pgrid = null;                            // the phone's grid

  var current = function () { return root.dataset.theme || ''; };

  /* ---------- applying it ---------- */

  var paint = function (id) {
    var t = byId(id);
    if (t.id) root.dataset.theme = t.id; else delete root.dataset.theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t.bg);
    /* the stipple portrait is BAKED in the ink — a canvas, not CSS — so it
       has to be drawn again in the new one */
    if (window.Portrait && window.Portrait.repaint) window.Portrait.repaint();
    label();
  };

  var apply = function (id, opts) {
    var t = byId(id);
    if (!(opts && opts.silent)) {
      try {
        if (t.id) localStorage.setItem(KEY, t.id); else localStorage.removeItem(KEY);
      } catch (e) { /* private mode — the choice lasts the page */ }
    }
    var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    /* one cross-fade of the whole viewport rather than a transition on
       every surface — a colour swap is one event, and this is the one
       API that treats it as one */
    if (document.startViewTransition && !reduced && !document.hidden) {
      document.startViewTransition(function () { paint(t.id); });
    } else {
      paint(t.id);
    }
  };

  /* ---------- the card ---------- */

  var say = function (name) {
    if (caption) caption.textContent = name;
  };

  /* both grids, when both exist — the rail's card and the drawer's foot
     are two views of one choice */
  var label = function () {
    var t = byId(current());
    [grid, pgrid].forEach(function (g) {
      if (!g) return;
      var inputs = g.querySelectorAll('input');
      for (var i = 0; i < inputs.length; i++) inputs[i].checked = inputs[i].value === t.id;
    });
    say(t.name);
  };

  /* the eighteen discs. --i is the disc's place in the grid; the sheets
     stagger the entrance off it so the wheel lands row by row rather than
     all at once. `group` keeps the two radio groups apart — same name and
     the browser would treat them as one and uncheck across them. */
  var swatchesHTML = function (group) {
    return THEMES.map(function (t, i) {
      var cap = t.name.charAt(0).toUpperCase() + t.name.slice(1);
      return '<label class="pal-swatch" style="--sw:' + t.bg + '; --i:' + i + '">' +
        '<input type="radio" name="' + group + '" value="' + t.id + '" aria-label="' + cap + '">' +
        '<span></span></label>';
    }).join('');
  };

  /* the name follows the hand over a grid, and falls back to what you wear */
  var follow = function (g) {
    g.addEventListener('pointerover', function (e) {
      var sw = e.target.closest('.pal-swatch');
      if (sw) say(sw.querySelector('input').getAttribute('aria-label').toLowerCase());
    });
    g.addEventListener('pointerleave', function () { say(byId(current()).name); });
  };

  var buildRail = function () {
    /* every shell page has the rail (js/shell.js builds it before this
       runs); a case page inside the overlay's iframe has none, and wears
       the parent's choice through the storage listener below */
    side = document.querySelector('.shell-side');
    if (!side || toggle) return;

    /* THE ORB's gradient is not a decoration that stands for colour, it is
       the wheel itself: the sixteen hues this card offers, in wheel order,
       closed back on the first so the seam does not show while it turns.
       Built here rather than written into the sheet so it can never drift
       from THEMES. */
    var hues = THEMES.filter(function (t) { return t.id && t.id !== 'ink'; })
                     .map(function (t) { return t.bg; });

    var foot = document.createElement('div');
    foot.className = 'side-foot';
    toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'side-row side-palette';
    toggle.id = 'side-palette';
    toggle.setAttribute('aria-haspopup', 'menu');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'palette-menu');
    toggle.setAttribute('aria-label', 'Choose a palette');
    var ring = hues.concat(hues[0]).join(', ');
    toggle.style.setProperty('--wheel', 'conic-gradient(from 0deg, ' + ring + ')');
    /* the same ring unrolled, for the hover spill across the row (shell.css
       .side-palette::before) — red at the orb's edge, round to pink, back */
    toggle.style.setProperty('--wheel-line', 'linear-gradient(90deg, ' + ring + ')');
    toggle.innerHTML =
      '<span class="side-ico"><span class="orb">' +
        '<span class="orb-bloom"></span>' +
        '<span class="orb-wheel"></span>' +
        '<span class="orb-gloss"></span></span></span>' +
      '<span class="side-text" aria-live="polite"></span>';
    foot.appendChild(toggle);
    /* after the nav: the rail is a flex column and the nav is its flex: 1,
       so this lands on the floor */
    side.appendChild(foot);
    caption = toggle.querySelector('.side-text');

    card = document.createElement('div');
    card.className = 'palette-menu';
    card.id = 'palette-menu';
    card.hidden = true;
    /* --i is the disc's place in the grid; the sheet staggers the entrance
       off it so the wheel lands row by row rather than all at once */
    card.innerHTML =
      '<div class="palette-grid" role="radiogroup" aria-label="Palette">' +
        swatchesHTML('theme') +
      '</div>';
    /* on <body>, not in the rail: the rail clips its overflow, and the
       card's zoom would move a fixed box that lived under it */
    document.body.appendChild(card);
    grid = card.querySelector('.palette-grid');

    grid.addEventListener('change', function (e) {
      if (e.target.name === 'theme') apply(e.target.value);
    });
    follow(grid);

    toggle.addEventListener('click', function (e) {
      open(card.hidden, { keyboard: e.detail === 0 });
    });
    addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !card.hidden) open(false, { refocus: true });
    });
    /* the card is placed by measurement, so anything that moves the row
       under it — a window resize, the rail sliding shut — closes it
       rather than leaving it hanging in the wrong place */
    addEventListener('resize', function () { open(false); });
    addEventListener('shell:fit', function () { open(false); });
    label();
  };

  /* ---------- the phone: a foot in the drawer ---------- */

  var buildPhone = function () {
    var drawer = document.querySelector('.m-drawer');
    if (!drawer || pgrid) return;

    var foot = document.createElement('div');
    foot.className = 'm-foot m-pal';
    foot.innerHTML =
      /* the label is the drawer's own (.m-label). Just "palette" — the
         worn palette's name sat at the far end of the line for an hour
         and was cut (user's call): on the phone the ring on the disc
         and the colour of the panel itself already say which */
      '<h2 class="m-label m-pal-label">palette</h2>' +
      '<div class="m-pal-grid" role="radiogroup" aria-label="Palette">' +
        swatchesHTML('theme-m') +
      '</div>';
    /* after the nav: the drawer is a flex column and the nav is its
       flex: 1, so this lands on the floor — the rail's own arrangement */
    drawer.appendChild(foot);
    pgrid = foot.querySelector('.m-pal-grid');

    pgrid.addEventListener('change', function (e) {
      if (e.target.name === 'theme-m') apply(e.target.value);
    });
    /* no follow(): there is no name line to follow the hand */
    label();
  };

  var build = function () {
    buildRail();
    buildPhone();
  };
  /* js/drawer.js runs before DOMContentLoaded today, so build() finds the
     drawer; it also says when it is there, so the order of the two script
     tags is not what this depends on */
  addEventListener('drawer:ready', buildPhone);

  /* ---- placing it: right of the rail, bottom edge on the row's ---- */

  var place = function () {
    var r = toggle.getBoundingClientRect();
    var s = side.getBoundingClientRect();
    card.style.left = Math.round(s.right + 8) + 'px';
    card.style.bottom = Math.round(innerHeight - r.bottom) + 'px';
  };

  /* ---------- open and shut ---------- */

  var outside = function (e) {
    if (e.target.closest('.palette-menu, .side-palette')) return;
    open(false);
  };

  var open = function (want, opts) {
    if (!card || card.hidden === !want) return;
    if (want) place();
    card.hidden = !want;
    toggle.setAttribute('aria-expanded', want ? 'true' : 'false');
    if (want) {
      label();
      document.addEventListener('pointerdown', outside, true);
      /* opened from the keyboard, the hand is already on the discs */
      if (opts && opts.keyboard) {
        var on = grid.querySelector('input:checked') || grid.querySelector('input');
        if (on) on.focus({ preventScroll: true });
      }
    } else {
      document.removeEventListener('pointerdown', outside, true);
      if (opts && opts.refocus) toggle.focus({ preventScroll: true });
    }
  };

  /* ---------- boot ---------- */

  /* ?theme=… — set, remember, and take the parameter off the URL */
  try {
    var q = new URLSearchParams(location.search);
    if (q.has('theme')) {
      var want = q.get('theme') === 'paper' ? '' : q.get('theme');
      if (byId(want).id === want) {
        paint(want);
        if (want) localStorage.setItem(KEY, want); else localStorage.removeItem(KEY);
      }
      q.delete('theme');
      var rest = q.toString();
      history.replaceState(history.state, '',
        location.pathname + (rest ? '?' + rest : '') + location.hash);
    }
  } catch (e) { /* fine */ }

  /* a swap in another document of this site — the case overlay's iframe
     and the page behind it share the key — follows without a reload */
  window.addEventListener('storage', function (e) {
    if (e.key !== KEY) return;
    apply(e.newValue || '', { silent: true });
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();

  window.Palette = { apply: apply, current: current, open: open, THEMES: THEMES };
})();
