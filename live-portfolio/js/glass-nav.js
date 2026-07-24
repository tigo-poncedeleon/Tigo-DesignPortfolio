// Moves the grey chip under whichever word in the pill is hovered and tints
// that word orange. Between words the chip springs across and resizes via CSS
// transitions (see .glass). On mouse-leave (or tap-outside) it fades away.
//
// The chip (.glass) paints BEHIND the words so it never tints them (see the
// node-order note in styles.css).
window.GlassNav = (function () {
  var PANE_PAD = 31;      // old 41 (Figma 1366:247: chip 119 − word 78) × the 28/37.6 word rescale

  var enabled = true;     // reserved: lets a future router freeze the chip
  var hideFn = null;

  // Words with a page behind them. On desktop a click navigates; on touch the
  // first tap shows the chip and the second tap follows the link.
  var ROUTES = { about: 'about.html', work: 'work.html', play: 'play.html', ai: 'ai.html' };

  function init() {
    const pill = document.getElementById('pill');
    const glass = document.getElementById('glass');
    if (!pill || !glass) return;

    const words = Array.prototype.slice.call(pill.querySelectorAll('.word'));
    if (!words.length) return;

    let cur = -1;

    // Optical centring: a word's INK is not centred in its layout box — side
    // bearings skew it horizontally and, with no descenders in use, lowercase
    // ink sits a few px above the line-box centre. Measure each word's ink box
    // once (canvas measureText) and store the ink-centre − box-centre delta so
    // the chip can centre on what the eye sees, not on the box.
    const inkOff = words.map(function (el) {
      try {
        const cs = getComputedStyle(el);
        const ctx = document.createElement('canvas').getContext('2d');
        ctx.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
        const m = ctx.measureText(el.textContent);
        const boxH = el.getBoundingClientRect().height;
        const baseline = (boxH - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2
                         + m.fontBoundingBoxAscent;
        return {
          x: (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2 - m.width / 2,
          y: baseline - (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2 - boxH / 2
        };
      } catch (e) {
        return { x: 0, y: 0 };            // old engines: fall back to box centring
      }
    });

    function moveTo(i) {
      if (!enabled) return;
      const wr = words[i].getBoundingClientRect();
      const pr = pill.getBoundingClientRect();

      // offsetWidth, not wr.width: the hovered word carries a CSS scale, and a
      // re-hover/resize while it's scaled would otherwise grow the chip. The
      // rect is still right for the CENTRES — a symmetric scale doesn't move them.
      glass.style.width = (words[i].offsetWidth + PANE_PAD) + 'px';

      // The chip is centred in the pill (left/top:50%); shift it to the word's
      // INK centre (box-centre delta + the per-word optical offset above).
      const dx = (wr.left + wr.width / 2) - (pr.left + pr.width / 2) + inkOff[i].x;
      const dy = (wr.top + wr.height / 2) - (pr.top + pr.height / 2) + inkOff[i].y;
      glass.style.setProperty('--dx', dx.toFixed(1) + 'px');
      glass.style.setProperty('--dy', dy.toFixed(1) + 'px');

      words.forEach(function (el, j) { el.classList.toggle('hot', j === i); });
      glass.classList.add('show');
      cur = i;
    }

    function hide() {
      glass.classList.remove('show');
      words.forEach(function (el) { el.classList.remove('hot'); });
      cur = -1;
    }
    hideFn = hide;

    const isTouch = window.matchMedia('(hover: none)').matches;

    words.forEach(function (el, i) {
      var route = ROUTES[el.dataset.word];
      if (isTouch) {
        el.addEventListener('click', function (e) {
          e.preventDefault();
          if (cur === i) {
            route ? (window.location.href = route) : hide();
          } else {
            moveTo(i);
          }
        });
      } else {
        el.addEventListener('mouseenter', function () { moveTo(i); });
        el.addEventListener('focus', function () { moveTo(i); });
        el.addEventListener('blur', hide);
        if (route) {
          el.addEventListener('click', function () { window.location.href = route; });
        }
      }
    });

    if (isTouch) {
      document.addEventListener('click', function (e) {
        if (!pill.contains(e.target)) hide();
      });
    } else {
      pill.addEventListener('mouseleave', hide);
    }

    window.addEventListener('resize', function () {
      if (cur >= 0) moveTo(cur);
    });
  }

  return {
    init: init,
    setEnabled: function (v) { enabled = v; if (!v && hideFn) hideFn(); },
    hide: function () { if (hideFn) hideFn(); }
  };
})();
