"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, Mail, Building2, FlaskConical, GraduationCap } from "lucide-react";
import type { Professor } from "@/lib/types";
import { cleanDescription } from "@/lib/utils";
import { PLAN_LIMITS, type Plan } from "@/lib/plans";

function fitScoreStyle(score: number | null): { bg: string; text: string; border: string } {
  if (!score) return { bg: "rgba(103,142,141,0.1)", text: "#678E8D", border: "rgba(103,142,141,0.2)" };
  if (score >= 90) return { bg: "rgba(103,142,141,0.15)", text: "#678E8D", border: "rgba(103,142,141,0.3)" };
  if (score >= 85) return { bg: "rgba(103,142,141,0.1)", text: "#678E8D", border: "rgba(103,142,141,0.2)" };
  if (score >= 80) return { bg: "rgba(60,83,82,0.08)", text: "#3C5352", border: "rgba(60,83,82,0.15)" };
  return { bg: "rgba(187,210,221,0.2)", text: "#3C5352", border: "#BBD2DD" };
}

function ProfessorCard({
  professor,
  selected,
  onToggle,
  rank,
}: {
  professor: Professor;
  selected: boolean;
  onToggle: () => void;
  rank: number;
}) {
  const scoreStyle = fitScoreStyle(professor.fit_score);
  const initials = professor.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <button
      onClick={onToggle}
      className="w-full text-left rounded-xl border p-4 transition-all duration-150 group relative"
      style={{
        background: selected ? "rgba(103,142,141,0.1)" : "var(--bg-card)",
        borderColor: selected ? "#678E8D" : "var(--border-subtle)",
        boxShadow: selected
          ? "0 0 0 1px rgba(103,142,141,0.25), 0 1px 3px rgba(0,0,0,0.06)"
          : "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <div className="absolute top-4 left-4 text-[11px] font-bold tabular-nums" style={{ color: "var(--ink-muted)" }}>
        #{rank}
      </div>

      <div
        className="absolute top-4 right-4 w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-150"
        style={{
          borderColor: selected ? "var(--accent)" : "var(--border-default)",
          background: selected ? "var(--accent)" : "transparent",
        }}
      >
        {selected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
      </div>

      <div className="flex items-start gap-4 pl-5">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{ background: "var(--bg-elevated)", color: "var(--ink-secondary)" }}
        >
          {initials}
        </div>

        <div className="flex-1 min-w-0 pr-6">
          <div className="flex items-start gap-2.5 flex-wrap mb-1">
            <h3 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
              {professor.name.replace(/^Prof\.\s*/i, "")}
            </h3>
            {professor.fit_score != null && (
              <span
                className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full border"
                style={{ background: scoreStyle.bg, color: scoreStyle.text, borderColor: scoreStyle.border }}
              >
                {professor.fit_score}% match
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mb-2.5 flex-wrap">
            {professor.university && (
              <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--ink-secondary)" }}>
                <Building2 className="w-3 h-3" style={{ color: "var(--ink-muted)" }} />
                {professor.university}
              </span>
            )}
            {professor.department && (
              <>
                <span className="w-px h-3" style={{ background: "var(--border-default)" }} />
                <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--ink-secondary)" }}>
                  <FlaskConical className="w-3 h-3" style={{ color: "var(--ink-muted)" }} />
                  {professor.department}
                </span>
              </>
            )}
            {professor.title && (
              <>
                <span className="w-px h-3" style={{ background: "var(--border-default)" }} />
                <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--ink-secondary)" }}>
                  <GraduationCap className="w-3 h-3" style={{ color: "var(--ink-muted)" }} />
                  {professor.title}
                </span>
              </>
            )}
          </div>

          {professor.description && (
            <p className="text-xs leading-relaxed mb-3" style={{ color: "var(--ink-secondary)" }}>
              {cleanDescription(professor.description)}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {(professor.research_areas ?? []).slice(0, 2).map((area) => (
                <span
                  key={area}
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{ background: "var(--bg-elevated)", color: "var(--ink-muted)" }}
                >
                  {area}
                </span>
              ))}
            </div>
            {professor.email && (
              <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--ink-muted)" }}>
                <Mail className="w-3 h-3" />
                {professor.email}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function ProfessorsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("campaignId");

  const [professors, setProfessors] = useState<Professor[]>([]);
  const [campaignTitle, setCampaignTitle] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailsRemaining, setEmailsRemaining] = useState<number | null>(null);
  const [selectionLimitHit, setSelectionLimitHit] = useState(false);

  useEffect(() => {
    if (!campaignId) {
      setError("No campaign found. Please start a new campaign.");
      setLoading(false);
      return;
    }

    Promise.all([
      fetch(`/api/professors?campaignId=${campaignId}`).then((r) => r.json()),
      fetch("/api/usage").then((r) => r.json()),
    ])
      .then(([profData, usageData]) => {
        if (profData.error) throw new Error(profData.error);
        setProfessors(profData.professors ?? []);
        setCampaignTitle(profData.campaign?.title ?? "");

        const plan: Plan = usageData.plan ?? "free";
        const limit = PLAN_LIMITS[plan].emails;
        const used = usageData.emails_sent ?? 0;
        setEmailsRemaining(Math.max(0, limit - used));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [campaignId]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setSelectionLimitHit(false);
      } else {
        if (emailsRemaining !== null && next.size >= emailsRemaining) {
          setSelectionLimitHit(true);
          return prev;
        }
        next.add(id);
        setSelectionLimitHit(false);
      }
      return next;
    });
  };

  const handleDraftEmails = async () => {
    if (selected.size === 0 || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/professors/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, selectedIds: Array.from(selected) }),
      });
      if (!res.ok) throw new Error("Failed to save selections");
      router.push(`/campaign/approval?campaignId=${campaignId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-5">
        <div className="flex items-center gap-2.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="block w-2 h-2 rounded-full" style={{ background: "var(--accent)", animation: `pulse-dot 1.2s ease-in-out ${i * 0.18}s infinite` }} />
          ))}
        </div>
        <p className="text-sm" style={{ color: "var(--ink-secondary)" }}>Matching professors to your profile…</p>
        <style>{`@keyframes pulse-dot { 0%, 100% { opacity: 0.2; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen px-6">
        <div className="text-center">
          <p className="text-sm mb-4" style={{ color: "#f87171" }}>{error}</p>
          <button onClick={() => router.push("/campaign")} className="text-sm underline" style={{ color: "var(--ink-secondary)" }}>
            Start a new campaign
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-8 max-w-3xl mx-auto">
      {campaignTitle && (
        <div className="text-center mb-8">
          <h1 className="text-3xl font-medium" style={{ color: "var(--ink)", letterSpacing: "-0.03em" }}>
            {campaignTitle}
          </h1>
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-medium mb-0.5" style={{ color: "var(--ink)", letterSpacing: "-0.03em" }}>
              Your best shots
            </h2>
            <p className="text-xs" style={{ color: "var(--ink-secondary)" }}>
              Ranked by research fit and likelihood to respond. Select who to contact.
            </p>
          </div>
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", color: "var(--ink-secondary)", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
          >
            <span style={{ color: "var(--ink)", fontWeight: 600 }}>{selected.size}</span>
            <span>of {professors.length} selected</span>
          </div>
        </div>
      </div>

      <div className="space-y-2.5 mb-6">
        {professors.map((prof, i) => (
          <ProfessorCard
            key={prof.id}
            professor={prof}
            selected={selected.has(prof.id)}
            onToggle={() => toggle(prof.id)}
            rank={i + 1}
          />
        ))}
      </div>

      <div
        className="sticky bottom-5 rounded-xl border backdrop-blur-xl overflow-hidden"
        style={{ background: "rgba(60,83,82,0.97)", borderColor: "var(--border-default)", boxShadow: "0 -4px 20px rgba(103,142,141,0.12), 0 0 0 1px rgba(103,142,141,0.15)" }}
      >
        {selectionLimitHit && (
          <div className="px-4 pt-2.5 pb-0">
            <p className="text-xs" style={{ color: "#678E8D" }}>
              You can send up to {emailsRemaining} email{emailsRemaining === 1 ? "" : "s"} on your current plan. Deselect a professor to choose a different one.
            </p>
          </div>
        )}
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="text-xs font-medium" style={{ color: "var(--ink)" }}>
              {selected.size === 0 ? "Select professors to continue" : `${selected.size} selected`}
            </p>
            {emailsRemaining !== null && (
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                {emailsRemaining} email credit{emailsRemaining === 1 ? "" : "s"} remaining
              </p>
            )}
          </div>
          <button
            onClick={handleDraftEmails}
            disabled={selected.size === 0 || saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            style={
              selected.size > 0 && !saving
                ? { background: "var(--accent)", color: "#fff", boxShadow: "0 0 16px rgba(103,142,141,0.4)" }
                : { background: "var(--bg-elevated)", color: "var(--ink-secondary)" }
            }
          >
            {saving ? "Saving..." : `Draft ${selected.size > 0 ? selected.size + " " : ""}Email${selected.size !== 1 ? "s" : ""}`}
            {!saving && <ArrowRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProfessorsPage() {
  return (
    <Suspense>
      <ProfessorsContent />
    </Suspense>
  );
}
