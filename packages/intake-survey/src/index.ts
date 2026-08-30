export type SurveyQuestionType =
  | "single_choice"
  | "multiple_choice"
  | "rating"
  | "nps"
  | "yes_no"
  | "text"
  | "textarea"
  | "matrix";

export interface SurveyOption { value: string; label: string }
export interface SurveyBranchRule {
  whenQuestionId: string;
  operator: "equals" | "includes";
  value: string;
}
export interface SurveyQuestion {
  id: string;
  label: string;
  type: SurveyQuestionType;
  required?: boolean;
  options?: readonly SurveyOption[];
  min?: number;
  max?: number;
  maxLength?: number;
  sensitive?: boolean;
  visibleWhen?: SurveyBranchRule;
}
export interface SurveyDefinition {
  id: string;
  version: string;
  title: string;
  category: "csat" | "nps" | "post_service" | "post_call" | "market_research" | "qualification" | "onboarding" | "employee" | "event" | "nonprofit_impact" | "custom";
  questions: readonly SurveyQuestion[];
  anonymousAllowed?: boolean;
  expiresAt?: string;
  prohibitedFields?: readonly string[];
  metadata?: Record<string, string>;
}
export interface SurveyContext {
  tenantId: string;
  siteId: string;
  campaignId?: string;
  source?: "form" | "landing_page" | "chat" | "voice" | "api" | "other";
  contactId?: string;
  leadId?: string;
  anonymous?: boolean;
  locale?: string;
  attribution?: Record<string, string | undefined>;
  metadata?: Record<string, unknown>;
}
export interface SurveyValidationError { questionId: string; code: string; message: string }
export interface SurveyValidationResult { valid: boolean; errors: SurveyValidationError[] }
export interface SurveySubmission {
  tenantId: string;
  siteId: string;
  campaignId?: string;
  source: "form" | "landing_page" | "chat" | "voice" | "api" | "other";
  submittedAt: string;
  formId: string;
  fields: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export class IntakeSurveyRegistry {
  private readonly definitions = new Map<string, SurveyDefinition>();
  constructor(definitions: readonly SurveyDefinition[] = []) { for (const definition of definitions) this.register(definition); }
  register(definition: SurveyDefinition): this {
    assertDefinition(definition);
    this.definitions.set(key(definition.id, definition.version), freezeDefinition(definition));
    return this;
  }
  get(id: string, version?: string): SurveyDefinition {
    if (version) {
      const found = this.definitions.get(key(id, version));
      if (!found) throw new Error(`Unknown intake survey: ${id}@${version}`);
      return found;
    }
    const matches = [...this.definitions.values()].filter((item) => item.id === id);
    if (!matches.length) throw new Error(`Unknown intake survey: ${id}`);
    return matches.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))[0];
  }
  list(category?: SurveyDefinition["category"]): readonly SurveyDefinition[] {
    return [...this.definitions.values()].filter((item) => !category || item.category === category);
  }
}

export function validateSurvey(definition: SurveyDefinition, answers: Record<string, unknown>, now = new Date()): SurveyValidationResult {
  const errors: SurveyValidationError[] = [];
  if (definition.expiresAt && now.getTime() > new Date(definition.expiresAt).getTime()) {
    errors.push({ questionId: "$survey", code: "expired", message: "This survey has expired." });
  }
  const prohibited = new Set(definition.prohibitedFields ?? []);
  for (const answerKey of Object.keys(answers)) {
    if (prohibited.has(answerKey)) errors.push({ questionId: answerKey, code: "prohibited_field", message: "This information may not be collected by this public survey." });
  }
  for (const question of definition.questions) {
    if (!isVisible(question, answers)) continue;
    const value = answers[question.id];
    const empty = value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
    if (question.required && empty) {
      errors.push({ questionId: question.id, code: "required", message: `${question.label} is required.` });
      continue;
    }
    if (empty) continue;
    validateAnswer(question, value, errors);
  }
  return { valid: errors.length === 0, errors };
}

