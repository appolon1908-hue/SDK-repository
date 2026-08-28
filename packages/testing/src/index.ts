export { MatchersV3, PactV3 } from "@pact-foundation/pact";

export const syntheticIdentity = {
  tenantId: "042880db-aa51-4f16-83b5-ae858ee45ad6",
  workspaceId: "204ddc3a-3a33-445f-bfc5-0bb15167b624",
  postId: "d0313dba-09f7-4cce-8894-195f72c62126",
  correlationId: "correlation-compatibility-0001",
  idempotencyKey: "idempotency-compatibility-0001",
} as const;

export function syntheticAccessToken(): string {
  return "synthetic-pact-token-not-a-real-credential";
}
