import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { parse, stringify } from "yaml";

const wrongCheckout = run(["scripts/import-middleware-runtime-contract.mjs", "contracts/middleware-runtime-current.openapi.json"]);
if (wrongCheckout.status === 0 || !`${wrongCheckout.stderr}${wrongCheckout.stdout}`.includes("Source checkout is")) {
  throw new Error("Importer did not reject a contract from a checkout other than the pinned Middleware SHA.");
}

const directory = await mkdtemp(join(tmpdir(), "codestra-middleware-authority-"));
try {
  const source = JSON.parse(await readFile("contracts/middleware-runtime-current.openapi.json", "utf8"));
  source.info.title = "Tampered Middleware API";
  const tamperedCanonical = structuredClone(source);
  delete tamperedCanonical["x-codestra-source-authority"];
  source["x-codestra-source-authority"].source_sha256 = createHash("sha256")
    .update(`${JSON.stringify(tamperedCanonical, null, 2)}\n`)
    .digest("hex");
  const tampered = join(directory, "tampered.openapi.json");
  await writeFile(tampered, `${JSON.stringify(source, null, 2)}\n`);
  const digestCheck = run(["scripts/check-middleware-runtime-alignment.mjs"], {
    MIDDLEWARE_RUNTIME_CONTRACT: tampered,
  });
  if (digestCheck.status === 0 || !`${digestCheck.stderr}${digestCheck.stdout}`.includes("content digest")) {
    throw new Error("Alignment gate did not reject a modified runtime snapshot.");
  }

  const communicationsPath = "contracts/openapi/codestra-communications.openapi.yaml";
  const communications = parse(await readFile(communicationsPath, "utf8"));
  communications.components.parameters.TenantId.required = false;
  const weakenedCommunications = join(directory, "weakened-communications.openapi.yaml");
  await writeFile(weakenedCommunications, stringify(communications));
  const sdkContracts = [
    "contracts/openapi/codestra-middleware-client.openapi.json",
    "contracts/openapi/codestra-public.openapi.yaml",
    "contracts/openapi/codestra-enterprise.openapi.yaml",
    weakenedCommunications,
    "contracts/openapi/codestra-operations-dashboard.openapi.yaml",
    "contracts/openapi/codestra-control-plane.openapi.yaml",
  ];
  const handwrittenContractCheck = run(
    ["scripts/check-middleware-runtime-alignment.mjs"],
    { MIDDLEWARE_SDK_CONTRACTS: sdkContracts.join(",") },
  );
  if (
    handwrittenContractCheck.status === 0 ||
    !`${handwrittenContractCheck.stderr}${handwrittenContractCheck.stdout}`.includes("HEADER_MISMATCH")
  ) {
    throw new Error("Alignment gate did not compare a weakened handwritten contract independently.");
  }

  communications.components.parameters.TenantId.required = true;
  communications.components.schemas.CommunicationMessage.required.push("contractOnly");
  const overstatedCommunications = join(directory, "overstated-communications.openapi.yaml");
  await writeFile(overstatedCommunications, stringify(communications));
  sdkContracts[3] = overstatedCommunications;
  const responseSchemaCheck = run(
    ["scripts/check-middleware-runtime-alignment.mjs"],
    { MIDDLEWARE_SDK_CONTRACTS: sdkContracts.join(",") },
  );
  if (
    responseSchemaCheck.status === 0 ||
    !`${responseSchemaCheck.stderr}${responseSchemaCheck.stdout}`.includes("RESPONSE_SCHEMA_MISMATCH")
  ) {
    throw new Error("Alignment gate did not reject an SDK response shape not guaranteed by Middleware.");
  }

  const repository = join(directory, "middleware");
  const canonicalPath = "contracts/platform/middleware-openapi.generated.json";
  const checkoutPath = join(repository, canonicalPath);
  await mkdir(join(repository, "contracts/platform"), { recursive: true });
  const committed = structuredClone(source);
  delete committed["x-codestra-source-authority"];
  committed.info.title = "Codestra Middleware API";
  await writeFile(checkoutPath, `${JSON.stringify(committed, null, 2)}\n`);
  git(repository, ["init", "-q"]);
  git(repository, ["config", "user.email", "authority-test@example.invalid"]);
  git(repository, ["config", "user.name", "Authority Test"]);
  git(repository, ["remote", "add", "origin", "https://example.invalid/codestra/Middleware-"]);
  git(repository, ["add", canonicalPath]);
  git(repository, ["commit", "-qm", "canonical contract"]);
  const revision = git(repository, ["rev-parse", "HEAD"]);
  const testAuthority = join(directory, "authority.json");
  const imported = join(directory, "imported.json");
  await writeFile(testAuthority, `${JSON.stringify({
    repository: "https://example.invalid/codestra/Middleware-",
    source_sha: revision,
    source_path: canonicalPath,
    source_sha256: createHash("sha256").update(`${JSON.stringify(committed, null, 2)}\n`).digest("hex"),
  })}\n`);
  committed.info.title = "Dirty unreviewed contract";
  await writeFile(checkoutPath, `${JSON.stringify(committed, null, 2)}\n`);
  const importResult = run(["scripts/import-middleware-runtime-contract.mjs", checkoutPath], {
    MIDDLEWARE_RUNTIME_AUTHORITY: testAuthority,
    MIDDLEWARE_RUNTIME_CONTRACT: imported,
  });
  if (importResult.status !== 0) throw new Error(`Pinned-blob import fixture failed: ${importResult.stderr}${importResult.stdout}`);
  const importedDocument = JSON.parse(await readFile(imported, "utf8"));
  if (importedDocument.info.title !== "Codestra Middleware API") {
    throw new Error("Importer read dirty working-tree bytes instead of the pinned Git blob.");
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}

function git(cwd, args) {
  const result = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

console.log("Middleware authority negative gates passed.");

function run(args, env = {}) {
  return spawnSync(process.execPath, args, {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}
