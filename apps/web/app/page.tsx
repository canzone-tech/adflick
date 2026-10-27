import Link from 'next/link';

const areas = [
  {
    title: 'Campaigns & media',
    description: 'Manage campaigns, playlists and screen layouts. API persistence and operator access must be verified for each workflow.',
    href: '/campaigns',
    action: 'Go to campaigns',
  },
  {
    title: 'Screen fleet & delivery',
    description: 'Access device operations, heartbeat health and playback evidence. Physical player acceptance is still required.',
    href: '/health',
    action: 'View player health',
  },
  {
    title: 'Finance & reconciliation',
    description: 'Review the existing screen-owner reward and audit controls. Live payouts are disabled pending authorization.',
    href: '/finance',
    action: 'Open finance',
  },
  {
    title: 'Identity & security',
    description: 'Manage your organization session and multi-factor authentication through the secured API.',
    href: '/account',
    action: 'Open account security',
  },
];

export default function HomePage() {
  return (
    <main className="app-home">
      <p className="eyebrow">ADFLICK / OPERATIONS</p>
      <h1>Workspace overview</h1>
      <p>This workspace brings advertising, devices and operational controls into one navigation system. Features use server-side access controls; the presence of a screen does not mean the associated workflow is production-accepted.</p>
      <section className="app-home-grid" aria-label="Workspace areas">
        {areas.map(area => (
          <article className="app-home-card" key={area.href}>
            <h2>{area.title}</h2>
            <p>{area.description}</p>
            <Link href={area.href}>{area.action}</Link>
          </article>
        ))}
      </section>
      <p className="app-home-notice">Client SRS v1.0 includes member enrollment, binary genealogy and e-PIN workflows which are not yet integrated. Commercial policies and production deployment require separate approval.</p>
    </main>
  );
}
