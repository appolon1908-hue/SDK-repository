import { readdir, readFile } from "node:fs/promises";

const directory = process.argv[2] ?? "pact/pacts";
let names;
try {
  names = (await readdir(directory)).filter((name) => name.endsWith(".json"));
} catch {
  console.error(`No Pact directory found at ${directory}. Run the consumer tests first.`);
  process.exit(1);
}
if (names.length === 0) {
  console.error(`No Pact files found at ${directory}.`);
  process.exit(1);
}

const failures = [];
for (const name of names) {
  const path = `${directory}/${name}`;
  const pact = JSON.parse(await readFile(path, "utf8"));
  if (!pact.consumer?.name) failures.push(`${path}: missing consumer.name`);
  if (!pact.provider?.name) failures.push(`${path}: missing provider.name`);
  if (!Array.isArray(pact.interactions) || pact.interactions.length === 0) {
    failures.push(`${path}: must contain at least one interaction`);
  }
  const version = pact.metadata?.pactSpecification?.version;
  if (typeof version !== "string" || !/^[34]\./u.test(version)) {
    failures.push(`${path}: unsupported or missing Pact specification version`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Validated ${names.length} Pact file(s).`);
