import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().min(1).default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

  // OIDC/JWT verification. There is no real identity provider deployed with
  // this repository — these are the seam a real OIDC provider (Keycloak or
  // similar) plugs into. See services/middleware/README.md.
  OIDC_ISSUER: z.string().min(1, "OIDC_ISSUER is required"),
  OIDC_JWKS_URL: z.string().url("OIDC_JWKS_URL must be a URL"),
  OIDC_AUDIENCE: z.string().min(1, "OIDC_AUDIENCE is required"),
  OIDC_TENANT_CLAIM: z.string().min(1).default("tenant_id"),
  JWT_CLOCK_TOLERANCE_SECONDS: z.coerce.number().int().nonnegative().default(30),

  WEBHOOK_SECRET_OVERLAP_HOURS: z.coerce.number().int().positive().default(24),
  WEBHOOK_DELIVERY_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  // Test/local-development escape hatch ONLY — see
  // src/webhooks/ssrf.ts's DestinationPolicyOptions doc comment. Must never
  // be set to true outside test configuration.
  WEBHOOK_SSRF_ALLOW_INSECURE_FOR_TESTS: z
    .string()
    .optional()
    .transform((value) => value === "true"),

  RESTRICTED_GATEWAY_BASE_URL: z.string().url().default("https://product-gateway.invalid"),
  RESTRICTED_GATEWAY_SERVICE_TOKEN: z.string().default(""),
  RESTRICTED_GATEWAY_WORKLOAD_ID: z.string().default("codestra-middleware"),
  RESTRICTED_GATEWAY_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid Codestra Middleware environment configuration: ${issues}`);
  }
  return parsed.data;
}
