import type { ReactNode } from "react";
import { requireStubSession } from "@codestra/apps-shared/auth";

export default async function ProtectedLayout({ children }: { children: ReactNode }): Promise<JSX.Element> {
  await requireStubSession();
  return <>{children}</>;
}
