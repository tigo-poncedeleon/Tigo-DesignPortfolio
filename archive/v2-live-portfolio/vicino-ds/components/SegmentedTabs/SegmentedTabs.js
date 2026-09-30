const filterKey = (button) => button.textContent.trim().split(/\s+/)[0].toLowerCase();

function positionThumb(group) {
  const active = group.querySelector('button.active');
  const thumb = group.querySelector('.segmented-thumb, .page-nav-thumb');
  if (!active || !thumb) return;
  const wasReady = group.classList.contains('is-thumb-ready');
  // X is measured absolutely; Y is measured relative to the first tab so it is
  // 0 on a single row (leaving the CSS `top` offset intact) and only shifts when
  // the group wraps — letting the thumb follow the active tab onto a wrapped
  // row. Height is set to the active tab so a wrapped group's thumb stays one
  // row tall instead of spanning both. All measured, never hardcoded.
  const first = group.querySelector('button');
  const rowDelta = first ? active.offsetTop - first.offsetTop : 0;
  thumb.style.transform = `translate(${active.offsetLeft}px, ${rowDelta}px)`;
  thumb.style.width = `${active.offsetWidth}px`;
  thumb.style.height = `${active.offsetHeight}px`;
  if (group.classList.contains('signal-tabs')) {
    group.dataset.activeFilter = filterKey(active);
  }
  if (!wasReady) {
    primeThumb(group);
  }
}

function primeThumb(group) {
  if (group.dataset.thumbPriming === 'true') return;
  group.dataset.thumbPriming = 'true';
  window.setTimeout(() => {
    group.classList.add('is-thumb-ready');
    delete group.dataset.thumbPriming;
  }, 80);
}

function activate(group, button) {
  group.querySelectorAll('button').forEach((item) => {
    const isActive = item === button;
    item.classList.toggle('active', isActive);
    item.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
  positionThumb(group);
}

document.querySelectorAll('.segmented-tabs').forEach((group) => {
  // Static slices (frozen state demos) skip interaction but are still measured,
  // so their thumb is JS-positioned like every other group instead of relying
  // on hardcoded pixel transforms per active state.
  const interactive = group.dataset.staticSlice !== 'true';
  if (interactive) {
    const buttons = Array.from(group.querySelectorAll('button'));
    buttons.forEach((button, index) => {
      button.addEventListener('click', () => activate(group, button));
      button.addEventListener('keydown', (event) => {
        if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const nextIndex =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? buttons.length - 1
              : event.key === 'ArrowRight'
                ? (index + 1) % buttons.length
                : (index - 1 + buttons.length) % buttons.length;
        buttons[nextIndex].focus();
        activate(group, buttons[nextIndex]);
      });
    });
  }
  requestAnimationFrame(() => positionThumb(group));
  new ResizeObserver(() => positionThumb(group)).observe(group);
});
