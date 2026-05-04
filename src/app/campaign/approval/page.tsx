"use client";

import { useState } from "react";
import { draftEmails } from "@/lib/mock-data";
import { Check, Pencil, SkipForward, Send, Building2, ArrowLeft } from "lucide-react";
import Link from "next/link";

type EmailState = "pending" | "approved" | "skipped";

export default function ApprovalPage() {
  const [states, setStates] = useState<Record<string, EmailState>>(
    Object.fromEntries(draftEmails.map((e) => [e.id, "pending"]))
  );
  const [current, setCurrent] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [justApproved, setJustApproved] = useState(false);

  const email = draftEmails[current];
  const reviewed = Object.values(states).filter((s) => s !== "pending").length;
  const total = draftEmails.length;
  const allDone = reviewed === total;

  const handleApprove = () => {
    setJustApproved(true);
    setStates((prev) => ({ ...prev, [email.id]: "approved" }));
    setTimeout(() => {
      setJustApproved(false);
      if (current < draftEmails.length - 1) setCurrent((c) => c + 1);
    }, 700);
  };

  const handleSkip = () => {
    setStates((prev) => ({ ...prev, [email.id]: "skipped" }));
    if (current < draftEmails.length - 1) setCurrent((c) => c + 1);
  };

  const handleEdit = () => {
    setEditBody(email.body);
    setEditing(email.id);
  };

  const handleSaveEdit = () => {
    setEditing(null);
  };

  if (allDone) {
    const approved = Object.values(states).filter((s) => s === "approved").length;
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ background: "rgba(52,211,153,0.1)" }}
          >
            <Send className="w-7 h-7" style={{ color: "#34d399" }} />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--ink)" }}>
            Queue complete
          </h2>
          <p className="text-sm mb-1" style={{ color: "var(--ink-secondary)" }}>
            <span style={{ color: "#34d399", fontWeight: 600 }}>{approved} email{approved !== 1 ? "s" : ""}</span> approved and sent.
          </p>
          <p className="text-sm mb-8" style={{ color: "var(--ink-muted)" }}>
            {total - approved} skipped.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            View Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const prof = email.professor;

  return (
    <div className="px-10 py-10 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Link
            href="/campaign/professors"
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/[0.06]"
            style={{ color: "var(--ink-secondary)" }}
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--ink)" }}>
              Approval Queue
            </h1>
            <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
              Review and send each email
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {draftEmails.map((e, i) => (
              <button
                key={e.id}
                onClick={() => setCurrent(i)}
                className="w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center transition-all duration-150"
                style={
                  states[e.id] === "approved"
                    ? { background: "rgba(52,211,153,0.15)", color: "#34d399" }
                    : states[e.id] === "skipped"
                    ? { background: "var(--bg-elevated)", color: "var(--ink-muted)" }
                    : i === current
                    ? { background: "var(--accent-muted)", color: "var(--accent-hover)" }
                    : { background: "var(--bg-elevated)", color: "var(--ink-muted)" }
                }
              >
                {states[e.id] === "approved" ? (
                  <Check className="w-3 h-3" strokeWidth={3} />
                ) : (
                  i + 1
                )}
              </button>
            ))}
          </div>
          <span className="text-xs tabular-nums" style={{ color: "var(--ink-muted)" }}>
            {reviewed} / {total} reviewed
          </span>
        </div>
      </div>

      {/* Email card */}
      <div
        className="rounded-2xl border overflow-hidden transition-all duration-300"
        style={{
          background: justApproved ? "rgba(52,211,153,0.04)" : "var(--bg-card)",
          borderColor: justApproved ? "rgba(52,211,153,0.25)" : "var(--border-subtle)",
          boxShadow: justApproved ? "0 0 32px rgba(52,211,153,0.1)" : "none",
        }}
      >
        {/* Professor header */}
        <div
          className="px-6 py-5 border-b flex items-center justify-between"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <div className="flex items-center gap-3.5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold"
              style={{ background: "var(--bg-elevated)", color: "var(--ink-secondary)" }}
            >
              {prof.name
                .replace("Prof. ", "")
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                {prof.name}
              </p>
              <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--ink-muted)" }}>
                <Building2 className="w-3 h-3" />
                {prof.department} · {prof.university}
              </p>
            </div>
          </div>
          {justApproved && (
            <div
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full animate-fade-in"
              style={{ background: "rgba(52,211,153,0.12)", color: "#34d399" }}
            >
              <Check className="w-3 h-3" strokeWidth={3} />
              Sent
            </div>
          )}
        </div>

        {/* Subject */}
        <div className="px-6 py-4 border-b" style={{ borderColor: "var(--border-subtle)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--ink-muted)" }}>
            Subject
          </p>
          <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
            {email.subject}
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ink-muted)" }}>
            Body
          </p>
          {editing === email.id ? (
            <div className="space-y-3">
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={14}
                className="w-full text-sm leading-7 rounded-xl px-4 py-3 border resize-none"
                style={{
                  background: "var(--bg-elevated)",
                  borderColor: "var(--border-default)",
                  color: "var(--ink)",
                  outline: "none",
                  fontFamily: "inherit",
                }}
              />
              <button
                onClick={handleSaveEdit}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: "var(--accent-muted)", color: "var(--accent-hover)" }}
              >
                Done editing
              </button>
            </div>
          ) : (
            <div className="text-sm leading-7 whitespace-pre-wrap" style={{ color: "var(--ink-secondary)" }}>
              {editing === email.id ? editBody : email.body}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      {!justApproved && (
        <div className="flex items-center gap-3 mt-5 animate-slide-up">
          <button
            onClick={handleApprove}
            className="flex-1 flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-sm font-semibold transition-all duration-150"
            style={{
              background: "rgba(52,211,153,0.1)",
              color: "#34d399",
              border: "1px solid rgba(52,211,153,0.2)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(52,211,153,0.16)";
              e.currentTarget.style.boxShadow = "0 0 20px rgba(52,211,153,0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(52,211,153,0.1)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <Check className="w-4 h-4" strokeWidth={2.5} />
            Approve & Send
          </button>

          <button
            onClick={handleEdit}
            className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-medium border transition-all duration-150"
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
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>

          <button
            onClick={handleSkip}
            className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-medium transition-all duration-150"
            style={{
              background: "transparent",
              color: "var(--ink-muted)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--ink-secondary)";
              e.currentTarget.style.background = "var(--bg-elevated)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--ink-muted)";
              e.currentTarget.style.background = "transparent";
            }}
          >
            <SkipForward className="w-3.5 h-3.5" />
            Skip
          </button>
        </div>
      )}

      {/* Upcoming */}
      {current < draftEmails.length - 1 && !justApproved && (
        <div
          className="mt-6 px-4 py-3 rounded-xl border flex items-center gap-3"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border-subtle)",
          }}
        >
          <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
            Next up:
          </p>
          <p className="text-xs font-medium" style={{ color: "var(--ink-secondary)" }}>
            {draftEmails[current + 1].professor.name} · {draftEmails[current + 1].professor.university}
          </p>
        </div>
      )}
    </div>
  );
}
