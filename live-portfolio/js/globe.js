// The globe — an orthographic sphere behind the rail's location row.
//
// Everything here falls out of three dot products. A point at latitude phi
// and longitude lambda is a unit vector; the view is a basis built from the
// rotation longitude lam0 and a fixed tilt phi0; the projection is that
// point's components along the basis, and its visibility is the sign of the
// third. Graticules, both pins and the great-circle arc between them all
// use the same four lines of maths.
//
// A bare graticule sphere with one dot is a diagram, not a map — nothing
// gives the viewer a sense of scale. What makes it read is TWO points and
// the arc between them: Tigo, the visitor, and the distance. A relationship
// needs no coastlines.
(() => {
  // the trigger lives in the top bar now, so the card hangs off the shell
  const shell = document.getElementById('shell');
  if (!shell) return;

  // The one place Tigo's own position is written down.
  const TIGO = { city: 'Chicago', lat: 41.8781, lon: -87.6298 };

  const R = 66;                 // sphere radius, SVG user units
  const CX = 84, CY = 84;       // centre of a 168-box
  const TILT = 20 * Math.PI / 180;   // enough to show the polar cap and give
                                     // the ball volume; more and the equator
                                     // bows into a lens
  const RAD = Math.PI / 180;
  const EARTH_KM = 6371;

  const vec = (lat, lon) => {
    const p = lat * RAD, l = lon * RAD;
    return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
  };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  // the view basis for a given rotation longitude
  const basis = (lam0) => {
    const l = lam0 * RAD;
    return {
      view: [Math.cos(TILT) * Math.cos(l), Math.cos(TILT) * Math.sin(l), Math.sin(TILT)],
      east: [-Math.sin(l), Math.cos(l), 0],
      up: [-Math.sin(TILT) * Math.cos(l), -Math.sin(TILT) * Math.sin(l), Math.cos(TILT)],
    };
  };
  const project = (v, B) => [CX + R * dot(v, B.east), CY - R * dot(v, B.up)];
  const visible = (v, B) => dot(v, B.view) >= 0;

  // Sample a parametric curve and START A NEW SUBPATH wherever visibility
  // flips, so the far side is genuinely clipped at the limb rather than
  // showing through. The crossing is bisected six times — about 0.03 deg,
  // sub-pixel at this radius — so the limb is clean rather than ragged.
  const curve = (at, t0, t1, steps, B) => {
    let d = '', open = false, prevT = t0, prevVis = visible(at(t0), B);
    for (let i = 0; i <= steps; i++) {
      const t = t0 + (t1 - t0) * (i / steps);
      const v = at(t);
      const vis = visible(v, B);
      if (vis !== prevVis) {
        let a = prevT, b = t;
        for (let k = 0; k < 6; k++) {
          const m = (a + b) / 2;
          if (visible(at(m), B) === prevVis) a = m; else b = m;
        }
        const edge = project(at((a + b) / 2), B);
        if (prevVis) { d += ' L' + edge[0].toFixed(1) + ',' + edge[1].toFixed(1); open = false; }
        else { d += ' M' + edge[0].toFixed(1) + ',' + edge[1].toFixed(1); open = true; }
      }
      if (vis) {
        const p = project(v, B);
        d += (open ? ' L' : ' M') + p[0].toFixed(1) + ',' + p[1].toFixed(1);
        open = true;
      } else { open = false; }
      prevT = t; prevVis = vis;
    }
    return d.trim();
  };

  const meridian = (lon) => (t) => vec(t, lon);
  const parallel = (lat) => (t) => vec(lat, t);

  // great circle between two points, by slerp
  const arcBetween = (a, b) => {
    const va = vec(a.lat, a.lon), vb = vec(b.lat, b.lon);
    const om = Math.acos(Math.max(-1, Math.min(1, dot(va, vb))));
    const s = Math.sin(om);
    const at = (t) => {
      if (s < 1e-6) return va;
      const k1 = Math.sin((1 - t) * om) / s, k2 = Math.sin(t * om) / s;
      return [va[0] * k1 + vb[0] * k2, va[1] * k1 + vb[1] * k2, va[2] * k1 + vb[2] * k2];
    };
    return { at: at, omega: om };
  };

  const fmtLat = (v) => Math.abs(v).toFixed(2) + '°' + (v >= 0 ? 'N' : 'S');
  const fmtLon = (v) => Math.abs(v).toFixed(2) + '°' + (v >= 0 ? 'E' : 'W');

  /* ============================================================
     The card
     ============================================================ */
  let card = null, svgEl = null, geo = null, raf = 0, openT = 0, closeT = 0;
  let isOpen = false;

  const build = () => {
    card = document.createElement('div');
    card.className = 'globe-card';
    card.hidden = true;
    card.innerHTML =
      '<svg class="globe" viewBox="0 0 168 168" aria-hidden="true">' +
        '<circle class="globe-orbit guide" cx="84" cy="84" r="76" />' +
        '<circle class="globe-limb" cx="84" cy="84" r="' + R + '" />' +
        '<path class="globe-grid guide" id="globe-mer" d="" />' +
        '<path class="globe-grid guide" id="globe-par" d="" />' +
        '<path class="globe-eq" id="globe-eq" d="" />' +
        '<path class="globe-arc" id="globe-arc" d="" />' +
        '<g id="globe-home" class="globe-home"><circle r="3" /></g>' +
        '<g id="globe-pin" class="globe-pin">' +
          '<g class="pin-drop">' +
            '<path d="M0 0 C0 0 6.2 -8.4 6.2 -13 A6.2 6.2 0 1 0 -6.2 -13 C-6.2 -8.4 0 0 0 0 Z" />' +
            '<circle cy="-13" r="2.3" />' +
          '</g>' +
        '</g>' +
      '</svg>' +
      '<p class="globe-where" id="globe-where"></p>' +
      '<p class="globe-far" id="globe-far"></p>' +
      '<p class="globe-when" id="globe-when"></p>';
    shell.appendChild(card);
    svgEl = card.querySelector('.globe');
  };

  const draw = (lam0) => {
    const B = basis(lam0);
    let mer = '';
    for (let lon = -180; lon < 180; lon += 30) mer += ' ' + curve(meridian(lon), -90, 90, 46, B);
    let par = '';
    [-60, -30, 30, 60].forEach((lat) => { par += ' ' + curve(parallel(lat), -180, 180, 90, B); });
    card.querySelector('#globe-mer').setAttribute('d', mer.trim());
    card.querySelector('#globe-par').setAttribute('d', par.trim());
    card.querySelector('#globe-eq').setAttribute('d', curve(parallel(0), -180, 180, 90, B));

    if (!geo) return;
    const me = { lat: geo.lat, lon: geo.lon };
    const arc = arcBetween(TIGO, me);
    card.querySelector('#globe-arc').setAttribute('d', curve(arc.at, 0, 1, 60, B));

    const place = (id, pt) => {
      const g = card.querySelector(id);
      const v = vec(pt.lat, pt.lon);
      const p = project(v, B);
      g.setAttribute('transform', 'translate(' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ')');
      g.style.opacity = visible(v, B) ? '' : '0';
    };
    place('#globe-home', TIGO);
    place('#globe-pin', me);
  };

  const fill = () => {
    if (!geo) return;
    card.querySelector('#globe-where').textContent =
      (geo.city || geo.region) + ' · ' + fmtLat(geo.lat) + ', ' + fmtLon(geo.lon);
    const km = EARTH_KM * arcBetween(TIGO, { lat: geo.lat, lon: geo.lon }).omega;
    card.querySelector('#globe-far').textContent = km < 40
      ? 'right where he is'
      : Math.round(km).toLocaleString('en-US') + ' km from ' + TIGO.city;
    card.querySelector('#globe-when').textContent =
      geo.region + (geo.offset ? ' · UTC' + geo.offset.replace(/(\d\d)(\d\d)/, '$1:$2') : '');
  };

  const spin = () => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const target = geo ? geo.lon : 0;
    if (reduce) { draw(target); card.classList.add('is-landed'); return; }
    const from = target - 360;             // one full turn, arriving at the pin
    const dur = 1400;
    const t0 = performance.now();
    cancelAnimationFrame(raf);
    card.classList.remove('is-landed');
    (function step(now) {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 4);    // ease-out quartic, --ease-rise's twin
      draw(from + (target - from) * e);
      if (k < 1) raf = requestAnimationFrame(step);
      else card.classList.add('is-landed');
    })(t0);
  };

  const show = () => {
    if (isOpen) return;
    isOpen = true;
    card.hidden = false;
    card.offsetHeight;                     // commit before the entrance
    card.classList.add('is-lit');
    fill();
    spin();
  };
  const hide = () => {
    if (!isOpen) return;
    isOpen = false;
    cancelAnimationFrame(raf);
    card.classList.remove('is-lit', 'is-landed');
    setTimeout(() => { if (!isOpen) card.hidden = true; }, 320);
  };

  /* ---- wiring: hover intent, click to pin, Escape and outside to close ---- */
  const wire = () => {
    const row = document.querySelector('[data-globe]');
    if (!row) return;
    // pin the card under whatever opened it
    const place = () => {
      const r = row.getBoundingClientRect();
      card.style.left = Math.round(r.left) + 'px';
      card.style.top = Math.round(r.bottom + 8) + 'px';
    };
    row.addEventListener('pointerenter', place);
    row.addEventListener('click', place);
    let pinned = false;
    row.addEventListener('pointerenter', () => {
      clearTimeout(closeT);
      openT = setTimeout(show, 140);
    });
    row.addEventListener('pointerleave', () => {
      clearTimeout(openT);
      if (!pinned) closeT = setTimeout(hide, 220);
    });
    card.addEventListener('pointerenter', () => clearTimeout(closeT));
    card.addEventListener('pointerleave', () => {
      if (!pinned) closeT = setTimeout(hide, 220);
    });
    row.addEventListener('click', (e) => {
      e.preventDefault();
      pinned = !pinned;
      if (pinned) show(); else hide();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) { pinned = false; hide(); }
    });
    document.addEventListener('click', (e) => {
      if (!isOpen || !pinned) return;
      if (row.contains(e.target) || card.contains(e.target)) return;
      pinned = false; hide();
    });
  };

  build();
  wire();
  geo = window.FrameClock && window.FrameClock.geo();
  if (geo) { fill(); }
  window.addEventListener('shell:geo', (e) => {
    geo = e.detail;
    fill();
    if (isOpen) spin();
  });
})();
