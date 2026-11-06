// This is the old site's js/vicino-canvas.js (archive/v2-live-portfolio/js/vicino-canvas.js),
// copied unchanged but for one thing: the board's four media files are looked
// for under assets/case/vicino/canvas/ rather than the old site's Media/, so
// canvas.html, which sits at the site's root, finds them.
// The Vicino canvas, in miniature — a working model of the node editor I
// redesigned and shipped, rebuilt dependency-free and dressed in the SAME
// design: every color, radius, and shadow below is read off the shipped
// pulse-overrides.css and component CSS (Figma file klO85PJ5lYH4Vl8dB1lgZb,
// frame 113:219 "Canvas — Pulse Redesign"), and the chrome anatomy mirrors
// /pulse-preview — the backend-free route the real redesign was verified on.
//
// It runs in two places off the same file: as a LIVE TILE on the case
// study (a finished board — every result already generated, the clip
// looping, the mesh turning; the tile is a plain link), and full-window
// on canvas.html, which is what that link opens in a new tab. The page
// it lands in calls setTheater(true) to hand the board the input.
//
// The interaction contract is the shipped one:
//   · scroll pans (free); ⌘/ctrl+scroll zooms toward the cursor, deltas
//     rAF-batched; pinch zooms; clamp 0.1–4; the dot grid hides on move
//   · lasso = FULL containment; ≤5px click deselects; the bbox obeys the
//     Miro contract (drag inside moves, shift-lasso passes through)
//   · the properties panel opens for ONE node, never during multi-select
//   · right-DRAG pans, right-CLICK menus (travel distance decides)
//   · run = Kahn stages; statuses walk queued → running → validating →
//     done, the ladder the backend paints onto real boards
(() => {
  const root = document.getElementById('vc');
  if (!root) return;
  const reduceMotion =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ============================================================
  // the vocabulary — node types, real model ids and the shipped port
  // colors (light-theme handle pills). An edge is drawn in the color
  // of what it carries, so it reads as one piece with the ports at
  // either end: purple for text, cyan for an image.
  // ============================================================
  const PORT_COLOR = {
    text: '#9b9cf1', image: '#8bd6d9', video: '#ffb366', model3d: '#7cc0e8',
  };
  const PORT_GLOW = {
    text: 'rgba(155,156,241,0.4)', image: 'rgba(139,214,217,0.4)',
    video: 'rgba(255,179,102,0.4)', model3d: 'rgba(124,192,232,0.4)',
  };
  const MODELS = {
    image: ['flux-2-pro', 'gpt-image-2', 'ideogram-v3', 'recraft-v4'],
    video: ['veo3.1', 'kling3.0', 'seedance2.0'],
    model3d: ['tripo-3.0', 'meshy-5', 'rodin-gen2'],
  };
  // ---- live: the same board, run for real (the board name's menu) ----
  // Null on the open site, where every run is simulated. Choosing Live
  // Run in the menu under the board's name asks canvas.html for the
  // password; once the relay takes it, canvas.html hands over
  // vicino-live.js's calls through setLive. From then on the board is a
  // blank, working canvas: nodes are made, wired and run for real, and
  // liveArt keeps what came back, by node id, so an undo that rebuilds a
  // node can show it again. The model menus keep the shipped board's
  // names; vicino-live.js maps each to the model behind it. There is no
  // 3D model behind them, so a 3D node is not offered in a live run.
  let LIVE = null;
  let liveHandler = null;                // canvas.html's way in; none in a frame
  const liveArt = new Map();             // node id → {kind, blob, url, model, prompt}
  // everything a live run has generated, newest last, kept apart from
  // the nodes: a node that runs again, or is deleted, lets go of its own
  // result, but the Asset Library still holds every picture and clip
  // this session made
  const made = [];
  const runsLive = (n) => TYPES[n.type].runs && n.type !== 'model3d';
  // how long a result is expected to take, for the progress hairline: it
  // eases toward 85% over this long and waits there for the real answer
  const LIVE_EXPECT_MS = { image: 14000, video: 90000 };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  // node footprints at the REAL board's scale (its starter drops a
  // 360-wide text prompt; media cards run 300-380) — the chrome keeps
  // its true pixel sizes, so the chrome:node proportion is the ship's
  const TYPES = {
    text: {
      name: 'Text Prompt', w: 360, h: 252, runs: false, cost: 0,
      inputs: [], outputs: [{ key: 'output', type: 'text' }],
    },
    image: {
      name: 'Image', w: 320, h: 340, runs: true, dur: 1500, cost: 4,
      inputs: [{ key: 'prompt', type: 'text' }, { key: 'image', type: 'image' }],
      outputs: [{ key: 'output', type: 'image' }],
    },
    video: {
      name: 'Video', w: 380, h: 368, runs: true, dur: 2100, cost: 25,
      inputs: [{ key: 'prompt', type: 'text' }, { key: 'firstFrame', type: 'image', max: 1 },
        { key: 'refs', type: 'image' }],
      outputs: [{ key: 'output', type: 'video' }],
    },
    model3d: {
      name: '3D Model', w: 340, h: 340, runs: true, dur: 1800, cost: 12,
      inputs: [{ key: 'prompt', type: 'text' }, { key: 'image', type: 'image', max: 1 }],
      outputs: [{ key: 'output', type: 'model3d' }],
    },
  };
  const GRID = 10;                       // the board's snap grid
  const DOT_GAP = 50;                    // the sparse dot background
  const MIN_Z = 0.1, MAX_Z = 4;          // the shipped zoom clamp
  const CLICK_PX = 5;                    // ≤5px is a click, not a drag
  const PORT_R = 24;                     // handle hit area — port snap reach
  const RANK_GAP = 80, NODE_GAP = 60;    // auto-arrange: dagre's numbers
  const PORT_TOP = 64;                   // first handle: header 48 + 16
  const PORT_STEP = 36;                  // secondary handle at 100

  // ---- state ----
  let nodes = [];   // {id,type,x,y,prompt,model,aspect,dur,res,status,el}
  let edges = [];   // {id,from:{n,port},to:{n,port},type,running}
  let groups = [];  // {id,label,members:[ids]}
  const view = { x: 0, y: 0, z: 1 };
  let mode = 'select';
  let engaged = false;                   // true only inside the theater
  let running = false;
  let nid = 0, eid = 0, gid = 0;

  // ============================================================
  // undo — whole-graph snapshots, pushed BEFORE structural change
  // ============================================================
  const past = [], future = [];
  const snapshot = () => JSON.stringify({
    nodes: nodes.map((n) => ({ id: n.id, type: n.type, x: n.x, y: n.y,
      prompt: n.prompt, model: n.model, aspect: n.aspect, dur: n.dur,
      res: n.res, status: n.status })),
    edges: edges.map((e) => ({ id: e.id, from: e.from, to: e.to, type: e.type })),
    groups: groups.map((g) => ({ id: g.id, label: g.label, members: [...g.members] })),
  });
  const push = () => {
    past.push(snapshot());
    if (past.length > 50) past.shift();
    future.length = 0;
    paintToolbar();
  };
  const restore = (json) => {
    const s = JSON.parse(json);
    closeMenu();
    nodes.forEach((n) => n.el.remove());
    nodes = [];
    edges = [];
    groups = (s.groups || []).map((g) => ({ id: g.id, label: g.label, members: [...g.members] }));
    s.nodes.forEach((n) => addNode(n.type, n.x, n.y, !LIVE ? n : Object.assign({}, n, {
      status: pending.has(n.id) ? 'running' : liveArt.has(n.id) ? 'done' : 'idle',
    })));
    s.edges.forEach((e) => edges.push({ id: e.id, from: e.from, to: e.to, type: e.type }));
    edgeSig = '';
    drawEdges();
    drawGroups();
    setSel([]);
    paintToolbar();
    paintCost();
    watchEmpty();
  };
  const undo = () => {
    if (!past.length || running) return;
    future.push(snapshot());
    restore(past.pop());
  };
  const redo = () => {
    if (!future.length || running) return;
    past.push(snapshot());
    restore(future.pop());
  };

  // ============================================================
  // the DOM — the /pulse-preview chrome: brand floats top-left,
  // pills float top-right, the action toolbar floats top-center,
  // the create rail left, viewport toolbar bottom-center, the
  // minimap bottom-LEFT, the properties panel right.
  // ============================================================
  const icon = (d, fill) => '<svg viewBox="0 0 16 16"' +
    (fill ? ' class="is-fill"' : '') + '>' + d + '</svg>';
  const GLYPH = {
    // the four node glyphs, drawn for this board: a T beside a text
    // caret (a prompt is something typed), a frame with its sun and
    // ridge, a frame with a play mark, and a cube seen from above
    text: '<path d="M2.75 4.25h7.5M6.5 4.25v8.5M5 12.75h3"/><path d="M12.75 7.25v5.5M11.9 7.25h1.7M11.9 12.75h1.7"/>',
    image: '<rect x="2.25" y="2.75" width="11.5" height="10.5" rx="2.25"/><circle cx="5.9" cy="6.3" r="1.1"/><path d="M2.6 11.4 5.9 8.6a.9.9 0 0 1 1.15 0l1.75 1.5 1.3-1a.9.9 0 0 1 1.1.02l2.4 1.9"/>',
    video: '<rect x="2.25" y="3.25" width="11.5" height="9.5" rx="2.25"/><path d="M6.6 6.1v3.8l3.1-1.9Z" fill="currentColor"/>',
    model3d: '<path d="M8 2.25 13.25 5.1v5.8L8 13.75 2.75 10.9V5.1Z"/><path d="M2.9 5.2 8 8l5.1-2.8M8 8v5.6"/>',
    cursor: '<path d="M4.2 2.4 L12 8.2 L8.4 8.9 L10.3 12.9 L8.6 13.7 L6.7 9.7 L4.2 12 Z"/>',
    move: '<path d="M8 2 V14 M2 8 H14 M8 2 L6.2 3.8 M8 2 L9.8 3.8 M8 14 L6.2 12.2 M8 14 L9.8 12.2 M2 8 L3.8 6.2 M2 8 L3.8 9.8 M14 8 L12.2 6.2 M14 8 L12.2 9.8"/>',
    undo: '<path d="M6.5 3.5 L3 7 L6.5 10.5 M3 7 H10 a3 3 0 0 1 0 6 H7.5"/>',
    redo: '<path d="M9.5 3.5 L13 7 L9.5 10.5 M13 7 H6 a3 3 0 0 0 0 6 H8.5"/>',
    zoomout: '<circle cx="7" cy="7" r="4.4"/><path d="M10.3 10.3 L13.6 13.6 M5 7 H9"/>',
    zoomin: '<circle cx="7" cy="7" r="4.4"/><path d="M10.3 10.3 L13.6 13.6 M5 7 H9 M7 5 V9"/>',
    fit: '<path d="M9.5 2.5 H13.5 V6.5 M13.5 2.5 L9.2 6.8 M6.5 13.5 H2.5 V9.5 M2.5 13.5 L6.8 9.2"/>',
    play: '<path d="M5.2 3.6 L12 8 L5.2 12.4 Z"/>',
    plus: '<path d="M8 3 V13 M3 8 H13"/>',
    spark: '<path d="M8 2.5 L9.3 6.7 L13.5 8 L9.3 9.3 L8 13.5 L6.7 9.3 L2.5 8 L6.7 6.7 Z"/>',
    layout: '<rect x="2.5" y="2.5" width="4.4" height="4.4" rx="1.2"/><rect x="2.5" y="9.1" width="4.4" height="4.4" rx="1.2"/><rect x="9.1" y="5.8" width="4.4" height="4.4" rx="1.2"/><path d="M6.9 4.7 H8 L9.1 7.2 M6.9 11.3 H8 L9.1 8.8"/>',
    dup: '<rect x="5.5" y="5.5" width="8" height="8" rx="1.8"/><path d="M3 10.5 V4 a1.5 1.5 0 0 1 1.5-1.5 H11"/>',
    copy: '<rect x="5.5" y="5.5" width="8" height="8" rx="1.8"/><path d="M3 10.5 V4 a1.5 1.5 0 0 1 1.5-1.5 H11"/>',
    trash: '<path d="M3 4.5 H13 M6.5 4.5 V3 H9.5 V4.5 M4.5 4.5 L5.2 13 H10.8 L11.5 4.5 M6.8 7 V10.7 M9.2 7 V10.7"/>',
    share: '<circle cx="4.5" cy="8" r="1.9"/><circle cx="11.5" cy="4" r="1.9"/><circle cx="11.5" cy="12" r="1.9"/><path d="M6.2 7.2 L9.8 4.9 M6.2 8.8 L9.8 11.1"/>',
    publish: '<path d="M8 10.5 V3 M5.2 5.6 L8 2.8 L10.8 5.6 M3 10.5 V12 a1.5 1.5 0 0 0 1.5 1.5 H11.5 A1.5 1.5 0 0 0 13 12 V10.5"/>',
    bolt: '<path d="M8.8 2.5 L4.5 9 H7.5 L7.2 13.5 L11.5 7 H8.5 Z"/>',
    map: '<path d="M2.5 4.2 L6.2 2.8 L9.8 4.2 L13.5 2.8 V11.8 L9.8 13.2 L6.2 11.8 L2.5 13.2 Z M6.2 2.8 V11.8 M9.8 4.2 V13.2"/>',
    globe: '<circle cx="8" cy="8" r="5.6"/><path d="M2.4 8 H13.6 M8 2.4 C10.2 4.4, 10.2 11.6, 8 13.6 M8 2.4 C5.8 4.4, 5.8 11.6, 8 13.6"/>',
    x: '<path d="M4 4 L12 12 M12 4 L4 12"/>',
    pencil: '<path d="M3 13 L3.6 10.4 L10.8 3.2 a1.3 1.3 0 0 1 1.9 1.9 L5.6 12.4 Z M9.9 4.1 L11.9 6.1"/>',
    chev: '<path d="M4.5 6.5 L8 10 L11.5 6.5"/>',
    check: '<path d="M3.5 8.5 L6.6 11.5 L12.5 4.5"/>',
    upload: '<path d="M8 11 V3.5 M5 6.5 L8 3.5 L11 6.5 M3 11.5 V12.5 a1 1 0 0 0 1 1 H12 a1 1 0 0 0 1-1 V11.5"/>',
    logo: '<path d="M4.5 20.5 V13.5 L11 17 Z"/><path d="M21.5 5.5 V12.5 L15 9 Z"/><path d="M4.5 13.5 L21.5 5.5"/><path d="M4.5 20.5 L21.5 12.5"/>',
  };
  root.innerHTML =
    '<div class="vc-viewport" id="vc-viewport">' +
      '<div class="vc-world" id="vc-world">' +
        '<div class="vc-groups" id="vc-groups"></div>' +
        '<svg class="vc-edges" id="vc-edges" aria-hidden="true"></svg>' +
        '<div class="vc-bbox" id="vc-bbox" hidden></div>' +
      '</div>' +
      '<div class="vc-lasso" id="vc-lasso" hidden></div>' +
    '</div>' +
    // ---- brand, floating top-left on the canvas. The board's name is a
    // button: its menu switches between the test run (simulated) and a
    // live run (real, behind the password) ----
    '<button type="button" class="vc-brand" id="vc-brand" aria-haspopup="menu">' +
      '<svg class="vc-logo" viewBox="0 0 26 26" aria-hidden="true">' + GLYPH.logo + '</svg>' +
      '<svg class="vc-live-mark" viewBox="0 0 16 16" fill="none" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">' +
        '<circle cx="8" cy="8" r="1.7"/><path class="a1" d="M5.4 5.4a3.7 3.7 0 0 0 0 5.2M10.6 5.4a3.7 3.7 0 0 1 0 5.2"/>' +
        '<path class="a2" d="M3.3 3.3a6.6 6.6 0 0 0 0 9.4M12.7 3.3a6.6 6.6 0 0 1 0 9.4"/></svg>' +
      '<span class="vc-board">Test run</span>' +
      '<svg class="vc-brand-chev" viewBox="0 0 16 16" aria-hidden="true">' + GLYPH.chev + '</svg>' +
    '</button>' +
    // ---- pills, floating top-right ----
    '<div class="vc-pills">' +
      '<button type="button" class="vc-pill" data-fake="share">' + icon(GLYPH.share) + 'Share</button>' +
      '<button type="button" class="vc-pill" data-fake="publish">' + icon(GLYPH.publish) + 'Publish</button>' +
      '<button type="button" class="vc-pill is-credits" id="vc-cost" title="Estimated cost, as the real board totals it">' +
        icon(GLYPH.bolt) + '<span id="vc-cost-n">0</span></button>' +
      '<button type="button" class="vc-pill is-run" id="vc-run">' + icon(GLYPH.play, 1) + '<span>Run</span></button>' +
    '</div>' +
    // (the shipped board floats an action toolbar top-center — every verb
    // on it is a second copy of the right-click menu's, and with nothing
    // selected it is a pill that says "Please select a node". Here the
    // menu and the node's own play chip carry those verbs alone.)
    // ---- the create rail, left — the shipped column: Create, AI
    // Workflow Builder, Asset Library, Community, Auto Arrange, then
    // the divider and the profile initial ----
    // the glyphs here are LeftSidebarToolbar.jsx's own SVGs, carried over
    // verbatim (stroke attrs on the children so the shared .vc svg rule
    // can't thin them out)
    '<div class="vc-rail" role="toolbar" aria-label="Create">' +
      '<button type="button" class="vc-rail-add" id="vc-rail-add" title="Create">' +
        '<svg viewBox="0 0 20 20" aria-hidden="true">' +
          '<line x1="3" y1="10" x2="17" y2="10" stroke-width="2.8" />' +
          '<line x1="10" y1="17" x2="10" y2="3" stroke-width="2.8" /></svg></button>' +
      '<button type="button" class="vc-rail-agent" id="vc-rail-agent" title="AI Workflow Builder">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
          '<path stroke-width="2" d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />' +
          '<path stroke-width="2" d="M5 3v4" /><path stroke-width="2" d="M19 17v4" />' +
          '<path stroke-width="2" d="M3 5h4" /><path stroke-width="2" d="M17 19h4" /></svg></button>' +
      '<button type="button" class="vc-railbtn" id="vc-rail-assets" title="Asset Library">' +
        '<svg viewBox="0 0 22 25" aria-hidden="true">' +
          '<path stroke-width="2" d="M11 24L21 18.25V6.75L11 1L1 6.75V18.25L11 24ZM11 24V13.2188M11 13.2188L1.61806 7.46875M11 13.2188L20.3819 7.46875" /></svg></button>' +
      '<button type="button" class="vc-railbtn" id="vc-rail-community" title="Community">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
          '<circle cx="12" cy="12" r="9" stroke-width="2" />' +
          '<path stroke-width="2" d="M3 12h18M12 3c3 3 4.5 7 4.5 9s-1.5 6-4.5 9c-3-3-4.5-7-4.5-9s1.5-6 4.5-9z" /></svg></button>' +
      '<button type="button" class="vc-railbtn" id="vc-arrange" title="Auto Arrange Nodes">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
          '<rect width="18" height="7" x="3" y="3" rx="1" stroke-width="2" />' +
          '<rect width="9" height="7" x="3" y="14" rx="1" stroke-width="2" />' +
          '<rect width="5" height="7" x="16" y="14" rx="1" stroke-width="2" /></svg></button>' +
      '<span class="vc-rail-sep2" aria-hidden="true"></span>' +
      '<span class="vc-rail-avatar" title="User Profile" aria-hidden="true">V</span>' +
    '</div>' +
    // ---- the viewport toolbar, bottom-center — ViewportToolbar.jsx's
    // own glyphs verbatim (stroke attrs on children, the rail pattern) ----
    '<div class="vc-toolbar" role="toolbar" aria-label="Canvas tools">' +
      '<button type="button" class="vc-tool is-on" id="vc-select" title="Select — V">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path stroke-width="2" d="M5 3L19 12L12 13L9 20L5 3Z" /></svg></button>' +
      '<button type="button" class="vc-tool" id="vc-hand" title="Drag — H">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path stroke-width="2" d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" /></svg></button>' +
      '<span class="vc-sep"></span>' +
      '<button type="button" class="vc-tool" id="vc-undo" title="Undo — ⌘Z">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path stroke-width="2" d="M3 10H16C18.7614 10 21 12.2386 21 15C21 17.7614 18.7614 20 16 20H12" /><path stroke-width="2" d="M7 6L3 10L7 14" /></svg></button>' +
      '<button type="button" class="vc-tool" id="vc-redo" title="Redo — ⌘⇧Z">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path stroke-width="2" d="M21 10H8C5.23858 10 3 12.2386 3 15C3 17.7614 5.23858 20 8 20H12" /><path stroke-width="2" d="M17 6L21 10L17 14" /></svg></button>' +
      '<span class="vc-sep"></span>' +
      '<button type="button" class="vc-zoom" id="vc-zoom" aria-haspopup="menu">100% ' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path stroke-width="2" d="M6 9L12 15L18 9" /></svg></button>' +
      '<span class="vc-sep"></span>' +
      '<button type="button" class="vc-tool" id="vc-zout" title="Zoom out">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><circle stroke-width="2" cx="11" cy="11" r="7" /><path stroke-width="2" d="M21 21L16.65 16.65" /><path stroke-width="2" d="M8 11H14" /></svg></button>' +
      '<button type="button" class="vc-tool" id="vc-zin" title="Zoom in">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><circle stroke-width="2" cx="11" cy="11" r="7" /><path stroke-width="2" d="M21 21L16.65 16.65" /><path stroke-width="2" d="M11 8V14" /><path stroke-width="2" d="M8 11H14" /></svg></button>' +
      '<span class="vc-sep"></span>' +
      '<button type="button" class="vc-tool" id="vc-fit" title="Zoom to fit — ⌘0">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path stroke-width="2" d="M15 3H21V9" /><path stroke-width="2" d="M9 21H3V15" /><path stroke-width="2" d="M21 3L14 10" /><path stroke-width="2" d="M3 21L10 14" /></svg></button>' +
    '</div>' +
    '<div class="vc-zoommenu" id="vc-zoommenu" role="menu" hidden>' +
      '<button type="button" data-z="fit">Zoom to Fit</button>' +
      '<span class="vc-zoommenu-sep" aria-hidden="true"></span>' +
      '<button type="button" data-z="1">100%</button>' +
    '</div>' +
    // ---- the minimap, bottom-LEFT (Figma 144:1274; 186×112 well) ----
    '<div class="vc-map" id="vc-map">' +
      '<svg id="vc-map-svg" viewBox="0 0 184 110" preserveAspectRatio="none" aria-hidden="true"></svg>' +
      '<div class="vc-map-box" id="vc-map-box" aria-hidden="true"></div>' +
      '<button type="button" class="vc-map-hide" id="vc-map-hide" aria-label="Hide minimap">' +
        '<svg viewBox="0 0 12 12" aria-hidden="true"><path stroke-width="1.5" d="M3 3L9 9M9 3L3 9" /></svg></button>' +
    '</div>' +
    '<button type="button" class="vc-map-collapsed" id="vc-map-open" aria-label="Show minimap" hidden>' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path stroke-width="2" d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.895l4.553-2.277a2 2 0 0 1 1.788 0z" /><path stroke-width="2" d="M15 5.764v15" /><path stroke-width="2" d="M9 3.236v15" /></svg></button>' +
    // ---- the properties panel, right (Figma 144:1298) ----
    '<aside class="vc-panel" id="vc-panel" aria-label="Node properties" hidden></aside>' +
    // ---- confirm bar: bulk deletes ask first ----
    '<div class="vc-confirm" id="vc-confirm" hidden>' +
      '<span id="vc-confirm-msg"></span>' +
      '<button type="button" class="is-danger" id="vc-confirm-yes">Delete</button>' +
      '<button type="button" id="vc-confirm-no">Cancel</button>' +
    '</div>' +
    // ---- the workflow agent panel, beside the rail (Figma 140:511) ----
    // ---- the AI Workflow Builder: a column docked into the board's left
    // edge — the canvas gives up the room — where a short conversation
    // ends in nodes on the canvas ----
    '<aside class="vc-chat" id="vc-chat" aria-label="AI Workflow Builder">' +
      '<header class="vc-chat-head">' +
        // the same spark as the rail button that opens the panel — the
        // product's own sign for its agent, small, in ink, on nothing
        '<svg class="vc-chat-glyph" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
          '<path stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>' +
        '<span class="vc-chat-titles"><strong>AI Workflow Builder</strong></span>' +
        '<button type="button" class="vc-chat-tool" id="vc-chat-new" title="New conversation" aria-label="New conversation">' +
          '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M7.5 2.75H4.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h7.5a1.5 1.5 0 0 0 1.5-1.5V8.5"/><path d="M11.6 2.4a1.3 1.3 0 0 1 1.85 1.85L8.2 9.5l-2.45.6.6-2.45Z"/></svg></button>' +
        '<button type="button" class="vc-chat-tool" id="vc-chat-x" title="Close" aria-label="Close">' +
          '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg></button>' +
      '</header>' +
      '<div class="vc-chat-scroll" id="vc-chat-scroll">' +
        '<div class="vc-chat-log" id="vc-chat-log"></div>' +
        // empty, the panel is the canvas's own ground, and the question
        // with four ways in rests on the input
        '<section class="vc-chat-hero" id="vc-chat-hero">' +
          '<h3>What are you making?</h3>' +
          '<div class="vc-chat-ideas" id="vc-chat-suggest">' +
            '<button type="button" data-q="A product video of a red running shoe: a clean studio hero shot, then the shoe turning slowly under soft light"><span>Product video of a sneaker</span>' + '<svg class="vc-idea-go" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8h9M9 4.5 12.5 8 9 11.5"/></svg>' + '</button>' +
            '<button type="button" data-q="Three looks for a sneaker ad poster from one brief: minimal, street and retro"><span>Three ad poster looks</span>' + '<svg class="vc-idea-go" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8h9M9 4.5 12.5 8 9 11.5"/></svg>' + '</button>' +
            '<button type="button" data-q="A dreamy shot of a lighthouse at dusk with golden light and rolling waves, then the same scene in motion"><span>Lighthouse at dusk, in motion</span>' + '<svg class="vc-idea-go" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8h9M9 4.5 12.5 8 9 11.5"/></svg>' + '</button>' +
            '<button type="button" data-q="Blend a misty alpine lake and a neon night market into one cinematic image"><span>Blend a lake and a night market</span>' + '<svg class="vc-idea-go" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8h9M9 4.5 12.5 8 9 11.5"/></svg>' + '</button>' +
          '</div>' +
        '</section>' +
      '</div>' +
      '<div class="vc-chat-foot">' +
        '<form class="vc-chat-form" id="vc-chat-form">' +
          '<textarea id="vc-chat-in" rows="2" placeholder="Describe the result you want" autocomplete="off"></textarea>' +
          '<div class="vc-chat-bar">' +
            '<div class="vc-chat-context" id="vc-chat-context" hidden></div>' +
            '<button type="submit" aria-label="Send" disabled><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 12.5V3.5M4 7.5l4-4 4 4"/></svg></button>' +
          '</div>' +
        '</form>' +
      '</div>' +
    '</aside>' +
    // ---- the Asset Library: the same dock, the media made with Vicino ----
    '<aside class="vc-lib" id="vc-lib" aria-label="Asset Library">' +
      '<header class="vc-chat-head">' +
        '<svg class="vc-chat-glyph is-lib" viewBox="0 0 22 25" fill="none" aria-hidden="true">' +
          '<path stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M11 24L21 18.25V6.75L11 1L1 6.75V18.25L11 24ZM11 24V13.2188M11 13.2188L1.61806 7.46875M11 13.2188L20.3819 7.46875"/></svg>' +
        '<span class="vc-chat-titles"><strong>Asset Library</strong></span>' +
        '<button type="button" class="vc-chat-tool" id="vc-lib-x" title="Close" aria-label="Close">' +
          '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg></button>' +
      '</header>' +
      '<div class="vc-lib-bar">' +
        '<label class="vc-lib-search"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.4"/><path d="m10.3 10.3 3.2 3.2"/></svg>' +
          '<input type="text" id="vc-lib-q" placeholder="Search" autocomplete="off" /></label>' +
        '<div class="vc-lib-tabs" id="vc-lib-tabs"><button type="button" data-f="all" class="is-on">All</button>' +
          '<button type="button" data-f="image">Images</button><button type="button" data-f="video">Videos</button></div>' +
      '</div>' +
      '<div class="vc-lib-scroll" id="vc-lib-grid"></div>' +
    '</aside>' +
    // ---- the context menu ----
    '<div class="vc-menu" id="vc-menu" role="menu" hidden></div>' +
    // ---- the empty state. On the shipped board this is where you pick a
    // target and a pre-wired pair lands; here nothing mints nodes, so it
    // points at the one move that brings the demo back ----
    '<div class="vc-empty" id="vc-empty" hidden>' +
      '<p class="vc-empty-title">You deleted the board</p>' +
      '<p class="vc-empty-sub">building new nodes is decorative in this demo — ' +
        'undo (⌘Z) brings the graph back</p>' +
    '</div>';

  const $ = (id) => root.querySelector('#' + id);
  const viewport = $('vc-viewport');
  const world = $('vc-world');
  const groupLayer = $('vc-groups');
  const edgeSvg = $('vc-edges');
  const bboxEl = $('vc-bbox');
  const lassoEl = $('vc-lasso');
  const panel = $('vc-panel');
  const runBtn = $('vc-run');
  const zoomBtn = $('vc-zoom');
  const mapEl = $('vc-map');
  const mapSvg = $('vc-map-svg');
  const mapBox = $('vc-map-box');
  const menuEl = $('vc-menu');
  const confirmEl = $('vc-confirm');
  const emptyEl = $('vc-empty');
  const chat = $('vc-chat');

  // ---- coordinate math. The theater declares its zoom outright
  // (setStageScale) — no browser-dependent inference while it's open.
  // Parked, the rect/offsetWidth ratio still absorbs the seat's zoom,
  // but the parked board is pointer-events:none so it barely matters ----
  let stageScale = 0;
  const scaleOf = () =>
    stageScale || (viewport.getBoundingClientRect().width / viewport.offsetWidth) || 1;
  const toLocal = (e) => {
    const r = viewport.getBoundingClientRect();
    const s = scaleOf();
    return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s };
  };
  const toWorld = (p) => ({ x: (p.x - view.x) / view.z, y: (p.y - view.y) / view.z });
  const snap = (v) => Math.round(v / GRID) * GRID;

  const applyView = () => {
    world.style.transform =
      'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.z + ')';
    const g = DOT_GAP * view.z;
    viewport.style.backgroundSize = g + 'px ' + g + 'px';
    viewport.style.backgroundPosition = view.x + 'px ' + view.y + 'px';
    zoomBtn.firstChild.textContent = Math.round(view.z * 100) + '% ';
    paintMapBox();
  };
  // the grid hides while the view moves — a class + trailing timer
  let moveTimer = 0;
  const viewMoving = () => {
    root.classList.add('is-panning');
    clearTimeout(moveTimer);
    moveTimer = setTimeout(() => root.classList.remove('is-panning'), 100);
  };

  // ============================================================
  // the "generated" media. The two image nodes resolve to the two
  // reference frames the prompt is written against; the video node
  // resolves to the clip they were pulled from; the 3D node resolves
  // to a live wireframe reconstruction of the SECOND frame — the
  // one its image port is wired to.
  // ============================================================
  const MEDIA = {
    // seed parity picks which of the racing models "returned" which
    // frame — n2 (flux) the Southampton duel, n3 (ideogram) the City one
    image: ['assets/case/vicino/canvas/vi-canvas-out-1.webp', 'assets/case/vicino/canvas/vi-canvas-out-2.webp'],
    imageAlt: ['Generated frame: a winger shielding the ball past a defender',
      'Generated frame: a winger carrying the ball between two defenders'],
    clip: 'assets/case/vicino/canvas/vi-canvas-clip.webp',
    clipPoster: 'assets/case/vicino/canvas/vi-canvas-clip-poster.webp',
  };
  // the board opens ALREADY GENERATED — parked or full-window, every
  // result is on screen from the first frame — so the bytes are wanted
  // immediately and the result <img>s carry no loading="lazy": inside
  // the parked tile's scaled seat that only risks a well that never paints
  let warmed = false;
  const warmMedia = () => {
    if (warmed) return;
    warmed = true;
    MEDIA.image.concat([MEDIA.clip, MEDIA.clipPoster])
      .forEach((src) => { new Image().src = src; });
  };
  const ART = {
    image: (seed) =>
      '<img class="vc-photo" src="' + MEDIA.image[seed % 2] + '" alt="' +
      MEDIA.imageAlt[seed % 2] + '" decoding="async" draggable="false" />',
    // the video RESOLVES to the clip, looping the way the real node's
    // result does — parked in the tile too, because a video node that
    // sits on a still frame reads as another image node. A click parks
    // it on its poster; reduced motion never starts it at all (an
    // animated webp has no clock CSS can stop, so the source is the
    // only honest switch).
    video: (seed, node) =>
      '<div class="vc-gif" title="Click to view">' +
        '<img class="vc-clip" src="' +
          (reduceMotion ? MEDIA.clipPoster : MEDIA.clip) + '" data-clip="' +
          MEDIA.clip + '" alt="Generated clip: the ' +
          'same run, in motion" decoding="async" draggable="false" />' +
        '<img class="vc-clip-still" src="' + MEDIA.clipPoster + '" alt="" ' +
          'aria-hidden="true" decoding="async" draggable="false" />' +
        '<span class="vc-gif-strip" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>' +
        '<span class="vc-gif-chip">' + ((node && node.dur) || '6s') + ' &middot; loop</span>' +
      '</div>',
    // the 3D result is a REAL shaded model you can grab and spin — a live
    // turntable, not a still (spinInit below drives it). The floor and its
    // contact shadows are drawn in the same space as the mesh.
    model3d: (seed) => '<div class="vc-spin" title="Drag to spin">' +
      '<svg viewBox="0 0 200 120">' +
        '<defs>' +
          '<radialGradient id="vcfloor' + seed + '" cx="50%" cy="50%" r="50%">' +
            '<stop offset="0" stop-color="#dfe5ea"/>' +
            '<stop offset="1" stop-color="#dfe5ea" stop-opacity="0"/>' +
          '</radialGradient>' +
        '</defs>' +
        '<ellipse class="vc-spin-floor" cx="100" cy="99" rx="86" ry="15" ' +
          'fill="url(#vcfloor' + seed + ')"/>' +
        '<g class="vc-spin-cast"></g>' +
        '<g class="vc-spin-g" shape-rendering="geometricPrecision"></g>' +
      '</svg>' +
      '<span class="vc-spin-hint">drag to spin</span>' +
      '</div>',
  };
  // what a live run returned, in the same furniture as the simulated
  // results: the picture fills its well; the clip loops under the same
  // strip and chip, as a <video> (muted, since only a muted video may
  // start on its own), and a click pauses it as it pauses the webp
  const LIVE_ART = {
    image: (a) => '<img class="vc-photo" src="' + a.url + '" alt="' +
      esc(a.prompt ? 'Generated: ' + a.prompt : 'Generated picture') +
      '" decoding="async" draggable="false" />',
    video: (a, node) =>
      '<div class="vc-gif is-live' + (reduceMotion ? ' is-paused' : '') + '" title="Click to view">' +
        (a.anim ? '<img class="vc-clip" src="' + a.url + '" alt="' + esc(a.prompt || 'Clip') + '" draggable="false" />' : '<video class="vc-clip" src="' + a.url + '"' + (reduceMotion ? '' : ' autoplay') +
          ' loop muted playsinline aria-label="' +
          esc(a.prompt ? 'Generated clip: ' + a.prompt : 'Generated clip') + '"></video>') +
        '<span class="vc-gif-strip" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>' +
        '<span class="vc-gif-chip">' + esc((node && node.dur) || '6s') + ' &middot; loop</span>' +
      '</div>',
  };

  // ---- the turntables only turn while the board can be seen: offscreen
  // or in a hidden tab their rAF loops park themselves, and a waker
  // restarts whichever nodes are still on the board ----
  let boardVisible = true;
  const spinWakers = [];
  const wakeSpins = () => spinWakers.forEach((w) => w());
  const setBoardVisible = (v) => {
    if (boardVisible === v) return;
    boardVisible = v;
    if (v) wakeSpins();
  };
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) wakeSpins();
  });

  // ---- the scroll is sacred. While the reader is actually scrolling,
  // every self-running show in here holds its breath — the turntables
  // park and (via html.is-scrolling + a rule in vicino.css) every
  // infinite CSS animation in the stage pauses. The
  // scroll's raster budget comes first; a trailing 160ms of quiet ends
  // the hold and the shows pick up exactly where they stopped. ----
  let pageScrolling = false;
  let scrollIdleT = 0;
  window.addEventListener('scroll', () => {
    if (!pageScrolling) {
      pageScrolling = true;
      document.documentElement.classList.add('is-scrolling');
    }
    clearTimeout(scrollIdleT);
    scrollIdleT = setTimeout(() => {
      pageScrolling = false;
      document.documentElement.classList.remove('is-scrolling');
      wakeSpins();
    }, 160);
  }, { passive: true, capture: true });

  // ============================================================
  // the turntable — the SECOND reference frame, rebuilt as a SOLID
  // model. The 3D node's image port is wired to the image that
  // "returned" the City still, so the mesh is that still: three
  // players on one ground plane, the carrier driving between two
  // defenders with the ball at his lead foot.
  //
  // Everything is by hand and dependency-free, the way the rest of
  // this file is: skeletons are posed as joints, the joints are
  // skinned with tapered prisms, and each frame the whole thing is
  // rotated, back-face culled, depth-sorted and flat-shaded against
  // one key light. No library, no textures — just polygons that
  // catch the light, so the result reads as a render and not a
  // diagram. Grab it and it spins; every 3D node gets its own
  // camera. ============================================================
  const GROUND = -1.02;                  // the pitch, in model units
  // the light lives in CAMERA space, so the key stays put as the model
  // turns under it — a turntable in a studio, not a lamp on the mesh
  const LIGHT = (() => {
    const v = [-0.42, 0.78, 0.62];
    const m = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / m, v[1] / m, v[2] / m];
  })();
  // ---- materials, read off the still: Chelsea royal, City sky, and
  // the boots each player was actually wearing ----
  const MAT = {
    blueShirt: [30, 66, 168], blueShorts: [24, 52, 140], whiteSock: [238, 241, 246],
    skyShirt: [140, 199, 231], whiteShort: [240, 243, 247], skySock: [140, 199, 231],
    skinA: [216, 162, 122], skinB: [204, 150, 110], skinC: [198, 144, 104],
    hair: [44, 34, 28],
    bootLime: [212, 230, 72], bootDark: [38, 42, 50], bootMint: [86, 208, 176],
    ballLight: [246, 247, 250], ballDark: [26, 28, 34],
  };
  // ---- a mesh is a flat vertex list plus faces that index into it;
  // faces carry their own colour so one draw call order covers the
  // whole scene ----
  const addPrism = (M, a, b, ra, rb, sides, col) => {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const len = Math.hypot(d[0], d[1], d[2]) || 1e-6;
    d[0] /= len; d[1] /= len; d[2] /= len;
    // any reference that is not parallel to the bone gives us a frame
    const up = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let e1 = [d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2],
      d[0] * up[1] - d[1] * up[0]];
    const e1m = Math.hypot(e1[0], e1[1], e1[2]) || 1e-6;
    e1 = [e1[0] / e1m, e1[1] / e1m, e1[2] / e1m];
    const e2 = [d[1] * e1[2] - d[2] * e1[1], d[2] * e1[0] - d[0] * e1[2],
      d[0] * e1[1] - d[1] * e1[0]];
    const base = M.V.length;
    for (let k = 0; k < sides; k++) {
      const t = (k / sides) * Math.PI * 2;
      const c = Math.cos(t), s = Math.sin(t);
      M.V.push([a[0] + ra * (c * e1[0] + s * e2[0]),
                a[1] + ra * (c * e1[1] + s * e2[1]),
                a[2] + ra * (c * e1[2] + s * e2[2])]);
      M.V.push([b[0] + rb * (c * e1[0] + s * e2[0]),
                b[1] + rb * (c * e1[1] + s * e2[1]),
                b[2] + rb * (c * e1[2] + s * e2[2])]);
    }
    for (let k = 0; k < sides; k++) {
      const k2 = (k + 1) % sides;
      M.F.push({ i: [base + k * 2, base + k2 * 2, base + k2 * 2 + 1, base + k * 2 + 1], c: col });
    }
    // the caps, so a limb seen end-on is a solid and not a tube
    const capA = [], capB = [];
    for (let k = 0; k < sides; k++) { capA.push(base + k * 2); capB.push(base + k * 2 + 1); }
    M.F.push({ i: capA.slice().reverse(), c: col });
    M.F.push({ i: capB, c: col });
  };
  const PHI = (1 + Math.sqrt(5)) / 2;
  const ICO_V = [];
  [-1, 1].forEach((a) => [-PHI, PHI].forEach((b) => {
    ICO_V.push([0, a, b], [a, b, 0], [b, 0, a]);
  }));
  const ICO_F = (() => {                 // faces found once, by edge length,
    const f = [], n = ICO_V.length, e2 = 4.0001;   // then wound to face OUT
    const near = (i, j) => (ICO_V[i][0] - ICO_V[j][0]) ** 2 +
      (ICO_V[i][1] - ICO_V[j][1]) ** 2 + (ICO_V[i][2] - ICO_V[j][2]) ** 2 < e2;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
      if (!(near(i, j) && near(j, k) && near(i, k))) continue;
      const a = ICO_V[i], b = ICO_V[j], c = ICO_V[k];
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      // the solid is centred on the origin, so "outward" is just "along a"
      const dot = (u[1] * w[2] - u[2] * w[1]) * a[0] +
        (u[2] * w[0] - u[0] * w[2]) * a[1] + (u[0] * w[1] - u[1] * w[0]) * a[2];
      f.push(dot >= 0 ? [i, j, k] : [i, k, j]);
    }
    return f;
  })();
  const addIco = (M, c, r, col, pick) => {
    const base = M.V.length;
    const m = Math.sqrt(1 + PHI * PHI);
    ICO_V.forEach((v) => M.V.push([c[0] + v[0] * r / m, c[1] + v[1] * r / m, c[2] + v[2] * r / m]));
    ICO_F.forEach((f, idx) => {
      // the face's own centre, in the solid's space — enough to paint a
      // panel onto a ball or a head of hair onto a head
      const cy = (ICO_V[f[0]][1] + ICO_V[f[1]][1] + ICO_V[f[2]][1]) / 3 / m;
      const cz = (ICO_V[f[0]][2] + ICO_V[f[1]][2] + ICO_V[f[2]][2]) / 3 / m;
      M.F.push({ i: [base + f[0], base + f[1], base + f[2]],
        c: pick ? pick(idx, cy, cz) || col : col });
    });
  };
  // a head is ONE solid: the crown and the back of it wear the hair
  const addHead = (M, c, r, skin, hairCol) => addIco(M, c, r, skin,
    (idx, cy, cz) => ((cy > 0.22 || (cz < -0.45 && cy > -0.3)) ? hairCol : null));
  // ---- one player: a skeleton posed as joints, then skinned. The
  // pose IS the data — every figure below is the same eleven bones ----
  const addPlayer = (M, p) => {
    const K = p.joints;
    const put = (a, b, ra, rb, sides, col) => addPrism(M, K[a], K[b], ra, rb, sides, col);
    put('pelvis', 'chest', 0.23, 0.28, 6, p.shirt);         // torso
    put('chest', 'neck', 0.13, 0.11, 5, p.skin);            // neck
    put('shoulderL', 'elbowL', 0.115, 0.09, 5, p.shirt);    // sleeves…
    put('shoulderR', 'elbowR', 0.115, 0.09, 5, p.shirt);
    put('elbowL', 'wristL', 0.085, 0.065, 5, p.skin);       // …then bare arm
    put('elbowR', 'wristR', 0.085, 0.065, 5, p.skin);
    put('hipL', 'kneeL', 0.155, 0.115, 6, p.shorts);        // thighs
    put('hipR', 'kneeR', 0.155, 0.115, 6, p.shorts);
    put('kneeL', 'ankleL', 0.115, 0.075, 5, p.socks);       // shins
    put('kneeR', 'ankleR', 0.115, 0.075, 5, p.socks);
    put('ankleL', 'toeL', 0.08, 0.055, 4, p.boot);          // boots
    put('ankleR', 'toeR', 0.08, 0.055, 4, p.boot);
    addHead(M, K.head, 0.25, p.skin, MAT.hair);             // head and hair
  };
  // ---- the three poses of the still. Joints are authored in a local
  // space (hips at origin, +z out of the player's chest) and then
  // turned, leaned, rolled and set down on the pitch ----
  const POSE = (o) => {
    const J = {
      pelvis: [0, 0, 0], chest: [0, 0.60, 0.02], neck: [0, 0.80, 0.02],
      head: [0, 1.02, 0.03], hair: [0, 1.10, -0.01],
      shoulderL: [-0.30, 0.70, 0.01], shoulderR: [0.30, 0.70, 0.03],
      hipL: [-0.17, -0.02, 0], hipR: [0.17, -0.02, 0],
      elbowL: o.armL[0], wristL: o.armL[1], elbowR: o.armR[0], wristR: o.armR[1],
      kneeL: o.legL[0], ankleL: o.legL[1], toeL: o.legL[2],
      kneeR: o.legR[0], ankleR: o.legR[1], toeR: o.legR[2],
    };
    const ct = Math.cos(o.turn), st = Math.sin(o.turn);
    const cl = Math.cos(o.lean), sl = Math.sin(o.lean);
    const cr = Math.cos(o.roll || 0), sr = Math.sin(o.roll || 0);
    const out = {};
    Object.keys(J).forEach((k) => {
      const v = J[k];
      let x = v[0] * ct + v[2] * st;                 // turn to face the play,
      const z0 = -v[0] * st + v[2] * ct;
      let y = v[1] * cl - z0 * sl;                   // lean into it,
      const z = v[1] * sl + z0 * cl;
      const x2 = x * cr - y * sr;                    // roll off the shoulder,
      y = x * sr + y * cr;
      x = x2;
      out[k] = [o.x + x * o.s, y * o.s, o.z + z * o.s];   // and stand it down
    });
    return { joints: out, foot: [o.x, GROUND, o.z] };
  };
  const CAST = [
    // the trailing defender, upright and a stride behind
    Object.assign(POSE({
      x: -1.62, z: -0.62, s: 0.97, turn: -0.22, lean: 0.06,
      armL: [[-0.36, 0.42, 0.10], [-0.46, 0.18, 0.26]],
      armR: [[0.36, 0.42, -0.08], [0.46, 0.18, -0.24]],
      legL: [[-0.16, -0.50, -0.14], [-0.18, -0.94, -0.30], [-0.20, -1.02, -0.08]],
      legR: [[0.14, -0.50, 0.16], [0.16, -0.94, 0.34], [0.18, -1.02, 0.56]],
    }), { shirt: MAT.skyShirt, shorts: MAT.whiteShort, socks: MAT.skySock,
      skin: MAT.skinB, boot: MAT.bootDark }),
    // the carrier, mid-stride, lead foot arriving at the ball
    Object.assign(POSE({
      x: 0, z: 0.26, s: 1, turn: -0.16, lean: 0.15,
      armL: [[-0.34, 0.40, 0.22], [-0.30, 0.16, 0.46]],
      armR: [[0.38, 0.42, -0.16], [0.48, 0.20, -0.40]],
      legL: [[-0.18, -0.50, -0.20], [-0.24, -0.90, -0.46], [-0.26, -0.99, -0.24]],
      legR: [[0.16, -0.48, 0.30], [0.20, -0.92, 0.54], [0.22, -1.02, 0.76]],
    }), { shirt: MAT.blueShirt, shorts: MAT.blueShorts, socks: MAT.whiteSock,
      skin: MAT.skinA, boot: MAT.bootLime }),
    // the one lunging in, near arm reaching across the carrier
    Object.assign(POSE({
      x: 1.48, z: 0.04, s: 1, turn: 0.40, lean: 0.24, roll: -0.20,
      armL: [[-0.40, 0.50, 0.16], [-0.76, 0.42, 0.30]],
      armR: [[0.34, 0.38, -0.20], [0.30, 0.06, -0.42]],
      legL: [[-0.22, -0.48, 0.28], [-0.28, -0.92, 0.50], [-0.30, -1.02, 0.72]],
      legR: [[0.18, -0.52, -0.22], [0.24, -0.94, -0.48], [0.26, -1.02, -0.26]],
    }), { shirt: MAT.skyShirt, shorts: MAT.whiteShort, socks: MAT.skySock,
      skin: MAT.skinC, boot: MAT.bootMint }),
  ];
  const BALL = [0.26, GROUND + 0.15, 1.44];
  const spinInit = (n) => {
    const box = n.el.querySelector('.vc-spin');
    if (!box) return;
    const g = box.querySelector('.vc-spin-g');
    const cast = box.querySelector('.vc-spin-cast');
    const M = { V: [], F: [] };
    CAST.forEach((p) => addPlayer(M, p));
    // the ball: an icosphere with five dark panels, the way a match ball
    // reads at this size
    addIco(M, BALL, 0.15, MAT.ballLight,
      (idx) => ([0, 4, 8, 13, 17].indexOf(idx) >= 0 ? MAT.ballDark : null));
    const S = 38;                       // px per unit — the trio fits 200×120
    const CX = 100, CY = 61;
    let yaw = -0.55, pitch = -0.12, drag = null;
    let bobY = 0;                       // the run-bob: the whole frame rides it
    const polyPool = [];                // stable nodes; render() updates attrs
    const castPool = [];
    // camera space, kept unscaled and y-up so face normals stay honest —
    // the screen coords are derived from it as the polygons are emitted
    const Q = M.V.map(() => [0, 0, 0]);
    const render = () => {
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      for (let i = 0; i < M.V.length; i++) {
        const v = M.V[i];
        const x = v[0] * cy + v[2] * sy;
        const z0 = -v[0] * sy + v[2] * cy;
        Q[i][0] = x;
        Q[i][1] = v[1] * cp - z0 * sp;
        Q[i][2] = v[1] * sp + z0 * cp;
      }
      // every face is wound outward, so a normal pointing away from the
      // camera is a back face: cull it, then sort what is left back to front
      const vis = [];
      for (let f = 0; f < M.F.length; f++) {
        const idx = M.F[f].i;
        const a = Q[idx[0]], b = Q[idx[1]], c = Q[idx[2]];
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
        const wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
        const nz = ux * wy - uy * wx;
        if (nz <= 0) continue;
        const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz;
        const m = Math.hypot(nx, ny, nz) || 1e-6;
        let z = 0;
        for (let k = 0; k < idx.length; k++) z += Q[idx[k]][2];
        vis.push({ f: f, z: z / idx.length, nx: nx / m, ny: ny / m, nz: nz / m });
      }
      vis.sort((u, w) => u.z - w.z);
      // A stable pool of nodes, not innerHTML. The old string build tore
      // down and re-parsed ~170 polygons EVERY FRAME — parser, style,
      // layout and GC churn on the main thread, 60 times a second, for
      // as long as the chapter was on screen. Updating attributes on
      // kept elements paints the same picture without any of that.
      const NS = 'http://www.w3.org/2000/svg';
      for (let i = 0; i < vis.length; i++) {
        const it = vis[i], idx = M.F[it.f].i, col = M.F[it.f].c;
        let pts = '';
        for (let k = 0; k < idx.length; k++) {
          const q = Q[idx[k]];
          pts += (k ? ' ' : '') + (CX + q[0] * S).toFixed(1) + ',' +
            (CY + bobY - q[1] * S).toFixed(1);
        }
        const lam = Math.max(0, it.nx * LIGHT[0] + it.ny * LIGHT[1] + it.nz * LIGHT[2]);
        const bounce = 0.10 * Math.max(0, -it.ny);     // a little light off the pitch
        const k = Math.min(1.16, 0.40 + 0.66 * lam + bounce);
        const rgb = 'rgb(' + Math.min(255, Math.round(col[0] * k)) + ',' +
          Math.min(255, Math.round(col[1] * k)) + ',' +
          Math.min(255, Math.round(col[2] * k)) + ')';
        let el = polyPool[i];
        if (!el) {
          el = document.createElementNS(NS, 'polygon');
          // the hairline stroke closes the seams antialiasing leaves behind
          el.setAttribute('stroke-width', '0.35');
          polyPool[i] = el;
          g.appendChild(el);
        }
        el.setAttribute('points', pts);
        el.setAttribute('fill', rgb);
        el.setAttribute('stroke', rgb);
      }
      // cull the tail: an empty points list draws nothing
      for (let i = vis.length; i < polyPool.length; i++) {
        if (polyPool[i].getAttribute('points')) polyPool[i].setAttribute('points', '');
      }
      // contact shadows, one per player, pinned to where each stands
      for (let i = 0; i < CAST.length; i++) {
        const v = CAST[i].foot;
        const x = v[0] * cy + v[2] * sy;
        const z0 = -v[0] * sy + v[2] * cy;
        const y = v[1] * cp - z0 * sp;
        let el = castPool[i];
        if (!el) {
          el = document.createElementNS(NS, 'ellipse');
          el.setAttribute('ry', '3.8');
          el.setAttribute('fill', 'rgb(24,38,52)');
          castPool[i] = el;
          cast.appendChild(el);
        }
        // the shadow stays on the ground and tightens as the run lifts
        el.setAttribute('cx', (CX + x * S).toFixed(1));
        el.setAttribute('cy', (CY - y * S).toFixed(1));
        el.setAttribute('rx', (15 + bobY * 0.5).toFixed(1));
        el.setAttribute('fill-opacity', (0.18 + bobY * 0.008).toFixed(3));
      }
    };
    let looping = false;
    let phase = 0;
    let skip = false;                  // the idle turn runs at half rate
    const loop = () => {
      if (!box.isConnected) { looping = false; return; }   // the node left the board
      if (!boardVisible || document.hidden) { looping = false; return; }
      // reduced motion parks the pose entirely — the old loop kept
      // scheduling empty frames forever, pinning the pipeline awake
      if (reduceMotion) { looping = false; return; }
      // while the reader scrolls, the turntable yields the whole raster
      // budget — the scroll-idle waker (wakeSpins) restarts it
      if (pageScrolling && !drag) { looping = false; return; }
      if (!drag && (skip = !skip)) {   // ~30fps is plenty for an idle turn
        yaw += 0.016;
        phase += 0.12;
        bobY = -Math.abs(Math.sin(phase)) * 4;   // a runner's bob, not a bounce
        render();
      }
      requestAnimationFrame(loop);
    };
    const wake = () => {
      if (looping || !box.isConnected) return;
      looping = true;
      requestAnimationFrame(loop);
    };
    spinWakers.push(wake);
    box.addEventListener('pointerdown', (ev) => {
      ev.stopPropagation();                     // the model spins, not the node
      drag = { x: ev.clientX, y: ev.clientY };
      box.classList.add('is-held');
      try { box.setPointerCapture(ev.pointerId); } catch (err) { /* fine */ }
    });
    box.addEventListener('pointermove', (ev) => {
      if (!drag) return;
      // client px → board px, or the turntable spins faster the smaller
      // the theater's zoom happens to be
      const s = scaleOf();
      yaw += ((ev.clientX - drag.x) / s) * 0.012;
      pitch = Math.max(-1.35, Math.min(1.35, pitch + ((ev.clientY - drag.y) / s) * 0.012));
      drag = { x: ev.clientX, y: ev.clientY };
      render();
    });
    const release = () => { drag = null; box.classList.remove('is-held'); };
    box.addEventListener('pointerup', release);
    box.addEventListener('pointercancel', release);
    render();
    wake();
  };

  // ============================================================
  // nodes — the DS card: 16px shell, 12px well, 48px header with
  // no bottom rule, the cyan model badge, the header play chip
  // ============================================================
  // ---- ports are slots, not fixed places. A node's left edge shows one
  // handle per wire plugged into it, and nothing else — no empty sockets
  // dangling there. Its right edge shows one handle per wire leaving it,
  // and below them one free handle; use it, and a fresh one slides in
  // under it, so an output can always be used once more. Any number of
  // prompts and pictures can feed one node; only a video's first frame
  // and a 3D model's picture are one thing by nature. ----
  const eNum = (e) => +String(e.id).slice(1) || 0;
  const inOrder = (n) => {
    const keys = TYPES[n.type].inputs.map((p) => p.key);
    return edges.filter((e) => e.to.n === n.id)
      .sort((a, b) => (keys.indexOf(a.to.port) - keys.indexOf(b.to.port)) || (eNum(a) - eNum(b)));
  };
  const outOrder = (n) => edges.filter((e) => e.from.n === n.id).sort((a, b) => eNum(a) - eNum(b));
  // slots keep the shipped 36px step until they would run off the card,
  // then close up so every one stays on it
  const slotY = (n, i, count) => {
    const room = TYPES[n.type].h - PORT_TOP - 30;
    const step = count > 1 ? Math.min(PORT_STEP, room / (count - 1)) : PORT_STEP;
    return PORT_TOP + i * step;
  };
  const endPos = (e, isOut) => {
    const n = nodeById(isOut ? e.from.n : e.to.n);
    if (isOut) {
      const list = outOrder(n);
      return { x: n.x + TYPES[n.type].w, y: n.y + slotY(n, list.indexOf(e), list.length + 1) };
    }
    const list = inOrder(n);
    return { x: n.x, y: n.y + slotY(n, list.indexOf(e), list.length) };
  };
  const freeOutPos = (n) => {
    const c = outOrder(n).length;
    return { x: n.x + TYPES[n.type].w, y: n.y + slotY(n, c, c + 1) };
  };
  const nextInPos = (n) => {
    const c = inOrder(n).length;
    return { x: n.x, y: n.y + slotY(n, c, c + 1) };
  };
  const portPos = (node, portKey, isOut) => (isOut ? freeOutPos(node) : nextInPos(node));
  const inLabel = (n, e, list) => {
    if (e.type === 'text') {
      const t = list.filter((x) => x.type === 'text');
      return t.length > 1 ? 'Prompt ' + (t.indexOf(e) + 1) : 'Prompt';
    }
    if (e.to.port === 'firstFrame') return 'First frame';
    if (n.type === 'model3d') return 'Image';
    const r = list.filter((x) => x.type === 'image' && x.to.port !== 'firstFrame');
    return r.length > 1 ? 'Reference ' + (r.indexOf(e) + 1) : 'Reference';
  };
  // the handles, redrawn when the wires on a node change; returns
  // whether they did
  const paintPorts = (n) => {
    const ins = inOrder(n), outs = outOrder(n);
    const sig = ins.map((e) => e.id).join() + '|' + outs.map((e) => e.id).join();
    if (n._ports === sig) return false;
    const grew = n._outs != null && outs.length > n._outs;
    n._ports = sig;
    n._outs = outs.length;
    n.el.querySelectorAll('.vc-port').forEach((p) => p.remove());
    const outType = TYPES[n.type].outputs[0].type;
    const add = (side, type, y, label, edgeId, cls) => {
      const sp = document.createElement('span');
      sp.className = 'vc-port is-' + side + ' ' + cls;
      sp.dataset.port = side === 'out' ? 'output' : '';
      if (edgeId) sp.dataset.edge = edgeId;
      sp.style.top = y - 14 + 'px';
      sp.style.setProperty('--pc', PORT_COLOR[type]);
      sp.style.setProperty('--pg', PORT_GLOW[type]);
      sp.innerHTML = '<span class="vc-port-label">' + label + '</span>';
      n.el.appendChild(sp);
    };
    ins.forEach((e, i) => add('in', e.type, slotY(n, i, ins.length), inLabel(n, e, ins), e.id, 'is-wired'));
    outs.forEach((e, i) => add('out', outType, slotY(n, i, outs.length + 1), 'Connected', e.id, 'is-wired'));
    add('out', outType, slotY(n, outs.length, outs.length + 1),
      outs.length ? 'Connect another' : 'Drag to connect', null, 'is-free' + (grew ? ' is-new' : ''));
    return true;
  };
  const nodeH = (n) => TYPES[n.type].h;
  const nodeById = (id) => nodes.find((n) => n.id === id);

  const bodyFor = (node) => {
    if (node.type === 'text') {
      // a real <textarea>, not an editable <div>: dictation (Wispr Flow,
      // the Mac's own), autofill and screen readers all write into native
      // fields through the accessibility API, and an editable <div> gives
      // them a field whose placeholder reads as its text and whose caret
      // they cannot place — so the words they paste go nowhere
      return '<textarea class="vc-prompt" spellcheck="false" autocomplete="off" ' +
        'aria-label="Prompt text" placeholder="Describe what to make…">' +
        esc(node.prompt) + '</textarea>';
    }
    return '<div class="vc-well">' + emptyWell(node) + '</div>';
  };
  // An empty well says what pressing Run will do: simulate, on the open
  // site; ask the named Gemini model, live. Live, a 3D node says plainly
  // that it will not run, rather than waiting for a Run that skips it.
  const wellCopy = (hint, sub) =>
    '<span class="vc-well-glyph">' + icon(GLYPH.upload) + '</span>' +
    '<span class="vc-well-hint">' + hint + '</span>' +
    '<span class="vc-well-sub">' + sub + '</span>';
  // the card's run button: one ink pill — a play mark and the word — with
  // the model and the cost set quietly under it
  const PLAY = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3.9v8.2a.6.6 0 0 0 .9.5l6.6-4.1a.6.6 0 0 0 0-1L6.4 3.4a.6.6 0 0 0-.9.5z" fill="currentColor" stroke="none"/></svg>';
  const playWell = (node, sub) => '<button type="button" class="vc-well-play" aria-label="Generate">' +
    '<span class="vc-gen-btn">' + PLAY + 'Generate</span><span class="vc-gen-meta">' + sub + '</span></button>';
  // while it works: a turning ring, the word, the model and a clock
  const busyCopy = (hint, sub) => '<span class="vc-busy-ring" aria-hidden="true"></span>' +
    '<span class="vc-well-hint">' + hint + '</span><span class="vc-well-sub is-clock">' + sub + '</span>';
  // ---- what a node draws from, shown on it: a chip for its prompts and
  // a thumbnail per picture wired in — the first frame marked, a reference
  // not yet made shown as its glyph — so a node fed by several others
  // reads as fed by them ----
  const artSrc = (id) => {
    const a = liveArt.get(id);
    if (a && a.kind === 'image') return a.url;
    const m = nodeById(id);
    if (m && !LIVE && m.type === 'image' && m.status === 'done') return MEDIA.image[(+String(id).slice(1) || 0) % 2];
    return null;
  };
  const inputsStrip = (n, cls) => {
    const ins = inOrder(n);
    if (!ins.length) return '';
    const texts = ins.filter((e) => e.type === 'text');
    const pics = ins.filter((e) => e.type === 'image');
    const thumb = (e) => {
      const src = artSrc(e.from.n);
      const first = e.to.port === 'firstFrame';
      return '<span class="vc-in-thumb' + (first ? ' is-first' : '') + (src ? '' : ' is-pending') + '" title="' +
        (first ? 'First frame' : 'Reference') + '">' + (src ? '<img src="' + src + '" alt="" draggable="false" />'
        : icon(GLYPH.image)) + '</span>';
    };
    const words = texts.length === 1 ? ((nodeById(texts[0].from.n) || {}).prompt || '').trim() : '';
    const said = texts.length > 1 ? texts.length + ' prompts' : words
      ? '“' + esc(words.length > 26 ? words.slice(0, 25).trim() + '…' : words) + '”' : 'Empty prompt';
    return '<div class="vc-inputs ' + (cls || '') + '">' +
      (cls === 'is-ready' ? '<span class="vc-in-label">Inputs</span>' : '') +
      (texts.length ? '<span class="vc-in-chip' + (texts.length === 1 && !words ? ' is-empty' : '') + '">' +
        '<span class="vc-in-glyph">' + icon(GLYPH.text) + '</span>' + said + '</span>' : '') +
      pics.slice(0, 5).map(thumb).join('') +
      (pics.length > 5 ? '<span class="vc-in-more">+' + (pics.length - 5) + '</span>' : '') +
      '</div>';
  };
  const WAITING = { image: ['Waiting for a prompt', 'Drag a wire from a Text Prompt onto this card — add pictures to draw from'],
    video: ['Waiting for a prompt or a first frame', 'Drag a wire from a Text Prompt or an Image onto this card'],
    model3d: ['Waiting for an image', 'Drag a wire from an Image onto this card'] };
  // the well, empty: what feeds it along the top, Generate in the middle;
  // with nothing feeding it, it waits, and says how to feed it; queued
  // or generating, it says so
  const emptyWell = (node) => {
    if (LIVE && node.type === 'model3d') return wellCopy('Not live', '3D isn’t part of live runs');
    if (node.status === 'queued') return busyCopy('Queued', 'waits for what feeds it');
    if (node.status === 'running' || node.status === 'validating') {
      return busyCopy(node.type === 'video' ? 'Making the clip…' : 'Generating…', esc(node.model));
    }
    if (!inOrder(node).length) {
      const w = WAITING[node.type] || ['Waiting for an input', ''];
      return '<div class="vc-idle"><span class="vc-idle-tile">' + icon(GLYPH[node.type]) + '</span>' +
        '<strong>' + w[0] + '</strong><span>' + w[1] + '</span></div>';
    }
    const cost = nodeCost(node) + ' credit' + (nodeCost(node) === 1 ? '' : 's');
    return inputsStrip(node, 'is-ready') + playWell(node, esc(node.model) + ' &middot; ' + cost);
  };

  const addNode = (type, x, y, saved) => {
    const t = TYPES[type];
    const node = {
      id: saved ? saved.id : 'n' + (++nid),
      type: type,
      x: snap(x), y: snap(y),
      prompt: saved && saved.prompt != null ? saved.prompt : LIVE ? '' :
        'Eden Hazard dribbling by defenders with remarkable ease and grace',
      model: (saved && saved.model) || (MODELS[type] || [null])[0],
      aspect: (saved && saved.aspect) || '16:9',
      dur: (saved && saved.dur) || '6s',
      res: (saved && saved.res) || '720p',
      status: saved ? saved.status : 'idle',
      sel: false,
    };
    nid = Math.max(nid, +String(node.id).slice(1) || 0);

    const el = document.createElement('article');
    el.className = 'vc-node is-' + type;
    el.dataset.id = node.id;
    el.style.width = t.w + 'px';
    el.innerHTML =
      '<header class="vc-head">' +
        '<button type="button" class="vc-type" data-act="retype" title="Change node type" aria-label="Change node type">' +
          '<span class="vc-head-icon">' + icon(GLYPH[type]) + '</span>' +
          '<span class="vc-name">' + t.name + '</span>' +
          '<svg class="vc-type-chev" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 6.5 8 9.5 11 6.5"/></svg>' +
        '</button>' +
        (node.model ? '<span class="vc-badge">' + node.model + '</span>' : '') +
      '</header>' +
      '<div class="vc-body">' + bodyFor(node) + '</div>' +
      '<span class="vc-bar" aria-hidden="true"><i></i></span>';

    node.el = el;
    // ports: 10×28 pills, radius 6, white ring, colored fill + glow —
    // half tucked under the card edge, the way the shipped handles sit
    paintPorts(node);
    world.appendChild(el);
    place(node);
    paintStatus(node);
    if (saved && saved.status === 'done') revealArt(node);
    nodes.push(node);
    return node;
  };

  const place = (n) => {
    n.el.style.transform = 'translate(' + n.x + 'px,' + n.y + 'px)';
  };
  const paintStatus = (n) => {
    n.el.classList.toggle('is-queued', n.status === 'queued');
    n.el.classList.toggle('is-running', n.status === 'running');
    n.el.classList.toggle('is-validating', n.status === 'validating');
    n.el.classList.toggle('is-done', n.status === 'done');
    n.el.classList.toggle('is-failed', n.status === 'failed');
  };
  const paintModel = (n) => {
    const chip = n.el.querySelector('.vc-badge');
    if (chip && n.model) chip.textContent = n.model;
  };
  const revealArt = (n) => {
    if (n.type === 'text') return;
    const well = n.el.querySelector('.vc-well');
    if (LIVE) {
      // live, a node shows only what Gemini returned for it; a node that
      // has nothing yet (or a 3D node) keeps its empty well
      const a = liveArt.get(n.id);
      if (!a) return clearArt(n);
      well.removeAttribute('title');
      well.innerHTML = LIVE_ART[a.kind](a, n) + inputsStrip(n, 'is-made');
      well.classList.add('has-art');
      return;
    }
    well.innerHTML = ART[n.type](+String(n.id).slice(1), n) + inputsStrip(n, 'is-made');
    well.classList.add('has-art');
    if (n.type === 'model3d') spinInit(n);
  };
  const clearArt = (n) => {
    if (n.type === 'text') return;
    const well = n.el.querySelector('.vc-well');
    well.classList.remove('has-art');
    well.removeAttribute('title');
    well.innerHTML = emptyWell(n);
  };
  // live: the well while Gemini works, with the model's name and a clock,
  // so a room watching a minute-long clip can see it is still coming
  const workingWell = (n, started) => {
    const well = n.el.querySelector('.vc-well');
    const sub = well.querySelector('.vc-well-sub.is-clock');
    const s = Math.floor((Date.now() - started) / 1000);
    const clock = esc(n.model) + ' &middot; ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    if (sub) { sub.innerHTML = clock; return; }
    well.classList.remove('has-art');
    well.removeAttribute('title');
    well.innerHTML = busyCopy(n.type === 'video' ? 'Making the clip…' : 'Generating…', clock);
  };
  // live: a node Gemini refused, or that could not reach it, says why in
  // its own well; its play chip comes back, so it can be run again
  const failedWell = (n, message) => {
    const well = n.el.querySelector('.vc-well');
    well.classList.remove('has-art');
    const text = String(message || 'Something went wrong');
    well.innerHTML = wellCopy('Couldn’t generate',
      esc(text.length > 150 ? text.slice(0, 147) + '…' : text));
    well.title = text;
  };

  const removeNodes = (list) => {
    const ids = new Set(list.map((n) => n.id));
    edges = edges.filter((e) => !ids.has(e.from.n) && !ids.has(e.to.n));
    list.forEach((n) => n.el.remove());
    nodes = nodes.filter((n) => !ids.has(n.id));
    groups.forEach((g) => { g.members = g.members.filter((m) => !ids.has(m)); });
    groups = groups.filter((g) => g.members.length > 1);
    setSel([]);
    drawEdges();
    drawGroups();
    paintCost();
    watchEmpty();
  };

  // ============================================================
  // edges — soft purple beziers (the redesign's one connection
  // color); an endpoint's selection turns them cyan; running
  // edges stream a cyan dash
  // ============================================================
  const edgePath = (e) => {
    const a = endPos(e, true);
    const b = endPos(e, false);
    const c = Math.max(46, Math.abs(b.x - a.x) * 0.5);
    return { d: 'M' + a.x + ' ' + a.y + ' C' + (a.x + c) + ' ' + a.y + ',' +
      (b.x - c) + ' ' + b.y + ',' + b.x + ' ' + b.y,
      mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  };
  let ghost = '';
  let edgeSig = '';
  const drawEdges = () => {
    // a node drag redraws edges every pointermove; when only geometry
    // changed (same edges, same states, no ghost wire) the existing
    // elements are re-pointed instead of reparsing innerHTML each frame
    const sig = ghost ? '' : edges.map((e) =>
      e.id + (e.running ? 'r' : '') +
      ((nodeById(e.from.n).sel || nodeById(e.to.n).sel) ? 'h' : '')).join('|');
    if (sig && sig === edgeSig && edgeSvg.childElementCount === edges.length) {
      for (let i = 0; i < edges.length; i++) {
        const g = edgeSvg.children[i];
        const p = edgePath(edges[i]);
        g.children[0].setAttribute('d', p.d);
        g.children[1].setAttribute('d', p.d);
        g.children[2].setAttribute('transform', 'translate(' + p.mx + ' ' + p.my + ')');
      }
      return;
    }
    edgeSig = sig;
    // the wires changed: each node's handles follow, and a node waiting
    // to run shows what now feeds it
    nodes.forEach((n) => {
      if (paintPorts(n) && !n.el.querySelector('.vc-well.has-art') &&
        !['queued', 'running', 'validating'].includes(n.status)) clearArt(n);
    });
    edgeSvg.innerHTML = edges.map((e) => {
      const p = edgePath(e);
      const hot = nodeById(e.from.n).sel || nodeById(e.to.n).sel;
      return '<g class="vc-edge' + (e.running ? ' is-running' : '') +
        (hot ? ' is-hot' : '') + '" data-id="' + e.id +
        '" style="--ec:' + PORT_COLOR[e.type] + '">' +
        '<path class="vc-edge-hit" d="' + p.d + '"/>' +
        '<path class="vc-edge-line" d="' + p.d + '"/>' +
        '<g class="vc-edge-x" data-del="' + e.id + '" transform="translate(' + p.mx + ' ' + p.my + ')">' +
          '<circle r="8"/><path d="M-3 -3 L3 3 M3 -3 L-3 3"/>' +
        '</g></g>';
    }).join('') + ghost;
  };

  // the input a wire lands in, from what it carries: words on the
  // prompt, a picture on a video's first frame (then its references), a
  // picture on an image's references
  const autoPort = (to, type) => {
    if (type === 'image' && to.type === 'video') {
      return edges.some((e) => e.to.n === to.id && e.to.port === 'firstFrame') ? 'refs' : 'firstFrame';
    }
    return (TYPES[to.type].inputs.find((i) => i.type === type) || {}).key || null;
  };
  // does a wire's start lie downstream of where it would end (a loop)?
  const feeds = (from, goal) => {
    const seen = new Set();
    const walk = (id) => {
      if (id === goal) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      return edges.some((e) => e.from.n === id && walk(e.to.n));
    };
    return walk(from);
  };
  const MAX_REFS = 10;
  const connect = (fromNode, toNode, toPort, silent) => {
    const type = TYPES[fromNode.type].outputs[0].type;
    if (fromNode === toNode) return false;
    const key = toPort || autoPort(toNode, type);
    const spec = TYPES[toNode.type].inputs.find((i) => i.key === key);
    if (!spec || spec.type !== type) return false;
    if (edges.some((e) => e.from.n === fromNode.id && e.to.n === toNode.id)) return false;
    if (feeds(toNode.id, fromNode.id)) {
      if (!silent) toast('That wire would make a loop');
      return false;
    }
    const already = edges.filter((e) => e.to.n === toNode.id && e.to.port === key);
    if (!spec.max && spec.type === 'image' && already.length >= MAX_REFS) {
      if (!silent) toast('Up to ' + MAX_REFS + ' reference images feed one node');
      return false;
    }
    if (!silent) push();
    // a one-picture input swaps its wire for the new one
    if (spec.max && already.length >= spec.max) edges = edges.filter((e) => !already.includes(e));
    edges.push({ id: 'e' + (++eid), type: type,
      from: { n: fromNode.id, port: 'output' }, to: { n: toNode.id, port: key } });
    drawEdges();
    return true;
  };

  // a quiet slip of a message over the board (limits, decorative pills)
  let toastEl = null, toastTimer = 0;
  const toast = (msg) => {
    if (!toastEl) {
      toastEl = document.createElement('p');
      toastEl.className = 'vc-toast';
      root.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 2400);
  };

  // ============================================================
  // groups — a labeled plate behind its members
  // ============================================================
  const groupOf = (id) => groups.find((g) => g.members.includes(id));
  const groupBBox = (g) => {
    const mem = g.members.map(nodeById).filter(Boolean);
    const x1 = Math.min(...mem.map((n) => n.x)) - 24;
    const y1 = Math.min(...mem.map((n) => n.y)) - 44;
    const x2 = Math.max(...mem.map((n) => n.x + TYPES[n.type].w)) + 24;
    const y2 = Math.max(...mem.map((n) => n.y + nodeH(n))) + 24;
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  };
  const drawGroups = () => {
    groupLayer.innerHTML = groups.map((g) => {
      const b = groupBBox(g);
      return '<div class="vc-group" data-gid="' + g.id + '" style="transform:translate(' +
        b.x + 'px,' + b.y + 'px);width:' + b.w + 'px;height:' + b.h + 'px">' +
        '<span class="vc-group-tag">' + g.label + '</span></div>';
    }).join('');
  };
  const createGroup = () => {
    const sel = selected();
    if (sel.length < 2 || sel.some((n) => groupOf(n.id))) return;
    push();
    groups.push({ id: 'g' + (++gid), label: 'Group ' + gid,
      members: sel.map((n) => n.id) });
    setSel([]);
    drawGroups();
  };
  const ungroup = (g) => {
    push();
    groups = groups.filter((x) => x !== g);
    drawGroups();
  };

  // ============================================================
  // selection — the shipped contract: the bbox, the cyan endpoints,
  // and the panel that opens for ONE node and never for two
  // ============================================================
  const selected = () => nodes.filter((n) => n.sel);
  const setSel = (list) => {
    nodes.forEach((n) => {
      n.sel = list.includes(n);
      n.el.classList.toggle('is-sel', n.sel);
    });
    paintSelection();
    drawEdges();                        // selected endpoints turn edges cyan
  };

  let selSig = '';
  const paintSelection = () => {
    const sel = selected();
    root.dispatchEvent(new Event('vc-selection'));
    if (sel.length > 1) {
      const x1 = Math.min(...sel.map((n) => n.x)) - 14;
      const y1 = Math.min(...sel.map((n) => n.y)) - 14;
      const x2 = Math.max(...sel.map((n) => n.x + TYPES[n.type].w)) + 14;
      const y2 = Math.max(...sel.map((n) => n.y + nodeH(n))) + 14;
      bboxEl.hidden = false;
      bboxEl.style.transform = 'translate(' + x1 + 'px,' + y1 + 'px)';
      bboxEl.style.width = x2 - x1 + 'px';
      bboxEl.style.height = y2 - y1 + 'px';
    } else {
      bboxEl.hidden = true;
    }
    // dragging repaints per pointermove, but WHO is selected only changes
    // between gestures — the panel rebuilds only on membership
    // (running rides the signature: its disabled states must not go stale)
    const sig = (running ? 'R|' : '') + sel.map((n) => n.id).join('|');
    if (sig !== selSig) {
      selSig = sig;
      // the properties panel: ONE node opens it; two closes it — the rule
      // the Cypress suite pins ("multi-select does NOT open the panel")
      if (sel.length === 1) openPanel(sel[0]);
      else closePanel();
    }
    paintMap();
  };

  // ============================================================
  // the properties panel — the shipped card: title row, eyebrow,
  // uppercase section labels, dropdown controls, segmented rows,
  // the cyan toggle, TOTAL COST, and the black Generate pill
  // ============================================================
  const seg = (label, key, opts, cur) =>
    '<p class="vc-p-label">' + label + '</p>' +
    '<div class="vc-p-seg" data-key="' + key + '">' +
      opts.map((o) => '<button type="button" data-v="' + o + '"' +
        (o === cur ? ' class="is-on"' : '') + '>' + o + '</button>').join('') +
    '</div>';
  const drop = (label, key, cur) =>
    '<p class="vc-p-label">' + label + '</p>' +
    '<button type="button" class="vc-p-drop" data-drop="' + key + '">' +
      '<span>' + cur + '</span><svg viewBox="0 0 16 16" aria-hidden="true">' + GLYPH.chev + '</svg></button>';
  const nodeCost = (n) => {
    if (!TYPES[n.type].runs) return 0;
    let c = TYPES[n.type].cost;
    if (n.type === 'video' && n.res === '1080p') c += 10;
    if (n.type === 'video' && n.res === '4k') c += 20;
    if (n.type === 'video' && n.dur === '8s') c += 5;
    return c;
  };
  const paintCost = () => {
    $('vc-cost-n').textContent = nodes.reduce((a, n) => a + nodeCost(n), 0);
  };
  let panelFor = null;
  const openPanel = (n) => {
    panelFor = n;
    const t = TYPES[n.type];
    let h = '<header class="vc-p-title"><span>' +
      (n.prompt && n.type === 'text' ? 'Prompt' : t.name) + '</span>' +
      '<svg viewBox="0 0 16 16" aria-hidden="true">' + GLYPH.pencil + '</svg></header>' +
      '<p class="vc-p-eyebrow">' + t.name.toUpperCase() + '</p>';
    if (n.type === 'text') {
      const feeds = edges.filter((e) => e.from.n === n.id).length;
      h += '<p class="vc-p-label">prompt</p>' +
        '<p class="vc-p-quote">&ldquo;' + esc(n.prompt) + '&rdquo;</p>' +
        '<p class="vc-p-meta">feeding ' + feeds + ' node' + (feeds === 1 ? '' : 's') +
        ' &middot; edit it on the card</p>';
    } else {
      // small decorative helpers, PropertiesPanel.css's furniture: a
      // toggle row and the dashed reference-image well
      const toggleRow = (label, name, on) =>
        '<p class="vc-p-label">' + label + '</p>' +
        '<div class="vc-p-toggle-row"><span>' + name + '</span>' +
        '<button type="button" class="vc-p-toggle' + (on ? ' is-on' : '') +
        '" aria-label="' + name + '" ' +
        'title="Decorative here — the real node routes this to the model"><i></i></button></div>';
      const refBlock =
        '<div class="vc-p-label-row"><p class="vc-p-label">reference images</p>' +
        '<span class="vc-p-hint">Max 3</span></div>' +
        '<button type="button" class="vc-p-ref" title="Decorative here" aria-label="Add reference image">' +
        '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg></button>';
      h += drop('model', 'model', n.model);
      if (n.type === 'image') {
        h += seg('speed', 'speed', ['Standard', 'Fast'], n.speed || 'Standard');
        h += drop('ratio', 'aspect', n.aspect);
        h += seg('resolution', 'res', ['720p', '1080p', '4k'], n.res);
        h += refBlock;
        h += toggleRow('stylization', 'Stylization', false);
      }
      if (n.type === 'video') {
        h += seg('speed', 'speed', ['Standard', 'Fast'], n.speed || 'Standard');
        h += seg('input', 'input', ['Auto', 'Manual'], n.input || 'Auto');
        h += '<div class="vc-p-info"><i></i><div><strong>Text to Video</strong>' +
          '<span>Detected from inputs</span></div></div>';
        h += seg('resolution', 'res', ['720p', '1080p', '4k'], n.res);
        h += drop('ratio', 'aspect', n.aspect);
        h += seg('duration (in seconds)', 'dur', ['4s', '6s', '8s'], n.dur);
        h += toggleRow('audio', 'Always On', true);
        h += refBlock;
        h += toggleRow('camera movement', 'Camera Movement', false);
        h += toggleRow('stylization', 'Stylization', false);
      }
      if (n.type === 'model3d') {
        h += seg('detail', 'res', ['draft', 'standard'], n.res === '1080p' ? 'standard' : 'draft');
        h += seg('topology', 'topo', ['Quad', 'Tri'], n.topo || 'Quad');
        h += toggleRow('texture', 'PBR Texture', true);
      }
      h += '<div class="vc-p-foot">' +
        '<p class="vc-p-total"><span>total cost</span><strong>' + nodeCost(n) + '</strong></p>' +
        '<button type="button" class="vc-p-run" id="vc-p-run"' + (running ? ' disabled' : '') + '>' +
        icon(GLYPH.spark, 1) + 'Generate</button></div>';
    }
    panel.innerHTML = h;
    panel.hidden = false;
    const pr = panel.querySelector('#vc-p-run');
    if (pr) pr.addEventListener('click', () => runScope([n]));
  };
  const closePanel = () => { panelFor = null; panel.hidden = true; };
  panel.addEventListener('click', (e) => {
    const t = e.target.closest('.vc-p-toggle');
    if (t) { t.classList.toggle('is-on'); return; }
    const b = e.target.closest('.vc-p-seg button');
    if (b && panelFor) {
      const key = b.closest('.vc-p-seg').dataset.key;
      panelFor[key] = b.dataset.v;
      b.parentElement.querySelectorAll('button').forEach((x) =>
        x.classList.toggle('is-on', x === b));
      paintCost();
      const total = panel.querySelector('.vc-p-total strong');
      if (total) total.textContent = nodeCost(panelFor);
      return;
    }
    const d = e.target.closest('.vc-p-drop');
    if (d && panelFor) {
      const key = d.dataset.drop;
      const opts = key === 'model' ? MODELS[panelFor.type] : ['16:9', '1:1', '9:16'];
      const r = d.getBoundingClientRect();
      const vr = viewport.getBoundingClientRect();
      const s = scaleOf();
      showMenu(opts.map((o) => ({ label: o, act: () => {
        panelFor[key] = o;
        if (key === 'model') paintModel(panelFor);
        d.querySelector('span').textContent = o;
        paintCost();
      } })), { x: (r.left - vr.left) / s, y: (r.bottom - vr.top) / s + 4 });
    }
  });

  // ============================================================
  // context menus — pane / node / edge / selection / group
  //
  // The test run a reader meets is a FIXED graph: the five nodes it
  // opens with are the demo, and nothing in it mints new ones. Creating,
  // duplicating and pasting all keep their place in the vocabulary —
  // they just say what they are. (Every other verb is real: run,
  // rewire, move, group, delete, undo.) A live run is the working
  // canvas, where those three make real nodes (see createNode below).
  // ============================================================
  const sayDecor = () =>
    toast('Adding nodes is decorative here — this board is a fixed demo');
  let menuOwner = null;
  const closeMenu = () => { menuEl.hidden = true; menuOwner = null; };
  // a menu hung off a control outside the viewport (the board's name, the
  // rail's Create), in the root's own coordinates; a second press closes it
  const menuFrom = (el, items, side) => {
    if (!menuEl.hidden && menuOwner === el) return closeMenu();
    const rr = root.getBoundingClientRect(), r = el.getBoundingClientRect(), s = scaleOf();
    showMenu(items, side === 'right'
      ? { x: (r.right - rr.left) / s + 10, y: (r.top - rr.top) / s, root: true }
      : { x: (r.left - rr.left) / s, y: (r.bottom - rr.top) / s + 8, root: true });
    menuOwner = el;
  };
  const showMenu = (items, local) => {
    menuOwner = null;
    menuEl.innerHTML = items.map((it) => it === '-' ? '<span class="vc-menu-sep"></span>' :
      '<button type="button"' + (it.disabled ? ' disabled' : '') + '>' + it.label +
      (it.hint ? '<span class="vc-menu-hint">' + it.hint + '</span>' : '') + '</button>').join('');
    [...menuEl.querySelectorAll('button')].forEach((b, i) => {
      const real = items.filter((x) => x !== '-')[i];
      b.addEventListener('click', () => { closeMenu(); real.act(); });
    });
    menuEl.hidden = false;
    const mw = 196, mh = menuEl.offsetHeight || items.length * 30;
    const ox = local.root ? 0 : viewport.offsetLeft;
    menuEl.style.left = Math.min(local.x + ox, root.offsetWidth - mw - 8) + 'px';
    menuEl.style.top = Math.min(local.y, root.offsetHeight - mh - 8) + 'px';
  };
  const menuForPane = (wpt) => [
    ...(LIVE ? addItems({ x: wpt.x, y: wpt.y }) : [{ label: 'Add node', act: sayDecor }]),
    '-',
    { label: 'Auto arrange', act: autoArrange },
    { label: 'Zoom to fit', hint: '⌘0', act: fitView },
  ];
  const menuForNode = (n) => [
    { label: 'Run this node', disabled: (LIVE ? !runsLive(n) : !TYPES[n.type].runs) || running,
      act: () => runScope([n]) },
    '-',
    { label: 'Duplicate', hint: LIVE ? '⌘D' : '', act: LIVE ? () => duplicate([n]) : sayDecor },
    { label: 'Delete', act: () => { push(); removeNodes([n]); } },
  ];
  const menuForSelection = (sel) => [
    { label: 'Run selected (' + sel.filter((n) => TYPES[n.type].runs).length + ')',
      disabled: running, act: () => runScope(sel.filter((n) => TYPES[n.type].runs)) },
    { label: 'Create group', disabled: sel.some((n) => groupOf(n.id)), act: createGroup },
    ...(LIVE ? [{ label: 'Duplicate ' + sel.length + ' nodes', hint: '⌘D', act: () => duplicate(sel) }] : []),
    '-',
    { label: 'Delete ' + sel.length + ' nodes', act: () => askDelete(sel) },
  ];
  const menuForGroup = (g) => [
    { label: 'Run group', disabled: running,
      act: () => runScope(g.members.map(nodeById).filter((n) => n && TYPES[n.type].runs)) },
    { label: 'Ungroup', act: () => ungroup(g) },
    '-',
    { label: 'Delete group + nodes', act: () => askDelete(g.members.map(nodeById).filter(Boolean)) },
  ];
  const menuForEdge = (id) => [
    { label: 'Delete edge', act: () => {
      push();
      edges = edges.filter((e) => e.id !== id);
      drawEdges();
    } },
  ];

  // ---- the confirm bar: bulk deletes ask first ----
  let confirmAct = null;
  const askDelete = (list) => {
    if (list.length === 1) { push(); removeNodes(list); return; }
    $('vc-confirm-msg').textContent = 'Delete ' + list.length + ' nodes?';
    confirmEl.hidden = false;
    confirmAct = () => { push(); removeNodes(list); };
  };
  $('vc-confirm-yes').addEventListener('click', () => {
    confirmEl.hidden = true;
    if (confirmAct) confirmAct();
    confirmAct = null;
  });
  $('vc-confirm-no').addEventListener('click', () => {
    confirmEl.hidden = true;
    confirmAct = null;
  });

  // ============================================================
  // pointer choreography — one dispatcher, one gesture at a time.
  // The right button carries two jobs, decided by travel distance.
  // ============================================================
  let gesture = null;

  viewport.addEventListener('contextmenu', (e) => e.preventDefault());

  viewport.addEventListener('pointerdown', (e) => {
    if (!engaged) return;                // parked in the tile, it's a picture
    closeMenu();
    const local = toLocal(e);
    const wpt = toWorld(local);
    const portEl = e.target.closest('.vc-port');
    const nodeEl = e.target.closest('.vc-node');
    const groupEl = e.target.closest('.vc-group');
    const onBbox = e.target === bboxEl;
    // inside a prompt, a press is the start of typing or of a text
    // selection — the browser's own, with nothing captured and no lasso,
    // so a drag across the words selects them, as text anywhere does
    if (e.button === 0 && e.target.closest('.vc-prompt, input, textarea')) return;
    if (e.button === 0 && e.target.closest('.vc-node button')) return;
    // synthetic pointers (test harnesses) carry ids the browser won't
    // capture — the real board's Cypress suite hit exactly this
    try { viewport.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }

    if (e.button === 2 || e.button === 1) {
      gesture = { kind: 'rpan', sx: local.x, sy: local.y, vx: view.x, vy: view.y,
        moved: false, wpt: wpt, local: local,
        over: nodeEl ? nodeById(nodeEl.dataset.id) :
          groupEl ? groups.find((g) => g.id === groupEl.dataset.gid) :
          onBbox ? 'bbox' : null,
        overEdge: e.target.closest('.vc-edge') };
      return;
    }
    const panButton = mode === 'hand' && e.button === 0;

    if (panButton) {
      gesture = { kind: 'pan', sx: local.x, sy: local.y, vx: view.x, vy: view.y };
      root.classList.add('is-grabbing');
    } else if (portEl && portEl.classList.contains('is-out') && nodeEl) {
      gesture = { kind: 'wire', from: nodeById(nodeEl.dataset.id) };
      root.classList.add('is-wiring');
    } else if (portEl && nodeEl) {
      // a plugged-in handle lifts its wire off, to be dropped elsewhere
      // (or let go on empty canvas, and gone)
      const hit = edges.find((ed) => ed.id === portEl.dataset.edge);
      if (hit) {
        push();
        edges = edges.filter((ed) => ed !== hit);
        gesture = { kind: 'wire', from: nodeById(hit.from.n) };
        root.classList.add('is-wiring');
        drawEdges();
      }
    } else if (nodeEl && !e.target.closest('.vc-prompt, .vc-playchip')) {
      const node = nodeById(nodeEl.dataset.id);
      if (e.shiftKey) {
        setSel(node.sel ? selected().filter((n) => n !== node)
          : selected().concat(node));
        gesture = { kind: 'noop' };
      } else {
        const g = groupOf(node.id);
        if (!node.sel) setSel(g ? g.members.map(nodeById) : [node]);
        gesture = { kind: 'drag', sx: wpt.x, sy: wpt.y, moved: false,
          group: selected().map((n) => ({ n: n, x: n.x, y: n.y })),
          // a press on the picture or clip itself: let go without moving
          // and it opens in the theater
          media: e.button === 0 && e.target.closest('.vc-well.has-art .vc-photo, .vc-well.has-art .vc-gif') ? node : null };
      }
    } else if (groupEl && !e.shiftKey) {
      const g = groups.find((x) => x.id === groupEl.dataset.gid);
      const fam = g.members.map(nodeById).filter(Boolean);
      setSel(fam);
      gesture = { kind: 'drag', sx: wpt.x, sy: wpt.y, moved: false, fromPlate: true,
        group: fam.map((n) => ({ n: n, x: n.x, y: n.y })) };
    } else if (onBbox && !e.shiftKey) {
      // the Miro contract: click-hold anywhere INSIDE the bbox moves the
      // whole selection…
      gesture = { kind: 'drag', sx: wpt.x, sy: wpt.y, moved: false, fromBbox: true,
        group: selected().map((n) => ({ n: n, x: n.x, y: n.y })) };
    } else {
      // …and a lasso starts from empty canvas — or ANYWHERE with shift
      // held, which makes the bbox click-through (shift-lasso passthrough)
      gesture = { kind: 'lasso', sx: local.x, sy: local.y, add: e.shiftKey };
      lassoEl.hidden = false;
      lassoEl.style.width = lassoEl.style.height = '0px';
    }
  });

  viewport.addEventListener('pointermove', (e) => {
    if (!gesture) return;
    const local = toLocal(e);
    const wpt = toWorld(local);
    if (gesture.kind === 'pan' || gesture.kind === 'rpan') {
      const dx = local.x - gesture.sx, dy = local.y - gesture.sy;
      if (gesture.kind === 'rpan' && !gesture.moved &&
          Math.hypot(dx, dy) <= CLICK_PX) return;
      gesture.moved = true;
      view.x = gesture.vx + dx;
      view.y = gesture.vy + dy;
      applyView();
      viewMoving();
    } else if (gesture.kind === 'drag') {
      const dx = wpt.x - gesture.sx, dy = wpt.y - gesture.sy;
      if (Math.abs(dx) * view.z > CLICK_PX || Math.abs(dy) * view.z > CLICK_PX)
        gesture.moved = true;
      if (!gesture.moved) return;
      gesture.group.forEach((g) => {
        g.n.x = snap(g.x + dx);
        g.n.y = snap(g.y + dy);
        place(g.n);
      });
      drawEdges();
      drawGroups();
      paintSelection();
    } else if (gesture.kind === 'lasso') {
      const x = Math.min(gesture.sx, local.x), y = Math.min(gesture.sy, local.y);
      const w = Math.abs(local.x - gesture.sx), h = Math.abs(local.y - gesture.sy);
      lassoEl.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      lassoEl.style.width = w + 'px';
      lassoEl.style.height = h + 'px';
      gesture.rect = { x: x, y: y, w: w, h: h };
    } else if (gesture.kind === 'wire') {
      // the whole node is the target: over a node that can take what the
      // wire carries, it lights up and a ghost handle shows where the
      // wire will plug in; the wire snaps to it
      const target = targetAt(wpt);
      markTarget(target);
      const end = target ? nextInPos(target) : wpt;
      gesture.drop = { w: wpt, local: local };
      const a = freeOutPos(gesture.from);
      const c = Math.max(46, Math.abs(end.x - a.x) * 0.5);
      ghost = '<path class="vc-ghost' + (target ? ' is-snapped' : '') +
        '" style="--ec:' + PORT_COLOR[TYPES[gesture.from.type].outputs[0].type] +
        '" d="M' + a.x + ' ' + a.y +
        ' C' + (a.x + c) + ' ' + a.y + ',' + (end.x - c) + ' ' + end.y + ',' +
        end.x + ' ' + end.y + '"/>';
      gesture.near = target;
      drawEdges();
    }
  });

  // the node under the pointer that could take this wire: its card, or
  // a little margin around it, the topmost one if they overlap
  const targetAt = (wpt) => {
    const type = TYPES[gesture.from.type].outputs[0].type;
    const pad = 28 / Math.min(view.z, 1);
    let hit = null;
    nodes.forEach((n) => {
      if (n === gesture.from || !autoPort(n, type) || feeds(n.id, gesture.from.id)) return;
      if (LIVE && n.type === 'model3d') return;
      if (wpt.x >= n.x - pad && wpt.x <= n.x + TYPES[n.type].w + pad / 2 &&
        wpt.y >= n.y - pad / 2 && wpt.y <= n.y + nodeH(n) + pad / 2) hit = n;
    });
    return hit;
  };
  let marked = null;
  const markTarget = (n) => {
    if (marked === n) return;
    if (marked) {
      marked.el.classList.remove('is-drop');
      const g = marked.el.querySelector('.vc-port.is-ghost');
      if (g) g.remove();
    }
    marked = n;
    if (!n) return;
    n.el.classList.add('is-drop');
    const type = TYPES[gesture.from.type].outputs[0].type;
    const sp = document.createElement('span');
    sp.className = 'vc-port is-in is-ghost';
    sp.style.top = nextInPos(n).y - n.y - 14 + 'px';
    sp.style.setProperty('--pc', PORT_COLOR[type]);
    sp.style.setProperty('--pg', PORT_GLOW[type]);
    const key = autoPort(n, type);
    sp.innerHTML = '<span class="vc-port-label">' + (type === 'text' ? 'Prompt' : key === 'firstFrame' ? 'First frame'
      : n.type === 'model3d' ? 'Image' : 'Reference') + '</span>';
    n.el.appendChild(sp);
  };

  const endGesture = (e) => {
    if (!gesture) return;
    const g = gesture;
    gesture = null;
    root.classList.remove('is-grabbing', 'is-wiring');
    if (g.kind === 'rpan' && !g.moved) {
      if (g.overEdge) showMenu(menuForEdge(g.overEdge.dataset.id), g.local);
      else if (g.over === 'bbox' || (g.over && g.over.el && g.over.sel && selected().length > 1))
        showMenu(menuForSelection(selected()), g.local);
      else if (g.over && g.over.members) showMenu(menuForGroup(g.over), g.local);
      else if (g.over && g.over.el) { setSel([g.over]); showMenu(menuForNode(g.over), g.local); }
      else showMenu(menuForPane(g.wpt), g.local);
      return;
    }
    if (g.kind === 'lasso') {
      lassoEl.hidden = true;
      const r = g.rect;
      if (!r || (r.w <= CLICK_PX && r.h <= CLICK_PX)) {
        if (!g.add) setSel([]);          // the ≤5px click rule
        return;
      }
      // FULL containment, in world space
      const a = toWorld({ x: r.x, y: r.y });
      const b = toWorld({ x: r.x + r.w, y: r.y + r.h });
      const hit = nodes.filter((n) =>
        n.x >= a.x && n.y >= a.y &&
        n.x + TYPES[n.type].w <= b.x && n.y + nodeH(n) <= b.y);
      setSel(g.add ? selected().concat(hit.filter((n) => !n.sel)) : hit);
    } else if (g.kind === 'drag') {
      if (g.moved) push();
      else if (g.fromBbox) setSel([]);   // the click-on-bbox-space rule
      else if (g.media) openViewer(g.media);
    } else if (g.kind === 'wire') {
      ghost = '';
      markTarget(null);
      if (g.near) connect(g.from, g.near);
      else if (LIVE && g.drop) offerFromWire(g.from, g.drop.w, g.drop.local);
      drawEdges();
    }
  };
  viewport.addEventListener('pointerup', endGesture);
  viewport.addEventListener('pointercancel', endGesture);

  // the header play chip, the looping video's pause, the edge ×
  world.addEventListener('click', (e) => {
    const chip = e.target.closest('.vc-playchip, .vc-well-play');
    if (chip && chip.classList.contains('is-idle')) return;
    if (chip && engaged && !running) {
      const n = nodeById(chip.closest('.vc-node').dataset.id);
      // live, a node with nothing wired in says what it needs, on the
      // port it needs it at, rather than spending a run to fail
      if (LIVE && runsLive(n) && !edges.some((ed) => ed.to.n === n.id)) {
        pulsePort(n, 'prompt');
        toast('Connect a Text Prompt to this node first');
        return;
      }
      setSel([n]);
      runScope([n]);
      return;
    }
    const retype = e.target.closest('.vc-type');
    if (retype && engaged) {
      const n = nodeById(retype.closest('.vc-node').dataset.id);
      setSel([n]);
      // a node that holds something is that kind of node for good
      if (filled(n)) return toast('A node with content keeps its type');
      typeMenu(n, retype);
      return;
    }
  });

  // ============================================================
  // the theater: a plain click on a picture or a clip in a node opens it
  // over the whole board, as large as the window allows — the board
  // dimmed away, the words that made it underneath, every other result
  // on the board a step away with ← →. A click on a picture looks closer
  // (twice its size, or its own pixels, following the pointer); Escape,
  // ×, or a click on the dark around it puts it back where it came from.
  // ============================================================
  const viewerEl = document.createElement('div');
  viewerEl.className = 'vc-viewer';
  viewerEl.id = 'vc-viewer';
  viewerEl.hidden = true;
  viewerEl.tabIndex = -1;
  viewerEl.setAttribute('role', 'dialog');
  viewerEl.setAttribute('aria-modal', 'true');
  viewerEl.setAttribute('aria-label', 'Media viewer');
  viewerEl.innerHTML =
    '<div class="vc-viewer-scrim"></div>' +
    '<header class="vc-viewer-top">' +
      '<span class="vc-viewer-tag"><i></i><b></b><em></em></span>' +
      '<span class="vc-viewer-count"></span>' +
      '<span class="vc-viewer-tools">' +
        '<a class="vc-viewer-tool" data-v="save" title="Download" aria-label="Download">' +
          '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v7.5M4.75 6.75 8 10l3.25-3.25M3 12.75h10"/></svg></a>' +
        '<button type="button" class="vc-viewer-tool" data-v="close" title="Close (Esc)" aria-label="Close">' +
          '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>' +
      '</span>' +
    '</header>' +
    '<div class="vc-viewer-stage"></div>' +
    '<button type="button" class="vc-viewer-nav is-prev" data-v="prev" aria-label="Previous">' +
      '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5"/></svg></button>' +
    '<button type="button" class="vc-viewer-nav is-next" data-v="next" aria-label="Next">' +
      '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5"/></svg></button>' +
    '<p class="vc-viewer-cap"></p>';
  root.appendChild(viewerEl);
  const vStage = viewerEl.querySelector('.vc-viewer-stage');
  let viewing = null;                    // the node on show, while the theater is open
  const viewerOpen = () => !!viewing;
  // what a node is showing, as the theater shows it
  const mediaOf = (n) => {
    if (!n || (n.type !== 'image' && n.type !== 'video')) return null;
    if (!n.el.querySelector('.vc-well.has-art')) return null;
    if (LIVE) {
      const a = liveArt.get(n.id);
      return a ? { kind: a.kind, src: a.url, anim: !!a.anim, blob: a.blob } : null;
    }
    if (n.type === 'image') return { kind: 'image', src: MEDIA.image[(+String(n.id).slice(1) || 0) % 2] };
    return { kind: 'video', src: reduceMotion ? MEDIA.clipPoster : MEDIA.clip, anim: true };
  };
  // the words behind a result: its own prompt, or the prompts wired into
  // it, or (a clip made from a frame) the words behind that frame
  const wordsFor = (n, depth) => {
    const a = LIVE && liveArt.get(n.id);
    if (a && a.prompt) return a.prompt;
    const ins = inOrder(n);
    const said = ins.filter((e) => e.type === 'text').map((e) => nodeById(e.from.n))
      .filter((m) => m && m.prompt).map((m) => m.prompt.trim()).filter(Boolean);
    if (said.length) return said.join(' · ');
    const pic = ins.find((e) => e.type === 'image');
    return pic && (depth || 0) < 4 && nodeById(pic.from.n) ? wordsFor(nodeById(pic.from.n), (depth || 0) + 1) : '';
  };
  // every result on the board, in reading order: left to right, then down
  const shown = () => nodes.filter((n) => mediaOf(n))
    .sort((a, b) => (a.x - b.x) || (a.y - b.y));
  const mediaRect = (n) => {
    const el = n && n.el.querySelector('.vc-well.has-art .vc-photo, .vc-well.has-art .vc-gif');
    const r = el && el.getBoundingClientRect();
    const box = root.getBoundingClientRect();
    // only a result still on screen is flown to or from
    return r && r.width && r.right > box.left && r.left < box.right && r.bottom > box.top && r.top < box.bottom ? r : null;
  };
  // the picture leaves its node and lands in the theater (and back): it
  // is drawn at its final size, then moved and scaled to where it was,
  // and let go
  const fly = (m, from, home) => {
    if (reduceMotion || !from) return false;
    const to = m.getBoundingClientRect();
    if (!to.width || !to.height) return false;
    const t = 'translate(' + ((from.left + from.width / 2) - (to.left + to.width / 2)) + 'px,' +
      ((from.top + from.height / 2) - (to.top + to.height / 2)) + 'px) scale(' +
      Math.max(from.width / to.width, from.height / to.height) + ')';
    if (home) { m.style.transform = t; return true; }
    m.style.transition = 'none';
    m.style.transform = t;
    void m.offsetWidth;
    m.style.transition = '';
    m.style.transform = '';
    return true;
  };
  const showMedia = (n, from) => {
    const md = mediaOf(n);
    if (!md) return;
    viewing = n;
    const t = TYPES[n.type];
    viewerEl.querySelector('.vc-viewer-tag i').className = 'is-' + n.type;
    viewerEl.querySelector('.vc-viewer-tag b').textContent = t.name;
    viewerEl.querySelector('.vc-viewer-tag em').textContent = n.model || '';
    const list = shown();
    const at = list.indexOf(n);
    viewerEl.querySelector('.vc-viewer-count').textContent = list.length > 1 ? (at + 1) + ' of ' + list.length : '';
    viewerEl.classList.toggle('is-single', list.length < 2);
    const words = wordsFor(n);
    const cap = viewerEl.querySelector('.vc-viewer-cap');
    cap.textContent = words;
    cap.hidden = !words;
    const save = viewerEl.querySelector('[data-v="save"]');
    save.href = md.src;
    const ext = md.blob && md.blob.type ? md.blob.type.split('/')[1].replace('jpeg', 'jpg') : (md.src.split('.').pop() || 'png');
    save.download = 'vicino-' + n.type + '-' + String(n.model || n.id).replace(/[^\w.-]+/g, '-') + '.' + ext;
    const el = md.kind === 'video' && !md.anim ? document.createElement('video') : document.createElement('img');
    el.className = 'vc-viewer-media is-' + md.kind;
    if (el.tagName === 'VIDEO') {
      Object.assign(el, { src: md.src, controls: true, loop: true, playsInline: true, autoplay: !reduceMotion });
    } else {
      el.src = md.src;
      el.alt = words ? 'Generated: ' + words : 'Generated ' + t.name.toLowerCase();
      el.draggable = false;
    }
    // a picture flies in from its node; anything else (a clip, a step
    // to the next result, a node scrolled off screen) fades in where it lands
    if (!from || el.tagName === 'VIDEO' || reduceMotion) el.classList.add('is-fade');
    vStage.replaceChildren(el);
    const land = () => { fitMedia(el); if (el.tagName === 'IMG' && from) fly(el, from); };
    if (el.tagName === 'VIDEO') el.addEventListener('loadedmetadata', land, { once: true });
    else if (el.complete && el.naturalWidth) land();
    else el.addEventListener('load', land, { once: true });
  };
  // as large as the stage allows, small results scaled up to it too:
  // the point of the theater is to see the thing big
  const fitMedia = (el) => {
    const w = el.naturalWidth || el.videoWidth, h = el.naturalHeight || el.videoHeight;
    if (!w || !h) return;
    const cs = getComputedStyle(vStage);
    const aw = vStage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const ah = vStage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const k = Math.min(aw / w, ah / h);
    if (!(k > 0)) return;
    el.style.width = Math.floor(w * k) + 'px';
    el.style.height = Math.floor(h * k) + 'px';
  };
  addEventListener('resize', () => {
    const m = viewing && vStage.querySelector('.vc-viewer-media');
    if (m) fitMedia(m);
  }, { passive: true });
  const openViewer = (n) => {
    if (!mediaOf(n)) return;
    const from = mediaRect(n);
    closeMenu();
    viewerEl.hidden = false;
    void viewerEl.offsetWidth;
    viewerEl.classList.add('is-open');
    showMedia(n, from);
    viewerEl.focus({ preventScroll: true });
  };
  const closeViewer = () => {
    if (!viewing) return;
    const n = viewing;
    viewing = null;
    const m = vStage.querySelector('.vc-viewer-media');
    if (m) { m.classList.remove('is-zoomed'); m.style.transformOrigin = ''; }
    if (m && m.tagName === 'VIDEO') m.pause();
    viewerEl.classList.remove('is-open');
    if (m && fly(m, mediaRect(n), true)) viewerEl.classList.add('is-landing');
    setTimeout(() => {
      if (viewing) return;
      viewerEl.hidden = true;
      viewerEl.classList.remove('is-landing');
      vStage.replaceChildren();
    }, reduceMotion ? 0 : 260);
    root.focus({ preventScroll: true });
  };
  const stepViewer = (d) => {
    const list = shown();
    if (list.length < 2 || !viewing) return;
    showMedia(list[(list.indexOf(viewing) + d + list.length) % list.length], null);
  };
  viewerEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (b && b.dataset.v === 'close') return closeViewer();
    if (b && b.dataset.v === 'prev') return stepViewer(-1);
    if (b && b.dataset.v === 'next') return stepViewer(1);
    if (b) return;                       // the download link does its own thing
    const m = e.target.closest('.vc-viewer-media');
    if (!m) {
      if (!e.target.closest('.vc-viewer-top, .vc-viewer-cap')) closeViewer();
      return;
    }
    if (m.tagName === 'VIDEO') return;
    // closer: twice the size, or the picture's own pixels if it has more,
    // centred on where it was clicked and following the pointer from there
    const r = m.getBoundingClientRect();
    if (m.classList.toggle('is-zoomed')) {
      const k = Math.min(4, Math.max(2, m.naturalWidth / (r.width || 1)));
      m.style.setProperty('--k', k.toFixed(2));
      m.style.transformOrigin = ((e.clientX - r.left) / r.width * 100) + '% ' + ((e.clientY - r.top) / r.height * 100) + '%';
    }
  });
  vStage.addEventListener('pointermove', (e) => {
    const m = vStage.querySelector('.vc-viewer-media.is-zoomed');
    if (!m) return;
    // the unzoomed box: the zoomed one is k times larger around the origin
    const k = parseFloat(m.style.getPropertyValue('--k')) || 2;
    const r = m.getBoundingClientRect();
    const w = r.width / k, h = r.height / k;
    const o = m.style.transformOrigin.split(' ').map((v) => parseFloat(v) / 100);
    const ox = isNaN(o[0]) ? 0.5 : o[0], oy = isNaN(o[1]) ? 0.5 : o[1];
    const left = r.left + ox * (r.width - w), top = r.top + oy * (r.height - h);
    const fx = Math.min(1, Math.max(0, (e.clientX - left) / w));
    const fy = Math.min(1, Math.max(0, (e.clientY - top) / h));
    m.style.transformOrigin = (fx * 100) + '% ' + (fy * 100) + '%';
  });
  viewerEl.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });

  edgeSvg.addEventListener('pointerdown', (e) => {
    const x = e.target.closest('.vc-edge-x');
    if (!x || !engaged) return;
    e.stopPropagation();
    push();
    edges = edges.filter((ed) => ed.id !== x.dataset.del);
    drawEdges();
  });

  // ============================================================
  // wheel — scroll pans; ⌘/ctrl+scroll zooms toward the cursor,
  // deltas accumulated and applied once per animation frame
  // ============================================================
  let wheelRaf = 0, accPan = { x: 0, y: 0 }, accZoom = 0, zoomAt = null;
  viewport.addEventListener('wheel', (e) => {
    if (!engaged) return;                // parked, the page keeps its scroll
    // a prompt longer than its box scrolls its own words first
    const field = !e.ctrlKey && !e.metaKey && e.target.closest('.vc-prompt');
    if (field && field.scrollHeight > field.clientHeight + 1) {
      const room = e.deltaY < 0 ? field.scrollTop > 0
        : field.scrollTop + field.clientHeight < field.scrollHeight - 1;
      if (room && Math.abs(e.deltaY) >= Math.abs(e.deltaX)) return;
    }
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      accZoom += -e.deltaY * 0.002;
      zoomAt = toLocal(e);
    } else {
      accPan.x += e.deltaX;
      accPan.y += e.deltaY;
    }
    if (!wheelRaf) wheelRaf = requestAnimationFrame(applyWheel);
  }, { passive: false });
  const applyWheel = () => {
    wheelRaf = 0;
    if (accPan.x || accPan.y) {
      view.x -= accPan.x;
      view.y -= accPan.y;
      accPan.x = accPan.y = 0;
    }
    if (accZoom) {
      zoomTo(view.z * (1 + accZoom), zoomAt);
      accZoom = 0;
    }
    applyView();
    viewMoving();
  };
  const zoomTo = (z, at) => {
    z = Math.min(MAX_Z, Math.max(MIN_Z, z));
    const p = at || { x: viewport.offsetWidth / 2, y: viewport.offsetHeight / 2 };
    const k = z / view.z;
    view.x = p.x - k * (p.x - view.x);
    view.y = p.y - k * (p.y - view.y);
    view.z = z;
  };

  // a second finger arriving mid-gesture kills the gesture cleanly —
  // no stranded grab cursor, no silently lost undo step
  const cancelGesture = () => {
    if (!gesture) return;
    const g = gesture;
    gesture = null;
    root.classList.remove('is-grabbing', 'is-wiring');
    lassoEl.hidden = true;
    if (g.kind === 'drag' && g.moved) push();
    if (g.kind === 'wire') { ghost = ''; markTarget(null); drawEdges(); }
  };

  // pinch on touch — two pointers, zoom on their midpoint
  const touches = new Map();
  viewport.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') touches.set(e.pointerId, toLocal(e));
  }, true);
  viewport.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'touch' || !touches.has(e.pointerId)) return;
    const prev = [...touches.values()];
    touches.set(e.pointerId, toLocal(e));
    if (touches.size === 2) {
      cancelGesture();
      const cur = [...touches.values()];
      const d0 = Math.hypot(prev[0].x - prev[1].x, prev[0].y - prev[1].y);
      const d1 = Math.hypot(cur[0].x - cur[1].x, cur[0].y - cur[1].y);
      if (d0 > 0) {
        zoomTo(view.z * (d1 / d0),
          { x: (cur[0].x + cur[1].x) / 2, y: (cur[0].y + cur[1].y) / 2 });
        applyView();
        viewMoving();
      }
    }
  }, true);
  const dropTouch = (e) => touches.delete(e.pointerId);
  viewport.addEventListener('pointerup', dropTouch, true);
  viewport.addEventListener('pointercancel', dropTouch, true);

  // ============================================================
  // fit view + the zoom menu
  // ============================================================
  const fitView = () => {
    if (!nodes.length) return;
    const x1 = Math.min(...nodes.map((n) => n.x));
    const y1 = Math.min(...nodes.map((n) => n.y));
    const x2 = Math.max(...nodes.map((n) => n.x + TYPES[n.type].w));
    const y2 = Math.max(...nodes.map((n) => n.y + nodeH(n)));
    // the board fits the room the open panels leave it: the Workflow
    // Builder on the left, the properties panel on the right
    // and the rail floating at the canvas's left edge
    const railEl = root.querySelector('.vc-rail');
    const vr = viewport.getBoundingClientRect();
    const left = railEl ? Math.max(0, (railEl.getBoundingClientRect().right - vr.left) / scaleOf() + 12) : 0;
    const right = !panel.hidden ? viewport.offsetWidth - panel.offsetLeft : 0;
    const vw = viewport.offsetWidth - left - right, vh = viewport.offsetHeight;
    const pad = 0.14;
    const z = Math.min(MAX_Z, Math.max(MIN_Z,
      Math.min(vw / ((x2 - x1) * (1 + pad * 2)), vh / ((y2 - y1) * (1 + pad * 2)))));
    view.z = Math.min(z, 1.1);
    view.x = left + (vw - (x2 - x1) * view.z) / 2 - x1 * view.z;
    view.y = (vh - (y2 - y1) * view.z) / 2 - y1 * view.z;
    applyView();
  };
  const zoomMenu = $('vc-zoommenu');
  zoomBtn.addEventListener('click', () => { zoomMenu.hidden = !zoomMenu.hidden; });
  zoomMenu.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    zoomMenu.hidden = true;
    if (b.dataset.z === 'fit') fitView();
    else {
      zoomTo(+b.dataset.z);
      applyView();
    }
  });

  // ============================================================
  // auto arrange — the DAG laid out left→right by stage
  // ============================================================
  const autoArrange = () => {
    if (!nodes.length) return;
    push();
    const stages = stagesOf(nodes);
    const placed = new Set(stages.flat().map((n) => n.id));
    const strays = nodes.filter((n) => !placed.has(n.id));
    if (strays.length) stages.push(strays);
    let x = 60;
    root.classList.add('is-arranging');
    stages.forEach((stage) => {
      const w = Math.max(...stage.map((n) => TYPES[n.type].w));
      const total = stage.reduce((a, n) => a + nodeH(n), 0) + (stage.length - 1) * NODE_GAP;
      let y = -total / 2;
      stage.forEach((n) => {
        n.x = snap(x);
        n.y = snap(y);
        y += nodeH(n) + NODE_GAP;
        place(n);
      });
      x += w + RANK_GAP;
    });
    drawEdges();
    drawGroups();
    paintSelection();
    setTimeout(() => {
      root.classList.remove('is-arranging');
      fitView();
    }, reduceMotion ? 0 : 420);
  };

  // ============================================================
  // the minimap — bottom-left, the shipped chrome: 32px white
  // card, 20px grey well, a real DIV for the cyan viewport box
  // ============================================================
  const MAP_W = 186, MAP_H = 112;      // the shipped well's border box
  const MAP_CW = 184, MAP_CH = 110;    // its content box, inside the 1px border
  const MAP_ORIGIN = 8;                // card padding 7 + well border 1
  const MAP_PAD_RATIO = 0.5;           // BoardMiniMap.jsx PAD_RATIO
  const MAP_OFF = 5;                   // BoardMiniMap.jsx OFFSET_SCALE
  let mapView = null;                  // the current viewBox, for mapPan

  // the ship's model: node rects live in WORLD coordinates and only the
  // svg viewBox moves — a pan is one attribute write, never an innerHTML
  const paintMap = () => {
    if (mapEl.hidden) return;
    if (!nodes.length) { mapSvg.innerHTML = ''; mapView = null; mapBox.hidden = true; return; }
    mapSvg.innerHTML = nodes.map((n) =>
      '<rect x="' + n.x + '" y="' + n.y +
      '" width="' + TYPES[n.type].w + '" height="' + nodeH(n) +
      '" class="vc-map-node"/>').join('');
    paintMapBox();
  };
  // frame = union(content padded by half its long side, the camera rect),
  // uniform scale via max(), plus a 5-unit margin — BoardMiniMap.jsx math
  const paintMapBox = () => {
    if (mapEl.hidden) return;
    const vw = viewport.offsetWidth, vh = viewport.offsetHeight;
    if (!vw || !nodes.length) { mapBox.hidden = true; return; }
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    nodes.forEach((n) => {
      x1 = Math.min(x1, n.x); y1 = Math.min(y1, n.y);
      x2 = Math.max(x2, n.x + TYPES[n.type].w); y2 = Math.max(y2, n.y + nodeH(n));
    });
    const pad = MAP_PAD_RATIO * Math.max(x2 - x1, y2 - y1);
    x1 -= pad; y1 -= pad; x2 += pad; y2 += pad;
    const viewRect = { x: -view.x / view.z, y: -view.y / view.z,
      w: vw / view.z, h: vh / view.z };
    x1 = Math.min(x1, viewRect.x); y1 = Math.min(y1, viewRect.y);
    x2 = Math.max(x2, viewRect.x + viewRect.w); y2 = Math.max(y2, viewRect.y + viewRect.h);
    const vScale = Math.max((x2 - x1) / MAP_CW, (y2 - y1) / MAP_CH);
    const off = MAP_OFF * vScale;
    const vbW = vScale * MAP_CW + 2 * off, vbH = vScale * MAP_CH + 2 * off;
    const vbX = x1 - (vScale * MAP_CW - (x2 - x1)) / 2 - off;
    const vbY = y1 - (vScale * MAP_CH - (y2 - y1)) / 2 - off;
    mapView = { x: vbX, y: vbY, w: vbW, h: vbH };
    mapSvg.setAttribute('viewBox', vbX + ' ' + vbY + ' ' + vbW + ' ' + vbH);
    // the ship's rects keep ~8 rendered px of corner at any frame scale
    const r = 8 * vScale;
    for (let i = 0; i < mapSvg.children.length; i++) {
      mapSvg.children[i].setAttribute('rx', r);
      mapSvg.children[i].setAttribute('ry', r);
    }
    // the cyan camera box, clamped to the well
    const sx = MAP_CW / vbW, sy = MAP_CH / vbH;
    let w = Math.min(viewRect.w * sx, MAP_CW);
    let h = Math.min(viewRect.h * sy, MAP_CH);
    const left = Math.max(0, Math.min((viewRect.x - vbX) * sx, MAP_CW - w));
    const top = Math.max(0, Math.min((viewRect.y - vbY) * sy, MAP_CH - h));
    mapBox.hidden = false;
    mapBox.style.left = MAP_ORIGIN + left + 'px';
    mapBox.style.top = MAP_ORIGIN + top + 'px';
    mapBox.style.width = w + 'px';
    mapBox.style.height = h + 'px';
  };
  const mapPan = (e) => {
    if (!mapView) return;
    const r = mapSvg.getBoundingClientRect();
    const sc = r.width / MAP_W || 1;
    // rect px → content px (inside the 1px border) → world via the viewBox
    const fx = mapView.x + ((e.clientX - r.left) / sc - 1) * (mapView.w / MAP_CW);
    const fy = mapView.y + ((e.clientY - r.top) / sc - 1) * (mapView.h / MAP_CH);
    view.x = viewport.offsetWidth / 2 - fx * view.z;
    view.y = viewport.offsetHeight / 2 - fy * view.z;
    applyView();
    viewMoving();
  };
  let mapDrag = false;
  mapSvg.addEventListener('pointerdown', (e) => {
    if (!engaged) return;
    mapDrag = true;
    try { mapSvg.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
    mapPan(e);
  });
  mapSvg.addEventListener('pointermove', (e) => { if (mapDrag) mapPan(e); });
  mapSvg.addEventListener('pointerup', () => { mapDrag = false; });
  $('vc-map-hide').addEventListener('click', () => {
    mapEl.hidden = true;
    $('vc-map-open').hidden = false;
  });
  $('vc-map-open').addEventListener('click', () => {
    mapEl.hidden = false;
    $('vc-map-open').hidden = true;
    paintMap();
  });

  // ============================================================
  // run — Kahn stages; statuses walk queued → running (85%) →
  // validating (100%) → done, the backend's own ladder
  // ============================================================
  const stagesOf = (scope) => {
    const ids = new Set(scope.map((n) => n.id));
    const indeg = new Map();
    scope.forEach((n) => indeg.set(n.id, 0));
    const live = edges.filter((e) => ids.has(e.from.n) && ids.has(e.to.n));
    live.forEach((e) => indeg.set(e.to.n, indeg.get(e.to.n) + 1));
    const stages = [];
    let frontier = scope.filter((n) => !indeg.get(n.id));
    const seen = new Set();
    while (frontier.length) {
      stages.push(frontier);
      frontier.forEach((n) => seen.add(n.id));
      const next = new Set();
      frontier.forEach((n) => live.filter((e) => e.from.n === n.id).forEach((e) => {
        indeg.set(e.to.n, indeg.get(e.to.n) - 1);
        if (!indeg.get(e.to.n) && !seen.has(e.to.n)) next.add(e.to.n);
      }));
      frontier = [...next].map(nodeById);
    }
    return stages;
  };

  let runToken = 0;
  const runScope = (scope) => {
    if (LIVE) return runLive(scope);
    if (running) return;
    scope = scope && scope.length ? scope : nodes;
    warmMedia();                         // the result is decoded before it lands
    running = true;
    const token = ++runToken;
    root.classList.add('is-running');
    runBtn.disabled = true;
    runBtn.querySelector('span').textContent = 'Running';
    scope.forEach((n) => {
      n.status = TYPES[n.type].runs ? 'queued' : 'done';
      if (TYPES[n.type].runs) clearArt(n);
      paintStatus(n);
    });
    const stages = stagesOf(scope);
    let i = 0;
    const step = () => {
      if (token !== runToken) return;    // a reset cancelled this run
      while (i < stages.length && !stages[i].some((n) => TYPES[n.type].runs)) i++;
      if (i >= stages.length) return done();
      const stage = stages[i++].filter((n) => TYPES[n.type].runs);
      let ms = 0;
      stage.forEach((n) => {
        n.status = 'running';
        paintStatus(n);
        clearArt(n);
        const dur = reduceMotion ? 300 : TYPES[n.type].dur;
        ms = Math.max(ms, dur);
        // scaleX, never width: the fill is compositor-only, so a running
        // stage costs zero layout while the reader scrolls past it
        const bar = n.el.querySelector('.vc-bar i');
        bar.style.transition = 'none';
        bar.style.transform = 'scaleX(0)';
        void bar.offsetWidth;
        bar.style.transition = 'transform ' + dur * 0.8 + 'ms linear';
        bar.style.transform = 'scaleX(0.85)';
        setTimeout(() => {
          if (token !== runToken) return;
          n.status = 'validating';
          paintStatus(n);
          bar.style.transition = 'transform ' + dur * 0.2 + 'ms ease';
          bar.style.transform = 'scaleX(1)';
        }, dur * 0.8);
        edges.forEach((e) => { if (e.to.n === n.id) e.running = true; });
      });
      drawEdges();
      setTimeout(() => {
        if (token !== runToken) return;
        stage.forEach((n) => {
          n.status = 'done';
          paintStatus(n);
          revealArt(n);
          edges.forEach((e) => { if (e.to.n === n.id) e.running = false; });
        });
        drawEdges();
        step();
      }, ms + 260);
    };
    const done = () => {
      running = false;
      root.classList.remove('is-running');
      runBtn.disabled = false;
      runBtn.querySelector('span').textContent = 'Run again';
      paintSelection();
    };
    step();
  };

  // ============================================================
  // live runs. Unlike the test run's one timed pass, a live run is real
  // work that can take a minute, so runs go side by side: Run takes the
  // whole board, a node's play chip or its Generate takes that node, and
  // while one is working the rest of the board stays usable, to make,
  // wire and run other nodes. Within a run the nodes go in the graph's
  // stages, each stage's nodes asked at once. A node fed by an image
  // that has nothing to give yet takes that image node along, so running
  // the video at the end of a chain runs the chain; a node another run is
  // still making is waited for, not made twice (pending).
  // ============================================================
  const pending = new Map();             // node id → its generation, in flight
  let liveRuns = 0;
  const paintLiveRuns = () => {
    root.classList.toggle('is-running', liveRuns > 0);
    runBtn.disabled = liveRuns > 0;
    runBtn.querySelector('span').textContent = liveRuns > 0 ? 'Running' : 'Run';
  };
  const runLive = async (scope) => {
    const want = new Set();
    const take = (n) => {
      if (!n || want.has(n) || !runsLive(n) || pending.has(n.id)) return;
      want.add(n);
      edges.forEach((e) => {
        if (e.to.n === n.id && e.type === 'image' && !liveArt.has(e.from.n)) take(nodeById(e.from.n));
      });
    };
    (scope && scope.length ? scope : nodes).forEach(take);
    const list = [...want];
    if (!list.length) return;
    liveRuns++;
    paintLiveRuns();
    const settle = new Map();
    list.forEach((n) => {
      // a node about to run lets go of what it returned last time, so
      // nothing downstream is handed a stale result if it fails
      if (liveArt.has(n.id)) {
        URL.revokeObjectURL(liveArt.get(n.id).url);
        liveArt.delete(n.id);
      }
      pending.set(n.id, new Promise((r) => settle.set(n.id, r)));
      n.status = 'queued';
      paintStatus(n);
      n.el.querySelector('.vc-well').innerHTML = wellCopy('Queued', 'waits for what feeds it');
    });
    let failures = 0;
    for (const stage of stagesOf(list)) {
      await Promise.all(stage.map(async (n) => {
        if (!(await generate(n))) failures++;
        pending.delete(n.id);
        settle.get(n.id)();
      }));
    }
    liveRuns--;
    paintLiveRuns();
    paintSelection();
    if (failures) {
      toast(failures === 1 ? 'One node couldn’t generate — its card says why'
        : failures + ' nodes couldn’t generate — each card says why');
    }
  };
  // One node. Its inputs are what its wires carry: the words of the text
  // nodes feeding it, and what the image nodes feeding it returned. The
  // node is looked up by id at every step, since an undo while it works
  // rebuilds the board's nodes; one deleted meanwhile just drops its result.
  const generate = async (n) => {
    const id = n.id;
    const now = () => nodeById(id);
    const ups = edges.filter((e) => e.to.n === id && e.type === 'image');
    await Promise.all(ups.map((e) => pending.get(e.from.n)).filter(Boolean));
    let cur = now();
    if (!cur) return true;
    cur.status = 'running';
    paintStatus(cur);
    const dur = reduceMotion ? 300 : LIVE_EXPECT_MS[cur.type];
    let bar = cur.el.querySelector('.vc-bar i');
    bar.style.transition = 'none';
    bar.style.transform = 'scaleX(0)';
    void bar.offsetWidth;
    bar.style.transition = 'transform ' + dur + 'ms cubic-bezier(0.2, 0.6, 0.35, 1)';
    bar.style.transform = 'scaleX(0.85)';
    edges.forEach((e) => { if (e.to.n === id) e.running = true; });
    drawEdges();
    const started = Date.now();
    workingWell(cur, started);
    const tick = setInterval(() => {
      const c = now();
      if (c && c.status === 'running') workingWell(c, started);
    }, 1000);
    try {
      const ins = inOrder(cur);
      const said = ins.filter((e) => e.type === 'text')
        .map((e) => ((nodeById(e.from.n) || {}).prompt || '').trim()).filter(Boolean).join('\n');
      const frames = ins.filter((e) => e.type === 'image')
        .map((e) => liveArt.get(e.from.n)).filter(Boolean);
      // a node whose picture did not come back has nothing to work from:
      // it fails in words, rather than quietly running on its prompt alone
      if (frames.length < ins.filter((e) => e.type === 'image').length) {
        throw new Error(cur.type === 'video'
          ? 'Its first frame didn’t generate, so there was nothing to animate'
          : 'A reference image wired into it didn’t generate');
      }
      if (!said && !frames.length) {
        throw new Error(cur.type === 'video'
          ? 'Wire a Text Prompt or an Image into it first'
          : 'Wire a Text Prompt into it first');
      }
      let prompt = said;
      let out;
      const pics = (port) => ins.filter((e) => e.to.port === port).map((e) => liveArt.get(e.from.n)).filter(Boolean);
      if (cur.type === 'image') {
        // every picture wired in is a reference the model draws from
        out = await LIVE.image({ model: cur.model, prompt: prompt, aspect: cur.aspect,
          images: frames.map((f) => f.blob) });
      } else {
        // the first frame opens the clip; any other picture is a
        // reference for its look. A clip with no words wired in takes the
        // words behind its first frame.
        const first = pics('firstFrame')[0];
        const refs = pics('refs');
        if (!prompt && (first || refs[0])) prompt = (first || refs[0]).prompt || '';
        out = await LIVE.video({ model: cur.model, prompt: prompt, aspect: cur.aspect,
          seconds: parseInt(cur.dur, 10) || 6, resolution: cur.res,
          image: first && first.blob, refs: refs.map((r) => r.blob) });
      }
      cur = now();
      if (!cur) return true;
      liveArt.set(id, { kind: cur.type, blob: out.blob, url: URL.createObjectURL(out.blob),
        model: cur.model, prompt: prompt });
      made.push({ kind: cur.type, blob: out.blob, url: URL.createObjectURL(out.blob),
        model: cur.model, prompt: prompt, dur: cur.type === 'video' ? cur.dur : '' });
      if (dockOpen === 'lib') paintLibrary();
      cur.status = 'validating';
      paintStatus(cur);
      bar = cur.el.querySelector('.vc-bar i');
      bar.style.transition = 'transform 260ms ease';
      bar.style.transform = 'scaleX(1)';
      await new Promise((r) => setTimeout(r, 300));
      cur = now();
      if (!cur) return true;
      cur.status = 'done';
      paintStatus(cur);
      revealArt(cur);
      refreshFed(cur);
      return true;
    } catch (err) {
      cur = now();
      if (cur) {
        cur.status = 'failed';
        paintStatus(cur);
        failedWell(cur, err && err.message);
      }
      return false;
    } finally {
      clearInterval(tick);
      edges.forEach((e) => { if (e.to.n === id) e.running = false; });
      drawEdges();
    }
  };
  // ============================================================
  // parked in its tile the board is a FINISHED board, not a demo reel:
  // every result is already on it (see the boot below), the clip loops
  // and the turntable turns. There is no attract loop — a run that
  // wipes the art and re-runs it on a cadence takes the reader's
  // finished picture away every few seconds. All the tile still needs
  // from the viewport is whether the turntables are worth turning.
  // ============================================================
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => entries.forEach((en) => {
      setBoardVisible(en.isIntersecting);
    }), { threshold: 0.25 }).observe(root);
  }

  // ============================================================
  // the workflow agent — a canned plan(), then the real
  // addPlanToBoard move: nodes land wired, staged, runnable
  // ============================================================
  // ============================================================
  // the AI Workflow Builder. Say what you want to make; the agent plans
  // a small graph — the nodes, the words in each prompt, the wires —
  // and lays it on the canvas one node at a time, then offers to run
  // it. Live, the plan comes from the model, through the relay's plan
  // route; in the test run, from a small planner here that reads the
  // request for what it is asking for (a clip, a 3D model, a picture).
  // ============================================================
  const chatLog = $('vc-chat-log');
  const chatIn = $('vc-chat-in');
  const chatScroll = $('vc-chat-scroll');
  const chatSend = chat.querySelector('.vc-chat-form button[type="submit"]');
  let chatBusy = false;
  // docked: the board's left edge gives the column its room. The canvas
  // narrows with an ease, and the view moves half the column's width, so
  // what was centred stays centred in the room that is left.
  // the AI Workflow Builder and the Asset Library share the one dock:
  // opening one while the other is open swaps them in place
  const DOCK = 400;
  let dockOpen = null;                   // 'chat' | 'lib' | null
  const setDock = (name) => {
    if (name === dockOpen) return;
    const was = dockOpen;
    root.classList.add('is-docking');
    root.classList.toggle('is-docked', !!name);
    root.classList.toggle('is-chatting', name === 'chat');
    root.classList.toggle('is-library', name === 'lib');
    if (!was && name) view.x -= DOCK / 2;
    else if (was && !name) view.x += DOCK / 2;
    applyView();
    setTimeout(() => root.classList.remove('is-docking'), 460);
    dockOpen = name;
    $('vc-rail-agent').classList.toggle('is-on', name === 'chat');
    $('vc-rail-assets').classList.toggle('is-on', name === 'lib');
    if (name === 'chat') {
      paintContext();
      setTimeout(() => chatIn.focus(), 120);
    }
    if (name === 'lib') paintLibrary();
  };
  const chatOpen = () => dockOpen === 'chat';
  const toggleChat = (open) => {
    const want = typeof open === 'boolean' ? open : !chatOpen();
    if (want) setDock('chat');
    else if (chatOpen()) setDock(null);
  };
  $('vc-rail-agent').addEventListener('click', () => toggleChat());
  $('vc-chat-x').addEventListener('click', () => toggleChat(false));
  $('vc-chat-new').addEventListener('click', () => {
    if (chatBusy) return;
    chatLog.innerHTML = '';
    $('vc-chat-hero').hidden = false;
    $('vc-chat-suggest').hidden = false;
    chatScroll.scrollTop = 0;
    chatIn.focus();
  });
  const scrollDown = () => requestAnimationFrame(() => { chatScroll.scrollTop = chatScroll.scrollHeight; });
  const say = (text, who) => {
    const row = document.createElement('div');
    row.className = 'vc-msg is-' + who;
    const body = document.createElement('p');
    body.textContent = text;
    row.appendChild(body);
    chatLog.appendChild(row);
    scrollDown();
    return row;
  };
  // while the plan is made: the four things the agent does, ticked off
  const STEPS = ['Reading your idea', 'Choosing the nodes', 'Writing the prompts', 'Wiring the graph'];
  // while it plans: one line, moving through what the agent is doing
  const thinking = () => {
    const row = document.createElement('div');
    row.className = 'vc-msg is-agent is-thinking';
    row.innerHTML = '<p class="vc-think"><span class="vc-think-word">' + STEPS[0] + '</span></p>';
    chatLog.appendChild(row);
    scrollDown();
    let i = 0;
    const word = row.querySelector('.vc-think-word');
    const timer = setInterval(() => {
      if (i >= STEPS.length - 1) return;
      i++;
      word.classList.remove('is-in');
      void word.offsetWidth;
      word.textContent = STEPS[i];
      word.classList.add('is-in');
    }, reduceMotion ? 120 : 600);
    return { row: row, done: () => clearInterval(timer) };
  };
  // ---- the plan card: a little graph of what was built, a row per node
  // that follows the node as it runs, and the way to run it all ----
  const planCard = (row, plan, made) => {
    const card = document.createElement('div');
    card.className = 'vc-plan';
    const cols = {};
    made.forEach((n, i) => { const d = plan.depthOf[i]; (cols[d] = cols[d] || []).push(n); });
    const graph = Object.keys(cols).sort((a, b) => a - b).map((d) => '<span class="vc-plan-col">' +
      cols[d].map((n) => '<span class="vc-idea-tile is-' + n.type + '">' + icon(GLYPH[n.type]) + '</span>').join('') +
      '</span>').join('<i class="vc-idea-wire"></i>');
    // a row per node — its prompt, or its type and model — then the actions
    void graph;
    card.innerHTML = made.map((n, i) => {
        const pn = plan.nodes[i];
        return '<div class="vc-plan-row is-' + n.type + '" data-i="' + i + '"><span class="vc-plan-text">' +
          '<b>' + TYPE_NAMES[n.type] + (n.type !== 'text' ? ' &middot; ' + esc(n.model) : '') + '</b>' +
          (pn.prompt ? '<span>' + esc(pn.prompt) + '</span>' : '') +
          '</span><span class="vc-plan-state"></span></div>';
      }).join('') +
      '<div class="vc-plan-acts"><button type="button" class="vc-plan-run">' +
      '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3.9v8.2a.6.6 0 0 0 .9.5l6.6-4.1a.6.6 0 0 0 0-1L6.4 3.4a.6.6 0 0 0-.9.5z" fill="currentColor" stroke="none"/></svg>' +
      '<span>Run workflow</span></button><button type="button" class="vc-plan-show">Show on canvas</button></div>';
    row.appendChild(card);
    const runBtnEl = card.querySelector('.vc-plan-run');
    const rows = card.querySelectorAll('.vc-plan-row');
    // a row lights its node on the canvas while the pointer is on it
    rows.forEach((r) => {
      const n = made[+r.dataset.i];
      r.addEventListener('pointerenter', () => n.el && n.el.classList.add('is-peek'));
      r.addEventListener('pointerleave', () => n.el && n.el.classList.remove('is-peek'));
      r.addEventListener('click', () => { if (nodes.includes(n)) { setSel([n]); } });
    });
    runBtnEl.addEventListener('click', () => {
      const go = made.filter((n) => nodes.includes(n) && TYPES[n.type].runs && !(LIVE && !runsLive(n)));
      if (go.length) runScope(go);
    });
    card.querySelector('.vc-plan-show').addEventListener('click', () => {
      const keep = made.filter((n) => nodes.includes(n));
      setSel(keep);
      fitView();
    });
    // each row follows its node: queued, generating, made, or refused
    const paint = () => {
      if (!card.isConnected) return clearInterval(timer);
      let busy = 0, doneN = 0, runnable = 0;
      rows.forEach((r) => {
        const n = nodeById(made[+r.dataset.i].id);
        const st = r.querySelector('.vc-plan-state');
        if (!n) { st.innerHTML = '<span class="vc-pill is-gone">Removed</span>'; return; }
        if (!TYPES[n.type].runs) { st.innerHTML = ''; return; }
        runnable++;
        const k = n.status;
        let html = '';
        if (k === 'queued') { busy++; html = '<span class="vc-pill is-queued">Queued</span>'; }
        else if (k === 'running' || k === 'validating') { busy++; html = '<span class="vc-pill is-running"><i></i>Generating</span>'; }
        else if (k === 'done') {
          doneN++;
          const src = artSrc(n.id);
          html = src ? '<img class="vc-plan-thumb" src="' + src + '" alt="" />' : '<span class="vc-pill is-done">Done</span>';
        } else if (k === 'failed') html = '<span class="vc-pill is-failed">Couldn’t generate</span>';
        if (st.dataset.k !== html) { st.innerHTML = html; st.dataset.k = html; }
      });
      runBtnEl.disabled = busy > 0;
      runBtnEl.querySelector('span').textContent = busy ? 'Running…' : doneN && doneN === runnable ? 'Run again' : 'Run workflow';
    };
    const timer = setInterval(paint, 400);
    paint();
    scrollDown();
  };

  // ---- the selection as context: nodes selected on the canvas are what
  // the agent builds from ("make a video from this") ----
  const contextNodes = () => selected().filter((n) => n.type !== 'model3d').slice(0, 4);
  const n0 = (ctx) => ctx[0].type;
  const paintContext = () => {
    const el = $('vc-chat-context');
    const ctx = contextNodes();
    if (!ctx.length || !chatOpen()) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = '<span class="vc-ctx-chip"><span class="vc-ctx-dots">' + ctx.map((n) =>
      '<i class="is-' + n.type + '"></i>').join('') + '</span>From ' +
      (ctx.length === 1 ? 'the selected ' + TYPE_NAMES[n0(ctx)].toLowerCase() : ctx.length + ' selected nodes') +
      '<button type="button" class="vc-ctx-x" aria-label="Build from nothing selected">' +
      '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 5l6 6M11 5l-6 6"/></svg></button></span>';
    el.querySelector('.vc-ctx-x').onclick = () => { setSel([]); paintContext(); };
  };

  // ---- the test run's planner: what the request asks for, as a graph ----
  const localPlan = (q, ctx) => {
    const lower = q.toLowerCase();
    const words = q.length > 220 ? q.slice(0, 217) + '…' : q;
    const ctxImg = (ctx || []).filter((c) => c.type === 'image');
    const wantsVideo = /video|motion|clip|reel|animate|film|moving|ad\b|turning|in motion/.test(lower);
    if (ctxImg.length && wantsVideo) {
      return { reply: 'A clip that opens on your picture, moving the way you described.', nodes: [
        { key: 't', type: 'text', prompt: words }, { key: 'v', type: 'video' }],
        edges: [{ from: 't', to: 'v', port: 'prompt' }, { from: ctxImg[0].key, to: 'v', port: 'firstFrame' }]
          .concat(ctxImg.slice(1).map((c) => ({ from: c.key, to: 'v', port: 'refs' }))) };
    }
    if (ctxImg.length) {
      return { reply: 'A new image that draws on the pictures you selected.', nodes: [
        { key: 't', type: 'text', prompt: words }, { key: 'i', type: 'image' }],
        edges: [{ from: 't', to: 'i', port: 'prompt' }].concat(ctxImg.map((c) => ({ from: c.key, to: 'i', port: 'image' }))) };
    }
    if (/blend|combine|mix|merge|fuse|between/.test(lower)) {
      const parts = q.replace(/^.*?(blend|combine|mix|merge|fuse)\s*/i, '').split(/\s+(?:and|with|\+)\s+/i);
      const a = (parts[0] || 'the first subject').replace(/\s+into.*$/i, '');
      const b = (parts[1] || 'the second subject').replace(/\s+into.*$/i, '');
      return { reply: 'Two references, each from its own prompt, blended into one new image.', nodes: [
        { key: 'ta', type: 'text', prompt: a }, { key: 'tb', type: 'text', prompt: b },
        { key: 'ia', type: 'image' }, { key: 'ib', type: 'image' },
        { key: 'tc', type: 'text', prompt: 'One cinematic image that blends both references: ' + words },
        { key: 'ic', type: 'image' }],
        edges: [{ from: 'ta', to: 'ia', port: 'prompt' }, { from: 'tb', to: 'ib', port: 'prompt' },
          { from: 'ia', to: 'ic', port: 'image' }, { from: 'ib', to: 'ic', port: 'image' }, { from: 'tc', to: 'ic', port: 'prompt' }] };
    }
    if (/3d|model|mesh|sculpt|figurine/.test(lower) && !LIVE) {
      return { reply: 'A prompt, a picture of the subject, and a 3D model built from it.', nodes: [
        { key: 't', type: 'text', prompt: words }, { key: 'i', type: 'image' }, { key: 'm', type: 'model3d' }],
        edges: [{ from: 't', to: 'i', port: 'prompt' }, { from: 'i', to: 'm', port: 'image' }] };
    }
    if (/three|3 (looks|takes|versions|directions)|variations|options/.test(lower)) {
      return { reply: 'One brief, three directions — each its own image node, side by side.', nodes: [
        { key: 't', type: 'text', prompt: words }, { key: 'a', type: 'image' }, { key: 'b', type: 'image', model: MODELS.image[1] },
        { key: 'c', type: 'image', model: MODELS.image[2] }],
        edges: [{ from: 't', to: 'a', port: 'prompt' }, { from: 't', to: 'b', port: 'prompt' }, { from: 't', to: 'c', port: 'prompt' }] };
    }
    if (wantsVideo) {
      return { reply: 'A prompt, a key frame made from it, and a clip that opens on that frame.', nodes: [
        { key: 't', type: 'text', prompt: words }, { key: 'i', type: 'image' }, { key: 'v', type: 'video' }],
        edges: [{ from: 't', to: 'i', port: 'prompt' }, { from: 'i', to: 'v', port: 'firstFrame' },
          { from: 't', to: 'v', port: 'prompt' }] };
    }
    return { reply: 'One prompt racing two image models, so you can pick the better take.', nodes: [
      { key: 't', type: 'text', prompt: words }, { key: 'a', type: 'image' }, { key: 'b', type: 'image', model: MODELS.image[2] }],
      edges: [{ from: 't', to: 'a', port: 'prompt' }, { from: 't', to: 'b', port: 'prompt' }] };
  };
  const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? 0 : ms));
  // laying a plan on the canvas: columns by depth, to the right of what
  // is there (or of the nodes it builds from), each node arriving a beat
  // after the last, then its wires
  const buildPlan = async (plan, ctx) => {
    push();
    const ctxMap = new Map((ctx || []).map((c) => [c.key, c.node]));
    const depth = {};
    plan.nodes.forEach((pn) => { depth[pn.key] = 0; });
    ctxMap.forEach((n, k) => { depth[k] = -1; });
    for (let k = 0; k < plan.nodes.length + 2; k++) {
      plan.edges.forEach((e) => {
        if (depth[e.to] == null || depth[e.from] == null) return;
        if (depth[e.to] <= depth[e.from]) depth[e.to] = depth[e.from] + 1;
      });
    }
    const anchor = ctxMap.size ? [...ctxMap.values()] : nodes;
    const x0 = anchor.length ? Math.max(...anchor.map((n) => n.x + TYPES[n.type].w)) + 160 : 80;
    const y0 = anchor.length ? Math.min(...anchor.map((n) => n.y)) : 60;
    const colY = {};
    const made = [];
    const byKey = new Map(ctxMap);
    const order = plan.nodes.map((pn, i) => ({ pn: pn, i: i })).sort((a, b) => depth[a.pn.key] - depth[b.pn.key]);
    const madeAt = new Array(plan.nodes.length);
    for (const o of order) {
      const pn = o.pn;
      const d = Math.max(0, depth[pn.key]);
      const x = x0 + d * 480;
      const y = colY[d] == null ? y0 : colY[d];
      const n = addNode(pn.type, x, y, Object.assign({ id: 'n' + (nid + 1), status: 'idle' },
        pn.prompt != null ? { prompt: pn.prompt } : {}, pn.model ? { model: pn.model } : {}));
      colY[d] = y + nodeH(n) + 70;
      n.el.classList.add('is-born');
      byKey.set(pn.key, n);
      madeAt[o.i] = n;
      drawEdges();
      paintMap();
      watchEmpty();
      await wait(200);
    }
    for (const e of plan.edges) {
      const a = byKey.get(e.from), b = byKey.get(e.to);
      if (a && b) connect(a, b, e.port, true);
      await wait(80);
    }
    madeAt.forEach((n) => made.push(n));
    plan.depthOf = plan.nodes.map((pn) => Math.max(0, depth[pn.key]));
    drawEdges();
    paintCost();
    fitView();
    // nothing is left selected: a selected group lies under its selection
    // box, which would catch the first press meant for a node's Generate
    setSel([]);
    return made;
  };
  const ask = async (q) => {
    q = (q || '').trim();
    if (chatBusy || !q) return;
    chatBusy = true;
    chatSend.disabled = true;
    $('vc-chat-hero').hidden = true;
    $('vc-chat-suggest').hidden = true;
    const ctx = contextNodes().map((n, i) => ({ key: 's' + (i + 1), type: n.type, node: n,
      prompt: n.type === 'text' ? n.prompt : undefined }));
    say(q, 'user');
    const think = thinking();
    let plan;
    let note = '';
    const started = Date.now();
    try {
      if (LIVE && LIVE.plan) {
        plan = await LIVE.plan(q, ctx.map((c) => ({ key: c.key, type: c.type, prompt: c.prompt })));
      } else plan = localPlan(q, ctx);
    } catch (err) {
      plan = localPlan(q, ctx);
      note = ' (The planner was out of reach, so this is the simple plan.)';
    }
    // the steps get their moment even when the plan comes back at once
    await wait(Math.max(0, 2200 - (Date.now() - started)));
    think.done();
    await wait(260);
    think.row.remove();
    const row = say((plan.reply || 'Here is the workflow.') + note, 'agent');
    const made = await buildPlan(plan, ctx);
    planCard(row, plan, made);
    chatBusy = false;
    chatSend.disabled = !chatIn.value.trim();
    paintContext();
  };
  $('vc-chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = chatIn.value;
    chatIn.value = '';
    chatIn.style.height = '';
    chatSend.disabled = true;
    ask(q);
  });
  chatIn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('vc-chat-form').requestSubmit(); }
  });
  chatIn.addEventListener('input', () => {
    chatIn.style.height = 'auto';
    chatIn.style.height = Math.min(140, chatIn.scrollHeight) + 'px';
    chatSend.disabled = chatBusy || !chatIn.value.trim();
  });
  root.addEventListener('vc-selection', () => { if (chatOpen()) paintContext(); });
  $('vc-chat-suggest').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) ask(b.dataset.q || b.textContent);
  });
  // ============================================================
  // the Asset Library: everything made with Vicino, in one grid — what
  // this live run has generated first, newest on top, then the library.
  // A tile goes on the canvas as a node holding that picture or clip, by
  // a click or by dragging it where it should go, ready to wire into
  // anything that takes it (a reference for an image, a first frame for
  // a video). For now the library itself is the board's own run: the
  // two frames of the winger and the clip made from them.
  // ============================================================
  const LIBRARY = [
    { kind: 'image', src: MEDIA.image[0], name: 'Winger shielding the ball', model: 'flux-2-pro' },
    { kind: 'video', src: MEDIA.clip, poster: MEDIA.clipPoster, name: 'Dribble past the defence', model: 'veo3.1', dur: '6s', anim: true },
    { kind: 'image', src: MEDIA.image[1], name: 'Carry between two defenders', model: 'ideogram-v3' },
  ];
  let libFilter = 'all';
  let libItems = [];
  const sessionItems = () => made.slice().reverse()
    .map((a) => ({ kind: a.kind, src: a.url, blob: a.blob, name: a.prompt || TYPE_NAMES[a.kind],
      model: a.model, dur: a.dur, mine: true }));
  const tileHTML = (it, i) => '<button type="button" class="vc-lib-tile is-' + it.kind + '" data-i="' + i + '" draggable="true" title="' + esc(it.name) + '">' +
    (it.kind === 'video' && !it.anim ? '<video src="' + it.src + '" muted loop playsinline autoplay></video>'
      : '<img src="' + it.src + '" alt="" loading="lazy" draggable="false" />') +
    (it.kind === 'video' ? '<span class="vc-lib-badge"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3.9v8.2a.6.6 0 0 0 .9.5l6.6-4.1a.6.6 0 0 0 0-1L6.4 3.4a.6.6 0 0 0-.9.5z" fill="currentColor" stroke="none"/></svg>' + esc(it.dur || '') + '</span>' : '') +
    '<span class="vc-lib-meta"><strong>' + esc(it.name) + '</strong><em>' + esc(it.model || '') + '</em></span>' +
    '<span class="vc-lib-add" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M8 3.5v9M3.5 8h9"/></svg></span></button>';
  const paintLibrary = () => {
    const q = ($('vc-lib-q').value || '').trim().toLowerCase();
    const keep = (it) => (libFilter === 'all' || it.kind === libFilter) && (!q || it.name.toLowerCase().includes(q) || (it.model || '').includes(q));
    const all = sessionItems();
    const mine = all.filter(keep);
    const lib = LIBRARY.filter(keep);
    libItems = mine.concat(lib);
    // a live run keeps a place for its own results from the start, so
    // the first thing it makes has somewhere it is expected to land
    const session = LIVE && !q
      ? '<p class="vc-lib-head">This session</p>' + (mine.length
        ? '<div class="vc-lib-grid">' + mine.map((it, i) => tileHTML(it, i)).join('') + '</div>'
        : '<p class="vc-lib-none">' + (all.length ? 'Nothing of this kind yet'
          : 'What you generate here lands here, ready to use again') + '</p>')
      : mine.length ? '<p class="vc-lib-head">This session</p><div class="vc-lib-grid">' +
        mine.map((it, i) => tileHTML(it, i)).join('') + '</div>' : '';
    $('vc-lib-grid').innerHTML = session +
      (lib.length ? (session ? '<p class="vc-lib-head">Library</p>' : '') + '<div class="vc-lib-grid">' +
        lib.map((it, i) => tileHTML(it, mine.length + i)).join('') + '</div>'
        : mine.length ? '' : '<p class="vc-lib-empty">Nothing matches</p>');
  };
  $('vc-lib-q').addEventListener('input', paintLibrary);
  $('vc-lib-q').addEventListener('keydown', (e) => e.stopPropagation());
  $('vc-lib-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    libFilter = b.dataset.f;
    $('vc-lib-tabs').querySelectorAll('button').forEach((x) => x.classList.toggle('is-on', x === b));
    paintLibrary();
  });
  $('vc-lib-x').addEventListener('click', () => setDock(null));
  // a library asset on the canvas: a node already holding it, done
  const addAsset = async (it, at) => {
    if (!LIVE) return toast('Adding to the canvas is part of Live Run');
    const type = it.kind === 'video' ? 'video' : 'image';
    const n = createNode(type, at);
    try {
      const blob = it.blob || await (await fetch(it.src)).blob();
      liveArt.set(n.id, { kind: type, blob: blob, url: URL.createObjectURL(blob), model: 'library',
        prompt: it.name, anim: !!it.anim });
      n.status = 'done';
      paintStatus(n);
      revealArt(n);
      refreshFed(n);
    } catch (err) {
      toast('That asset could not be loaded');
    }
  };
  $('vc-lib-grid').addEventListener('click', (e) => {
    const t = e.target.closest('.vc-lib-tile');
    if (t) addAsset(libItems[+t.dataset.i]);
  });
  $('vc-lib-grid').addEventListener('dragstart', (e) => {
    const t = e.target.closest('.vc-lib-tile');
    if (!t) return;
    e.dataTransfer.setData('text/vc-asset', t.dataset.i);
    e.dataTransfer.effectAllowed = 'copy';
  });
  viewport.addEventListener('dragover', (e) => {
    if (!e.dataTransfer.types.includes('text/vc-asset')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  viewport.addEventListener('drop', (e) => {
    const k = e.dataTransfer.getData('text/vc-asset');
    if (k === '') return;
    e.preventDefault();
    const it = libItems[+k];
    const w = toWorld(toLocal(e));
    addAsset(it, { x: w.x - TYPES.image.w / 2, y: w.y - 60 });
  });

  const planFor = (target, q) => {
    const plan = localPlan((target === 'video' ? 'video: ' : target === 'model3d' ? '3d: ' : '') + q, []);
    buildPlan(plan, []);
    return plan.nodes.length;
  };

  // ============================================================
  // empty state — a deleted-bare board asks what's next
  // ============================================================
  // a live run's empty board is just the canvas — clean, with nothing
  // over it; only the test run, emptied by hand, says how to bring it back
  const watchEmpty = () => { emptyEl.hidden = nodes.length > 0 || !!LIVE; };

  // ============================================================
  // live: making nodes. The test run's board is a fixed demo, and every
  // verb below says so there (sayDecor); a live run is a working canvas,
  // so Create, the canvas's right-click menu, Duplicate, copy and paste
  // all make real nodes, and a wire let go on empty canvas offers the
  // nodes that can take it, made already wired.
  // ============================================================
  const createNode = (type, at, quiet) => {
    if (!quiet) push();
    let p = at;
    if (!p) {
      // the middle of the view, or, if a node is already there, the
      // nearest clear place to its right or below, so a node made from
      // Create never lands on top of one already on the board
      const c = toWorld({ x: viewport.offsetWidth / 2, y: viewport.offsetHeight / 2 });
      const w = TYPES[type].w, h = TYPES[type].h, gap = 40;
      const clear = (x, y) => !nodes.some((n) => x < n.x + TYPES[n.type].w + gap &&
        x + w + gap > n.x && y < n.y + nodeH(n) + gap && y + h + gap > n.y);
      const x0 = c.x - w / 2, y0 = c.y - h / 2;
      p = { x: x0, y: y0 };
      search: for (let ring = 0; ring < 8; ring++) {
        for (let i = 0; i <= ring; i++) {
          for (const [dx, dy] of [[ring, i], [i, ring]]) {
            const x = x0 + dx * (w + gap) / 2, y = y0 + dy * (h + gap) / 2;
            if (clear(x, y)) { p = { x: x, y: y }; break search; }
          }
        }
      }
    }
    const n = addNode(type, p.x, p.y);
    // selected, so it reads as the one just made, but without the
    // properties panel a single selection opens: a node just made is
    // about to be typed into or wired, and the panel would cover the board
    setSel([n]);
    closePanel();
    drawEdges();
    paintCost();
    paintMap();
    watchEmpty();
    if (type === 'text') requestAnimationFrame(() => n.el.querySelector('.vc-prompt').focus({ preventScroll: true }));
    return n;
  };
  const addItems = (at) => [
    { label: 'Add Text Prompt', act: () => createNode('text', at) },
    { label: 'Add Image', act: () => createNode('image', at) },
    { label: 'Add Video', act: () => createNode('video', at) },
    { label: 'Add 3D Model', hint: 'not in live runs', disabled: true, act: () => {} },
  ];
  // a wire from an output, let go on empty canvas: the nodes that take
  // what it carries, each made with the wire already in the right port
  const offerFromWire = (from, w, local) => {
    const type = TYPES[from.type].outputs[0].type;
    const offers = ['image', 'video'].filter((t) => TYPES[t].inputs.some((x) => x.type === type));
    if (!offers.length) return;
    const hint = { text: 'prompt', image: { image: 'reference', video: 'first frame' } };
    showMenu(offers.map((t) => ({
      label: '<span class="vc-menu-type is-' + t + '">' + icon(GLYPH[t]) + '</span>Add ' + TYPES[t].name,
      hint: type === 'text' ? 'prompt' : hint.image[t],
      act: () => {
        push();
        const n = createNode(t, { x: w.x, y: w.y - PORT_TOP }, true);
        connect(from, n, null, true);
        drawEdges();
      },
    })), local);
  };
  // duplicate and paste share one copier: the nodes, their settings and
  // the wires between them, under new ids and a step away; never a result
  // (a copy has not been run)
  const copyOf = (list) => {
    const ids = new Set(list.map((n) => n.id));
    return {
      nodes: list.map((n) => ({ id: n.id, type: n.type, x: n.x, y: n.y, prompt: n.prompt,
        model: n.model, aspect: n.aspect, dur: n.dur, res: n.res })),
      edges: edges.filter((e) => ids.has(e.from.n) && ids.has(e.to.n))
        .map((e) => ({ type: e.type, from: e.from.n, to: e.to.n, port: e.to.port })),
    };
  };
  const pasteCopy = (c, d) => {
    if (!c || !c.nodes.length) return;
    push();
    const made = new Map();
    c.nodes.forEach((n) => {
      const m = addNode(n.type, n.x + d, n.y + d, Object.assign({}, n,
        { id: 'n' + (nid + 1), status: 'idle' }));
      made.set(n.id, m);
    });
    c.edges.forEach((e) => edges.push({ id: 'e' + (++eid), type: e.type,
      from: { n: made.get(e.from).id, port: 'output' },
      to: { n: made.get(e.to).id, port: e.port } }));
    setSel([...made.values()]);
    drawEdges();
    paintCost();
    paintMap();
    watchEmpty();
  };
  let clipboard = null, pastes = 0;

  // ---- a node's type, changed from its header: the node keeps its
  // place, its id and its words, takes the new type's default model, and
  // keeps every wire the new type can still take (an image wire into a
  // video lands on its first frame, a text wire on its prompt) ----
  const TYPE_NAMES = { text: 'Text Prompt', image: 'Image', video: 'Video', model3d: '3D Model' };
  // what a node holds fixes what it is: words in a prompt, or a picture
  // or clip in its well (or one on the way). Only an empty node can
  // become another kind. The stylesheet draws the same rule, from the
  // same facts, by dropping the header's chevron.
  const filled = (n) => n.type === 'text' ? !!(n.prompt || '').length
    : !!n.el.querySelector('.vc-well.has-art') || liveArt.has(n.id) ||
      ['queued', 'running', 'validating'].includes(n.status);
  world.addEventListener('pointerover', (e) => {
    const b = e.target.closest('.vc-type');
    const n = b && nodeById(b.closest('.vc-node').dataset.id);
    if (n) b.title = filled(n) ? TYPES[n.type].name + ' (it holds content, so its type is set)' : 'Change node type';
  });
  const typeMenu = (n, anchor) => {
    const rr = root.getBoundingClientRect(), r = anchor.getBoundingClientRect(), sc = scaleOf();
    const kinds = ['text', 'image', 'video'].concat(LIVE ? [] : ['model3d']);
    showMenu(kinds.map((k) => ({
      label: '<span class="vc-menu-type is-' + k + '">' + icon(GLYPH[k]) + '</span>' + TYPE_NAMES[k],
      hint: k === n.type ? '✓' : '',
      act: () => convertNode(n, k),
    })), { x: (r.left - rr.left) / sc, y: (r.bottom - rr.top) / sc + 6, root: true });
    menuOwner = anchor;
  };
  const convertNode = (n, type) => {
    if (n.type === type) return;
    push();
    const outs = edges.filter((e) => e.from.n === n.id);
    const ins = edges.filter((e) => e.to.n === n.id);
    edges = edges.filter((e) => e.from.n !== n.id && e.to.n !== n.id);
    if (liveArt.has(n.id)) { URL.revokeObjectURL(liveArt.get(n.id).url); liveArt.delete(n.id); }
    n.el.remove();
    nodes = nodes.filter((m) => m !== n);
    const m = addNode(type, n.x, n.y, { id: n.id, prompt: n.prompt, status: 'idle',
      aspect: n.aspect, dur: n.dur, res: n.res });
    const carries = TYPES[type].outputs[0].type;
    outs.forEach((e) => {
      const to = nodeById(e.to.n);
      const spec = to && TYPES[to.type].inputs.find((i) => i.type === carries);
      if (spec) connect(m, to, spec.key, true);
    });
    ins.forEach((e) => {
      const from = nodeById(e.from.n);
      const spec = TYPES[type].inputs.find((i) => i.type === e.type);
      if (from && spec) connect(from, m, spec.key, true);
    });
    // the node keeps its id, so the selection looks unchanged — the
    // panel is told plainly to redraw for the new type
    selSig = '';
    setSel([m]);
    drawEdges();
    drawGroups();
    paintCost();
    paintMap();
  };
  // a node that has just made something refreshes the wells it feeds,
  // so their thumbnails turn from a glyph into the picture
  const refreshFed = (n) => edges.forEach((e) => {
    if (e.from.n !== n.id) return;
    const m = nodeById(e.to.n);
    if (m && !['queued', 'running', 'validating'].includes(m.status)) {
      if (m.el.querySelector('.vc-well.has-art')) revealArt(m); else clearArt(m);
    }
  });
  // a port that is missing its input rings twice, softly red
  const pulsePort = (n) => {
    n.el.classList.remove('is-wanting');
    void n.el.offsetWidth;
    n.el.classList.add('is-wanting');
  };
  const duplicate = (list) => pasteCopy(copyOf(list), 40);

  // ============================================================
  // rail, toolbar, keyboard
  // ============================================================
  const setMode = (m) => {
    mode = m;
    $('vc-select').classList.toggle('is-on', m === 'select');
    $('vc-hand').classList.toggle('is-on', m === 'hand');
    root.classList.toggle('is-hand', m === 'hand');
  };
  $('vc-select').addEventListener('click', () => setMode('select'));
  $('vc-hand').addEventListener('click', () => setMode('hand'));
  $('vc-undo').addEventListener('click', undo);
  $('vc-redo').addEventListener('click', redo);
  $('vc-zin').addEventListener('click', () => { zoomTo(view.z * 1.2); applyView(); });
  $('vc-zout').addEventListener('click', () => { zoomTo(view.z / 1.2); applyView(); });
  $('vc-fit').addEventListener('click', fitView);
  $('vc-arrange').addEventListener('click', autoArrange);
  runBtn.addEventListener('click', () => runScope());
  // Create keeps its place at the top of the rail: in the test run it
  // says what it is, like Share, Publish, Assets and Community beside it;
  // in a live run it opens the menu of nodes to add
  $('vc-rail-add').addEventListener('click', () => {
    if (!LIVE) return sayDecor();
    menuFrom($('vc-rail-add'), addItems(), 'right');
  });
  root.querySelectorAll('.vc-pill[data-fake]').forEach((b) =>
    b.addEventListener('click', () =>
      toast(b.dataset.fake === 'share' ? 'Share is decorative here — the demo has no backend' :
        'Publish is decorative here — the demo has no backend')));
  // the rail: the library opens in the dock; the globe opens Vicino's
  // own community, in a new tab
  $('vc-rail-assets').addEventListener('click', () => setDock(dockOpen === 'lib' ? null : 'lib'));
  $('vc-rail-community').addEventListener('click', () => window.open('https://vicino.ai/community', '_blank', 'noopener'));
  const paintToolbar = () => {
    $('vc-undo').disabled = !past.length;
    $('vc-redo').disabled = !future.length;
  };

  root.tabIndex = -1;
  root.addEventListener('keydown', (e) => {
    if (!engaged) return;
    if (viewerOpen()) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        stepViewer(e.key === 'ArrowLeft' ? -1 : 1);
      }
      return;
    }
    if (e.target.closest('.vc-prompt, .vc-chat, input, textarea')) return;
    const meta = e.metaKey || e.ctrlKey;
    if (meta && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      e.shiftKey ? redo() : undo();
    } else if (meta && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
    } else if (LIVE && meta && e.key.toLowerCase() === 'c') {
      if (!selected().length) return;
      e.preventDefault();
      clipboard = copyOf(selected());
      pastes = 0;
    } else if (LIVE && meta && e.key.toLowerCase() === 'd') {
      if (!selected().length) return;
      e.preventDefault();
      duplicate(selected());
    } else if (meta && e.key.toLowerCase() === 'v') {
      // in the test run, ⌘C/⌘V would mint nodes, so the board keeps
      // neither — but a reader who reaches for paste deserves the reason,
      // not silence. In a live run, paste is paste.
      e.preventDefault();
      if (!LIVE) sayDecor();
      else pasteCopy(clipboard, 40 * ++pastes);
    } else if (meta && (e.key === '=' || e.key === '+')) {
      e.preventDefault(); zoomTo(view.z * 1.2); applyView();
    } else if (meta && e.key === '-') {
      e.preventDefault(); zoomTo(view.z / 1.2); applyView();
    } else if (meta && e.key === '0') {
      e.preventDefault(); fitView();
    } else if (e.key === 'v' || e.key === 'V') setMode('select');
    else if (e.key === 'h' || e.key === 'H') setMode('hand');
    else if ((e.key === 'Delete' || e.key === 'Backspace') && !running) {
      const sel = selected();
      if (!sel.length) return;
      e.preventDefault();
      askDelete(sel);
    } else if (e.key.startsWith('Arrow')) {
      const sel = selected();
      if (!sel.length) return;
      e.preventDefault();
      const d = { ArrowLeft: [-GRID, 0], ArrowRight: [GRID, 0],
        ArrowUp: [0, -GRID], ArrowDown: [0, GRID] }[e.key];
      sel.forEach((n) => { n.x += d[0]; n.y += d[1]; place(n); });
      drawEdges();
      drawGroups();
      paintSelection();
    }
  });

  // Escape walks inward-out: menus, chat, selection — the theater asks
  // this first and only closes itself when nothing here consumed it
  const handleEscape = () => {
    if (viewerOpen()) { closeViewer(); return true; }
    if (!menuEl.hidden || !confirmEl.hidden || !zoomMenu.hidden) {
      closeMenu();
      confirmEl.hidden = true;
      zoomMenu.hidden = true;
      return true;
    }
    if (dockOpen) { setDock(null); return true; }
    if (selected().length) { setSel([]); return true; }
    return false;
  };

  // focusing a field the canvas has panned half out of view makes the
  // browser scroll the clipped viewport to bring it in, which would slide
  // the whole board out from under its own coordinates. The board moves
  // only by its own pan, so any such scroll is put straight back.
  [root, viewport].forEach((el) => el.addEventListener('scroll', () => {
    if (el.scrollTop || el.scrollLeft) { el.scrollTop = 0; el.scrollLeft = 0; }
  }));

  // ---- a dictation app keeps its place. Wispr Flow (and tools like it)
  // remembers the field you were in when you began speaking, and focuses
  // it again just before it pastes. If the browser has rebuilt its
  // picture of the page in between (the board adds nodes and wires while
  // the AI builds or a run finishes), that field can no longer be found,
  // and Wispr focuses the whole page instead: no field holds the cursor,
  // and the words it pastes go nowhere. So when focus drops out of a
  // prompt or the chat box onto nothing, with no click or key of the
  // user's behind it, the field takes the cursor straight back, where it
  // left it, before the paste arrives. A click elsewhere, a key (Tab,
  // Escape), or leaving the window all still move focus as they always
  // did; only a fall onto nothing, from no one, is undone.
  let lastAct = 0;
  ['pointerdown', 'keydown', 'wheel'].forEach((t) =>
    document.addEventListener(t, () => { lastAct = performance.now(); }, { capture: true, passive: true }));
  root.addEventListener('focusout', (e) => {
    const field = e.target;
    if (!engaged || !field.matches || !field.matches('.vc-prompt, #vc-chat-in')) return;
    if (e.relatedTarget && e.relatedTarget !== root) return;
    if (performance.now() - lastAct < 400) return;
    queueMicrotask(() => {
      const now = document.activeElement;
      if (!document.hasFocus() || (now && now !== document.body && now !== root)) return;
      if (field.isConnected && field.getClientRects().length &&
        getComputedStyle(field).visibility === 'visible') field.focus({ preventScroll: true });
    });
  });

  // prompt edits land in state
  world.addEventListener('input', (e) => {
    const p = e.target.closest('.vc-prompt');
    if (!p) return;
    const n = nodeById(p.closest('.vc-node').dataset.id);
    if (!n) return;
    n.prompt = p.value;
    clearTimeout(n._snipT);
    n._snipT = setTimeout(() => edges.forEach((ed) => {
      const m = ed.from.n === n.id && nodeById(ed.to.n);
      if (m && !m.el.querySelector('.vc-well.has-art') && !['queued', 'running', 'validating'].includes(m.status)) clearArt(m);
    }), 250);
    // the panel's quote of this prompt follows the card as it is typed
    const quote = panelFor === n && panel.querySelector('.vc-p-quote');
    if (quote) quote.textContent = '“' + n.prompt + '”';
  });

  // ---- engaged: parked in a tile = a live picture; full-window on
  // canvas.html = the real instrument, with the input to prove it
  const setTheater = (on) => {
    engaged = on;
    root.classList.toggle('is-parked', !on);
    if (on) {
      closeMenu();
      requestAnimationFrame(() => {
        fitView();
        root.focus({ preventScroll: true });
      });
    } else {
      stageScale = 0;                    // back to inferring the seat's zoom
      closeMenu();
      zoomMenu.hidden = true;
      confirmEl.hidden = true;
      requestAnimationFrame(fitView);
    }
  };
  root.classList.add('is-parked');

  // ============================================================
  // the opening graph — prompt → two images in parallel → video,
  // and an image → 3D branch, so every port color is on the board
  // ============================================================
  const t1 = addNode('text', 40, 380);
  const i1 = addNode('image', 640, 60);
  const i2 = addNode('image', 640, 600);
  // two image nodes off one prompt because they're racing MODELS — the
  // real reason boards fan out like this
  i2.model = 'ideogram-v3';
  paintModel(i2);
  const v1 = addNode('video', 1250, 30);
  const m1 = addNode('model3d', 1250, 610);
  edges.push(
    { id: 'e1', type: 'text', from: { n: t1.id, port: 'output' }, to: { n: i1.id, port: 'prompt' } },
    { id: 'e2', type: 'text', from: { n: t1.id, port: 'output' }, to: { n: i2.id, port: 'prompt' } },
    { id: 'e3', type: 'image', from: { n: i1.id, port: 'output' }, to: { n: v1.id, port: 'firstFrame' } },
    { id: 'e4', type: 'image', from: { n: i2.id, port: 'output' }, to: { n: m1.id, port: 'image' } });
  eid = 4;
  // ...and it opens RESOLVED. The board a reader meets is the board
  // after a run: both frames returned, the clip looping, the mesh
  // turning. The ladder (queued → running → validating → done) is still
  // the whole point of pressing Run — it just isn't the price of
  // admission any more.
  warmMedia();
  nodes.forEach((n) => {
    if (!TYPES[n.type].runs) return;
    n.status = 'done';
    paintStatus(n);
    revealArt(n);
  });
  runBtn.querySelector('span').textContent = 'Run again';
  drawEdges();
  paintToolbar();
  paintCost();
  paintMap();

  requestAnimationFrame(fitView);
  window.addEventListener('resize', () => { if (!engaged) fitView(); });
  // ---- live: canvas.html hands over vicino-live.js once the relay has
  // taken the password. The test run's graph is a fixed demo, made of
  // results nobody generated, so a live run starts on a blank canvas: the
  // nodes, the wires, the groups and the undo history all go, and the
  // empty state says how to begin. The board's name says which run it is.
  const setLive = (api) => {
    if (LIVE || !api) return;
    runToken++;                          // a test run still stepping stops here
    running = false;
    LIVE = api;
    closePanel();
    closeMenu();
    nodes.forEach((n) => n.el.remove());
    nodes = [];
    edges = [];
    groups = [];
    past.length = 0;
    future.length = 0;
    setSel([]);
    root.classList.add('is-live');
    root.querySelector('.vc-board').textContent = 'Live Run';
    view.x = 0;
    view.y = 0;
    view.z = 1;
    applyView();
    paintLiveRuns();
    drawEdges();
    drawGroups();
    paintToolbar();
    paintCost();
    paintMap();
    watchEmpty();
  };

  // ---- the board name's menu: which run this is, and the way to the
  // other. Live Run is offered only where a page has said how to open it
  // (canvas.html, full window); the old site's copy and a frame have none.
  $('vc-brand').addEventListener('click', () => {
    if (!engaged) return;
    const brand = $('vc-brand');
    menuFrom(brand, LIVE ? [
      { label: 'Live Run', hint: '✓', act: () => {} },
      { label: 'Back to the test run', act: () => location.reload() },
      '-',
      { label: 'Forget the password here', act: () => {
        LIVE.forget();
        toast('This browser will ask for the password next time');
      } },
    ] : [
      { label: 'Test run', hint: '✓', act: () => {} },
      { label: 'Live Run', hint: 'password', disabled: !liveHandler, act: () => liveHandler() },
    ]);
  });
  // a press anywhere but the menu or its own button closes it
  root.addEventListener('pointerdown', (e) => {
    if (menuEl.hidden || e.target.closest('.vc-menu')) return;
    if (menuOwner && menuOwner.contains(e.target)) return;
    closeMenu();
  }, true);

  window.VicinoCanvas = {
    fit: fitView, run: runScope, arrange: autoArrange, setLive: setLive,
    setLiveHandler: (fn) => { liveHandler = typeof fn === 'function' ? fn : null; },
    setTheater: setTheater, handleEscape: handleEscape,
    setStageScale: (z) => { stageScale = z || 0; },
  };
})();
