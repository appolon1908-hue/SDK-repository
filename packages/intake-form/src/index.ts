export type IntakeIndustry =
  | "general"
  | "financial_services"
  | "transportation_logistics"
  | "home_services"
  | "medical_transportation"
  | "software_services"
  | "real_estate"
  | "insurance"
  | "education"
  | "nonprofit"
  | "contact_center";

export type FieldType = "text" | "email" | "tel" | "textarea" | "select" | "date" | "number" | "checkbox";

export interface FormOption { value: string; label: string }
export interface FormField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: readonly FormOption[];
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  sensitive?: boolean;
  helpText?: string;
}

export interface ConsentDefinition {
  key: "privacy" | "marketing" | "sms" | "email";
  required: boolean;
  label: string;
  policyVersion?: string;
}

export interface FormDefinition {
  id: string;
  version: string;
  industry: IntakeIndustry;
  formType: string;
  title: string;
  fields: readonly FormField[];
  consents: readonly ConsentDefinition[];
  prohibitedFields?: readonly string[];
  metadata?: Record<string, string>;
}

export interface FormContext {
  tenantId: string;
  siteId: string;
  campaignId?: string;
  source?: "form" | "landing_page" | "chat" | "voice" | "api" | "other";
  attribution?: Record<string, string | undefined>;
  metadata?: Record<string, unknown>;
}

export interface FormValidationError { field: string; code: string; message: string }
export interface FormValidationResult { valid: boolean; errors: FormValidationError[] }

export interface IntakeCompatibleSubmission {
  tenantId: string;
  siteId: string;
  submittedAt: string;
  source: "form" | "landing_page" | "chat" | "voice" | "api" | "other";
  formId: string;
  campaignId?: string;
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  consent: { marketing?: boolean; sms?: boolean; email?: boolean; privacyPolicyVersion?: string };
  attribution?: Record<string, string | undefined>;
  fields: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export class IntakeFormRegistry {
  private readonly definitions = new Map<string, FormDefinition>();

  constructor(definitions: readonly FormDefinition[] = []) {
    for (const definition of definitions) this.register(definition);
  }

  register(definition: FormDefinition): this {
    assertDefinition(definition);
    this.definitions.set(registryKey(definition.id, definition.version), freezeDefinition(definition));
    return this;
  }

  get(id: string, version?: string): FormDefinition {
    if (version) {
      const exact = this.definitions.get(registryKey(id, version));
      if (!exact) throw new Error(`Unknown intake form: ${id}@${version}`);
      return exact;
    }
    const matches = [...this.definitions.values()].filter((item) => item.id === id);
    if (matches.length === 0) throw new Error(`Unknown intake form: ${id}`);
    return matches.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))[0];
  }

  list(industry?: IntakeIndustry): readonly FormDefinition[] {
    return [...this.definitions.values()].filter((item) => !industry || item.industry === industry);
  }
}

export function validateForm(definition: FormDefinition, values: Record<string, unknown>): FormValidationResult {
  const errors: FormValidationError[] = [];
  const prohibited = new Set(definition.prohibitedFields ?? []);
  for (const key of Object.keys(values)) {
    if (prohibited.has(key)) errors.push({ field: key, code: "prohibited_field", message: "This field may not be collected by this form." });
  }

  for (const field of definition.fields) {
    const raw = values[field.key];
    const empty = raw === undefined || raw === null || raw === "" || raw === false;
    if (field.required && empty) {
      errors.push({ field: field.key, code: "required", message: `${field.label} is required.` });
      continue;
    }
    if (empty) continue;
    if (field.type === "checkbox" && typeof raw !== "boolean") errors.push(typeError(field));
    if (["text", "email", "tel", "textarea", "select", "date"].includes(field.type) && typeof raw !== "string") errors.push(typeError(field));
    if (field.type === "number" && typeof raw !== "number") errors.push(typeError(field));
    if (typeof raw === "string") {
      if (field.minLength && raw.length < field.minLength) errors.push({ field: field.key, code: "min_length", message: `${field.label} is too short.` });
      if (field.maxLength && raw.length > field.maxLength) errors.push({ field: field.key, code: "max_length", message: `${field.label} is too long.` });
      if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) errors.push({ field: field.key, code: "email", message: "Enter a valid email address." });
      if (field.options && !field.options.some((option) => option.value === raw)) errors.push({ field: field.key, code: "option", message: `${field.label} contains an unsupported value.` });
      if (field.pattern && !new RegExp(field.pattern).test(raw)) errors.push({ field: field.key, code: "pattern", message: `${field.label} has an invalid format.` });
    }
  }
  return { valid: errors.length === 0, errors };
}

