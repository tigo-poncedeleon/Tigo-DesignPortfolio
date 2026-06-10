
// dark or light mode 
const isDark = localStorage.getItem('theme') === 'dark';

if (isDark) {
  document.body.classList.add('dark-mode');
}

const emailBtn = document.getElementById('email-button');
const toast = document.getElementById('copy-toast');
const myEmail = 'tigoponcedeleon@gmail.com';

emailBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(myEmail).then(() => {
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2000);
  });
});

// random palette hover effect on nav links
const palette = [
  '#FF6B6B', '#FF8C42', '#FFD166', '#06D6A0',
  '#4ECDC4', '#4361EE', '#A855F7', '#F72585',
];

function pickColor() {
  return palette[Math.floor(Math.random() * palette.length)];
}

document.querySelectorAll('.nav-link').forEach(el => {
  el.addEventListener('mouseenter', () => {
    const c = pickColor();
    el.style.color = c;
    el.style.setProperty('--link-accent', c);
  });
  el.addEventListener('mouseleave', () => {
    el.style.color = '';
    el.style.removeProperty('--link-accent');
  });
});

