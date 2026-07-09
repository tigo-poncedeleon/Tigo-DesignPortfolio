// Orchestrates the four-phase opening sequence.
// Boot order: split text -> init modules (locked) -> auto-play curtain -> unlock.
(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Split each .split element's data-text into two-element letter spans:
  //   <span class="letter"><span class="glyph">T</span></span>
  // Outer .letter is animated by the scroll-exit; inner .glyph by hover-sway.
  function splitLetters(el) {
    const text = el.dataset.text || el.textContent || '';
    el.textContent = '';
    el.setAttribute('aria-label', text);
    for (const ch of text) {
      const letter = document.createElement('span');
      letter.className = 'letter';
      letter.setAttribute('aria-hidden', 'true');
      if (ch === ' ') {
        letter.classList.add('space');
      } else {
        const glyph = document.createElement('span');
        glyph.className = 'glyph';
        glyph.textContent = ch;
        letter.appendChild(glyph);
      }
      el.appendChild(letter);
    }
  }

  // Split each nav word into per-letter spans (morph targets), keeping the
  // .navword wrapper (and its data-emoji) intact for the hover pill.
  function splitNav() {
    document.querySelectorAll('#nav-page .navword').forEach((word) => {
      const text = word.textContent;
      word.textContent = '';
      for (const ch of text) {
        const s = document.createElement('span');
        s.className = 'navletter';
        s.textContent = ch;
        word.appendChild(s);
      }
    });
  }

  function boot() {
    // Under reduced motion the ported portrait renders an empty canvas (it
    // returns before loading its image), so fall back to the static B&W image.
    if (reduce) {
      document.body.classList.add('reduced');
      const img = document.querySelector('.mobile-face');
      if (img) img.style.display = 'block';
    }

    document.querySelectorAll('.split').forEach(splitLetters);
    splitNav();

    // Lock scroll while the curtain is up.
    document.body.classList.add('scroll-locked');

    if (window.GeoClock) window.GeoClock.init();
    if (window.CustomCursor) window.CustomCursor.init();
    if (window.TextSway) window.TextSway.init({ reduce });
    if (window.FaceRainbow) window.FaceRainbow.init();
    if (window.ScrollTransition) window.ScrollTransition.init({ reduce });
    if (window.NavHover) window.NavHover.init();

    const unlock = () => {
      document.body.classList.remove('scroll-locked');
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    };

    if (window.Curtain) {
      window.Curtain.play({ reduce, onDone: unlock });
    } else {
      unlock();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
