// Restore menu-open state from the previous page navigation
if (sessionStorage.getItem('menuOpen') === '1') {
  document.body.classList.add('menu-open');
  const b = document.querySelector('.mobile-burger');
  if (b) {
    b.setAttribute('aria-expanded', 'true');
    b.setAttribute('aria-label', 'Close navigation');
  }
}

// Mobile burger menu toggle
const mobileBurger = document.querySelector('.mobile-burger');
if (mobileBurger) {
  mobileBurger.addEventListener('click', () => {
    const isOpen = document.body.classList.toggle('menu-open');
    sessionStorage.setItem('menuOpen', isOpen ? '1' : '0');
    mobileBurger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    mobileBurger.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
  });
}

// Theme + Chicago clock for the standalone ai.html page.

const toggle = document.querySelector('.theme-toggle');
const icon = toggle && toggle.querySelector('.icon img');

function updateThemeIcon(isDark) {
  if (!icon) return;
  icon.src = isDark ? 'Media/circle.png' : 'Media/moon.png';
  icon.alt = isDark ? 'circle' : 'moon';
}

// Default to dark on the AI page; respect an explicit light preference.
const savedTheme = localStorage.getItem('theme');
const startDark = savedTheme !== 'light';

if (startDark) document.body.classList.add('dark-mode');
updateThemeIcon(startDark);
if (toggle) toggle.setAttribute('aria-pressed', startDark ? 'true' : 'false');

if (toggle) {
  toggle.addEventListener('click', () => {
    const willBeDark = !document.body.classList.contains('dark-mode');
    document.body.classList.toggle('dark-mode', willBeDark);
    updateThemeIcon(willBeDark);
    toggle.setAttribute('aria-pressed', willBeDark ? 'true' : 'false');
    localStorage.setItem('theme', willBeDark ? 'dark' : 'light');
  });
}

function updateClock() {
  const clock = document.getElementById('chicagoClock');
  if (!clock) return;
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  }).format(new Date());
  clock.textContent = `Chicago - ${time}`;
}
updateClock();
setInterval(updateClock, 1000);

// On short desktop laptops the full-size AI card would overlap the nav / bottom
// bar. Rather than shrink the card's content (which throws off proportions), we
// keep it at full intrinsic size and scale the whole card uniformly so it fits
// between the nav and the bottom bar — interior keeps exact desktop ratios.
(function fitAiCardSetup() {
  const shortLaptop = window.matchMedia('(min-width: 1025px) and (max-height: 900px)');
  const view = document.querySelector('.ai-view');
  const card = document.querySelector('.ai-card');
  if (!view || !card) return;

  const TOP_GAP = 32;     // breathing room below the nav
  const BOTTOM_GAP = 24;  // breathing room above the bottom bar

  function fitAiCard() {
    if (!shortLaptop.matches) {
      view.style.removeProperty('--ai-scale');
      view.style.removeProperty('--ai-card-top');
      card.style.removeProperty('--ai-scale');
      return;
    }
    const nav = document.querySelector('.centered-nav');
    const bar = document.querySelector('.bottom-bar');
    const navBottom = nav ? nav.getBoundingClientRect().bottom : window.innerHeight * 0.05;
    const barTop = bar ? bar.getBoundingClientRect().top : window.innerHeight * 0.94;

    const top = navBottom + TOP_GAP;
    const available = (barTop - BOTTOM_GAP) - top;
    const fullHeight = card.offsetHeight || 669; // unscaled layout height (transform-agnostic)
    const scale = Math.max(0.4, Math.min(1, available / fullHeight));

    view.style.setProperty('--ai-card-top', top + 'px');
    card.style.setProperty('--ai-scale', scale.toFixed(4));
  }

  window.addEventListener('resize', fitAiCard);
  if (shortLaptop.addEventListener) shortLaptop.addEventListener('change', fitAiCard);
  fitAiCard();
})();
