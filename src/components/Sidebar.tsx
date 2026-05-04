"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Telescope, User, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/campaign", label: "New Campaign", icon: Telescope },
  { href: "/profile", label: "Profile", icon: User },
];

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside className="fixed inset-y-0 left-0 w-[220px] flex flex-col border-r" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 mb-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--accent-muted)" }}>
          <Zap className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
        </div>
        <span className="text-sm font-semibold tracking-tight" style={{ color: "var(--ink)" }}>
          ProfNet
        </span>
        <span className="ml-auto text-[9px] font-medium px-1.5 py-0.5 rounded-full border" style={{ color: "var(--ink-muted)", borderColor: "var(--border-default)", background: "var(--border-subtle)" }}>
          BETA
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                active
                  ? "text-white"
                  : "hover:bg-white/[0.04]"
              )}
              style={
                active
                  ? {
                      background: "var(--accent-muted)",
                      color: "var(--accent-hover)",
                    }
                  : { color: "var(--ink-secondary)" }
              }
            >
              <Icon
                className={cn("w-[17px] h-[17px] flex-shrink-0 transition-colors")}
                style={active ? { color: "var(--accent)" } : { color: "var(--ink-muted)" }}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User badge */}
      <div className="px-3 pb-5">
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
          style={{ background: "var(--border-subtle)" }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
            style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
          >
            PL
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: "var(--ink)" }}>Paul L.</p>
            <p className="text-[11px] truncate" style={{ color: "var(--ink-muted)" }}>Columbia · Freshman</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
