import type { JsonObject } from "@codestra/contracts";

export class CodestraCommunicationsError extends Error {
  readonly code: string;

  constructor(message: string, code = "COMMUNICATIONS_SDK_ERROR", options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}

export class CodestraCommunicationsConfigurationError extends CodestraCommunicationsError {
  constructor(message: string) {
    super(message, "CONFIGURATION_ERROR");
  }
}

export class CodestraCommunicationsContractViolationError extends CodestraCommunicationsError {
  readonly path: string;

  constructor(message: string, path: string) {
    super(message, "CONTRACT_VIOLATION");
    this.path = path;
  }
}

export class CodestraCommunicationsTimeoutError extends CodestraCommunicationsError {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Codestra communications request exceeded the ${timeoutMs}ms timeout.`, "REQUEST_TIMEOUT");
    this.timeoutMs = timeoutMs;
  }
}

export class CodestraCommunicationsApiError extends CodestraCommunicationsError {
  readonly status: number;
  readonly requestId: string | undefined;
  readonly retryable: boolean;
  readonly details: JsonObject | undefined;

  constructor(input: {
    message: string;
    code: string;
    status: number;
    requestId?: string;
    retryable?: boolean;
    details?: JsonObject;
  }) {
    super(input.message, input.code);
    this.status = input.status;
    this.requestId = input.requestId;
    this.retryable = input.retryable ?? false;
    this.details = input.details;
  }
}
