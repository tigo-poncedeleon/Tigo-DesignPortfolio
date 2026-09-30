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
      // the card runs the full height of the window now — the chrome strip
      // that used to be subtracted here is gone
      root.style.setProperty('--hero-h', (root.clientHeight / s).toFixed(2) + 'px');
    };
    fitHero();
    window.addEventListener('shell:fit', fitHero);
    window.addEventListener('resize', fitHero, { passive: true });
    // The assembly used to be a layout animation, so the stage moved for a
    // third of a second without the card ever resizing — nothing observes
    // that, so this rode it frame by frame. It is a FLIP now
    // (js/typewriter.js): the layout is final before the first frame of
    // movement, and this one measurement is the whole of it. It is called
    // during the dispatch, so it lands in the same frame as the layout.
    window.addEventListener('shell:intro-done', fitHero);

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

    // …and bows out the moment the visitor moves.
    //
    // ---- THE HERO DIMS AS IT LEAVES ----
    // The chat sits at the FOOT of the hero once a question has been asked,
    // and the hero is still ~190px of screen at the moment Work's own
    // content reaches the middle of it — so the composer was still drawn,
    // at full strength, across the top of a screen that belongs to Work.
    // Nothing was overlapping wrongly; the hero was simply outstaying the
    // screen it owns.
    //
    // So the hero's contents fade on the hero's own exit: `gone` is the
    // share of it that has scrolled off the top, and everything in it is
    // clear by OUT of that share — 0.7, which lands the last of the fade
    // a comfortable margin before Work is centred. Published as one custom
    // property and spent in css/ai.css and css/styles.css, so the name and
    // the chat dim together on one clock rather than one of them going
    // ghostly beside the other.
    //
    // Both numbers come from the SAME rect: `main` is scaled by `zoom`
    // (js/stage-fit.js), so a visual top over a layout height would be
    // wrong by the scale factor on every screen that is not 1280 wide.
    //
    // …AND NOT ON A PHONE. Below 700px the hero is not something you scroll
    // past: it is one tapped screen with `overflow: hidden` and nothing
    // under it (js/mobile.js, css/mobile.css), so the hand-over to Work
    // this clock exists to make can never happen. What it did instead was
    // fire on a scroll nobody asked for — iOS scrolls the document to
    // reveal a focused field, and for the length of that scroll the whole
    // composer was dimmed toward the background, mid-sentence, every time
    // the keyboard opened. Same guard fitHero already carries above.
    if (window.matchMedia('(max-width: 700px)').matches) {
      stage.style.removeProperty('--hero-fade');
      return;
    }

    const OUT = 0.7;
    let raf = 0;
    const track = () => {
      raf = 0;
      stage.classList.toggle('is-scrolled', window.scrollY > 40);
      const r = stage.getBoundingClientRect();
      const gone = r.height > 0
        ? Math.min(Math.max(-r.top / r.height, 0), 1) : 0;
      const fade = Math.max(0, 1 - gone / OUT);
      stage.style.setProperty('--hero-fade', fade.toFixed(3));
      // …and once it is clear it stops taking the pointer. Opacity alone
      // would leave an invisible composer swallowing clicks on Work's title.
      stage.classList.toggle('is-gone', fade <= 0.005);
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
