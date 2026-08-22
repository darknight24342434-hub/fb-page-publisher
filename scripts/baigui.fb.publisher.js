const path = require('path');
const {
  loadConfig,
  winToLocalPath,
  localToWinPath,
  timestamp,
  log,
  listMarkdown,
  readPost,
  findMedia,
  launchContext,
  getMainPage,
  ensureLoggedIn,
  moveWithMedia,
} = require('./common');

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run') || args.has('--dry');
const publishAll = args.has('--all');

async function openComposer(page, cfg) {
  const composeRe = new RegExp(cfg.composeText || "在想些什麼|What's on your mind|建立貼文|Create post", 'i');
  await page.getByText(composeRe).first().click({ timeout: 45000 });
  const textboxRe = new RegExp(cfg.textboxText || "建立公開貼文|你在想什麼|在想些什麼|What's on your mind", 'i');
  const box = page.getByRole('textbox').filter({ hasText: textboxRe }).first();
  try {
    await box.waitFor({ state: 'visible', timeout: 15000 });
    return box;
  } catch (_) {
    const fallback = page.locator('[role="dialog"] [role="textbox"]').first();
    await fallback.waitFor({ state: 'visible', timeout: 30000 });
    return fallback;
  }
}

async function attachMedia(page, cfg, mediaPaths) {
  if (!mediaPaths.length) return;
  const chooserPromise = page.waitForEvent('filechooser', { timeout: 15000 });
  const photoRe = new RegExp(cfg.photoText || '相片／影片|相片/影片|Photo/video|Photo\\/video', 'i');
  await page.getByText(photoRe).first().click({ timeout: 30000 });
  const chooser = await chooserPromise;
  await chooser.setFiles(mediaPaths.map(localToWinPath));
  await page.waitForTimeout(8000);
}

async function publishOne(page, cfg, mdPath) {
  const text = readPost(mdPath);
  if (!text) throw new Error(`空白發文：${mdPath}`);
  const media = findMedia(mdPath, cfg);
  const runName = `publisher.${timestamp()}`;

  if (dryRun) {
    console.log(`[DRY] ${path.basename(mdPath)} chars=${text.length} media=${media.map(path.basename).join(',') || 'none'}`);
    log(cfg, runName, `[DRY] ${mdPath} chars=${text.length} media=${media.join(',') || 'none'}`);
    return { status: 'dry', media };
  }

  await ensureLoggedIn(page, cfg);
  const box = await openComposer(page, cfg);
  await box.fill(text);
  await attachMedia(page, cfg, media);

  const postRe = new RegExp(cfg.postButtonText || '發佈|發布|Post', 'i');
  const postButton = page.getByRole('button', { name: postRe }).last();
  await postButton.waitFor({ state: 'visible', timeout: 30000 });
  await postButton.click();

  const waitMs = Number(cfg.postWaitSeconds || 25) * 1000;
  await page.waitForTimeout(waitMs);
  log(cfg, runName, `[POSTED] ${mdPath} chars=${text.length} media=${media.join(',') || 'none'}`);
  return { status: 'posted', media };
}

(async () => {
  const cfg = loadConfig();
  const pending = listMarkdown(cfg.pendingDir);
  if (!pending.length) {
    console.log('[百鬼 FB] pending 無待發文。');
    return;
  }
  const targets = publishAll ? pending : [pending[0]];
  console.log(`[百鬼 FB] 待處理 ${targets.length} 篇。dryRun=${dryRun}`);

  let context;
  try {
    if (!dryRun) context = await launchContext(cfg);
    const page = context ? await getMainPage(context) : null;

    for (const mdPath of targets) {
      try {
        const result = await publishOne(page, cfg, mdPath);
        if (result.status === 'posted') {
          const sentDir = winToLocalPath(cfg.sentDir);
          const moved = moveWithMedia(mdPath, result.media, sentDir);
          console.log(`[OK] 已發布並移入 sent：${moved.map(path.basename).join(', ')}`);
        }
      } catch (err) {
        console.error(`[FAIL] ${path.basename(mdPath)}：${err.message}`);
        log(cfg, 'publisher.errors', `[FAIL] ${mdPath}\n${err.stack || err.message}`);
        if (!dryRun) process.exitCode = 1;
        break;
      }
    }
  } finally {
    if (context) await context.close().catch(() => {});
  }
})();
