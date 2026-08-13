// Mobile site nav — on phones the .site-nav is a floating BOTTOM BAR
// (styles.css): the house chip and its tap-to-open expand retire, and each
// word becomes an icon-over-label tab. This script injects those hand-drawn
// line icons into every .site-nav-word (one place, since the nav markup is
// duplicated across pages) so they inherit currentColor and turn orange on
// the active tab. On desktop the icons are hidden by CSS — the pill stays
// text-only — so injecting unconditionally is safe and resize-proof.
(() => {
  const nav = document.querySelector('.site-nav');
  if (!nav) return;

  // one line glyph per destination, in the site's 26×26 stroke language
  const ICON = {
    home:
      '<path d="M4 12.5 L13 5 L22 12.5" /><path d="M6.5 11 V20.5 H19.5 V11" />' +
      '<path d="M10.5 20.5 V14.8 H15.5 V20.5" />',
    about:
      '<circle cx="13" cy="9" r="4" />' +
      '<path d="M5.5 21 C5.5 16.4, 9 14.6, 13 14.6 C17 14.6, 20.5 16.4, 20.5 21" />',
    work:
      '<rect x="4" y="8" width="18" height="12.5" rx="2.5" />' +
      '<path d="M9.3 8 V6.2 C9.3 5.2, 9.8 4.7, 10.8 4.7 H15.2 C16.2 4.7, 16.7 5.2, 16.7 6.2 V8" />' +
      '<path d="M4 13.2 H22" />',
    ai:
      '<path d="M13 4 V22" /><path d="M5.5 8.5 L20.5 17.5" /><path d="M20.5 8.5 L5.5 17.5" />',
    play:                                          // hidden on mobile, kept complete
      '<path d="M8 5.5 L20 13 L8 20.5 Z" />',
  };

  // the home page is one long scroll, so its tabs are in-page anchors; the
  // standalone pages still link out to the old files. Both reach one glyph.
  const DEST = {
    'index.html#home': 'home',
    'about.html': 'about', '#bio': 'about',
    'work.html': 'work', '#vicino': 'work',
    'ai.html': 'ai', '#ai': 'ai',
    'play.html': 'play', '#pong': 'play',
  };

  const svg = (paths) =>
    '<svg viewBox="0 0 26 26" aria-hidden="true" fill="none" ' +
    'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" ' +
    'stroke-linejoin="round">' + paths + '</svg>';

  nav.querySelectorAll('.site-nav-word').forEach((word) => {
    const paths = ICON[DEST[word.getAttribute('href')]];
    if (!paths || word.querySelector('svg')) return;
    word.insertAdjacentHTML('afterbegin', svg(paths));
  });
})();
