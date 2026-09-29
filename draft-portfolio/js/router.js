// router.js — the draft's four pages (and an open game) live in the hash:
//
//   #  (nothing)        home
//   #work  #play  #about
//   #play/pong  #play/snake  #play/flappy   a game, open on its stage
//
// Hash routes, because the draft is served by a plain static server that
// knows nothing of paths, and a reload of /work there would be a 404. Every
// change is a real history entry, so Back and Forward walk the pages, and Back
// from a game closes it.

export const VIEWS = ['home', 'work', 'play', 'about'];
export const GAMES = ['pong', 'snake', 'flappy'];

export function parse(hash) {
  const h = (hash || '').replace(/^#\/?/, '');
  if (!h) return { view: 'home', game: null };
  const [view, game] = h.split('/');
  if (!VIEWS.includes(view)) return null;
  if (view === 'play' && GAMES.includes(game)) return { view, game };
  return { view, game: null };
}

export const routeKey = (r) => r.view + (r.game ? '/' + r.game : '');
export const href = (r) => (r.view === 'home' ? '#' : '#' + routeKey(r));

export function startRouter(onRoute) {
  history.scrollRestoration = 'manual';
  let current = null;

  function handle(event) {
    let next = parse(location.hash);
    if (!next) {
      history.replaceState(null, '', location.pathname + location.search);
      next = { view: 'home', game: null };
    }
    // home is #, which leaves a bare "#" in the address bar; tidy it away
    if (next.view === 'home' && location.hash === '#') {
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
  };
}
