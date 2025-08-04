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

// dark or light mode 
const isDark = localStorage.getItem('theme') === 'dark';

if (isDark) {
  document.body.classList.add('dark-mode');
  }