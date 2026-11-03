// pantry-story.js — the pictures PantryPal's story draws from the app's own
// drawings, laid out here rather than written fifty times into the page.
// Each is only a picture (aria-hidden in pantrypal.html); what it shows is
// said in words beside it.
//
//   the plate    [data-plate] the fifty dishes of the app's book, ten to a
//                row: the book the phone ranks, every time, with no network
//
// and the one thing here that is not a picture: the Ship chapter's switch
// between the app as it is and as it was ([data-then]).

const ART = new URL('../assets/case/pantrypal/app/art/', import.meta.url).href;

// the fifty dishes of the bundled book (chefbook.json), in its order
const DISHES = [
  'cheddar-cheeseburger', 'chopped-cheese', 'beef-lettuce-cups', 'garlic-butter-pasta', 'lemon-garlic-salmon',
  'chicken-fajita-bowl', 'veggie-omelette', 'chicken-fried-rice', 'turkey-club-sandwich', 'garlic-veggie-stir-fry',
  'banana-oat-pancakes', 'overnight-oats', 'breakfast-burrito', 'avocado-toast', 'bacon-egg-and-cheese',
  'sausage-potato-hash', 'spinach-mushroom-scramble', 'french-toast', 'tuna-melt', 'blt-sandwich',
  'chicken-caesar-wrap', 'egg-salad-sandwich', 'turkey-avocado-wrap', 'chicken-quesadilla', 'beef-bolognese-pasta',
  'creamy-tomato-pasta', 'shrimp-scampi', 'mushroom-spinach-pasta', 'chicken-parmesan', 'beef-and-broccoli',
  'teriyaki-chicken-bowl', 'shrimp-fried-rice', 'pork-pepper-stir-fry', 'salmon-rice-bowl', 'beef-tacos',
  'chicken-enchiladas', 'shrimp-tacos', 'huevos-rancheros', 'shepherd-s-pie', 'classic-meatloaf',
  'pork-chops-with-apples', 'garlic-butter-steak-and-potatoes', 'sausage-and-peppers', 'baked-salmon-with-broccoli',
  'lamb-chops-with-garlic-and-lemon', 'tuna-noodle-casserole', 'creamy-tomato-soup', 'loaded-baked-potato',
  'banana-bread', 'apple-oat-crumble',
];

// every drawing waits until it is near the window, as the page's own
// pictures do: there are fifty of them here, the dishes shared with the
// app's own demo
const pic = (slug) => {
  const img = document.createElement('img');
  img.src = `${ART}${slug}.webp`;
  img.alt = '';
  img.width = 96;
  img.height = 96;
  img.decoding = 'async';
  img.loading = 'lazy';
  img.draggable = false;
  return img;
};

// The plate.
for (const plate of document.querySelectorAll('[data-plate]')) {
  DISHES.forEach((d, i) => {
    const img = pic(d);
    img.style.setProperty('--i', String(i));
    plate.append(img);
  });
}

// The Ship chapter's switch ([data-then]): Current or Before turns the
// whole row, to the prototype's six screens in their own order or back
// (css/case.css .cs-ship-reel, which says what stands and where). The row
// fades out, turns, and comes back a screen at a time, in the order the
// screens now stand. While it shows the six, the reel keeps the stretch of
// page the thirteen gave it (data-hold), so turning it never moves the
// page under the reader. The arrow keys move along the switch, as along
// any radio group.
for (const reel of document.querySelectorAll('[data-then]')) {
  const options = [...reel.querySelectorAll('.cs-ship-switch [data-show]')];
  const track = reel.querySelector('.cs-reel-track');
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let fading = null;
  const turn = (which) => {
    reel.toggleAttribute('data-hold', which !== 'now');
    reel.dataset.show = which;
    if (still()) return;
    const on = [...track.children].filter((li) => li.offsetParent !== null).sort((a, b) => a.offsetLeft - b.offsetLeft);
    on.forEach((li, n) => li.style.setProperty('--n', String(n)));
    track.classList.remove('is-dealt');
    void track.offsetWidth;
    track.classList.add('is-dealt');
  };
  const show = (which, focus = false) => {
    options.forEach((o) => {
      const on = o.dataset.show === which;
      o.setAttribute('aria-checked', String(on));
      o.tabIndex = on ? 0 : -1;
      if (on && focus) o.focus();
    });
    if (reel.dataset.show === which && !fading) return;
    fading?.cancel();
    if (still()) { turn(which); return; }
    fading = track.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 170, easing: 'ease-out', fill: 'forwards' });
    const f = fading;
    f.finished.then(() => { turn(which); f.cancel(); if (fading === f) fading = null; }).catch(() => {});
  };
  options.forEach((o, n) => {
    o.addEventListener('click', () => show(o.dataset.show));
    o.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      show(options[(n + step + options.length) % options.length].dataset.show, true);
    });
  });
  show(reel.dataset.show || 'now');
}
