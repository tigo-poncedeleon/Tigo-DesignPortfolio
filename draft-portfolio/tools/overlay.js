// tools/overlay.js — lays the Figma render over the page, to check Home to
// the pixel. It loads only with ?overlay (js/main.js), and only means anything
// in a 1280×832 window, where --u is exactly 1px.
//
//   O  shows and hides the render
//   D  difference mode: where page and render agree, the screen goes black
//
// The render is the frame WITH its 1px border, which the page does not draw,
// so it is hung one pixel up and left: the frame's content then lands on the
// page's own coordinates.

const img = new Image();
img.src = 'tools/figma-home.png';
img.alt = '';
Object.assign(img.style, {
  position: 'fixed',
  left: '-1px',
  top: '-1px',
  width: '1280px',
  height: '832px',
  zIndex: '9999',
  pointerEvents: 'none',
  opacity: '0.5',
});
document.body.append(img);

let shown = true;
let diff = false;

function paint() {
  img.style.display = shown ? 'block' : 'none';
  img.style.opacity = diff ? '1' : '0.5';
  img.style.mixBlendMode = diff ? 'difference' : 'normal';
}

// Capture phase, so the keys never reach Home's type-anywhere; but only while
// no field has focus, so the prompt still takes an o or a d.
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target;
  if (t instanceof HTMLTextAreaElement || t instanceof HTMLInputElement) return;
  const k = e.key.toLowerCase();
  if (k !== 'o' && k !== 'd') return;
  e.preventDefault();
  e.stopPropagation();
  if (k === 'o') shown = !shown;
  else diff = !diff;
  paint();
}, true);

paint();
