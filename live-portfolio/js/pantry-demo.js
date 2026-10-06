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
//   the phone's own doors, answered here since the shelf is the page's: a
//               card's add-missing chip puts its gaps on the shelf (and the
//               dish stays on top, now with everything), the welcome's scan
//               stocks the App Store's shelf as a receipt would, and its
//               "Type my groceries", the title and the wardrobe all point
//               at the stickers, which hop in a wave to say "here"
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
      out.innerHTML = '<span>An empty shelf, so the app asks <b>what’s in your kitchen?</b> instead of guessing.</span>';
      return;
    }
    // the card on top: a dish made for the shelf, the chef's own pick, or
    // the one you have walked to
    const i = app ? app.index() : 0;
    const top = deck[i];
    const why = top.stocked
      ? `every ingredient on your shelf${top.staples.length ? `, with ${top.staples.join(' and ').toLowerCase()} assumed` : ''}`
      : `short of ${top.missing.slice(0, 3).join(', ').toLowerCase()}${top.missing.length > 3 ? ` and ${top.missing.length - 3} more` : ''}`;
    // built on what was just added: two of it, named, at most
    const around = (top.fresh || []).slice(0, 2).map((x) => x.toLowerCase());
    const which = top.made
      ? (around.length ? `Made around your ${around.join(' and ')}:` : 'Made for your shelf:')
      : i === 0 ? 'The chef’s pick:' : `Pick ${i + 1} of ${deck.length}:`;
    // the dish's own drawing leads the line where the phone is out of sight
    // above the shelf (a phone's column; hidden beside it)
    // (on a phone the line is two: the dish, then why; the count and the
    // colon are for the sentence)
    out.innerHTML = `<img class="cs-shelf-read-art" src="${APP}art/${slug(top.recipe.title)}.webp" alt="" width="96" height="96" decoding="async" /><span><span class="cs-read-lead">${n} on the shelf. ${which} </span><b>${top.recipe.title}</b><span class="cs-read-lead">,</span> ${why}.</span>`;
  }

  function paintPresets() {
    for (const b of shelfEl.querySelectorAll('[data-preset]')) {
      const list = PRESETS[b.dataset.preset];
      b.setAttribute('aria-pressed', String(list.length === stocked.size && list.every((x) => stocked.has(x))));
    }
  }

  function set(list, { animate = [], keep = null } = {}) {
    stocked = new Set(list);
    for (const [name, b] of buttons) {
      b.setAttribute('aria-pressed', String(stocked.has(name)));
      b.classList.toggle('is-new', animate.includes(name));
    }
    paintPresets();
    app?.setShelf([...stocked], { keep, added: animate });
  }

  // "here": the stickers hop, one after another, and the first takes the
  // focus for a keyboard, which is where typing would have gone
  let calling = 0;
  function call({ focus = false } = {}) {
    clearTimeout(calling);
    shelfEl.classList.remove('is-called');
    void shelfEl.offsetWidth;
    shelfEl.classList.add('is-called');
    calling = setTimeout(() => shelfEl.classList.remove('is-called'), 1400);
    const r = shelfEl.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight) shelfEl.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    if (focus) shelfEl.querySelector('.cs-food')?.focus({ preventScroll: true });
  }

  // The rows. The stickers stand in columns every shelf shares, between the
  // least a sticker may be and the most (--sticker-min, --sticker-max), and
  // each shelf's stickers are shared out evenly over the rows it takes, as
  // balanced lines of type are, so no row ends with one alone. Of the counts
  // the width allows, the card takes the one that stands it nearest the
  // phone's height beside it (taking smaller stickers only for a real gain),
  // so the two stand level; with the phone over the card, the fewest rows at
  // the biggest stickers. (Filled row by row, the ninth of the dairy or the
  // fifteenth of the produce stood alone under the rest at one width or
  // another; and the most columns that fit left the card a hand taller than
  // its phone on a laptop and a hand shorter on a wide screen.)
  function fit(wrap) {
    const lists = [...wrap.querySelectorAll('.cs-shelf-items')];
    if (!lists.length || !wrap.clientWidth) return;
    const w = wrap.clientWidth;
    const cs = getComputedStyle(wrap);
    const gap = parseFloat(getComputedStyle(lists[0]).columnGap) || 0;
    const min = parseFloat(cs.getPropertyValue('--sticker-min')) || 32;
    const max = Math.max(min, parseFloat(cs.getPropertyValue('--sticker-max')) || 44);
    const counts = lists.map((l) => l.children.length);
    const size = (c) => (w - (c - 1) * gap) / c;
    const rows = (c) => counts.reduce((sum, n) => sum + Math.ceil(n / c), 0);
    const tall = (c) => counts.reduce((sum, n) => { const r = Math.ceil(n / c); return sum + r * size(c) + (r - 1) * gap; }, 0);
    const hi = Math.max(1, Math.floor((w + gap) / (min + gap)));
    const lo = Math.max(1, Math.min(hi, Math.ceil((w + gap) / (max + gap))));
    const card = wrap.closest('.cs-demo');
    const bench = card?.parentElement;
    const beside = bench && getComputedStyle(bench).gridTemplateColumns.trim().split(/\s+/).length > 1;
    let c = hi;
    if (beside) {
      const now = lists.reduce((sum, l) => sum + l.getBoundingClientRect().height, 0);
      const base = card.getBoundingClientRect().height - now;
      const target = phoneEl.getBoundingClientRect().height;
      let best = Infinity;
      for (let k = lo; k <= hi; k++) {
        const off = Math.abs(base + tall(k) - target);
        if (off < best - 24) { best = off; c = k; }
      }
    } else {
      while (c > lo && rows(c - 1) === rows(c)) c -= 1;
    }
    wrap.style.setProperty('--c', String(c));
    lists.forEach((l, i) => l.style.setProperty('--per', String(Math.ceil(counts[i] / Math.ceil(counts[i] / c)))));
    tags(wrap);
  }

  // A sticker's name tag is centred over it, unless that would take it past
  // the card's edge, where the card would cut it: then it slides in just
  // far enough to stand whole (--tag-x). (Centred always, the bacon at the
  // start of a row and the turkey at its end lost a letter to the card.)
  const measure = document.createElement('canvas').getContext('2d');
  function tags(wrap) {
    const card = wrap.closest('.cs-demo');
    if (!card) return;
    const box = card.getBoundingClientRect();
    const inset = 8;
    for (const b of wrap.querySelectorAll('.cs-food')) {
      const cs = getComputedStyle(b, '::after');
      measure.font = `${cs.fontSize} ${cs.fontFamily}`;
      const w = measure.measureText(b.dataset.name).width + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const r = b.getBoundingClientRect();
      const mid = r.left + r.width / 2;
      const under = box.left + inset - (mid - w / 2);
      const over = mid + w / 2 - (box.right - inset);
      const shift = under > 0 ? under : over > 0 ? -over : 0;
      b.style.setProperty('--tag-x', `${shift.toFixed(1)}px`);
    }
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
      const name = shelf[0].toUpperCase() + shelf.slice(1);
      row.innerHTML = `<p class="cs-plank">${name}</p><div class="cs-shelf-items" role="group" aria-label="${name}"></div>`;
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
        b.style.setProperty('--k', String(buttons.size));
        buttons.set(name, b);
        items.append(b);
      }
      wrap.append(row);
    }
    new ResizeObserver(() => fit(wrap)).observe(wrap);
    fit(wrap);
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
    app.on('add', ({ names, title }) => {
      set([...stocked, ...names], { animate: names.filter((n) => !stocked.has(n)), keep: title });
    });
    app.on('scan', () => set(PRESETS.store, { animate: PRESETS.store }));
    app.on('type', () => call({ focus: true }));
    app.on('shelf', () => call());
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
