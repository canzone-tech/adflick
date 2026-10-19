import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';

const sha = process.env.RELEASE_SHA?.trim() || process.argv[2]?.trim();
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
if (!/^[0-9a-f]{40}$/.test(sha ?? '')) throw new Error('RELEASE_SHA must be a 40-character commit SHA.');
if (!apiBaseUrl) throw new Error('NEXT_PUBLIC_API_BASE_URL is required.');
const parsed = new URL(apiBaseUrl);
if (parsed.protocol !== 'https:') throw new Error('NEXT_PUBLIC_API_BASE_URL must use HTTPS for a production artifact.');
if (!parsed.pathname.endsWith('/')) parsed.pathname += '/';

const major = Number(process.versions.node.split('.')[0]);
if (major !== 24) throw new Error(`Release packaging requires Node.js 24; current ${process.version}`);

const root = process.cwd();
const stage = path.join(root, '.release-stage');
const innerDir = path.join(stage, 'runtime');
const migrationDir = path.join(stage, 'migrations');
const metadataDir = path.join(stage, 'metadata');
const outDir = path.join(root, 'release-artifacts');
fs.rmSync(stage, { recursive: true, force: true });
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(innerDir, { recursive: true });
fs.mkdirSync(migrationDir, { recursive: true });
fs.mkdirSync(metadataDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

const required = [
  'apps/api/dist/main.js',
  'apps/api/package.json',
  'apps/web/.next/standalone/apps/web/server.js',
  'apps/web/.next/static',
  'apps/web/public',
  'node_modules/.prisma/client',
  'prisma/migrations',
  'prisma/migration_lock.toml',
];
for (const item of required) {
  if (!fs.existsSync(path.join(root, item))) throw new Error(`Required build output missing: ${item}`);
}

function cp(from, to) {
  fs.cpSync(path.join(root, from), path.join(stage, to), { recursive: true });
}

// API runtime mirrors the source-free layout used by the production runtime image.
cp('package.json', 'runtime/package.json');
cp('apps/api/package.json', 'runtime/apps/api/package.json');
cp('apps/api/dist', 'runtime/apps/api/dist');
fs.mkdirSync(path.join(stage, 'runtime/packages/shared/dist'), { recursive: true });
execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsc', '--target', 'ES2022', '--module', 'commonjs', '--declaration', '--outDir', path.join(stage, 'runtime/packages/shared/dist'), 'packages/shared/src/index.ts'], { stdio: 'inherit' });
fs.writeFileSync(path.join(stage, 'runtime/packages/shared/package.json'), JSON.stringify({ name: '@adflick/shared', version: '0.1.0', private: true, main: 'dist/index.js', types: 'dist/index.d.ts' }, null, 2) + '\n');
execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['prune', '--omit=dev', '--no-audit', '--no-fund'], { stdio: 'inherit' });
cp('node_modules', 'runtime/node_modules');
cp('apps/web/.next/standalone', 'runtime/web');
cp('apps/web/.next/static', 'runtime/web/apps/web/.next/static');
cp('apps/web/public', 'runtime/web/apps/web/public');
cp('prisma/migrations', 'migrations/prisma/migrations');
cp('prisma/migration_lock.toml', 'migrations/prisma/migration_lock.toml');
cp('prisma/schema.prisma', 'migrations/prisma/schema.prisma');
cp('prisma.config.ts', 'migrations/prisma.config.ts');

for (const rootPath of ['runtime/apps/api/src', 'runtime/apps/web/app', 'runtime/packages/shared/src']) {
  if (fs.existsSync(path.join(stage, rootPath))) throw new Error(`Source directory leaked into artifact: ${rootPath}`);
}
for (const sourceArea of ['runtime/apps/api', 'runtime/packages/shared', 'runtime/web/apps/web']) {
  const area = path.join(stage, sourceArea);
  const runtimeLeaks = execFileSync('find', [area, '-type', 'f', '-name', '*.map', '-o', '-type', 'f', '-name', '*.ts', '-o', '-type', 'f', '-name', '*.tsx'], { encoding: 'utf8' }).trim();
  if (runtimeLeaks) throw new Error(`Source-like files leaked into runtime artifact staging (${sourceArea}):\n${runtimeLeaks}`);
}

const metadata = {
  project: 'ADFLICK',
  release_sha: sha,
  node_major: 24,
  api_base_url: parsed.toString(),
  artifact_type: 'compiled-source-free-runtime',
  migration_policy: 'separate-authorized-process',
};
fs.writeFileSync(path.join(metadataDir, 'release.json'), JSON.stringify(metadata, null, 2) + '\n');

const innerName = `adflick-runtime-${sha}.tar.gz`;
const innerPath = path.join(outDir, innerName);
execFileSync('tar', ['-czf', innerPath, '-C', stage, 'runtime', 'migrations', 'metadata'], { stdio: 'inherit' });
const innerSha = crypto.createHash('sha256').update(fs.readFileSync(innerPath)).digest('hex');
fs.writeFileSync(`${innerPath}.sha256`, `${innerSha}  ${innerName}\n`);

const outerName = `adflick-release-${sha}.zip`;
const outerPath = path.join(outDir, outerName);
execFileSync('zip', ['-q', outerPath, path.basename(innerPath), path.basename(`${innerPath}.sha256`), '-j'], { cwd: outDir, stdio: 'inherit' });
const outerSha = crypto.createHash('sha256').update(fs.readFileSync(outerPath)).digest('hex');
fs.writeFileSync(`${outerPath}.sha256`, `${outerSha}  ${outerName}\n`);

const manifest = {
  ...metadata,
  inner_archive: innerName,
  inner_sha256: innerSha,
  outer_archive: outerName,
  outer_sha256: outerSha,
};
fs.writeFileSync(path.join(outDir, 'release-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2));
