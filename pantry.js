document.addEventListener('DOMContentLoaded', () => {
  const scrollContainer = document.querySelector('.case-content');
  const sections = Array.from(document.querySelectorAll('.case-section'));
  const navLinks = Array.from(document.querySelectorAll('.toc-link'));

  if (!scrollContainer || sections.length === 0 || navLinks.length === 0) return;

  // Keep this in sync with your CSS:
  // .case-content { scroll-padding-top: 120px; }
  const SCROLL_PADDING_TOP = 120;

  const setActive = (id) => {
    navLinks.forEach(link => link.classList.remove('active'));
    const activeLink = document.querySelector(`.toc-link[href="#${id}"]`);
    if (activeLink) activeLink.classList.add('active');
  };

  // Observer: choose the section closest to the top of the scroll container
  const observerOptions = {
    root: scrollContainer,
    // Activation band near the top; tweak if you want the highlight to change earlier/later
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

  // Sidebar click: use scrollIntoView so it respects scroll-padding-top
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

      // Immediately reflect active state on click (observer will keep it synced after)
      setActive(id);
    });
  });
});
