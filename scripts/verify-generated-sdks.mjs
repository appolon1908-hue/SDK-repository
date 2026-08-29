import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const root = process.argv[2] ?? "generated";
const failures = [];

await requireAny(join(root, "python"), ["pyproject.toml", "setup.py"]);
await requireAny(join(root, "php"), ["composer.json"]);
await requireAny(join(root, "middleware-python"), ["pyproject.toml", "setup.py"]);
await requireDirectory(join(root, "python", "codestra_sdk"));
await requireDirectory(join(root, "php", "lib"));
await requireDirectory(join(root, "middleware-python", "codestra_middleware_sdk"));

for (const directory of [
  join(root, "python"),
  join(root, "php"),
  join(root, "middleware-python"),
]) {
  await walk(directory);
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(
  "Generated public Python/PHP and Middleware Python SDK structures passed validation.",
);

async function requireAny(directory, names) {
  for (const name of names) {
    try {
      await access(join(directory, name));
      return;
    } catch {
      // Try the next supported generator output.
    }
  }
  failures.push(`${directory}: expected one of ${names.join(", ")}`);
}

async function requireDirectory(directory) {
  try {
    const entries = await readdir(directory);
    if (entries.length === 0) failures.push(`${directory}: directory is empty`);
  } catch {
    failures.push(`${directory}: required directory is missing`);
  }
}

async function walk(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    if (!entry.isFile() || entry.name.endsWith(".png") || entry.name.endsWith(".jar")) continue;
    const source = await readFile(path, "utf8");
    for (const forbidden of [
      "Bearer eyJ",
      "BEGIN PRIVATE KEY",
      "appolon1908@gmail.com",
      "65.109.65.169",
    ]) {
      if (source.includes(forbidden)) {
        failures.push(`${path}: contains forbidden credential or infrastructure material`);
      }
    }
  }
}
