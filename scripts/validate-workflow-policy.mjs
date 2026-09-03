import { readdir, readFile } from "node:fs/promises";
import { parse } from "yaml";

const directory = ".github/workflows";
const files = (await readdir(directory)).filter((name) => /\.ya?ml$/u.test(name));
const failures = [];

for (const file of files) {
  const path = `${directory}/${file}`;
  const document = parse(await readFile(path, "utf8"));
  const triggers = document.on;
  const triggerNames = typeof triggers === "string"
    ? [triggers]
    : Array.isArray(triggers)
      ? triggers
      : Object.keys(triggers ?? {});
  if (triggerNames.includes("pull_request_target")) failures.push(`${path}: pull_request_target is forbidden`);
  const isPullRequest = triggerNames.includes("pull_request");
  const permissions = document.permissions ?? {};
  if (permissions === "write-all") failures.push(`${path}: write-all permissions are forbidden`);
  if (typeof permissions === "object") {
    for (const [scope, level] of Object.entries(permissions)) {
      if (level === "write") failures.push(`${path}: top-level ${scope}: write is forbidden`);
    }
  }

  for (const [jobName, job] of Object.entries(document.jobs ?? {})) {
    const runner = JSON.stringify(job["runs-on"] ?? "");
    if (isPullRequest && runner.includes("self-hosted")) {
      failures.push(`${path}:${jobName}: pull request jobs must use GitHub-hosted runners`);
    }
    if (isPullRequest && job.environment !== undefined) {
      failures.push(`${path}:${jobName}: pull request jobs must not use environments`);
    }
    if (isPullRequest && JSON.stringify(job).includes("secrets.")) {
      failures.push(`${path}:${jobName}: pull request jobs must not consume secrets`);
    }
    for (const step of job.steps ?? []) {
      if (typeof step.uses === "string" && step.uses.startsWith("actions/checkout@")) {
        if (step.with?.["persist-credentials"] !== false) {
          failures.push(`${path}:${jobName}: checkout must set persist-credentials: false`);
        }
      }
      if (typeof step.uses === "string" && !step.uses.startsWith("./") && !step.uses.startsWith("docker://")) {
        const ref = step.uses.split("@")[1];
        if (!ref || !/^[0-9a-f]{40}$/u.test(ref)) {
          failures.push(`${path}:${jobName}: ${step.uses} must be pinned to a full commit SHA, not a mutable tag`);
        }
      }
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Validated workflow policy for ${files.length} workflow(s).`);
