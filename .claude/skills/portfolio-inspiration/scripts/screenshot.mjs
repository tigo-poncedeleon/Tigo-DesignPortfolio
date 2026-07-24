// screenshot.mjs
// Usage: node screenshot.mjs <url> <output.png> [width]
// Captures a full-page screenshot (including below the fold) of any URL.

import { chromium } from 'playwright';
import path from 'path';

const [, , url, outputPath, widthArg] = process.argv;

if (!url || !outputPath) {
  console.error('Usage: node screenshot.mjs <url> <output.png> [width]');
  process.exit(1);
}

const width = widthArg ? parseInt(widthArg, 10) : 1440;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width, height: 900 },
    deviceScaleFactor: 2, // retina quality
  });

  console.log(`Opening ${url} ...`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

  // Scroll through the page first to trigger lazy-loaded images/animations
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 400;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 150);
    });
  });

  await page.waitForTimeout(500); // let final animations settle

  const fullPath = path.resolve(outputPath);
  await page.screenshot({ path: fullPath, fullPage: true });
  console.log(`Saved: ${fullPath}`);

  await browser.close();
})();
