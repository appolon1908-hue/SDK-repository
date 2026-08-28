import type { JsonObject } from "@codestra/contracts";

export class CodestraSdkError extends Error {
  readonly code: string;

  constructor(message: string, code = "SDK_ERROR", options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}

export class CodestraConfigurationError extends CodestraSdkError {
  constructor(message: string) {
    super(message, "CONFIGURATION_ERROR");
  }
}

export class CodestraTimeoutError extends CodestraSdkError {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Codestra request exceeded the ${timeoutMs}ms timeout.`, "REQUEST_TIMEOUT");
    this.timeoutMs = timeoutMs;
  }
}

export class CodestraApiError extends CodestraSdkError {
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
