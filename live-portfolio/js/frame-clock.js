// The live line: where the visitor is + the local time there. Resolves the
// location via IP geolocation (ipapi.co) and falls back to Oregon (matching
// the Figma) on any error/timeout, so it is never blank.
//
// Targets are found by ATTRIBUTE, not id, because the pair now appears in
// the shell's sidebar on every page — and, while it lasts, in the home
// frame's footer too. Two ids cannot serve both; two attributes can.
//
// The geolocation answer is cached for the session. This used to run on one
// page; it now runs on nine, and asking ipapi where you are nine times to
// get the same answer is rude to a free service and slow for the visitor.
window.FrameClock = (function () {
  const FALLBACK = { region: 'Oregon', timezone: 'America/Los_Angeles' };
  const GEO_KEY = 'shell.geo';
  let timer = null;
  let booted = false;

  const cached = () => {
    try { return JSON.parse(sessionStorage.getItem(GEO_KEY) || 'null'); }
    catch (err) { return null; }
  };
  const remember = (geo) => {
    try { sessionStorage.setItem(GEO_KEY, JSON.stringify(geo)); }
    catch (err) { /* private mode — we just ask again next page */ }
  };

  function start(timezone, region) {
    document.querySelectorAll('[data-clock="state"]')
      .forEach((el) => { el.textContent = region; });
    const timeEls = document.querySelectorAll('[data-clock="time"]');
    if (!timeEls.length) return;

    let fmt;
    const opts = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
    try {
      fmt = new Intl.DateTimeFormat('en-US', Object.assign({ timeZone: timezone }, opts));
    } catch (err) {
      // bad/unknown timezone — fall back to the browser's local time
      fmt = new Intl.DateTimeFormat('en-US', opts);
    }
    const tick = () => {
      const now = fmt.format(new Date());
      timeEls.forEach((el) => { el.textContent = now; });
    };
    tick();
    if (timer) clearInterval(timer);
    timer = setInterval(tick, 1000);
  }

  function init() {
    if (booted) return;
    if (!document.querySelector('[data-clock]')) return;
    booted = true;

    const hit = cached();
    if (hit) { start(hit.timezone, hit.region); return; }

    // show the fallback immediately so the clock ticks right away…
    start(FALLBACK.timezone, FALLBACK.region);

    // …then upgrade to the real location when it resolves
    const ctrl = ('AbortController' in window) ? new AbortController() : null;
    const to = setTimeout(() => { if (ctrl) ctrl.abort(); }, 4000);

    fetch('https://ipapi.co/json/', ctrl ? { signal: ctrl.signal } : undefined)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('geo'))))
      .then((d) => {
        clearTimeout(to);
        if (d && d.region && d.timezone) {
          remember({ region: d.region, timezone: d.timezone });
          start(d.timezone, d.region);
        }
      })
      .catch(() => { clearTimeout(to); /* keep the fallback */ });
  }

  // the shell builds its sidebar synchronously at parse time, so by the time
  // this runs the targets exist on every page; index.html's main.js still
  // calls init() too, and the booted latch makes that harmless
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init: init };
})();
