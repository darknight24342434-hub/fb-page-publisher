const fs = require('fs');
const path = require('path');
const os = require('os');

const root = path.resolve(__dirname, '..');
const configPath = path.join(root, 'config.json');

const DIR_KEYS = ['profileRoot', 'pendingDir', 'sentDir', 'failedDir', 'logDir'];

function loadConfig() {
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Missing ${configPath}. Copy config.example.json to config.json and edit it.`
    );
  }
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  // A relative directory in config.json is taken as relative to the repository root,
  // so a fresh clone works without editing absolute paths into it.
  // profileName is deliberately not in DIR_KEYS: it is a folder name joined onto
  // profileRoot, and mkdir-ing it on its own left a stray directory in the cwd.
  for (const key of DIR_KEYS) {
    const value = cfg[key];
    if (!value) continue;
    const local = winToLocalPath(value);
    const resolved = path.isAbsolute(local) ? local : path.join(root, local);
    cfg[key] = resolved;
    fs.mkdirSync(resolved, { recursive: true });
  }
  return cfg;
}

function winToLocalPath(p) {
  if (!p) return p;
  if (process.platform === 'win32') return p;
  const m = String(p).match(/^([A-Za-z]):[\\/](.*)$/);
  if (!m) return p;
  return `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, '/')}`;
}

function localToWinPath(p) {
  if (process.platform === 'win32') return p;
  const m = String(p).match(/^\/mnt\/([a-z])\/(.*)$/i);
  if (!m) return p;
  return `${m[1].toUpperCase()}:\\${m[2].replace(/\//g, '\\')}`;
}

function resolveBrowserExecutable(cfg) {
  const candidates = [cfg.chromePath, ...(cfg.fallbackChromePaths || [])].filter(Boolean);
  for (const c of candidates) {
    const local = winToLocalPath(c);
    if (fs.existsSync(local)) return process.platform === 'win32' ? c : local;
  }
  return undefined;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function log(cfg, name, message) {
  const dir = winToLocalPath(cfg.logDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, `${name}.log`), `[${new Date().toISOString()}] ${message}${os.EOL}`);
}

function listMarkdown(dir) {
  const local = winToLocalPath(dir);
  if (!fs.existsSync(local)) return [];
  return fs.readdirSync(local)
    .filter(f => f.toLowerCase().endsWith('.md'))
    .map(f => path.join(local, f))
    .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);
}

function readPost(mdPath) {
  const raw = fs.readFileSync(mdPath, 'utf8').replace(/^---[\s\S]*?---\s*/m, '').trim();
  return raw;
}

function findMedia(mdPath, cfg) {
  const dir = path.dirname(mdPath);
  const base = path.basename(mdPath, path.extname(mdPath));
  const files = fs.readdirSync(dir);
  const exts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.mov']);
  const samePrefix = files
    .filter(f => exts.has(path.extname(f).toLowerCase()) && path.basename(f, path.extname(f)).startsWith(base))
    .map(f => path.join(dir, f));
  if (samePrefix.length) return samePrefix.sort();
  const datePrefix = (base.match(/^\d{4}-\d{2}-\d{2}/) || [])[0];
  if (!datePrefix) return [];
  return files
    .filter(f => exts.has(path.extname(f).toLowerCase()) && f.startsWith(datePrefix))
    .map(f => path.join(dir, f))
    .sort();
}

async function launchContext(cfg) {
  let chromium;
  try {
    chromium = require('playwright-core').chromium;
  } catch (err) {
    throw new Error('缺少 playwright-core。請在工具根目錄執行 npm install，或用 scripts/run.daily.ps1 自動安裝。');
  }
  const executablePath = resolveBrowserExecutable(cfg);
  const userDataDir = path.join(winToLocalPath(cfg.profileRoot), cfg.profileName);
  fs.mkdirSync(userDataDir, { recursive: true });
  return await chromium.launchPersistentContext(userDataDir, {
    executablePath,
    headless: !!cfg.headless,
    viewport: cfg.viewport || { width: 1800, height: 1100 },
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
    ],
  });
}

async function getMainPage(context) {
  const pages = context.pages();
  return pages[0] || await context.newPage();
}

async function ensureLoggedIn(page, cfg) {
  await page.goto(cfg.facebookUrl || 'https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  const loginSignals = await page.locator('input[name="email"], input[name="pass"], text=/登入|Log in|Log In/').count().catch(() => 0);
  if (loginSignals > 0 && /login|checkpoint/i.test(page.url())) {
    throw new Error('Facebook profile 尚未登入或遇到 checkpoint。請先執行 scripts/open.login.profile.ps1 手動登入。');
  }
  const composer = page.getByText(new RegExp(cfg.composeText || "在想些什麼|What's on your mind|建立貼文|Create post", 'i')).first();
  await composer.waitFor({ state: 'visible', timeout: 45000 });
  return true;
}

function moveWithMedia(mdPath, mediaPaths, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  const moved = [];
  for (const src of [mdPath, ...mediaPaths]) {
    if (!fs.existsSync(src)) continue;
    const dest = path.join(targetDir, path.basename(src));
    fs.renameSync(src, dest);
    moved.push(dest);
  }
  return moved;
}

module.exports = {
  root,
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
};
