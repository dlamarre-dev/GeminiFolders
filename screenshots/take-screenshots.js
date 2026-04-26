/**
 * Automated screenshot generator for Gemini Folders store listings.
 *
 * Usage:
 *   node take-screenshots.js              → composed 1280×800 for all 16 locales
 *   node take-screenshots.js --mode folder
 *   node take-screenshots.js --mode prompt
 *   node take-screenshots.js --mode raw   → raw popup PNGs only (no composition)
 *   node take-screenshots.js --locale fr  → single locale
 */

const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

const SAMPLE_DATA = require('./sample-data');

// ─── Configuration ────────────────────────────────────────────────────────────

const EXT_PATH = path.resolve(__dirname, '../dist/chrome');
const OUT_DIR  = path.resolve(__dirname, '../Marketing/screenshots');

const LOCALES = [
  { id: 'en',    chrome: 'en-US'  },
  { id: 'fr',    chrome: 'fr-FR'  },
  { id: 'de',    chrome: 'de-DE'  },
  { id: 'es',    chrome: 'es-ES'  },
  { id: 'it',    chrome: 'it-IT'  },
  { id: 'pt_BR', chrome: 'pt-BR'  },
  { id: 'pt_PT', chrome: 'pt-PT'  },
  { id: 'ru',    chrome: 'ru-RU'  },
  { id: 'pl',    chrome: 'pl-PL'  },
  { id: 'zh_CN', chrome: 'zh-CN'  },
  { id: 'ja',    chrome: 'ja-JP'  },
  { id: 'ko',    chrome: 'ko-KR'  },
  { id: 'hi',    chrome: 'hi-IN'  },
  { id: 'ro',    chrome: 'ro-RO'  },
  { id: 'sk',    chrome: 'sk-SK'  },
  { id: 'cs',    chrome: 'cs-CZ'  },
];

const POPUP_WIDTH = 392;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gf-screenshot-'));
}

function cleanTmpDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
}

async function getExtensionId(context) {
  const existing = context.serviceWorkers();
  if (existing.length > 0) return existing[0].url().split('/')[2];
  const worker = await context.waitForEvent('serviceworker', { timeout: 10000 });
  return worker.url().split('/')[2];
}

async function injectSampleData(page, localeData) {
  const { folders, pinnedFolders, prompts } = localeData;
  await page.evaluate(({ folders, pinnedFolders, prompts }) => {
    return Promise.all([
      new Promise(r => chrome.storage.sync.set({ folders, pinnedFolders, sortPref: 'dateDesc' }, r)),
      new Promise(r => chrome.storage.local.set({ prompts, promptSortPref: 'dateDesc', syncBookmarksEnabled: false }, r)),
    ]);
  }, { folders, pinnedFolders, prompts });
}

async function waitForRender(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(600);
}

// Returns PNG height in pixels by reading the IHDR chunk directly.
function pngHeight(filePath) {
  const buf = fs.readFileSync(filePath);
  return buf.readUInt32BE(20);
}

// ─── Screenshot functions ─────────────────────────────────────────────────────

async function screenshotFolderMode(page, extId, localeData, outPath) {
  await page.goto(`chrome-extension://${extId}/popup.html`);
  await waitForRender(page);

  await injectSampleData(page, localeData);
  await page.reload();
  await waitForRender(page);

  try {
    await page.waitForSelector('.folder-header', { timeout: 8000 });
  } catch {
    await page.screenshot({ path: outPath.replace('.png', '_DEBUG.png'), fullPage: true });
    throw new Error('No .folder-header found — see _DEBUG screenshot.');
  }

  // Expand first two folders
  const headers = page.locator('.folder-header');
  await headers.nth(0).click();
  await page.waitForTimeout(200);
  await headers.nth(1).click();
  await page.waitForTimeout(300);

  await page.screenshot({ path: outPath, fullPage: false });
  console.log(`  ✅ Folder: ${path.basename(outPath)}`);
}

async function screenshotPromptMode(page, extId, localeData, outPath) {
  await page.goto(`chrome-extension://${extId}/popup.html`);
  await waitForRender(page);

  await injectSampleData(page, localeData);
  await page.evaluate(() => new Promise(r => chrome.storage.local.set({ lastMode: 'prompt' }, r)));
  await page.reload();
  await waitForRender(page);

  // Expand first two prompt items
  const promptHeaders = page.locator('.prompt-header');
  await promptHeaders.nth(0).click();
  await page.waitForTimeout(200);
  await promptHeaders.nth(1).click();
  await page.waitForTimeout(300);

  // Remove the 200px autoResize cap so full prompt text is visible
  await page.evaluate(() => {
    document.querySelectorAll('.prompt-text-edit').forEach(ta => {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
      ta.style.overflowY = 'hidden';
    });
    // Suppress all scrollbars
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.querySelectorAll('*').forEach(el => {
      const s = window.getComputedStyle(el);
      if (['scroll', 'auto'].includes(s.overflow) ||
          ['scroll', 'auto'].includes(s.overflowY) ||
          ['scroll', 'auto'].includes(s.overflowX)) {
        el.style.overflow = 'hidden';
      }
    });
  });

  // Fit viewport to content — no clipping
  const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
  await page.setViewportSize({ width: POPUP_WIDTH, height: bodyHeight });

  await page.screenshot({ path: outPath, fullPage: false });
  console.log(`  ✅ Prompt: ${path.basename(outPath)}`);
}

