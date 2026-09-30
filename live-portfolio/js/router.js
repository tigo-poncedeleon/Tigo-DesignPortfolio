// router.js — which of the page's four screens you are on (and an open
// game) lives in the hash:
//
//   #  (nothing)        home
//   #work  #play  #about
//   #play/pong  #play/snake  #play/flappy   a game, open on its stage
//
// Hash routes, because the site is also served by a plain static server
// (tools/serve.py) that knows nothing of paths, and a reload of /work there
// would be a 404.
//
// Two things write it. Scrolling the page notes the screen you have come to
// (note(), below): the address changes, but with no history entry and no
// hashchange, so a reload or a shared link comes back to that screen, Back
// is not a trail of every screen scrolled past, and the page is not sent
// scrolling after itself. A change of the hash itself (a game opened or
// closed, an address typed in) is a real one: Back from a game closes it.

export const VIEWS = ['home', 'work', 'play', 'about'];
export const GAMES = ['pong', 'snake', 'flappy'];

// The site this one replaced (archive/v2-live-portfolio) named its places
// differently, and those names are out in the world, in shared links and
// old bookmarks: each lands on the screen that holds the same thing now,
// and the address is tidied to the new name. A game's old name opens Play,
// not the game, as the old one did.
const FORMER = {
  home: 'home',
  vicino: 'work', pantrypal: 'work', drone: 'work', nextlevel: 'work',
  pong: 'play', snake: 'play', flappy: 'play',
  bio: 'about', resume: 'about', contact: 'about',
};

export function parse(hash) {
  const h = (hash || '').replace(/^#\/?/, '');
  if (!h) return { view: 'home', game: null };
  const [view, game] = h.split('/');
  if (!VIEWS.includes(view)) {
    return view in FORMER ? { view: FORMER[view], game: null, former: true } : null;
  }
  if (view === 'play' && GAMES.includes(game)) return { view, game };
  return { view, game: null };
}

export const routeKey = (r) => r.view + (r.game ? '/' + r.game : '');
export const href = (r) => (r.view === 'home' ? '#' : '#' + routeKey(r));

export function startRouter(onRoute) {
  // Back, Forward and a reload go back to where you were on the page, as any
  // page's do. Said outright rather than left to the default: the setting
  // outlives a reload, and the draft used to turn it off, when each page was
  // the whole window and there was nothing to restore.
  history.scrollRestoration = 'auto';
  let current = null;

  function handle(event) {
    let next = parse(location.hash);
    if (!next) {
      history.replaceState(null, '', location.pathname + location.search);
      next = { view: 'home', game: null };
    }
    // home is #, which leaves a bare "#" in the address bar; tidy it away
    // (and #home, the old site's name for it), and a former name gives way
    // to the one it has now
    if (next.former) {
      delete next.former;
      history.replaceState(null, '', location.pathname + location.search + (next.view === 'home' ? '' : href(next)));
    } else if (next.view === 'home' && (location.hash === '#' || location.hash === '#home')) {
      history.replaceState(null, '', location.pathname + location.search);
    }
    if (current && routeKey(next) === routeKey(current)) return;
    const prev = current;
    current = next;
    onRoute(next, prev, { initial: !event });
  }

  addEventListener('hashchange', handle);
  handle(null);

  return {
    get current() { return current; },
    go(route, { replace = false } = {}) {
      const target = href(route);
      if (replace) location.replace(target);
      else location.hash = target;
    },
    // the page has been scrolled to another screen: say so in the address,
    // quietly. A game open on the same screen keeps its hash.
    note(route) {
      if (current && route.view === current.view) return;
      current = route;
      const target = route.view === 'home' ? location.pathname + location.search : href(route);
      history.replaceState(null, '', target);
    },
  };
}
