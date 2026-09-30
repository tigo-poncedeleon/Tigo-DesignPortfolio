// pantry-demo.js — PantryPal's case study runs the app: the shelf on the left
// of the demo tile, and the phone on the right answering it
// (assets/case/pantrypal/app/pantry-app.js).
//
//   the shelf   every ingredient the bundled book knows, as the app's own
//               stickers, sorted onto the app's own shelves by the app's
//               own rule (Models.swift IngredientCategory.guess); a press
//               stocks one or takes it off, and the chef reranks
//   presets     the App Store's shelf (the seeded demo the app's own tests
//               pin to Cheddar Cheeseburger), a breakfast fridge, and an
//               empty one, which is the app's welcome
//   the read    one line under the shelf that says what the chef decided
//               and why, in words, for the eye and for a screen reader
//
// Nothing loads until the tile is a screen or so away: the book, fifty
// drawings and two fonts are the heaviest things on the page.

const section = document.querySelector('[data-pantry-demo]');
if (section) {
  const phoneEl = section.querySelector('[data-pantry-app]');
  const shelfEl = section.querySelector('[data-shelf]');
  const APP = new URL('../assets/case/pantrypal/app/', import.meta.url).href;

  // the App Store shelf, row for row as the app's -seed lays it out
  const PRESETS = {
    store: ['Tuna', 'Lamb', 'Pork', 'Chicken Breast', 'Steak', 'Ground Beef', 'Bacon', 'Salmon',
      'Lettuce', 'Tomato', 'Cheddar Cheese', 'Burger Buns', 'Salt'],
    breakfast: ['Eggs', 'Milk', 'Bread', 'Butter', 'Banana', 'Oats', 'Yogurt', 'Avocado',
      'Bacon', 'Cheddar Cheese', 'Tomato', 'Spinach'],
    empty: [],
  };
  // IngredientCategory.guess, in the app's own order: the first shelf whose
  // words the name contains, and the pantry for everything else
  const SHELVES = [
    ['meat', ['beef', 'chicken', 'pork', 'lamb', 'steak', 'bacon', 'turkey', 'sausage', 'salmon', 'tuna', 'shrimp', 'fish', 'ham', 'meat']],
    ['dairy', ['cheese', 'milk', 'butter', 'yogurt', 'cream', 'egg', 'parmesan', 'mozzarella', 'cheddar']],
    ['produce', ['lettuce', 'tomato', 'onion', 'garlic', 'pepper', 'broccoli', 'spinach', 'mushroom', 'potato', 'carrot', 'cucumber', 'avocado', 'lemon', 'lime', 'banana', 'apple', 'berry', 'salad', 'herb', 'basil']],
    ['grain', ['bun', 'bread', 'rice', 'pasta', 'tortilla', 'oats', 'flour', 'noodle', 'cereal', 'bagel']],
  ];
  const ORDER = ['meat', 'produce', 'dairy', 'grain', 'pantry'];
  const shelfOf = (name) => {
    const n = name.toLowerCase();
    for (const [shelf, words] of SHELVES) if (words.some((w) => n.includes(w))) return shelf;
    return 'pantry';
  };
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  let app = null;
  let stocked = new Set(PRESETS.store);
  let buttons = new Map();

  function read(deck) {
    const out = shelfEl.querySelector('.cs-shelf-read');
    const n = stocked.size;
    if (!n) {
      out.innerHTML = 'An empty shelf, so the app asks <b>what’s in your kitchen?</b> instead of guessing.';
      return;
    }
    // the card on top: the chef's own pick, or the one you have walked to
    const i = app ? app.index() : 0;
    const top = deck[i];
    const why = top.stocked
      ? `every ingredient on your shelf${top.staples.length ? `, with ${top.staples.join(' and ').toLowerCase()} assumed` : ''}`
      : `short of ${top.missing.slice(0, 3).join(', ').toLowerCase()}${top.missing.length > 3 ? ` and ${top.missing.length - 3} more` : ''}`;
    const which = i === 0 ? 'The chef’s pick is' : `Pick ${i + 1} of ${deck.length} is`;
    out.innerHTML = `${n} on the shelf. ${which} <b>${top.recipe.title}</b>: ${why}.`;
  }

  function paintPresets() {
    for (const b of shelfEl.querySelectorAll('[data-preset]')) {
      const list = PRESETS[b.dataset.preset];
      b.setAttribute('aria-pressed', String(list.length === stocked.size && list.every((x) => stocked.has(x))));
    }
  }

  function set(list, { animate = [] } = {}) {
    stocked = new Set(list);
    for (const [name, b] of buttons) {
      b.setAttribute('aria-pressed', String(stocked.has(name)));
      b.classList.toggle('is-new', animate.includes(name));
    }
    paintPresets();
    app?.setShelf([...stocked]);
  }

  function build(book) {
    const names = [...new Set(book.flatMap((r) => r.ingredientNames))];
    const groups = new Map(ORDER.map((k) => [k, []]));
    for (const n of names) groups.get(shelfOf(n)).push(n);
    const wrap = shelfEl.querySelector('.cs-shelf-groups');
    for (const [shelf, list] of groups) {
      if (!list.length) continue;
      list.sort((a, b) => a.localeCompare(b));
      const row = document.createElement('div');
      row.className = 'cs-shelf-group';
      row.innerHTML = `<p>${shelf}</p><div class="cs-shelf-items" role="group" aria-label="${shelf}"></div>`;
      const items = row.lastElementChild;
      for (const name of list) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'cs-food';
        b.dataset.name = name;
        b.setAttribute('aria-pressed', String(stocked.has(name)));
        b.setAttribute('aria-label', name);
        b.innerHTML = `<img src="${APP}art/${slug(name)}.webp" alt="" width="96" height="96" loading="lazy" decoding="async" draggable="false" />`;
        b.addEventListener('click', () => {
          const next = new Set(stocked);
          if (next.has(name)) next.delete(name); else next.add(name);
          set([...next], { animate: next.has(name) ? [name] : [] });
        });
        buttons.set(name, b);
        items.append(b);
      }
      wrap.append(row);
    }
    for (const b of shelfEl.querySelectorAll('[data-preset]')) {
      b.addEventListener('click', () => {
        const list = PRESETS[b.dataset.preset];
        set(list, { animate: list.filter((x) => !stocked.has(x)) });
      });
    }
  }

  async function start() {
    const [{ mountPantryApp }, book] = await Promise.all([
      import(`${APP}pantry-app.js`),
      fetch(`${APP}chefbook.json`).then((r) => r.json()).then((d) => d.recipes),
    ]);
    build(book);
    // the read under the shelf says what is on top, so the phone keeps quiet
    app = mountPantryApp(phoneEl, { book, shelf: [...stocked], announce: false });
    // the capture that stood in for the phone goes once the phone is here
    phoneEl.style.backgroundImage = '';
    app.on('change', read);
    app.on('pick', () => read(app.deck()));
    read(app.deck());
    paintPresets();
  }

  new IntersectionObserver((entries, io) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    start().catch((err) => {
      // the capture stays as the picture it already is
      console.warn('PantryPal demo did not start:', err);
    });
  }, { rootMargin: '900px 0px' }).observe(section);
}
