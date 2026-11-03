#!/usr/bin/env node
// build-art.mjs — draw the pictures on PantryPal's Build cards with Gemini.
//
//     node live-portfolio/tools/build-art.mjs render              every card, two takes each
//     node live-portfolio/tools/build-art.mjs render proxy back   just those cards
//     node live-portfolio/tools/build-art.mjs bake figma=2@0.86 tokens=1
//                                                                 a take onto its card
//
// The Build chapter's seven cards (pantrypal.html, #build) each stand for a
// file of the app: the Figma frame, the tokens, the components, the book,
// the proxy, the prompt and the fallback. Each card's picture is
// a scene of what its file does, told as a kitchen would tell it, as the
// story map tells the chapters, and drawn by Gemini in the app's own hand:
// the brush-pen ink, flat colour with one shade and one highlight, the
// butter, coral, sky, red and green. (The cards carried little renders of
// each file, swatches and a request line and a pair of buttons, which read
// as a diagram's legend more than a picture.)
//
// render   asks the image model for each card's scene, twice, and keeps
//          every take in tools/build-art/renders/ (gitignored), with the
//          prompt it was drawn from beside it; a take already there is
//          kept, so a second run draws only what is missing (--fresh to
//          draw again). The key is read from GEMINI_API_KEY, or asked for
//          without echoing it; it goes only to Google, and nothing writes
//          it down.
// bake     sets a take on its card: cropped to 16:9 about its middle,
//          closer in by the zoom after the @ (the share of the take that
//          is kept, 0.88 if none is given: a card shows its picture about
//          180 wide, where a scene drawn with a painter's margin reads
//          small), 800 by 450, written to assets/case/pantrypal/build/.
//
// Model: gemini-3-pro-image-preview (Nano Banana Pro), the one the page's
// other Gemini drawings were made with; PP_ART_MODEL to try another. Each
// take is about $0.13, so a full render of sixteen is about $2.15.

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = join(HERE, '..');
const RENDERS = join(HERE, 'build-art', 'renders');
const OUT = join(SITE, 'assets', 'case', 'pantrypal', 'build');
const MODEL = process.env.PP_ART_MODEL ?? 'gemini-3-pro-image-preview';
const TAKES = Number(process.env.PP_ART_TAKES ?? 2);

// The hand every card is drawn in: the app's, as the style contract
// (design-system/tokens/illustration-style.json) and the story map draw it,
// widened from one food to one small scene, on a pale ground of its own.
const STYLE = (ground) => [
  'A charming hand-drawn spot illustration for a cooking app, in its own house style:',
  'thick, bold near-black ink outlines of an even weight that wobble very slightly, as if drawn with a brush pen, heavy enough to read at a small size;',
  'flat saturated colours, each with one darker cel-shade tone and small white glossy highlights on the upper left of rounded forms;',
  'chunky, rounded, friendly shapes and playful children’s-cookbook energy, drawn with real care and charm.',
  'One clear, calm scene, centred, filling about three quarters of the frame’s height, with a comfortable empty margin all round;',
  'a soft pale oval shadow under the objects.',
  'Palette: butter yellow #FFD67E, coral #FF7E7D, sky blue #B8EDF8, tomato red #FF4B4B, fresh green #B4FF85, warm wood brown, cream.',
  `Background: one flat, solid ${ground} filling the whole frame edge to edge, with no texture, no gradient, no vignette and no border.`,
  'Absolutely no words, letters, numbers or logos anywhere, no watermark, no people, no hands, and no faces on objects.',
].join(' ');

const SKY = 'very pale sky blue (#DDF4FA)';
const BUTTER = 'very pale butter yellow (#FFF0C7)';
const MINT = 'very pale mint green (#E2F7D6)';
const CREAM = 'warm cream (#FFF8EC)';

// Each card's scene: what its file does, as a kitchen would do it.
export const CARDS = {
  figma: [SKY, 'A tall phone-shaped painted canvas standing on a small wooden easel. The canvas shows a simple app screen in big flat shapes: a sky-blue band at the top edged with a row of little red scallops, a butter-yellow band under it, and a white rounded card holding a red rounded button. A shiny brass eyedropper hovers beside the canvas, lifting a single drop of butter-yellow paint off it, and on the easel’s ledge sit three small round paint pots, butter yellow, sky blue and tomato red, as if each colour had just been sampled from the picture.'],
  tokens: [BUTTER, 'A small wooden spice rack holding seven chubby glass spice jars in a neat row, each jar filled to the top with one flat colour (butter yellow, sky blue, coral, tomato red, fresh green, soft grey, dark brown), each with a cork lid and a blank cream paper tag tied round its neck with string. In front of the rack, a set of five nesting measuring spoons lies in a row from the smallest to the largest.'],
  ds: [MINT, 'An open wooden bento box seen from slightly above, divided into tidy compartments, each holding one piece of an app’s interface prepared like a sweet: a glossy red rounded-rectangle button, a white pill-shaped capsule with a thick ink edge, a little round white badge, a short strip of red scalloped trim like a pie-crust edge, and a small cream card. The lid leans against the box and a pair of wooden chopsticks rests across one corner: everything prepped and ready to assemble.'],
  book: [BUTTER, 'A smartphone standing upright on a little wooden cookbook stand, its screen showing an open recipe book with a juicy cheeseburger drawn on the page. Beside it, a short stack of three chunky little cookbooks in butter, coral and sky blue. Above the phone floats a small grey cloud with a crossed-out signal symbol, to say it needs no network, and the phone glows warmly anyway.'],
  proxy: [SKY, 'A small sturdy wooden kitchen cabinet with brass corners, its door open to show a big golden key hanging safely on a hook inside. In the cabinet’s side is a little serving hatch with a brass bell, and a paper order ticket is sliding out through the hatch on its own while the key stays inside. Cosy and secure.'],
  recipes: [CREAM, 'A copper cooking pot on a small stove, with a twinkling four-pointed sparkle star wearing a tall white chef’s hat hovering above it and stirring with a wooden spoon (the sparkle has no face). Raw ingredients tumble into the pot from one side, a ball of ground beef, a folded tortilla and a crisp lettuce leaf, and out of a soft swirl of steam on the other side rises a perfect, glossy beef taco.'],
  back: [MINT, 'A plump grey rain cloud with a little zigzag of lightning and an unplugged cable dangling under it, letting fall a few drops. Below it, a sturdy open cookbook stands propped up like a little roof, sheltering a warm plate with a juicy cheeseburger that stays perfectly dry, a curl of steam rising from it. Calm and reassuring: dinner is served anyway.'],
};

