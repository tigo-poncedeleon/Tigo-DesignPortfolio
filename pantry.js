/* =========================
   PantryPal Case Study JS
   (self-contained: theme + cursor + clock + sidebar scroll spy)
   ========================= */

document.addEventListener('DOMContentLoaded', () => {
  /* ---------------------------------
     1) Theme (dark/light) + icon swap
     --------------------------------- */
  const toggle = document.querySelector('.theme-toggle');
  const iconImg = document.querySelector('.theme-toggle .icon img'); // safe even if null
  const circleText = document.getElementById('circleText');

  const lightIcon = 'Media/moon.png';
  const darkIcon  = 'Media/circle.png';

  function updateThemeIcon(isDark) {
    if (!iconImg) return;
    iconImg.src = isDark ? darkIcon : lightIcon;
    iconImg.alt = isDark ? 'circle' : 'moon';
  }

  function applyTheme(theme) {
    const isDark = theme === 'dark';
    document.body.classList.toggle('dark-mode', isDark);
    updateThemeIcon(isDark);

    if (toggle) toggle.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    if (circleText) circleText.setAttribute('fill', isDark ? '#ffffff' : '#000000');
  }

  // Apply saved theme on load
  applyTheme(localStorage.getItem('theme') || 'light');

  // Toggle handler (only if button exists)
  if (toggle) {
    toggle.addEventListener('click', () => {
      const nextTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
      localStorage.setItem('theme', nextTheme);
      applyTheme(nextTheme);
    });
  }

  /* -------------------------
     2) Cursor trail (always)
     ------------------------- */
  document.addEventListener('mousemove', (e) => {
    const trail = document.createElement('div');
    trail.className = 'cursor-trail';
    trail.style.left = `${e.clientX}px`;
    trail.style.top  = `${e.clientY}px`;

    const isDark = document.body.classList.contains('dark-mode');
    trail.style.backgroundColor = isDark ? '#ffffff' : '#000000';

    document.body.appendChild(trail);
    setTimeout(() => trail.remove(), 500);
  });

  /* -------------------------
     3) Chicago clock (optional)
     ------------------------- */
  function updateBottomClock() {
    const clock = document.getElementById('chicagoClock');
    if (!clock) return;

    const options = {
      timeZone: 'America/Chicago',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    };

    const formatter = new Intl.DateTimeFormat('en-US', options);
    const chicagoTime = formatter.format(new Date());
    clock.textContent = `Chicago - ${chicagoTime}`;
  }

  updateBottomClock();
  setInterval(updateBottomClock, 60000);

  /* ------------------------------------------------
     4) Sidebar Scroll Spy + click scrolling (your TOC)
     ------------------------------------------------ */
  const scrollContainer = document.querySelector('.case-content');
  const sections = Array.from(document.querySelectorAll('.case-section'));
  const navLinks = Array.from(document.querySelectorAll('.toc-link'));

  if (!scrollContainer || sections.length === 0 || navLinks.length === 0) return;

  // Keep in sync with your CSS:
  // .case-content { scroll-padding-top: 120px; }
  const SCROLL_PADDING_TOP = 120;

  const setActive = (id) => {
    navLinks.forEach(link => link.classList.remove('active'));
    const activeLink = document.querySelector(`.toc-link[href="#${id}"]`);
    if (activeLink) activeLink.classList.add('active');
  };

  const observerOptions = {
    root: scrollContainer,
    rootMargin: `-${SCROLL_PADDING_TOP}px 0px -70% 0px`,
    threshold: 0
  };

  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter(e => e.isIntersecting);
    if (visible.length === 0) return;

    visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    setActive(visible[0].target.id);
  }, observerOptions);

  sections.forEach(section => observer.observe(section));

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();

      const href = link.getAttribute('href');
      if (!href || !href.startsWith('#')) return;

      const id = href.slice(1);
      const target = document.getElementById(id);
      if (!target) return;

      // Smooth scroll inside the right panel with consistent top margin
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });

      setActive(id);
    });
  });
});
