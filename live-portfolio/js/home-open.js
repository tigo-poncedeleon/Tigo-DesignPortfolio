// Home opening — one-way cover → nav frame (Figma 1408:28 → 1401:112).
// The stage starts with .is-cover (markup); the first scroll gesture, an
// arrow click, or a paging key strips it and CSS glides everything into
// place. ?open=1 or #home lands on the nav frame directly (no animation).
(() => {
  const stage = document.getElementById('stage');
  const arrow = document.getElementById('open-arrow');
  if (!stage || !stage.classList.contains('is-cover')) return;

  const params = new URLSearchParams(location.search);
  if (params.get('open') === '1' || location.hash === '#home') {
    stage.classList.add('no-anim');
    stage.classList.remove('is-cover');
    stage.offsetHeight;                 // flush styles before re-enabling
    stage.classList.remove('no-anim');
    return;
  }

  const onWheel = (e) => {
    if (Math.abs(e.deltaY) > 10) open();
  };
  const onKey = (e) => {
    if (['ArrowUp', 'ArrowDown', 'PageDown', ' '].includes(e.key)) open();
  };
  const onTouch = () => open();       // a swipe opens, same as a scroll

  function open() {
    stage.classList.remove('is-cover');
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('touchmove', onTouch);
  }

  window.addEventListener('wheel', onWheel, { passive: true });
  window.addEventListener('keydown', onKey);
  window.addEventListener('touchmove', onTouch, { passive: true });
  if (arrow) arrow.addEventListener('click', open);
})();
