import type { ReactNode } from "react";
import { requireStubSession } from "@codestra/apps-shared/auth";

export default function ProtectedLayout({ children }: { children: ReactNode }): JSX.Element {
  requireStubSession();
  return <>{children}</>;
}
