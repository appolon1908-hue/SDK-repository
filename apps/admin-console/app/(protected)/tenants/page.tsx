import { DataTable, StatusPill } from "@codestra/apps-shared/ui";
import { listTenants } from "../../../lib/tenant-store";
import { createTenantAction } from "./actions";

export default function TenantsPage(): JSX.Element {
  const tenants = listTenants();

  return (
    <div>
      <h1>Tenants</h1>
      <p className="cds-page-subtitle">
        Tenant provisioning. Mock data -- <code>@codestra/contracts</code> has no <code>Tenant</code> type yet;
        this is this app&apos;s own model (see <code>@codestra/apps-shared/fixtures/tenants.ts</code>), ready to
        swap for a real Middleware tenant-provisioning API.
      </p>

      <section className="cds-section">
        <h2>Create tenant</h2>
        <form className="cds-form" action={createTenantAction}>
          <label htmlFor="name">Name</label>
          <input id="name" name="name" type="text" required minLength={1} />

          <label htmlFor="plan">Plan</label>
          <select id="plan" name="plan" defaultValue="starter">
            <option value="starter">Starter</option>
            <option value="growth">Growth</option>
            <option value="enterprise">Enterprise</option>
          </select>

          <div className="cds-form-actions">
            <button type="submit" className="cds-button-primary">
              Create tenant
            </button>
          </div>
        </form>
      </section>

      <section className="cds-section">
        <h2>All tenants</h2>
        <DataTable
          rows={tenants}
          getRowKey={(row) => row.id}
          columns={[
            {
              key: "name",
              header: "Tenant",
              render: (row) => <a href={`/tenants/${row.id}`}>{row.name}</a>,
            },
            { key: "plan", header: "Plan", render: (row) => row.plan },
            { key: "status", header: "Status", render: (row) => <StatusPill status={row.status} /> },
            { key: "createdAt", header: "Created", render: (row) => new Date(row.createdAt).toLocaleString() },
          ]}
        />
      </section>
    </div>
  );
}
