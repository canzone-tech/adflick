// Shared bootstrap preflight: real interactive CLI and backend CI must run exactly
// the same owned persistent-MySQL migration path BEFORE Prisma queries/first user.
import { spawnSync } from 'node:child_process';
import { startPersistentDevMysql } from './local-dev-db.mjs';

export function prepareFirstAdminDatabase({
  startDatabase = startPersistentDevMysql,
  migrate = spawnSync,
  env = process.env
} = {}) {
  let db;
  try {
    db = startDatabase();
    const result = migrate('node_modules/.bin/prisma', ['migrate', 'deploy'], {
      env: { ...env, DATABASE_URL: db.url },
      shell: false, stdio: 'inherit', timeout: 120000, windowsHide: true
    });
    if (result.error || result.status !== 0) {
      throw new Error('Owned local-development MySQL migration failed; first admin was NOT created.');
    }
    return db;
  } catch (error) {
    db?.stop();
    throw error;
  }
}