const prompt = (id) => `${CARDS[id][1]} ${STYLE(CARDS[id][0])}`;

// ---- the key ----
async function askHidden(question) {
  if (!process.stdin.isTTY) throw new Error('set GEMINI_API_KEY: there is no terminal to ask for it in');
  process.stdout.write(question);
  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  return new Promise((resolve) => {
    let typed = '';
    const on = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n' || ch === '\u0004') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', on);
          process.stdout.write('\n');
          resolve(typed.trim());
          return;
        }
        if (ch === '\u0003') { process.stdout.write('\n'); process.exit(130); }
        if (ch === '\u007f') typed = typed.slice(0, -1);
        else typed += ch;
      }
    };
    stdin.on('data', on);
  });
}

// ---- one take ----
async function draw(key, id, take) {
  const text = prompt(id);
  const imageConfig = { aspectRatio: '16:9', ...(MODEL.startsWith('gemini-3') ? { imageSize: '1K' } : {}) };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${id}-${take}: ${res.status} ${body.error?.message ?? res.statusText}`);
  const part = body.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part) throw new Error(`${id}-${take}: no picture came back (${body.candidates?.[0]?.finishReason ?? 'no reason given'})`);
  const file = join(RENDERS, `${id}-${take}.png`);
  writeFileSync(file, Buffer.from(part.inlineData.data, 'base64'));
  writeFileSync(join(RENDERS, `${id}.prompt.txt`), `${MODEL}\n\n${text}\n`);
  return file;
}

async function render(ids, fresh) {
  const key = process.env.GEMINI_API_KEY || await askHidden('Gemini API key (it is not shown or saved): ');
  if (!key) throw new Error('no key');
  mkdirSync(RENDERS, { recursive: true });
  const jobs = [];
  for (const id of ids) for (let t = 1; t <= TAKES; t++) {
    if (!fresh && existsSync(join(RENDERS, `${id}-${t}.png`))) continue;
    jobs.push([id, t]);
  }
  console.log(`${jobs.length} takes to draw with ${MODEL}, four at a time`);
  let failed = 0;
  const run = async () => {
    for (let job; (job = jobs.shift());) {
      try { console.log(`  drew ${(await draw(key, ...job)).replace(SITE + '/', '')}`); }
      catch (e) { failed++; console.error(`  ${e.message}`); }
    }
  };
  await Promise.all(Array.from({ length: 4 }, run));
  console.log(failed ? `${failed} takes failed; run it again to draw just those` : `done: tools/build-art/renders/`);
}

function bake(picks) {
  mkdirSync(OUT, { recursive: true });
  for (const pick of picks) {
    const [id, rest = '1'] = pick.split('=');
    const [take, zoom = '0.88'] = rest.split('@');
    const src = join(RENDERS, `${id}-${take}.png`);
    if (!existsSync(src)) throw new Error(`no take at ${src}`);
    const png = join(RENDERS, `.${id}.png`);
    const w = Math.round(800 / Number(zoom));
    const h = Math.round(450 / Number(zoom));
    execFileSync('magick', [src, '-resize', `${w}x${h}^`, '-gravity', 'center', '-extent', '800x450', '-strip', png]);
    execFileSync('cwebp', ['-quiet', '-m', '6', '-q', '84', png, '-o', join(OUT, `${id}.webp`)]);
    console.log(`  baked ${id} (take ${take}, ${zoom}) → assets/case/pantrypal/build/${id}.webp`);
  }
}

const [cmd, ...rest] = process.argv.slice(2);
const fresh = rest.includes('--fresh');
const args = rest.filter((a) => a !== '--fresh');
try {
  if (cmd === 'render') {
    const ids = args.length ? args : Object.keys(CARDS);
    for (const id of ids) if (!CARDS[id]) throw new Error(`no card called ${id}: ${Object.keys(CARDS).join(', ')}`);
    await render(ids, fresh);
  } else if (cmd === 'bake') {
    bake(args.length ? args : Object.keys(CARDS));
  } else if (cmd === 'prompts') {
    for (const id of Object.keys(CARDS)) console.log(`\n${id}\n${prompt(id)}`);
  } else {
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 6).join('\n').replace(/^\/\/ ?/gm, ''));
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
