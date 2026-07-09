// Phase 1 data: IP geolocation -> city/region + live local clock + USA flag word-art.
// Fallback (lookup fails/blocked/times out): Chicago, Illinois / Central Time, flag shown.
window.GeoClock = (function () {
  const FALLBACK = {
    city: 'Chicago',
    region: 'Illinois',
    timezone: 'America/Chicago',
    isUSA: true,
  };

  // Stylized US flag word-art (per Figma 1251:689). Built as a fixed-width
  // rectangle in renderFlag(); B=Blue, R=Red, W=White.
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

    const word = (cls, txt) => {
      const s = document.createElement('span');
      s.className = cls;
      s.textContent = txt;
      return s;
    };
    const group = (className, cls, txt, n) => {
      const g = document.createElement('div');
      g.className = className;
      for (let i = 0; i < n; i++) g.appendChild(word(cls, txt));
      return g;
    };
    // Canton row: 3 Blue (left block) + n stripe words (right block), each
    // block space-between so all rows align to the same left+right edges.
    const cantonRow = (cls, txt, n) => {
      const row = document.createElement('div');
      row.className = 'flag-row canton-row';
      row.appendChild(group('canton', CLS.B, WORD.B, 3));
      row.appendChild(group('stripe', cls, txt, n));
      grid.appendChild(row);
    };
    const fullRow = (cls, txt, n) => {
      const row = document.createElement('div');
      row.className = 'flag-row full-row';
      for (let i = 0; i < n; i++) row.appendChild(word(cls, txt));
      grid.appendChild(row);
    };

    cantonRow(CLS.R, WORD.R, 5);   // row 1
    cantonRow(CLS.W, WORD.W, 4);   // row 2
    cantonRow(CLS.R, WORD.R, 5);   // row 3
    cantonRow(CLS.W, WORD.W, 4);   // row 4
    cantonRow(CLS.R, WORD.R, 5);   // row 5
    fullRow(CLS.W, WORD.W, 6);     // row 6
    fullRow(CLS.R, WORD.R, 8);     // row 7
    fullRow(CLS.W, WORD.W, 6);     // row 8
    fullRow(CLS.R, WORD.R, 8);     // row 9

    grid.classList.add('show');
  }

  // Scale the flag so its right edge lines up exactly with the end of the place
  // text. Both share the same left edge, so matching width matches the right
  // edge; font-size scales with width to keep the flag's proportions.
  function applyFlagSize() {
    const grid = document.getElementById('flag-grid');
    const place = document.getElementById('geo-place');
    if (!grid || !place || !grid.classList.contains('show')) return;
    const w = place.getBoundingClientRect().width;
    if (!w) return;
    grid.style.width = w + 'px';
    grid.style.fontSize = Math.max(13, w * 0.053) + 'px';
  }

  function apply(loc) {
    renderPlace(loc);
    startClock(loc.timezone);
    if (loc.isUSA) renderFlag();
    applyFlagSize();
  }

  async function init() {
    window.addEventListener('resize', applyFlagSize);

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
      applyFlagSize();
    } catch (e) {
      /* keep fallback */
    }
  }

  return { init };
})();
