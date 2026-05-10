"use client";

import { useState, useEffect } from "react";
import { Building2, CornerDownLeft, Send } from "lucide-react";

type EmailStatus = "Positive Reply" | "No Response" | "Negative Reply";

interface SentEmail {
  id: string;
  professor: string;
  university: string;
  department: string;
  dateSent: string;
  status: EmailStatus;
  subject: string;
  body: string;
  reply?: { date: string; body: string };
}

const statusConfig: Record<EmailStatus, { label: string; dot: string; bg: string; text: string }> = {
  "Positive Reply": { label: "Positive Reply", dot: "#10b981", bg: "rgba(16,185,129,0.1)", text: "#34d399" },
  "No Response": { label: "No Response", dot: "#6b7280", bg: "rgba(107,114,128,0.08)", text: "#9ca3af" },
  "Negative Reply": { label: "Negative Reply", dot: "#ef4444", bg: "rgba(239,68,68,0.08)", text: "#f87171" },
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

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2);
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<SentEmail[]>([]);
  const [selected, setSelected] = useState<SentEmail | null>(null);
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");

  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then(({ conversations: data }) => {
        if (data && data.length > 0) {
          setConversations(data);
          setSelected(data[0]);
        }
      })
      .catch(() => {});
  }, []);

  function selectConversation(conv: SentEmail) {
    setSelected(conv);
    setShowReply(false);
  }

  function openReply(_email: SentEmail) {
    setReplyText("");
    setShowReply(true);
  }

  return (
    <div className="flex py-4" style={{ height: "100vh" }}>
      {/* ── Conversation list ── */}
      <div
        className="flex-shrink-0 flex flex-col border-r rounded-xl overflow-hidden"
        style={{ width: "288px", borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}
      >
        {/* Header */}
        <div
          className="px-5 py-5 border-b flex-shrink-0"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <h1 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
            Conversations
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--ink-muted)" }}>
            {conversations.length} thread{conversations.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
                No replies yet — check back soon
              </p>
            </div>
          ) : (
            conversations.map((conv) => {
              const isSelected = selected?.id === conv.id;
              return (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv)}
                  className="relative w-full text-left px-5 py-4 border-b transition-colors duration-100"
                  style={{
                    background: isSelected ? "var(--accent-muted)" : "transparent",
                    borderColor: "var(--border-subtle)",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "var(--bg-elevated)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "transparent";
                  }}
                >
                  {isSelected && (
                    <div
                      className="absolute inset-y-0 left-0 w-0.5"
                      style={{ background: "var(--accent)" }}
                    />
                  )}
                  <div className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                      style={{ background: "var(--bg-elevated)", color: "var(--ink-secondary)" }}
                    >
                      {getInitials(conv.professor)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-xs font-semibold truncate mb-0.5"
                        style={{ color: "var(--ink)" }}
                      >
                        {conv.professor}
                      </p>
                      <p
                        className="text-[11px] truncate mb-2.5"
                        style={{ color: "var(--ink-muted)" }}
                      >
                        {conv.university} · {conv.department}
                      </p>
                      <StatusBadge status={conv.status} />
                    </div>
                  </div>
                  <p
                    className="text-[11px] mt-2 pl-11"
                    style={{ color: "var(--ink-muted)" }}
                  >
                    {conv.reply?.date}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Thread view ── */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ background: "var(--bg-base)" }}
      >
        {conversations.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
              No replies yet — check back soon
            </p>
          </div>
        ) : !selected ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
              Select a conversation to read
            </p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto px-8 py-8">
            {/* Thread header */}
            <div className="flex items-start justify-between gap-4 mb-7">
              <div>
                <h2
                  className="text-base font-bold mb-1"
                  style={{ color: "var(--ink)" }}
                >
                  {selected.professor}
                </h2>
                <p
                  className="text-sm flex items-center gap-1.5"
                  style={{ color: "var(--ink-muted)" }}
                >
                  <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                  {selected.department} · {selected.university}
                </p>
              </div>
              <StatusBadge status={selected.status} />
            </div>

            {/* ── Message: You ── */}
            <div
              className="border-t py-8"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <div
                className="flex items-baseline justify-between mb-4"
              >
                <span
                  className="text-[11px] font-semibold uppercase tracking-widest"
                  style={{ color: "var(--ink-muted)" }}
                >
                  You
                </span>
                <span
                  className="text-xs tabular-nums"
                  style={{ color: "var(--ink-muted)" }}
                >
                  {selected.dateSent}
                </span>
              </div>
              <p
                className="text-xs font-medium mb-5"
                style={{ color: "var(--ink-secondary)" }}
              >
                {selected.subject}
              </p>
              <p
                className="text-sm leading-7 whitespace-pre-wrap"
                style={{ color: "var(--ink)" }}
              >
                {selected.body}
              </p>
            </div>

            {/* ── Message: Professor reply ── */}
            {selected.reply && (
              <div
                className="border-t py-8"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <div className="flex items-baseline justify-between mb-4">
                  <span
                    className="text-[11px] font-semibold uppercase tracking-widest"
                    style={{
                      color:
                        selected.status === "Positive Reply"
                          ? "#10b981"
                          : "#ef4444",
                    }}
                  >
                    {selected.professor}
                  </span>
                  <span
                    className="text-xs tabular-nums"
                    style={{ color: "var(--ink-muted)" }}
                  >
                    {selected.reply.date}
                  </span>
                </div>
                <p
                  className="text-sm leading-7 whitespace-pre-wrap"
                  style={{ color: "var(--ink)" }}
                >
                  {selected.reply.body}
                </p>
              </div>
            )}

            {/* ── Reply area ── */}
            <div
              className="border-t pt-8 pb-16"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              {!showReply ? (
                <button
                  onClick={() => openReply(selected)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium border transition-all duration-150"
                  style={{
                    background: "var(--bg-card)",
                    borderColor: "var(--border-default)",
                    color: "var(--ink-secondary)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-strong)";
                    e.currentTarget.style.color = "var(--ink)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-default)";
                    e.currentTarget.style.color = "var(--ink-secondary)";
                  }}
                >
                  <CornerDownLeft className="w-3 h-3" />
                  Reply
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className="text-[11px] font-semibold uppercase tracking-widest"
                      style={{ color: "var(--ink-muted)" }}
                    >
                      You
                    </span>
                    <span
                      className="text-[11px]"
                      style={{ color: "var(--ink-muted)" }}
                    >
                      AI-drafted · edit before sending
                    </span>
                  </div>
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={12}
                    className="w-full text-sm leading-7 rounded-lg px-3.5 py-3 border resize-none"
                    style={{
                      background: "var(--bg-card)",
                      borderColor: "var(--border-default)",
                      color: "var(--ink)",
                      outline: "none",
                      fontFamily: "inherit",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors duration-150"
                      style={{ background: "var(--accent)", color: "#fff" }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--accent-hover)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "var(--accent)";
                      }}
                    >
                      <Send className="w-3 h-3" />
                      Send
                    </button>
                    <button
                      onClick={() => setShowReply(false)}
                      className="px-4 py-2 rounded-lg text-xs font-medium transition-colors duration-150"
                      style={{ color: "var(--ink-muted)" }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "var(--ink-secondary)";
                        e.currentTarget.style.background = "var(--bg-elevated)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "var(--ink-muted)";
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
