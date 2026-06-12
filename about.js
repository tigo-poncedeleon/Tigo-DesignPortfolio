
// dark or light mode 
const isDark = localStorage.getItem('theme') === 'dark';

if (isDark) {
  document.body.classList.add('dark-mode');
}

const emailBtn = document.getElementById('email-button');
const toast = document.getElementById('copy-toast');
const myEmail = 'tigoponcedeleon@gmail.com';

emailBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(myEmail).then(() => {
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2000);
  });
});

// random palette hover effect
const palette = [
  '#FF6B6B', '#FF8C42', '#FFD166', '#06D6A0',
  '#4ECDC4', '#4361EE', '#A855F7', '#F72585',
];

function pickColor() {
  return palette[Math.floor(Math.random() * palette.length)];
}

// word-level hover on about text
function wrapWords(element) {
  Array.from(element.childNodes).forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const parts = node.textContent.split(/(\s+)/);
      const fragment = document.createDocumentFragment();
      parts.forEach(part => {
        if (/\S/.test(part)) {
          const span = document.createElement('span');
          span.className = 'hover-word';
          span.textContent = part;
          fragment.appendChild(span);
        } else {
          fragment.appendChild(document.createTextNode(part));
        }
      });
      element.replaceChild(fragment, node);
    } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'BR') {
      if (node.tagName === 'A') {
        node.classList.add('hover-word');
      } else {
        wrapWords(node);
      }
    }
  });
}

document.querySelectorAll('.about-content p').forEach(p => wrapWords(p));

document.querySelectorAll('.hover-word').forEach(el => {
  el.addEventListener('mouseenter', () => { el.style.color = pickColor(); });
  el.addEventListener('mouseleave', () => { el.style.color = ''; });
});

// gooey blob with quicksand carving + gravitational attraction
const blobCanvas = document.getElementById('blobCanvas');
const blobCtx = blobCanvas.getContext('2d');
const B = 340; // logical drawing units; CSS scales the element to fit
const DPR = Math.min(window.devicePixelRatio || 1, 2); // crisp on retina
blobCanvas.width = B * DPR;
blobCanvas.height = B * DPR;
blobCtx.scale(DPR, DPR);

// pre-baked soft carve sprite — cheap to stamp many times, feathered edge
const carveSprite = document.createElement('canvas');
const SPRITE = 128;
carveSprite.width = carveSprite.height = SPRITE;
const sCtx = carveSprite.getContext('2d');
const sGrad = sCtx.createRadialGradient(SPRITE / 2, SPRITE / 2, 0, SPRITE / 2, SPRITE / 2, SPRITE / 2);
sGrad.addColorStop(0,    'rgba(0,0,0,1)');
sGrad.addColorStop(0.45, 'rgba(0,0,0,1)');
sGrad.addColorStop(1,    'rgba(0,0,0,0)');
sCtx.fillStyle = sGrad;
sCtx.fillRect(0, 0, SPRITE, SPRITE);

let rawX = -9999, rawY = -9999;          // cursor in canvas-internal px
let hasCursor = false;                    // gate so we don't act on load

let spX = B / 2, spY = B / 2, spVX = 0, spVY = 0; // smoothed carving position
let blobT = 0;

// quicksand carve trail: each mark heals very slowly
const carveTrail = [];
const CARVE_R = 17;     // radius of a carve mark
const HEAL = 0.055;     // px shed per frame (~5s to fully close = quicksand)
const SAMPLE = 3;       // mark spacing along the path — small = continuous
const MAX_MARKS = 600;

document.addEventListener('mousemove', e => {
  const rect = blobCanvas.getBoundingClientRect();
  rawX = (e.clientX - rect.left) * (B / rect.width);
  rawY = (e.clientY - rect.top)  * (B / rect.height);
  hasCursor = true;
});

document.addEventListener('mouseleave', () => {
  rawX = -9999; rawY = -9999;
  hasCursor = false;
});

function overBlob(x, y) {
  const dx = x - B / 2, dy = y - B / 2;
  return dx * dx + dy * dy < 150 * 150;
}

function drawBlobShape(t) {
  blobCtx.beginPath();
  const cx = B / 2, cy = B / 2, base = 142; // larger, fills more space
  const steps = 220;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    // bigger amplitudes + slow phases = lively neutral shape-shifting
    const r = base
      + Math.sin(a * 3 + t * 0.65) * 11
      + Math.sin(a * 5 - t * 0.45) * 7
      + Math.sin(a * 7 + t * 0.90) * 5
      + Math.sin(a * 2 + t * 0.28) * 9;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    i === 0 ? blobCtx.moveTo(x, y) : blobCtx.lineTo(x, y);
  }
  blobCtx.closePath();
}

function carveAt(x, y, r) {
  const d = r * 1.9 * 2; // sprite spans the full feathered diameter
  blobCtx.drawImage(carveSprite, x - d / 2, y - d / 2, d, d);
}

function blobFrame() {
  blobT += 0.012;

  // --- smoothed carve position ---
  if (hasCursor) {
    spVX = spVX * 0.78 + (rawX - spX) * 0.16;
    spVY = spVY * 0.78 + (rawY - spY) * 0.16;
    spX += spVX;
    spY += spVY;
  }

  // drop carve marks while the cursor is inside the blob — interpolate
  // densely along the path so the channel grows smoothly, not in jumps
  if (hasCursor && overBlob(rawX, rawY)) {
    const last = carveTrail[carveTrail.length - 1];
    if (!last) {
      carveTrail.push({ x: spX, y: spY, r: CARVE_R });
    } else {
      const dist = Math.hypot(spX - last.x, spY - last.y);
      if (dist >= SAMPLE) {
        const n = Math.ceil(dist / SAMPLE);
        for (let k = 1; k <= n; k++) {
          const f = k / n;
          carveTrail.push({
            x: last.x + (spX - last.x) * f,
            y: last.y + (spY - last.y) * f,
            r: CARVE_R,
          });
        }
        while (carveTrail.length > MAX_MARKS) carveTrail.shift();
      } else {
        last.r = CARVE_R; // holding still keeps the current dent open
      }
    }
  }

  // quicksand healing: every mark slowly shrinks back to nothing
  for (let i = carveTrail.length - 1; i >= 0; i--) {
    carveTrail[i].r -= HEAL;
    if (carveTrail[i].r <= 0.5) carveTrail.splice(i, 1);
  }

  blobCtx.clearRect(0, 0, B, B);
  const isDark = document.body.classList.contains('dark-mode');

  blobCtx.globalCompositeOperation = 'source-over';
  blobCtx.fillStyle = isDark ? '#ffffff' : '#000000';
  drawBlobShape(blobT);
  blobCtx.fill();

  blobCtx.globalCompositeOperation = 'destination-out';
  for (const m of carveTrail) carveAt(m.x, m.y, m.r);

  requestAnimationFrame(blobFrame);
}

blobFrame();

