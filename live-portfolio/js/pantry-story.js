// pantry-story.js — the pictures PantryPal's story draws from the app's own
// drawings, laid out here rather than written a hundred times into the page.
// Each is only a picture (aria-hidden in pantrypal.html); what it shows is
// said in words beside it.
//
//   the waffle   [data-waffle] a hundred of the app's ingredient stickers,
//                ten by ten, a sticker a percent of the U.S. food supply;
//                the last thirty are marked thrown away and the ten before
//                them the range up to forty (css/case.css .cs-waste), and
//                they go off from the end backwards as the tile rises
//   the recipes  [data-belt="dishes"] the fifty dishes of the app's book, on
//                a belt that runs past greyed, because none of them started
//                from your shelf
//   the plate    [data-plate] the same fifty, full colour, ten to a row: the
//                book the phone ranks, every time, with no network

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
// pictures do: there are two hundred and fifty of them here, drawn from
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
    // they go off from the last one backwards
    if (i >= 60) cell.style.setProperty('--k', String(99 - i));
    frag.append(cell);
  }
  grid.append(frag);
}

// The recipes, on a belt, doubled so it runs without a seam.
for (const belt of document.querySelectorAll('[data-belt="dishes"]')) {
  const row = document.createElement('div');
  row.className = 'cs-belt-row';
  row.style.setProperty('--dur', '120s');
  for (const pass of [0, 1]) for (const d of DISHES) row.append(pic(d));
  belt.append(row);
}

// The plate.
for (const plate of document.querySelectorAll('[data-plate]')) {
  DISHES.forEach((d, i) => {
    const img = pic(d);
    img.style.setProperty('--i', String(i));
    plate.append(img);
  });
}
