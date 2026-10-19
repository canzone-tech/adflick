const modules = [
  { number: '01', title: 'Organizations & access', detail: 'JWT sessions and role checks; additional operator UAT pending', status: 'CI verified' },
  { number: '02', title: 'Screens & devices', detail: 'Fleet management API and UI; physical device UAT pending', status: 'Source present' },
  { number: '03', title: 'Media & layouts', detail: 'Interactive layout and playlist prototypes; saving requires authenticated API', status: 'Local preview' },
  { number: '04', title: 'Campaign delivery', detail: 'Campaign UI uses sample states; no real delivery or billing', status: 'Demo only' },
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
        <div className="sidebar-bottom"><span className="status-dot" /> UI demo · not live delivery</div>
      </aside>
      <section className="main">
        <header className="topbar"><div><span className="eyebrow">AJOOBA DIGITAL / ENGINEERING</span><h1>Playout control centre</h1></div><span className="env-pill">LOCAL DEV · NOT RELEASED</span></header>
        <section className="hero" id="overview">
          <div className="hero-copy"><span className="hero-tag">ENGINEERING PROTOTYPE · NOT LIVE</span><h2>Manage every screen.<br /><em>Deliver every play.</em></h2><p>Explore the local CMS and screen-operations prototypes. Saving, player delivery and finance require separate authentication and approvals.</p><a className="primary" href="/cms">Open CMS Studio <span>↗</span></a></div>
          <div className="hero-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="screen-card"><div className="screen-head"><i /><i /><i /><span>SCREEN MOCKUP</span></div><div className="screen-gradient"><b>A▶</b><small>YOUR BRAND HERE</small></div><div className="screen-foot"><span>DEVICE STATUS</span><strong>SIMULATED DISPLAY</strong></div></div><div className="floating-stat"><span className="status-dot" /> <span><b>Design preview</b><small>Browser-only interactions</small></span></div></div>
        </section>
        <section className="stats">
          <article><span className="stat-icon">▦</span><div><small>ROLE MODEL</small><strong>09</strong><span>Access-control tests in CI</span></div></article>
          <article><span className="stat-icon">▣</span><div><small>DB MIGRATIONS</small><strong>18</strong><span>Fresh MySQL 8.4 validated</span></div></article>
          <article><span className="stat-icon">◉</span><div><small>DATABASE</small><strong>MySQL 8.4</strong><span>Isolated local test schema</span></div></article>
          <article><span className="stat-icon">⌘</span><div><small>API BASE</small><strong>/api/v1</strong><span>API operations require access</span></div></article>
        </section>
        <section className="section" id="modules">
          <div className="section-heading"><div><span className="eyebrow">TECHNICAL STATUS</span><h2>Core platform modules</h2></div><span className="subtle">Source present; product UAT pending.</span></div>
          <div className="module-grid">{modules.map((module) => <article className="module-card" key={module.number}><div className="module-top"><span>{module.number}</span><span className={module.number === '01' ? 'mini-pill ready' : 'mini-pill'}>{module.status}</span></div><h3>{module.title}</h3><p>{module.detail}</p></article>)}</div>
        </section>
        <section className="foundation" id="foundation"><div><span className="eyebrow">LOCAL DEVELOPMENT STATUS</span><h2>Engineering foundation verified</h2><p>Compiled API, MySQL migrations and browser routes passed development checks. This dashboard is a sample interface; live TV playback, payout providers and operator sign-off remain pending.</p></div><div className="checklist"><div><span>✓</span> Monorepo & workspaces</div><div><span>✓</span> MySQL / Prisma schema</div><div><span>✓</span> API health endpoint</div><div><span>→</span> Authenticated operator UAT pending</div></div></section>
        <footer>ADFLICK PLAYOUT CMS <span>·</span> Local engineering preview v0.1.0 <span>·</span> Demo shell — not a production service</footer>
      </section>
    </main>
  );
}
