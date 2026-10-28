import fs from 'node:fs';
import path from 'node:path';

const required = [
  'apps/api/src/cms/cms.tenant-isolation.spec.ts',
  'apps/api/src/devices/devices.tenant-isolation.spec.ts',
  'apps/api/src/playback/playback.tenant-isolation.spec.ts',
  'apps/api/src/devices/devices.service.ts',
  'docs/BATCH-HISTORY.md',
  'docs/BATCH-HISTORY.md',
];
for (const file of required) {
  if (!fs.existsSync(path.join(process.cwd(), file))) {
    console.error(`Missing Contract transaction-integrity file: ${file}`);
    process.exitCode = 1;
  }
}
const schema = fs.readFileSync(path.join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
if (!/provider\s*=\s*"mysql"/.test(schema)) {
  console.error('Prisma provider must remain MySQL.');
  process.exitCode = 1;
}
const device = fs.readFileSync(path.join(process.cwd(), 'apps/api/src/devices/devices.service.ts'), 'utf8');
if (!device.includes('where: { id: screen.id, organizationId }')) {
  console.error('Device status mutation must include organization scope.');
  process.exitCode = 1;
}
const specs = [
  ['apps/api/src/cms/cms.tenant-isolation.spec.ts', 'screenLayout.update'],
  ['apps/api/src/devices/devices.tenant-isolation.spec.ts', 'organizationId: \'org-a\''],
  ['apps/api/src/playback/playback.tenant-isolation.spec.ts', 'playbackEvent.groupBy'],
];
for (const [file, token] of specs) {
  const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
  if (!source.includes(token)) {
    console.error(`Contract transaction-integrity regression spec ${file} missing ${token}`);
    process.exitCode = 1;
  }
}
const jestConfig = fs.readFileSync('apps/api/jest.config.cjs', 'utf8');
const apiPkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'apps/api/package.json'), 'utf8'));
if (!apiPkg.scripts?.test?.includes('--config ./jest.config.cjs') || !jestConfig.includes('ts-jest') || !jestConfig.includes('testRegex')) {
  console.error('Jest must discover TypeScript specs.');
  process.exitCode = 1;
}
if (!process.exitCode) console.log('Contract transaction-integrity static checks passed.');