// ─── Composition ─────────────────────────────────────────────────────────────

async function compositeScreenshot(page, folderPath, promptPath, localeData, outPath) {
  // ── Layout constants ──────────────────────────────────────────────────────
  const CANVAS_W     = 1280;
  const CANVAS_H     = 800;
  const TITLE_H      = 100;  // vertical space for the title
  const OUTER_PAD    = 24;   // left/right edge padding
  const V_PAD_TOP    = 18;   // between title and popups
  const LABEL_MARGIN = 14;   // between popup bottom and label
  const LABEL_H      = 46;   // height reserved for mode label text
  const V_PAD_BOT    = 14;   // below labels
  const GAP          = 44;   // between the two popups
  const LABEL_FONT   = Math.round(46 * 2 / 3); // 2/3 of title size

  const folderH = pngHeight(folderPath);
  const promptH = pngHeight(promptPath);

  // Available area for popups (labels sit below, not beside)
  const availW = CANVAS_W - OUTER_PAD * 2;
  const availH = CANVAS_H - TITLE_H - V_PAD_TOP - LABEL_MARGIN - LABEL_H - V_PAD_BOT;

  // Uniform scale: fit both popups (same display width) within the available area
  const scaleByW = (availW - GAP) / 2 / POPUP_WIDTH;
  const scaleByH = availH / Math.max(folderH, promptH);
  const scale    = Math.min(scaleByW, scaleByH, 1.0); // never upscale beyond native

  const dispW       = Math.round(POPUP_WIDTH * scale);
  const folderDispH = Math.round(folderH * scale);
  const promptDispH = Math.round(promptH * scale);
  const sharedDispH = Math.min(folderDispH, promptDispH); // same height for both frames

  // Horizontal centering
  const blockW  = dispW * 2 + GAP;
  const leftX   = OUTER_PAD + Math.round((availW - blockW) / 2);
  const rightX  = leftX + dispW + GAP;
  const topY    = TITLE_H + V_PAD_TOP;
  const labelY  = topY + sharedDispH + LABEL_MARGIN;

  // Strip emoji from labels — show text only below the popups
  const folderText = localeData.folderLabel.replace(/^\S+\s*/, '');
  const promptText = localeData.promptLabel.replace(/^\S+\s*/, '');

  // Embed images as base64 so no file:// issues in Playwright page
  const folderB64 = fs.readFileSync(folderPath).toString('base64');
  const promptB64 = fs.readFileSync(promptPath).toString('base64');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${CANVAS_W}px;
    height: ${CANVAS_H}px;
    overflow: hidden;
    background: linear-gradient(135deg, #020f1e 0%, #071d45 40%, #0f3fa8 80%, #1a56db 100%);
    font-family: 'Google Sans', 'Segoe UI', Arial, sans-serif;
    position: relative;
  }

  /* ── Title ─────────────────────────────────────────────────────────────── */
  .title {
    position: absolute;
    top: 0;
    left: ${OUTER_PAD}px;
    width: ${CANVAS_W - OUTER_PAD * 2}px;
    height: ${TITLE_H}px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
    font-size: 46px;
    font-weight: 700;
    letter-spacing: -0.01em;
    text-shadow: 0 2px 20px rgba(0,0,0,0.5);
  }

  /* ── Popup frames ───────────────────────────────────────────────────────── */
  .popup {
    position: absolute;
    left: ${leftX}px;
    top: ${topY}px;
    width: ${dispW}px;
    border-radius: 18px;
    border: 2px solid rgba(255,255,255,0.32);
    box-shadow:
      0 0 0 4px rgba(100,160,255,0.18),
      0 0 28px rgba(90,150,255,0.55),
      0 0 70px rgba(26,86,219,0.38),
      0 20px 60px rgba(0,0,0,0.65);
    overflow: hidden;
  }
  .popup-right {
    left: ${rightX}px;
  }
  .popup img {
    display: block;
    width: 100%;
    height: auto;
  }

  /* ── Both popups clipped to the same height ─────────────────────────────── */
  .popup-folder { height: ${sharedDispH}px; }
  .popup-prompt { height: ${sharedDispH}px; }

  /* ── Mode labels below each popup ──────────────────────────────────────── */
  .mode-label {
    position: absolute;
    top: ${labelY}px;
    height: ${LABEL_H}px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255,255,255,0.88);
    font-size: ${LABEL_FONT}px;
    font-weight: 600;
    letter-spacing: -0.01em;
    text-shadow: 0 2px 12px rgba(0,0,0,0.4);
    white-space: nowrap;
  }
  .label-folder { left: ${leftX}px;  width: ${dispW}px; }
  .label-prompt { left: ${rightX}px; width: ${dispW}px; }
