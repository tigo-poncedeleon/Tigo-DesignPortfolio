/* ============================================================
   Colour lab

   The site wears exactly two surfaces: the content card (--bg) and the
   furniture L of chrome + rail (--shell-surface). Everything else — the
   seam-less join, the tab that is an opening onto the page, the wedge that
   redraws the card's corner — is built on those two being one considered
   step apart. This rig lets you drive both from a 12-step ramp and watch
   the actual page, with its actual content, change underneath.

   It is inert unless asked for:
     • index.html?lab      — opens on load
     • ⌃⇧L                 — toggles it anywhere
   A chosen pair is remembered in localStorage, so it survives the reload
   and follows you onto the case-study pages.

   Nothing here writes to the stylesheets. When you have found the pair,
   "Copy CSS" hands you the two lines to paste into styles.css / shell.css.
   ============================================================ */
(function () {
  'use strict';

  var KEY  = 'lab.surfaces';
  var OPEN = 'lab.open';

  /* The ramp. These are a read of the swatch sheet, not the sheet itself —
     paste the real values into the drawer ("Values") and they stick. */
  var RAMP = [
    '#fdfdfd', '#f5f5f4', '#eeeeec', '#e7e7e4',
    '#e0e0dc', '#d8d8d3', '#cbcbc6', '#b5b5b0',
    '#a1a19c', '#8a8a85', '#5f5f5c', '#1f1f1d'
  ];

  /* where the site starts from — the reset target */
  var BASE = { bg: '#f6f6f6', furn: '#efefef' };

  var state = {
    ramp:    RAMP.slice(),
    content: null,   /* index into ramp, or null = site default */
    furn:    null,
    derive:  true    /* pull --shell-line and the hover wash off the furniture */
  };

  /* ---------- colour maths ---------- */

  function rgb(hex) {
    var h = String(hex).trim().replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function hex(c) {
    return '#' + c.map(function (v) {
      return ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2);
    }).join('');
  }

  function isHex(s) { return /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(s).trim()); }

  /* relative luminance, sRGB — the same curve WCAG uses */
  function lum(hexv) {
    return rgb(hexv).map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }).reduce(function (a, b, i) { return a + b * [0.2126, 0.7152, 0.0722][i]; }, 0);
  }

  function ratio(a, b) {
    var la = lum(a), lb = lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  /* flatten a translucent layer over an opaque one — how --wash-solid was
     arrived at in the first place */
  function over(top, alpha, base) {
    var t = rgb(top), b = rgb(base);
    return hex(t.map(function (v, i) { return v * alpha + b[i] * (1 - alpha); }));
  }

  /* a line that reads as belonging to its surface: the surface pushed away
     from itself, toward black on a light ground and toward white on a dark */
  function lineOn(surface) {
    var dark = lum(surface) < 0.35;
    return over(dark ? '#ffffff' : '#000000', dark ? 0.16 : 0.14, surface);
  }

  /* ---------- applying it to the page ---------- */

  function contentHex() { return state.content === null ? BASE.bg   : state.ramp[state.content]; }
  function furnHex()    { return state.furn    === null ? BASE.furn : state.ramp[state.furn]; }

  function apply() {
    var root = document.documentElement;
    var bg = contentHex(), furn = furnHex();

    root.style.setProperty('--bg', bg);
    root.style.setProperty('--shell-surface', furn);

    if (state.derive) {
      root.style.setProperty('--shell-line', lineOn(furn));
      /* the sitewide hover chip is rgba(38,37,30,.06); --wash-solid is that
         same chip flattened, and it has to be flattened over whatever the
         furniture is now or the Letterboxd mark goes the wrong way */
      root.style.setProperty('--wash-solid', over('#1c1c1c', 0.06, furn));
    } else {
      root.style.removeProperty('--shell-line');
      root.style.removeProperty('--wash-solid');
    }

    /* the bottom half of the ramp needs the furniture's text flipped, or
       there is nothing to look at */
    var dark = lum(furn) < 0.42;
    root.classList.toggle('lab-dark-furn', dark);
    if (dark) {
      root.style.setProperty('--lab-furn-ink', over('#ffffff', 0.88, furn));
      root.style.setProperty('--lab-furn-dim', over('#ffffff', 0.52, furn));
    }

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', bg);

    save();
    paint();
  }

  function clear() {
    var root = document.documentElement;
    ['--bg', '--shell-surface', '--shell-line', '--wash-solid',
     '--lab-furn-ink', '--lab-furn-dim'].forEach(function (p) {
      root.style.removeProperty(p);
    });
    root.classList.remove('lab-dark-furn');
  }

  /* ---------- persistence ---------- */

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        ramp: state.ramp, content: state.content, furn: state.furn, derive: state.derive
      }));
    } catch (e) {}
  }

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!s) return false;
      if (Array.isArray(s.ramp) && s.ramp.length === 12) state.ramp = s.ramp;
      state.content = typeof s.content === 'number' ? s.content : null;
      state.furn    = typeof s.furn    === 'number' ? s.furn    : null;
      state.derive  = s.derive !== false;
      return state.content !== null || state.furn !== null;
    } catch (e) { return false; }
  }

  /* ---------- the panel ---------- */

  var el = null;

  function ramp(target) {
    return state.ramp.map(function (c, i) {
      return '<button class="lab-sw" type="button" data-t="' + target + '" data-i="' + i +
             '" data-n="' + (i + 1) + '" title="Primary ' + (i + 1) + ' · ' + c + '"></button>';
    }).join('');
  }

  function build() {
    el = document.createElement('div');
    el.className = 'lab';
    el.innerHTML =
      '<div class="lab-head">' +
        '<span class="lab-title">Colour lab</span>' +
        '<button class="lab-x" type="button" data-a="min" title="Collapse">–</button>' +
        '<button class="lab-x" type="button" data-a="close" title="Close (⌃⇧L)">×</button>' +
      '</div>' +
      '<div class="lab-body">' +
        '<div class="lab-group">' +
          '<div class="lab-label"><b>Content card</b><i data-o="c">default</i></div>' +
          '<div class="lab-ramp">' + ramp('c') + '</div>' +
        '</div>' +
        '<div class="lab-group">' +
          '<div class="lab-label"><b>Sidebar + top bar</b><i data-o="f">default</i></div>' +
          '<div class="lab-ramp">' + ramp('f') + '</div>' +
        '</div>' +
        '<div class="lab-gap">' +
          '<span class="lab-join"><span class="lab-join-f"></span><span class="lab-join-c"></span></span>' +
          '<span>step <b data-o="ratio">–</b></span>' +
          '<span class="lab-verdict" data-o="verdict"></span>' +
        '</div>' +
        '<label class="lab-check"><input type="checkbox" data-a="derive" checked>' +
          'Derive borders + hover wash from the furniture</label>' +
        '<div class="lab-row">' +
          '<button class="lab-btn" type="button" data-a="values">Values</button>' +
          '<button class="lab-btn" type="button" data-a="copy">Copy CSS</button>' +
          '<button class="lab-btn" type="button" data-a="reset">Reset</button>' +
        '</div>' +
        '<div class="lab-vals" hidden>' +
          '<textarea spellcheck="false" data-o="ta"></textarea>' +
          '<p>One hex per line, lightest first. <a href="#" data-a="save-vals">Apply</a></p>' +
        '</div>' +
        '<div class="lab-note">← → steps a row when the panel has focus. ' +
          'Nothing is written to your CSS until you paste it.</div>' +
      '</div>';

    document.body.appendChild(el);
    el.addEventListener('click', onClick);
    el.addEventListener('change', onChange);
    el.querySelector('.lab-head').addEventListener('pointerdown', onDrag);
    el.querySelector('[data-o="ta"]').value = state.ramp.join('\n');
    el.querySelector('[data-a="derive"]').checked = state.derive;
    paint();
  }

  function paint() {
    if (!el) return;
    var pairs = { c: state.content, f: state.furn };

    el.querySelectorAll('.lab-sw').forEach(function (b) {
      var i = +b.dataset.i, c = state.ramp[i];
      b.style.background = c;
      b.classList.toggle('is-dark', lum(c) < 0.4);
      b.classList.toggle('is-on', pairs[b.dataset.t] === i);
      b.title = 'Primary ' + (i + 1) + ' · ' + c;
    });

    ['c', 'f'].forEach(function (t) {
      var i = pairs[t];
      var out = el.querySelector('[data-o="' + t + '"]');
      out.textContent = i === null
        ? 'default · ' + (t === 'c' ? BASE.bg : BASE.furn)
        : 'Primary ' + (i + 1) + ' · ' + state.ramp[i];
    });

    var bg = contentHex(), furn = furnHex();
    var r = ratio(bg, furn);
    el.querySelector('.lab-join-c').style.background = bg;
    el.querySelector('.lab-join-f').style.background = furn;
    el.querySelector('[data-o="ratio"]').textContent = r.toFixed(2) + ':1';

    /* the site's own step is 1.05:1 — a hair, but enough that the join needs
       no line. Anything under ~1.03 and the L stops reading as separate;
       much over ~1.25 and the furniture becomes a slab instead of a margin. */
    var v = el.querySelector('[data-o="verdict"]');
    if (r < 1.03)      { v.textContent = 'seam disappears';   v.dataset.tone = 'low'; }
    else if (r > 1.35) { v.textContent = 'reads as two zones'; v.dataset.tone = 'high'; }
    else               { v.textContent = 'seamless, distinct'; v.dataset.tone = 'ok'; }
  }

  function onClick(e) {
    var sw = e.target.closest('.lab-sw');
    if (sw) {
      var i = +sw.dataset.i;
      if (sw.dataset.t === 'c') state.content = state.content === i ? null : i;
      else                      state.furn    = state.furn    === i ? null : i;
      apply();
      return;
    }

    var a = e.target.closest('[data-a]');
    if (!a) return;
    var act = a.dataset.a;

    if (act === 'close')  { e.preventDefault(); toggle(false); }
    if (act === 'min')    { el.classList.toggle('is-min'); }
    if (act === 'reset')  { state.content = null; state.furn = null; apply(); }
    if (act === 'values') {
      var d = el.querySelector('.lab-vals');
      d.hidden = !d.hidden;
      a.classList.toggle('is-on', !d.hidden);
    }
    if (act === 'save-vals') {
      e.preventDefault();
      var lines = el.querySelector('[data-o="ta"]').value
        .split(/[\s,]+/).map(function (s) { return s.trim(); }).filter(isHex);
      if (lines.length !== 12) { alert('Need exactly 12 hex values — got ' + lines.length + '.'); return; }
      state.ramp = lines.map(function (s) { return s[0] === '#' ? s.toLowerCase() : '#' + s.toLowerCase(); });
      apply();
    }
    if (act === 'copy') {
      var css =
        '/* css/styles.css */\n' +
        '--bg:            ' + contentHex() + ';\n\n' +
        '/* css/shell.css */\n' +
        '--shell-surface: ' + furnHex() + ';\n' +
        (state.derive
          ? '--shell-line:    ' + lineOn(furnHex()) + ';\n' +
            '--wash-solid:    ' + over('#1c1c1c', 0.06, furnHex()) + ';\n'
          : '');
      navigator.clipboard.writeText(css).then(function () {
        a.textContent = 'Copied';
        setTimeout(function () { a.textContent = 'Copy CSS'; }, 1200);
      }, function () { alert(css); });
    }
  }

  function onChange(e) {
    if (e.target.dataset.a === 'derive') { state.derive = e.target.checked; apply(); }
  }

  /* arrow keys step whichever ramp holds focus */
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
      e.preventDefault();
      toggle(!el);
      return;
    }
    if (!el || !el.contains(document.activeElement)) return;
    var sw = document.activeElement.closest('.lab-sw');
    if (!sw || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    var next = Math.max(0, Math.min(11, +sw.dataset.i + (e.key === 'ArrowRight' ? 1 : -1)));
    var target = el.querySelector('.lab-sw[data-t="' + sw.dataset.t + '"][data-i="' + next + '"]');
    if (sw.dataset.t === 'c') state.content = next; else state.furn = next;
    apply();
    target.focus();
  });

  function onDrag(e) {
    if (e.target.closest('.lab-x')) return;
    var r = el.getBoundingClientRect();
    var dx = e.clientX - r.left, dy = e.clientY - r.top;
    el.classList.add('is-dragging');
    el.style.right = 'auto';
    el.style.bottom = 'auto';
    function move(ev) {
      el.style.left = Math.max(4, Math.min(innerWidth - r.width - 4, ev.clientX - dx)) + 'px';
      el.style.top  = Math.max(4, Math.min(innerHeight - 34, ev.clientY - dy)) + 'px';
    }
    function up() {
      el.classList.remove('is-dragging');
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
    }
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    move(e);
  }

  function toggle(on) {
    if (on) {
      if (!el) build();
      apply();
      try { localStorage.setItem(OPEN, '1'); } catch (e) {}
    } else {
      if (el) { el.remove(); el = null; }
      clear();
      try { localStorage.removeItem(OPEN); } catch (e) {}
    }
  }

  /* ---------- boot ---------- */

  var asked = /[?&]lab\b/.test(location.search);
  var remembered = false;
  try { remembered = localStorage.getItem(OPEN) === '1'; } catch (e) {}
  load();   /* restore the last pair, but do not paint it until asked */

  function start() {
    if (asked || remembered) toggle(true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
