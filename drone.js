/* =========================================
   DRONE CLEANING CASE STUDY JAVASCRIPT
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {

  const scrollContainer = document.querySelector('.case-content');

  // --- TOC Scroll Spy ---
  const tocLinks = document.querySelectorAll('.toc-link');
  const sections = document.querySelectorAll('.case-section');

  function setActiveLink(id) {
    tocLinks.forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
    });
  }

  if (scrollContainer && sections.length) {
    scrollContainer.addEventListener('scroll', () => {
      const containerTop = scrollContainer.getBoundingClientRect().top;
      let current = sections[0].id;

      sections.forEach(section => {
        const sectionTop = section.getBoundingClientRect().top - containerTop;
        if (sectionTop <= 80) {
          current = section.id;
        }
      });

      setActiveLink(current);
    });
  }

  // --- Horizontal Carousel Scroll Mapping ---
  const wrapper = document.querySelector('.horizontal-scroll-wrapper');
  const carousel = document.querySelector('.ideation-carousel');

  if (wrapper && carousel && scrollContainer) {
    scrollContainer.addEventListener('scroll', () => {

      // Disable horizontal mapping on mobile devices
      if (window.innerWidth <= 1024) return;

      const wrapperRect = wrapper.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();

      // Calculate how far the wrapper is from the top of the viewable area
      const offsetTop = wrapperRect.top - containerRect.top;

      // If offsetTop is 0 or less, the carousel has hit the ceiling and is "sticking"
      if (offsetTop <= 0) {

        // Calculate our progress down the wrapper
        const scrollDistance = Math.abs(offsetTop);
        const maxScrollableHeight = wrapperRect.height - containerRect.height;

        // Get a percentage from 0.0 to 1.0
        let progress = scrollDistance / maxScrollableHeight;
        progress = Math.max(0, Math.min(1, progress));

        // Map that percentage to the horizontal scroll track
        const maxHorizontalScroll = carousel.scrollWidth - carousel.clientWidth;
        carousel.scrollLeft = progress * maxHorizontalScroll;

      } else {
        // If we scroll back above the wrapper, ensure carousel is firmly at slide 1
        carousel.scrollLeft = 0;
      }
    });
  }

});
