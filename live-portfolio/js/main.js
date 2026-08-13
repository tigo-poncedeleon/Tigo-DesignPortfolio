// Boot the landing frame: live clock, gentle fade-in, and the hero's
// scroll hint. The pill's hover chip retired with the cover frame — the
// sidebar is the nav now.
(function () {
  function boot() {
    if (window.FrameClock) window.FrameClock.init();

    const stage = document.getElementById('home');
    requestAnimationFrame(() => { if (stage) stage.classList.add('revealed'); });
    if (!stage) return;

    // ---- keep the hero centred in the CONTENT CARD — the page's own
    // middle, so an open rail moves the name with it instead of leaving it
    // sitting off-centre in the page it belongs to. The card already centres
    // `main` on its own, so the only thing JS still owes the stage is its
    // height: exactly one screen of visible card, measured, so the name's
    // 50%/50% lands in the middle of what you can actually see.
    //
    // Written to the ROOT, not to #home: "one screen of card, in card px" is
    // the measurement every full-bleed stage wants, and Work asks for it too
    // (css/work.css) so its slide owns a whole screen rather than landing
    // centred with a band of nothing above its title.
    const fitHero = () => {
      const root = document.documentElement;
      if (window.matchMedia('(max-width: 700px)').matches) {
        root.style.removeProperty('--hero-h');
        return;
      }
      const s = (window.ShellFit && window.ShellFit.scaleOf)
        ? (window.ShellFit.scaleOf(stage) || 1) : 1;
      // clientHeight, NOT innerHeight: the visitor may run classic always-on
      // scrollbars, and a viewport height that includes one is not the height
      // of the card you can see
      const vh = root.clientHeight;
      const chrome = document.getElementById('shell-chrome');
      const ch = chrome ? chrome.offsetHeight : 0;
      root.style.setProperty('--hero-h', ((vh - ch) / s).toFixed(2) + 'px');
    };
    fitHero();
    window.addEventListener('shell:fit', fitHero);
    window.addEventListener('resize', fitHero, { passive: true });
    // ride the intro assembly frame by frame — the chrome's slide moves the
    // stage without resizing the card, which no observer reports
    window.addEventListener('shell:intro-done', () => {
      let n = 36;
      const tick = () => { fitHero(); if (n--) requestAnimationFrame(tick); };
      tick();
    });

    // ---- the scroll hint arms once the name has typed. For a returning
    // visitor the typewriter has already settled (it runs BEFORE this file
    // and fires shell:intro-done synchronously), so the event can only be
    // waited on while intro-pending is still up — otherwise arm now.
    const arm = () => stage.classList.add('hint-ready');
    if (document.documentElement.classList.contains('intro-pending')) {
      window.addEventListener('shell:intro-done', arm, { once: true });
    } else {
      arm();
    }

    // …and bows out the moment the visitor moves
    let raf = 0;
    const track = () => {
      raf = 0;
      stage.classList.toggle('is-scrolled', window.scrollY > 40);
    };
    window.addEventListener('scroll', () => {
      if (!raf) raf = requestAnimationFrame(track);
    }, { passive: true });
    track();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
