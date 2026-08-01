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


  // ---- Coastlines, as [lon, lat] rings. Deliberately coarse: enough
  // vertices that each landmass is recognisable at 168px and no more, since
  // every point is projected and visibility-tested on every frame of the
  // spin. They go through exactly the same curve() machinery as the
  // graticule, so they clip at the limb rather than showing through.
  const LAND = [
    // North America
    [[-168,66],[-164,71],[-140,70],[-128,70],[-110,68],[-95,69],[-85,67],[-78,62],
     [-64,60],[-56,52],[-60,47],[-66,45],[-70,42],[-75,36],[-81,31],[-80,25],
     [-84,30],[-90,29],[-94,29],[-97,26],[-105,21],[-110,24],[-114,31],[-120,34],
     [-124,40],[-125,48],[-133,55],[-140,59],[-150,59],[-158,56],[-165,60],[-168,66]],
    // Central America + the isthmus
    [[-105,21],[-97,16],[-92,15],[-87,13],[-83,9],[-79,9],[-77,8],[-82,9],[-86,16],
     [-92,19],[-97,21],[-105,21]],
    // South America
    [[-77,8],[-75,11],[-71,12],[-62,10],[-52,5],[-50,0],[-44,-2],[-35,-6],[-39,-14],
     [-48,-25],[-53,-33],[-57,-38],[-62,-40],[-65,-45],[-68,-52],[-70,-55],[-75,-50],
     [-74,-44],[-73,-37],[-71,-30],[-70,-23],[-71,-18],[-76,-14],[-79,-8],[-81,-5],
     [-80,-2],[-78,1],[-77,8]],
    // Africa
    [[-17,15],[-16,21],[-12,28],[-6,33],[3,36],[11,34],[20,32],[26,32],[32,31],
     [35,24],[38,18],[43,12],[51,12],[48,5],[42,-1],[40,-10],[36,-18],[33,-26],
     [26,-34],[18,-34],[13,-23],[12,-16],[10,-5],[9,4],[3,6],[-4,5],[-8,5],
     [-13,9],[-17,15]],
    // Eurasia
    [[-10,36],[-9,44],[-1,46],[2,51],[8,54],[10,58],[19,55],[21,60],[25,65],[29,70],
     [40,68],[55,68],[68,72],[80,73],[95,76],[110,74],[128,73],[142,72],[160,70],
     [170,68],[180,66],[172,60],[163,59],[155,52],[143,49],[135,44],[130,38],
     [122,31],[118,24],[110,20],[105,10],[100,4],[97,10],[92,21],[88,22],[80,15],
     [77,8],[73,17],[68,23],[62,25],[57,25],[50,29],[48,30],[44,38],[40,41],
     [36,36],[30,37],[23,38],[16,40],[12,45],[6,43],[-2,40],[-6,37],[-10,36]],
    // Arabia
    [[35,24],[38,18],[43,12],[51,12],[57,23],[50,29],[44,29],[40,28],[35,24]],
    // India
    [[68,23],[73,17],[77,8],[80,15],[88,22],[80,22],[72,22],[68,23]],
    // Australia
    [[114,-22],[113,-27],[116,-34],[124,-33],[132,-32],[137,-35],[141,-38],[147,-38],
     [151,-34],[153,-28],[152,-24],[146,-19],[142,-11],[136,-12],[130,-12],[126,-14],
     [121,-18],[114,-22]],
    // Greenland
    [[-45,60],[-52,64],[-54,69],[-58,73],[-52,77],[-42,81],[-28,83],[-19,80],
     [-22,74],[-30,68],[-38,64],[-45,60]],
    // Antarctica — a coarse coastal ring, mostly below the horizon at this tilt
    [[-180,-78],[-150,-76],[-120,-74],[-90,-73],[-70,-70],[-60,-63],[-45,-72],
     [-20,-71],[0,-70],[25,-69],[50,-67],[75,-67],[100,-66],[125,-66],[150,-72],
     [170,-78],[-180,-78]],
    // British Isles
    [[-5,50],[-6,54],[-3,58],[-2,57],[0,54],[1,51],[-5,50]],
    // Japan
    [[130,31],[132,34],[136,35],[141,40],[145,44],[142,45],[140,41],[136,37],
     [133,34],[130,31]],
    // Madagascar
    [[44,-12],[49,-15],[50,-22],[47,-25],[44,-21],[43,-16],[44,-12]],
    // New Zealand
    [[173,-35],[178,-38],[176,-41],[172,-43],[167,-46],[166,-45],[171,-41],[173,-35]],
  ];

  // a ring is just another parametric curve, so it clips at the limb for free
  const ring = (pts) => (t) => {
    const i = Math.min(pts.length - 1, Math.floor(t * (pts.length - 1)));
    const j = Math.min(pts.length - 1, i + 1);
    const f = t * (pts.length - 1) - i;
    const a = vec(pts[i][1], pts[i][0]);
    const b = vec(pts[j][1], pts[j][0]);
    const v = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f,
               a[2] + (b[2] - a[2]) * f];
    const m = Math.hypot(v[0], v[1], v[2]) || 1;   // back onto the sphere
    return [v[0] / m, v[1] / m, v[2] / m];
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
        '<path class="globe-land" id="globe-land" d="" />' +
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
    let land = '';
    LAND.forEach((pts) => {
      land += ' ' + curve(ring(pts), 0, 1, Math.max(40, pts.length * 3), B);
    });
    card.querySelector('#globe-land').setAttribute('d', land.trim());

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
