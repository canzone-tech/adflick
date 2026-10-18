import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import process from 'node:process';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const nodeMajor = Number(process.versions.node.split('.')[0]);
const npmVersion = execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim();
const npmMajor = Number(npmVersion.split('.')[0]);
const requiredNode = Number((pkg.engines?.node ?? '>=22').match(/\d+/)?.[0] ?? 22);
const requiredNpm = Number((pkg.engines?.npm ?? '>=10').match(/\d+/)?.[0] ?? 10);
let failed = false;
if (nodeMajor < requiredNode) { console.error(`Node ${process.versions.node} is below required major ${requiredNode}`); failed = true; }
if (npmMajor < requiredNpm) { console.error(`npm ${npmVersion} is below required major ${requiredNpm}`); failed = true; }
if (!Array.isArray(pkg.workspaces) || pkg.workspaces.length === 0) { console.error('Root workspace declaration is missing'); failed = true; }
for (const workspace of pkg.workspaces ?? []) {
  const path = `${workspace}/package.json`;
  if (!fs.existsSync(path)) { console.error(`Missing workspace manifest: ${path}`); failed = true; }
  else {
    const child = JSON.parse(fs.readFileSync(path, 'utf8'));
    if (!child.name) { console.error(`Workspace has no package name: ${path}`); failed = true; }
  }
}
if (process.env.CI && !fs.existsSync('package-lock.json')) {
  console.error('CI requires package-lock.json before npm ci'); failed = true;
}
if (!fs.existsSync('package-lock.json')) {
  console.warn('WARNING: package-lock.json is absent. CI can bootstrap a temporary lockfile, but cross-run dependency resolution is not pinned until the lockfile is committed.');
} else {
  const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
  if (lock.lockfileVersion !== 3) { console.error(`Expected npm lockfileVersion 3, got ${lock.lockfileVersion}`); failed = true; }
  if (!lock.packages?.['']) { console.error('Lockfile root package metadata missing'); failed = true; }
}
if (failed) process.exit(1);
console.log(`Dependency/runtime checks passed: Node ${process.versions.node}, npm ${npmVersion}, ${pkg.workspaces.length} workspaces.`);
