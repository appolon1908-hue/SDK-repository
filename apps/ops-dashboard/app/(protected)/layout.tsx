import type { ReactNode } from "react";
import { requireStubSession } from "@codestra/apps-shared/auth";
import { AppShell, type NavItem } from "@codestra/apps-shared/ui/AppShell";

const NAV_ITEMS: readonly NavItem[] = [
  { href: "/connector-health", label: "Connector health" },
  { href: "/webhook-deliveries", label: "Webhook deliveries" },
  { href: "/tenants", label: "Tenant activity" },
];

export default async function ProtectedLayout({ children }: { children: ReactNode }): Promise<JSX.Element> {
  const session = await requireStubSession();
  return (
    <AppShell appName="Ops Dashboard" navItems={NAV_ITEMS} session={session}>
      {children}
    </AppShell>
  );
}
