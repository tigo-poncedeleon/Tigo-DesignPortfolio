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

if (!localStorage.getItem('hasVisited')) {
  typeMessage(messages[0], () => {
    intro.classList.add('dark');
    typeMessage(messages[1], () => {
      intro.classList.add('fade-out');
      document.body.classList.add('loaded');

      localStorage.setItem('hasVisited', 'true');
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

toggle.addEventListener('click', () => {
 const isDark = document.body.classList.toggle('dark-mode');
 updateThemeIcon(isDark);
 toggle.setAttribute('aria-pressed', isDark ? 'true' : 'false');
 localStorage.setItem('theme', isDark ? 'dark' : 'light');
 if (circleText) {
   circleText.setAttribute('fill', isDark ? '#ffffff' : '#000000');
 }
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
setInterval(updateBottomClock, 60000); 





