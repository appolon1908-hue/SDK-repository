import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const wrongCheckout = run(["scripts/import-middleware-runtime-contract.mjs", "contracts/middleware-runtime-current.openapi.json"]);
if (wrongCheckout.status === 0 || !`${wrongCheckout.stderr}${wrongCheckout.stdout}`.includes("Source checkout is")) {
  throw new Error("Importer did not reject a contract from a checkout other than the pinned Middleware SHA.");
}

const directory = await mkdtemp(join(tmpdir(), "codestra-middleware-authority-"));
try {
  const source = JSON.parse(await readFile("contracts/middleware-runtime-current.openapi.json", "utf8"));
  source.info.title = "Tampered Middleware API";
  const tampered = join(directory, "tampered.openapi.json");
  await writeFile(tampered, `${JSON.stringify(source, null, 2)}\n`);
  const digestCheck = run(["scripts/check-middleware-runtime-alignment.mjs"], {
    MIDDLEWARE_RUNTIME_CONTRACT: tampered,
  });
  if (digestCheck.status === 0 || !`${digestCheck.stderr}${digestCheck.stdout}`.includes("content digest")) {
    throw new Error("Alignment gate did not reject a modified runtime snapshot.");
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}

console.log("Middleware authority negative gates passed.");

function run(args, env = {}) {
  return spawnSync(process.execPath, args, {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}
