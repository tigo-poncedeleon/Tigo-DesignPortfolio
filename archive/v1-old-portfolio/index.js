// Restore menu-open state from the previous page navigation
if (sessionStorage.getItem('menuOpen') === '1') {
  document.body.classList.add('menu-open');
  const b = document.querySelector('.mobile-burger');
  if (b) {
    b.setAttribute('aria-expanded', 'true');
    b.setAttribute('aria-label', 'Close navigation');
  }
}

// website intro animation

const intro = document.getElementById('intro');
const introText = document.getElementById('introText');

const messages = ["tigo ponce de león", "digital product designer"];
let currentMessage = 0;
let charIndex = 0;

function typeMessage(message, callback) {
  introText.textContent = "";
  charIndex = 0;

  function typeChar() {
    if (charIndex < message.length) {
      introText.textContent += message.charAt(charIndex);
      charIndex++;
      setTimeout(typeChar, 60);
    } else if (callback) {
      setTimeout(callback, 1000);
    }
  }

  typeChar();
}

const isInternalNav = document.referrer && new URL(document.referrer).hostname === window.location.hostname;

if (!isInternalNav) {
  typeMessage(messages[0], () => {
    intro.classList.add('dark');
    typeMessage(messages[1], () => {
      intro.classList.add('fade-out');
      document.body.classList.add('loaded');
    });
  });
} else {
  if (intro) intro.style.display = 'none';
  document.body.classList.add('loaded');
}

// light and dark mode toggle
const toggle = document.querySelector('.theme-toggle');
const icon = toggle.querySelector('.icon img');
const circleText = document.getElementById('circleText');

const lightIcon = 'Media/moon.png';
const darkIcon = 'Media/circle.png';

function updateThemeIcon(isDark) {
  icon.src = isDark ? darkIcon : lightIcon;
  icon.alt = isDark ? 'circle' : 'moon';
}

if (localStorage.getItem('theme') === 'dark') {
  document.body.classList.add('dark-mode');
  updateThemeIcon(true);
  circleText?.setAttribute('fill', '#ffffff');
} else {
  updateThemeIcon(false);
}

function applyTheme(isDark) {
  document.body.classList.toggle('dark-mode', isDark);
  updateThemeIcon(isDark);
  toggle.setAttribute('aria-pressed', isDark ? 'true' : 'false');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  if (circleText) {
    circleText.setAttribute('fill', isDark ? '#ffffff' : '#000000');
  }
}

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

toggle.addEventListener('click', () => {
  const willBeDark = !document.body.classList.contains('dark-mode');
  const aiOpen = document.body.classList.contains('ai-open');

  function afterApply() {
    // While AI panel is open the bg is always black — keep the white circle visible.
    // The preference is saved; closePanel() will restore the correct icon on close.
    if (aiOpen) {
      icon.src = darkIcon;
      icon.alt = 'circle';
    }
  }

  // graceful fallback: no View Transitions support or reduced-motion preference
  if (!document.startViewTransition || prefersReducedMotion) {
    applyTheme(willBeDark);
    afterApply();
    return;
  }

  // Unseat nav from its own transition layer so it ripples with the page instead of snapping
  const centeredNav = document.querySelector('.centered-nav');
  const mobileHeader = document.querySelector('.mobile-header');
  if (centeredNav) centeredNav.style.viewTransitionName = 'none';
  if (mobileHeader) mobileHeader.style.viewTransitionName = 'none';

  const transition = document.startViewTransition(() => {
    applyTheme(willBeDark);
    afterApply();
  });

  transition.ready.then(() => {
    // the new theme ripples out from the bottom-center, washing over the page
    document.documentElement.animate(
      { clipPath: ['circle(0% at 50% 100%)', 'circle(150% at 50% 100%)'] },
      {
        duration: 900,
        easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
        pseudoElement: '::view-transition-new(root)',
      }
    );
  });

  transition.finished.then(() => {
    if (centeredNav) centeredNav.style.viewTransitionName = '';
    if (mobileHeader) mobileHeader.style.viewTransitionName = '';
  });
});

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

// Visitor-localized clock — shows the city the visitor is browsing from and the
// local time there. Defaults to Chicago and silently upgrades once the IP lookup
// resolves; any failure leaves the Chicago default in place.
const clockLocation = { city: 'Chicago', timeZone: 'America/Chicago' };

function updateBottomClock() {
  // hold off while the intro scramble is resolving the clock text
  if (window.__textScrambleActive) return;

  const options = {
    timeZone: clockLocation.timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  };

  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-US', options);
  } catch (e) {
    // A bad/unknown timezone string would throw on every tick — fall back.
    clockLocation.timeZone = 'America/Chicago';
    formatter = new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'America/Chicago' });
  }

  const clock = document.getElementById('chicagoClock');
  if (clock) {
    const parts = formatter.formatToParts(new Date());
    let timePart = '';
    let ampm = '';
    for (const p of parts) {
      if (p.type === 'dayPeriod') ampm = p.value;
      else timePart += p.value;
    }
    clock.innerHTML =
      `${clockLocation.city} - ${timePart.trim()} <span class="clock-ampm">${ampm}</span>`;
  }
}

// One silent IP-based lookup (no key, HTTPS, CORS-friendly). On success we adopt
// the visitor's city + IANA timezone; on any failure the Chicago default stays.
async function detectVisitorLocation() {
  try {
    const res = await fetch('https://ipwho.is/');
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.success && data.region && data.timezone && data.timezone.id) {
      clockLocation.city = data.region;
      clockLocation.timeZone = data.timezone.id;
      updateBottomClock(); // reflect the new city/time without waiting for the next tick
    }
  } catch (e) {
    // Network error / blocked request — keep the Chicago fallback.
  }
}

updateBottomClock();      // immediate render with the default
detectVisitorLocation();  // async upgrade to the visitor's city/time
// updates every second
setInterval(updateBottomClock, 1000);

// Rainbow filter on face — fades in/out and auto-rotates hue
(function () {
  const headCanvas = document.getElementById('head-canvas');
  if (!headCanvas) return;
  let rafId = null, intensity = 0, hue = 0, active = false;

  function tick() {
    intensity = active
      ? Math.min(1, intensity + 0.04)
      : Math.max(0, intensity - 0.04);
    hue = (hue + 2) % 360;

    headCanvas.style.filter = intensity > 0.001
      ? `sepia(${intensity}) saturate(${intensity * 5}) hue-rotate(${hue}deg)`
      : '';

    rafId = (intensity > 0 || active) ? requestAnimationFrame(tick) : null;
  }

  headCanvas.addEventListener('mouseenter', () => {
    active = true;
    if (!rafId) rafId = requestAnimationFrame(tick);
  });
  headCanvas.addEventListener('mouseleave', () => {
    active = false;
    if (!rafId) rafId = requestAnimationFrame(tick);
  });
}());
