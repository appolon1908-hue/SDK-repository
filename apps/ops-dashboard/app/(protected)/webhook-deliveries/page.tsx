import { getApiClient } from "@codestra/apps-shared";
import { requireStubSession } from "@codestra/apps-shared/auth";
import { buildWebhookDeliveryFixtures } from "@codestra/apps-shared/fixtures";
import { WebhookDeliveriesView } from "./WebhookDeliveriesView";

// Auth is enforced by `app/(protected)/layout.tsx`; `requireStubSession` is
// called again here only to obtain the tenant ID the API client needs.
export default async function WebhookDeliveriesPage(): Promise<JSX.Element> {
  const session = await requireStubSession();
  const client = getApiClient(session);
  const { items: subscriptions } = await client.webhooks.subscriptions.list();
  const deliveries = buildWebhookDeliveryFixtures(subscriptions.map((subscription) => subscription.id));

  return <WebhookDeliveriesView subscriptions={subscriptions} deliveries={deliveries} />;
}
