import { requireStubSession } from "@codestra/apps-shared/auth";
import { buildApiCredentialFixture } from "@codestra/apps-shared/fixtures";

export default async function CredentialsPage(): Promise<JSX.Element> {
  const session = await requireStubSession();
  const credential = buildApiCredentialFixture(session.tenantId);

  return (
    <div>
      <h1>API credentials</h1>
      <p className="cds-page-subtitle">
        Your tenant&apos;s own credentials only -- this page never lists another tenant&apos;s token. Mock data:
        there is no public API operation to read back tokens yet; requests are authenticated with the bearer
        token from your OIDC session per <code>security: [{"{"}oidc: []{"}"}]</code> in the public OpenAPI
        contract.
      </p>
      <section className="cds-section cds-external-config">
        <dl>
          <div className="cds-external-config-row">
            <dt>Tenant ID</dt>
            <dd>
              <code>{credential.tenantId}</code>
            </dd>
          </div>
          <div className="cds-external-config-row">
            <dt>Token</dt>
            <dd>
              <code>{credential.tokenPreview}</code>
            </dd>
          </div>
          <div className="cds-external-config-row">
            <dt>Scopes</dt>
            <dd>{credential.scopes.join(", ")}</dd>
          </div>
          <div className="cds-external-config-row">
            <dt>Created</dt>
            <dd>{new Date(credential.createdAt).toLocaleString()}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
