// Shell fit — the desktop layout is a 1:1 copy of the 1280×832 Figma
// frames, pixel-pinned, now nested inside a browser shell (chrome strip
// + sidebar + content card). Between the phone layouts (≤700px) and a
// full 1558×894 window this scales the WHOLE SHELL down proportionally —
// the window zooms out instead of clipping.
//
// The card keeps its exact 1280×832 LAYOUT box and only the rendering
// scales, so every script that measures in layout px (the games' court
// geometry, the wheel paging, the gliding chips' offsetTop/Width) keeps
// working unchanged. Scripts that push getBoundingClientRect deltas
// (visual px) back INTO the scaled shell divide by __stageFitScale.
//
// Two rules the rest of the site depends on:
//   · __stageFitScale is published ALWAYS, including 1.
//   · at s === 1 the shell carries a translate ONLY, never scale(1) —
//     a pure translate does not scale rects, so the FLIP maths in
//     ai-chat.js and nextlevel.js stay exact.
// Corollary: there must be exactly ONE scaled ancestor on the page.
// Never nest a second transform inside the shell.
(() => {
  const shell = document.getElementById('shell');
  if (!shell) return;

  const root = document.documentElement;
  const num = (name, fallback) => {
    const v = parseFloat(getComputedStyle(root).getPropertyValue(name));
    return Number.isFinite(v) ? v : fallback;
  };

  window.__stageFitScale = 1;
  window.__shellFrame = { w: 1558, h: 894 };

  // the frame is derived from the CSS tokens, never duplicated from them
  const measure = () => {
    const bd = num('--shell-bd', 1);
    const gap = num('--shell-gap', 8);
    const rail = root.classList.contains('rail-collapsed')
      ? num('--shell-rail-min', 52)
      : num('--shell-rail', 260);
    return {
      w: 2 * bd + rail + gap + num('--card-w', 1280) + gap,
      h: 2 * bd + num('--shell-chrome-h', 44) + gap + num('--card-h', 832) + gap,
    };
  };

  const reset = () => {                     // ≤700px: the phone layouts own it
    shell.style.width = '';
    shell.style.height = '';
    shell.style.transform = '';
    shell.style.transformOrigin = '';
    root.style.overflow = '';
    root.style.removeProperty('--shell-scale');
    window.__stageFitScale = 1;
  };

  const fit = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (vw <= 700) { reset(); return; }

    const F = measure();
    window.__shellFrame = F;
    shell.style.width = F.w + 'px';
    shell.style.height = F.h + 'px';

    const s = Math.min(vw / F.w, vh / F.h, 1);
    window.__stageFitScale = s;
    root.style.setProperty('--shell-scale', s);

    shell.style.transformOrigin = 'top left';
    // centre the frame in whichever axis has room to spare
    const dx = (vw - F.w * s) / 2;
    const dy = (vh - F.h * s) / 2;
    shell.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)' +
      (s < 1 ? ' scale(' + s + ')' : '');

    // the layout box can be wider than the viewport now — never a scrollbar
    root.style.overflow = 'hidden';
    window.dispatchEvent(new CustomEvent('shell:fit', { detail: { scale: s, frame: F } }));
  };

  window.__shellFit = fit;              // js/shell.js calls this on rail toggle
  fit();
  window.addEventListener('resize', fit);
})();
