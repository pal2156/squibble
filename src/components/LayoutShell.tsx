"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const pathname = usePathname();

  // Login page renders without the shell
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar open={open} onToggle={() => setOpen((o) => !o)} />
      <main
        className="flex-1 min-h-screen overflow-y-auto"
        style={{
          marginLeft: open ? "252px" : "96px",
          background: "var(--bg-base)",
          transition: "margin-left 0.25s ease",
        }}
      >
        {children}
      </main>
    </div>
  );
}
