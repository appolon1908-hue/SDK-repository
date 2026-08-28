import { NextResponse } from "next/server";
import { getApiClient, generateIdempotencyKey } from "@codestra/apps-shared";
import { getStubSession } from "@codestra/apps-shared/auth";

export async function POST(_request: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const session = getStubSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const client = getApiClient(session);
  const subscription = await client.webhooks.subscriptions.enable(params.id, {
    idempotencyKey: generateIdempotencyKey(),
  });
  return NextResponse.json(subscription);
}
