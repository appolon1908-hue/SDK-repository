import type { ISODateTime, JsonObject, UUID } from "@codestra/contracts";

export type ConnectorHealthStatus = "healthy" | "degraded" | "unavailable" | "disabled";
export type ConnectorCommandStatus = "accepted" | "completed" | "rejected";

export interface ConnectorOperation {
  name: string;
  mutates: boolean;
  requiredCapabilities: readonly string[];
  description?: string;
}

export interface ConnectorManifest {
  key: string;
  displayName: string;
  version: string;
  operations: readonly ConnectorOperation[];
  webhookEventTypes: readonly string[];
}

export interface ConnectorActor {
  type: "user" | "service" | "operator";
  subjectId: string;
}

export interface ConnectorContext {
  tenantId: UUID;
  correlationId: string;
  actor: ConnectorActor;
  capabilities: Readonly<Record<string, boolean>>;
  signal?: AbortSignal;
}

export interface ConnectorCommand {
  commandId: UUID;
  operation: string;
  payload: JsonObject;
  requestedAt: ISODateTime;
  idempotencyKey?: string;
  expectedVersion?: number;
}

export interface ConnectorCommandResult {
  commandId: UUID;
  status: ConnectorCommandStatus;
  providerReference?: string;
  data?: JsonObject;
  replayed?: boolean;
}

export interface ConnectorHealth {
  status: ConnectorHealthStatus;
  checkedAt: ISODateTime;
  latencyMs?: number;
  details?: JsonObject;
}

export interface ConnectorWebhookInput {
  headers: Readonly<Record<string, string>>;
  rawBody: Uint8Array;
  receivedAt: ISODateTime;
}

export interface NormalizedConnectorEvent {
  id: UUID;
  source: string;
  type: string;
  subject?: string;
  time: ISODateTime;
  data: JsonObject;
}

export interface ReconciliationResult {
  items: readonly JsonObject[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface CodestraConnector {
  manifest(): ConnectorManifest;
  testConnection(context: ConnectorContext): Promise<ConnectorHealth>;
  execute(context: ConnectorContext, command: ConnectorCommand): Promise<ConnectorCommandResult>;
  ingestWebhook(
    context: ConnectorContext,
    input: ConnectorWebhookInput,
  ): Promise<readonly NormalizedConnectorEvent[]>;
  reconcile(context: ConnectorContext, cursor?: string): Promise<ReconciliationResult>;
}

export class ConnectorError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly details: JsonObject | undefined;

  constructor(
    message: string,
    code: string,
    options: { retryable?: boolean; details?: JsonObject; cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
  }
}

export class ConnectorPolicyError extends ConnectorError {
  constructor(message: string, code = "CONNECTOR_POLICY_DENIED", details?: JsonObject) {
    super(message, code, details === undefined ? {} : { details });
  }
}

export class ConnectorConflictError extends ConnectorError {
  constructor(message: string, code = "CONNECTOR_CONFLICT") {
    super(message, code, { retryable: true });
  }
}

export class ConnectorTimeoutError extends ConnectorError {
  constructor(timeoutMs: number) {
    super(`Connector execution exceeded ${timeoutMs}ms.`, "CONNECTOR_TIMEOUT", { retryable: true });
  }
}

export type IdempotencyBeginResult =
  | { state: "acquired" }
  | { state: "in_progress" }
  | { state: "completed"; result: ConnectorCommandResult };

export interface ConnectorIdempotencyStore {
  begin(scope: string, ttlSeconds: number): Promise<IdempotencyBeginResult>;
  complete(scope: string, result: ConnectorCommandResult, ttlSeconds: number): Promise<void>;
  release(scope: string): Promise<void>;
}

interface IdempotencyRecord {
  state: "in_progress" | "completed";
  expiresAt: number;
  result?: ConnectorCommandResult;
}

export class InMemoryConnectorIdempotencyStore implements ConnectorIdempotencyStore {
  private readonly records = new Map<string, IdempotencyRecord>();
  private readonly now: () => number;

  constructor(now: () => number = () => Math.floor(Date.now() / 1_000)) {
    this.now = now;
  }

  async begin(scope: string, ttlSeconds: number): Promise<IdempotencyBeginResult> {
    this.cleanup();
    const record = this.records.get(scope);
    if (record?.state === "completed" && record.result !== undefined) {
      return { state: "completed", result: structuredClone(record.result) };
    }
    if (record?.state === "in_progress") return { state: "in_progress" };
    this.records.set(scope, { state: "in_progress", expiresAt: this.now() + ttlSeconds });
    return { state: "acquired" };
  }

  async complete(scope: string, result: ConnectorCommandResult, ttlSeconds: number): Promise<void> {
    this.records.set(scope, {
      state: "completed",
      expiresAt: this.now() + ttlSeconds,
      result: structuredClone(result),
    });
  }

  async release(scope: string): Promise<void> {
    const record = this.records.get(scope);
    if (record?.state === "in_progress") this.records.delete(scope);
  }

  private cleanup(): void {
    const current = this.now();
    for (const [key, record] of this.records) {
      if (record.expiresAt <= current) this.records.delete(key);
    }
  }
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetAfterMs?: number;
  now?: () => number;
}

interface CircuitState {
  failures: number;
  openedAt?: number;
  probeInFlight: boolean;
}

export class ConnectorCircuitBreaker {
  private readonly states = new Map<string, CircuitState>();
  private readonly failureThreshold: number;
  private readonly resetAfterMs: number;
  private readonly now: () => number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = positiveInteger(options.failureThreshold ?? 5, "failureThreshold");
    this.resetAfterMs = positiveInteger(options.resetAfterMs ?? 30_000, "resetAfterMs");
    this.now = options.now ?? Date.now;
  }

  beforeRequest(scope: string): void {
    const state = this.states.get(scope);
    if (!state?.openedAt) return;
    if (this.now() - state.openedAt < this.resetAfterMs) {
      throw new ConnectorError("Connector circuit is open.", "CONNECTOR_CIRCUIT_OPEN", { retryable: true });
    }
    if (state.probeInFlight) {
      throw new ConnectorError("Connector recovery probe is already in progress.", "CONNECTOR_CIRCUIT_PROBE_BUSY", {
        retryable: true,
      });
    }
    state.probeInFlight = true;
  }

  recordSuccess(scope: string): void {
    this.states.delete(scope);
  }

  recordFailure(scope: string): void {
    const state = this.states.get(scope) ?? { failures: 0, probeInFlight: false };
    state.failures += 1;
    state.probeInFlight = false;
    if (state.failures >= this.failureThreshold) state.openedAt = this.now();
    this.states.set(scope, state);
  }
}

export interface ConnectorRunnerOptions {
  idempotencyStore: ConnectorIdempotencyStore;
  circuitBreaker?: ConnectorCircuitBreaker;
  timeoutMs?: number;
  inProgressTtlSeconds?: number;
  completedTtlSeconds?: number;
}

export class ConnectorRunner {
  private readonly idempotencyStore: ConnectorIdempotencyStore;
  private readonly circuitBreaker: ConnectorCircuitBreaker;
  private readonly timeoutMs: number;
  private readonly inProgressTtlSeconds: number;
  private readonly completedTtlSeconds: number;

