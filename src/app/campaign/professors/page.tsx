"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, Mail, Building2, FlaskConical, GraduationCap } from "lucide-react";
import type { Professor } from "@/lib/types";
import { cleanDescription } from "@/lib/utils";

function fitScoreStyle(score: number | null): { bg: string; text: string; border: string } {
  if (!score) return { bg: "rgba(92,124,137,0.12)", text: "#5C7C89", border: "rgba(92,124,137,0.25)" };
  if (score >= 90) return { bg: "rgba(52,211,153,0.1)", text: "#34d399", border: "rgba(52,211,153,0.2)" };
  if (score >= 85) return { bg: "rgba(92,124,137,0.12)", text: "#5C7C89", border: "rgba(92,124,137,0.25)" };
  if (score >= 80) return { bg: "rgba(59,130,246,0.1)", text: "#60a5fa", border: "rgba(59,130,246,0.2)" };
  return { bg: "rgba(251,191,36,0.08)", text: "#fbbf24", border: "rgba(251,191,36,0.15)" };
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
        background: selected ? "rgba(31,73,89,0.04)" : "var(--bg-card)",
        borderColor: selected ? "#5C7C89" : "var(--border-subtle)",
        boxShadow: selected
          ? "0 0 0 1px rgba(92,124,137,0.18), 0 1px 3px rgba(0,0,0,0.06)"
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

  useEffect(() => {
    if (!campaignId) {
      setError("No campaign found. Please start a new campaign.");
      setLoading(false);
      return;
    }

    fetch(`/api/professors?campaignId=${campaignId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setProfessors(data.professors ?? []);
        setCampaignTitle(data.campaign?.title ?? "");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [campaignId]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-2.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="block w-2 h-2 rounded-full" style={{ background: "var(--accent)", animation: `pulse-dot 1.2s ease-in-out ${i * 0.18}s infinite` }} />
          ))}
        </div>
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
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--ink)" }}>
            {campaignTitle}
          </h1>
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold tracking-tight mb-0.5" style={{ color: "var(--ink)" }}>
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
        className="sticky bottom-5 flex items-center justify-between gap-4 px-4 py-3 rounded-xl border backdrop-blur-xl"
        style={{ background: "rgba(255,255,255,0.96)", borderColor: "var(--border-default)", boxShadow: "0 -4px 20px rgba(31,73,89,0.07), 0 0 0 1px rgba(92,124,137,0.1)" }}
      >
        <p className="text-xs font-medium" style={{ color: "var(--ink)" }}>
          {selected.size === 0 ? "Select professors to continue" : `${selected.size} selected`}
        </p>
        <button
          onClick={handleDraftEmails}
          disabled={selected.size === 0 || saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          style={
            selected.size > 0 && !saving
              ? { background: "var(--accent)", color: "#fff", boxShadow: "0 0 16px rgba(31,73,89,0.5)" }
              : { background: "var(--bg-elevated)", color: "var(--ink-secondary)" }
          }
        >
          {saving ? "Saving..." : "Draft Emails"}
          {!saving && <ArrowRight className="w-3.5 h-3.5" />}
        </button>
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
