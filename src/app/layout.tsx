import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "ProfNet — Academic Outreach, Automated",
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
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 ml-[220px] min-h-screen overflow-y-auto" style={{ background: "var(--bg-base)" }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
