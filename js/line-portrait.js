// Hedcut line-art head that turns toward the cursor in 3D.
//
// Two parts:
//   A) bakeTexture() renders Media/face_cutout.png as an ENGRAVING / hedcut to an
//      offscreen 2D canvas: roughly-horizontal lines whose THICKNESS encodes tone
//      (thick in dark areas, thinning to nothing on lit skin) for smooth,
//      photographic shading. Single ink colour (black in light mode, white in
//      dark mode) on a transparent ground; contrast is percentile-normalized so
//      skin reads light and hair/brows read dark.
//   B) A THREE.js curved "dome" plane uses that offscreen canvas as its texture and
//      rotates the head toward the cursor (with a gentle idle sway), exactly like
//      the previous head-tracker. The texture is static per theme, so only the
//      cheap rotation animates.
(function () {
  const canvas = document.getElementById('head-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const isMobile = window.matchMedia('(max-width: 1024px)').matches;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fallbackImg = document.querySelector('img.mobile-face');

  // ---- Tunable knobs -------------------------------------------------------
  const SRC = 'Media/face_cutout.png';
  const SRC_W = 930, SRC_H = 1185;     // source aspect
  const SAMPLE_W = 320;                // luminance sampling resolution (width)

  // Hedcut baker
  const TEX_W = 1024;                  // offscreen texture width
  const TEX_H = Math.round(TEX_W * (SRC_H / SRC_W));
  const N_LINES = 150;                 // engraving lines down the face
  const STEP = 2;                      // x stride along each line (tex px)
  const MIN_THICK = 0.7;               // line thickness on lightest skin (tex px)
  const MAX_THICK_FRAC = 0.92;         // darkest thickness as a fraction of spacing
  const WAVE_AMP = 0.8;                // gentle centreline wave amplitude (tex px)
  const WAVE_LEN = 26;                 // centreline wavelength (tex px)
  const ALPHA_CUTOFF = 0.35;           // silhouette membership threshold
  const TONE_GAMMA = 1.15;             // >1 keeps skin lighter, deepens darks
  const TONE_LOW_PCT = 0.04;           // percentile stretch of in-face darkness
  const TONE_HIGH_PCT = 0.97;

  // 3D head (ported from the old head-tracker)
  const PLANE_H = 2.4;
  const PLANE_W = PLANE_H * (SRC_W / SRC_H);
  const CURVE = 0.12;                  // forward dome bulge
  const TILT_Y = 0.6;                  // left/right look range
  const TILT_X = 0.4;                  // up/down look range
  const LERP = 0.06;                   // rotation smoothing
  const IDLE_DELAY = 400;              // ms of stillness before idle sway
  const IDLE_AMP_Y = 0.06;             // resting left/right drift (subtle, desktop)
  const IDLE_AMP_X = 0.03;             // resting up/down drift (subtle, desktop)
  const IDLE_SPEED_Y = 0.5;            // resting drift speed (y)
  const IDLE_SPEED_X = 0.4;            // resting drift speed (x)
  // Mobile has no cursor, so it sways back-and-forth like the original face-sway
  // (~±25° yaw, ~6s cycle). Desktop keeps the subtle idle drift above.
  const MOBILE_SWAY_AMP = 0.42;        // ±0.42 rad ≈ ±24° yaw
  const MOBILE_SWAY_SPEED = 1.05;      // ≈6s full cycle (2π / 1.05)
  // -------------------------------------------------------------------------

  // ---- Source sampling -----------------------------------------------------
  // raw[] = darkness (1 - luminance) per pixel; inside[] = silhouette mask.
  // toneLo/toneHi hold the percentile range used to normalize raw -> tone.
  let S = null;            // { w, h, raw:Float32Array, inside:Uint8Array, lo, hi }
  let srcImg = null;       // the loaded face image (for the opaque silhouette base)

  function buildSamples(img) {
    const w = SAMPLE_W;
    const h = Math.round(w * (SRC_H / SRC_W));
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    const octx = off.getContext('2d');
    octx.drawImage(img, 0, 0, w, h);
    const data = octx.getImageData(0, 0, w, h).data;

    const raw = new Float32Array(w * h);
    const inside = new Uint8Array(w * h);
    const insideVals = [];
    for (let i = 0, p = 0; i < w * h; i++, p += 4) {
      const a = data[p + 3] / 255;
      const lum = (0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) / 255;
      const d = 1 - lum;
      raw[i] = d;
      if (a > ALPHA_CUTOFF) { inside[i] = 1; insideVals.push(d); }
    }
    // percentile stretch over in-silhouette darkness for legible contrast
    insideVals.sort((a, b) => a - b);
    const lo = insideVals[Math.floor(insideVals.length * TONE_LOW_PCT)] || 0;
    const hi = insideVals[Math.floor(insideVals.length * TONE_HIGH_PCT)] || 1;
    S = { w, h, raw, inside, lo, hi: Math.max(hi, lo + 1e-3) };
  }

  function toneAt(u, v) {
    let x = (u * S.w) | 0, y = (v * S.h) | 0;
    if (x < 0) x = 0; else if (x >= S.w) x = S.w - 1;
    if (y < 0) y = 0; else if (y >= S.h) y = S.h - 1;
    const idx = y * S.w + x;
    if (!S.inside[idx]) return -1; // outside the face
    let t = (S.raw[idx] - S.lo) / (S.hi - S.lo);
    if (t < 0) t = 0; else if (t > 1) t = 1;
    return Math.pow(t, TONE_GAMMA);
  }

  // ---- Hedcut texture baker (offscreen 2D) ---------------------------------
  const off = document.createElement('canvas');
  off.width = TEX_W; off.height = TEX_H;
  const octx = off.getContext('2d');

  function inkColor() {
    return document.body.classList.contains('dark-mode') ? '#ffffff' : '#141414';
  }

  function bakeTexture() {
    octx.clearRect(0, 0, TEX_W, TEX_H);
    if (!S) return off; // samples not ready yet (first call at setup)
    const dark = document.body.classList.contains('dark-mode');

    // Opaque page-coloured silhouette base: fills the head shape with the page
    // background so the head OCCLUDES the cursor trail (the trail flows around the
    // head instead of punching through the airy gaps between lines). Looks
    // identical on the page since the fill matches the background colour.
    if (srcImg) {
      // Read the CSS custom property (not backgroundColor): vars flip instantly,
      // so we never sample the 0.3s background-color transition mid-fade.
      const bg = getComputedStyle(document.body).getPropertyValue('--bg-color').trim()
        || (dark ? '#000000' : '#ffffff');
      octx.save();
      octx.drawImage(srcImg, 0, 0, TEX_W, TEX_H); // stamp the alpha silhouette
      octx.globalCompositeOperation = 'source-in';
      octx.fillStyle = bg;
      octx.fillRect(0, 0, TEX_W, TEX_H);
      octx.restore();
    }

    octx.fillStyle = dark ? '#ffffff' : '#141414';

    const spacing = TEX_H / N_LINES;
    const maxThick = spacing * MAX_THICK_FRAC;
    const k = (2 * Math.PI) / WAVE_LEN;

    for (let li = 0; li < N_LINES; li++) {
      const baseY = (li + 0.5) * spacing;
      const v = (li + 0.5) / N_LINES;
      const phase = li * 0.9; // de-phase rows so waves don't align into bands
      let top = null, bot = null; // current ribbon edges

      const flush = () => {
        if (!top || top.length < 2) { top = bot = null; return; }
        octx.beginPath();
        octx.moveTo(top[0][0], top[0][1]);
        for (let i = 1; i < top.length; i++) octx.lineTo(top[i][0], top[i][1]);
        for (let i = bot.length - 1; i >= 0; i--) octx.lineTo(bot[i][0], bot[i][1]);
        octx.closePath();
        octx.fill();
        top = bot = null;
      };

      for (let x = 0; x <= TEX_W; x += STEP) {
        let t = toneAt(x / TEX_W, v);
        if (t < 0) { flush(); continue; }
        // In dark mode white ink draws the POSITIVE: lit skin gets thick ink,
        // hair recedes into black (kept faintly visible by MIN_THICK).
        if (dark) t = 1 - t;
        const cy = baseY + WAVE_AMP * Math.sin(x * k + phase);
        const half = (MIN_THICK + t * (maxThick - MIN_THICK)) / 2;
        if (!top) { top = []; bot = []; }
        top.push([x, cy - half]);
        bot.push([x, cy + half]);
      }
      flush();
    }
    return off;
  }

  // ---- THREE.js curved-plane head ------------------------------------------
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  if ('outputEncoding' in renderer) renderer.outputEncoding = THREE.sRGBEncoding;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 3.2;

  const geometry = new THREE.PlaneGeometry(PLANE_W, PLANE_H, 32, 32);
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    pos.setZ(i, -CURVE * (x * x + y * y)); // centre bulges toward camera
  }
  pos.needsUpdate = true;

  const texture = new THREE.CanvasTexture(bakeTexture());
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy
    ? renderer.capabilities.getMaxAnisotropy() : 1;
  if ('encoding' in texture) texture.encoding = THREE.sRGBEncoding;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.08,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  const headGroup = new THREE.Group();
  headGroup.add(mesh);
  scene.add(headGroup);

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    render();
  }
  function render() { renderer.render(scene, camera); }
  window.addEventListener('resize', resize);

  // re-bake when the theme flips so the ink colour follows
  new MutationObserver(() => {
    bakeTexture();
    texture.needsUpdate = true;
    render();
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  if (fallbackImg) fallbackImg.style.display = 'none';

  // ---- Reduced motion: one static, slightly-turned frame -------------------
  if (reduceMotion) {
    resize();
    headGroup.rotation.y = 0.12;
    render();
    return;
  }

  // ---- Look-at-cursor + idle sway ------------------------------------------
  let targetRotX = 0, targetRotY = 0;
  let lastMoveTime = -Infinity;

  if (!isMobile) {
    window.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      const mx = (e.clientX - r.left) / r.width;
      const my = (e.clientY - r.top) / r.height;
      targetRotY = (mx - 0.5) * TILT_Y;
      targetRotX = (my - 0.5) * TILT_X;
      lastMoveTime = performance.now();
    });
  }

  resize();

  function loop() {
    const now = performance.now();
    if (now - lastMoveTime > IDLE_DELAY) {
      const t = now / 1000;
      if (isMobile) {
        // pronounced back-and-forth sway (no cursor on touch devices)
        targetRotY = Math.sin(t * MOBILE_SWAY_SPEED) * MOBILE_SWAY_AMP;
        targetRotX = 0;
      } else {
        targetRotY = Math.sin(t * IDLE_SPEED_Y) * IDLE_AMP_Y;
        targetRotX = Math.sin(t * IDLE_SPEED_X) * IDLE_AMP_X;
      }
    }
    headGroup.rotation.y += (targetRotY - headGroup.rotation.y) * LERP;
    headGroup.rotation.x += (targetRotX - headGroup.rotation.x) * LERP;
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ---- Boot ----------------------------------------------------------------
  const img = new Image();
  img.onload = () => {
    srcImg = img;
    buildSamples(img);
    bakeTexture();
    texture.needsUpdate = true;
    render();
  };
  img.src = SRC;
})();
