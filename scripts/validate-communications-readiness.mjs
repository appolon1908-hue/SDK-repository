import { readFile } from "node:fs/promises";
import { parse } from "yaml";

const manifest = JSON.parse(await readFile("contracts/communications-production-readiness.v1.json", "utf8"));
const openapi = parse(await readFile(manifest.canonicalContracts.openapi, "utf8"));
const asyncapi = parse(await readFile(manifest.canonicalContracts.asyncapi, "utf8"));
const clientSource = await readFile("packages/communications-sdk/src/client.ts", "utf8");
const typeSource = await readFile("packages/communications-sdk/src/types.ts", "utf8");
const failures = [];

for (const path of manifest.requiredOpenApiPaths) {
  if (!openapi.paths?.[path]) failures.push(`OpenAPI is missing required Communications path: ${path}`);
}

const channelAddresses = new Set(
  Object.values(asyncapi.channels ?? {})
    .map((channel) => channel?.address)
    .filter((address) => typeof address === "string"),
);
for (const address of manifest.requiredAsyncApiChannels) {
  if (!channelAddresses.has(address)) failures.push(`AsyncAPI is missing required channel address: ${address}`);
}

for (const facade of manifest.requiredSdkFacades) {
  if (!clientSource.includes(`readonly ${facade}:`) || !clientSource.includes(`this.${facade} =`)) {
    failures.push(`Communications SDK client is missing facade: ${facade}`);
  }
}

for (const header of manifest.requiredCommandPlane.requiredHeaders) {
  const lowerSource = clientSource.toLowerCase();
  const lowerHeader = header.toLowerCase();
  if (
    !clientSource.includes(`"${header}"`) &&
    !clientSource.includes(`${header}:`) &&
    !lowerSource.includes(`"${lowerHeader}"`) &&
    !lowerSource.includes(`${lowerHeader}:`)
  ) {
    failures.push(`Communications SDK command plane does not set required header: ${header}`);
  }
}

for (const exportedType of [
  "CommunicationMessage",
  "CommunicationTemplate",
  "CommunicationSenderIdentity",
  "CommunicationDomain",
  "CommunicationSuppression",
  "CommunicationPreference",
  "CommunicationProviderHealth",
  "CommunicationUsageReport",
  "CommunicationReputationReport",
  "CreateCommunicationMessageInput",
]) {
  if (!typeSource.includes(exportedType)) failures.push(`Communications SDK types do not expose ${exportedType}`);
}

if (!clientSource.includes("/v1/commands") || !clientSource.includes("/v1/operations/")) {
  failures.push("Communications SDK must preserve privileged Middleware command submit/read-back routes.");
}

if (manifest.status !== "CONTRACT_READY_STAGING_PROOF_REQUIRED") {
  failures.push(`Unexpected production readiness status: ${manifest.status}`);
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log("Communications production-readiness manifest validation passed.");
