import type { Metadata } from "next";
import "./globals.css";
import LayoutShell from "@/components/LayoutShell";

export const metadata: Metadata = {
  title: "Squibble — Academic Outreach, Automated",
  description: "AI-powered cold email platform for landing research positions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body>
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
