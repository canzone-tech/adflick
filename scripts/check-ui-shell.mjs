import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root,file),'utf8');
const required = [
  'apps/web/components/app-chrome.tsx',
  'apps/web/app/app-chrome.css',
  'apps/web/app/layout.tsx',
  'scripts/browser-uat.mjs',
];
for (const file of required) {
  if (!fs.existsSync(path.join(root,file))) throw new Error('Missing canonical UI shell: '+file);
}
const shell = read('apps/web/components/app-chrome.tsx');
const layout = read('apps/web/app/layout.tsx');
const globals = read('apps/web/app/globals.css');
if (globals.includes('.screen-card{') || globals.includes('.sidebar{') || globals.includes('.topbar{')) throw new Error('Retired homepage CSS must not leak into other workspace pages.');
const browser = read('scripts/browser-uat.mjs');
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
for (const test of ['Emulation.setDeviceMetricsOverride', 'app-topbar', 'app-sidebar', '320, 390, 768, 1280', "['/login','/join'].includes(path)"]) {
  if (!browser.includes(test)) throw new Error('Missing real-browser shell regression: '+test);
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
