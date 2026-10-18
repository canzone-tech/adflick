import fs from 'node:fs';
import path from 'node:path';

const required = [
  'apps/api/src/cms/cms.tenant-isolation.spec.ts',
  'apps/api/src/devices/devices.tenant-isolation.spec.ts',
  'apps/api/src/playback/playback.tenant-isolation.spec.ts',
  'apps/api/src/devices/devices.service.ts',
  'docs/BATCH_24_AUTHORIZATION_COVERAGE_AND_REMEDIATION.md',
  'docs/BATCH_24_AUTHORIZATION_TEST_MATRIX.csv',
];
for (const file of required) {
  if (!fs.existsSync(path.join(process.cwd(), file))) {
    console.error(`Missing Batch 24 file: ${file}`);
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
    console.error(`Batch 24 regression spec ${file} missing ${token}`);
    process.exitCode = 1;
  }
}
const apiPkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'apps/api/package.json'), 'utf8'));
if (!apiPkg.jest || apiPkg.jest.testRegex !== '.*\\.spec\\.ts$') {
  console.error('Jest must discover TypeScript specs.');
  process.exitCode = 1;
}
if (!process.exitCode) console.log('Batch 24 static checks passed.');