export function buildIntakeSubmission(
  definition: FormDefinition,
  context: FormContext,
  values: Record<string, unknown>,
): IntakeCompatibleSubmission {
  const validation = validateForm(definition, values);
  if (!validation.valid) throw new FormValidationException(validation.errors);

  const privacy = booleanValue(values.privacyConsent);
  const requiredPrivacy = definition.consents.some((item) => item.key === "privacy" && item.required);
  if (requiredPrivacy && !privacy) throw new FormValidationException([{ field: "privacyConsent", code: "consent_required", message: "Privacy consent is required." }]);

  return {
    tenantId: context.tenantId,
    siteId: context.siteId,
    submittedAt: new Date().toISOString(),
    source: context.source ?? "form",
    formId: `${definition.id}@${definition.version}`,
    campaignId: context.campaignId,
    name: stringValue(values.name),
    email: stringValue(values.email),
    phone: stringValue(values.phone),
    message: stringValue(values.message),
    consent: {
      marketing: booleanValue(values.marketingConsent),
      sms: booleanValue(values.smsConsent),
      email: booleanValue(values.emailConsent),
      privacyPolicyVersion: definition.consents.find((item) => item.key === "privacy")?.policyVersion,
    },
    attribution: context.attribution,
    fields: pickIndustryFields(definition, values),
    metadata: {
      ...context.metadata,
      intakeIndustry: definition.industry,
      intakeFormType: definition.formType,
      intakeFormVersion: definition.version,
    },
  };
}

export class FormValidationException extends Error {
  constructor(readonly errors: FormValidationError[]) {
    super("Intake form validation failed");
  }
}

function pickIndustryFields(definition: FormDefinition, values: Record<string, unknown>): Record<string, unknown> {
  const common = new Set(["name", "email", "phone", "message", "privacyConsent", "marketingConsent", "smsConsent", "emailConsent"]);
  return Object.fromEntries(definition.fields.filter((field) => !common.has(field.key)).map((field) => [field.key, values[field.key]]).filter(([, value]) => value !== undefined));
}

function assertDefinition(definition: FormDefinition): void {
  if (!definition.id || !definition.version || !definition.formType) throw new Error("Form id, version and formType are required");
  const keys = definition.fields.map((field) => field.key);
  if (new Set(keys).size !== keys.length) throw new Error(`Duplicate field key in ${definition.id}@${definition.version}`);
  if (definition.fields.some((field) => field.sensitive)) throw new Error(`Sensitive fields require a protected workflow and may not be registered in public intake: ${definition.id}`);
}

function freezeDefinition(definition: FormDefinition): FormDefinition {
  return Object.freeze({ ...definition, fields: Object.freeze([...definition.fields]), consents: Object.freeze([...definition.consents]) });
}
function registryKey(id: string, version: string): string { return `${id}@${version}`; }
function typeError(field: FormField): FormValidationError { return { field: field.key, code: "type", message: `${field.label} has an invalid value.` }; }
function stringValue(value: unknown): string | undefined { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
function booleanValue(value: unknown): boolean | undefined { return typeof value === "boolean" ? value : undefined; }