export function buildSurveySubmission(definition: SurveyDefinition, context: SurveyContext, answers: Record<string, unknown>): SurveySubmission {
  const validation = validateSurvey(definition, answers);
  if (!validation.valid) throw new SurveyValidationException(validation.errors);
  if (context.anonymous && !definition.anonymousAllowed) {
    throw new SurveyValidationException([{ questionId: "$survey", code: "anonymous_not_allowed", message: "Anonymous responses are not allowed for this survey." }]);
  }
  return {
    tenantId: context.tenantId,
    siteId: context.siteId,
    campaignId: context.campaignId,
    source: context.source ?? "form",
    submittedAt: new Date().toISOString(),
    formId: `survey:${definition.id}@${definition.version}`,
    fields: { surveyAnswers: pickVisibleAnswers(definition, answers) },
    metadata: {
      ...context.metadata,
      intakeKind: "survey",
      surveyId: definition.id,
      surveyVersion: definition.version,
      surveyCategory: definition.category,
      anonymous: Boolean(context.anonymous),
      locale: context.locale,
      contactId: context.anonymous ? undefined : context.contactId,
      leadId: context.anonymous ? undefined : context.leadId,
      attribution: context.attribution,
    },
  };
}

export class SurveyValidationException extends Error {
  constructor(readonly errors: SurveyValidationError[]) { super("Intake survey validation failed"); }
}

export function calculateNps(values: readonly number[]): { score: number; promoters: number; passives: number; detractors: number } {
  if (!values.length) return { score: 0, promoters: 0, passives: 0, detractors: 0 };
  for (const value of values) if (!Number.isInteger(value) || value < 0 || value > 10) throw new Error("NPS values must be integers from 0 to 10");
  const promoters = values.filter((value) => value >= 9).length;
  const passives = values.filter((value) => value >= 7 && value <= 8).length;
  const detractors = values.filter((value) => value <= 6).length;
  const score = Math.round(((promoters - detractors) / values.length) * 100);
  return { score, promoters, passives, detractors };
}

function validateAnswer(question: SurveyQuestion, value: unknown, errors: SurveyValidationError[]): void {
  const fail = (code: string, message: string) => errors.push({ questionId: question.id, code, message });
  if (["text", "textarea", "single_choice", "yes_no"].includes(question.type) && typeof value !== "string") return fail("type", `${question.label} has an invalid value.`);
  if (question.type === "multiple_choice" && (!Array.isArray(value) || value.some((item) => typeof item !== "string"))) return fail("type", `${question.label} has an invalid value.`);
  if (["rating", "nps"].includes(question.type) && typeof value !== "number") return fail("type", `${question.label} must be numeric.`);
  if (typeof value === "string" && question.maxLength && value.length > question.maxLength) fail("max_length", `${question.label} is too long.`);
  if (typeof value === "number") {
    const min = question.type === "nps" ? 0 : question.min;
    const max = question.type === "nps" ? 10 : question.max;
    if ((min !== undefined && value < min) || (max !== undefined && value > max)) fail("range", `${question.label} is outside the allowed range.`);
  }
  if (question.options) {
    const allowed = new Set(question.options.map((option) => option.value));
    if (typeof value === "string" && !allowed.has(value)) fail("option", `${question.label} contains an unsupported value.`);
    if (Array.isArray(value) && value.some((item) => !allowed.has(String(item)))) fail("option", `${question.label} contains an unsupported value.`);
  }
}
function isVisible(question: SurveyQuestion, answers: Record<string, unknown>): boolean {
  if (!question.visibleWhen) return true;
  const current = answers[question.visibleWhen.whenQuestionId];
  return question.visibleWhen.operator === "equals"
    ? current === question.visibleWhen.value
    : Array.isArray(current) && current.includes(question.visibleWhen.value);
}
function pickVisibleAnswers(definition: SurveyDefinition, answers: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(definition.questions.filter((q) => isVisible(q, answers) && answers[q.id] !== undefined).map((q) => [q.id, answers[q.id]]));
}
function assertDefinition(definition: SurveyDefinition): void {
  if (!definition.id || !definition.version || !definition.title) throw new Error("Survey id, version and title are required");
  const ids = definition.questions.map((q) => q.id);
  if (new Set(ids).size !== ids.length) throw new Error(`Duplicate survey question id in ${definition.id}@${definition.version}`);
  if (definition.questions.some((q) => q.sensitive)) throw new Error(`Sensitive questions require a separately reviewed protected workflow: ${definition.id}`);
  for (const question of definition.questions) {
    if (["single_choice", "multiple_choice"].includes(question.type) && (!question.options || question.options.length === 0)) throw new Error(`Options are required for ${question.id}`);
  }
}
function freezeDefinition(definition: SurveyDefinition): SurveyDefinition {
  return Object.freeze({ ...definition, questions: Object.freeze([...definition.questions]) });
}
function key(id: string, version: string): string { return `${id}@${version}`; }
