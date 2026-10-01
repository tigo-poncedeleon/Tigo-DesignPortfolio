// keyboard.js — a phone's keyboard, and Home making room for it.
//
// On a phone Home is the window's height with the composer at its foot, and
// the keyboard comes up over exactly that. Left to itself the browser
// scrolls the page to show the field, and everything goes with it: Home's
// top leaves the screen, the masthead lands on the conversation, and the
// page is partway into Work. (On a short enough phone that scroll can also
// tell js/main.js the page has moved on to Work, which takes the field's
// focus away, so the keyboard goes back down as it comes up.)
//
// So while the composer has the keyboard, Home is made to fit what the
// keyboard leaves of the window, and the page is held where it is. This is
// the old site's answer (archive/v2-live-portfolio/js/mobile.js, whose notes
// say how each part of it was found on a phone), cut down to this page:
//
//   the hold     taken the moment the field is focused, the earliest warning
//                a keyboard gives: the page goes to Home's top and is held
//                there (html[data-keyboard='held'], css/home.css), so the
//                browser has nowhere to scroll it. Should it move anyway, it
//                is put back on the next frame.
//   the room     every frame, Home's padding takes up whatever of it is out
//                of sight, so its contents (the masthead's room, the
//                conversation, the composer) stand in what can be seen, the
//                composer just over the keyboard. What can be seen is the
//                visual viewport, set against Home's own box in the
//                document, so both numbers are in one coordinate space and
//                nothing is taken off a viewport unit. (The old site's first
//                tries took a measured keyboard off 100dvh, and wherever the
//                two disagreed the difference landed in the layout.) It is
//                read off the viewport's live properties in a frame loop,
//                not its resize event, which comes only three or four times
//                in the keyboard's third of a second; the loop is the motion,
//                and nothing in the CSS transitions.
//   the masthead is placed at the window's document coordinate while the
//                page is held, not fixed: on iOS a fixed box is anchored to
//                the layout viewport, which a keyboard can move out from
//                under what is seen.
//   letting go   once the field loses focus the hold comes off at once, so
//                the page scrolls and the menu's links go where they point,
//                but the room keeps following the keyboard down until it has
//                gone, so the composer rides down on it rather than dropping
//                out of sight behind it. A hold with no keyboard under it (a
//                hardware keyboard, or Android's back button, which hides the
//                keyboard and leaves the field focused) lets go by itself
//                after 900ms, and a keyboard that turns up later for the
//                still-focused field takes it again.
//
// Only where the pointer is a finger: a laptop has no keyboard to make room
// for. A pinch-zoomed page is left alone, since its visual viewport is small
// because it is magnified, not because anything covers it.

const TOUCH = matchMedia('(hover: none) and (pointer: coarse)');
const SLACK = 60;   // px shorter than the bare window that counts as a keyboard
const GRACE = 900;  // ms a hold waits for a keyboard before letting go
const TAIL = 700;   // ms the room may follow a keyboard down once the field has let go

export function watchKeyboard({ input, home }) {
  const vv = window.visualViewport;
  const root = document.documentElement;
  if (!vv) return { get held() { return false; } };

  let state = 'off'; // 'held' while the field has the keyboard, 'leaving' while it goes down
  let full = 0;      // the window's height with no keyboard over it
  let homeTop = 0;   // Home's top in the document
  let seen = 0;      // the last moment a keyboard was up (or the hold was taken)
  let left = 0;      // when the field let go
  let raf = 0;
  const written = {};

  const zoomed = () => vv.scale > 1.01;
  const keyboardUp = () => !zoomed() && vv.height < full - SLACK;
  const focused = () => document.activeElement === input;

  function set(name, px) {
    if (written[name] === px) return;
    written[name] = px;
    root.style.setProperty(name, px + 'px');
  }

  function write() {
    if (state === 'held' && Math.abs(scrollY - homeTop) >= 1) {
      scrollTo({ top: homeTop, behavior: 'instant' });
    }
    // what can be seen, in document coordinates
    const top = scrollY + (zoomed() ? 0 : vv.offsetTop);
    const bottom = zoomed() ? scrollY + innerHeight : top + vv.height;
    const homeBottom = homeTop + home.offsetHeight;
    set('--kb-y', Math.round(top));
    set('--kb-above', state === 'held' && !zoomed() ? Math.max(0, Math.round(top - homeTop)) : 0);
    set('--kb-below', zoomed() ? 0 : Math.max(0, Math.round(homeBottom - bottom)));
  }

  function frame(now) {
    raf = 0;
    if (state === 'off') return;
    if (keyboardUp()) seen = now;
    if (state === 'held' && now - seen > GRACE) return off();
    if (state === 'leaving' && (vv.height >= full - 2 || now - left > TAIL)) return off();
    write();
    raf = requestAnimationFrame(frame);
  }
  const run = () => { if (state !== 'off' && !raf) raf = requestAnimationFrame(frame); };

  function hold() {
    if (state === 'held' || !TOUCH.matches) return;
    if (state === 'off') {
      full = Math.round(Math.max(vv.height, innerHeight));
      homeTop = Math.round(home.getBoundingClientRect().top + scrollY);
    }
    // to Home's top first, and only then the hold, so there is never a
    // frame with the page held somewhere it isn't
    if (Math.abs(scrollY - homeTop) >= 1) scrollTo({ top: homeTop, behavior: 'instant' });
    state = 'held';
    seen = performance.now();
    write();
    root.dataset.keyboard = 'held';
    run();
  }

  function leave() {
    if (state !== 'held') return;
    if (!keyboardUp()) return off();
    state = 'leaving';
    left = performance.now();
    root.dataset.keyboard = 'leaving';
    write();
    run();
  }

  function off() {
    state = 'off';
    cancelAnimationFrame(raf);
    raf = 0;
    delete root.dataset.keyboard;
  }

  input.addEventListener('focus', hold);
  // a tick, so a tap that takes focus off the field and straight back (on
  // the pill around it, say) never lets go in between
  input.addEventListener('blur', () => setTimeout(() => { if (!focused()) leave(); }, 0));
  const follow = () => {
    // the keyboard came back for a field that never lost focus, so no focus
    // event says so: measured against innerHeight, since there is no bare
    // window remembered yet
    if (state === 'off' && focused() && !zoomed() && vv.height < innerHeight - 100) hold();
    run();
  };
  vv.addEventListener('resize', follow);
  vv.addEventListener('scroll', follow);

  return {
    // while it is held, the page is Home, whatever the window says
    get held() { return state === 'held'; },
  };
}
