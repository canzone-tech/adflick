import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MediaVerificationService } from './cms/media-verification.service';

/** Source-free compiled worker entrypoint, never a public API or cron job. */
async function main() {
  if (process.env.MEDIA_VERIFICATION_ENABLED !== '1') throw new Error('MEDIA_VERIFICATION_ENABLED=1 required.');
  if (process.env.NODE_ENV === 'production') throw new Error('Production media worker requires separate operator/release approval.');
  const [organizationId, assetId] = process.argv.slice(2);
  if (!organizationId || !assetId || process.argv.length !== 4) {
    throw new Error('Usage: node dist/media-verification.runner.js <organizationId> <assetId>');
  }
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    const result = await app.get(MediaVerificationService).verifyOne(organizationId, assetId);
    console.log(JSON.stringify(result));
  } finally { await app.close(); }
}
void main().catch(error => {
  console.error('Trusted image verification failed:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
