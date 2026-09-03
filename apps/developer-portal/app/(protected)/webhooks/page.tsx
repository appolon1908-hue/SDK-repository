import { getApiClient } from "@codestra/apps-shared";
import { requireStubSession } from "@codestra/apps-shared/auth";
import { listKnownEventTypes } from "../../../lib/contracts";
import { WebhookSubscriptionsManager } from "./WebhookSubscriptionsManager";

export default async function WebhooksPage(): Promise<JSX.Element> {
  const session = await requireStubSession();
  const client = getApiClient(session);
  const { items } = await client.webhooks.subscriptions.list();
  const eventTypeOptions = listKnownEventTypes();

  return <WebhookSubscriptionsManager initialSubscriptions={items} eventTypeOptions={eventTypeOptions} />;
}
