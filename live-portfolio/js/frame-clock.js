// Bottom line of the frame: the U.S. state the visitor is in + the live local
// time there. Resolves the location via IP geolocation (ipapi.co) and falls back
// to Oregon (matching the Figma) on any error/timeout so it's never blank.
window.FrameClock = (function () {
  const FALLBACK = { region: 'Oregon', timezone: 'America/Los_Angeles' };

  function init() {
    const stateEl = document.getElementById('frame-state');
    const timeEl = document.getElementById('frame-time');
    if (!stateEl || !timeEl) return;

    let timer = null;

    function start(timezone, region) {
      stateEl.textContent = region;
      let fmt;
      try {
        fmt = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
        });
      } catch (err) {
        // Bad/unknown timezone — fall back to the browser's local time.
        fmt = new Intl.DateTimeFormat('en-US', {
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
        });
      }
      const tick = () => { timeEl.textContent = fmt.format(new Date()); };
      tick();
      if (timer) clearInterval(timer);
      timer = setInterval(tick, 1000);
    }

    // Show the fallback immediately so the clock ticks right away…
    start(FALLBACK.timezone, FALLBACK.region);

    // …then upgrade to the real location when it resolves.
    const ctrl = ('AbortController' in window) ? new AbortController() : null;
    const to = setTimeout(() => { if (ctrl) ctrl.abort(); }, 4000);

    fetch('https://ipapi.co/json/', ctrl ? { signal: ctrl.signal } : undefined)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('geo'))))
      .then((d) => {
        clearTimeout(to);
        if (d && d.region && d.timezone) start(d.timezone, d.region);
      })
      .catch(() => { clearTimeout(to); /* keep the fallback */ });
  }

  return { init: init };
})();
