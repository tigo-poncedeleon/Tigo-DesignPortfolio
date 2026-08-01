// Boot the landing frame: live clock, gentle fade-in. The pill's hover
// chip retired with the cover frame — the sidebar is the nav now.
(function () {
  function boot() {
    if (window.FrameClock) window.FrameClock.init();

    const stage = document.getElementById('stage');
    requestAnimationFrame(() => { if (stage) stage.classList.add('revealed'); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
