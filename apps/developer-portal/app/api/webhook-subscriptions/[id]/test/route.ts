import { NextResponse } from "next/server";
import { getApiClient, generateIdempotencyKey } from "@codestra/apps-shared";
import { getStubSession } from "@codestra/apps-shared/auth";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;
  const session = await getStubSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const client = getApiClient(session);
  const delivery = await client.webhooks.subscriptions.test(id, {
    idempotencyKey: generateIdempotencyKey(),
  });
  return NextResponse.json(delivery);
}
