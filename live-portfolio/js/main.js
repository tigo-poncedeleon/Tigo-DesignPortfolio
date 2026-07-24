// Boot the landing frame: live clock, glass hover pane, gentle fade-in.
(function () {
  function boot() {
    if (window.FrameClock) window.FrameClock.init();
    if (window.GlassNav) window.GlassNav.init();

    const stage = document.getElementById('stage');
    requestAnimationFrame(() => { if (stage) stage.classList.add('revealed'); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
