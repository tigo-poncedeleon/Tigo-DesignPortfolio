// pantry-demo.js — PantryPal's case study runs the app on a phone
// (assets/case/pantrypal/app/pantry-app.js): the phone stands on its home
// screen, PantryPal opens from its icon, and from there it is the App Store
// build, screen for screen, its scans and its dishes from the app's own
// kitchen. Nothing beside it explains it or points at what to press: a
// visitor finds their own way, as a new chef does. "Start over" is a new
// phone.
//
// Nothing loads until the phone is a screen or so away: the book, the
// drawings and two fonts are the heaviest things on the page.

const section = document.querySelector('[data-pantry-demo]');
if (section) {
  const phoneEl = section.querySelector('[data-pantry-app]');
  const APP = new URL('../assets/case/pantrypal/app/', import.meta.url).href;

  async function start() {
    const [{ mountPantryApp }, book, artIndex] = await Promise.all([
      import(`${APP}pantry-app.js`),
      fetch(`${APP}chefbook.json`).then((r) => r.json()).then((d) => d.recipes),
      fetch(`${APP}art.json`).then((r) => r.json()),
    ]);
    const app = mountPantryApp(phoneEl, { book, artIndex });
    section.querySelector('[data-restart]').addEventListener('click', () => app.restart());
  }

  new IntersectionObserver((entries, io) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    start().catch((err) => {
      // the frame stays as the picture it already is
      console.warn('PantryPal demo did not start:', err);
    });
  }, { rootMargin: '900px 0px' }).observe(section);
}
