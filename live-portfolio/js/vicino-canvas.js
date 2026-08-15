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
  // the vocabulary — node types, real model ids, the shipped port
  // colors (light-theme handle pills) and the soft-purple edge
  // ============================================================
  const PORT_COLOR = {
    text: '#9b9cf1', image: '#8bd6d9', video: '#ffb366', model3d: '#7cc0e8',
  };
  const PORT_GLOW = {
    text: 'rgba(155,156,241,0.4)', image: 'rgba(139,214,217,0.4)',
    video: 'rgba(255,179,102,0.4)', model3d: 'rgba(124,192,232,0.4)',
  };
  const EDGE_STROKE = '#9b9cf1';         /* Figma 118:474 — soft purple */
  const MODELS = {
    image: ['flux-2-pro', 'gpt-image-2', 'ideogram-v3', 'recraft-v4'],
    video: ['veo3.1', 'kling3.0', 'seedance2.0'],
    model3d: ['tripo-3.0', 'meshy-5', 'rodin-gen2'],
  };
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
      inputs: [{ key: 'prompt', type: 'text' }, { key: 'image', type: 'image', max: 3 }],
      outputs: [{ key: 'output', type: 'image' }],
    },
    video: {
      name: 'Video', w: 380, h: 368, runs: true, dur: 2100, cost: 25,
      inputs: [{ key: 'prompt', type: 'text' }, { key: 'firstFrame', type: 'image' }],
      outputs: [{ key: 'output', type: 'video' }],
    },
    model3d: {
      name: '3D Model', w: 340, h: 340, runs: true, dur: 1800, cost: 12,
      inputs: [{ key: 'prompt', type: 'text' }, { key: 'image', type: 'image' }],
      outputs: [{ key: 'output', type: 'model3d' }],
    },
  };
  const GRID = 10;                       // the board's snap grid
  const DOT_GAP = 50;                    // the sparse dot background
  const MIN_Z = 0.1, MAX_Z = 4;          // the shipped zoom clamp
  const CLICK_PX = 5;                    // ≤5px is a click, not a drag
  const PORT_R = 24;                     // handle hit area — port snap reach
  const RANK_GAP = 80, NODE_GAP = 60;    // auto-arrange: dagre's numbers
  const HEAD_H = 48;                     // node header height (Board.css)
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
    s.nodes.forEach((n) => addNode(n.type, n.x, n.y, n));
    s.edges.forEach((e) => edges.push({ id: e.id, from: e.from, to: e.to, type: e.type }));
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
    text: '<path d="M3.5 4.5 V3 H12.5 V4.5 M8 3 V13 M6 13 H10"/>',
    image: '<rect x="2.5" y="3" width="11" height="10" rx="1.6"/><circle cx="6" cy="6.6" r="1.2"/><path d="M2.5 11 L6.4 7.8 L9 10 L11 8.4 L13.5 10.6"/>',
    video: '<rect x="2.5" y="3.5" width="8.5" height="9" rx="1.6"/><path d="M11 7 L13.7 5.4 V10.6 L11 9"/>',
    model3d: '<path d="M8 2.5 L13 5.2 V10.8 L8 13.5 L3 10.8 V5.2 Z"/><path d="M8 2.5 V8 M3 5.2 L8 8 L13 5.2 M8 8 V13.5"/>',
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
    // ---- brand, floating top-left on the canvas ----
    '<div class="vc-brand">' +
      '<svg class="vc-logo" viewBox="0 0 26 26" aria-hidden="true">' + GLYPH.logo + '</svg>' +
      '<span class="vc-board">Test run</span>' +
      '<svg class="vc-brand-chev" viewBox="0 0 16 16" aria-hidden="true">' + GLYPH.chev + '</svg>' +
    '</div>' +
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
    '<div class="vc-chat" id="vc-chat" hidden>' +
      '<header class="vc-chat-head">' + icon(GLYPH.spark, 1) + '<span>Workflow agent</span>' +
        '<button type="button" id="vc-chat-x" aria-label="Close">' + icon(GLYPH.x) + '</button></header>' +
      '<div class="vc-chat-log" id="vc-chat-log">' +
        '<p class="vc-msg is-agent">Describe what you want to make — I’ll plan the nodes and wire them. (Simulated: the real agent runs a ReAct loop server-side.)</p>' +
      '</div>' +
      '<form class="vc-chat-form" id="vc-chat-form">' +
        '<input type="text" id="vc-chat-in" placeholder="e.g. a product video from one photo" autocomplete="off" />' +
        '<button type="submit" aria-label="Send">' + icon(GLYPH.play, 1) + '</button>' +
      '</form>' +
    '</div>' +
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
    image: ['Media/vi-canvas-out-1.webp', 'Media/vi-canvas-out-2.webp'],
    imageAlt: ['Generated frame: a winger shielding the ball past a defender',
      'Generated frame: a winger carrying the ball between two defenders'],
    clip: 'Media/vi-canvas-clip.webp',
    clipPoster: 'Media/vi-canvas-clip-poster.webp',
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
      '<div class="vc-gif" title="Click to pause">' +
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
  const portOffsets = (node) => ({
    out: { x: TYPES[node.type].w, y: PORT_TOP },
    ins: TYPES[node.type].inputs.map((p, i) => ({ key: p.key, type: p.type,
      x: 0, y: PORT_TOP + i * PORT_STEP })),
  });
  const portPos = (node, portKey, isOut) => {
    const o = portOffsets(node);
    if (isOut) return { x: node.x + o.out.x, y: node.y + o.out.y };
    const p = o.ins.find((i) => i.key === portKey);
    return p ? { x: node.x + p.x, y: node.y + p.y } : { x: node.x, y: node.y };
  };
  const nodeH = (n) => TYPES[n.type].h;
  const nodeById = (id) => nodes.find((n) => n.id === id);

  const bodyFor = (node) => {
    if (node.type === 'text') {
      return '<div class="vc-prompt" contenteditable="true" spellcheck="false" ' +
        'aria-label="Prompt text">' + node.prompt + '</div>';
    }
    return '<div class="vc-well">' +
      '<span class="vc-well-glyph">' + icon(GLYPH.upload) + '</span>' +
      '<span class="vc-well-hint">Run to generate</span>' +
      '<span class="vc-well-sub">simulated &middot; nothing uploads</span>' +
      '</div>';
  };

  const addNode = (type, x, y, saved) => {
    const t = TYPES[type];
    const node = {
      id: saved ? saved.id : 'n' + (++nid),
      type: type,
      x: snap(x), y: snap(y),
      prompt: saved && saved.prompt != null ? saved.prompt :
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
        '<span class="vc-head-icon">' + icon(GLYPH[type]) + '</span>' +
        '<span class="vc-name">' + t.name + '</span>' +
        (node.model ? '<span class="vc-badge">' + node.model + '</span>' : '') +
        (t.runs ? '<button type="button" class="vc-playchip" data-act="runone" ' +
          'title="Run this node" aria-label="Run this node">' +
          '<span class="vc-playchip-play">' + icon(GLYPH.play, 1) + '</span>' +
          '<span class="vc-playchip-check">' + icon(GLYPH.check) + '</span>' +
          '<span class="vc-playchip-dot" aria-hidden="true"></span></button>' : '') +
      '</header>' +
      '<div class="vc-body">' + bodyFor(node) + '</div>' +
      '<span class="vc-bar" aria-hidden="true"><i></i></span>';

    // ports: 10×28 pills, radius 6, white ring, colored fill + glow —
    // half tucked under the card edge, the way the shipped handles sit
    const offs = portOffsets(node);
    offs.ins.forEach((p) => {
      const s = document.createElement('span');
      s.className = 'vc-port is-in';
      s.dataset.port = p.key;
      s.style.top = p.y - 14 + 'px';
      s.style.setProperty('--pc', PORT_COLOR[p.type]);
      s.style.setProperty('--pg', PORT_GLOW[p.type]);
      s.title = p.key;
      el.appendChild(s);
    });
    const out = document.createElement('span');
    out.className = 'vc-port is-out';
    out.dataset.port = 'output';
    out.style.top = offs.out.y - 14 + 'px';
    out.style.setProperty('--pc', PORT_COLOR[t.outputs[0].type]);
    out.style.setProperty('--pg', PORT_GLOW[t.outputs[0].type]);
    out.title = 'output';
    el.appendChild(out);

    node.el = el;
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
  };
  const paintModel = (n) => {
    const chip = n.el.querySelector('.vc-badge');
    if (chip && n.model) chip.textContent = n.model;
  };
  const revealArt = (n) => {
    if (n.type === 'text') return;
    const well = n.el.querySelector('.vc-well');
    well.innerHTML = ART[n.type](+String(n.id).slice(1), n);
    well.classList.add('has-art');
    if (n.type === 'model3d') spinInit(n);
  };
  const clearArt = (n) => {
    if (n.type === 'text') return;
    const well = n.el.querySelector('.vc-well');
    well.classList.remove('has-art');
    well.innerHTML = '<span class="vc-well-glyph">' + icon(GLYPH.upload) + '</span>' +
      '<span class="vc-well-hint">Run to generate</span>' +
      '<span class="vc-well-sub">simulated &middot; nothing uploads</span>';
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
    const a = portPos(nodeById(e.from.n), e.from.port, true);
    const b = portPos(nodeById(e.to.n), e.to.port, false);
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
    edgeSvg.innerHTML = edges.map((e) => {
      const p = edgePath(e);
      const hot = nodeById(e.from.n).sel || nodeById(e.to.n).sel;
      return '<g class="vc-edge' + (e.running ? ' is-running' : '') +
        (hot ? ' is-hot' : '') + '" data-id="' + e.id + '">' +
        '<path class="vc-edge-hit" d="' + p.d + '"/>' +
        '<path class="vc-edge-line" d="' + p.d + '"/>' +
        '<g class="vc-edge-x" data-del="' + e.id + '" transform="translate(' + p.mx + ' ' + p.my + ')">' +
          '<circle r="8"/><path d="M-3 -3 L3 3 M3 -3 L-3 3"/>' +
        '</g></g>';
    }).join('') + ghost;
  };

  const connect = (fromNode, toNode, toPort, silent) => {
    const type = TYPES[fromNode.type].outputs[0].type;
    const spec = TYPES[toNode.type].inputs.find((i) => i.key === toPort);
    if (!spec || spec.type !== type || fromNode === toNode) return false;
    const already = edges.filter((e) => e.to.n === toNode.id && e.to.port === toPort);
    const max = spec.max || 1;
    if (already.length >= max) {
      if (max === 1) edges = edges.filter((e) => e !== already[0]);
      else {
        if (!silent) toast('Maximum ' + max + ' images allowed for ' + (toNode.model || toNode.type));
        return false;
      }
    }
    if (already.some((e) => e.from.n === fromNode.id)) return false;
    if (!silent) push();
    edges.push({ id: 'e' + (++eid), type: type,
      from: { n: fromNode.id, port: 'output' }, to: { n: toNode.id, port: toPort } });
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
        '<p class="vc-p-quote">&ldquo;' + n.prompt + '&rdquo;</p>' +
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
  // The board a reader meets is a FIXED graph: the five nodes it opens
  // with are the demo, and nothing here mints new ones. Creating,
  // duplicating and pasting all keep their place in the vocabulary —
  // they just say what they are. (Every other verb is real: run,
  // rewire, move, group, delete, undo.)
  // ============================================================
  const sayDecor = () =>
    toast('Adding nodes is decorative here — this board is a fixed demo');
  const closeMenu = () => { menuEl.hidden = true; };
  const showMenu = (items, local) => {
    menuEl.innerHTML = items.map((it) => it === '-' ? '<span class="vc-menu-sep"></span>' :
      '<button type="button"' + (it.disabled ? ' disabled' : '') + '>' + it.label +
      (it.hint ? '<span class="vc-menu-hint">' + it.hint + '</span>' : '') + '</button>').join('');
    [...menuEl.querySelectorAll('button')].forEach((b, i) => {
      const real = items.filter((x) => x !== '-')[i];
      b.addEventListener('click', () => { closeMenu(); real.act(); });
    });
    menuEl.hidden = false;
    const mw = 196, mh = menuEl.offsetHeight || items.length * 30;
    menuEl.style.left = Math.min(local.x, root.offsetWidth - mw - 8) + 'px';
    menuEl.style.top = Math.min(local.y, root.offsetHeight - mh - 8) + 'px';
  };
  const menuForPane = (wpt) => [
    { label: 'Add node', act: sayDecor },
    '-',
    { label: 'Auto arrange', act: autoArrange },
    { label: 'Zoom to fit', hint: '⌘0', act: fitView },
  ];
  const menuForNode = (n) => [
    { label: 'Run this node', disabled: !TYPES[n.type].runs || running, act: () => runScope([n]) },
    '-',
    { label: 'Duplicate', act: sayDecor },
    { label: 'Delete', act: () => { push(); removeNodes([n]); } },
  ];
  const menuForSelection = (sel) => [
    { label: 'Run selected (' + sel.filter((n) => TYPES[n.type].runs).length + ')',
      disabled: running, act: () => runScope(sel.filter((n) => TYPES[n.type].runs)) },
    { label: 'Create group', disabled: sel.some((n) => groupOf(n.id)), act: createGroup },
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
    } else if (portEl && nodeEl) {
      // dragging OFF an input port unplugs its edge — a small kindness
      const hit = edges.find((ed) => ed.to.n === nodeEl.dataset.id &&
        ed.to.port === portEl.dataset.port);
      if (hit) {
        push();
        edges = edges.filter((ed) => ed !== hit);
        gesture = { kind: 'wire', from: nodeById(hit.from.n) };
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
          group: selected().map((n) => ({ n: n, x: n.x, y: n.y })) };
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
      const near = nearestPort(wpt);
      const end = near || wpt;
      const a = portPos(gesture.from, 'output', true);
      const c = Math.max(46, Math.abs(end.x - a.x) * 0.5);
      ghost = '<path class="vc-ghost' + (near ? ' is-snapped' : '') +
        '" d="M' + a.x + ' ' + a.y +
        ' C' + (a.x + c) + ' ' + a.y + ',' + (end.x - c) + ' ' + end.y + ',' +
        end.x + ' ' + end.y + '"/>';
      gesture.near = near;
      drawEdges();
    }
  });

  const nearestPort = (wpt) => {
    const want = TYPES[gesture.from.type].outputs[0].type;
    let best = null, bd = PORT_R / Math.min(view.z, 1);
    nodes.forEach((n) => {
      if (n === gesture.from) return;
      TYPES[n.type].inputs.forEach((p, i) => {
        if (p.type !== want) return;
        const px = n.x, py = n.y + PORT_TOP + i * PORT_STEP;
        const d = Math.hypot(px - wpt.x, py - wpt.y);
        if (d < bd) { bd = d; best = { x: px, y: py, node: n, port: p.key }; }
      });
    });
    return best;
  };

  const endGesture = (e) => {
    if (!gesture) return;
    const g = gesture;
    gesture = null;
    root.classList.remove('is-grabbing');
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
    } else if (g.kind === 'wire') {
      if (g.near) connect(g.from, g.near.node, g.near.port);
      ghost = '';
      drawEdges();
    }
  };
  viewport.addEventListener('pointerup', endGesture);
  viewport.addEventListener('pointercancel', endGesture);

  // the header play chip, the looping video's pause, the edge ×
  world.addEventListener('click', (e) => {
    const chip = e.target.closest('.vc-playchip');
    if (chip && engaged && !running) {
      const n = nodeById(chip.closest('.vc-node').dataset.id);
      runScope([n]);
      return;
    }
    const gif = e.target.closest('.vc-gif');
    if (gif && engaged) {
      // a real pause: the poster replaces the animated source. The old
      // overlay trick left the clip decoding underneath its own poster.
      const paused = gif.classList.toggle('is-paused');
      const img = gif.querySelector('.vc-clip[data-clip]');
      if (img) img.src = paused ? MEDIA.clipPoster : img.dataset.clip;
    }
  });
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
    root.classList.remove('is-grabbing');
    lassoEl.hidden = true;
    if (g.kind === 'drag' && g.moved) push();
    if (g.kind === 'wire') { ghost = ''; drawEdges(); }
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
    const vw = viewport.offsetWidth, vh = viewport.offsetHeight;
    const pad = 0.14;
    const z = Math.min(MAX_Z, Math.max(MIN_Z,
      Math.min(vw / ((x2 - x1) * (1 + pad * 2)), vh / ((y2 - y1) * (1 + pad * 2)))));
    view.z = Math.min(z, 1.1);
    view.x = (vw - (x2 - x1) * view.z) / 2 - x1 * view.z;
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
  const chatLog = $('vc-chat-log');
  const toggleChat = () => {
    chat.hidden = !chat.hidden;
    $('vc-rail-agent').classList.toggle('is-on', !chat.hidden);
    if (!chat.hidden) $('vc-chat-in').focus();
  };
  // the sparkle is decorative for now — the chat dock stays parked
  $('vc-rail-agent').addEventListener('click', () => {
    toast('The AI workflow builder is decorative for now');
  });
  $('vc-chat-x').addEventListener('click', toggleChat);
  const say = (text, who) => {
    const p = document.createElement('p');
    p.className = 'vc-msg is-' + who;
    p.textContent = text;
    chatLog.appendChild(p);
    chatLog.scrollTop = chatLog.scrollHeight;
    return p;
  };
  $('vc-chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = $('vc-chat-in');
    const q = inp.value.trim();
    if (!q || running) return;
    inp.value = '';
    say(q, 'user');
    const think = say('planning…', 'agent');
    setTimeout(() => {
      const lower = q.toLowerCase();
      const target = /3d|model|mesh|product/.test(lower) ? 'model3d' :
        /video|motion|clip|reel|ad/.test(lower) ? 'video' : 'image';
      const plan = planFor(target, q);
      think.textContent = 'Planned ' + plan + ' steps — wired and staged. ' +
        'The real agent grounds this with search and a capability registry; ' +
        'here it lands pre-baked. Press Run.';
    }, reduceMotion ? 200 : 900);
  });
  const planFor = (target, q) => {
    push();
    const x0 = (nodes.length ? Math.max(...nodes.map((n) => n.x + TYPES[n.type].w)) : 0) + 110;
    const t = addNode('text', x0, 40);
    t.prompt = q.length > 90 ? q.slice(0, 87) + '…' : q;
    t.el.querySelector('.vc-prompt').textContent = t.prompt;
    let steps = 2;
    if (target === 'video') {
      const i = addNode('image', x0 + 460, -60);
      const v = addNode('video', x0 + 920, 90);
      connect(t, i, 'prompt', true);
      connect(t, v, 'prompt', true);
      connect(i, v, 'firstFrame', true);
      steps = 3;
    } else if (target === 'model3d') {
      const i = addNode('image', x0 + 460, -50);
      const m = addNode('model3d', x0 + 920, 80);
      connect(t, i, 'prompt', true);
      connect(i, m, 'image', true);
      connect(t, m, 'prompt', true);
      steps = 3;
    } else {
      connect(t, addNode('image', x0 + 460, -80), 'prompt', true);
      connect(t, addNode('image', x0 + 460, 300), 'prompt', true);
      steps = 3;
    }
    drawEdges();
    paintCost();
    fitView();
    return steps;
  };

  // ============================================================
  // empty state — a deleted-bare board asks what's next
  // ============================================================
  const watchEmpty = () => { emptyEl.hidden = nodes.length > 0; };

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
  // Create keeps its place at the top of the rail — it just says what it
  // is here, like Share, Publish, Assets and Community above it
  $('vc-rail-add').addEventListener('click', sayDecor);
  root.querySelectorAll('.vc-pill[data-fake]').forEach((b) =>
    b.addEventListener('click', () =>
      toast(b.dataset.fake === 'share' ? 'Share is decorative here — the demo has no backend' :
        'Publish is decorative here — the demo has no backend')));
  $('vc-rail-assets').addEventListener('click', () =>
    toast('Asset Library is decorative here — the demo has no backend'));
  $('vc-rail-community').addEventListener('click', () =>
    toast('Community is decorative here — the demo has no backend'));
  const paintToolbar = () => {
    $('vc-undo').disabled = !past.length;
    $('vc-redo').disabled = !future.length;
  };

  root.tabIndex = -1;
  root.addEventListener('keydown', (e) => {
    if (!engaged) return;
    if (e.target.closest('.vc-prompt, .vc-chat-form input')) return;
    const meta = e.metaKey || e.ctrlKey;
    if (meta && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      e.shiftKey ? redo() : undo();
    } else if (meta && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
    } else if (meta && e.key.toLowerCase() === 'v') {
      // ⌘C/⌘V would mint nodes, so the board keeps neither — but a reader
      // who reaches for paste deserves the reason, not silence
      e.preventDefault();
      sayDecor();
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
    if (!menuEl.hidden || !confirmEl.hidden || !zoomMenu.hidden) {
      closeMenu();
      confirmEl.hidden = true;
      zoomMenu.hidden = true;
      return true;
    }
    if (!chat.hidden) { toggleChat(); return true; }
    if (selected().length) { setSel([]); return true; }
    return false;
  };

  // prompt edits land in state
  world.addEventListener('input', (e) => {
    const p = e.target.closest('.vc-prompt');
    if (!p) return;
    const n = nodeById(p.closest('.vc-node').dataset.id);
    if (n) n.prompt = p.textContent;
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
  window.VicinoCanvas = {
    fit: fitView, run: runScope, arrange: autoArrange,
    setTheater: setTheater, handleEscape: handleEscape,
    setStageScale: (z) => { stageScale = z || 0; },
  };
})();
