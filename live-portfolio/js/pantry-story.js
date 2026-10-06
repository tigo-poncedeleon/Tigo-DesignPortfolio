// pantry-story.js — the pictures PantryPal's story draws from the app's own
// drawings, laid out here rather than written a hundred times into the page.
// Each is only a picture (aria-hidden in pantrypal.html); what it shows is
// said in words beside it.
//
//   the waffle   [data-waffle] a hundred of the app's ingredient stickers,
//                ten by ten, a sticker a percent of the U.S. food supply;
//                the last thirty are marked thrown away and the ten before
//                them the range up to forty (css/case.css .cs-waste), and
//                the thirty fall out of it, the last first, as the tile
//                rises, each with a turn of its own
//   the plate    [data-plate] the fifty dishes of the app's book, ten to a
//                row: the book the phone ranks, every time, with no network
//
// (The three dinners in the brief are written into the page: they are
// what the brief says, not a picture of it.)

const ART = new URL('../assets/case/pantrypal/app/art/', import.meta.url).href;

// the forty-nine foods the app draws, in its own shelf order
const FOODS = [
  'bacon', 'chicken-breast', 'ground-beef', 'lamb', 'pork', 'salmon', 'sausage', 'shrimp', 'steak', 'tuna', 'turkey',
  'apple', 'avocado', 'banana', 'bell-pepper', 'broccoli', 'carrot', 'cucumber', 'garlic', 'lemon', 'lettuce', 'mushroom',
  'onion', 'potato', 'spinach', 'tomato',
  'butter', 'cheddar-cheese', 'cream-cheese', 'eggs', 'milk', 'mozzarella', 'parmesan', 'peanut-butter', 'yogurt',
  'bread', 'burger-buns', 'flour', 'oats', 'pasta', 'rice', 'tortilla',
  'ketchup', 'mayonnaise', 'mustard', 'olive-oil', 'salt', 'soy-sauce', 'sugar',
];
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
// pictures do: there are a hundred and fifty of them here, drawn from
// ninety-nine files, the foods shared with the app's own demo
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

// The waffle. The foods are dealt so no two neighbours repeat, across or
// down: a stride of eleven through the forty-nine (which shares no factor
// with it) walks every one before it comes round again.
for (const grid of document.querySelectorAll('[data-waffle]')) {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < 100; i++) {
    const cell = document.createElement('i');
    const food = FOODS[(i * 11) % FOODS.length];
    cell.append(pic(food));
    if (i >= 70) cell.className = 'is-gone';
    else if (i >= 60) cell.className = 'is-maybe';
    // they go from the last one backwards
    if (i >= 60) cell.style.setProperty('--k', String(99 - i));
    // a thrown one turns as it falls, this way or that, by eight to
    // twenty-six degrees, and falls past the rows under it and off the tile
    if (i >= 70) {
      cell.style.setProperty('--tilt', `${(i % 2 ? 1 : -1) * (8 + ((i * 7) % 19))}deg`);
      cell.style.setProperty('--drop', String(9 - Math.floor(i / 10) + 2));
    }
    frag.append(cell);
  }
  grid.append(frag);
}

// The hub's findings, each drawn to the place on the old screen it is
// about: from the finding's name, out past the screen's edge and in to the
// place (data-at: across and down the screen, in fractions of it; two
// places for a finding about two). Drawn again whenever the stage changes
// size, and only while the findings stand beside the screen, not under it.
const SVG = 'http://www.w3.org/2000/svg';
for (const stage of document.querySelectorAll('[data-leaders]')) {
  const svg = stage.querySelector('.cs-hub-leaders');
  const shot = stage.querySelector('.cs-hub-shot');
  const draw = () => {
    svg.replaceChildren();
    const box = stage.getBoundingClientRect();
    const s = shot.getBoundingClientRect();
    const items = [...stage.querySelectorAll('[data-at]')];
    if (!s.height || items.some((li) => li.getBoundingClientRect().left < s.right)) return;
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    const add = (name, attrs) => {
      const el = document.createElementNS(SVG, name);
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      svg.append(el);
      return el;
    };
    items.forEach((li, i) => {
      const name = li.querySelector('.cs-find-name');
      const r = name.getBoundingClientRect();
      const line = parseFloat(getComputedStyle(name).lineHeight) || 24;
      const y0 = r.top - box.top + line / 2;
      const x0 = r.left - box.left - 10;
      const elbow = s.right - box.left + 18;
      for (const at of li.dataset.at.split(',')) {
        const [fx, fy] = at.trim().split(/\s+/).map(Number);
        const tx = s.left - box.left + fx * s.width;
        const ty = s.top - box.top + fy * s.height;
        add('path', { d: `M${x0} ${y0} H${elbow} L${tx} ${ty}`, pathLength: '1', style: `--i: ${i}` });
        add('circle', { class: 'is-ring', cx: tx, cy: ty, r: 8, style: `--i: ${i}` });
        add('circle', { class: 'is-dot', cx: tx, cy: ty, r: 3, style: `--i: ${i}` });
      }
    });
  };
  new ResizeObserver(draw).observe(stage);
  shot.querySelector('img')?.addEventListener('load', draw);
  draw();
}

// The plate.
for (const plate of document.querySelectorAll('[data-plate]')) {
  DISHES.forEach((d, i) => {
    const img = pic(d);
    img.style.setProperty('--i', String(i));
    plate.append(img);
  });
}
