import type {
  CancelCommunicationInput,
  CommandOperation,
  EmailAddress,
  SendEmailBatchInput,
  SendEmailInput,
  SendSmsBatchInput,
  SendSmsInput,
  VoiceCallInput,
  VoiceTransferInput,
} from "./types.js";
import { CodestraCommunicationsContractViolationError } from "./errors.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const E164_PATTERN = /^\+[1-9]\d{7,14}$/u;
const OPERATION_STATES = new Set([
  "persisted",
  "queued",
  "dispatching",
  "accepted",
  "readback_pending",
  "completed",
  "failed",
  "reconciliation_required",
  "dead_lettered",
]);

export function validateSendEmailInput(input: SendEmailInput): SendEmailInput {
  const value = object(input, "body");
  emailAddress(value.from, "body.from");
  nonEmptyArray(value.to, "body.to").forEach((recipient, index) => emailAddress(recipient, `body.to[${index}]`));
  optionalAddressList(value.cc, "body.cc");
  optionalAddressList(value.bcc, "body.bcc");
  if (value.replyTo !== undefined) emailAddress(value.replyTo, "body.replyTo");
  boundedString(value.subject, "body.subject", 1, 998);
  requireContentOrTemplate(value, "body");
  if (value.scheduledAt !== undefined) dateTime(value.scheduledAt, "body.scheduledAt");
  if (value.metadata !== undefined) jsonObject(value.metadata, "body.metadata");
  return input;
}

export function validateSendEmailBatchInput(input: SendEmailBatchInput): SendEmailBatchInput {
  const value = object(input, "body");
  nonEmptyArray(value.messages, "body.messages").forEach((message, index) =>
    validateSendEmailInputAtPath(message, `body.messages[${index}]`),
  );
  if (value.metadata !== undefined) jsonObject(value.metadata, "body.metadata");
  return input;
}

export function validateSendSmsInput(input: SendSmsInput): SendSmsInput {
  const value = object(input, "body");
  if (value.from !== undefined) boundedString(value.from, "body.from", 1, 64);
  const to = object(value.to, "body.to");
  phoneNumber(to.phoneNumber, "body.to.phoneNumber");
  boundedString(value.body, "body.body", 1, 1600);
  if (value.mediaUrls !== undefined) {
    nonEmptyArray(value.mediaUrls, "body.mediaUrls", true).forEach((url, index) => absoluteUri(url, `body.mediaUrls[${index}]`));
  }
  if (value.scheduledAt !== undefined) dateTime(value.scheduledAt, "body.scheduledAt");
  if (value.metadata !== undefined) jsonObject(value.metadata, "body.metadata");
  return input;
}

export function validateSendSmsBatchInput(input: SendSmsBatchInput): SendSmsBatchInput {
  const value = object(input, "body");
  nonEmptyArray(value.messages, "body.messages").forEach((message, index) =>
    validateSendSmsInputAtPath(message, `body.messages[${index}]`),
  );
  if (value.metadata !== undefined) jsonObject(value.metadata, "body.metadata");
  return input;
}

export function validateVoiceCallInput(input: VoiceCallInput): VoiceCallInput {
  const value = object(input, "body");
  if (value.from !== undefined) phoneNumber(value.from, "body.from");
  phoneNumber(value.to, "body.to");
  if (value.campaignId !== undefined) boundedString(value.campaignId, "body.campaignId", 1, 120);
  if (value.scriptId !== undefined) boundedString(value.scriptId, "body.scriptId", 1, 120);
  if (value.scheduledAt !== undefined) dateTime(value.scheduledAt, "body.scheduledAt");
  if (value.metadata !== undefined) jsonObject(value.metadata, "body.metadata");
  return input;
}

export function validateVoiceTransferInput(input: VoiceTransferInput): VoiceTransferInput {
  const value = object(input, "body");
  boundedString(value.callId, "body.callId", 1, 180);
  boundedString(value.destination, "body.destination", 1, 180);
  if (value.metadata !== undefined) jsonObject(value.metadata, "body.metadata");
  return input;
}

export function validateCancelCommunicationInput(input: CancelCommunicationInput): CancelCommunicationInput {
  const value = object(input, "body");
  if (value.messageId === undefined && value.operationId === undefined) {
    violation("body must include messageId or operationId.", "body");
  }
  if (value.messageId !== undefined) boundedString(value.messageId, "body.messageId", 1, 180);
  if (value.operationId !== undefined) uuid(value.operationId, "body.operationId");
  if (value.reason !== undefined) boundedString(value.reason, "body.reason", 1, 500);
  return input;
}

export function parseCommandOperation(value: unknown, path = "response"): CommandOperation {
  const operation = object(value, path);
  uuid(operation.command_id, `${path}.command_id`);
  boundedString(operation.tenant_id, `${path}.tenant_id`, 1, 128);
  boundedString(operation.command_type, `${path}.command_type`, 1, 180);
  if (operation.command_version !== "1.0") violation(`${path}.command_version must be 1.0.`, `${path}.command_version`);
  boundedString(operation.target, `${path}.target`, 1, 100);
  boundedString(operation.requested_by, `${path}.requested_by`, 1, 300);
  boundedString(operation.correlation_id, `${path}.correlation_id`, 1, 180);
  boundedString(operation.idempotency_key, `${path}.idempotency_key`, 8, 180);
  boundedString(operation.capability, `${path}.capability`, 3, 101);
  enumValue(operation.state, OPERATION_STATES, `${path}.state`);
  if (operation.provider_operation_id !== undefined && operation.provider_operation_id !== null) {
    boundedString(operation.provider_operation_id, `${path}.provider_operation_id`, 1, 300);
  }
  if (operation.last_error !== undefined && operation.last_error !== null) {
    boundedString(operation.last_error, `${path}.last_error`, 1, 2000);
  }
  dateTime(operation.created_at, `${path}.created_at`);
  dateTime(operation.updated_at, `${path}.updated_at`);
  if (typeof operation.duplicate !== "boolean") violation(`${path}.duplicate must be a boolean.`, `${path}.duplicate`);
  return operation as unknown as CommandOperation;
}

