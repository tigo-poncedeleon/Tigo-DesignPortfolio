document.addEventListener('DOMContentLoaded', () => {
    // 1. Select the container that actually scrolls
    const scrollContainer = document.querySelector('.case-content');
    const sections = document.querySelectorAll('.case-section');
    const navLinks = document.querySelectorAll('.toc-link');

    // 2. Set up the "Active Zone"
    // rootMargin defines where the "trigger line" is.
    // '-40% 0px -60% 0px' means the section only activates when it 
    // enters a small strip near the top-middle of the screen.
    const observerOptions = {
        root: scrollContainer,
        rootMargin: '-40% 0px -60% 0px', 
        threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Remove 'active' from all links
                navLinks.forEach(link => link.classList.remove('active'));
                
                // Add 'active' to the link corresponding to the visible section
                const id = entry.target.getAttribute('id');
                const activeLink = document.querySelector(`.toc-link[href="#${id}"]`);
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