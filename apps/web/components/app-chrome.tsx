'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode, type KeyboardEvent } from 'react';

/**
 * The single navigation contract for the ADFLICK operations workspace.
 * Public pages must be explicitly routed outside this shell when the
 * SRS-approved marketing site is implemented; never build a second sidebar.
 */
export const WORKSPACE_LINKS = [
  { href: '/', label: 'Overview', symbol: '▦', section: 'Workspace' },
  { href: '/cms', label: 'CMS Studio', symbol: '▧', section: 'Advertising' },
  { href: '/campaigns', label: 'Campaigns', symbol: '▤', section: 'Advertising' },
  { href: '/delivery', label: 'Delivery', symbol: '▷', section: 'Advertising' },
  { href: '/scheduler', label: 'Scheduling', symbol: '◷', section: 'Advertising' },
  { href: '/fleet', label: 'Screen Fleet', symbol: '▣', section: 'Devices' },
  { href: '/playback', label: 'Proof of Play', symbol: '◉', section: 'Devices' },
  { href: '/health', label: 'Player Health', symbol: '♥', section: 'Devices' },
  { href: '/incidents', label: 'Incidents', symbol: '⚑', section: 'Devices' },
  { href: '/finance', label: 'Reward Finance', symbol: '₹', section: 'Finance' },
  { href: '/finance/payouts', label: 'Reconciliation', symbol: '≡', section: 'Finance' },
  { href: '/account', label: 'Account & MFA', symbol: '◎', section: 'Account' },
] as const;

export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);

  // The login page is public. No operations chrome is shown around the login form.
  if (pathname === '/login') return <>{children}</>;
  return <WorkspaceShell
    pathname={pathname}
    mobileOpen={mobileOpen}
    setMobileOpen={setMobileOpen}
    toggleRef={toggleRef}
    navRef={navRef}
  >{children}</WorkspaceShell>;
}

type WorkspaceProps = {
  children: ReactNode;
  pathname: string;
  mobileOpen: boolean;
  setMobileOpen: (value: boolean) => void;
  toggleRef: React.RefObject<HTMLButtonElement | null>;
  navRef: React.RefObject<HTMLElement | null>;
};

function WorkspaceShell({ children, pathname, mobileOpen, setMobileOpen, toggleRef, navRef }: WorkspaceProps) {
  const active = WORKSPACE_LINKS.findLast((link) => link.href === pathname)
    ?? WORKSPACE_LINKS.find((link) => link.href !== '/' && pathname.startsWith(link.href + '/'))
    ?? WORKSPACE_LINKS[0];
  const closeNavigation = () => setMobileOpen(false);

  useEffect(() => {
    // Close the drawer and clear the mobile menu on every route change.
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [mobileOpen, setMobileOpen, toggleRef]);

  useEffect(() => {
    if (mobileOpen && window.matchMedia('(max-width: 860px)').matches) {
      navRef.current?.querySelector<HTMLAnchorElement>('.app-nav-item[aria-current="page"]')?.focus();
    }
  }, [mobileOpen, navRef]);

  function handleDrawerKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Tab' || !mobileOpen || !window.matchMedia('(max-width: 860px)').matches) return;
    const links = Array.from(navRef.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])') ?? []);
    if (!links.length) return;
    const first = links[0];
    const last = links[links.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first?.focus();
    }
  }

  return (
    <div className="app-shell" data-testid="app-shell">
      <a className="app-skip-link" href="#app-page-content">Skip to page content</a>
      {mobileOpen && <button className="app-backdrop" type="button" aria-label="Close navigation" onClick={closeNavigation} data-testid="app-backdrop" />}
      <aside className={'app-sidebar' + (mobileOpen ? ' app-sidebar-open' : '')} aria-label="Workspace navigation" id="app-main-navigation" ref={navRef} onKeyDown={handleDrawerKeyDown} data-testid="app-sidebar">
        <Link className="app-brand" href="/" onClick={closeNavigation} aria-label="ADFLICK workspace overview">
          <span className="app-brand-mark" aria-hidden="true">A▶</span>
          <span><strong>ADFLICK</strong><small>OPERATIONS</small></span>
        </Link>
        <nav aria-label="Main workspace">
          {Array.from(new Set(WORKSPACE_LINKS.map(link => link.section))).map(section => (
            <div className="app-nav-section" key={section}>
              <p className="app-nav-heading">{section}</p>
              {WORKSPACE_LINKS.filter(link => link.section === section).map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeNavigation}
                  className={'app-nav-item' + (link.href === active.href ? ' app-nav-active' : '')}
                  aria-current={link.href === active.href ? 'page' : undefined}
                >
                  <span className="app-nav-symbol" aria-hidden="true">{link.symbol}</span>
                  <span>{link.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="app-sidebar-footer">
          <Link href="/account" onClick={closeNavigation}>Security &amp; account</Link>
          <span>Workspace access requires a valid session for protected APIs.</span>
        </div>
      </aside>
      <div className="app-workspace">
        <header className="app-topbar" data-testid="app-topbar">
          <div className="app-topbar-leading">
            <button
              ref={toggleRef}
              className="app-menu-toggle"
              type="button"
              data-testid="app-menu-toggle"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              aria-controls="app-main-navigation"
              onClick={() => setMobileOpen(!mobileOpen)}
            ><span aria-hidden="true">☰</span></button>
            <div className="app-crumbs">
              <span className="app-crumb-root">ADFLICK / {active.section}</span>
              <strong>{active.label}</strong>
            </div>
          </div>
          <Link className="app-topbar-account" href="/account" aria-label="Account and multi-factor security">Account &amp; security</Link>
        </header>
        <div id="app-page-content" className="app-page" data-testid="app-page-content">
          {children}
        </div>
      </div>
    </div>
  );
}
