export type StatusTone = "positive" | "neutral" | "attention" | "negative" | "info";

const TONE_BY_KNOWN_STATUS: Record<string, StatusTone> = {
  // SocialPostStatus / ChannelDelivery status
  accepted: "info",
  scheduled: "info",
  publishing: "info",
  published: "positive",
  partially_published: "attention",
  failed: "negative",
  cancelled: "neutral",
  // WebhookSubscription status
  pending_verification: "attention",
  active: "positive",
  disabled: "neutral",
  verification_failed: "negative",
  // ConnectorHealthStatus
  healthy: "positive",
  degraded: "attention",
  unavailable: "negative",
  // ConnectorCommandOutcome (derived)
  pending: "info",
  dispatched: "info",
  succeeded: "positive",
  indeterminate: "attention",
  // WebhookDeliveryStatusEvent status
  queued: "info",
  attempting: "info",
  delivered: "positive",
  dead_lettered: "negative",
  // Tenant status
  suspended: "negative",
  invited: "attention",
};

export interface StatusPillProps {
  status: string;
  tone?: StatusTone;
}

export function StatusPill({ status, tone }: StatusPillProps): JSX.Element {
  const resolvedTone = tone ?? TONE_BY_KNOWN_STATUS[status] ?? "neutral";
  return (
    <span className={`cds-pill cds-pill-${resolvedTone}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
