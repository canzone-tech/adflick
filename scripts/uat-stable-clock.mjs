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

  const RealWebSocket = globalThis.WebSocket;
  if (RealWebSocket) {
    globalThis.WebSocket = class StableInputWebSocket extends RealWebSocket {
      send(data) {
        try {
          const message = JSON.parse(String(data));
          if (message?.method === 'Input.insertText') {
            setTimeout(() => super.send(data), 75);
            return;
          }
        } catch {}
        return super.send(data);
      }
    };
  }
}
