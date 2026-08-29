import { InternalEventBoundaryError } from "./internal-event-model.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function singleHeader(headers: Readonly<Record<string, string | readonly string[] | undefined>>, name: string): string {
  const value = headers[name] ?? headers[name.toLowerCase()];
  const resolved = Array.isArray(value) ? value[0] : value;
  if (typeof resolved !== "string" || resolved.trim() === "" || /[\r\n]/u.test(resolved)) {
    throw new InternalEventBoundaryError(`Header ${name} is required.`, "HEADER_REQUIRED", { status: 401 });
  }
  return resolved.trim();
}

export function requireCredentialString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim() === "" || /[\r\n]/u.test(value.trim())) {
    throw new InternalEventBoundaryError(`Credential ${name} must be a non-empty single-line string.`, "INVALID_CREDENTIAL", { status: 500 });
  }
  return value.trim();
}

export function requireSecret(value: string, name: string): string {
  if (value.length < 16) {
    throw new InternalEventBoundaryError(`Credential ${name} is too short.`, "INVALID_SECRET", { status: 500 });
  }
  return value;
}

export function parseLines(value: unknown, name: string): string[] {
  if (typeof value !== "string") {
    throw new InternalEventBoundaryError(`Credential ${name} must be a string list.`, "INVALID_CREDENTIAL", { status: 500 });
  }
  return value.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
}

export function requireUuid(value: unknown, path: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new InternalEventBoundaryError(`${path} must be a UUID.`, "INVALID_UUID", { status: 422 });
  }
  return value.toLowerCase();
}

export function integerBetween(value: unknown, min: number, max: number, path: string): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(numeric) || numeric < min || numeric > max) {
    throw new InternalEventBoundaryError(`${path} must be an integer between ${min} and ${max}.`, "INVALID_INTEGER", { status: 422 });
  }
  return numeric;
}

export function requireObject(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new InternalEventBoundaryError(`${path} must be an object.`, "INVALID_OBJECT", { status: 422 });
  }
  return value as Record<string, unknown>;
}

export function requireArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new InternalEventBoundaryError(`${path} must be an array.`, "INVALID_ARRAY", { status: 422 });
  }
  return value;
}

export function requireString(value: unknown, path: string, max = 512, allowEmpty = false): string {
  if (typeof value !== "string" || (!allowEmpty && value.length === 0) || value.length > max || /[\u0000-\u001f]/u.test(value)) {
    throw new InternalEventBoundaryError(`${path} must be a bounded string.`, "INVALID_STRING", { status: 422 });
  }
  return value;
}

export function requireEnum(value: unknown, allowed: ReadonlySet<string>, path: string): string {
  const text = requireString(value, path, 200);
  if (!allowed.has(text)) {
    throw new InternalEventBoundaryError(`${path} is not allowed.`, "INVALID_ENUM", { status: 422 });
  }
  return text;
}

export function requireDateTime(value: unknown, path: string): string {
  const text = requireString(value, path, 100);
  if (Number.isNaN(Date.parse(text))) {
    throw new InternalEventBoundaryError(`${path} must be an ISO date-time.`, "INVALID_DATETIME", { status: 422 });
  }
  return text;
}

export function requireAbsoluteUri(value: unknown, path: string): string {
  const text = requireString(value, path, 2048);
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && url.protocol !== "urn:") throw new Error("unsupported protocol");
  } catch {
    throw new InternalEventBoundaryError(`${path} must be an absolute URI.`, "INVALID_URI", { status: 422 });
  }
  return text;
}

export function rejectUnknownKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>, path: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new InternalEventBoundaryError(`${path}.${key} is not supported.`, "UNKNOWN_FIELD", { status: 422 });
    }
  }
}

export function validateWebhookSecret(secret: string): void {
  if (!secret.startsWith("whsec_") || secret.length < 28 || /[\r\n]/u.test(secret)) {
    throw new InternalEventBoundaryError("Webhook secrets must be whsec_ prefixed single-line values.", "INVALID_WEBHOOK_SECRET", { status: 500 });
  }
}

export function validateInternalBaseUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new InternalEventBoundaryError("Replay guard base URL must be HTTPS outside local tests.", "INVALID_REPLAY_GUARD_URL", { status: 500 });
  }
  return url;
}
