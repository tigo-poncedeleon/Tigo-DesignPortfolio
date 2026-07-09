// Phase 1 data: IP geolocation -> city/region + live local clock + USA flag word-art.
// Fallback (lookup fails/blocked/times out): Chicago, Illinois / Central Time, flag shown.
window.GeoClock = (function () {
  const FALLBACK = {
    city: 'Chicago',
    region: 'Illinois',
    timezone: 'America/Chicago',
    isUSA: true,
  };

  // Stylized US flag: rows of color-coded words (B=Blue, R=Red, W=White), per Figma 1251:689.
  const FLAG_ROWS = [
    ['B', 'B', 'B', 'R', 'R', 'R', 'R', 'R'],
    ['B', 'B', 'B', 'W', 'W', 'W', 'W'],
    ['B', 'B', 'B', 'R', 'R', 'R', 'R', 'R'],
    ['B', 'B', 'B', 'W', 'W', 'W', 'W'],
    ['B', 'B', 'B', 'R', 'R', 'R', 'R', 'R'],
    ['W', 'W', 'W', 'W', 'W', 'W'],
    ['R', 'R', 'R', 'R', 'R', 'R', 'R', 'R'],
    ['W', 'W', 'W', 'W', 'W', 'W'],
    ['R', 'R', 'R', 'R', 'R', 'R', 'R', 'R'],
  ];
  const WORD = { B: 'Blue', R: 'Red', W: 'White' };
  const CLS = { B: 'flag-blue', R: 'flag-red', W: 'flag-white' };

  function renderPlace(loc) {
    const place = document.getElementById('geo-place');
    if (place) place.textContent = [loc.city, loc.region].filter(Boolean).join(', ');
  }

  let clockTimer = null;
  function startClock(timezone) {
    const el = document.getElementById('geo-clock');
    if (!el) return;
    if (clockTimer) clearInterval(clockTimer);
    let fmt;
    try {
      fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
      });
    } catch (e) {
      fmt = new Intl.DateTimeFormat('en-US', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
      });
    }
    const tick = () => { el.textContent = fmt.format(new Date()); };
    tick();
    clockTimer = setInterval(tick, 1000);
  }

  function renderFlag() {
    const grid = document.getElementById('flag-grid');
    if (!grid) return;
    grid.innerHTML = '';
    FLAG_ROWS.forEach((row) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'flag-row';
      row.forEach((c) => {
        const cell = document.createElement('span');
        cell.className = 'cell ' + CLS[c];
        cell.textContent = WORD[c];
        rowEl.appendChild(cell);
      });
      grid.appendChild(rowEl);
    });
    grid.classList.add('show');
  }

  function apply(loc) {
    renderPlace(loc);
    startClock(loc.timezone);
    if (loc.isUSA) renderFlag();
  }

  async function init() {
    // Populate immediately with fallback so the curtain never waits on the network,
    // then upgrade if the lookup succeeds.
    apply(FALLBACK);

    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      const res = await fetch('https://ipapi.co/json/', { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) return;
      const d = await res.json();
      if (!d || d.error || !d.city) return;

      const loc = {
        city: d.city,
        region: d.region || d.region_code || '',
        timezone: d.timezone || FALLBACK.timezone,
        isUSA: d.country_code === 'US' || d.country === 'US',
      };
      // Re-render place + clock; toggle flag to match the real country.
      renderPlace(loc);
      startClock(loc.timezone);
      const grid = document.getElementById('flag-grid');
      if (loc.isUSA) renderFlag();
      else if (grid) { grid.classList.remove('show'); grid.innerHTML = ''; }
    } catch (e) {
      /* keep fallback */
    }
  }

  return { init };
})();
