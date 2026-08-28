import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getStubSession } from "@codestra/apps-shared/auth";
import "@codestra/apps-shared/ui/globals.css";
import "./globals.css";
import { DevPortalShell } from "../components/DevPortalShell";

export const metadata: Metadata = {
  title: "Codestra Developer Portal",
  description: "API reference, event catalogue, webhook-subscription management, and API credentials.",
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  const session = getStubSession();
  return (
    <html lang="en">
      <body>
        <DevPortalShell session={session}>{children}</DevPortalShell>
      </body>
    </html>
  );
}
