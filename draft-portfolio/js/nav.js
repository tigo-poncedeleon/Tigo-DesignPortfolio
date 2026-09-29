// nav.js — the menu: the yellow square and the four pages it opens onto.
//
// Opening and shutting is one attribute, data-open, and css/nav.css does all
// the moving, so a quick second click just turns the transitions around
// wherever they are. This file only decides WHEN:
//   the square toggles it;
//   picking a page shuts it (the page change is the thing to watch then);
//   Esc shuts it, and hands focus back to the square;
//   a press anywhere outside it shuts it;
//   any route change shuts it (main.js), so Back never leaves it hanging.
// Opened from the keyboard, focus goes to the current page's pill; opened
// with a pointer, focus stays on the square.

export function initNav(menu) {
  const button = menu.querySelector('.menu-button');
  const list = menu.querySelector('.menu-list');
  const items = [...menu.querySelectorAll('.menu-item')];
  let isOpen = false;

  function open({ focus = false } = {}) {
    if (isOpen) return;
    isOpen = true;
    menu.setAttribute('data-open', '');
    button.setAttribute('aria-expanded', 'true');
    list.inert = false;
    if (focus) {
      const here = items.find((i) => i.getAttribute('aria-current') === 'page') || items[0];
      here.focus({ preventScroll: true });
    }
  }

  function close({ focus = false } = {}) {
    if (!isOpen) return;
    isOpen = false;
    menu.removeAttribute('data-open');
    button.setAttribute('aria-expanded', 'false');
    list.inert = true;
    if (focus) button.focus({ preventScroll: true });
  }

  // e.detail is 0 when a click came from the keyboard (Enter or Space)
  button.addEventListener('click', (e) => (isOpen ? close() : open({ focus: e.detail === 0 })));
  for (const item of items) item.addEventListener('click', () => close());

  // Capture on the window, and first in line (this is registered at boot,
  // before Play's own key handling), so Esc shuts the menu before it can
  // also close a game underneath it.
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !isOpen) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    close({ focus: true });
  }, true);
  document.addEventListener('pointerdown', (e) => {
    if (isOpen && !menu.contains(e.target)) close();
  });

  function setCurrent(view) {
    for (const item of items) {
      if (item.dataset.route === view) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    }
  }

  return { setCurrent, open, close, get isOpen() { return isOpen; } };
}
