import { mkdirSync, appendFileSync } from 'node:fs';

const argv = process.argv.join(' ');
if (argv.includes('scripts/browser-uat.mjs')) {
  const RealDate = Date;
  const realNow = RealDate.now.bind(RealDate);
  globalThis.Date = class StableDate extends RealDate {
    static now() {
      const now = realNow();
      return Math.floor(now / 30_000) * 30_000 + 15_000;
    }
  };

  mkdirSync('.adflick-uat', { recursive: true });
  const RealWebSocket = globalThis.WebSocket;
  if (RealWebSocket) {
    globalThis.WebSocket = class DiagnosticWebSocket extends RealWebSocket {
      constructor(...args) {
        super(...args);
        this.addEventListener('message', event => {
          const text = String(event.data);
          if (/MFA enabled|Invalid MFA code|MFA confirmation|enroll\/confirm|mfaMessage/i.test(text)) {
            appendFileSync('.adflick-uat/cdp-mfa.log', text.slice(-5000) + '\n');
          }
        });
      }
    };
  }
}
