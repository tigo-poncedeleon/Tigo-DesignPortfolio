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