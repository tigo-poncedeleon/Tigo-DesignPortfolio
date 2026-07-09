
// Restore menu-open state from the previous page navigation
if (sessionStorage.getItem('menuOpen') === '1') {
  document.body.classList.add('menu-open');
  const b = document.querySelector('.mobile-burger');
  if (b) {
    b.setAttribute('aria-expanded', 'true');
    b.setAttribute('aria-label', 'Close navigation');
  }
}

// Mobile burger menu toggle
const mobileBurger = document.querySelector('.mobile-burger');
if (mobileBurger) {
  mobileBurger.addEventListener('click', () => {
    const isOpen = document.body.classList.toggle('menu-open');
    sessionStorage.setItem('menuOpen', isOpen ? '1' : '0');
    mobileBurger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    mobileBurger.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
  });
}

// dark or light mode
const isDark = localStorage.getItem('theme') === 'dark';

if (isDark) {
  document.body.classList.add('dark-mode');
  }

  document.addEventListener("DOMContentLoaded", () => {
    const sections = document.querySelectorAll(".work-container");
    const navPills = document.querySelectorAll(".nav-pill");
  
    // Options for the Intersection Observer
    const observerOptions = {
      root: document.querySelector(".projects-scroll-container"), // The scrolling container
      rootMargin: "0px",
      threshold: 0.6 // Triggers when 60% of the section is visible
    };
  
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Find the ID of the section currently in view
          const currentId = entry.target.getAttribute("id");
  
          // Remove active class from all pills
          navPills.forEach((pill) => {
            pill.classList.remove("active");
            
            // Add active class to the pill matching the current section ID
            if (pill.getAttribute("data-section") === currentId) {
              pill.classList.add("active");
            }
          });
        }
      });
    }, observerOptions);
  
    // Observe all project sections
    sections.forEach((section) => {
      observer.observe(section);
    });
  });

