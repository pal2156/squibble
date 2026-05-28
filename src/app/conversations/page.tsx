"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Building2, ChevronDown, CornerDownLeft, Send } from "lucide-react";

type EmailStatus = "Positive Reply" | "No Response" | "Negative Reply" | "Do Not Contact";
type SortOrder = "newest" | "positive" | "negative" | "unanswered";

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
  "Positive Reply": { label: "Positive Reply", dot: "#678E8D", bg: "rgba(103,142,141,0.1)", text: "#678E8D" },
  "No Response": { label: "No Response", dot: "#BBD2DD", bg: "rgba(187,210,221,0.25)", text: "#3C5352" },
  "Negative Reply": { label: "Negative Reply", dot: "#3C5352", bg: "rgba(60,83,82,0.08)", text: "#3C5352" },
  "Do Not Contact": { label: "Do Not Contact", dot: "#3C5352", bg: "rgba(60,83,82,0.08)", text: "#3C5352" },
};

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: "newest", label: "Newest First" },
  { value: "positive", label: "Positive First" },
  { value: "negative", label: "Negative First" },
  { value: "unanswered", label: "Unanswered First" },
];

function parseDate(dateStr: string | undefined): number {
  if (!dateStr) return 0;
  const mmddyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyy) {
    return new Date(Number(mmddyyyy[3]), Number(mmddyyyy[1]) - 1, Number(mmddyyyy[2])).getTime();
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function statusRank(status: EmailStatus, sort: "positive" | "negative"): number {
  if (sort === "positive") {
    if (status === "Positive Reply") return 0;
    if (status === "No Response") return 1;
    if (status === "Negative Reply") return 2;
    return 3;
  }
  if (status === "Negative Reply") return 0;
  if (status === "No Response") return 1;
  if (status === "Positive Reply") return 2;
  return 3;
}

function sortConversations(convs: SentEmail[], sort: SortOrder): SentEmail[] {
  const copy = [...convs];

  if (sort === "newest") {
    return copy.sort((a, b) => {
      const aHasReply = !!a.reply;
      const bHasReply = !!b.reply;
      if (aHasReply && !bHasReply) return -1;
      if (!aHasReply && bHasReply) return 1;
      const aDate = aHasReply ? parseDate(a.reply!.date) : parseDate(a.dateSent);
      const bDate = bHasReply ? parseDate(b.reply!.date) : parseDate(b.dateSent);
      return bDate - aDate;
    });
  }

  if (sort === "positive" || sort === "negative") {
    return copy.sort((a, b) => {
      const aRank = statusRank(a.status, sort);
      const bRank = statusRank(b.status, sort);
      if (aRank !== bRank) return aRank - bRank;
      const aDate = a.reply ? parseDate(a.reply.date) : parseDate(a.dateSent);
      const bDate = b.reply ? parseDate(b.reply.date) : parseDate(b.dateSent);
      return bDate - aDate;
    });
  }

  if (sort === "unanswered") {
    return copy.sort((a, b) => {
      const aUnread = a.status === "No Response";
      const bUnread = b.status === "No Response";
      if (aUnread && !bUnread) return -1;
      if (!aUnread && bUnread) return 1;
      const aDate = a.reply ? parseDate(a.reply.date) : parseDate(a.dateSent);
      const bDate = b.reply ? parseDate(b.reply.date) : parseDate(b.dateSent);
      return bDate - aDate;
    });
  }

  return copy;
}

function SortDropdown({ value, onChange }: { value: SortOrder; onChange: (v: SortOrder) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const current = SORT_OPTIONS.find((o) => o.value === value)!;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[11px] font-medium rounded-md px-2 py-1 border transition-colors duration-100"
        style={{
          background: "var(--bg-elevated)",
          borderColor: open ? "var(--border-strong)" : "var(--border-default)",
          color: "var(--ink-secondary)",
        }}
      >
        {current.label}
        <ChevronDown
          className="w-3 h-3 transition-transform duration-150"
          style={{ opacity: 0.6, transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>
      {open && (
        <div
          className="absolute top-full mt-1 right-0 z-50 rounded-lg border overflow-hidden"
          style={{
            background: "var(--bg-card)",
            borderColor: "var(--border-default)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
            minWidth: "148px",
          }}
        >
          {SORT_OPTIONS.map((opt) => {
            const isActive = opt.value === value;
            return (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className="w-full text-left px-3.5 py-2 text-xs font-medium transition-colors duration-75"
                style={{
                  color: isActive ? "var(--accent)" : "var(--ink-secondary)",
                  background: isActive ? "var(--accent-muted)" : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = "var(--bg-elevated)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = isActive ? "var(--accent-muted)" : "transparent";
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [loading, setLoading] = useState(true);

  const sorted = useMemo(() => sortConversations(conversations, sortOrder), [conversations, sortOrder]);

  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then(({ conversations: data }) => {
        if (data && data.length > 0) {
          setConversations(data);
          setSelected(data[0]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function selectConversation(conv: SentEmail) {
    setSelected(conv);
    setShowReply(false);
  }

  function openReply(_email: SentEmail) {
    setReplyText("");
    setShowReply(true);
  }

  if (loading) {
    return (
      <div className="flex py-4" style={{ height: "100vh" }}>
        <div
          className="flex-shrink-0 flex flex-col border-r rounded-xl overflow-hidden"
          style={{ width: "288px", borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}
        >
          <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border-subtle)" }}>
            <div className="h-4 w-28 rounded mb-2 animate-pulse" style={{ background: "var(--bg-elevated)" }} />
            <div className="h-3 w-16 rounded animate-pulse" style={{ background: "var(--bg-elevated)" }} />
          </div>
          <div className="flex-1 overflow-hidden">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="px-5 py-4 border-b animate-pulse" style={{ borderColor: "var(--border-subtle)" }}>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg flex-shrink-0" style={{ background: "var(--bg-elevated)" }} />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 rounded w-28" style={{ background: "var(--bg-elevated)" }} />
                    <div className="h-2.5 rounded w-36" style={{ background: "var(--bg-elevated)" }} />
                    <div className="h-5 rounded-full w-20 mt-1" style={{ background: "var(--bg-elevated)" }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-hidden" style={{ background: "var(--bg-base)" }}>
          <div className="max-w-2xl mx-auto px-8 py-8">
            <div className="h-5 w-48 rounded mb-2 animate-pulse" style={{ background: "var(--bg-elevated)" }} />
            <div className="h-3.5 w-64 rounded mb-8 animate-pulse" style={{ background: "var(--bg-elevated)" }} />
            <div className="border-t pt-8 space-y-3 animate-pulse" style={{ borderColor: "var(--border-subtle)" }}>
              <div className="h-3 w-full rounded" style={{ background: "var(--bg-elevated)" }} />
              <div className="h-3 w-full rounded" style={{ background: "var(--bg-elevated)" }} />
              <div className="h-3 w-3/4 rounded" style={{ background: "var(--bg-elevated)" }} />
            </div>
          </div>
        </div>
      </div>
    );
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
          className="px-5 py-4 border-b flex-shrink-0"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <h1 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
              Conversations
            </h1>
            <SortDropdown value={sortOrder} onChange={setSortOrder} />
          </div>
          <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
            {conversations.length} thread{conversations.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
                No replies yet. Check back soon.
              </p>
            </div>
          ) : (
            sorted.map((conv) => {
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
                      style={{ background: "rgba(103,142,141,0.1)", color: "#678E8D" }}
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
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
              No replies yet. Check back soon.
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
                  className="text-base font-medium mb-1"
                  style={{ color: "var(--ink)", letterSpacing: "-0.03em" }}
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
                          ? "#678E8D"
                          : "#3C5352",
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
