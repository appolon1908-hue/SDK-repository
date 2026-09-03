import { notFound } from "next/navigation";
import { buildIdentityProviderConfigFixture, buildSmtpConfigFixture } from "@codestra/apps-shared/fixtures";
import { DataTable, ExternalConfigPanel, StatusPill } from "@codestra/apps-shared/ui";
import { getTenant, listTenantUsers } from "../../../../lib/tenant-store";

export default async function TenantDetailPage({ params }: { params: Promise<{ tenantId: string }> }): Promise<JSX.Element> {
  const { tenantId } = await params;
  const tenant = getTenant(tenantId);
  if (!tenant) notFound();

  const users = listTenantUsers(tenant.id);
  const idp = buildIdentityProviderConfigFixture();
  const smtp = buildSmtpConfigFixture();

  return (
    <div>
      <h1>{tenant.name}</h1>
      <p className="cds-page-subtitle">
        Plan: {tenant.plan} &middot; Status: <StatusPill status={tenant.status} /> &middot; Created{" "}
        {new Date(tenant.createdAt).toLocaleString()}
      </p>

      <section className="cds-section">
        <h2>Users</h2>
        <DataTable
          rows={users}
          getRowKey={(row) => row.id}
          columns={[
            { key: "email", header: "Email", render: (row) => row.email },
            { key: "role", header: "Role", render: (row) => row.role },
            { key: "status", header: "Status", render: (row) => <StatusPill status={row.status} /> },
          ]}
        />
      </section>

      <ExternalConfigPanel
        title="Identity provider"
        ownedBy="Keycloak / OIDC (see docs/PRODUCTION_CONFIGURATION_CHECKLIST.md)"
        fields={[
          { label: "Issuer", value: idp.issuerUrl },
          { label: "Realm", value: idp.realm },
          { label: "Clients", value: idp.clientIds.join(", ") },
          { label: "MFA policy", value: idp.mfaPolicy },
          { label: "Status", value: idp.status.replace(/_/g, " ") },
        ]}
      />

      <ExternalConfigPanel
        title="SMTP / email"
        ownedBy="Middleware notification service (see docs/PRODUCTION_CONFIGURATION_CHECKLIST.md)"
        fields={[
          { label: "Sender domain", value: smtp.senderDomain },
          { label: "SPF", value: smtp.spfConfigured ? "Configured" : "Not configured" },
          { label: "DKIM", value: smtp.dkimConfigured ? "Configured" : "Not configured" },
          { label: "DMARC", value: smtp.dmarcConfigured ? "Configured" : "Not configured" },
          { label: "Status", value: smtp.status.replace(/_/g, " ") },
        ]}
      />
    </div>
  );
}
