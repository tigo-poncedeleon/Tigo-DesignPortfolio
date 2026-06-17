// Cursor-tracking "curved-plane" head.
// Maps the flat face cutout onto a gently domed plane (UVs stay 1:1, so the
// face never distorts) and tilts it toward the cursor, with a slow idle sway.
(function () {
  const canvas = document.getElementById('head-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  // Skip WebGL entirely on mobile — the static swaying face takes over there.
  if (window.matchMedia('(max-width: 1024px)').matches) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Tunable knobs -------------------------------------------------------
  const PLANE_H = 2.4;            // face height in world units
  const PLANE_W = PLANE_H * (930 / 1185); // match image aspect (~0.785)
  const CURVE = 0.12;             // dome depth (forward bulge)
  const TILT_Y = 0.6;             // left/right tilt range
  const TILT_X = 0.4;             // up/down tilt range
  const LERP = 0.06;              // rotation smoothing
  const IDLE_DELAY = 400;         // ms of stillness before idle sway begins
  // -------------------------------------------------------------------------

  // ---- Renderer / scene / camera ------------------------------------------
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  if ('outputEncoding' in renderer) renderer.outputEncoding = THREE.sRGBEncoding;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 3.2;

  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const dir = new THREE.DirectionalLight(0xffffff, 0.5);
  dir.position.set(2, 3, 4);
  scene.add(dir);

  // ---- Curved mesh ---------------------------------------------------------
  const geometry = new THREE.PlaneGeometry(PLANE_W, PLANE_H, 32, 32);
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    // center bulges toward the camera, edges fall away → gentle dome
    pos.setZ(i, -CURVE * (x * x + y * y));
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();

  const texture = new THREE.TextureLoader().load('Media/face_cutout.png', render);
  if ('encoding' in texture) texture.encoding = THREE.sRGBEncoding;

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.5,
    roughness: 1,
    metalness: 0,
  });

  const mesh = new THREE.Mesh(geometry, material);
  const headGroup = new THREE.Group();
  headGroup.add(mesh);
  scene.add(headGroup);

  // ---- Sizing --------------------------------------------------------------
  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    render();
  }
  window.addEventListener('resize', resize);

  function render() {
    renderer.render(scene, camera);
  }

  // ---- Reduced motion: one static, slightly-turned frame -------------------
  if (reduceMotion) {
    resize();
    headGroup.rotation.y = 0.1;
    render();
    return;
  }

  // ---- Cursor tracking + idle sway ----------------------------------------
  let targetRotX = 0;
  let targetRotY = 0;
  let lastMoveTime = -Infinity;

  window.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    const mx = (e.clientX - r.left) / r.width;
    const my = (e.clientY - r.top) / r.height;
    targetRotY = (mx - 0.5) * TILT_Y;
    targetRotX = (my - 0.5) * TILT_X;
    lastMoveTime = performance.now();
  });

  resize();

  function loop() {
    const now = performance.now();
    if (now - lastMoveTime > IDLE_DELAY) {
      const t = now / 1000;
      targetRotY = Math.sin(t * 0.7) * 0.12;
      targetRotX = Math.sin(t * 0.5) * 0.06;
    }
    headGroup.rotation.y += (targetRotY - headGroup.rotation.y) * LERP;
    headGroup.rotation.x += (targetRotX - headGroup.rotation.x) * LERP;
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
