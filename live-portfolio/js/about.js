// about.js — the ways to reach him, at the foot of About.
//
// Each icon, pointed at or focused, has the bottom line say what it does:
// the row carries the icon's name in data-say, and css/about.css brings up
// the line whose data-for matches. Email copies the address rather than
// opening a mail app: a "copied" pill pops up over the envelope while it
// carries is-copied, the line holds the address up, and the page's
// announcer says it for a screen reader. If the browser keeps the clipboard out
// of reach, the line holds the address up instead, to be copied by hand;
// it never opens a mail app. The other three are plain links that open in
// a new tab.

export function initAbout(screen, { announcer } = {}) {
  const row = screen?.querySelector('.status-about');
  if (!row) return;
  let over = null;
  let copied = 0;

  const say = () => {
    if (copied) return;
    if (over) row.dataset.say = over;
    else delete row.dataset.say;
  };

  for (const el of row.querySelectorAll('[data-soc]')) {
    const name = el.dataset.soc;
    const enter = () => { over = name; say(); };
    const leave = () => { if (over === name) over = null; say(); };
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointerleave', leave);
    el.addEventListener('focus', enter);
    el.addEventListener('blur', leave);
  }

  const email = row.querySelector('[data-copy]');
  email?.addEventListener('click', async () => {
    const address = email.dataset.copy;
    if (!(await copy(address))) {
      over = 'email';
      say();
      return;
    }
    clearTimeout(copied);
    row.dataset.say = 'copied';
    email.classList.remove('is-copied');
    void email.offsetWidth;
    email.classList.add('is-copied');
    if (announcer) {
      announcer.textContent = '';
      announcer.textContent = 'Email address copied.';
    }
    copied = setTimeout(() => {
      copied = 0;
      email.classList.remove('is-copied');
      say();
    }, 1800);
  });
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // an older browser, or a page without permission: the old way
    const field = Object.assign(document.createElement('textarea'), { value: text });
    field.setAttribute('readonly', '');
    field.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.append(field);
    field.select();
    let done = false;
    try { done = document.execCommand('copy'); } catch { done = false; }
    field.remove();
    return done;
  }
}
