"use client";

import { useState, type FormEvent } from "react";
import type {
  WebhookSubscription,
  WebhookSubscriptionCreated,
  WebhookSubscriptionSecretRotation,
} from "@codestra/contracts";
import { DataTable, StatusPill } from "@codestra/apps-shared/ui";
import { validateCreateSubscriptionInput } from "./validation";

export interface WebhookSubscriptionsManagerProps {
  initialSubscriptions: readonly WebhookSubscription[];
  eventTypeOptions: readonly string[];
}

interface RevealedSecret {
  subscriptionId: string;
  kind: "created" | "rotated";
  signingSecret: string;
  previousSecretExpiresAt?: string;
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "error" in body) {
      const error = (body as { error: unknown }).error;
      return typeof error === "string" ? error : JSON.stringify(error);
    }
  } catch {
    // fall through
  }
  return `Request failed with status ${response.status}.`;
}

export function WebhookSubscriptionsManager({
  initialSubscriptions,
  eventTypeOptions,
}: WebhookSubscriptionsManagerProps): JSX.Element {
  const [subscriptions, setSubscriptions] = useState<WebhookSubscription[]>([...initialSubscriptions]);
  const [endpointUrl, setEndpointUrl] = useState("");
  const [description, setDescription] = useState("");
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);
  const [formErrors, setFormErrors] = useState<{ endpointUrl?: string; eventTypes?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<RevealedSecret | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function toggleEventType(eventType: string): void {
    setSelectedEventTypes((current) =>
      current.includes(eventType) ? current.filter((value) => value !== eventType) : [...current, eventType],
    );
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const validation = validateCreateSubscriptionInput({
      endpointUrl,
      eventTypes: selectedEventTypes,
      description,
    });
    setFormErrors(validation.errors);
    if (!validation.valid) return;

    setSubmitting(true);
    setActionError(null);
    try {
      const response = await fetch("/api/webhook-subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpointUrl, eventTypes: selectedEventTypes, description: description || undefined }),
      });
      if (!response.ok) throw new Error(await parseErrorMessage(response));
      const created = (await response.json()) as WebhookSubscriptionCreated;
      setSubscriptions((current) => [created.subscription, ...current]);
      setRevealedSecret({
        subscriptionId: created.subscription.id,
        kind: "created",
        signingSecret: created.signingSecret,
      });
      setEndpointUrl("");
      setDescription("");
      setSelectedEventTypes([]);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to create the webhook subscription.");
    } finally {
      setSubmitting(false);
    }
  }

  async function runAction(subscriptionId: string, path: string): Promise<void> {
    setSubmitting(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/webhook-subscriptions/${subscriptionId}${path}`, { method: "POST" });
      if (!response.ok) throw new Error(await parseErrorMessage(response));

      if (path === "/rotate-secret") {
        const rotation = (await response.json()) as WebhookSubscriptionSecretRotation;
        setSubscriptions((current) =>
          current.map((item) => (item.id === subscriptionId ? rotation.subscription : item)),
        );
        setRevealedSecret({
          subscriptionId,
          kind: "rotated",
          signingSecret: rotation.signingSecret,
          previousSecretExpiresAt: rotation.previousSecretExpiresAt,
        });
      } else if (path === "/test") {
        const delivery = (await response.json()) as { deliveryId: string; status: string };
        setStatusMessage(`Test delivery ${delivery.status} (delivery ${delivery.deliveryId}).`);
      } else {
        const subscription = (await response.json()) as WebhookSubscription;
        setSubscriptions((current) => current.map((item) => (item.id === subscriptionId ? subscription : item)));
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(subscriptionId: string): Promise<void> {
    setSubmitting(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/webhook-subscriptions/${subscriptionId}`, { method: "DELETE" });
      if (!response.ok && response.status !== 204) throw new Error(await parseErrorMessage(response));
      setSubscriptions((current) => current.filter((item) => item.id !== subscriptionId));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to delete the subscription.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>Webhook subscriptions</h1>
      <p className="cds-page-subtitle">
        Manage the endpoints Codestra delivers signed CloudEvents to, through the real{" "}
        <code>webhooks.subscriptions</code> operations in{" "}
        <code>contracts/openapi/codestra-public.openapi.yaml</code>.
      </p>

      <section className="cds-section">
        <h2>Register a new endpoint</h2>
        <form className="cds-form" onSubmit={handleCreate}>
          <label htmlFor="endpointUrl">Endpoint URL</label>
          <input
            id="endpointUrl"
            name="endpointUrl"
            type="url"
            placeholder="https://your-app.example.com/hooks/codestra"
            value={endpointUrl}
            onChange={(event) => setEndpointUrl(event.target.value)}
          />
          {formErrors.endpointUrl ? <span className="cds-form-error">{formErrors.endpointUrl}</span> : null}

          <label htmlFor="description">Description (optional)</label>
          <input id="description" name="description" type="text" value={description} onChange={(event) => setDescription(event.target.value)} />

          <span>Event types</span>
          <div className="cds-checkbox-group" role="group" aria-label="Event types">
            {eventTypeOptions.map((eventType) => (
              <label key={eventType}>
                <input
                  type="checkbox"
                  checked={selectedEventTypes.includes(eventType)}
                  onChange={() => toggleEventType(eventType)}
                />
                {eventType}
              </label>
            ))}
          </div>
          {formErrors.eventTypes ? <span className="cds-form-error">{formErrors.eventTypes}</span> : null}

          <div className="cds-form-actions">
            <button type="submit" className="cds-button-primary" disabled={submitting}>
              Create subscription
            </button>
          </div>
        </form>
      </section>

      {revealedSecret ? (
        <div className="cds-secret-reveal" role="status">
          <strong>
            {revealedSecret.kind === "created" ? "Subscription created." : "Secret rotated."} This signing secret
            is shown once -- store it now.
          </strong>
          <code className="cds-secret-value">{revealedSecret.signingSecret}</code>
          {revealedSecret.previousSecretExpiresAt ? (
            <p>Previous secret accepted until {new Date(revealedSecret.previousSecretExpiresAt).toLocaleString()}.</p>
          ) : null}
          <button type="button" className="cds-button-ghost" onClick={() => setRevealedSecret(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      {statusMessage ? <p role="status">{statusMessage}</p> : null}
      {actionError ? <p className="cds-form-error" role="alert">{actionError}</p> : null}

      <section className="cds-section">
        <h2>Your subscriptions</h2>
        <DataTable
          rows={subscriptions}
          getRowKey={(row) => row.id}
          emptyMessage="No webhook subscriptions yet -- create one above."
          columns={[
            { key: "endpointUrl", header: "Endpoint", render: (row) => row.endpointUrl },
            { key: "eventTypes", header: "Event types", render: (row) => row.eventTypes.join(", ") },
            { key: "status", header: "Status", render: (row) => <StatusPill status={row.status} /> },
            {
              key: "verification",
              header: "Verification",
              render: (row) => (row.verification ? <StatusPill status={row.verification.status} /> : "—"),
            },
            {
              key: "actions",
              header: "Actions",
              render: (row) => (
                <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                  {row.status === "active" ? (
                    <button type="button" className="cds-button-ghost" disabled={submitting} onClick={() => runAction(row.id, "/disable")}>
                      Disable
                    </button>
                  ) : (
                    <button type="button" className="cds-button-ghost" disabled={submitting} onClick={() => runAction(row.id, "/enable")}>
                      Enable
                    </button>
                  )}
                  <button type="button" className="cds-button-ghost" disabled={submitting} onClick={() => runAction(row.id, "/test")}>
                    Send test
                  </button>
                  <button type="button" className="cds-button-ghost" disabled={submitting} onClick={() => runAction(row.id, "/rotate-secret")}>
                    Rotate secret
                  </button>
                  <button type="button" className="cds-button-danger" disabled={submitting} onClick={() => handleDelete(row.id)}>
                    Delete
                  </button>
                </div>
              ),
            },
          ]}
        />
      </section>
    </div>
  );
}
