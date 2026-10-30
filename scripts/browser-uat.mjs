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
async function navigate(path) { const url = new URL(path, webUrl).toString(); /* Node fetch has no Chrome HttpOnly cookies: only preflight truly public routes. */ if (['/login','/join'].includes(path)) { const result = await fetch(url, { signal: AbortSignal.timeout(8000) }); if (result.status !== 200) throw new Error(path + ' returned HTTP ' + result.status); } await command('Page.navigate', { url }); try {
    await until("location.pathname === " + JSON.stringify(path) + " && document.readyState === 'complete' && document.body && document.body.innerText.length > 60", path);
  } catch {
    // Never log cookies, tokens, HTML, email or personal data in CI diagnostics.
    const state = await evaluate("(async()=>{const status=await fetch(" + JSON.stringify(apiUrl + '/auth/me') + ",{credentials:'include',cache:'no-store'}).then(r=>r.status).catch(()=>0);return {path:location.pathname,ready:document.readyState,hasWorkspaceShell:Boolean(document.querySelector('[data-testid=app-sidebar]')),authStatus:status};})()");
    throw new Error('Browser route navigation failed at ' + path + ': ' + JSON.stringify(state));
  } await until('document.styleSheets.length > 0', path + ' CSS'); const state = await evaluate('({path:location.pathname,chars:document.body.innerText.length,css:document.styleSheets.length,overflow:document.documentElement.scrollWidth-innerWidth})'); if (state.path !== path || state.chars < 60) throw new Error('Unexpected page content at ' + path); if (await evaluate("Boolean(document.querySelector('nextjs-portal [data-nextjs-dialog]'))")) throw new Error('Next.js error overlay on ' + path); return state; }
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
  // Fail the UAT immediately if guest/Incognito can render any workspace page.
  const guestWorkspace = ['/', '/account', '/cms', '/campaigns', '/fleet', '/health', '/member-dashboard', '/member-onboarding', '/member-operations', '/finance'];
  for (const path of guestWorkspace) {
    const result = await fetch(new URL(path, webUrl), { redirect: 'manual', signal: AbortSignal.timeout(8000) });
    if (result.status !== 307 || new URL(result.headers.get('location') ?? '', webUrl).pathname !== '/login')
      throw new Error('Unauthenticated workspace did not redirect before render: ' + path + ' HTTP ' + result.status);
  }
  const forged = await fetch(new URL('/cms', webUrl), { redirect: 'manual', headers: { Cookie: 'adflick-access=forged' } });
  if (forged.status !== 307) throw new Error('Forged session cookie passed workspace gate.');
  await command('Page.navigate', { url: new URL('/cms', webUrl).toString() });
  await until("location.pathname === '/login'", 'guest client-side redirect');
  if (await evaluate("Boolean(document.querySelector('[data-testid=app-sidebar],.cms-grid,.real-ops-panel'))"))
    throw new Error('Guest Chrome was able to see workspace sidebar or CMS editor.');
  console.log('Chrome guest workspace pre-render redirects PASS');

  await navigate('/login'); await click('form button');
  if (!await evaluate("location.pathname==='/login' && Boolean(document.querySelector('input[type=email]:invalid'))"))
    throw new Error('Required login form validation not enforced.');
  const apiStatus = await evaluate("(async()=>{const r=await fetch(" + JSON.stringify(apiUrl + '/auth/me') + ", {credentials:'omit'});return r.status;})()");
  if (apiStatus !== 401) throw new Error('Browser API unauthenticated request was not HTTP 401.');
  console.log('Chrome member portal guest isolation PASS');
  console.log('Chrome CMS/campaign/fleet guest isolation PASS');
  if (!process.env.ADFLICK_BROWSER_TEST_EMAIL || !process.env.ADFLICK_BROWSER_TEST_PASSWORD)
    throw new Error('Browser UAT requires disposable test-admin credentials, never a real operator secret.');
  await browserLogin();
  const routes = ['/', '/cms', '/fleet', '/campaigns', '/delivery', '/scheduler', '/playback', '/health', '/incidents', '/finance', '/finance/payouts', '/login'];
  const results = [];
  for (const path of routes) { const state = await navigate(path); await screenshot(path === '/' ? 'home' : path.slice(1).replaceAll('/', '-')); results.push({ path, ...state }); }
  // Shared operations chrome: one instance on every workspace route; login is public.
  for (const path of ['/', '/cms', '/fleet', '/campaigns', '/delivery', '/scheduler', '/playback', '/health', '/incidents', '/finance', '/finance/payouts', '/account', '/communications', '/email-verification', '/phone-verification', '/member-dashboard', '/member-onboarding', '/member-operations', '/login', '/join']) {
    await navigate(path);
    await until(['/login','/join'].includes(path)
      ? "document.querySelectorAll('[data-testid=app-shell]').length === 0"
      : "document.querySelectorAll('[data-testid=app-sidebar]').length === 1 && document.querySelectorAll('[data-testid=app-topbar]').length === 1",
      path + ' shared chrome');
    const state = await evaluate("(() => ({shells: document.querySelectorAll('[data-testid=app-shell]').length, sidebars: document.querySelectorAll('[data-testid=app-sidebar]').length, topbars: document.querySelectorAll('[data-testid=app-topbar]').length, active: document.querySelector('[data-testid=app-sidebar] a[aria-current=page]')?.getAttribute('href') }))()");
    if (['/login','/join'].includes(path)) {
      if (state.shells || state.sidebars || state.topbars) throw new Error('Public login must not render operations chrome.');
    } else if (state.shells !== 1 || state.sidebars !== 1 || state.topbars !== 1 || state.active !== path) {
      throw new Error('Inconsistent application shell/navigation on '+path+': '+JSON.stringify(state));
    }
  }

  // Physical browser viewport smoke for required compact layout breakpoints.
  for (const width of [320, 360, 390, 412, 768, 1280]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    await navigate('/');
    const metrics = await evaluate("(() => {const header=document.querySelector('[data-testid=app-topbar]');const work=document.querySelector('[data-testid=app-page-content]');const side=document.querySelector('[data-testid=app-sidebar]');const menu=document.querySelector('[data-testid=app-menu-toggle]');return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,header:header?.getBoundingClientRect().width,content:work?.getBoundingClientRect().width,sidebar:side?.getBoundingClientRect().width,menuVisible:menu?.getBoundingClientRect().width>0}})()");
    if (metrics.width !== width || metrics.scrollWidth > width + 2 || metrics.header > width + 2 || metrics.content > width + 2) {
      throw new Error('Viewport overflow in shared shell at '+width+'px: '+JSON.stringify(metrics));
    }
    if (metrics.menuVisible !== (width <= 860)) throw new Error('Wrong mobile menu breakpoint at '+width+'px.');

    // SRS member/member-operations routes must be readable at the actual viewport,
    // not just hidden behind a responsive shared sidebar.
    for (const [path, title] of [
      ['/member-dashboard', 'My member dashboard'],
      ['/member-onboarding', 'Member enrollment'],
      ['/member-operations', 'Member enrollment operations'],
    ]) {
      await navigate(path);
      const memberMetrics = await evaluate("(() => ({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,heading:document.querySelector('main h1')?.textContent?.trim(),mainWidth:document.querySelector('main')?.getBoundingClientRect().width,errors:document.querySelectorAll('nextjs-portal [data-nextjs-dialog]').length}))()");
      if (memberMetrics.width !== width || memberMetrics.scrollWidth > width + 2 ||
          !memberMetrics.mainWidth || memberMetrics.mainWidth > width + 2 ||
          memberMetrics.heading !== title || memberMetrics.errors !== 0) {
        throw new Error('Member workflow responsive regression at '+width+'px '+path+': '+JSON.stringify(memberMetrics));
      }
      if (width === 390) await screenshot('member-' + path.slice(1) + '-mobile-390');
    }
    // Public Join is its own shell and must not overflow at SRS handset widths.
    await navigate('/join');
    const joinMetrics=await evaluate("(() => ({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,title:document.querySelector('main h1')?.textContent?.trim(),shells:document.querySelectorAll('[data-testid=app-shell]').length}))()");
    if(joinMetrics.width!==width||joinMetrics.scrollWidth>width+2||
       joinMetrics.title!=='Join ADFLICK'||joinMetrics.shells!==0)
      throw new Error('Public signup responsive regression at '+width+'px: '+JSON.stringify(joinMetrics));
    if(width===360||width===412)await screenshot('join-mobile-'+width);
    await navigate('/');
    if (width === 320) {
      await click('[data-testid=app-menu-toggle]');
      await until("document.querySelector('[data-testid=app-menu-toggle]')?.getAttribute('aria-expanded')==='true' && getComputedStyle(document.querySelector('[data-testid=app-sidebar]')).visibility==='visible'", 'mobile drawer opened');
      await command('Input.dispatchKeyEvent', {type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
      await until("document.querySelector('[data-testid=app-menu-toggle]')?.getAttribute('aria-expanded')==='false'", 'Escape closes mobile drawer');
      await click('[data-testid=app-menu-toggle]');
      await until("(() => { const link=document.querySelector('[data-testid=app-sidebar] a[href=\\\"/fleet\\\"]'); if(!link)return false;const r=link.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return document.querySelector('[data-testid=app-menu-toggle]')?.getAttribute('aria-expanded')==='true' && r.left >= 0 && r.right <= innerWidth && (hit===link || link.contains(hit)); })()", 'mobile drawer link is fully visible and interactive');
      await click('[data-testid=app-sidebar] a[href="/fleet"]');
      await until("location.pathname === '/fleet' && document.querySelector('[data-testid=app-menu-toggle]')?.getAttribute('aria-expanded')==='false'", 'mobile navigation and drawer close');
      const fleetMetrics = await evaluate("({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})");
      if (fleetMetrics.scrollWidth > width + 2) throw new Error('Fleet page overflows 320px screen.');
    }
    if (width === 390) await screenshot('workspace-mobile-390');
  }
  await command('Emulation.clearDeviceMetricsOverride');
  await navigate('/'); await click('a[href="/cms"]'); await until("location.pathname === '/cms'", 'real sidebar click');
  // Browser was authenticated before workspace visual/interaction checks.
  // Guest redirects and no-sidebar checks are executed above, before login.
  if (process.env.ADFLICK_BROWSER_TEST_EMAIL && process.env.ADFLICK_BROWSER_TEST_PASSWORD) {
    // Already authenticated before the workspace layout smoke; do not re-login.
    const browserStorage = await evaluate("({access:localStorage.getItem('adflick_access_token'),refresh:localStorage.getItem('adflick_refresh_token'),cookie:document.cookie})");
    if (browserStorage.access !== null || browserStorage.refresh !== null) throw new Error('Authentication tokens were written to browser local storage.');
    if (/adflick-(access|refresh)|__Host-adflick-(access|refresh)/i.test(browserStorage.cookie)) throw new Error('HttpOnly auth cookie was exposed to document.cookie.');
    const authenticated = await evaluate("(async()=>{const r=await fetch(" + JSON.stringify(apiUrl + '/auth/me') + ", {credentials:'include'});return r.status;})()"); if (authenticated !== 200) throw new Error('Cookie-authenticated browser API request was not HTTP 200.');

    // Authenticated ORGANIZATION_ADMIN is not a MEMBER: route UX must show
    // explicit role denial without issuing a MEMBER-only data API request.
    await navigate('/member-dashboard');
    await until("document.querySelector('main')?.innerText.includes('This dashboard requires a MEMBER role.')", 'member dashboard role denial');
    if(await evaluate("Boolean(document.querySelector('.member-dashboard-facts, .communication-error'))"))
      throw new Error('Member dashboard leaked data or displayed spurious API errors to staff.');
    await navigate('/member-onboarding');
    await until("document.querySelector('main')?.innerText.includes('This workflow is restricted to MEMBER accounts.')", 'member onboarding role denial');
    if(await evaluate("Boolean(document.querySelector('.member-onboard-summary, .communication-error'))"))
      throw new Error('Member enrollment leaked data or displayed spurious API errors to staff.');
    await navigate('/account');
    await until("document.body.innerText.includes('ORGANIZATION_ADMIN')", 'account restored after role-safe navigation');

    const scopedOrganization = await evaluate("(async()=>{const r=await fetch(" + JSON.stringify(apiUrl + '/auth/me') + ",{credentials:'include'});const identity=await r.json();return Boolean(identity.organizationId);})()");
    if (scopedOrganization) {
    for (const [path,id] of [['/cms','real-cms-operations'],['/campaigns','real-campaign-operations'],['/fleet','real-fleet-operations']]) {
      await navigate(path);
      await until("Boolean(document.querySelector('[data-testid=" + JSON.stringify(id) + "] .real-ops-panel, [data-testid=" + JSON.stringify(id) + "] .real-ops-error'))",path+' real authenticated panel or explicit API error');
      if (!await evaluate("Boolean(document.querySelector('[data-testid=" + JSON.stringify(id) + "] .real-ops-panel'))")) {
        const diagnostics=await evaluate("(async()=>{const root=document.querySelector('[data-testid=" + JSON.stringify(id) + "]');const checks=await Promise.all([" + JSON.stringify(["/auth/me","/cms/assets","/cms/layouts","/cms/playlists","/campaigns","/fleet/screens"]) + "].map(async path=>{try{const res=await fetch(" + JSON.stringify(apiUrl) + "+path,{credentials:'include'});return [path,res.status]}catch{return[path,'network-error']}}));return {panelStatus:root?.innerText.slice(0,450),apiStatuses:checks};})()");
        throw new Error('Authenticated real panel unavailable at '+path+': '+JSON.stringify(diagnostics));
      }
      if(await evaluate("Boolean(document.querySelector('[data-testid=" + JSON.stringify(id) + "] .real-ops-error'))"))
        throw new Error('Secured panel data load failed for '+path);
    }
    await navigate('/account');
    } else {
      // Bootstrap first-admin is intentionally unscoped. Do not silently
      // invent a tenant or expose global data through tenant-only APIs.
      for (const [path,id] of [['/cms','real-cms-operations'],['/campaigns','real-campaign-operations'],['/fleet','real-fleet-operations']]) {
        await navigate(path);
        await until("document.querySelector('[data-testid=" + JSON.stringify(id) + "]')?.innerText.includes('Organization context required')",path+' unscoped staff guidance');
        if(await evaluate("Boolean(document.querySelector('[data-testid=" + JSON.stringify(id) + "] .real-ops-panel'))"))
          throw new Error('Unscoped bootstrap admin received tenant data: '+path);
      }
      console.log('Chrome unscoped first-admin real operations denial PASS');
      await navigate('/account');
    }

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
    if (scopedOrganization) {
    // These mutations run only against CI's disposable MySQL. They prove
    // actual persistence and one-time secret hiding, not media approval or deployment.
    await navigate('/cms');
    await until("Boolean(document.querySelector('[data-testid=real-cms-operations] .real-ops-panel'))", 'CMS MySQL section ready');
    await click('[data-testid=real-cms-operations] .real-ops-panel:nth-child(2) button');
    await until("document.querySelector('[data-testid=real-cms-operations]')?.innerText.includes('Layout DRAFT saved to tenant-scoped MySQL')", 'real layout draft persisted');
    await navigate('/cms');
    await until("document.querySelector('[data-testid=real-cms-operations]')?.innerText.includes('Retail 3-Zone Layout') && document.querySelector('[data-testid=real-cms-operations]')?.innerText.includes('DRAFT')", 'real CMS layout survives page reload');

    await navigate('/fleet');
    await until("Boolean(document.querySelector('[data-testid=real-fleet-operations] .real-ops-panel'))", 'fleet MySQL section ready');
    await click('[data-testid=real-fleet-operations] form input');
    await command('Input.insertText', {text:'Browser Test Screen'});
    await click('[data-testid=real-fleet-operations] form button');
    await until("document.querySelector('[data-testid=real-fleet-operations]')?.innerText.includes('Screen registered in MySQL')", 'real screen registered');
    if(!await evaluate("Boolean(document.querySelector('[data-testid=real-fleet-operations] .real-ops-secret code'))"))throw new Error('One-time pairing code not displayed immediately after registration.');
    await click('[data-testid=real-fleet-operations] .real-ops-secret button');
    if(await evaluate("Boolean(document.querySelector('[data-testid=real-fleet-operations] .real-ops-secret'))"))throw new Error('Pairing code still visible after dismissal.');
    await navigate('/fleet');
    await until("document.querySelector('[data-testid=real-fleet-operations]')?.innerText.includes('Browser Test Screen')", 'real fleet screen survives page reload');
    if(await evaluate("Boolean(document.querySelector('[data-testid=real-fleet-operations] .real-ops-secret'))"))throw new Error('One-time pairing code reappeared on reload.');

    // Cross-page real MySQL continuity: saved Fleet record must appear in
    // Delivery, Scheduler and actual Playback report (never sample screens).
    await navigate('/delivery');
    await until("document.querySelector('[data-testid=delivery-api-state]')?.innerText.includes('Live API connected')", 'real delivery API');
    if (!await evaluate("document.body.innerText.includes('Browser Test Screen')"))
      throw new Error('Real registered fleet screen missing from delivery page.');
    if (await evaluate("document.body.innerText.includes('Mall Atrium Display')"))
      throw new Error('Sample delivery records leaked into live view.');
    await navigate('/scheduler');
    try {
      await until("document.querySelector('[data-testid=scheduler-api-state]')?.innerText.includes('Live API connected') && document.querySelector('[data-testid=scheduler-empty]')", 'live scheduler assignment state');
    } catch {
      // Only disclose response status and UI flags. Never emit screen ID, tenant or credentials.
      const state = await evaluate("(async()=>{const chosen=document.querySelector('select[aria-label=\\\"Registered screen\\\"]')?.value||'';const code=chosen?await fetch(" + JSON.stringify(apiUrl) + "+'/fleet/screens/'+encodeURIComponent(chosen)+'/playlists',{credentials:'include'}).then(r=>r.status).catch(()=>0):0;return {apiLabel:document.querySelector('[data-testid=scheduler-api-state] b')?.innerText,hasScreenSelect:Boolean(chosen),hasEmpty:Boolean(document.querySelector('[data-testid=scheduler-empty]')),playlistsHttp:code,at:location.pathname};})()");
      throw new Error('Live scheduler assignment state missing: ' + JSON.stringify(state));
    }
    if (!await evaluate("document.body.innerText.includes('Browser Test Screen')"))
      throw new Error('Real registered fleet screen missing from scheduler selection.');
    await navigate('/playback');
    await until("document.querySelector('[data-testid=playback-api-state]')?.innerText.includes('Live API connected')", 'live accepted playback report');
    if (!await evaluate("document.querySelector('[data-testid=playback-empty]')?.innerText.includes('No accepted plays')"))
      throw new Error('New tenant should have no accepted play records.');
    if (await evaluate("document.body.innerText.includes('Summer Collection 15s.mp4')"))
      throw new Error('Sample playback ledger leaked into live view.');
    console.log('Chrome live Delivery / Scheduler / Playback tenant data PASS');

    await navigate('/campaigns');
    await until("Boolean(document.querySelector('[data-testid=real-campaign-operations] .real-ops-panel'))", 'campaign MySQL section ready');
    if(await evaluate("document.querySelector('[data-testid=real-campaign-operations] form button')?.disabled !== true"))
      throw new Error('Campaign draft creation is enabled without an independently READY creative.');
    console.log('Chrome real CMS/fleet MySQL persistence + campaign fail-closed PASS');
    await navigate('/account');
    } else {
      console.log('Unscoped bootstrap admin: no CMS/fleet tenant mutations performed');
    }
    // A one-time MFA setup screen contains a real TOTP secret + recovery codes.
    // Never upload screenshots of that DOM to CI artifacts, even with test accounts.
    await navigate('/account');
    await until("document.querySelector('[data-testid=mfa-status]')?.innerText.includes('Enabled')", 'fresh account MFA status');
    if (await evaluate("Boolean(document.querySelector('[data-testid=mfa-setup-output]'))"))
      throw new Error('One-time MFA secrets persisted after route reload; refusing screenshot.');
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
  // Signed-out users must not render the operations shell even at mobile widths.
  await command('Page.navigate', { url: new URL('/cms', webUrl).toString() });
  await until("location.pathname === '/login'", 'post-logout protected route redirect');
  if (await evaluate("Boolean(document.querySelector('[data-testid=app-sidebar]'))"))
    throw new Error('Operations sidebar leaked after logout.');
  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await navigate('/login'); await screenshot('mobile-login');
  await navigate('/join'); await screenshot('mobile-join');
  results.push({ sidebarNavigation: 'PASS', browserRequiredLoginValidation: 'PASS', unauthorizedApiStatus: apiStatus, mobileViewport: '390x844' }); writeFileSync(join(artifact, 'results.json'), JSON.stringify(results, null, 2) + '\n');
}
try { await run(); console.log('ADFLICK BROWSER UAT PASS; evidence at ' + artifact); } catch (error) { console.error('ADFLICK BROWSER UAT FAIL: ' + (error instanceof Error ? error.message : String(error))); process.exitCode = 1; } finally { try { socket?.close(); } catch {} if (chrome?.pid) { try { process.kill(-chrome.pid, 'SIGTERM'); } catch { try { chrome.kill('SIGTERM'); } catch {} } } for (const item of pending.values()) { clearTimeout(item.timeout); item.reject(new Error('Browser shutting down.')); } pending.clear(); try { rmSync(profile, { recursive: true, force: true }); } catch {} }