</style>
</head>
<body>
  <div class="title">${localeData.title}</div>

  <div class="popup popup-folder">
    <img src="data:image/png;base64,${folderB64}" alt="folder mode">
  </div>
  <div class="popup popup-right popup-prompt">
    <img src="data:image/png;base64,${promptB64}" alt="prompt mode">
  </div>

  <div class="mode-label label-folder">${folderText}</div>
  <div class="mode-label label-prompt">${promptText}</div>
</body>
</html>`;

  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(200);
  await page.setViewportSize({ width: CANVAS_W, height: CANVAS_H });
  await page.screenshot({ path: outPath, fullPage: false });
  console.log(`  ✅ Composed: ${path.basename(outPath)}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  const args      = process.argv.slice(2);
  const modeArg   = args.includes('--mode')   ? args[args.indexOf('--mode') + 1]   : 'both';
  const localeArg = args.includes('--locale') ? args[args.indexOf('--locale') + 1] : null;

  const targetLocales = localeArg
    ? LOCALES.filter(l => l.id === localeArg)
    : LOCALES;

  if (targetLocales.length === 0) {
    console.error(`Unknown locale: ${localeArg}`);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`\nGemini Folders Screenshot Generator`);
  console.log(`Mode: ${modeArg}  |  Output → ${OUT_DIR}\n`);

  // Headless browser for composition (no extension needed)
  const composeBrowser = (modeArg === 'both') ? await chromium.launch({ headless: true }) : null;
  const composePage    = composeBrowser ? await composeBrowser.newPage() : null;

  for (const locale of targetLocales) {
    console.log(`🌐 ${locale.id} (${locale.chrome})`);
    const localeData = SAMPLE_DATA[locale.id] || SAMPLE_DATA['en'];
    const tmpDir = makeTmpDir();

    const context = await chromium.launchPersistentContext(tmpDir, {
      headless: false,
      args: [
        `--lang=${locale.chrome}`,
        `--load-extension=${EXT_PATH}`,
        `--disable-extensions-except=${EXT_PATH}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps',
      ],
      viewport: { width: POPUP_WIDTH, height: 700 },
      colorScheme: 'dark',
    });

    try {
      const extId = await getExtensionId(context);
      const page  = await context.newPage();
      page.setViewportSize({ width: POPUP_WIDTH, height: 700 });

      if (modeArg === 'raw') {
        // Raw mode: save named final PNGs directly, no composition
        const folderPath = path.join(OUT_DIR, `PromoFolder_${locale.id}.png`);
        const promptPath = path.join(OUT_DIR, `PromoPrompt_${locale.id}.png`);
        await screenshotFolderMode(page, extId, localeData, folderPath);
        await screenshotPromptMode(page, extId, localeData, promptPath);

      } else {
        // Composed mode: take raw intermediates, compose, delete intermediates
        const folderPath  = path.join(OUT_DIR, `_raw_folder_${locale.id}.png`);
        const promptPath  = path.join(OUT_DIR, `_raw_prompt_${locale.id}.png`);
        const composePath = path.join(OUT_DIR, `Promo_${locale.id}.png`);

        if (modeArg === 'both' || modeArg === 'folder') {
          await screenshotFolderMode(page, extId, localeData, folderPath);
        }
        if (modeArg === 'both' || modeArg === 'prompt') {
          await screenshotPromptMode(page, extId, localeData, promptPath);
        }
        if (modeArg === 'both' && fs.existsSync(folderPath) && fs.existsSync(promptPath)) {
          await compositeScreenshot(composePage, folderPath, promptPath, localeData, composePath);
          try { fs.unlinkSync(folderPath); } catch (_) {}
          try { fs.unlinkSync(promptPath); } catch (_) {}
        }
      }

    } catch (err) {
      console.error(`  ❌ Error for ${locale.id}: ${err.message}`);
    } finally {
      await context.close();
      cleanTmpDir(tmpDir);
    }
  }

  if (composeBrowser) await composeBrowser.close();
  console.log('\nDone.');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
