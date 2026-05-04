import { sentEmails, type EmailStatus } from "@/lib/mock-data";
import { TrendingUp, Send, MessageSquare, Layers } from "lucide-react";

const statusConfig: Record<EmailStatus, { label: string; dot: string; bg: string; text: string }> = {
  "Sent": {
    label: "Sent",
    dot: "#3b82f6",
    bg: "rgba(59,130,246,0.1)",
    text: "#60a5fa",
  },
  "Positive Reply": {
    label: "Positive Reply",
    dot: "#10b981",
    bg: "rgba(16,185,129,0.1)",
    text: "#34d399",
  },
  "Negative Reply": {
    label: "Negative Reply",
    dot: "#ef4444",
    bg: "rgba(239,68,68,0.08)",
    text: "#f87171",
  },
  "No Response": {
    label: "No Response",
    dot: "#6b7280",
    bg: "rgba(107,114,128,0.08)",
    text: "#9ca3af",
  },
  "Do Not Contact": {
    label: "Do Not Contact",
    dot: "#374151",
    bg: "rgba(55,65,81,0.15)",
    text: "#6b7280",
  },
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

export default function DashboardPage() {
  const totalSent = sentEmails.length;
  const positiveReplies = sentEmails.filter((e) => e.status === "Positive Reply").length;
  const replied = sentEmails.filter((e) => e.status !== "No Response" && e.status !== "Sent" && e.status !== "Do Not Contact").length;
  const responseRate = Math.round((replied / totalSent) * 100);
  const campaigns = [...new Set(sentEmails.map((e) => e.campaign))].length;

  const stats = [
    {
      label: "Emails Sent",
      value: totalSent,
      icon: Send,
      color: "#60a5fa",
      bg: "rgba(59,130,246,0.08)",
    },
    {
      label: "Response Rate",
      value: `${responseRate}%`,
      icon: TrendingUp,
      color: "#a78bfa",
      bg: "rgba(124,111,247,0.08)",
    },
    {
      label: "Positive Replies",
      value: positiveReplies,
      icon: MessageSquare,
      color: "#34d399",
      bg: "rgba(52,211,153,0.08)",
    },
    {
      label: "Campaigns Run",
      value: campaigns,
      icon: Layers,
      color: "#fb923c",
      bg: "rgba(251,146,60,0.08)",
    },
  ];

  return (
    <div className="px-10 py-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-1.5" style={{ color: "var(--ink)" }}>
          Dashboard
        </h1>
        <p className="text-sm" style={{ color: "var(--ink-secondary)" }}>
          Track your outreach across all campaigns.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-10">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div
            key={label}
            className="rounded-2xl p-5 border"
            style={{
              background: "var(--bg-card)",
              borderColor: "var(--border-subtle)",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--ink-muted)", letterSpacing: "0.08em" }}>
                {label}
              </span>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: bg }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
            </div>
            <p className="text-3xl font-bold tracking-tight" style={{ color: "var(--ink)" }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{
          background: "var(--bg-card)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border-subtle)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
            All Outreach
          </h2>
          <span className="text-xs" style={{ color: "var(--ink-muted)" }}>
            {totalSent} emails
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                {["Professor", "University", "Department", "Campaign", "Date Sent", "Status"].map((col) => (
                  <th
                    key={col}
                    className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-widest"
                    style={{ color: "var(--ink-muted)" }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sentEmails.map((email, i) => (
                <tr
                  key={email.id}
                  className="transition-colors duration-100 hover:bg-white/[0.02]"
                  style={{
                    borderBottom: i < sentEmails.length - 1 ? "1px solid var(--border-subtle)" : "none",
                  }}
                >
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                      {email.professor}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm" style={{ color: "var(--ink-secondary)" }}>
                      {email.university}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm" style={{ color: "var(--ink-secondary)" }}>
                      {email.department}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className="text-xs font-medium px-2.5 py-1 rounded-full"
                      style={{
                        background: "var(--accent-muted)",
                        color: "var(--accent-hover)",
                      }}
                    >
                      {email.campaign}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm tabular-nums" style={{ color: "var(--ink-secondary)" }}>
                      {email.dateSent}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={email.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
