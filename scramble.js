// One-time text scramble that plays when the page content is revealed.
// Every visible text node scrambles through random characters and resolves to
// the real text, staggered so elements nearer the top of the page settle first.

(function () {
  const CHARS =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const SCRAMBLE_MS = 1400; // how long each text node churns before fully resolved
  const STAGGER_PER_100PX = 60; // ms of start delay added per 100px of offset

  let hasRun = false;

  function randChar() {
    return CHARS[(Math.random() * CHARS.length) | 0];
  }

  // A fully scrambled frame: every non-whitespace character is randomized while
  // whitespace is kept verbatim so word boundaries stay put. There is no
  // progressive reveal — the node churns wholesale until its duration expires.
  function scrambleString(real) {
    let out = "";
    for (let i = 0; i < real.length; i++) {
      out += /\s/.test(real[i]) ? real[i] : randChar();
    }
    return out;
  }

  // First ancestor (including the text node's own parent) with a real box.
  // Handles SVG <textPath>, which often reports a zero-size rect itself.
  function rectFor(node) {
    let el = node.parentElement;
    while (el) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 || r.height > 0) return r;
      el = el.parentElement;
    }
    return null;
  }

  function isVisible(node) {
    const parent = node.parentElement;
    if (!parent) return false;
    let el = parent;
    while (el && el !== document.body) {
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden" || +s.opacity === 0) {
        return false;
      }
      el = el.parentElement;
    }
    return !!rectFor(node);
  }

  // Collect visible text nodes, skipping scripts/styles, the intro overlay,
  // aria-hidden subtrees and hidden elements. Alt text and aria labels live in
  // attributes, so a text-node walk never touches them.
  function collectTargets() {
    const nodes = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node.nodeValue || !node.nodeValue.trim()) {
            return NodeFilter.FILTER_REJECT;
          }
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName;
          if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent.closest(".intro-screen")) return NodeFilter.FILTER_REJECT;
          if (parent.closest('[aria-hidden="true"]')) {
            return NodeFilter.FILTER_REJECT;
          }
          if (!isVisible(node)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    return nodes;
  }

  // Font properties locked in inline during the scramble so the text keeps its
  // real typeface (no monospace swap).
  const FONT_PROPS = ["font-family", "font-size", "font-weight", "font-style"];
  const SVG_NS = "http://www.w3.org/2000/svg";

  function scrambleNode(node, delay, onDone) {
    const real = node.nodeValue;
    const parent = node.parentElement;
    const isSvg = parent.namespaceURI === SVG_NS;

    // Pin the element's current computed font so it never shifts, restoring only
    // the overrides we add (any pre-existing inline values are preserved).
    const cs = getComputedStyle(parent);
    const prevInline = {};
    FONT_PROPS.forEach((prop) => {
      prevInline[prop] = parent.style.getPropertyValue(prop);
      parent.style.setProperty(prop, cs.getPropertyValue(prop));
    });

    // Wrap the text node in an inline-block, nowrap span so churning glyphs can
    // never fold a multi-word string onto a second line. SVG <textPath> follows
    // a fixed path and never wraps, so it's left unwrapped.
    let wrapper = null;
    if (!isSvg) {
      wrapper = document.createElement("span");
      wrapper.style.display = "inline-block";
      wrapper.style.whiteSpace = "nowrap";
      parent.insertBefore(wrapper, node);
      wrapper.appendChild(node);
    }

    // Paint a scrambled frame immediately to avoid a flash of the real text.
    node.nodeValue = scrambleString(real);

    const start = performance.now() + delay;

    function frame(now) {
      const elapsed = now - start;
      if (elapsed < SCRAMBLE_MS) {
        // Every unresolved character churns; nothing resolves early.
        node.nodeValue = scrambleString(real);
        requestAnimationFrame(frame);
        return;
      }
      // Duration elapsed: drop the entire real string in at once.
      node.nodeValue = real;
      // Unwrap the text node, returning it to its original parent.
      if (wrapper) {
        parent.insertBefore(node, wrapper);
        wrapper.remove();
      }
      // Remove only the overrides we added, restoring any prior inline values.
      FONT_PROPS.forEach((prop) => {
        if (prevInline[prop]) parent.style.setProperty(prop, prevInline[prop]);
        else parent.style.removeProperty(prop);
      });
      if (parent.getAttribute("style") === "") parent.removeAttribute("style");
      onDone();
    }

    requestAnimationFrame(frame);
  }

  // True when the visitor arrived from elsewhere on this same site (e.g. clicking
  // back to the home page), as opposed to opening the site fresh.
  function isInternalNav() {
    if (!document.referrer) return false;
    try {
      return new URL(document.referrer).hostname === window.location.hostname;
    } catch (e) {
      return false;
    }
  }

  function run() {
    if (hasRun) return;
    hasRun = true;

    // Only play on first arrival at the site, not on in-site navigation.
    if (isInternalNav()) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const nodes = collectTargets();
    if (!nodes.length) return;

    // Flag read by index.js so the per-second clock tick won't clobber the
    // animation mid-flight.
    window.__textScrambleActive = true;

    let remaining = nodes.length;
    let maxDelay = 0;
    const finishOne = () => {
      remaining--;
      if (remaining <= 0) window.__textScrambleActive = false;
    };

    nodes.forEach((node) => {
      const r = rectFor(node);
      const top = (r ? r.top : 0) + window.scrollY;
      const delay = (Math.max(top, 0) / 100) * STAGGER_PER_100PX;
      maxDelay = Math.max(maxDelay, delay);
      scrambleNode(node, delay, finishOne);
    });

    // Safety net: never leave the clock frozen if a frame is dropped.
    setTimeout(() => {
      window.__textScrambleActive = false;
    }, SCRAMBLE_MS + maxDelay + 300);
  }

  // Start once the page content is revealed (intro removed / `loaded` set).
  function waitForReveal() {
    if (document.body.classList.contains("loaded")) {
      run();
      return;
    }
    const obs = new MutationObserver(() => {
      if (document.body.classList.contains("loaded")) {
        obs.disconnect();
        run();
      }
    });
    obs.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", waitForReveal);
  } else {
    waitForReveal();
  }
})();
