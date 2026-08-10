import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import "./globals.css";
import LayoutShell from "@/components/LayoutShell";
import { isSetupComplete } from "@/lib/db";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Squibble: Academic Outreach, Automated",
  description: "Self-hosted AI research-outreach tool.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (pathname !== "/setup" && !pathname.startsWith("/api") && !isSetupComplete()) {
    redirect("/setup");
  }

  return (
    <html lang="en" className={dmSans.variable}>
      <body>
        {/* next/font skips font preload in dev builds; React 19 hoists this to <head> so DM Sans loads before text renders, matching production. */}
        <link
          rel="preload"
          href="/_next/static/media/13971731025ec697-s.p.woff2"
          as="font"
          type="font/woff2"
          crossOrigin=""
        />
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
