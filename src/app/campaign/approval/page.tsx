"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Pencil, SkipForward, Building2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Email } from "@/lib/types";

type EmailState = "pending" | "approved" | "skipped";
type CardPhase = "idle" | "sent" | "exiting" | "entering";

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
  const [cardPhase, setCardPhase] = useState<CardPhase>("idle");
  const [exitDir, setExitDir] = useState<"left" | "right">("left");
  const [showDone, setShowDone] = useState(false);
  const [loadingDrafts, setLoadingDrafts] = useState(true);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [draftWarnings, setDraftWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (!campaignId) {
      setDraftError("No campaign found. Please start a new campaign.");
      setLoadingDrafts(false);
      return;
    }

    const controller = new AbortController();

    const loadDrafts = async () => {
      try {
        const draftsRes = await fetch("/api/emails/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignId }),
          signal: controller.signal,
        });
        const data = await draftsRes.json();
        if (!draftsRes.ok) throw new Error(data.error ?? "Failed to generate drafts");

        const emailList: Email[] = data.emails ?? [];
        setEmails(emailList);
        setStates(Object.fromEntries(emailList.map((e) => [e.id, "pending" as EmailState])));
        setBodies(Object.fromEntries(emailList.map((e) => [e.id, e.body ?? ""])));

        const warnings: string[] = [];
        const failed = (data.failed_count as number | null) ?? 0;
        if (failed > 0) {
          warnings.push(`${failed} email${failed === 1 ? "" : "s"} could not be drafted and ${failed === 1 ? "was" : "were"} skipped.`);
        }
        const dupes = (data.duplicate_skipped as string[] | null) ?? [];
        if (dupes.length > 0) {
          warnings.push(
            `${dupes.length === 1 ? "Skipped" : "Skipped"} ${dupes.join(", ")} — already emailed in a previous campaign.`
          );
        }
        if (warnings.length > 0) setDraftWarnings(warnings);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setDraftError(err instanceof Error ? err.message : "Failed to load drafts");
      } finally {
        if (!controller.signal.aborted) setLoadingDrafts(false);
      }
    };

    loadDrafts();
    return () => controller.abort();
  }, [campaignId]);

  // Animates the current card out, then advances to the next card (or done screen).
  const advanceCard = useCallback((nextIndex: number, isLast: boolean) => {
    setCardPhase("exiting");
    setTimeout(() => {
      if (isLast) {
        setShowDone(true);
        setCardPhase("idle");
      } else {
        setCurrent(nextIndex);
        // Set entering state (no transition) so browser renders start position...
        setCardPhase("entering");
        // ...then on the next two frames, flip to idle so CSS transition fires.
        requestAnimationFrame(() =>
          requestAnimationFrame(() => setCardPhase("idle"))
        );
      }
    }, 280);
  }, []);

  if (loadingDrafts) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-5">
        <div className="flex items-center gap-2.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="block w-2 h-2 rounded-full" style={{ background: "var(--accent)", animation: `pulse-dot 1.2s ease-in-out ${i * 0.18}s infinite` }} />
          ))}
        </div>
        <p className="text-sm" style={{ color: "var(--ink-secondary)" }}>Drafting your emails…</p>
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

  if (showDone) {
    const approved = Object.values(states).filter((s) => s === "approved").length;
    const total = emails.length;
    return (
      <div className="min-h-screen flex items-center justify-center px-6 animate-fade-in">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: "rgba(103,142,141,0.1)" }}>
            <img src="/icons/confirmation.png" alt="" className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-medium mb-2" style={{ color: "var(--ink)", letterSpacing: "-0.03em" }}>
            You're all set
          </h2>
          <p className="text-sm mb-1" style={{ color: "var(--ink-secondary)" }}>
            <span style={{ color: "#678E8D", fontWeight: 600 }}>{approved} email{approved !== 1 ? "s" : ""}</span> sent to professors.
          </p>
          <p className="text-xs mb-8" style={{ color: "var(--ink-muted)" }}>
            {total - approved > 0 ? `${total - approved} skipped.` : "Good luck!"}
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            View Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const email = emails[current];
  const reviewed = Object.values(states).filter((s) => s !== "pending").length;
  const total = emails.length;
  const approvedCount = Object.values(states).filter((s) => s === "approved").length;

  const handleApprove = async () => {
    if (!email || cardPhase !== "idle" || sendingId) return;
    const isLast = current >= emails.length - 1;
    setSendingId(email.id);
    setSendError(null);

    try {
      const res = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId: email.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSendError(data.error ?? `Send failed (${res.status})`);
        setSendingId(null);
        return;
      }
      if (!data.ok) {
        setSendError(data.error ?? "Send failed");
        setSendingId(null);
        return;
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Network error");
      setSendingId(null);
      return;
    }

    setStates((prev) => ({ ...prev, [email.id]: "approved" }));
    setExitDir("left");
    setCardPhase("sent");

    setTimeout(() => {
      setSendingId(null);
      advanceCard(current + 1, isLast);
    }, 1000);
  };

  const handleSkip = () => {
    if (!email || cardPhase !== "idle") return;
    const isLast = current >= emails.length - 1;
    setSendError(null);
    setStates((prev) => ({ ...prev, [email.id]: "skipped" }));
    setExitDir("right");
    advanceCard(current + 1, isLast);
  };

  const handleEdit = () => {
    if (!email || cardPhase !== "idle") return;
    setEditBody(bodies[email.id] ?? email.body ?? "");
    setEditing(email.id);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    const newBody = editBody;
    setBodies((prev) => ({ ...prev, [editing]: newBody }));
    setEditing(null);
    await fetch(`/api/emails/${editing}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newBody }),
    }).catch(() => {});
  };

  const handleApproveAll = async () => {
    const pending = emails.filter((e) => states[e.id] === "pending");
    for (const e of pending) {
      try {
        const res = await fetch("/api/emails/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emailId: e.id }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          console.error("[approveAll] send failed for", e.id, res.status, data);
        } else {
          console.log("[approveAll] sent", e.id, data);
          setStates((prev) => ({ ...prev, [e.id]: "approved" }));
        }
      } catch (err) {
        console.error("[approveAll] network error for", e.id, err);
      }
    }
    setShowDone(true);
  };

  if (!email) return null;

  const currentBody = bodies[email.id] ?? email.body ?? "";
  const showSentBadge = cardPhase === "sent" || cardPhase === "exiting";
  const isAnimating = cardPhase !== "idle";

  // Card style driven by phase. "entering" uses transition:none so the browser
  // renders the start position instantly before we flip to idle and animate in.
  const CARD_TRANSITION = "opacity 0.28s ease, transform 0.28s ease, background-color 0.35s ease, border-color 0.35s ease, box-shadow 0.35s ease";

  const cardStyle = ((): React.CSSProperties => {
    switch (cardPhase) {
      case "sent":
        return {
          transition: CARD_TRANSITION,
          opacity: 1,
          transform: "translateY(0) scale(1)",
          background: "rgba(103,142,141,0.06)",
          borderColor: "rgba(103,142,141,0.28)",
          boxShadow: "0 0 32px rgba(103,142,141,0.12), 0 1px 3px rgba(0,0,0,0.06)",
        };
      case "exiting":
        return {
          transition: CARD_TRANSITION,
          opacity: 0,
          transform: exitDir === "left"
            ? "translateX(-28px) scale(0.98)"
            : "translateX(28px) scale(0.98)",
          background: exitDir === "left" ? "rgba(103,142,141,0.04)" : "var(--bg-card)",
          borderColor: exitDir === "left" ? "rgba(103,142,141,0.15)" : "var(--border-subtle)",
          boxShadow: "none",
        };
      case "entering":
        return {
          transition: "none",
          opacity: 0,
          transform: "translateY(14px)",
          background: "var(--bg-card)",
          borderColor: "var(--border-subtle)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        };
      default:
        return {
          transition: CARD_TRANSITION,
          opacity: 1,
          transform: "translateY(0) scale(1)",
          background: "var(--bg-card)",
          borderColor: "var(--border-subtle)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        };
    }
  })();

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

        {/* Progress dots */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {emails.map((e, i) => (
              <button
                key={e.id}
                onClick={() => { if (!isAnimating) setCurrent(i); }}
                className="w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center transition-all duration-150"
                style={
                  states[e.id] === "approved"
                    ? { background: "rgba(103,142,141,0.15)", color: "#678E8D" }
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

      {/* Draft warnings (partial failure or duplicate skips) */}
      {draftWarnings.length > 0 && (
        <div className="mb-4 space-y-1.5">
          {draftWarnings.map((w, i) => (
            <div
              key={i}
              className="px-4 py-2.5 rounded-xl text-xs"
              style={{
                background: "rgba(234,179,8,0.07)",
                color: "#b45309",
                border: "1px solid rgba(234,179,8,0.18)",
              }}
            >
              {w}
            </div>
          ))}
        </div>
      )}

      {/* Email card */}
      <div className="rounded-xl border overflow-hidden" style={cardStyle}>
        {/* Professor header */}
        <div
          className="px-6 py-5 border-b flex items-center justify-between"
          style={{ borderColor: showSentBadge ? "rgba(103,142,141,0.2)" : "var(--border-subtle)", transition: "border-color 0.35s ease" }}
        >
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

          {showSentBadge && (
            <div
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full animate-fade-in"
              style={{ background: "rgba(103,142,141,0.12)", color: "#678E8D" }}
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

      {/* Send error banner */}
      {sendError && cardPhase === "idle" && editing !== email.id && (
        <div
          className="mt-4 px-4 py-3 rounded-xl text-xs font-medium text-center"
          style={{ background: "rgba(248,113,113,0.08)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}
        >
          {sendError}
        </div>
      )}

      {/* Actions — shown only when idle and not editing */}
      {cardPhase === "idle" && editing !== email.id && (
        <div className="flex items-center gap-2.5 mt-4 animate-slide-up">
          <button
            onClick={handleApprove}
            disabled={!!sendingId}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-semibold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "rgba(103,142,141,0.1)", color: "#678E8D", border: "1px solid rgba(103,142,141,0.2)" }}
            onMouseEnter={(e) => { if (!sendingId) { e.currentTarget.style.background = "rgba(103,142,141,0.18)"; } }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(103,142,141,0.1)"; }}
          >
            <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
            Approve & Send
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

      {/* Next up preview */}
      {current < emails.length - 1 && cardPhase === "idle" && editing !== email.id && (
        <div className="mt-6 px-4 py-3 rounded-xl border flex items-center gap-3" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
          <p className="text-xs" style={{ color: "var(--ink-muted)" }}>Next up:</p>
          <p className="text-xs font-medium" style={{ color: "var(--ink-secondary)" }}>
            {emails[current + 1].professor_name} · {emails[current + 1].university}
          </p>
        </div>
      )}

      {current < emails.length - 1 && cardPhase === "idle" && editing !== email.id && (
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
