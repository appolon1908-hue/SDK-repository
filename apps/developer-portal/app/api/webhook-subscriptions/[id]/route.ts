import { NextResponse } from "next/server";
import { getApiClient, generateIdempotencyKey } from "@codestra/apps-shared";
import { getStubSession } from "@codestra/apps-shared/auth";

export async function DELETE(_request: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const session = getStubSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const client = getApiClient(session);
  await client.webhooks.subscriptions.delete(params.id, { idempotencyKey: generateIdempotencyKey() });
  return new NextResponse(null, { status: 204 });
}
