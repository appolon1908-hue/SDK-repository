import { createStubSession } from "../auth/actions.js";
import { defaultStubTenantId } from "../auth/session.js";

export interface StubLoginPageProps {
  appName: string;
  redirectTo?: string;
}

/**
 * The login-redirect stub every app's `/login/page.tsx` renders. It is not
 * connected to any identity provider -- see the note in `../auth/session.ts`
 * for the real OIDC seam this stands in for.
 */
export function StubLoginPage({ appName, redirectTo = "/" }: StubLoginPageProps): JSX.Element {
  return (
    <div className="cds-login">
      <div className="cds-login-card">
        <h1>{appName}</h1>
        <p className="cds-login-notice">
          <strong>Development authentication stub.</strong> No identity provider is deployed for this
          repository yet. This form sets a local, unsigned session cookie so the app is usable today. In
          production this page and its <code>createStubSession</code> action are replaced by an OIDC
          authorization-code redirect against the identity provider named in <code>docs/PRODUCTION_CONFIGURATION_CHECKLIST.md</code>.
        </p>
        <form action={createStubSession} className="cds-login-form">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <label htmlFor="subject">Operator name</label>
          <input id="subject" name="subject" type="text" defaultValue="dev-operator" required />
          <label htmlFor="tenantId">Tenant ID</label>
          <input id="tenantId" name="tenantId" type="text" defaultValue={defaultStubTenantId()} required />
          <button type="submit" className="cds-button-primary">
            Continue (dev stub)
          </button>
        </form>
      </div>
    </div>
  );
}
