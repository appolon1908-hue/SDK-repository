export const CONTRACT_VERSION = "0.1.0" as const;

export type UUID = string;
export type ISODateTime = string;
export type JsonObject = { [key: string]: JsonValue };
export type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];

export type SocialChannel =
  | "facebook"
  | "instagram"
  | "linkedin"
  | "x"
  | "youtube"
  | "tiktok";

export type SocialPostStatus =
  | "accepted"
  | "scheduled"
  | "publishing"
  | "published"
  | "partially_published"
  | "failed"
  | "cancelled";

export interface SocialPostContent {
  text: string;
  mediaUrls?: string[];
  linkUrl?: string;
}

export interface CreateSocialPostInput {
  workspaceId: UUID;
  channels: SocialChannel[];
  content: SocialPostContent;
  publishAt?: ISODateTime;
  metadata?: JsonObject;
}

export interface ListSocialPostsInput {
  cursor?: string;
  limit?: number;
  workspaceId?: UUID;
  status?: SocialPostStatus;
}

export interface ChannelDelivery {
  channel: SocialChannel;
  status: SocialPostStatus;
  externalId?: string;
  failureCode?: string;
  failureMessage?: string;
}

export interface SocialPost {
  id: UUID;
  tenantId: UUID;
  workspaceId: UUID;
  status: SocialPostStatus;
  channels: ChannelDelivery[];
  content: SocialPostContent;
  publishAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface SocialPostList {
  items: SocialPost[];
  nextCursor?: string;
}

export interface WebhookSubscriptionInput {
  endpointUrl: string;
  eventTypes: string[];
  description?: string;
}

export interface WebhookSubscription {
  id: UUID;
  endpointUrl: string;
  eventTypes: string[];
  status: "pending_verification" | "active" | "disabled" | "verification_failed";
  verification?: {
    status: "pending" | "verified" | "failed";
    challengeId?: string;
    verifiedAt?: ISODateTime;
    lastAttemptAt?: ISODateTime;
    failureCode?: string;
  };
  destinationPolicy?: {
    httpsOnly: true;
    privateAddressBlocked: true;
    redirectsBlocked: true;
  };
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  disabledAt?: ISODateTime;
}

export interface WebhookSubscriptionCreated {
  subscription: WebhookSubscription;
  signingSecret: string;
}

export interface WebhookSubscriptionList {
  items: WebhookSubscription[];
  nextCursor?: string;
}

export interface WebhookDeliveryTest {
  deliveryId: UUID;
  subscriptionId: UUID;
  status: "queued" | "rejected";
  acceptedAt: ISODateTime;
}

export interface WebhookSubscriptionSecretRotation {
  subscription: WebhookSubscription;
  signingSecret: string;
  previousSecretExpiresAt: ISODateTime;
}

export interface CodestraErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
    retryable: boolean;
    details?: JsonObject;
  };
}

export interface CloudEvent<TData = JsonObject> {
  specversion: "1.0";
  id: UUID;
  source: string;
  type: string;
  subject?: string;
  time: ISODateTime;
  datacontenttype: "application/json";
  dataschema?: string;
  data: TData;
}

export type CallDisposition =
  | "answered"
  | "no_answer"
  | "busy"
  | "voicemail"
  | "dnc"
  | "callback_requested"
  | "sale_completed"
  | "failed"
  | "dropped"
  | "not_interested"
  | "unknown";

export interface CallDispositionUpdatedEventData {
  event_type: "call_disposition_updated";
  correlation_id: UUID;
  causation_id: string;
  odoo_contact_id?: number | null;
  odoo_lead_id?: number | null;
  disposition: CallDisposition;
  phone_number: string;
  duration_seconds?: number;
  campaign_id?: string | null;
  provider_call_id: string;
  dry_run?: boolean;
}

export interface SmsReceivedEventData {
  event_type: "sms_received";
  correlation_id: UUID;
  causation_id: string;
  odoo_contact_id?: number | null;
  odoo_message_id?: number | null;
  from_number: string;
  body_preview: string;
  provider_event_id: string;
  dry_run?: boolean;
}

export interface SocialPostStatusEventData {
  postId: UUID;
  tenantId: UUID;
  previousStatus?: SocialPostStatus;
  status: SocialPostStatus;
  deliveries: ChannelDelivery[];
  occurredAt: ISODateTime;
}
