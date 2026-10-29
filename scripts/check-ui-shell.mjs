import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root,file),'utf8');
const required = [
  'apps/web/components/app-chrome.tsx',
  'apps/web/app/app-chrome.css',
  'apps/web/app/layout.tsx',
  'scripts/browser-uat.mjs',
  'apps/web/middleware.ts',
];
for (const file of required) {
  if (!fs.existsSync(path.join(root,file))) throw new Error('Missing canonical UI shell: '+file);
}
const shell = read('apps/web/components/app-chrome.tsx');
const layout = read('apps/web/app/layout.tsx');
const globals = read('apps/web/app/globals.css');
if (globals.includes('.screen-card{') || globals.includes('.sidebar{') || globals.includes('.topbar{')) throw new Error('Retired homepage CSS must not leak into other workspace pages.');
const browser = read('scripts/browser-uat.mjs');
const accessGuard = read('apps/web/middleware.ts');
for (const token of ["'/login'", "'/join'", "request.cookies.get(name)", "/auth/me", "loginRedirect(request)", "matcher:", "no-store"]) {
  if (!accessGuard.includes(token)) throw new Error('Missing pre-render authenticated workspace enforcement: ' + token);
}
if (!browser.includes('Chrome guest workspace pre-render redirects PASS') ||
    !browser.includes('Forged session cookie passed workspace gate.')) {
  throw new Error('Real-browser unauthenticated workspace redirects must be tested.');
}
if (!shell.includes("pathname === '/login' || pathname === '/join'")) throw new Error('Public Join Now must remain outside operations chrome.');
if (!layout.includes('<AppChrome>{children}</AppChrome>') || !layout.includes("import './app-chrome.css'")) {
  throw new Error('All operations pages must receive the central AppChrome in root layout.');
}
for (const route of ['/','/cms','/campaigns','/delivery','/scheduler','/fleet','/playback','/health','/incidents','/finance','/finance/payouts','/account','/communications','/email-verification','/phone-verification','/member-dashboard','/member-onboarding','/member-operations']) {
  if (!shell.includes("href: '"+route+"'")) throw new Error('Missing canonical navigation route '+route);
  if (!browser.includes("'"+route+"'")) throw new Error('Browser layout test must cover '+route);
}
for (const control of ['aria-current','aria-expanded','aria-controls','app-skip-link','app-menu-toggle','app-backdrop','handleDrawerKeyDown','Escape']) {
  if (!shell.includes(control)) throw new Error('Missing accessible shell control: '+control);
}
for (const test of ['Emulation.setDeviceMetricsOverride', 'app-topbar', 'app-sidebar', "['/login','/join'].includes(path)"]) {
  if (!browser.includes(test)) throw new Error('Missing real-browser shell regression: '+test);
}
// Validate required handset, tablet and desktop widths semantically instead of
// matching one exact array string (which rejects stronger viewport coverage).
const viewportLine = browser.split(String.fromCharCode(10)).find(line => line.includes('for (const width of ['));
const viewports = new Set((viewportLine?.split('[')[1]?.split(']')[0] ?? '').split(',').map(Number));
for (const width of [320, 360, 390, 412, 768, 1280]) {
  if (!viewports.has(width)) throw new Error('Missing real-browser shell regression width: '+width);
}
const pages = [
  'page.tsx','cms/page.tsx','campaigns/page.tsx','delivery/page.tsx','scheduler/page.tsx',
  'fleet/page.tsx','playback/page.tsx','health/page.tsx','incidents/page.tsx',
  'finance/page.tsx','finance/payouts/page.tsx','account/page.tsx',
  'communications/page.tsx','email-verification/page.tsx','phone-verification/page.tsx','member-dashboard/page.tsx','member-onboarding/page.tsx','member-operations/page.tsx','join/page.tsx',
];
for (const page of pages) {
  const content = read('apps/web/app/'+page);
  if (/className="(?:app-sidebar|sidebar|app-topbar|topbar)"/.test(content) || /aria-label="Main workspace"/.test(content)) throw new Error('Duplicated page-specific navigation shell in '+page);
}
console.log('Shared AppChrome contract PASS: all current operations routes, accessibility controls, and real-browser breakpoints covered.');
