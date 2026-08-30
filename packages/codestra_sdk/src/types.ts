import type { JsonObject } from "@codestra/contracts";

export interface GenerateAiInput {
  prompt: string;
  model?: string;
  metadata?: JsonObject;
}

export interface TriggerWorkflowInput {
  workflow: string;
  payload?: JsonObject;
}

export interface MarketingCampaignListOptions {
  cursor?: string;
  limit?: number;
  status?: string;
  signal?: AbortSignal;
  correlationId?: string;
}

export interface CrmLeadListOptions {
  cursor?: string;
  limit?: number;
  status?: string;
  signal?: AbortSignal;
  correlationId?: string;
}
