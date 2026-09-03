import { readFile, writeFile } from "node:fs/promises";

const [sourcePath, outputPath] = process.argv.slice(2);
if (!sourcePath || !outputPath) {
  throw new Error("usage: prepare-middleware-generator-contract.mjs SOURCE OUTPUT");
}

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const projected = project(source);
projected.openapi = "3.0.3";
await writeFile(outputPath, `${JSON.stringify(projected, null, 2)}\n`);

function project(value) {
  if (Array.isArray(value)) return value.map(project);
  if (!value || typeof value !== "object") return value;

  const output = Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, project(child)]),
  );
  if (Object.hasOwn(output, "const")) {
    output.enum = [output.const];
    delete output.const;
  }
  if (output.name && output.identifier && Object.keys(output).every((key) => ["name", "identifier"].includes(key))) {
    delete output.identifier;
  }
  if (Array.isArray(output.type)) {
    const nonNull = output.type.filter((type) => type !== "null");
    if (nonNull.length + 1 === output.type.length && nonNull.length === 1) {
      output.type = nonNull[0];
      output.nullable = true;
    }
  }
  if (Array.isArray(output.anyOf)) {
    const nonNull = output.anyOf.filter((schema) => schema?.type !== "null");
    if (nonNull.length + 1 === output.anyOf.length && nonNull.length === 1) {
      delete output.anyOf;
      Object.assign(output, nonNull[0], { nullable: true });
    }
  }
  return output;
}
