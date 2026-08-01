// The shell — populates the mini-browser chrome and sidebar.
//
// Every page ships the same six-element skeleton (see css/shell.css for
// the frame math); the skeleton is sized by CSS alone, so the window is
// already the right shape on the very first paint and only its CONTENTS
// arrive a frame later. That one-frame gap is not a flash to hide — it
// is frame zero of the entrance (js/typewriter.js drives the timing on
// the home page; everywhere else the chrome and sidebar just light up).
//
// The precedent is js/nav-touch.js: chrome that is identical on every
// page is generated once here rather than hand-synced across nine files.
(() => {
  const shell = document.getElementById('shell');
  if (!shell) return;

  const root = document.documentElement;
  const chrome = document.getElementById('shell-chrome');
  const side = document.getElementById('shell-side');
  const page = shell.dataset.page || 'home';
  const title = shell.dataset.title || 'Home';

  // ---- the icon vocabulary: the site's 26-box line glyphs. Chrome wears
  // them a touch heavier (2.2) since it renders them smaller than the 26px
  // the originals were drawn for.
  const svg = (paths, size, weight) =>
    '<svg width="' + size + '" height="' + size + '" viewBox="0 0 26 26" ' +
    'aria-hidden="true" fill="none" stroke="currentColor" stroke-width="' +
    (weight || 2.2) + '" stroke-linecap="round" stroke-linejoin="round">' +
    paths + '</svg>';

  const GLYPH = {
    rail: '<rect x="3.5" y="4.5" width="19" height="17" rx="3.5" />' +
          '<path d="M10.5 4.5 V21.5" />',
    back: '<path d="M15.5 5.5 L8 13 L15.5 20.5" />',
    fwd:  '<path d="M10.5 5.5 L18 13 L10.5 20.5" />',
    plus: '<path d="M13 6 V20" /><path d="M6 13 H20" />',
    // the site's asterisk — the AI mark, from js/nav-touch.js
    ai:   '<path d="M13 4 V22" /><path d="M5.5 8.5 L20.5 17.5" />' +
          '<path d="M20.5 8.5 L5.5 17.5" />',
  };

  // ============================================================
  // Chrome
  // ============================================================
  const buildChrome = () => {
    if (!chrome) return;
    chrome.innerHTML =
      '<div class="chrome-left">' +
        '<span class="chrome-lights" aria-hidden="true"><i></i><i></i><i></i></span>' +
        '<button class="chrome-btn" type="button" data-act="rail" ' +
          'aria-label="Toggle sidebar">' + svg(GLYPH.rail, 20) + '</button>' +
        '<button class="chrome-btn" type="button" data-act="back" ' +
          'aria-label="Back">' + svg(GLYPH.back, 20) + '</button>' +
        '<button class="chrome-btn" type="button" data-act="fwd" ' +
          'aria-label="Forward">' + svg(GLYPH.fwd, 20) + '</button>' +
      '</div>' +
      '<div class="chrome-tabs">' +
        '<span class="chrome-tab">' +
          '<img src="Media/darkcircle.png" alt="" width="16" height="16" />' +
          '<span class="tab-label" id="tab-label">' + title + '</span>' +
        '</span>' +
        '<button class="chrome-btn chrome-new" type="button" ' +
          'aria-label="Open this page in a new browser tab">' +
          svg(GLYPH.plus, 20) + '</button>' +
      '</div>';

    // back is honest about whether there is anywhere to go; forward has no
    // API to ask, so it stays live and simply does nothing at the end
    const back = chrome.querySelector('[data-act="back"]');
    if (back && history.length <= 1) back.disabled = true;

    chrome.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.act === 'back') history.back();
      else if (btn.dataset.act === 'fwd') history.forward();
      else if (btn.dataset.act === 'rail') toggleRail();
      // the "+" means what it says: this page, in a REAL new tab
      else if (btn.classList.contains('chrome-new')) {
        window.open(location.href, '_blank', 'noopener');
      }
    });
  };

  // ---- the rail collapses to an icon strip; stage-fit re-reads the frame
  const RAIL_KEY = 'shell.rail';
  const toggleRail = () => {
    const next = !root.classList.contains('rail-collapsed');
    root.classList.toggle('rail-collapsed', next);
    try { localStorage.setItem(RAIL_KEY, next ? '1' : '0'); } catch (err) { /* private mode */ }
    if (window.__shellFit) window.__shellFit();
  };
  try {
    if (localStorage.getItem(RAIL_KEY) === '1') root.classList.add('rail-collapsed');
  } catch (err) { /* private mode — the rail just starts open */ }

  // ============================================================
  // Sidebar — identity, the groups (built in a later pass), ask pill
  // ============================================================
  const buildSide = () => {
    if (!side) return;
    side.innerHTML =
      '<a class="side-id" href="index.html#home">' +
        '<img class="side-avatar" src="Media/darkcircle.png" alt="" ' +
          'width="26" height="26" />' +
        '<span class="side-id-text">' +
          '<span class="side-name">Tigo Ponce de León</span>' +
          '<span class="side-role">product design engineer</span>' +
        '</span>' +
      '</a>' +
      '<div class="side-scroll" id="side-scroll"></div>' +
      '<div class="side-foot">' +
        '<a class="ask-pill" id="ask-pill" href="ai.html">' +
          svg(GLYPH.ai, 18, 2) +
          '<span class="ask-label">ask my ai</span>' +
          '<span class="ask-kbd" aria-hidden="true">⌘K</span>' +
        '</a>' +
      '</div>';
  };

  buildChrome();
  buildSide();

  // ---- light up. The home page hands this to the typewriter so the name
  // types before the furniture arrives; every other page just appears.
  const lightUp = () => {
    if (chrome) chrome.classList.add('is-lit');
    if (side) side.classList.add('is-lit');
  };
  if (root.classList.contains('intro-pending')) {
    window.addEventListener('shell:intro-done', lightUp, { once: true });
  } else {
    lightUp();
  }

  window.Shell = { page, lightUp, toggleRail };
})();
