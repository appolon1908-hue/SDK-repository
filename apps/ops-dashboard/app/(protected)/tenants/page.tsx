import { buildTenantActivityFixtures, buildTenantFixtures } from "@codestra/apps-shared/fixtures";
import { DataTable, StatusPill } from "@codestra/apps-shared/ui";

// Auth is enforced by `app/(protected)/layout.tsx`; this page only renders.
export default function TenantActivityPage(): JSX.Element {
  const tenants = buildTenantFixtures();
  const activity = buildTenantActivityFixtures();
  const activityByTenant = new Map(activity.map((entry) => [entry.tenantId, entry]));

  return (
    <div>
      <h1>Tenant activity</h1>
      <p className="cds-page-subtitle">
        Cross-tenant activity summary for operators. Mock data -- neither tenant provisioning nor an activity
        feed is part of the current public contract; see the admin console for tenant/user management.
      </p>
      <DataTable
        rows={tenants}
        getRowKey={(row) => row.id}
        columns={[
          { key: "name", header: "Tenant", render: (row) => row.name },
          { key: "plan", header: "Plan", render: (row) => row.plan },
          { key: "status", header: "Status", render: (row) => <StatusPill status={row.status} /> },
          {
            key: "posts",
            header: "Posts (24h)",
            render: (row) => activityByTenant.get(row.id)?.socialPostsLast24h ?? 0,
            align: "right",
          },
          {
            key: "deliveries",
            header: "Deliveries (24h)",
            render: (row) => activityByTenant.get(row.id)?.webhookDeliveriesLast24h ?? 0,
            align: "right",
          },
          {
            key: "lastActivity",
            header: "Last activity",
            render: (row) => {
              const entry = activityByTenant.get(row.id);
              return entry ? new Date(entry.lastActivityAt).toLocaleString() : "—";
            },
          },
        ]}
      />
    </div>
  );
}