export function parseJsonObject(value: unknown, path = "response"): Record<string, unknown> {
  return object(value, path);
}

function validateSendEmailInputAtPath(input: unknown, path: string): void {
  const value = object(input, path);
  emailAddress(value.from, `${path}.from`);
  nonEmptyArray(value.to, `${path}.to`).forEach((recipient, index) => emailAddress(recipient, `${path}.to[${index}]`));
  optionalAddressList(value.cc, `${path}.cc`);
  optionalAddressList(value.bcc, `${path}.bcc`);
  if (value.replyTo !== undefined) emailAddress(value.replyTo, `${path}.replyTo`);
  boundedString(value.subject, `${path}.subject`, 1, 998);
  requireContentOrTemplate(value, path);
  if (value.scheduledAt !== undefined) dateTime(value.scheduledAt, `${path}.scheduledAt`);
  if (value.metadata !== undefined) jsonObject(value.metadata, `${path}.metadata`);
}

function validateSendSmsInputAtPath(input: unknown, path: string): void {
  const value = object(input, path);
  if (value.from !== undefined) boundedString(value.from, `${path}.from`, 1, 64);
  const to = object(value.to, `${path}.to`);
  phoneNumber(to.phoneNumber, `${path}.to.phoneNumber`);
  boundedString(value.body, `${path}.body`, 1, 1600);
  if (value.mediaUrls !== undefined) {
    nonEmptyArray(value.mediaUrls, `${path}.mediaUrls`, true).forEach((url, index) => absoluteUri(url, `${path}.mediaUrls[${index}]`));
  }
  if (value.scheduledAt !== undefined) dateTime(value.scheduledAt, `${path}.scheduledAt`);
  if (value.metadata !== undefined) jsonObject(value.metadata, `${path}.metadata`);
}

function optionalAddressList(value: unknown, path: string): void {
  if (value === undefined) return;
  nonEmptyArray(value, path, true).forEach((address, index) => emailAddress(address, `${path}[${index}]`));
}

function requireContentOrTemplate(value: Record<string, unknown>, path: string): void {
  if (value.content === undefined && value.template === undefined) {
    violation(`${path} must include content or template.`, path);
  }
  if (value.content !== undefined) {
    const content = object(value.content, `${path}.content`);
    if (content.text === undefined && content.html === undefined) {
      violation(`${path}.content must include text or html.`, `${path}.content`);
    }
    if (content.text !== undefined) boundedString(content.text, `${path}.content.text`, 1, 100_000);
    if (content.html !== undefined) boundedString(content.html, `${path}.content.html`, 1, 250_000);
  }
  if (value.template !== undefined) {
    const template = object(value.template, `${path}.template`);
    boundedString(template.templateId, `${path}.template.templateId`, 1, 180);
    if (template.version !== undefined) boundedString(template.version, `${path}.template.version`, 1, 80);
    if (template.locale !== undefined) boundedString(template.locale, `${path}.template.locale`, 1, 35);
    if (template.variables !== undefined) jsonObject(template.variables, `${path}.template.variables`);
  }
}

function emailAddress(value: unknown, path: string): EmailAddress {
  const address = object(value, path);
  const email = boundedString(address.email, `${path}.email`, 3, 320);
  if (!EMAIL_PATTERN.test(email)) violation(`${path}.email must be an email address.`, `${path}.email`);
  if (address.name !== undefined) boundedString(address.name, `${path}.name`, 1, 200);
  return address as unknown as EmailAddress;
}

function phoneNumber(value: unknown, path: string): string {
  const text = boundedString(value, path, 8, 16);
  if (!E164_PATTERN.test(text)) violation(`${path} must be an E.164 phone number.`, path);
  return text;
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) violation(`${path} must be an object.`, path);
  return value as Record<string, unknown>;
}

function jsonObject(value: unknown, path: string): Record<string, unknown> {
  return object(value, path);
}

function nonEmptyArray(value: unknown, path: string, allowEmpty = false): unknown[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) violation(`${path} must be a non-empty array.`, path);
  return value;
}

function boundedString(value: unknown, path: string, min: number, max: number): string {
  if (typeof value !== "string" || value.length < min || value.length > max || /[\u0000-\u001f]/u.test(value)) {
    violation(`${path} must be a bounded string.`, path);
  }
  return value;
}

function uuid(value: unknown, path: string): string {
  const text = boundedString(value, path, 1, 100);
  if (!UUID_PATTERN.test(text)) violation(`${path} must be a UUID.`, path);
  return text;
}

function dateTime(value: unknown, path: string): string {
  const text = boundedString(value, path, 1, 100);
  if (Number.isNaN(Date.parse(text))) violation(`${path} must be a date-time.`, path);
  return text;
}

function absoluteUri(value: unknown, path: string): string {
  const text = boundedString(value, path, 1, 2048);
  try {
    new URL(text);
  } catch {
    violation(`${path} must be an absolute URI.`, path);
  }
  return text;
}

function enumValue(value: unknown, allowed: ReadonlySet<string>, path: string): string {
  const text = boundedString(value, path, 1, 200);
  if (!allowed.has(text)) violation(`${path} is not a supported value.`, path);
  return text;
}

function violation(message: string, path: string): never {
  throw new CodestraCommunicationsContractViolationError(message, path);
}
