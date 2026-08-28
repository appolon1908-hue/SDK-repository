import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { DEFAULT_RESTRICTED_GATEWAY_ROUTES } from "../src/base.js";

const contractPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../contracts/openapi/codestra-restricted-gateway.openapi.yaml",
);

describe("restricted gateway contract", () => {
  it("documents every default provider-adapter network route", () => {
    const contract = parse(readFileSync(contractPath, "utf8")) as {
      paths: Record<string, unknown>;
    };
    expect(Object.keys(contract.paths).sort()).toEqual(
      Object.values(DEFAULT_RESTRICTED_GATEWAY_ROUTES).sort(),
    );
  });

  it("requires private identity on restricted command and reconciliation routes", () => {
    const contract = parse(readFileSync(contractPath, "utf8")) as {
      paths: Record<string, { post?: { parameters?: Array<{ name?: string; $ref?: string }> } }>;
    };
    for (const path of [
      DEFAULT_RESTRICTED_GATEWAY_ROUTES.commands,
      DEFAULT_RESTRICTED_GATEWAY_ROUTES.reconciliation,
    ]) {
      const post = contract.paths[path]?.post;
      expect(post?.parameters?.map((parameter) => parameter.name ?? parameter.$ref)).toContain(
        "#/components/parameters/WorkloadIdentity",
      );
    }
  });
});
