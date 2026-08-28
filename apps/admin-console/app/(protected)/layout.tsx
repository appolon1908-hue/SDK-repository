import type { ReactNode } from "react";
import { requireStubSession } from "@codestra/apps-shared/auth";
import { AppShell, type NavItem } from "@codestra/apps-shared/ui/AppShell";

const NAV_ITEMS: readonly NavItem[] = [{ href: "/tenants", label: "Tenants" }];

export default function ProtectedLayout({ children }: { children: ReactNode }): JSX.Element {
  const session = requireStubSession();
  return (
    <AppShell appName="Admin Console" navItems={NAV_ITEMS} session={session}>
      {children}
    </AppShell>
  );
}
