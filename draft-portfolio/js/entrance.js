// entrance.js — the first load: the frame assembling itself, once, in under a
// second.
//
//   0ms     the name, line by line, rising and sharpening
//   120ms   the tiles pop in, left to right, 60ms apart, while each glyph
//           draws itself (every stroke carries pathLength="1")
//   300ms   the bottom line rises
//   700ms   the caret appears and starts to blink
//
// Everything is started in one go with fill:'backwards', so each piece holds
// its starting pose through its own delay. Only then is html.entered set,
// which lifts the CSS that kept the pieces hidden. The page is never visible
// in its final state before the animation has it. If script never runs, a CSS
// failsafe shows the page after 1.4s (css/base.css).

import { SPRING, EASE, animate, reduced, u } from './motion.js';

export function playEntrance({ caret } = {}) {
  const root = document.documentElement;
  const done = () => root.classList.add('entered');

  if (reduced()) {
    const frame = document.querySelector('.frame');
    done();
    return frame.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, easing: 'linear' }).finished;
  }

  const k = u();
  const lines = document.querySelectorAll('.name-line');
  const tiles = [...document.querySelectorAll('.tile')];
  const status = document.querySelector('.status');
  const running = [];

  lines.forEach((el, i) => {
    running.push(animate(el, [
      { opacity: 0, translate: `0 ${14 * k}px`, filter: 'blur(6px)' },
      { opacity: 1, translate: '0 0', filter: 'blur(0px)' },
    ], { duration: 760, easing: EASE.rise, delay: i * 70, fill: 'backwards' }));
  });

  tiles.forEach((tile, i) => {
    running.push(animate(tile, [
      { opacity: 0, scale: 0.6 },
      { opacity: 1, scale: 1 },
    ], { ...SPRING.pop, delay: 120 + i * 60, fill: 'backwards' }));
    for (const stroke of tile.querySelectorAll('.tile-icon > *')) {
      running.push(stroke.animate(
        [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
        { duration: 520, easing: EASE.draw, delay: 220 + i * 60, fill: 'backwards' },
      ));
    }
  });

  running.push(animate(status, [
    { opacity: 0, translate: `0 ${14 * k}px` },
    { opacity: 1, translate: '0 0' },
  ], { duration: 760, easing: EASE.rise, delay: 300, fill: 'backwards' }));

  // The caret waits until everything else has nearly landed, then starts
  // its blink from lit — the last thing to arrive, and the one that asks.
  if (caret) {
    running.push(caret.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 700, fill: 'backwards' }));
    setTimeout(() => {
      caret.style.animation = 'none';
      void caret.offsetWidth;
      caret.style.animation = '';
    }, 700);
  }

  done();
  return Promise.allSettled(running.map((a) => a.finished));
}
