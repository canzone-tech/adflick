// Run actual headless Chrome/Chromium against localhost-only compiled ADFLICK.
import { createHmac } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
const [webUrl, apiUrl] = process.argv.slice(2);
if (!webUrl || !apiUrl) throw new Error('Usage: browser-uat.mjs <web URL> <API URL>');
for (const raw of [webUrl, apiUrl]) { const url = new URL(raw); if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1') throw new Error('Only localhost loopback browser targets are allowed.'); }
function findChrome() { for (const name of [process.env.CHROME_BINARY, 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].filter(Boolean)) { const check = spawnSync('which', [name], { encoding: 'utf8' }); if (check.status === 0 && check.stdout.trim()) return check.stdout.trim(); } throw new Error('Chrome/Chromium not found.'); }
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function decodeBase32(value) { const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; const normalized = value.replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase(); let bits = ''; for (const char of normalized) { const index = alphabet.indexOf(char); if (index < 0) throw new Error('Invalid MFA base32 secret.'); bits += index.toString(2).padStart(5, '0'); } const bytes = []; for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(Number.parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(bytes); }
function totp(secret, now = Date.now()) { const step = Math.floor(now / 1000 / 30); const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(step)); const digest = createHmac('sha1', decodeBase32(secret)).update(counter).digest(); const offset = digest[digest.length - 1] & 0x0f; return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0'); }
async function waitForNextTotpStep(previousStep) { for (let i = 0; i < 80; i++) { if (Math.floor(Date.now() / 1000 / 30) > previousStep) return; await sleep(500); } throw new Error('TOTP step did not advance in time.'); }
const profile = mkdtempSync(join(tmpdir(), 'adflick-browser-'));
const artifact = resolve('.adflick-uat'); mkdirSync(artifact, { recursive: true });
let chrome, socket, seq = 0; const pending = new Map();
function command(method, params = {}) { if (!socket || socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error('Browser disconnected.')); const id = ++seq; return new Promise((resolve, reject) => { const timeout = setTimeout(() => { pending.delete(id); reject(new Error('Chrome timed out at ' + method)); }, 12000); pending.set(id, { resolve, reject, timeout }); socket.send(JSON.stringify({ id, method, params })); }); }
async function evaluate(expression) { const x = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (x.exceptionDetails) throw new Error('Browser JS exception: ' + x.exceptionDetails.text); return x.result?.value; }
async function until(expression, label) { for (let i = 0; i < 90; i++) { try { if (await evaluate(expression)) return; } catch {} await sleep(250); } throw new Error('Browser UI did not become ready: ' + label); }
async function screenshot(label) { const x = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); if (!x.data) throw new Error('Empty screenshot for ' + label); writeFileSync(join(artifact, label + '.png'), Buffer.from(x.data, 'base64')); }
async function navigate(path) { const url = new URL(path, webUrl).toString(); const result = await fetch(url, { signal: AbortSignal.timeout(8000) }); if (result.status !== 200) throw new Error(path + ' returned HTTP ' + result.status); await command('Page.navigate', { url }); await until("document.readyState === 'complete' && document.body && document.body.innerText.length > 60", path); await until('document.styleSheets.length > 0', path + ' CSS'); const state = await evaluate('({path:location.pathname,chars:document.body.innerText.length,css:document.styleSheets.length,overflow:document.documentElement.scrollWidth-innerWidth})'); if (state.path !== path || state.chars < 60) throw new Error('Unexpected page content at ' + path); if (await evaluate("Boolean(document.querySelector('nextjs-portal [data-nextjs-dialog]'))")) throw new Error('Next.js error overlay on ' + path); return state; }
async function click(selector) {
  const bounds = await evaluate('(() => {const e=document.querySelector(' + JSON.stringify(selector) + '); if(!e) return null; e.scrollIntoView({block:"center",inline:"nearest",behavior:"instant"}); const r=e.getBoundingClientRect(); const x=r.x+r.width/2,y=r.y+r.height/2; const hit=document.elementFromPoint(x,y);return {x,y,width:r.width,height:r.height,hit:Boolean(hit && (e===hit || e.contains(hit)))};})()');
  if (!bounds) throw new Error('Missing UI control: ' + selector);
  if (!bounds.width || !bounds.height || bounds.x<0 || bounds.y<0 || bounds.x>1280 || bounds.y>900 || !bounds.hit) {
    throw new Error('UI control is not interactable in browser viewport: '+selector+' '+JSON.stringify(bounds));
  }
  const point = {x:bounds.x,y:bounds.y};
  await command('Input.dispatchMouseEvent', { type:'mousePressed', button:'left', clickCount:1, ...point });
  await command('Input.dispatchMouseEvent', { type:'mouseReleased', button:'left', clickCount:1, ...point });
}
async function boot() { const flags = ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', '--user-data-dir=' + profile, '--window-size=1280,900', 'about:blank']; if (process.env.CI === 'true') flags.push('--no-sandbox', '--disable-dev-shm-usage'); chrome = spawn(findChrome(), flags, { stdio: 'ignore', detached: true }); let port = 0; for (let i = 0; i < 80; i++) { if (chrome.exitCode !== null) throw new Error('Chrome process exited.'); const file = join(profile, 'DevToolsActivePort'); if (existsSync(file)) { const first = readFileSync(file, 'utf8').split(/\r?\n/)[0]; if (/^\d{2,5}$/.test(first)) { port = Number(first); break; } } await sleep(200); } if (!port) throw new Error('Chrome DevTools unavailable.'); const res = await fetch('http://127.0.0.1:' + port + '/json/new?' + encodeURIComponent(webUrl), { method: 'PUT' }); if (!res.ok) throw new Error('Chrome new tab failed: ' + res.status); const target = await res.json(); socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve, reject) => { const t = setTimeout(() => reject(new Error('Chrome websocket timeout.')), 10000); socket.addEventListener('open', () => { clearTimeout(t); resolve(); }, { once: true }); socket.addEventListener('error', () => { clearTimeout(t); reject(new Error('Chrome websocket error.')); }, { once: true }); }); socket.addEventListener('message', evt => { const x = JSON.parse(String(evt.data)); const item = pending.get(x.id); if (!item) return; clearTimeout(item.timeout); pending.delete(x.id); if (x.error) item.reject(new Error('Chrome CDP: ' + x.error.message)); else item.resolve(x.result); }); await command('Page.enable'); await command('Runtime.enable'); }
async function browserLogin() { await navigate('/login'); await click('input[type=email]'); await command('Input.insertText', { text: process.env.ADFLICK_BROWSER_TEST_EMAIL }); await click('input[type=password]'); await command('Input.insertText', { text: process.env.ADFLICK_BROWSER_TEST_PASSWORD }); await click('form button'); await until("location.pathname === '/account' && document.body.innerText.includes('Your organization session')", 'authenticated login redirect'); await until("document.body.innerText.includes('ORGANIZATION_ADMIN')", 'real API identity and role'); }
async function privilegedMutationStatus() { return await evaluate("(async()=>{const r=await fetch(" + JSON.stringify(apiUrl + '/campaigns') + ", {method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:'{}'});return r.status;})()"); }
async function run() {
  await boot();
  const routes = ['/', '/cms', '/fleet', '/campaigns', '/delivery', '/scheduler', '/playback', '/health', '/incidents', '/finance', '/finance/payouts', '/login'];
  const results = [];
  for (const path of routes) { const state = await navigate(path); await screenshot(path === '/' ? 'home' : path.slice(1).replaceAll('/', '-')); results.push({ path, ...state }); }
  // Shared operations chrome: one instance on every workspace route; login is public.
  for (const path of ['/', '/cms', '/fleet', '/campaigns', '/delivery', '/scheduler', '/playback', '/health', '/incidents', '/finance', '/finance/payouts', '/account', '/login']) {
    await navigate(path);
    await until(path === '/login'
      ? "document.querySelectorAll('[data-testid=app-shell]').length === 0"
      : "document.querySelectorAll('[data-testid=app-sidebar]').length === 1 && document.querySelectorAll('[data-testid=app-topbar]').length === 1",
      path + ' shared chrome');
    const state = await evaluate("(() => ({shells: document.querySelectorAll('[data-testid=app-shell]').length, sidebars: document.querySelectorAll('[data-testid=app-sidebar]').length, topbars: document.querySelectorAll('[data-testid=app-topbar]').length, active: document.querySelector('[data-testid=app-sidebar] a[aria-current=page]')?.getAttribute('href') }))()");
    if (path === '/login') {
      if (state.shells || state.sidebars || state.topbars) throw new Error('Public login must not render operations chrome.');
    } else if (state.shells !== 1 || state.sidebars !== 1 || state.topbars !== 1 || state.active !== path) {
      throw new Error('Inconsistent application shell/navigation on '+path+': '+JSON.stringify(state));
    }
  }

  // Physical browser viewport smoke for required compact layout breakpoints.
  for (const width of [320, 390, 768, 1280]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    await navigate('/');
    const metrics = await evaluate("(() => {const header=document.querySelector('[data-testid=app-topbar]');const work=document.querySelector('[data-testid=app-page-content]');const side=document.querySelector('[data-testid=app-sidebar]');const menu=document.querySelector('[data-testid=app-menu-toggle]');return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,header:header?.getBoundingClientRect().width,content:work?.getBoundingClientRect().width,sidebar:side?.getBoundingClientRect().width,menuVisible:menu?.getBoundingClientRect().width>0}})()");
    if (metrics.width !== width || metrics.scrollWidth > width + 2 || metrics.header > width + 2 || metrics.content > width + 2) {
      throw new Error('Viewport overflow in shared shell at '+width+'px: '+JSON.stringify(metrics));
    }
    if (metrics.menuVisible !== (width <= 860)) throw new Error('Wrong mobile menu breakpoint at '+width+'px.');
    if (width === 320) {
      await click('[data-testid=app-menu-toggle]');
      await until("document.querySelector('[data-testid=app-menu-toggle]')?.getAttribute('aria-expanded')==='true' && getComputedStyle(document.querySelector('[data-testid=app-sidebar]')).visibility==='visible'", 'mobile drawer opened');
      await command('Input.dispatchKeyEvent', {type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
      await until("document.querySelector('[data-testid=app-menu-toggle]')?.getAttribute('aria-expanded')==='false'", 'Escape closes mobile drawer');
      await click('[data-testid=app-menu-toggle]');
      await click('[data-testid=app-sidebar] a[href="/fleet"]');
      await until("location.pathname === '/fleet' && document.querySelector('[data-testid=app-menu-toggle]')?.getAttribute('aria-expanded')==='false'", 'mobile navigation and drawer close');
      const fleetMetrics = await evaluate("({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})");
      if (fleetMetrics.scrollWidth > width + 2) throw new Error('Fleet page overflows 320px screen.');
    }
    if (width === 390) await screenshot('workspace-mobile-390');
  }
  await command('Emulation.clearDeviceMetricsOverride');
  await navigate('/'); await click('a[href="/cms"]'); await until("location.pathname === '/cms'", 'real sidebar click');
  await navigate('/login'); await click('form button');
  if (!await evaluate("location.pathname==='/login' && Boolean(document.querySelector('input[type=email]:invalid'))")) throw new Error('Required login form validation not enforced.');
  const apiStatus = await evaluate("(async()=>{const r=await fetch(" + JSON.stringify(apiUrl + '/auth/me') + ", {credentials:'omit'});return r.status;})()");
  if (apiStatus !== 401) throw new Error('Browser API unauthenticated request was not HTTP 401.');

  await navigate('/cms'); await click('.cms-tabs button:nth-child(3)'); await until("document.body.innerText.includes('Add preview assets in the Media Library tab first.')", 'empty playlist guidance');
  if (!await evaluate("document.querySelector('.playlist-grid .primary-button')?.disabled === true")) throw new Error('Empty playlist preview must be disabled.');
  if (!await evaluate("document.querySelector('[role=status]')?.innerText.includes('Playlist preview only.')")) throw new Error('CMS tab feedback was not reset.');
  await click('.cms-tabs button:nth-child(2)'); await until("Boolean(document.querySelector('.media-form input'))", 'media form loaded'); await click('.media-form input'); await command('Input.insertText', { text: 'UAT Local Image' }); await click('.media-form button'); await until("document.body.innerText.includes('UAT Local Image') && document.body.innerText.includes('Needs upload')", 'preview media added');
  await click('.cms-tabs button:nth-child(3)'); await until("Boolean(document.querySelector('.playlist-sequence input[type=checkbox]'))", 'preview media available'); await click('.playlist-sequence input[type=checkbox]'); await until("document.querySelector('.playlist-grid .primary-button')?.disabled === false", 'playlist enabled'); await click('.playlist-grid .primary-button'); await until("document.querySelector('[role=status]')?.innerText.includes('has not been saved or scheduled')", 'playlist disclaimer');
  console.log('Chrome CMS interactions PASS');

  await navigate('/campaigns'); await until("document.querySelector('.campaign-preview-note')?.innerText.includes('browser-only')", 'campaign demo warning'); await click('.campaign-header .campaign-primary'); await until("Boolean(document.querySelector('.campaign-form-grid input'))", 'campaign draft form'); await click('.campaign-form-grid input'); await command('Input.insertText', { text: 'UAT Draft Campaign' }); await click('.campaign-form-grid label:nth-child(2) input'); await command('Input.insertText', { text: 'Test Brand Only' }); await click('.campaign-form-grid label:nth-child(3) input'); await command('Input.insertText', { text: '1000' }); await click('.campaign-form-actions button'); await until("document.body.innerText.includes('UAT Draft Campaign') && document.querySelector('.campaign-notice')?.innerText.includes('No backend request was made')", 'local campaign preview'); await navigate('/campaigns'); if (await evaluate("document.body.innerText.includes('UAT Draft Campaign')")) throw new Error('Campaign demo unexpectedly persisted.'); console.log('Chrome Campaign interactions PASS');

  if (process.env.ADFLICK_BROWSER_TEST_EMAIL && process.env.ADFLICK_BROWSER_TEST_PASSWORD) {
    await browserLogin();
    const browserStorage = await evaluate("({access:localStorage.getItem('adflick_access_token'),refresh:localStorage.getItem('adflick_refresh_token'),cookie:document.cookie})");
    if (browserStorage.access !== null || browserStorage.refresh !== null) throw new Error('Authentication tokens were written to browser local storage.');
    if (/adflick-(access|refresh)|__Host-adflick-(access|refresh)/i.test(browserStorage.cookie)) throw new Error('HttpOnly auth cookie was exposed to document.cookie.');
    const authenticated = await evaluate("(async()=>{const r=await fetch(" + JSON.stringify(apiUrl + '/auth/me') + ", {credentials:'include'});return r.status;})()"); if (authenticated !== 200) throw new Error('Cookie-authenticated browser API request was not HTTP 200.');

    const beforeEnrollment = await privilegedMutationStatus();
    if (beforeEnrollment !== 403) throw new Error('Privileged mutation did not fail closed before MFA enrollment; status=' + beforeEnrollment);
    await until("Boolean(document.querySelector('[data-testid=\"mfa-enroll-password\"]'))", 'MFA enrollment controls');
    await click('[data-testid="mfa-enroll-password"]'); await command('Input.insertText', { text: process.env.ADFLICK_BROWSER_TEST_PASSWORD }); await click('[data-testid="mfa-enroll-button"]');
    await until("Boolean(document.querySelector('[data-testid=\"mfa-secret\"]'))", 'MFA setup secret');
    const secret = await evaluate("document.querySelector('[data-testid=\"mfa-secret\"]')?.textContent?.trim()");
    if (!secret || secret.length < 20) throw new Error('MFA setup secret was not rendered.');
    const enrollmentStep = Math.floor(Date.now() / 1000 / 30);
    const enrollmentCode = totp(secret);
    await click('[data-testid="mfa-enroll-code"]'); await command('Input.insertText', { text: enrollmentCode }); await click('[data-testid="mfa-confirm-button"]');
    await until("document.body.innerText.includes('MFA enabled') && document.querySelector('[data-testid=\"mfa-status\"]')?.innerText.includes('Enabled')", 'MFA confirmation');
    const afterEnrollment = await privilegedMutationStatus();
    if (afterEnrollment !== 400) throw new Error('Privileged mutation did not pass the MFA gate after enrollment; status=' + afterEnrollment);
    await screenshot('mfa-enrolled');

    await click('.account-logout'); await until("location.pathname === '/login'", 'logout after MFA enrollment');
    const postEnrollmentLogout = await evaluate("(async()=>{const r=await fetch(" + JSON.stringify(apiUrl + '/auth/me') + ", {credentials:'include'});return r.status;})()"); if (postEnrollmentLogout !== 401) throw new Error('Logout did not revoke the MFA-enabled browser session.');

    await browserLogin();
    const beforeStepUp = await privilegedMutationStatus();
    if (beforeStepUp !== 403) throw new Error('MFA-enabled session did not require a fresh step-up after login; status=' + beforeStepUp);
    await click('[data-testid="mfa-challenge-button"]'); await until("Boolean(document.querySelector('[data-testid=\"mfa-challenge-code\"]'))", 'MFA step-up challenge');
    await waitForNextTotpStep(enrollmentStep);
    const challengeCode = totp(secret);
    await click('[data-testid="mfa-challenge-code"]'); await command('Input.insertText', { text: challengeCode }); await click('[data-testid="mfa-verify-button"]');
    await until("document.body.innerText.includes('Privileged step-up verified')", 'MFA step-up success');
    const afterStepUp = await privilegedMutationStatus();
    if (afterStepUp !== 400) throw new Error('Privileged mutation did not pass after MFA step-up; status=' + afterStepUp);

    await click('[data-testid="mfa-challenge-button"]'); await until("Boolean(document.querySelector('[data-testid=\"mfa-challenge-code\"]'))", 'MFA replay challenge');
    await click('[data-testid="mfa-challenge-code"]'); await command('Input.insertText', { text: challengeCode }); await click('[data-testid="mfa-verify-button"]');
    await until("document.querySelector('.login-notice')?.innerText.includes('Invalid MFA code') || document.querySelector('.login-notice')?.innerText.includes('already been used')", 'MFA replay rejection');

    await navigate('/account'); await until("document.body.innerText.includes('ORGANIZATION_ADMIN')", 'identity survives browser route refresh'); await screenshot('authenticated-account'); await click('.account-logout'); await until("location.pathname === '/login'", 'logout redirects to login');
    const postLogout = await evaluate("(async()=>{const r=await fetch(" + JSON.stringify(apiUrl + '/auth/me') + ", {credentials:'include'});return r.status;})()"); if (postLogout !== 401) throw new Error('Server did not revoke cookie session after logout.');
    const storageAfterLogout = await evaluate("({access:localStorage.getItem('adflick_access_token'),refresh:localStorage.getItem('adflick_refresh_token')})"); if (storageAfterLogout.access !== null || storageAfterLogout.refresh !== null) throw new Error('Logout left authentication tokens in browser storage.');
    console.log('Chrome authenticated operator + privileged MFA UAT PASS: HttpOnly cookie login, MFA enrollment, fail-closed mutation, session reset, single-use challenge, replay rejection, step-up, logout revocation, no localStorage tokens');
  }
  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }); for (const path of ['/', '/login', '/cms']) { await navigate(path); await screenshot('mobile-' + (path === '/' ? 'home' : path.slice(1))); }
  results.push({ sidebarNavigation: 'PASS', browserRequiredLoginValidation: 'PASS', unauthorizedApiStatus: apiStatus, mobileViewport: '390x844' }); writeFileSync(join(artifact, 'results.json'), JSON.stringify(results, null, 2) + '\n');
}
try { await run(); console.log('ADFLICK BROWSER UAT PASS; evidence at ' + artifact); } catch (error) { console.error('ADFLICK BROWSER UAT FAIL: ' + (error instanceof Error ? error.message : String(error))); process.exitCode = 1; } finally { try { socket?.close(); } catch {} if (chrome?.pid) { try { process.kill(-chrome.pid, 'SIGTERM'); } catch { try { chrome.kill('SIGTERM'); } catch {} } } for (const item of pending.values()) { clearTimeout(item.timeout); item.reject(new Error('Browser shutting down.')); } pending.clear(); try { rmSync(profile, { recursive: true, force: true }); } catch {} }
