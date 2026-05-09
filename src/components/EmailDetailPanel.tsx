"use client";

import { useEffect, useState } from "react";
import { X, Building2, Calendar } from "lucide-react";
import type { EmailStatus, SentEmail } from "@/lib/mock-data";

const statusConfig: Record<EmailStatus, { label: string; dot: string; bg: string; text: string }> = {
  "Positive Reply": { label: "Positive Reply", dot: "#10b981", bg: "rgba(16,185,129,0.1)", text: "#34d399" },
  "No Response": { label: "No Response", dot: "#6b7280", bg: "rgba(107,114,128,0.08)", text: "#9ca3af" },
  "Negative Reply": { label: "Negative Reply", dot: "#ef4444", bg: "rgba(239,68,68,0.08)", text: "#f87171" },
};

const replyStyle: Record<EmailStatus, { bg: string; border: string; nameColor: string }> = {
  "Positive Reply": {
    bg: "rgba(16,185,129,0.05)",
    border: "rgba(16,185,129,0.18)",
    nameColor: "#10b981",
  },
  "Negative Reply": {
    bg: "rgba(239,68,68,0.04)",
    border: "rgba(239,68,68,0.15)",
    nameColor: "#ef4444",
  },
  "No Response": { bg: "var(--bg-elevated)", border: "var(--border-subtle)", nameColor: "var(--ink)" },
};

function StatusBadge({ status }: { status: EmailStatus }) {
  const cfg = statusConfig[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
      style={{ background: cfg.bg, color: cfg.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

interface Props {
  email: SentEmail;
  onClose: () => void;
}

export default function EmailDetailPanel({ email, onClose }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const initials = email.professor
    .replace("Prof. ", "")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  const rs = replyStyle[email.status];

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.22)" }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 h-screen z-50 flex flex-col"
        style={{
          width: "40%",
          background: "var(--bg-card)",
          borderLeft: "1px solid var(--border-subtle)",
          boxShadow: "-12px 0 48px rgba(1,20,37,0.1)",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {/* Header */}
        <div
          className="flex-shrink-0 px-6 py-5 border-b"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: "var(--bg-elevated)", color: "var(--ink-secondary)" }}
              >
                {initials}
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold mb-0.5 truncate" style={{ color: "var(--ink)" }}>
                  {email.professor}
                </h2>
                <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--ink-muted)" }}>
                  <Building2 className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{email.department} · {email.university}</span>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
              style={{ color: "var(--ink-muted)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--bg-elevated)";
                e.currentTarget.style.color = "var(--ink)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--ink-muted)";
              }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <StatusBadge status={email.status} />
            <span
              className="flex items-center gap-1.5 text-xs"
              style={{ color: "var(--ink-muted)" }}
            >
              <Calendar className="w-3 h-3" />
              {email.dateSent}
            </span>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Email sent */}
          <div>
            <p
              className="text-[10px] font-semibold uppercase tracking-widest mb-3"
              style={{ color: "var(--ink-muted)" }}
            >
              Email Sent
            </p>
            <div
              className="rounded-xl border overflow-hidden"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--border-subtle)",
              }}
            >
              <div
                className="flex items-center justify-between px-4 py-3 border-b"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <span className="text-xs font-semibold" style={{ color: "var(--ink)" }}>
                  You
                </span>
                <span className="text-xs" style={{ color: "var(--ink-muted)" }}>
                  {email.dateSent}
                </span>
              </div>
              <div className="px-4 pt-3 pb-1">
                <p
                  className="text-xs font-medium pb-3 mb-3 border-b"
                  style={{ color: "var(--ink-secondary)", borderColor: "var(--border-subtle)" }}
                >
                  {email.subject}
                </p>
                <p
                  className="text-sm leading-7 whitespace-pre-wrap pb-4"
                  style={{ color: "var(--ink-secondary)" }}
                >
                  {email.body}
                </p>
              </div>
            </div>
          </div>

          {/* Reply */}
          {email.reply && (
            <div>
              <p
                className="text-[10px] font-semibold uppercase tracking-widest mb-3"
                style={{ color: "var(--ink-muted)" }}
              >
                Reply
              </p>
              <div
                className="rounded-xl border overflow-hidden"
                style={{ background: rs.bg, borderColor: rs.border }}
              >
                <div
                  className="flex items-center justify-between px-4 py-3 border-b"
                  style={{ borderColor: rs.border }}
                >
                  <span className="text-xs font-semibold" style={{ color: rs.nameColor }}>
                    {email.professor}
                  </span>
                  <span className="text-xs" style={{ color: "var(--ink-muted)" }}>
                    {email.reply.date}
                  </span>
                </div>
                <div className="px-4 pt-3 pb-4">
                  <p
                    className="text-sm leading-7 whitespace-pre-wrap"
                    style={{ color: "var(--ink-secondary)" }}
                  >
                    {email.reply.body}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
