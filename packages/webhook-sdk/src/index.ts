const DEFAULT_TOLERANCE_SECONDS = 300;
const encoder = new TextEncoder();

export interface WebhookHeaders {
  "webhook-id": string;
  "webhook-timestamp": string;
  "webhook-signature": string;
}

export interface SignWebhookInput {
  id: string;
  timestamp?: number;
  payload: string | Uint8Array;
  secret: string;
}

export interface VerifyWebhookInput {
  id: string;
  timestamp: string | number;
  signature: string;
  payload: string | Uint8Array;
  secrets: readonly string[];
  toleranceSeconds?: number;
  now?: () => number;
}

export interface VerifiedWebhook {
  id: string;
  timestamp: number;
  matchedSecretIndex: number;
}

export interface ReplayStore {
  /** Atomically claims an event ID. Returns false when it was already claimed. */
  claim(eventId: string, expiresAtEpochSeconds: number): Promise<boolean>;
}

export class WebhookVerificationError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "WebhookVerificationError";
    this.code = code;
  }
}

export class InMemoryReplayStore implements ReplayStore {
  private readonly claims = new Map<string, number>();
  private readonly now: () => number;

  constructor(now: () => number = () => Math.floor(Date.now() / 1_000)) {
    this.now = now;
  }

  async claim(eventId: string, expiresAtEpochSeconds: number): Promise<boolean> {
    const current = this.now();
    for (const [id, expiry] of this.claims) {
      if (expiry <= current) this.claims.delete(id);
    }
    if (this.claims.has(eventId)) return false;
    this.claims.set(eventId, expiresAtEpochSeconds);
    return true;
  }
}

export async function signWebhook(input: SignWebhookInput): Promise<WebhookHeaders> {
  const id = validateEventId(input.id);
  const timestamp = input.timestamp ?? Math.floor(Date.now() / 1_000);
  validateTimestamp(timestamp);
  const signature = await computeSignature(input.secret, buildSignedPayload(id, timestamp, input.payload));
  return {
    "webhook-id": id,
    "webhook-timestamp": String(timestamp),
    "webhook-signature": `v1,${signature}`,
  };
}

export async function verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedWebhook> {
  const id = validateEventId(input.id);
  const timestamp = parseTimestamp(input.timestamp);
  const tolerance = validateTolerance(input.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS);
  const now = Math.floor((input.now?.() ?? Date.now()) / 1_000);

  if (Math.abs(now - timestamp) > tolerance) {
    throw new WebhookVerificationError("Webhook timestamp is outside the accepted tolerance.", "TIMESTAMP_OUT_OF_RANGE");
  }
  if (input.secrets.length === 0) {
    throw new WebhookVerificationError("At least one webhook secret is required.", "NO_SECRETS");
  }

  const candidates = parseSignatures(input.signature);
  const signedPayload = buildSignedPayload(id, timestamp, input.payload);

  for (let index = 0; index < input.secrets.length; index += 1) {
    const secret = input.secrets[index];
    if (secret === undefined) continue;
    const expected = fromBase64(await computeSignature(secret, signedPayload));
    for (const candidate of candidates) {
      if (constantTimeEqual(expected, candidate)) {
        return { id, timestamp, matchedSecretIndex: index };
      }
    }
  }

  throw new WebhookVerificationError("Webhook signature did not match any active secret.", "INVALID_SIGNATURE");
}

export async function verifyAndClaimWebhook(
  input: VerifyWebhookInput,
  replayStore: ReplayStore,
): Promise<VerifiedWebhook> {
  const verified = await verifyWebhook(input);
  const tolerance = validateTolerance(input.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS);
  const claimed = await replayStore.claim(verified.id, verified.timestamp + tolerance + 1);
  if (!claimed) {
    throw new WebhookVerificationError("Webhook event has already been processed.", "REPLAY_DETECTED");
  }
  return verified;
}

export function createWebhookSecret(bytes = 32): string {
  if (!Number.isSafeInteger(bytes) || bytes < 16 || bytes > 128) {
    throw new WebhookVerificationError("Webhook secret size must be between 16 and 128 bytes.", "INVALID_SECRET_SIZE");
  }
  if (!globalThis.crypto?.getRandomValues) {
    throw new WebhookVerificationError("A cryptographically secure random generator is required.", "CRYPTO_UNAVAILABLE");
  }
  const value = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(value);
  return `whsec_${toBase64(value)}`;
}

async function computeSignature(secret: string, message: Uint8Array): Promise<string> {
  const keyData = Uint8Array.from(decodeSecret(secret)).buffer;
  const messageData = Uint8Array.from(message).buffer;
  if (!globalThis.crypto?.subtle) {
    throw new WebhookVerificationError("Web Crypto HMAC support is required.", "CRYPTO_UNAVAILABLE");
  }
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await globalThis.crypto.subtle.sign("HMAC", key, messageData);
  return toBase64(new Uint8Array(signature));
}

function buildSignedPayload(id: string, timestamp: number, payload: string | Uint8Array): Uint8Array {
  const prefix = encoder.encode(`${id}.${timestamp}.`);
  const body = typeof payload === "string" ? encoder.encode(payload) : payload;
  const combined = new Uint8Array(prefix.length + body.length);
  combined.set(prefix, 0);
  combined.set(body, prefix.length);
  return combined;
}

function decodeSecret(secret: string): Uint8Array {
  if (!secret.startsWith("whsec_")) {
    throw new WebhookVerificationError("Webhook secrets must use the whsec_ prefix.", "INVALID_SECRET_FORMAT");
  }
  const decoded = fromBase64(secret.slice("whsec_".length));
  if (decoded.length < 16) {
    throw new WebhookVerificationError("Webhook secrets must contain at least 16 bytes.", "INVALID_SECRET_FORMAT");
  }
  return decoded;
}

function parseSignatures(header: string): Uint8Array[] {
  const signatures: Uint8Array[] = [];
  for (const token of header.trim().split(/\s+/u)) {
    const [version, encoded, extra] = token.split(",");
    if (version !== "v1" || !encoded || extra !== undefined) continue;
    try {
      signatures.push(fromBase64(encoded));
    } catch {
      // Ignore malformed candidates and continue checking rotated signatures.
    }
  }
  if (signatures.length === 0) {
    throw new WebhookVerificationError("Webhook signature header contains no supported v1 signatures.", "INVALID_SIGNATURE_HEADER");
  }
  return signatures;
}

function validateEventId(value: string): string {
  const id = value.trim();
  if (!id || id.length > 200 || /[\r\n]/u.test(id)) {
    throw new WebhookVerificationError("Webhook ID must be a non-empty single-line value.", "INVALID_EVENT_ID");
  }
  return id;
}

function parseTimestamp(value: string | number): number {
  const timestamp = typeof value === "number" ? value : Number(value);
  validateTimestamp(timestamp);
  return timestamp;
}

function validateTimestamp(timestamp: number): void {
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) {
    throw new WebhookVerificationError("Webhook timestamp must be a positive epoch-second integer.", "INVALID_TIMESTAMP");
  }
}

function validateTolerance(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 86_400) {
    throw new WebhookVerificationError("Webhook tolerance must be between 0 and 86400 seconds.", "INVALID_TOLERANCE");
  }
  return value;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index % left.length] ?? 0) ^ (right[index % right.length] ?? 0);
  }
  return difference === 0;
}

function toBase64(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  let binary: string;
  try {
    binary = atob(value);
  } catch {
    throw new WebhookVerificationError("Value is not valid base64.", "INVALID_BASE64");
  }
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
