// nav.js — the four tiles: which one is current, and how wide its word is.
//
// A tile opens by animating its label slot's width (css/nav.css says why it
// is a width and not a grid track), and a width needs a number. Each word is
// measured once, in em of the tile's own type, so the number keeps holding
// as the fluid type scales: the words scale with the type, and so does the
// width. It is measured again when the fonts settle, in case the system face
// arrived after the first measurement.

export function initNav(nav) {
  const tiles = [...nav.querySelectorAll('.tile')];

  // offsetWidth, the layout width, and not getBoundingClientRect: the first
  // measurement happens while the entrance still holds the tiles at scale
  // .6, and a rect would have sized every pill to 60% of its word.
  function measure() {
    for (const tile of tiles) {
      const word = tile.querySelector('.tile-word');
      const size = parseFloat(getComputedStyle(tile).fontSize);
      if (!size) continue;
      const width = word.offsetWidth / size;
      tile.style.setProperty('--w', width.toFixed(4) + 'em');
    }
  }
  measure();
  document.fonts?.ready.then(measure);

  function setCurrent(view) {
    for (const tile of tiles) {
      const on = tile.dataset.route === view;
      if (on) tile.setAttribute('aria-current', 'page');
      else tile.removeAttribute('aria-current');
      // Home is current on Home, but its tile never opens: the frame shows
      // Home with all four tiles shut, and that is what Home looks like.
      tile.toggleAttribute('data-open', on && view !== 'home');
    }
  }

  return { tiles, setCurrent, measure };
}
