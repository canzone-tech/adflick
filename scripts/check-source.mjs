#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];
const schemaPath = path.join(root, 'prisma/schema.prisma');
const schema = fs.readFileSync(schemaPath, 'utf8');
const provider = schema.match(/datasource\s+db\s*\{[\s\S]*?provider\s*=\s*"([^"]+)"/i)?.[1];
if (provider !== 'mysql') errors.push(`Expected Prisma datasource provider "mysql"; found ${provider ?? 'none'}.`);
if (!schema.includes('url      = env("DATABASE_URL")')) errors.push('Prisma datasource must read DATABASE_URL from the environment.');
if (!schema.includes('model NotificationOutbox {') || !schema.includes('enum NotificationOutboxStatus {')) errors.push('Durable notification outbox model/status enum are missing.');

for (const relative of ['package.json', 'apps/api/package.json', 'apps/web/package.json', 'packages/shared/package.json']) {
  try { JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8')); }
  catch { errors.push(`Invalid or missing JSON package file: ${relative}`); }
}
const migrations = path.join(root, 'prisma/migrations');
if (!fs.existsSync(migrations)) errors.push('Prisma migrations directory is missing.');
else {
  const migrationFolders = fs.readdirSync(migrations, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  for (const folder of migrationFolders) {
    const sqlPath = path.join(migrations, folder.name, 'migration.sql');
    if (!fs.existsSync(sqlPath)) errors.push(`Migration folder lacks migration.sql: ${folder.name}`);
  }
}
if (errors.length) {
  errors.forEach((error) => console.error(`FAIL: ${error}`));
  process.exitCode = 1;
} else {
  console.log('Static source checks passed: MySQL provider, environment-based DB URL, notification outbox model, package JSON, migration file structure.');
}
