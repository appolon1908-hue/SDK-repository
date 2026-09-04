"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { defaultStubTenantId, STUB_SESSION_COOKIE, type StubSession } from "./session.js";

/**
 * Server Action backing the stub `/login` form in every app. See the
 * "DEVELOPMENT AUTH STUB" note in `./session.ts` for what replaces this in
 * production.
 */
export async function createStubSession(formData: FormData): Promise<void> {
  const subjectRaw = formData.get("subject");
  const tenantIdRaw = formData.get("tenantId");
  const redirectTo = formData.get("redirectTo");

  const subject = typeof subjectRaw === "string" && subjectRaw.trim() ? subjectRaw.trim() : "dev-operator";
  const tenantId =
    typeof tenantIdRaw === "string" && tenantIdRaw.trim() ? tenantIdRaw.trim() : defaultStubTenantId();

  const session: StubSession = { subject, tenantId };
  (await cookies()).set(STUB_SESSION_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  redirect(typeof redirectTo === "string" && redirectTo.startsWith("/") ? redirectTo : "/");
}

export async function clearStubSession(): Promise<void> {
  (await cookies()).delete(STUB_SESSION_COOKIE);
  redirect("/login");
}
