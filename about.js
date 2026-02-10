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

const emailBtn = document.getElementById('email-button');
const toast = document.getElementById('copy-toast');
const myEmail = 'tigoponcedeleon@gmail.com';

emailBtn.addEventListener('click', () => {
  // Copy to clipboard
  navigator.clipboard.writeText(myEmail).then(() => {
    // Show the "Copied!" message
    toast.classList.add('show');
    
    // Hide it again after 2 seconds
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2000);
  });
});

