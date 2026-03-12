/* =========================================
   DRONE CLEANING CASE STUDY JAVASCRIPT
   ========================================= */

   document.addEventListener('DOMContentLoaded', () => {
    const wrapper = document.querySelector('.horizontal-scroll-wrapper');
    const carousel = document.querySelector('.ideation-carousel');
    const scrollContainer = document.querySelector('.case-content'); 
  
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
          
          // Calculate our progress down the 400vh wrapper
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