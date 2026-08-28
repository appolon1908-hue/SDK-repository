import { defaultStubTenantId } from "../auth/session.js";

/**
 * The developer portal's "your API credentials" page. There is no public API
 * operation for reading back API tokens yet, so this is mocked -- but it is
 * scoped to the signed-in tenant only, the same way a real implementation
 * must be: it never lists another tenant's credentials.
 */
export interface ApiCredentialSummary {
  tenantId: string;
  tokenPreview: string;
  createdAt: string;
  scopes: readonly string[];
}

export function buildApiCredentialFixture(tenantId: string = defaultStubTenantId()): ApiCredentialSummary {
  return {
    tenantId,
    tokenPreview: "cdst_live_••••••••••••7f2a",
    createdAt: new Date(Date.UTC(2026, 5, 12, 9, 30, 0)).toISOString(),
    scopes: ["social:read", "social:write", "webhooks:manage"],
  };
}
