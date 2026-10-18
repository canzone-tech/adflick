const modules = [
  { number: '01', title: 'Organizations & access', detail: 'Multi-organization foundation and nine planned roles', status: 'Foundation' },
  { number: '02', title: 'Screens & devices', detail: 'Fleet inventory, pairing, health and remote commands', status: 'Next batches' },
  { number: '03', title: 'Media & layouts', detail: 'Validated assets, zones, playlists and schedules', status: 'Next batches' },
  { number: '04', title: 'Campaign delivery', detail: 'Approvals, targeting, proof of play and reporting', status: 'Next batches' },
];

export default function HomePage() {
  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">A▶</span><span><strong>ADFLICK</strong><small>PLAYOUT CMS</small></span></div>
        <div className="nav-label">WORKSPACE</div>
        <a className="nav active" href="#overview">◫ &nbsp; Overview</a>
        <a className="nav" href="#modules">▣ &nbsp; Modules</a>
        <a className="nav" href="/cms">✦ &nbsp; CMS Studio</a>
        <a className="nav" href="/fleet">▣ &nbsp; Screen Fleet</a>
        <a className="nav" href="/playback">◉ &nbsp; Proof of Play</a>
        <a className="nav" href="/campaigns">▤ &nbsp; Campaigns</a>
        <a className="nav" href="/delivery">▷ &nbsp; Delivery Engine</a>
        <a className="nav" href="/scheduler">◷ &nbsp; Scheduler & Playlists</a>
        <a className="nav" href="/health">♥ &nbsp; Player Health</a>
        <a className="nav" href="/incidents">⚑ &nbsp; Incidents & Alerts</a>
        <a className="nav" href="/finance">₹ &nbsp; Reward Finance</a>
        <a className="nav" href="/login">⇥ &nbsp; Sign in</a>
        <a className="nav" href="#foundation">⚙ &nbsp; Foundation</a>
        <div className="sidebar-bottom"><span className="status-dot" /> Local development scaffold</div>
      </aside>
      <section className="main">
        <header className="topbar"><div><span className="eyebrow">AJOOBA DIGITAL / ENGINEERING</span><h1>Playout control centre</h1></div><span className="env-pill">BATCH 01 · FOUNDATION</span></header>
        <section className="hero" id="overview">
          <div className="hero-copy"><span className="hero-tag">APPROVED PRODUCT BASELINE</span><h2>Manage every screen.<br /><em>Deliver every play.</em></h2><p>The engineering foundation for campaigns, device fleets, proof of play and screen-owner operations.</p><a className="primary" href="/cms">Open CMS Studio <span>↗</span></a></div>
          <div className="hero-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="screen-card"><div className="screen-head"><i /><i /><i /><span>LIVE PREVIEW</span></div><div className="screen-gradient"><b>A▶</b><small>YOUR BRAND HERE</small></div><div className="screen-foot"><span>DEVICE STATUS</span><strong>READY FOR PAIRING</strong></div></div><div className="floating-stat"><span className="status-dot" /> <span><b>CMS foundation</b><small>Services being connected</small></span></div></div>
        </section>
        <section className="stats">
          <article><span className="stat-icon">▦</span><div><small>PLANNED USER ROLES</small><strong>09</strong><span>Role matrix baseline</span></div></article>
          <article><span className="stat-icon">▣</span><div><small>CORE DATA MODELS</small><strong>07</strong><span>Initial schema scope</span></div></article>
          <article><span className="stat-icon">◉</span><div><small>DATABASE</small><strong>MySQL 8.4</strong><span>Prisma ORM</span></div></article>
          <article><span className="stat-icon">⌘</span><div><small>API BASE</small><strong>/api/v1</strong><span>NestJS service</span></div></article>
        </section>
        <section className="section" id="modules">
          <div className="section-heading"><div><span className="eyebrow">BUILD PLAN</span><h2>Core platform modules</h2></div><span className="subtle">Foundation first. Features next.</span></div>
          <div className="module-grid">{modules.map((module) => <article className="module-card" key={module.number}><div className="module-top"><span>{module.number}</span><span className={module.number === '01' ? 'mini-pill ready' : 'mini-pill'}>{module.status}</span></div><h3>{module.title}</h3><p>{module.detail}</p><div className="module-line"><span style={{ width: module.number === '01' ? '100%' : '10%' }} /></div></article>)}</div>
        </section>
        <section className="foundation" id="foundation"><div><span className="eyebrow">BATCH 01 STATUS</span><h2>Development scaffold</h2><p>This portal is a frontend foundation. API health checks and database connectivity are implemented in source; they become live once dependencies are installed and services are started.</p></div><div className="checklist"><div><span>✓</span> Monorepo & workspaces</div><div><span>✓</span> MySQL / Prisma schema</div><div><span>✓</span> API health endpoint</div><div><span>→</span> Authentication in Batch 02</div></div></section>
        <footer>ADFLICK PLAYOUT CMS <span>·</span> Engineering foundation v0.1.0 <span>·</span> Demo shell — not a production service</footer>
      </section>
    </main>
  );
}
