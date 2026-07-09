// Phase 4: nav words. The hover visuals (orange text, grey pill, emoji, neighbor
// shift) are CSS-driven and gated behind the .nav-live class that the scroll
// transition adds once the nav has assembled. This module just makes the words
// keyboard-focusable and mirrors the hover state on focus.
window.NavHover = (function () {
  function init() {
    const words = document.querySelectorAll('#nav-page .navword');
    words.forEach((w) => {
      w.setAttribute('tabindex', '0');
      w.setAttribute('role', 'link');
    });
  }
  return { init };
})();
