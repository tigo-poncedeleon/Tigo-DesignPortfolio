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
//
// While a conversation is up on Home, the square gives its place to the
// clear button (setChat, called by the chat). The swap is data-chat, and
// css/nav.css moves it; here the one on its way out is made inert, and if it
// had focus, focus goes to the one arriving, so a keyboard is never left
// holding a button that has gone.

import { reduced } from './motion.js';

export function initNav(menu, { onClear } = {}) {
  const button = menu.querySelector('.menu-button');
  const clearButton = menu.querySelector('.menu-clear');
  const list = menu.querySelector('.menu-list');
  const items = [...menu.querySelectorAll('.menu-item')];
  let isOpen = false;
  let chat = false;

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

  function setChat(on) {
    if (chat === on) return;
    chat = on;
    if (on) close();
    const leaving = on ? button : clearButton;
    const arriving = on ? clearButton : button;
    const hadFocus = document.activeElement === leaving;
    menu.toggleAttribute('data-chat', on);
    arriving.inert = false;
    if (hadFocus) arriving.focus({ preventScroll: true });
    leaving.inert = true;
    // the arriving glyph draws itself in as its square pops up
    if (!reduced()) {
      arriving.querySelectorAll('svg line').forEach((stroke, i) => {
        stroke.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
          { duration: 420, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', delay: 140 + i * 70, fill: 'backwards' });
      });
    }
  }
  clearButton.addEventListener('click', () => onClear?.());

  function setCurrent(view) {
    for (const item of items) {
      if (item.dataset.route === view) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    }
  }

  return { setCurrent, open, close, setChat, get isOpen() { return isOpen; } };
}
