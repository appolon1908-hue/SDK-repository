import { createIntakeBff } from "@codestra/intake-bff";

const intake = createIntakeBff({
  clientSecret: process.env.CODESTRA_SDK_INTAKE_CLIENT_SECRET!,
  allowedTenantIds: [process.env.CODESTRA_TENANT_ID!],
});

// Adapt this function to a Nuxt server route, Next route handler, or Node fetch-compatible server.
export async function POST(request: Request): Promise<Response> {
  return intake.handle(request);
}
