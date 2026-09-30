/* =========================
   PantryPal Case Study JS
   (Theme, Cursor, Clock, Sidebar Toggle, & Optimized Scroll Spy)
   ========================= */

   document.addEventListener('DOMContentLoaded', () => {
  
    /* ---------------------------------
       1) Theme (dark/light) + icon swap
       --------------------------------- */
    const toggle = document.querySelector('.theme-toggle');
    const iconImg = document.querySelector('.theme-toggle .icon img');
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
  
    applyTheme(localStorage.getItem('theme') || 'light');
  
    if (toggle) {
      toggle.addEventListener('click', () => {
        const nextTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
        localStorage.setItem('theme', nextTheme);
        applyTheme(nextTheme);
      });
    }
  
    /* -------------------------
       2) Cursor trail
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
       3) Chicago clock
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
       4) Sidebar Toggle Logic
       ------------------------------------------------ */
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.case-sidebar');
  
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
      });
    }
  
    /* ------------------------------------------------
       5) Optimized Sidebar Scroll Spy (With Click Lock)
       ------------------------------------------------ */
    const scrollContainer = document.querySelector('.case-content');
    const sections = Array.from(document.querySelectorAll('.case-section'));
    const navLinks = Array.from(document.querySelectorAll('.toc-link'));
  
    if (scrollContainer && sections.length > 0 && navLinks.length > 0) {
      
      // Adjusted to 140 to account for your taller 120px Nav Bar
      const SCROLL_PADDING_TOP = 140;
      
      // Variables to lock the observer during a click scroll
      let isClickScrolling = false; 
      let scrollTimeout; 
  
      const setActive = (id) => {
        navLinks.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${id}`) {
            link.classList.add('active');
          }
        });
      };
  
      const observerOptions = {
        root: scrollContainer,
        // Adds a 25% "dead zone" at the bottom to stop rapid-fire bolding
        rootMargin: `-${SCROLL_PADDING_TOP}px 0px -25% 0px`,
        threshold: 0.1 
      };
  
      const observer = new IntersectionObserver((entries) => {
        // If the user clicked a link, DO NOTHING while we travel past other sections
        if (isClickScrolling) return; 
  
        const entering = entries.find(entry => entry.isIntersecting);
        if (entering) {
          setActive(entering.target.id);
        }
      }, observerOptions);
  
      sections.forEach(section => observer.observe(section));
  
      // Detect when the smooth scroll finishes to "unlock" normal behavior
      scrollContainer.addEventListener('scroll', () => {
        if (isClickScrolling) {
          clearTimeout(scrollTimeout);
          // Wait 100ms after the screen stops moving, then reactivate the observer
          scrollTimeout = setTimeout(() => {
            isClickScrolling = false;
          }, 100);
        }
      });
  
      // Smooth scroll for clicks
      navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const id = link.getAttribute('href').slice(1);
          const target = document.getElementById(id);
          
          if (target) {
            // 1. Lock the observer so it doesn't trigger on intermediate sections
            isClickScrolling = true;
            
            // 2. Instantly update the bold state to the destination link
            setActive(id);
  
            // 3. Execute the smooth scroll
            target.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
          }
        });
      });
    }
  });
  