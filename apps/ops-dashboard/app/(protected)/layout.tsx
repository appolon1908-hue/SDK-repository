import type { ReactNode } from "react";
import { requireStubSession } from "@codestra/apps-shared/auth";
import { AppShell, type NavItem } from "@codestra/apps-shared/ui/AppShell";

const NAV_ITEMS: readonly NavItem[] = [
  { href: "/connector-health", label: "Connector health" },
  { href: "/webhook-deliveries", label: "Webhook deliveries" },
  { href: "/tenants", label: "Tenant activity" },
];

export default function ProtectedLayout({ children }: { children: ReactNode }): JSX.Element {
  const session = requireStubSession();
  return (
    <AppShell appName="Ops Dashboard" navItems={NAV_ITEMS} session={session}>
      {children}
    </AppShell>
  );
}
