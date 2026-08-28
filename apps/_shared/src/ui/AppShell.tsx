import type { ReactNode } from "react";
import { isMockApiMode } from "../env.js";
import { clearStubSession } from "../auth/actions.js";
import type { StubSession } from "../auth/session.js";

export interface NavItem {
  href: string;
  label: string;
}

export interface AppShellProps {
  appName: string;
  navItems: readonly NavItem[];
  session: StubSession;
  children: ReactNode;
}

export function AppShell({ appName, navItems, session, children }: AppShellProps): JSX.Element {
  const mock = isMockApiMode();
  return (
    <div className="cds-shell">
      <a className="cds-skip-link" href="#cds-main">
        Skip to content
      </a>
      <header className="cds-header">
        <div className="cds-header-title">
          <span className="cds-logo">Codestra</span>
          <span className="cds-app-name">{appName}</span>
        </div>
        <nav className="cds-nav" aria-label="Primary">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} className="cds-nav-link">
              {item.label}
            </a>
          ))}
        </nav>
        <form action={clearStubSession} className="cds-session">
          <span className="cds-session-label">
            {session.subject} &middot; tenant {session.tenantId.slice(0, 8)}
          </span>
          <button type="submit" className="cds-button-ghost">
            Sign out
          </button>
        </form>
      </header>
      {mock ? (
        <div className="cds-mock-banner" role="status">
          Demo data: NEXT_PUBLIC_CODESTRA_API_URL is not set, so this app is reading and writing an in-memory
          mock API client instead of a real Codestra Middleware deployment.
        </div>
      ) : null}
      <main id="cds-main" className="cds-main">
        {children}
      </main>
    </div>
  );
}
