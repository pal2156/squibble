"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Telescope, User, Zap, PanelLeft, Inbox, LogOut, Settings, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import UpgradeModal from "./UpgradeModal";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/conversations", label: "Conversations", icon: Inbox },
  { href: "/campaign", label: "New Campaign", icon: Telescope },
  { href: "/profile", label: "Profile", icon: User },
];

const bottomNavItems = [
  { label: "Settings", icon: Settings },
  { label: "Help & Information", icon: HelpCircle },
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
}

export default function Sidebar({ open, onToggle }: SidebarProps) {
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
        // Fallback to auth metadata if row not yet created
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

  // Close popover on outside click
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
    router.push("/login");
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

  // Compute fixed-position coords for the tooltip so it escapes overflow:hidden
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
          background: "#011425",
          borderRadius: "16px",
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.3)",
          transition: "width 0.25s ease",
          zIndex: 40,
          overflow: "hidden",
        }}
      >
        {/* Logo row */}
        <div className="flex items-center justify-between px-3 py-5 mb-2 flex-shrink-0" style={{ height: "64px" }}>
          {open && (
            <div
              className="flex items-center gap-2"
              style={{ whiteSpace: "nowrap", overflow: "hidden" }}
            >
              <div
                className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(92,124,137,0.2)" }}
              >
                <Zap className="w-2.5 h-2.5" style={{ color: "#5C7C89" }} />
              </div>
              <span className="text-sm font-semibold tracking-tight" style={{ color: "#FFFFFF" }}>
                Squibble
              </span>
              <span
                className="text-[9px] font-medium px-1.5 py-0.5 rounded-full border"
                style={{
                  color: "rgba(255,255,255,0.35)",
                  borderColor: "rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                BETA
              </span>
            </div>
          )}

          {/* Toggle button */}
          <div className={cn("flex-shrink-0", !open && "mx-auto")}>
            <button
              ref={toggleRef}
              onClick={onToggle}
              className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
              style={{ color: "rgba(255,255,255,0.4)" }}
              onMouseEnter={(e) => { setBtnHovered(true); e.currentTarget.style.background = "rgba(92,124,137,0.18)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={(e) => { setBtnHovered(false); e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}
            >
              <PanelLeft className="w-4 h-4 flex-shrink-0" />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                title={!open ? label : undefined}
                className={cn(
                  "flex items-center rounded-lg text-sm font-medium transition-all duration-150",
                  !active && "hover:bg-white/[0.06]",
                  open ? "gap-3 px-3 py-2.5" : "justify-center py-2.5"
                )}
                style={{
                  background: active ? "rgba(92,124,137,0.18)" : "transparent",
                  color: active ? "#FFFFFF" : "rgba(255,255,255,0.7)",
                }}
              >
                <Icon
                  className="w-[17px] h-[17px] flex-shrink-0"
                  style={{ color: active ? "#5C7C89" : "rgba(255,255,255,0.3)" }}
                />
                {open && (
                  <span style={{ whiteSpace: "nowrap" }}>{label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Upgrade card */}
        <div className="px-2 mt-3 mb-2 flex-shrink-0">
          {open ? (
            <div
              className="rounded-2xl"
              style={{
                background: "linear-gradient(180deg, #0E2438 0%, #011425 100%)",
                border: "1px solid rgba(255,255,255,0.06)",
                padding: "20px 16px",
              }}
            >
              <p
                className="text-sm font-bold text-center mb-1.5"
                style={{ color: "#FFFFFF" }}
              >
                Upgrade to Pro
              </p>
              <p
                className="text-xs text-center mb-4 leading-snug"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                Get 1 month free and unlock all features
              </p>
              <div className="flex justify-center">
                <button
                  onClick={() => setUpgradeOpen(true)}
                  className="px-5 py-1.5 rounded-full text-xs font-semibold transition-colors"
                  style={{ background: "#7FB8E8", color: "#011425" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#A8D0F0"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#7FB8E8"; }}
                >
                  Upgrade
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                onClick={() => setUpgradeOpen(true)}
                title="Upgrade to Pro"
                className="px-3 py-1 rounded-full text-[10px] font-semibold transition-colors"
                style={{ background: "#7FB8E8", color: "#011425" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#A8D0F0"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#7FB8E8"; }}
              >
                Pro
              </button>
            </div>
          )}
        </div>

        {/* Bottom nav items */}
        <div className="px-2 pb-1 space-y-0.5 flex-shrink-0">
          {bottomNavItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              title={!open ? label : undefined}
              className={cn(
                "w-full flex items-center rounded-lg text-sm font-medium transition-all duration-150 hover:bg-white/[0.06]",
                open ? "gap-3 px-3 py-2.5" : "justify-center py-2.5"
              )}
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              <Icon className="w-[17px] h-[17px] flex-shrink-0" style={{ color: "rgba(255,255,255,0.25)" }} />
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
              background: popoverOpen ? "rgba(92,124,137,0.14)" : "rgba(255,255,255,0.05)",
              padding: open ? "10px 12px" : "10px",
              justifyContent: open ? "flex-start" : "center",
            }}
            onMouseEnter={(e) => {
              if (!popoverOpen) e.currentTarget.style.background = "rgba(255,255,255,0.08)";
            }}
            onMouseLeave={(e) => {
              if (!popoverOpen) e.currentTarget.style.background = "rgba(255,255,255,0.05)";
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
                style={{ background: "rgba(92,124,137,0.25)", color: "#5C7C89" }}
              >
                {initials}
              </div>
            )}
            {open && (
              <div className="ml-3 min-w-0" style={{ whiteSpace: "nowrap" }}>
                <p className="text-xs font-medium" style={{ color: "#FFFFFF" }}>{displayName}</p>
                <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                  {userRecord?.email ?? ""}
                </p>
              </div>
            )}
          </button>
        </div>
      </aside>

      {upgradeOpen && <UpgradeModal onClose={() => setUpgradeOpen(false)} />}

      {/* Tooltip — fixed so it escapes overflow:hidden and overlaps the sidebar edge */}
      {btnHovered && toggleRect && (
        <div
          className="pointer-events-none fixed z-50 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap"
          style={{
            top: toggleRect.bottom + 8,
            left: toggleRect.left + toggleRect.width / 2,
            transform: "translateX(-50%)",
            background: "#1F4959",
            color: "#FFFFFF",
            boxShadow: "0 4px 12px rgba(1,20,37,0.25)",
          }}
        >
          {open ? "Close sidebar" : "Open sidebar"}
        </div>
      )}

      {/* Popover — rendered outside aside so it's not clipped */}
      {popoverOpen && (
        <div
          ref={popoverRef}
          className="fixed rounded-xl shadow-2xl z-50"
          style={{
            bottom: "92px",
            left: "24px",
            width: "224px",
            background: "#0a1e2e",
            border: "1px solid rgba(255,255,255,0.09)",
          }}
        >
          {/* Profile header */}
          <div className="p-4 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
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
                  style={{ background: "rgba(92,124,137,0.25)", color: "#5C7C89" }}
                >
                  {initials}
                </div>
              )}
              <div className="min-w-0">
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: "#FFFFFF" }}
                >
                  {userRecord?.name ?? ""}
                </p>
                <p
                  className="text-xs truncate"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                >
                  {userRecord?.email ?? ""}
                </p>
              </div>
            </div>
          </div>

          {/* Gmail status */}
          <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                Gmail
              </span>
              <span
                className="flex items-center gap-1.5 text-xs font-medium"
                style={{ color: userRecord?.gmail_token ? "#4ade80" : "rgba(255,255,255,0.3)" }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: userRecord?.gmail_token ? "#4ade80" : "rgba(255,255,255,0.2)",
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
              style={{ color: "rgba(255,255,255,0.6)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                e.currentTarget.style.color = "#fff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "rgba(255,255,255,0.6)";
              }}
            >
              <LogOut className="w-3.5 h-3.5" />
              Log out
            </button>
          </div>
        </div>
      )}
    </>
  );
}
