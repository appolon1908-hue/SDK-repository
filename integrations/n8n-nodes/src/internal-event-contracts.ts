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

export interface ChannelDelivery {
  channel: SocialChannel;
  status: SocialPostStatus;
  externalId?: string;
  failureCode?: string;
  failureMessage?: string;
}

export interface SocialPostStatusEventData {
  postId: UUID;
  tenantId: UUID;
  previousStatus?: SocialPostStatus;
  status: SocialPostStatus;
  deliveries: ChannelDelivery[];
  occurredAt: ISODateTime;
}

export interface WebhookDeliveryStatusEventData {
  deliveryId: UUID;
  endpointId: UUID;
  status: "queued" | "attempting" | "delivered" | "failed" | "dead_lettered";
  attempt?: number;
  occurredAt: ISODateTime;
}

export interface CloudEvent<TData = JsonObject> {
  specversion: "1.0";
  id: UUID;
  tenantid: UUID;
  source: string;
  type: string;
  subject?: string;
  time: ISODateTime;
  datacontenttype: "application/json";
  dataschema?: string;
  data: TData;
}

export type CodestraCanonicalEvent =
  | (CloudEvent<SocialPostStatusEventData> & { type: "codestra.social.post.status.v1" })
  | (CloudEvent<WebhookDeliveryStatusEventData> & {
      type: "codestra.webhook.delivery.status.v1";
    });
