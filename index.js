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

  // graceful fallback: no View Transitions support or reduced-motion preference
  if (!document.startViewTransition || prefersReducedMotion) {
    applyTheme(willBeDark);
    return;
  }

  const transition = document.startViewTransition(() => applyTheme(willBeDark));

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
});

// cursor trail
document.addEventListener('mousemove', (e) => {
  const trail = document.createElement('div');
  trail.className = 'cursor-trail';
  trail.style.left = `${e.clientX}px`;
  trail.style.top = `${e.clientY}px`;

  const isDark = document.body.classList.contains('dark-mode');
  trail.style.backgroundColor = isDark ? '#ffffff' : '#000000';

  document.body.appendChild(trail);
  setTimeout(() => trail.remove(), 500);
});

// Chicago Clock
function updateBottomClock() {
  const options = {
    timeZone: 'America/Chicago',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  };

  const formatter = new Intl.DateTimeFormat('en-US', options);
  const chicagoTime = formatter.format(new Date());
  const clock = document.getElementById('chicagoClock');
  if (clock) {
    clock.textContent = `Chicago - ${chicagoTime}`;
  }
}

updateBottomClock();
// updates every second
setInterval(updateBottomClock, 1000);
