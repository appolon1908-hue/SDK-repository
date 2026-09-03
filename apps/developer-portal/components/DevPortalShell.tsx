import type { ReactNode } from "react";
import { clearStubSession } from "@codestra/apps-shared/auth";
import type { StubSession } from "@codestra/apps-shared/auth";
import { isMockApiMode } from "@codestra/apps-shared";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/docs/api-reference", label: "API reference" },
  { href: "/docs/events", label: "Event catalogue" },
  { href: "/webhooks", label: "Webhooks" },
  { href: "/credentials", label: "Credentials" },
] as const;

export function DevPortalShell({ session, children }: { session: StubSession | null; children: ReactNode }): JSX.Element {
  const mock = isMockApiMode();
  return (
    <div className="cds-shell">
      <a className="cds-skip-link" href="#cds-main">
        Skip to content
      </a>
      <header className="cds-header">
        <div className="cds-header-title">
          <span className="cds-logo">Codestra</span>
          <span className="cds-app-name">Developer portal</span>
        </div>
        <nav className="cds-nav" aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <a key={item.href} href={item.href} className="cds-nav-link">
              {item.label}
            </a>
          ))}
        </nav>
        {session ? (
          <form action={clearStubSession} className="cds-session">
            <span className="cds-session-label">
              {session.subject} &middot; tenant {session.tenantId.slice(0, 8)}
            </span>
            <button type="submit" className="cds-button-ghost">
              Sign out
            </button>
          </form>
        ) : (
          <a href="/login" className="cds-button-primary" style={{ textDecoration: "none" }}>
            Sign in
          </a>
        )}
      </header>
      {mock ? (
        <div className="cds-mock-banner" role="status">
          Demo data: NEXT_PUBLIC_CODESTRA_API_URL is not set, so webhooks and credentials read and write an
          in-memory mock API client instead of a real Codestra Middleware deployment. The API reference and
          event catalogue below are always live-rendered from the real contract files.
        </div>
      ) : null}
      <main id="cds-main" className="cds-main">
        {children}
      </main>
    </div>
  );
}
