/**
 * Read-only display data for the admin console's "configured externally"
 * panels. Per `docs/PRODUCTION_CONFIGURATION_CHECKLIST.md`, this repository
 * must never build password reset, SMTP, or secret-handling UI -- identity
 * and mail are owned by an external identity provider / Middleware
 * notification service. These types intentionally carry no secret material
 * (no client secrets, no SMTP passwords, no tokens) -- only non-sensitive
 * status a real admin would want to glance at, and every consumer of these
 * types must render them read-only.
 */
export interface IdentityProviderConfigSummary {
  issuerUrl: string;
  realm: string;
  clientIds: readonly string[];
  mfaPolicy: string;
  status: "configured" | "not_configured";
}

export interface SmtpConfigSummary {
  provider: string;
  senderDomain: string;
  spfConfigured: boolean;
  dkimConfigured: boolean;
  dmarcConfigured: boolean;
  status: "configured" | "not_configured";
}

export function buildIdentityProviderConfigFixture(): IdentityProviderConfigSummary {
  return {
    issuerUrl: "https://auth.codestra.co/realms/codestra/.well-known/openid-configuration",
    realm: "codestra",
    clientIds: ["codestra-admin-console", "codestra-developer-portal", "codestra-ops-dashboard"],
    mfaPolicy: "Required for admin and owner roles",
    status: "configured",
  };
}

export function buildSmtpConfigFixture(): SmtpConfigSummary {
  return {
    provider: "Configured in Middleware notification service",
    senderDomain: "mail.codestra.co",
    spfConfigured: true,
    dkimConfigured: true,
    dmarcConfigured: true,
    status: "configured",
  };
}
