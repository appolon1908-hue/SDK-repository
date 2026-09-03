import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@codestra/apps-shared/ui/globals.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Codestra Admin Console",
  description: "Tenant provisioning, user management, and read-only externally-configured identity/SMTP settings.",
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
