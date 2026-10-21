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
}
