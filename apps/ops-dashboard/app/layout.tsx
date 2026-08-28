import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@codestra/apps-shared/ui/globals.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Codestra Ops Dashboard",
  description: "Connector-command health, webhook-delivery status, and tenant activity for Codestra operators.",
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
