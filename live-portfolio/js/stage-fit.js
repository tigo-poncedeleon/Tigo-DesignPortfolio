// Stage fit — the desktop layout is a 1:1 copy of the 1280×832 Figma
// frames, pixel-pinned. Between the phone layouts (≤700px) and a full
// 1280×832 window, this scales the WHOLE stage down proportionally —
// the frame zooms out instead of clipping (iPads, short laptops).
//
// The stage keeps its 1280×832 LAYOUT box and only the rendering
// scales, so every script that measures in layout px (the games' court
// geometry, the wheel paging, the gliding chips' offsetTop/Width) keeps
// working unchanged. Scripts that push getBoundingClientRect deltas
// (visual px) back INTO the scaled stage divide by __stageFitScale.
(() => {
  const FRAME_W = 1280;
  const FRAME_H = 832;
  const stage = document.querySelector(
    '.stage, .work-stage, .play-stage, .ai-stage, .about-stage, .case-stage');
  if (!stage) return;

  window.__stageFitScale = 1;

  const reset = () => {
    stage.style.width = '';
    stage.style.height = '';
    stage.style.transform = '';
    stage.style.transformOrigin = '';
    document.documentElement.style.overflow = '';
    window.__stageFitScale = 1;
  };

  const fit = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (vw <= 700) { reset(); return; }        // the phone layouts own ≤700

    const s = Math.min(vw / FRAME_W, vh / FRAME_H, 1);
    if (s >= 1) { reset(); return; }           // full frame fits — hands off

    window.__stageFitScale = s;
    stage.style.width = FRAME_W + 'px';
    stage.style.height = FRAME_H + 'px';
    stage.style.transformOrigin = 'top left';
    // centre the scaled frame in whichever axis has room to spare
    const dx = (vw - FRAME_W * s) / 2;
    const dy = (vh - FRAME_H * s) / 2;
    stage.style.transform =
      'translate(' + dx + 'px, ' + dy + 'px) scale(' + s + ')';
    // the layout box is wider than the viewport now — never show a scrollbar
    document.documentElement.style.overflow = 'hidden';
  };

  fit();
  window.addEventListener('resize', fit);
})();
