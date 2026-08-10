"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import SettingsModal from "./SettingsModal";
import { CampaignDraftProvider } from "./CampaignDraftContext";

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const pathname = usePathname();

  // The first-run setup wizard renders fullscreen, without the app shell
  if (pathname === "/setup") {
    return <>{children}</>;
  }

  return (
    <CampaignDraftProvider>
      <div className="flex min-h-screen">
        <Sidebar
          open={open}
          onToggle={() => setOpen((o) => !o)}
          onSettingsOpen={() => setSettingsOpen(true)}
        />
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
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </CampaignDraftProvider>
  );
}
