/**
 * Layout audit — PLAN-MOBILE-LAYOUT §12.2 / §12.4 (dev-only, optional).
 *
 * Usage:
 *   1. npm i -D playwright && npx playwright install chromium
 *   2. npm run dev  (in another terminal)
 *   3. node scripts/layout-audit.mjs [baseUrl] [--only=390x844,844x390]
 *
 * Opens the match at each device-matrix cell, then asserts the §12.1
 * invariants via getBoundingClientRect and saves screenshots to
 * artifacts/mobile-layout/.
 *
 * The match table needs a running game, so the flow clicks through the app:
 * New Match → Start Match → Deal (personalities intro) → wait for the table,
 * then toggle all three overlays on and off to exercise pills + sheet.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:5173';
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const OUT = 'artifacts/mobile-layout';
mkdirSync(OUT, { recursive: true });

const CELLS = [
  { label: 'portrait-se1', width: 320, height: 568 },
  { label: 'portrait-se23', width: 375, height: 667 },
  { label: 'portrait-iphone', width: 390, height: 844 },
  { label: 'portrait-pixel', width: 412, height: 915 },
  { label: 'portrait-fold', width: 673, height: 841 },
  { label: 'landscape-se1', width: 568, height: 320 },
  { label: 'landscape-se23', width: 667, height: 375 },
  { label: 'landscape-iphone', width: 844, height: 390 },
  { label: 'landscape-pixel', width: 915, height: 412 },
  { label: 'landscape-fold', width: 841, height: 673 },
  { label: 'desktop', width: 1280, height: 800 },
];

const REGIONS = ['.match-top', '.table-wrap', '.call-bar', '.hand-dock'];

function overlaps(a, b) {
  return a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
}

async function auditCell(page, cell) {
  const result = { label: cell.label, violations: [] };
  await page.setViewportSize({ width: cell.width, height: cell.height });
  await page.goto(BASE, { waitUntil: 'networkidle' });

  // Enter a match.
  await page.getByRole('button', { name: /New Match/i }).click();
  await page.getByRole('button', { name: /Start Match/i }).click();
  const deal = page.getByRole('button', { name: /^Deal$/i });
  if (await deal.count()) await deal.click();
  // Let AI turns progress until the human's hand is on screen (some tiles discarded).
  await page.waitForSelector('.hand-row .tile', { timeout: 15000 });
  await page.waitForTimeout(2500);

  const data = await page.evaluate((regionSels) => {
    const root = document.querySelector('.match');
    const rectOf = (sel) => {
      const el = document.querySelector(sel);
      if (!el || !el.offsetParent && getComputedStyle(el).position !== 'fixed') return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height };
    };
    const out = { viewport: { w: innerWidth, h: innerHeight }, regions: {} };
    for (const sel of regionSels) out.regions[sel] = rectOf(sel);
    out.handTiles = document.querySelectorAll('.hand-row .tile').length;
    out.sideCols = document.querySelectorAll('.river-side .river-col').length;
    out.sideTiles = document.querySelectorAll('.river-side .tile').length;
    out.horizontalOverflow = root ? root.scrollWidth > root.clientWidth + 1 : false;
    out.docOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    return out;
  }, REGIONS);

  if (data.horizontalOverflow) result.violations.push('match horizontal overflow');
  if (data.docOverflow) result.violations.push('document horizontal overflow');
  if (data.handTiles < 13) result.violations.push(`hand rows only ${data.handTiles} tiles`);

  const regionRects = Object.entries(data.regions).filter(([, r]) => r);
  for (let i = 0; i < regionRects.length; i++) {
    for (let j = i + 1; j < regionRects.length; j++) {
      if (overlaps(regionRects[i][1], regionRects[j][1])) {
        result.violations.push(`regions overlap: ${regionRects[i][0]} × ${regionRects[j][0]}`);
      }
    }
  }

  // Exercise the overlay sheet (mobile cells only).
  if (cell.width <= 600) {
    const yaku = page.getByRole('button', { name: /^Yaku$/i });
    if (await yaku.count()) {
      await yaku.click();
      await page.waitForTimeout(200);
      const sheet = await page.$('.overlay-sheet');
      if (!sheet) result.violations.push('overlay sheet did not open on mobile');
      await page.waitForTimeout(200);
      const sheetBox = await page.evaluate(() => {
        const el = document.querySelector('.overlay-sheet');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      });
      if (sheetBox) {
        const callBar = data.regions['.call-bar'];
        const hand = data.regions['.hand-dock'];
        if (callBar && sheetBox.bottom > callBar.top + 1) result.violations.push('sheet covers call bar');
        if (hand && sheetBox.bottom > hand.top + 1) result.violations.push('sheet covers hand dock');
      }
      // close again
      await page.getByRole('button', { name: 'Close overlays' }).click();
    }
  }

  await page.screenshot({ path: `${OUT}/${cell.label}.png`, fullPage: false });
  result.side = { cols: data.sideCols, tiles: data.sideTiles };
  return result;
}

const cells = ONLY
  ? CELLS.filter((c) => ONLY.split(',').includes(`${c.width}x${c.height}`))
  : CELLS;

const browser = await chromium.launch();
const page = await browser.newPage();
const results = [];
for (const cell of cells) {
  process.stdout.write(`auditing ${cell.label} (${cell.width}x${cell.height})… `);
  const r = await auditCell(page, cell);
  results.push(r);
  console.log(r.violations.length ? `FAIL: ${r.violations.join('; ')}` : 'ok');
}
await browser.close();

const summary = {
  generated: new Date().toISOString(),
  cells: results.map((r) => ({
    ...r,
    violations: r.violations.length ? r.violations : undefined,
  })),
};
writeFileSync(`${OUT}/audit.json`, JSON.stringify(summary, null, 2));
const failed = results.filter((r) => r.violations.length);
console.log(`\n${results.length} cells audited, ${failed.length} with violations`);
process.exit(failed.length ? 1 : 0);
