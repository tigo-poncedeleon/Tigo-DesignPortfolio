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
