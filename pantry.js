document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Select elements
    const sections = document.querySelectorAll('.case-section');
    const navLinks = document.querySelectorAll('.toc-link');
    
    // 2. Intersection Observer Options
    // This defines "when" a section is considered active.
    // threshold: 0.3 means "when 30% of the section is visible"
    const observerOptions = {
        root: document.querySelector('.case-content'), // We are observing scroll inside this container
        threshold: 0.3, 
        rootMargin: "-10% 0px -40% 0px" // Adjusts the "active zone" toward the top-middle of screen
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Remove active class from all links
                navLinks.forEach(link => {
                    link.classList.remove('active');
                });

                // Add active class to the link corresponding to the visible section
                const activeId = entry.target.getAttribute('id');
                const activeLink = document.querySelector(`.toc-link[href="#${activeId}"]`);
                
                if (activeLink) {
                    activeLink.classList.add('active');
                }
            }
        });
    }, observerOptions);

    // 3. Start observing each section
    sections.forEach(section => {
        observer.observe(section);
    });
});