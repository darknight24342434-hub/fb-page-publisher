const {
  loadConfig,
  launchContext,
  getMainPage,
  ensureLoggedIn,
  log,
} = require('./common');

(async () => {
  const cfg = loadConfig();
  const context = await launchContext(cfg);
  try {
    const page = await getMainPage(context);
    await ensureLoggedIn(page, cfg);
    const title = await page.title().catch(() => 'unknown');
    console.log(`[OK] Facebook profile 可用。title=${title}`);
    log(cfg, 'smoke', `[OK] title=${title}`);
  } catch (err) {
    console.error(`[FAIL] ${err.message}`);
    log(cfg, 'smoke', `[FAIL] ${err.stack || err.message}`);
    process.exitCode = 1;
  } finally {
    await context.close().catch(() => {});
  }
})();