  constructor(options: ConnectorRunnerOptions) {
    this.idempotencyStore = options.idempotencyStore;
    this.circuitBreaker = options.circuitBreaker ?? new ConnectorCircuitBreaker();
    this.timeoutMs = positiveInteger(options.timeoutMs ?? 15_000, "timeoutMs");
    this.inProgressTtlSeconds = positiveInteger(options.inProgressTtlSeconds ?? 60, "inProgressTtlSeconds");
    this.completedTtlSeconds = positiveInteger(options.completedTtlSeconds ?? 86_400, "completedTtlSeconds");
  }

  async execute(
    connector: CodestraConnector,
    context: ConnectorContext,
    command: ConnectorCommand,
  ): Promise<ConnectorCommandResult> {
    validateContext(context);
    validateCommand(command);
    const manifest = validateManifest(connector.manifest());
    const operation = manifest.operations.find((candidate) => candidate.name === command.operation);
    if (!operation) {
      throw new ConnectorPolicyError(`Connector ${manifest.key} does not expose ${command.operation}.`, "UNKNOWN_OPERATION");
    }
    for (const capability of operation.requiredCapabilities) {
      if (context.capabilities[capability] !== true) {
        throw new ConnectorPolicyError(`Capability ${capability} is required for ${command.operation}.`, "CAPABILITY_DISABLED", {
          capability,
          operation: command.operation,
        });
      }
    }

    let idempotencyScope: string | undefined;
    let acquired = false;
    if (operation.mutates) {
      const key = validateIdempotencyKey(command.idempotencyKey);
      idempotencyScope = `${context.tenantId}:${manifest.key}:${command.operation}:${key}`;
      const state = await this.idempotencyStore.begin(idempotencyScope, this.inProgressTtlSeconds);
      if (state.state === "completed") return { ...state.result, replayed: true };
      if (state.state === "in_progress") {
        throw new ConnectorConflictError("An identical connector command is already in progress.", "IDEMPOTENCY_IN_PROGRESS");
      }
      acquired = true;
    }

    const circuitScope = `${context.tenantId}:${manifest.key}`;
    this.circuitBreaker.beforeRequest(circuitScope);
    const timeout = createExecutionTimeout(context.signal, this.timeoutMs);

    try {
      const executionContext: ConnectorContext = { ...context, signal: timeout.signal };
      const result = await Promise.race([
        connector.execute(executionContext, command),
        timeout.rejection,
      ]);
      if (result.commandId !== command.commandId) {
        throw new ConnectorError("Connector returned a result for a different command.", "COMMAND_RESULT_MISMATCH");
      }
      this.circuitBreaker.recordSuccess(circuitScope);
      if (idempotencyScope !== undefined) {
        await this.idempotencyStore.complete(idempotencyScope, result, this.completedTtlSeconds);
      }
      return result;
    } catch (error) {
      this.circuitBreaker.recordFailure(circuitScope);
      if (acquired && idempotencyScope !== undefined) await this.idempotencyStore.release(idempotencyScope);
      throw error instanceof ConnectorError
        ? error
        : new ConnectorError("Connector execution failed.", "CONNECTOR_EXECUTION_FAILED", {
            retryable: true,
            cause: error,
          });
    } finally {
      timeout.cleanup();
    }
  }
}

function validateContext(context: ConnectorContext): void {
  requireSingleLine(context.tenantId, "tenantId");
  requireSingleLine(context.correlationId, "correlationId");
  requireSingleLine(context.actor.subjectId, "actor.subjectId");
}

function validateCommand(command: ConnectorCommand): void {
  requireSingleLine(command.commandId, "commandId");
  requireSingleLine(command.operation, "operation");
  if (!Number.isFinite(Date.parse(command.requestedAt))) {
    throw new ConnectorPolicyError("requestedAt must be an ISO date-time.", "INVALID_COMMAND_TIME");
  }
  if (command.expectedVersion !== undefined && (!Number.isSafeInteger(command.expectedVersion) || command.expectedVersion < 0)) {
    throw new ConnectorPolicyError("expectedVersion must be a non-negative integer.", "INVALID_EXPECTED_VERSION");
  }
}

function validateManifest(manifest: ConnectorManifest): ConnectorManifest {
  if (!/^[a-z][a-z0-9-]{1,63}$/u.test(manifest.key)) {
    throw new ConnectorPolicyError("Connector manifest key is invalid.", "INVALID_CONNECTOR_MANIFEST");
  }
  const names = new Set<string>();
  for (const operation of manifest.operations) {
    if (names.has(operation.name)) {
      throw new ConnectorPolicyError(`Connector operation ${operation.name} is duplicated.`, "INVALID_CONNECTOR_MANIFEST");
    }
    names.add(operation.name);
  }
  return manifest;
}

function validateIdempotencyKey(value: string | undefined): string {
  if (value === undefined) {
    throw new ConnectorPolicyError("Mutating connector commands require an idempotency key.", "IDEMPOTENCY_REQUIRED");
  }
  const key = requireSingleLine(value, "idempotencyKey");
  if (key.length < 16 || key.length > 128) {
    throw new ConnectorPolicyError("idempotencyKey must contain between 16 and 128 characters.", "INVALID_IDEMPOTENCY_KEY");
  }
  return key;
}

function requireSingleLine(value: string, name: string): string {
  const normalized = value.trim();
  if (!normalized || /[\r\n]/u.test(normalized)) {
    throw new ConnectorPolicyError(`${name} must be a non-empty single-line value.`, "INVALID_CONTEXT");
  }
  return normalized;
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`${name} must be a positive integer.`);
  return value;
}

function createExecutionTimeout(externalSignal: AbortSignal | undefined, timeoutMs: number): {
  signal: AbortSignal;
  rejection: Promise<never>;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const propagateAbort = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) propagateAbort();
  else externalSignal?.addEventListener("abort", propagateAbort, { once: true });

  let rejectTimeout: (error: ConnectorTimeoutError) => void = () => undefined;
  const rejection = new Promise<never>((_, reject) => {
    rejectTimeout = reject;
  });
  const timer = setTimeout(() => {
    const error = new ConnectorTimeoutError(timeoutMs);
    controller.abort(error);
    rejectTimeout(error);
  }, timeoutMs);

  return {
    signal: controller.signal,
    rejection,
    cleanup: () => {
      clearTimeout(timer);
      externalSignal?.removeEventListener("abort", propagateAbort);
    },
  };
}
