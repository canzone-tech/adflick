import { mkdirSync, appendFileSync } from 'node:fs';
const argv = process.argv.join(' ');
if (argv.includes('scripts/browser-uat.mjs')) {
  const RealDate = Date;
  const realNow = RealDate.now.bind(RealDate);
  globalThis.Date = class StableDate extends RealDate {
    static now() { return Math.floor(realNow() / 30_000) * 30_000 + 15_000; }
  };
  mkdirSync('.adflick-uat', { recursive: true });
  const RealWebSocket = globalThis.WebSocket;
  if (RealWebSocket) {
    globalThis.WebSocket = class DiagnosticWebSocket extends RealWebSocket {
      constructor(...args) {
        super(...args);
        this._diagNetwork = false;
        this.addEventListener('message', event => {
          try {
            const message = JSON.parse(String(event.data));
            if (message.method === 'Network.responseReceived' && /mfa|auth\/login/i.test(message.params?.response?.url ?? '')) {
              appendFileSync('.adflick-uat/cdp-mfa.log', JSON.stringify({ url: message.params.response.url, status: message.params.response.status }) + '\n');
            }
          } catch {}
        });
      }
      send(data) {
        try {
          const message = JSON.parse(String(data));
          if (message.method === 'Runtime.enable' && !this._diagNetwork) {
            this._diagNetwork = true;
            setTimeout(() => super.send(JSON.stringify({ id: 900001, method: 'Network.enable', params: {} })), 0);
          }
        } catch {}
        return super.send(data);
      }
    };
  }
}
