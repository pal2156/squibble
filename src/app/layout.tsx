import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import LayoutShell from "@/components/LayoutShell";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Squibble: Academic Outreach, Automated",
  description: "AI-powered cold email platform for landing research positions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
