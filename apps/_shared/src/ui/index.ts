// AppShell and StubLoginPage are deliberately NOT re-exported here. Both
// transitively import `next/headers` through ../auth/session.js and
// ../auth/actions.js; barrel-importing them from a "use client" component
// (e.g. WebhookSubscriptionsManager) pulls that server-only module graph
// into the client bundle and Next.js's build fails with "You're importing a
// component that needs next/headers". Server components (every
// (protected)/layout.tsx and login/page.tsx) import them directly from
// "@codestra/apps-shared/ui/AppShell" and "@codestra/apps-shared/ui/StubLoginPage"
// instead, so this barrel stays client-safe for everything else.
export { DataTable, type DataTableColumn, type DataTableProps } from "./DataTable.js";
export { ExternalConfigPanel, type ExternalConfigField, type ExternalConfigPanelProps } from "./ExternalConfigPanel.js";
export { StatTile, type StatTileProps } from "./StatTile.js";
export { StatusPill, type StatusPillProps, type StatusTone } from "./StatusPill.js";
