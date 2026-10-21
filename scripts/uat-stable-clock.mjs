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
        this._mfaRequests = new Set();
        this.addEventListener('message', event => {
          try {
            const message = JSON.parse(String(event.data));
            if (message.method === 'Network.responseReceived' && /\/auth\/mfa\/(enroll|status|challenge|verify)/i.test(message.params?.response?.url ?? '')) {
              const requestId = message.params.response.requestId;
              this._mfaRequests.add(requestId);
              appendFileSync('.adflick-uat/cdp-mfa.log', JSON.stringify({ type: 'response', url: message.params.response.url, status: message.params.response.status }) + '\n');
            }
            if (message.method === 'Network.loadingFinished' && this._mfaRequests.has(message.params?.requestId)) {
              const requestId = message.params.requestId;
              setTimeout(() => super.send(JSON.stringify({ id: 900002, method: 'Network.getResponseBody', params: { requestId } })), 0);
            }
            if (message.id === 900002 && message.result?.body !== undefined) {
              appendFileSync('.adflick-uat/cdp-mfa.log', JSON.stringify({ type: 'body', body: message.result.body.slice(0, 1000) }) + '\n');
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
