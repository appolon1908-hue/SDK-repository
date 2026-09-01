import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

/**
 * Negative-fixture proof that scripts/check-contract-drift.mjs actually
 * catches breaking changes -- specifically the classes of change that
 * only became detectable once the script started fully dereferencing
 * `$ref` before diffing (see check-contract-drift.mjs's own doc comment).
 * Mirrors test-contract-validator.mjs's pattern: temporarily corrupt a
 * real file, prove the gate rejects it, always restore the original
 * content in a finally block.
 */

const cases = [
  {
    name: "a shared, $ref'd parameter tightened from optional to required",
    file: "contracts/openapi/codestra-public.openapi.yaml",
    corrupt: (text) =>
      text.replace(
        "    CorrelationId:\n      name: X-Correlation-Id\n      in: header\n      required: false",
        "    CorrelationId:\n      name: X-Correlation-Id\n      in: header\n      required: true",
      ),
    expectedSubstring: "became required",
  },
  {
    name: "a new required property on an externally-$ref'd AsyncAPI message payload",
    file: "contracts/schemas/events/social-post-status.schema.json",
    corrupt: (text) => text.replace('"occurredAt"],', '"occurredAt", "newlyRequiredField"],'),
    expectedSubstring: "new required property",
  },
];

const failures = [];

for (const testCase of cases) {
  const original = await readFile(testCase.file, "utf8");
  const corrupted = testCase.corrupt(original);
  if (corrupted === original) {
    failures.push(`${testCase.name}: fixture's corrupt() did not change the file -- test is broken`);
    continue;
  }
  try {
    await writeFile(testCase.file, corrupted);
    const result = runDrift();
    if (result.status === 0) {
      failures.push(`${testCase.name}: breaking change was incorrectly accepted`);
    } else if (!result.output.includes(testCase.expectedSubstring)) {
      failures.push(`${testCase.name}: rejected, but without the expected finding ("${testCase.expectedSubstring}"). Got:\n${result.output}`);
    } else {
      console.log(`Rejected negative fixture: ${testCase.name}`);
    }
  } finally {
    await writeFile(testCase.file, original);
  }
}

// And the positive control: the real, unmodified working tree against its
// own HEAD must be clean. If this fails, either a real breaking change is
// unmerged or the two cases above failed to restore their file.
const clean = runDrift();
if (clean.status !== 0) {
  failures.push(`unmodified working tree against HEAD was rejected (should be clean):\n${clean.output}`);
} else {
  console.log("Confirmed the unmodified working tree is clean against HEAD.");
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Contract drift detector negative fixtures passed.");

function runDrift() {
  const result = spawnSync(process.execPath, ["scripts/check-contract-drift.mjs", "HEAD"], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  return { status: result.status, output: [result.stdout, result.stderr].filter(Boolean).join("\n") };
}
