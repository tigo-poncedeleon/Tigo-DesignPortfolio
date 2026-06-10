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
const icon = document.getElementById('themeIcon');
const circleText = document.getElementById('circleText');


const lightIcon = 'Media/moon.png';
const darkIcon = 'Media/circle.png';


function updateThemeIcon(isDark) {
 icon.style.setProperty('--icon-mask', `url('${isDark ? darkIcon : lightIcon}')`);
}

if (localStorage.getItem('theme') === 'dark') {
 document.body.classList.add('dark-mode');
 updateThemeIcon(true);
 circleText?.setAttribute('fill', '#ffffff');
} else {
 updateThemeIcon(false);
}

toggle.addEventListener('click', () => {
 const isDark = document.body.classList.toggle('dark-mode');
 updateThemeIcon(isDark);
 toggle.setAttribute('aria-pressed', isDark ? 'true' : 'false');
 localStorage.setItem('theme', isDark ? 'dark' : 'light');
 if (circleText) {
   circleText.setAttribute('fill', isDark ? '#ffffff' : '#000000');
 }
});





// Chicago Clock
function updateBottomClock() {
  const options = {
    timeZone: 'America/Chicago',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit', // Added seconds here
    hour12: true,
  };
 
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const chicagoTime = formatter.format(new Date());
  const clock = document.getElementById('chicagoClock');
  if (clock) {
    clock.textContent = `Chicago - ${chicagoTime}`;
  }
 }
 
 updateBottomClock(); // Chicago Clock
 function updateBottomClock() {
  const options = {
    timeZone: 'America/Chicago',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit', // Added seconds here
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
 // Changed from 60000ms to 1000ms so it updates every second
 setInterval(updateBottomClock, 1000);


// random palette hover effect on nav links
const palette = [
  '#FF6B6B',
  '#FF8C42',
  '#FFD166',
  '#06D6A0',
  '#4ECDC4',
  '#4361EE',
  '#A855F7',
  '#F72585',
];

function pickColor() {
  return palette[Math.floor(Math.random() * palette.length)];
}

// nav links
document.querySelectorAll('.nav-link').forEach(el => {
  el.addEventListener('mouseenter', () => { el.style.color = pickColor(); });
  el.addEventListener('mouseleave', () => { el.style.color = ''; });
});

// portrait photo — palette colour wash on hover
const centerImage = document.querySelector('.center-image');
const imageTint = document.getElementById('imageTint');
if (centerImage && imageTint) {
  centerImage.addEventListener('mouseenter', () => {
    imageTint.style.backgroundColor = pickColor();
    imageTint.style.opacity = '0.6';
  });
  centerImage.addEventListener('mouseleave', () => {
    imageTint.style.opacity = '0';
  });
}

// chicago clock
const clockEl = document.getElementById('chicagoClock');
if (clockEl) {
  clockEl.addEventListener('mouseenter', () => { clockEl.style.color = pickColor(); });
  clockEl.addEventListener('mouseleave', () => { clockEl.style.color = ''; });
}

// moon / circle icon (masked, so background-color tints it)
if (icon) {
  icon.addEventListener('mouseenter', () => { icon.style.backgroundColor = pickColor(); });
  icon.addEventListener('mouseleave', () => { icon.style.backgroundColor = ''; });
}

// circular text — each segment between "·" gets its own random color
const circlePathText = document.getElementById('circlePathText');
if (circlePathText) {
  const SVGNS = 'http://www.w3.org/2000/svg';
  const segments = circlePathText.textContent.split('·');
  circlePathText.textContent = '';
  segments.forEach((seg, i) => {
    const span = document.createElementNS(SVGNS, 'tspan');
    span.setAttribute('class', 'circle-seg');
    span.textContent = seg;
    circlePathText.appendChild(span);
    if (i < segments.length - 1) {
      const dot = document.createElementNS(SVGNS, 'tspan');
      dot.textContent = '·';
      circlePathText.appendChild(dot);
    }
  });
  circlePathText.querySelectorAll('.circle-seg').forEach(seg => {
    seg.addEventListener('mouseenter', () => { seg.style.fill = pickColor(); });
    seg.addEventListener('mouseleave', () => { seg.style.fill = ''; });
  });
}





