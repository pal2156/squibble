"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { professors, type Professor } from "@/lib/mock-data";
import { ArrowRight, Check, Mail, Building2, FlaskConical } from "lucide-react";

function fitScoreStyle(score: number): { bg: string; text: string; border: string } {
  if (score >= 90) return { bg: "rgba(52,211,153,0.1)", text: "#34d399", border: "rgba(52,211,153,0.2)" };
  if (score >= 85) return { bg: "rgba(124,111,247,0.1)", text: "#a78bfa", border: "rgba(124,111,247,0.2)" };
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
  const scoreStyle = fitScoreStyle(professor.fitScore);
  const initials = professor.name
    .replace("Prof. ", "")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  return (
    <button
      onClick={onToggle}
      className="w-full text-left rounded-2xl border p-5 transition-all duration-150 group relative"
      style={{
        background: selected ? "rgba(124,111,247,0.04)" : "var(--bg-card)",
        borderColor: selected ? "rgba(124,111,247,0.25)" : "var(--border-subtle)",
        boxShadow: selected ? "0 0 0 1px rgba(124,111,247,0.15)" : "none",
      }}
    >
      {/* Rank */}
      <div className="absolute top-4 left-4 text-[11px] font-bold tabular-nums" style={{ color: "var(--ink-muted)" }}>
        #{rank}
      </div>

      {/* Check */}
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
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{ background: "var(--bg-elevated)", color: "var(--ink-secondary)" }}
        >
          {initials}
        </div>

        <div className="flex-1 min-w-0 pr-6">
          {/* Name + badge */}
          <div className="flex items-start gap-2.5 flex-wrap mb-1">
            <h3 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
              {professor.name}
            </h3>
            <span
              className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full border"
              style={{
                background: scoreStyle.bg,
                color: scoreStyle.text,
                borderColor: scoreStyle.border,
              }}
            >
              {professor.fitScore}% match
            </span>
          </div>

          {/* University + dept */}
          <div className="flex items-center gap-3 mb-2.5">
            <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--ink-secondary)" }}>
              <Building2 className="w-3 h-3" style={{ color: "var(--ink-muted)" }} />
              {professor.university}
            </span>
            <span className="w-px h-3" style={{ background: "var(--border-default)" }} />
            <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--ink-secondary)" }}>
              <FlaskConical className="w-3 h-3" style={{ color: "var(--ink-muted)" }} />
              {professor.department}
            </span>
          </div>

          {/* Description */}
          <p className="text-xs leading-relaxed mb-3" style={{ color: "var(--ink-secondary)" }}>
            {professor.description}
          </p>

          {/* Tags + email */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {professor.researchAreas.slice(0, 2).map((area) => (
                <span
                  key={area}
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{ background: "var(--bg-elevated)", color: "var(--ink-muted)" }}
                >
                  {area}
                </span>
              ))}
            </div>
            <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--ink-muted)" }}>
              <Mail className="w-3 h-3" />
              {professor.email}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function ProfessorsPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(
    new Set(professors.filter((p) => p.selected).map((p) => p.id))
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedCount = selected.size;

  return (
    <div className="px-10 py-10 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1.5" style={{ color: "var(--ink)" }}>
              Professor Rankings
            </h1>
            <p className="text-sm" style={{ color: "var(--ink-secondary)" }}>
              Ranked by research alignment with your profile. Select who to reach out to.
            </p>
          </div>
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              color: "var(--ink-secondary)",
            }}
          >
            <span style={{ color: "var(--ink)" }}>{selectedCount}</span>
            <span>of {professors.length} selected</span>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3 mb-8">
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

      {/* CTA */}
      <div
        className="sticky bottom-6 flex items-center justify-between gap-4 px-5 py-4 rounded-2xl border backdrop-blur-xl"
        style={{
          background: "rgba(13,13,26,0.85)",
          borderColor: "var(--border-strong)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
            {selectedCount === 0
              ? "Select professors to continue"
              : `${selectedCount} professor${selectedCount !== 1 ? "s" : ""} selected`}
          </p>
          <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
            Claude will write personalized emails for each
          </p>
        </div>
        <button
          onClick={() => selectedCount > 0 && router.push("/campaign/approval")}
          disabled={selectedCount === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          style={
            selectedCount > 0
              ? {
                  background: "var(--accent)",
                  color: "#fff",
                  boxShadow: "0 0 20px rgba(124,111,247,0.3)",
                }
              : {
                  background: "var(--bg-elevated)",
                  color: "var(--ink-secondary)",
                }
          }
        >
          Draft Emails
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
