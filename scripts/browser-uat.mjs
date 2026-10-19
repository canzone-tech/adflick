// Run actual headless Chrome/Chromium on the session's localhost-only compiled app.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
const [webUrl, apiUrl] = process.argv.slice(2);
if (!webUrl || !apiUrl) throw new Error('Usage: browser-uat.mjs <web URL> <API URL>');
for (const raw of [webUrl, apiUrl]) {
  const url = new URL(raw);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1') throw new Error('Only localhost loopback browser targets are allowed.');
}
function findChrome() {
  for (const name of [process.env.CHROME_BINARY, 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].filter(Boolean)) {
    const check = spawnSync('which', [name], { encoding: 'utf8' });
    if (check.status === 0 && check.stdout.trim()) return check.stdout.trim();
  }
  throw new Error('Chrome/Chromium not found. A real browser is mandatory for UI UAT.');
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const profile = mkdtempSync(join(tmpdir(), 'adflick-browser-'));
const artifact = resolve('.adflick-uat');
mkdirSync(artifact, { recursive: true });
let chrome, socket, seq = 0;
const pending = new Map();
function command(method, params = {}) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error('Browser disconnected.'));
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error('Chrome timed out at ' + method)); }, 12000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const x = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (x.exceptionDetails) throw new Error('Browser JS exception: ' + x.exceptionDetails.text);
  return x.result?.value;
}
async function until(expression, label) {
  for (let i = 0; i < 90; i++) {
    try { if (await evaluate(expression)) return; } catch {}
    await sleep(250);
  }
  throw new Error('Browser UI did not become ready: ' + label);
}
async function screenshot(label) {
  const x = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  if (!x.data) throw new Error('Empty screenshot for ' + label);
  writeFileSync(join(artifact, label + '.png'), Buffer.from(x.data, 'base64'));
}
async function navigate(path) {
  const url = new URL(path, webUrl).toString();
  const result = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (result.status !== 200) throw new Error(path + ' returned HTTP ' + result.status);
  await command('Page.navigate', { url });
  await until("document.readyState === 'complete' && document.body && document.body.innerText.length > 60", path);
  await until('document.styleSheets.length > 0', path + ' CSS');
  const state = await evaluate('({path:location.pathname,chars:document.body.innerText.length,css:document.styleSheets.length,overflow:document.documentElement.scrollWidth-innerWidth})');
  if (state.path !== path || state.chars < 60) throw new Error('Unexpected page content at ' + path);
  if (await evaluate("Boolean(document.querySelector('nextjs-portal [data-nextjs-dialog]'))")) throw new Error('Next.js error overlay on ' + path);
  return state;
}
async function click(selector) {
  const bounds = await evaluate('(() => {const e=document.querySelector(' + JSON.stringify(selector) +
    '); if(!e) return null; const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
  if (!bounds) throw new Error('Missing UI control: ' + selector);
  await command('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...bounds });
  await command('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...bounds });
}
async function boot() {
  const flags = ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1',
    '--user-data-dir=' + profile, '--window-size=1280,900', 'about:blank'];
  if (process.env.CI === 'true') flags.push('--no-sandbox', '--disable-dev-shm-usage');
  chrome = spawn(findChrome(), flags, { stdio: 'ignore', detached: true });
  let port = 0;
  for (let i = 0; i < 80; i++) {
    if (chrome.exitCode !== null) throw new Error('Chrome process exited.');
    const file = join(profile, 'DevToolsActivePort');
    if (existsSync(file)) {
      const first = readFileSync(file, 'utf8').split(/\r?\n/)[0];
      if (/^\d{2,5}$/.test(first)) { port = Number(first); break; }
    }
    await sleep(200);
  }
  if (!port) throw new Error('Chrome DevTools unavailable.');
  const res = await fetch('http://127.0.0.1:' + port + '/json/new?' + encodeURIComponent(webUrl), { method: 'PUT' });
  if (!res.ok) throw new Error('Chrome new tab failed: ' + res.status);
  const target = await res.json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Chrome websocket timeout.')), 10000);
    socket.addEventListener('open', () => { clearTimeout(t); resolve(); }, { once: true });
    socket.addEventListener('error', () => { clearTimeout(t); reject(new Error('Chrome websocket error.')); }, { once: true });
  });
  socket.addEventListener('message', evt => {
    const x = JSON.parse(String(evt.data));
    const item = pending.get(x.id);
    if (!item) return;
    clearTimeout(item.timeout);
    pending.delete(x.id);
    if (x.error) item.reject(new Error('Chrome CDP: ' + x.error.message));
    else item.resolve(x.result);
  });
  await command('Page.enable');
  await command('Runtime.enable');
}
async function run() {
  await boot();
  const routes = ['/', '/cms', '/fleet', '/campaigns', '/delivery', '/scheduler', '/playback',
    '/health', '/incidents', '/finance', '/finance/payouts', '/login'];
  const results = [];
  for (const path of routes) {
    const state = await navigate(path);
    await screenshot(path === '/' ? 'home' : path.slice(1).replaceAll('/', '-'));
    results.push({ path, ...state });
    console.log('Chrome rendered ' + path + ': ' + state.chars + ' characters, ' + state.css + ' stylesheets');
  }
  await navigate('/');
  await click('a[href="/cms"]');
  await until("location.pathname === '/cms'", 'real sidebar click');
  await navigate('/login');
  await until("Boolean(document.querySelector('input[type=email]'))", 'login form');
  await click('form button');
  const blocked = await evaluate("location.pathname==='/login' && Boolean(document.querySelector('input[type=email]:invalid'))");
  if (!blocked) throw new Error('Required login form validation not enforced.');
  const apiStatus = await evaluate("(async()=>{const r=await fetch(" + JSON.stringify(apiUrl + '/auth/me') +
    ", {credentials:'omit'});return r.status;})()");
  if (apiStatus !== 401) throw new Error('Browser API unauthenticated request was not HTTP 401.');
  // Actual UI interaction regression, not just static route screenshots.
  await navigate('/cms');
  await click('.cms-tabs button:nth-child(3)');
  await until("document.body.innerText.includes('Add preview assets in the Media Library tab first.')", 'empty playlist guidance');
  if (!await evaluate("document.querySelector('.playlist-grid .primary-button')?.disabled === true")) {
    throw new Error('Empty playlist preview must be disabled instead of looking savable.');
  }
  if (!await evaluate("document.querySelector('[role=status]')?.innerText.includes('Playlist preview only.')")) {
    throw new Error('Switching CMS tabs did not reset stale feedback.');
  }
  await click('.cms-tabs button:nth-child(2)');
  await until("Boolean(document.querySelector('.media-form input'))", 'media form loaded');
  await click('.media-form input');
  await command('Input.insertText', { text: 'UAT Local Image' });
  await click('.media-form button');
  await until("document.body.innerText.includes('UAT Local Image') && document.body.innerText.includes('Needs upload')", 'preview media added');
  await click('.cms-tabs button:nth-child(3)');
  await until("Boolean(document.querySelector('.playlist-sequence input[type=checkbox]'))", 'preview media available for playlist');
  await click('.playlist-sequence input[type=checkbox]');
  await until("document.querySelector('.playlist-grid .primary-button')?.disabled === false", 'playlist draft becomes enabled');
  await click('.playlist-grid .primary-button');
  await until("document.querySelector('[role=status]')?.innerText.includes('has not been saved or scheduled')", 'playlist disclaimer');
  console.log('Chrome CMS interactions PASS: tab feedback, empty playlist disabled, preview media selection and draft disclaimer');

  await navigate('/campaigns');
  await until("document.querySelector('.campaign-preview-note')?.innerText.includes('browser-only')", 'campaign demo warning');
  await click('.campaign-header .campaign-primary');
  await until("Boolean(document.querySelector('.campaign-form-grid input'))", 'campaign draft form');
  await click('.campaign-form-grid input');
  await command('Input.insertText', { text: 'UAT Draft Campaign' });
  await click('.campaign-form-grid label:nth-child(2) input');
  await command('Input.insertText', { text: 'Test Brand Only' });
  await click('.campaign-form-grid label:nth-child(3) input');
  await command('Input.insertText', { text: '1000' });
  await click('.campaign-form-actions button');
  await until("document.body.innerText.includes('UAT Draft Campaign') && document.querySelector('.campaign-notice')?.innerText.includes('No backend request was made')", 'local campaign preview');
  await navigate('/campaigns');
  if (await evaluate("document.body.innerText.includes('UAT Draft Campaign')")) {
    throw new Error('Campaign demo unexpectedly persisted after reloading route.');
  }
  console.log('Chrome Campaign interactions PASS: visible demo warning, local draft creation and no persistence');
  if (process.env.ADFLICK_BROWSER_TEST_EMAIL && process.env.ADFLICK_BROWSER_TEST_PASSWORD) {
    await navigate('/login');
    await click('input[type=email]');
    await command('Input.insertText', { text: process.env.ADFLICK_BROWSER_TEST_EMAIL });
    await click('input[type=password]');
    await command('Input.insertText', { text: process.env.ADFLICK_BROWSER_TEST_PASSWORD });
    await click('form button');
    await until("location.pathname === '/account' && document.body.innerText.includes('Your organization session')",
      'authenticated login redirect');
    await until("document.body.innerText.includes('ORGANIZATION_ADMIN')", 'real API identity and role');
    await screenshot('authenticated-account');
    const token = await evaluate("localStorage.getItem('adflick_access_token')");
    if (!token) throw new Error('Login did not establish a local development session.');
    await navigate('/account');
    await until("document.body.innerText.includes('ORGANIZATION_ADMIN')", 'identity survives browser route refresh');
    await click('.account-logout');
    await until("location.pathname === '/login'", 'logout redirects to login');
    if (await evaluate("localStorage.getItem('adflick_access_token') !== null")) {
      throw new Error('Logout did not clear browser access token.');
    }
    const revoked = await evaluate("(async()=>{const r=await fetch(" +
      JSON.stringify(apiUrl + '/auth/me') + ",{headers:{Authorization:'Bearer " +
      token + "'}});return r.status;})()");
    if (revoked !== 401) throw new Error('Server did not revoke logged-out session.');
    console.log('Chrome authenticated operator UAT PASS: login, account role, refresh, logout, server 401 revocation');
  }
  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  for (const path of ['/', '/login', '/cms']) {
    await navigate(path);
    await screenshot('mobile-' + (path === '/' ? 'home' : path.slice(1)));
  }
  results.push({ sidebarNavigation: 'PASS', browserRequiredLoginValidation: 'PASS', unauthorizedApiStatus: apiStatus, mobileViewport: '390x844' });
  writeFileSync(join(artifact, 'results.json'), JSON.stringify(results, null, 2) + '\n');
}
try {
  await run();
  console.log('ADFLICK BROWSER UAT PASS; evidence at ' + artifact);
} catch (error) {
  console.error('ADFLICK BROWSER UAT FAIL: ' + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
} finally {
  try { socket?.close(); } catch {}
  if (chrome?.pid) {
    try { process.kill(-chrome.pid, 'SIGTERM'); } catch { try { chrome.kill('SIGTERM'); } catch {} }
  }
  for (const item of pending.values()) { clearTimeout(item.timeout); item.reject(new Error('Browser shutting down.')); }
  pending.clear();
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
