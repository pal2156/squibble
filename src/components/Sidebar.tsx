"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import UpgradeModal from "./UpgradeModal";

const navItems = [
  { href: "/dashboard", label: "Dashboard", iconSrc: "/icons/dashboard.png" },
  { href: "/conversations", label: "Conversations", iconSrc: "/icons/conversations.png" },
  { href: "/campaign", label: "New Campaign", iconSrc: "/icons/new-campaign.png" },
  { href: "/profile", label: "Profile", iconSrc: "/icons/profile.png" },
];

const bottomNavItems = [
  { label: "Settings", iconSrc: "/icons/settings.png" },
];

interface UserRecord {
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  gmail_token: string | null;
}

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
  onSettingsOpen: () => void;
}

export default function Sidebar({ open, onToggle, onSettingsOpen }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [userRecord, setUserRecord] = useState<UserRecord | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("users")
        .select("name, email, avatar_url, gmail_token")
        .eq("id", user.id)
        .single();

      if (data) {
        setUserRecord(data);
      } else {
        setUserRecord({
          name: user.user_metadata?.full_name ?? null,
          email: user.email ?? null,
          avatar_url: user.user_metadata?.avatar_url ?? null,
          gmail_token: null,
        });
      }
    }
    loadUser();
  }, []);

  useEffect(() => {
    if (!popoverOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setPopoverOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [popoverOpen]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/";
    return pathname.startsWith(href);
  };

  const initials = userRecord?.name
    ? userRecord.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  const displayName = userRecord?.name
    ? userRecord.name.split(" ")[0] + (userRecord.name.split(" ")[1] ? " " + userRecord.name.split(" ")[1][0] + "." : "")
    : "Loading...";

  const toggleRect = btnHovered ? toggleRef.current?.getBoundingClientRect() : undefined;

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
              ref={toggleRef}
              onClick={onToggle}
              className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
              style={{ color: "#3C5352" }}
              onMouseEnter={(e) => { setBtnHovered(true); e.currentTarget.style.background = "#F1F6F9"; e.currentTarget.style.color = "#232C33"; }}
              onMouseLeave={(e) => { setBtnHovered(false); e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#3C5352"; }}
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

        {/* Upgrade row */}
        <div className="px-2 mb-0 flex-shrink-0">
          <button
            onClick={() => setUpgradeOpen(true)}
            title={!open ? "Upgrade" : undefined}
            className={cn(
              "w-full flex items-center rounded-lg text-sm font-medium transition-all duration-150",
              open ? "gap-3 px-3 py-2.5" : "justify-center py-2.5"
            )}
            style={{ color: "#3C5352" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(35,44,51,0.04)";
              e.currentTarget.style.color = "#232C33";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#3C5352";
            }}
          >
            <Image src="/icons/upgrade.png" alt="Upgrade" width={22} height={22} className="flex-shrink-0" />
            {open && <span style={{ whiteSpace: "nowrap" }}>Upgrade</span>}
          </button>
        </div>

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

        {/* User badge */}
        <div className="px-2 pb-5 flex-shrink-0">
          <button
            ref={triggerRef}
            onClick={() => setPopoverOpen((o) => !o)}
            className="w-full flex items-center rounded-lg text-left transition-colors"
            style={{
              background: popoverOpen ? "rgba(103,142,141,0.1)" : "rgba(35,44,51,0.04)",
              padding: open ? "10px 12px" : "10px",
              justifyContent: open ? "flex-start" : "center",
            }}
            onMouseEnter={(e) => {
              if (!popoverOpen) e.currentTarget.style.background = "rgba(35,44,51,0.07)";
            }}
            onMouseLeave={(e) => {
              if (!popoverOpen) e.currentTarget.style.background = "rgba(35,44,51,0.04)";
            }}
          >
            {userRecord?.avatar_url ? (
              <img
                src={userRecord.avatar_url}
                alt={userRecord.name ?? ""}
                className="w-7 h-7 rounded-full flex-shrink-0 object-cover"
              />
            ) : (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                style={{ background: "#678E8D", color: "#FFFFFF" }}
              >
                {initials}
              </div>
            )}
            {open && (
              <div className="ml-3 min-w-0" style={{ whiteSpace: "nowrap" }}>
                <p className="text-xs font-medium" style={{ color: "#232C33" }}>{displayName}</p>
                <p className="text-[11px]" style={{ color: "#3C5352" }}>
                  {userRecord?.email ?? ""}
                </p>
              </div>
            )}
          </button>
        </div>
      </aside>

      {upgradeOpen && <UpgradeModal onClose={() => setUpgradeOpen(false)} />}

      {/* Tooltip */}
      {btnHovered && toggleRect && (
        <div
          className="pointer-events-none fixed z-50 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap"
          style={{
            top: toggleRect.bottom + 8,
            left: toggleRect.left + toggleRect.width / 2,
            transform: "translateX(-50%)",
            background: "#678E8D",
            color: "#FFFFFF",
            boxShadow: "0 4px 12px rgba(35,44,51,0.15)",
          }}
        >
          {open ? "Close sidebar" : "Open sidebar"}
        </div>
      )}

      {/* Popover */}
      {popoverOpen && (
        <div
          ref={popoverRef}
          className="fixed rounded-xl shadow-lg z-50"
          style={{
            bottom: "92px",
            left: "24px",
            width: "224px",
            background: "#FFFFFF",
            border: "1px solid #BBD2DD",
            boxShadow: "0 4px 20px rgba(35,44,51,0.12)",
          }}
        >
          {/* Profile header */}
          <div className="p-4 border-b" style={{ borderColor: "#BBD2DD" }}>
            <div className="flex items-center gap-3">
              {userRecord?.avatar_url ? (
                <img
                  src={userRecord.avatar_url}
                  alt={userRecord.name ?? ""}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0"
                  style={{ background: "#678E8D", color: "#FFFFFF" }}
                >
                  {initials}
                </div>
              )}
              <div className="min-w-0">
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: "#232C33" }}
                >
                  {userRecord?.name ?? ""}
                </p>
                <p
                  className="text-xs truncate"
                  style={{ color: "#3C5352" }}
                >
                  {userRecord?.email ?? ""}
                </p>
              </div>
            </div>
          </div>

          {/* Gmail status */}
          <div className="px-4 py-3 border-b" style={{ borderColor: "#BBD2DD" }}>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "#3C5352" }}>
                Gmail
              </span>
              <span
                className="flex items-center gap-1.5 text-xs font-medium"
                style={{ color: userRecord?.gmail_token ? "#678E8D" : "rgba(60,83,82,0.5)" }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: userRecord?.gmail_token ? "#678E8D" : "#BBD2DD",
                  }}
                />
                {userRecord?.gmail_token ? "Connected" : "Not connected"}
              </span>
            </div>
          </div>

          {/* Logout */}
          <div className="px-2 py-2">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors"
              style={{ color: "#3C5352" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#F1F6F9";
                e.currentTarget.style.color = "#232C33";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#3C5352";
              }}
            >
              <Image src="/icons/logout.png" alt="Log out" width={14} height={14} />
              Log out
            </button>
          </div>
        </div>
      )}
    </>
  );
}
