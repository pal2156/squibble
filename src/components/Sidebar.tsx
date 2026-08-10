"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/utils";

const navItems: { href: string; label: string; iconSrc: string }[] = [
  { href: "/dashboard", label: "Dashboard", iconSrc: "/icons/dashboard.png" },
  { href: "/conversations", label: "Conversations", iconSrc: "/icons/conversations.png" },
  { href: "/campaign", label: "New Campaign", iconSrc: "/icons/new-campaign.png" },
  { href: "/profile", label: "Profile", iconSrc: "/icons/profile.png" },
];

const bottomNavItems = [
  { label: "Settings", iconSrc: "/icons/settings.png" },
];

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
  onSettingsOpen: () => void;
}

export default function Sidebar({ open, onToggle, onSettingsOpen }: SidebarProps) {
  const pathname = usePathname();
  const [profileName, setProfileName] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((json) => setProfileName(json.profile?.name ?? null))
      .catch(() => {});
  }, []);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/";
    return pathname.startsWith(href);
  };

  const initial = profileName ? profileName.trim()[0].toUpperCase() : "S";

  return (
    <>
      <aside
        className="fixed flex flex-col"
        style={{
          top: "16px",
          left: "16px",
          bottom: "16px",
          width: open ? "220px" : "64px",
          background: "#FFFFFF",
          borderRadius: "16px",
          border: "1px solid #BBD2DD",
          boxShadow: "0 2px 12px rgba(35,44,51,0.06)",
          transition: "width 0.25s ease",
          zIndex: 40,
          overflow: "hidden",
        }}
      >
        {/* Logo row */}
        <div className="flex items-center justify-between px-3 py-5 mb-2 flex-shrink-0" style={{ height: "64px" }}>
          {open && (
            <div
              className="flex items-center gap-1"
              style={{ whiteSpace: "nowrap", overflow: "hidden" }}
            >
              <Image src="/logo.png" alt="Squibble" width={32} height={32} className="flex-shrink-0" />
              <span
                className="text-sm font-semibold"
                style={{ color: "#232C33", letterSpacing: "-0.05em" }}
              >
                Squibble
              </span>
            </div>
          )}

          {/* Toggle button */}
          <div className={cn("flex-shrink-0", !open && "mx-auto")}>
            <button
              onClick={onToggle}
              title={open ? "Close sidebar" : "Open sidebar"}
              className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
              style={{ color: "#3C5352" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#F1F6F9"; e.currentTarget.style.color = "#232C33"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#3C5352"; }}
            >
              <Image src="/icons/collapse-sidebar-2.png" alt="Toggle sidebar" width={16} height={16} className="flex-shrink-0" />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 space-y-0.5">
          {navItems.map(({ href, label, iconSrc }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                title={!open ? label : undefined}
                className={cn(
                  "flex items-center rounded-lg text-sm font-medium transition-all duration-150",
                  open ? "gap-3 px-3 py-2.5" : "justify-center py-2.5"
                )}
                style={{
                  background: active ? "rgba(103,142,141,0.1)" : "transparent",
                  color: active ? "#678E8D" : "#3C5352",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = "rgba(35,44,51,0.04)";
                    e.currentTarget.style.color = "#232C33";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "#3C5352";
                  }
                }}
              >
                <Image
                  src={iconSrc}
                  alt={label}
                  width={18}
                  height={18}
                  className="flex-shrink-0"
                />
                {open && (
                  <span style={{ whiteSpace: "nowrap" }}>{label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom nav items */}
        <div className="px-2 pb-1 space-y-0.5 flex-shrink-0">
          {bottomNavItems.map(({ label, iconSrc }) => (
            <button
              key={label}
              onClick={onSettingsOpen}
              title={!open ? label : undefined}
              className={cn(
                "w-full flex items-center rounded-lg text-sm font-medium transition-all duration-150",
                open ? "gap-3 px-3 py-2.5" : "justify-center py-2.5"
              )}
              style={{ background: "transparent", color: "#3C5352" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(35,44,51,0.04)";
                e.currentTarget.style.color = "#232C33";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#3C5352";
              }}
            >
              <Image src={iconSrc} alt={label} width={18} height={18} className="flex-shrink-0" />
              {open && <span style={{ whiteSpace: "nowrap" }}>{label}</span>}
            </button>
          ))}
        </div>

        {/* Local instance badge — single-user, no login, nothing to sign out of */}
        <div className="px-2 pb-5 flex-shrink-0">
          <div
            className="w-full flex items-center rounded-lg text-left"
            style={{
              background: "rgba(35,44,51,0.04)",
              padding: open ? "10px 12px" : "10px",
              justifyContent: open ? "flex-start" : "center",
            }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
              style={{ background: "#3C5352", color: "#FFFFFF" }}
            >
              {initial}
            </div>
            {open && (
              <div className="ml-3 min-w-0" style={{ whiteSpace: "nowrap" }}>
                <p className="text-xs font-medium" style={{ color: "#232C33" }}>{profileName ?? "Your profile"}</p>
                <p className="text-[11px]" style={{ color: "#3C5352" }}>Running locally</p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
