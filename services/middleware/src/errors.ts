import type { JsonObject } from "@codestra/contracts";

/**
 * Every failure response Middleware returns matches
 * contracts/schemas/common/error.schema.json exactly:
 * `{ error: { code, message, requestId, retryable, details? } }`.
 */
export class CodestraError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;
  readonly details: JsonObject | undefined;

  constructor(
    status: number,
    code: string,
    message: string,
    options: { retryable?: boolean; details?: JsonObject } = {},
  ) {
    super(message);
    this.name = "CodestraError";
    this.status = status;
    this.code = code;
    this.retryable = options.retryable ?? (status >= 500 || status === 429);
    this.details = options.details;
  }

  toBody(requestId: string): {
    error: { code: string; message: string; requestId: string; retryable: boolean; details?: JsonObject };
  } {
    return {
      error: {
        code: this.code,
        message: this.message,
        requestId,
        retryable: this.retryable,
        ...(this.details === undefined ? {} : { details: this.details }),
      },
    };
  }
}

export function notFound(resource: string, id: string): CodestraError {
  return new CodestraError(404, "NOT_FOUND", `${resource} ${id} was not found.`, {
    retryable: false,
    details: { resource, id },
  });
}

export function badRequest(message: string, details?: JsonObject): CodestraError {
  return new CodestraError(400, "VALIDATION_ERROR", message, {
    retryable: false,
    ...(details === undefined ? {} : { details }),
  });
}

export function unprocessable(code: string, message: string, details?: JsonObject): CodestraError {
  return new CodestraError(422, code, message, { retryable: false, ...(details === undefined ? {} : { details }) });
}

export function conflict(
  code: string,
  message: string,
  options: { retryable?: boolean; details?: JsonObject } = {},
): CodestraError {
  return new CodestraError(409, code, message, {
    retryable: options.retryable ?? false,
    ...(options.details === undefined ? {} : { details: options.details }),
  });
}

export function unauthorized(code: string, message: string): CodestraError {
  return new CodestraError(401, code, message, { retryable: false });
}

export function forbidden(code: string, message: string): CodestraError {
  return new CodestraError(403, code, message, { retryable: false });
}
