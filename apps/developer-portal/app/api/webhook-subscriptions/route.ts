import { NextResponse } from "next/server";
import { getApiClient, generateIdempotencyKey } from "@codestra/apps-shared";
import { getStubSession } from "@codestra/apps-shared/auth";
import { validateCreateSubscriptionInput } from "../../(protected)/webhooks/validation";

export async function GET(): Promise<NextResponse> {
  const session = getStubSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const client = getApiClient(session);
  const result = await client.webhooks.subscriptions.list();
  return NextResponse.json(result);
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = getStubSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body: unknown = await request.json();
  const record = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const input = {
    endpointUrl: typeof record.endpointUrl === "string" ? record.endpointUrl : "",
    eventTypes: Array.isArray(record.eventTypes)
      ? record.eventTypes.filter((value): value is string => typeof value === "string")
      : [],
    description: typeof record.description === "string" ? record.description : undefined,
  };

  const validation = validateCreateSubscriptionInput(input);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.errors }, { status: 400 });
  }

  const client = getApiClient(session);
  const result = await client.webhooks.subscriptions.create(
    {
      endpointUrl: input.endpointUrl,
      eventTypes: input.eventTypes,
      ...(input.description ? { description: input.description } : {}),
    },
    { idempotencyKey: generateIdempotencyKey() },
  );
  return NextResponse.json(result, { status: 201 });
}
