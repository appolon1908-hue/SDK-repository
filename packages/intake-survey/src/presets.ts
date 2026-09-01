import type { SurveyDefinition } from "./index.js";

export const SURVEY_PRESETS: readonly SurveyDefinition[] = [
  {
    id: "customer_csat",
    version: "1.0.0",
    title: "Customer satisfaction",
    category: "csat",
    anonymousAllowed: true,
    questions: [
      { id: "satisfaction", label: "How satisfied are you?", type: "rating", required: true, min: 1, max: 5 },
      { id: "comments", label: "What could we improve?", type: "textarea", maxLength: 2000 },
    ],
  },
  {
    id: "customer_nps",
    version: "1.0.0",
    title: "Net Promoter Score",
    category: "nps",
    anonymousAllowed: true,
    questions: [
      { id: "recommend", label: "How likely are you to recommend us?", type: "nps", required: true },
      { id: "reason", label: "What is the main reason for your score?", type: "textarea", maxLength: 2000 },
    ],
  },
  {
    id: "post_call_quality",
    version: "1.0.0",
    title: "Post-call feedback",
    category: "post_call",
    questions: [
      { id: "resolved", label: "Was your issue resolved?", type: "yes_no", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { id: "agentRating", label: "Rate your interaction", type: "rating", required: true, min: 1, max: 5 },
      { id: "followup", label: "Tell us what still needs attention", type: "textarea", maxLength: 2000, visibleWhen: { whenQuestionId: "resolved", operator: "equals", value: "no" } },
    ],
  },
  {
    id: "service_completion",
    version: "1.0.0",
    title: "Service completion feedback",
    category: "post_service",
    questions: [
      { id: "quality", label: "Rate the quality of service", type: "rating", required: true, min: 1, max: 5 },
      { id: "timeliness", label: "Rate timeliness", type: "rating", required: true, min: 1, max: 5 },
      { id: "comments", label: "Additional feedback", type: "textarea", maxLength: 3000 },
    ],
  },
  {
    id: "lead_qualification",
    version: "1.0.0",
    title: "Needs assessment",
    category: "qualification",
    questions: [
      { id: "priority", label: "What is your top priority?", type: "single_choice", required: true, options: [{ value: "cost", label: "Cost" }, { value: "speed", label: "Speed" }, { value: "quality", label: "Quality" }, { value: "support", label: "Support" }] },
      { id: "timeline", label: "When do you plan to move forward?", type: "single_choice", options: [{ value: "now", label: "Now" }, { value: "30_days", label: "Within 30 days" }, { value: "90_days", label: "Within 90 days" }, { value: "researching", label: "Researching" }] },
    ],
  },
  {
    id: "nonprofit_impact",
    version: "1.0.0",
    title: "Program impact survey",
    category: "nonprofit_impact",
    anonymousAllowed: true,
    questions: [
      { id: "helpfulness", label: "How helpful was the program?", type: "rating", required: true, min: 1, max: 5 },
      { id: "outcome", label: "What changed as a result?", type: "textarea", maxLength: 3000 },
    ],
    prohibitedFields: ["ssn", "bankAccount", "password", "medicalRecord", "diagnosis"],
  },
];
