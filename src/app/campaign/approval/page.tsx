"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Pencil, SkipForward, Send, Building2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Email } from "@/lib/types";

type EmailState = "pending" | "approved" | "skipped";

function ApprovalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("campaignId");

  const [emails, setEmails] = useState<Email[]>([]);
  const [states, setStates] = useState<Record<string, EmailState>>({});
  const [bodies, setBodies] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [justApproved, setJustApproved] = useState(false);
  const [loadingDrafts, setLoadingDrafts] = useState(true);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!campaignId) {
      setDraftError("No campaign found. Please start a new campaign.");
      setLoadingDrafts(false);
      return;
    }

    const loadDrafts = async () => {
      try {
        const res = await fetch("/api/emails/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to generate drafts");

        const emailList: Email[] = data.emails ?? [];
        setEmails(emailList);
        setStates(Object.fromEntries(emailList.map((e) => [e.id, "pending" as EmailState])));
        setBodies(Object.fromEntries(emailList.map((e) => [e.id, e.body ?? ""])));
      } catch (err) {
        setDraftError(err instanceof Error ? err.message : "Failed to load drafts");
      } finally {
        setLoadingDrafts(false);
      }
    };

    loadDrafts();
  }, [campaignId]);

  if (loadingDrafts) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-5">
        <div className="flex items-center gap-2.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="block w-2 h-2 rounded-full" style={{ background: "var(--accent)", animation: `pulse-dot 1.2s ease-in-out ${i * 0.18}s infinite` }} />
          ))}
        </div>
        <p className="text-sm" style={{ color: "var(--ink-secondary)" }}>Drafting your emails…</p>
        <p className="text-xs" style={{ color: "var(--ink-muted)" }}>This takes about 10-30 seconds.</p>
        <style>{`@keyframes pulse-dot { 0%, 100% { opacity: 0.2; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1); } }`}</style>
      </div>
    );
  }

  if (draftError) {
    return (
      <div className="flex items-center justify-center min-h-screen px-6">
        <div className="text-center">
          <p className="text-sm mb-4" style={{ color: "#f87171" }}>{draftError}</p>
          <button onClick={() => router.push("/campaign")} className="text-sm underline" style={{ color: "var(--ink-secondary)" }}>
            Start a new campaign
          </button>
        </div>
      </div>
    );
  }

  const email = emails[current];
  const reviewed = Object.values(states).filter((s) => s !== "pending").length;
  const total = emails.length;
  const allDone = reviewed === total && total > 0;

  const handleApprove = async () => {
    if (!email || sendingId) return;
    setSendingId(email.id);
    setJustApproved(true);

    // Fire-and-forget send; Phase 5 wires this to Gmail
    await fetch("/api/emails/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailId: email.id }),
    }).catch(() => {});

    setStates((prev) => ({ ...prev, [email.id]: "approved" }));

    setTimeout(() => {
      setJustApproved(false);
      setSendingId(null);
      if (current < emails.length - 1) setCurrent((c) => c + 1);
    }, 700);
  };

  const handleSkip = () => {
    if (!email) return;
    setStates((prev) => ({ ...prev, [email.id]: "skipped" }));
    if (current < emails.length - 1) setCurrent((c) => c + 1);
  };

  const handleEdit = () => {
    if (!email) return;
    setEditBody(bodies[email.id] ?? email.body ?? "");
    setEditing(email.id);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    const newBody = editBody;
    setBodies((prev) => ({ ...prev, [editing]: newBody }));
    setEditing(null);
    // Persist edit to Supabase
    await fetch(`/api/emails/${editing}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newBody }),
    }).catch(() => {});
  };

  const handleApproveAll = async () => {
    const pending = emails.filter((e) => states[e.id] === "pending");
    setStates((prev) => {
      const next = { ...prev };
      pending.forEach((e) => { next[e.id] = "approved"; });
      return next;
    });
    // Send all pending
    for (const e of pending) {
      await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId: e.id }),
      }).catch(() => {});
    }
  };

  if (allDone) {
    const approved = Object.values(states).filter((s) => s === "approved").length;
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-5" style={{ background: "rgba(52,211,153,0.1)" }}>
            <Send className="w-5 h-5" style={{ color: "#34d399" }} />
          </div>
          <h2 className="text-xl font-bold mb-1.5" style={{ color: "var(--ink)" }}>
            Queue complete
          </h2>
          <p className="text-sm mb-1" style={{ color: "var(--ink-secondary)" }}>
            <span style={{ color: "#34d399", fontWeight: 600 }}>{approved} email{approved !== 1 ? "s" : ""}</span> approved and sent.
          </p>
          <p className="text-xs mb-7" style={{ color: "var(--ink-muted)" }}>
            {total - approved} skipped.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            View Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!email) return null;

  const currentBody = bodies[email.id] ?? email.body ?? "";

  return (
    <div className="px-8 py-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <Link
            href={campaignId ? `/campaign/professors?campaignId=${campaignId}` : "/campaign/professors"}
            className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-black/[0.05]"
            style={{ color: "var(--ink-secondary)" }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
          <div>
            <h1 className="text-base font-bold" style={{ color: "var(--ink)" }}>
              Approval Queue
            </h1>
            <p className="text-[11px]" style={{ color: "var(--ink-muted)" }}>
              Review and send each email
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {emails.map((e, i) => (
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
        className="rounded-xl border overflow-hidden transition-all duration-300"
        style={{
          background: justApproved ? "rgba(52,211,153,0.04)" : "var(--bg-card)",
          borderColor: justApproved ? "rgba(52,211,153,0.25)" : "var(--border-subtle)",
          boxShadow: justApproved
            ? "0 0 28px rgba(52,211,153,0.1), 0 1px 3px rgba(0,0,0,0.06)"
            : "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        {/* Professor header */}
        <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="flex items-center gap-3.5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold"
              style={{ background: "var(--bg-elevated)", color: "var(--ink-secondary)" }}
            >
              {(email.professor_name ?? "?")
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                {email.professor_name}
              </p>
              <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--ink-muted)" }}>
                <Building2 className="w-3 h-3" />
                {[email.department, email.university].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          {justApproved && (
            <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full animate-fade-in" style={{ background: "rgba(52,211,153,0.12)", color: "#34d399" }}>
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
                className="w-full text-sm leading-7 rounded-lg px-3.5 py-3 border resize-none"
                style={{ background: "var(--bg-elevated)", borderColor: "var(--border-default)", color: "var(--ink)", outline: "none", fontFamily: "inherit", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
              />
              <button
                onClick={handleSaveEdit}
                className="text-xs font-semibold px-3 py-1.5 rounded-md transition-colors"
                style={{ background: "var(--accent-muted)", color: "var(--accent-hover)" }}
              >
                Done editing
              </button>
            </div>
          ) : (
            <div className="text-sm leading-7 whitespace-pre-wrap" style={{ color: "var(--ink-secondary)" }}>
              {currentBody}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      {!justApproved && editing !== email.id && (
        <div className="flex items-center gap-2.5 mt-4 animate-slide-up">
          <button
            onClick={handleApprove}
            disabled={!!sendingId}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-semibold transition-all duration-150 disabled:opacity-60"
            style={{ background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}
            onMouseEnter={(e) => { if (!sendingId) { e.currentTarget.style.background = "rgba(52,211,153,0.16)"; e.currentTarget.style.boxShadow = "0 0 16px rgba(52,211,153,0.12)"; } }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(52,211,153,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
          >
            <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
            {sendingId ? "Sending..." : "Approve & Send"}
          </button>

          <button
            onClick={handleEdit}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-xs font-medium border transition-all duration-150"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-default)", color: "var(--ink-secondary)" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--ink)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; e.currentTarget.style.color = "var(--ink-secondary)"; }}
          >
            <Pencil className="w-3 h-3" />
            Edit
          </button>

          <button
            onClick={handleSkip}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-xs font-medium transition-all duration-150"
            style={{ background: "transparent", color: "var(--ink-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--ink-secondary)"; e.currentTarget.style.background = "var(--bg-elevated)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--ink-muted)"; e.currentTarget.style.background = "transparent"; }}
          >
            <SkipForward className="w-3 h-3" />
            Skip
          </button>
        </div>
      )}

      {/* Upcoming */}
      {current < emails.length - 1 && !justApproved && editing !== email.id && (
        <div className="mt-6 px-4 py-3 rounded-xl border flex items-center gap-3" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
          <p className="text-xs" style={{ color: "var(--ink-muted)" }}>Next up:</p>
          <p className="text-xs font-medium" style={{ color: "var(--ink-secondary)" }}>
            {emails[current + 1].professor_name} · {emails[current + 1].university}
          </p>
        </div>
      )}

      {current < emails.length - 1 && !justApproved && editing !== email.id && (
        <button
          onClick={handleApproveAll}
          className="w-full mt-3 py-2 text-xs font-medium rounded-xl transition-colors"
          style={{ color: "var(--ink-muted)", background: "transparent" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--ink-secondary)"; e.currentTarget.style.background = "var(--bg-elevated)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--ink-muted)"; e.currentTarget.style.background = "transparent"; }}
        >
          Approve all remaining
        </button>
      )}
    </div>
  );
}

export default function ApprovalPage() {
  return (
    <Suspense>
      <ApprovalContent />
    </Suspense>
  );
}
