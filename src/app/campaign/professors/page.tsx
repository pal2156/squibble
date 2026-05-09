"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { professors, type Professor } from "@/lib/mock-data";
import { ArrowRight, Check, Mail, Building2, FlaskConical, GraduationCap } from "lucide-react";

const DRAFT_MESSAGES = [
  "Reading your profile...",
  "Personalizing each email...",
  "Reviewing for tone and fit...",
  "Attaching your CV...",
  "All set.",
];

const STEP = 2000;
const FADE_START = 1500;

function LoadingModal({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const [modalVisible, setModalVisible] = useState(true);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    DRAFT_MESSAGES.forEach((_, i) => {
      timers.push(setTimeout(() => setFading(true), i * STEP + FADE_START));
      if (i < DRAFT_MESSAGES.length - 1) {
        timers.push(setTimeout(() => { setIndex(i + 1); setFading(false); }, (i + 1) * STEP));
      }
    });

    timers.push(setTimeout(() => setModalVisible(false), DRAFT_MESSAGES.length * STEP));
    timers.push(setTimeout(onClose, DRAFT_MESSAGES.length * STEP + 300));

    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{
        background: "rgba(14, 22, 28, 0.45)",
        backdropFilter: "blur(4px)",
        opacity: modalVisible ? 1 : 0,
        transition: "opacity 300ms ease",
      }}
    >
      <div
        className="rounded-2xl px-10 py-10 flex flex-col items-center gap-7 shadow-2xl"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          minWidth: 320,
        }}
      >
        <div className="flex items-center gap-2.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="block w-2 h-2 rounded-full"
              style={{
                background: "var(--accent)",
                animation: `pulse-dot 1.2s ease-in-out ${i * 0.18}s infinite`,
              }}
            />
          ))}
        </div>

        <p
          className="text-sm font-medium text-center"
          style={{
            color: "var(--ink-secondary)",
            opacity: fading ? 0 : 1,
            transition: "opacity 420ms ease",
            minWidth: 240,
          }}
        >
          {DRAFT_MESSAGES[index]}
        </p>
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1);   }
        }
      `}</style>
    </div>
  );
}

function fitScoreStyle(score: number): { bg: string; text: string; border: string } {
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
      className="w-full text-left rounded-xl border p-4 transition-all duration-150 group relative"
      style={{
        background: selected ? "rgba(31,73,89,0.04)" : "var(--bg-card)",
        borderColor: selected ? "#5C7C89" : "var(--border-subtle)",
        boxShadow: selected
          ? "0 0 0 1px rgba(92,124,137,0.18), 0 1px 3px rgba(0,0,0,0.06)"
          : "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
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
              {professor.name.replace(/^Prof\.\s*/i, "")}
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

          {/* University + dept + title */}
          <div className="flex items-center gap-3 mb-2.5 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--ink-secondary)" }}>
              <Building2 className="w-3 h-3" style={{ color: "var(--ink-muted)" }} />
              {professor.university}
            </span>
            <span className="w-px h-3" style={{ background: "var(--border-default)" }} />
            <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--ink-secondary)" }}>
              <FlaskConical className="w-3 h-3" style={{ color: "var(--ink-muted)" }} />
              {professor.department}
            </span>
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
  const [showModal, setShowModal] = useState(false);

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
    <div className="px-8 py-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold tracking-tight mb-0.5" style={{ color: "var(--ink)" }}>
              Your best shots
            </h1>
            <p className="text-xs" style={{ color: "var(--ink-secondary)" }}>
              Ranked by research fit and likelihood to respond. Select who to contact.
            </p>
          </div>
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              color: "var(--ink-secondary)",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
          >
            <span style={{ color: "var(--ink)", fontWeight: 600 }}>{selectedCount}</span>
            <span>of {professors.length} selected</span>
          </div>
        </div>
      </div>

      {/* List */}
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

      {/* CTA */}
      <div
        className="sticky bottom-5 flex items-center justify-between gap-4 px-4 py-3 rounded-xl border backdrop-blur-xl"
        style={{
          background: "rgba(255,255,255,0.96)",
          borderColor: "var(--border-default)",
          boxShadow: "0 -4px 20px rgba(31,73,89,0.07), 0 0 0 1px rgba(92,124,137,0.1)",
        }}
      >
        <p className="text-xs font-medium" style={{ color: "var(--ink)" }}>
          {selectedCount === 0 ? "Select professors to continue" : `${selectedCount} selected`}
        </p>
        <button
          onClick={() => selectedCount > 0 && setShowModal(true)}
          disabled={selectedCount === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          style={
            selectedCount > 0
              ? {
                  background: "var(--accent)",
                  color: "#fff",
                  boxShadow: "0 0 16px rgba(31,73,89,0.5)",
                }
              : {
                  background: "var(--bg-elevated)",
                  color: "var(--ink-secondary)",
                }
          }
        >
          Draft Emails
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {showModal && <LoadingModal onClose={() => router.push("/campaign/approval")} />}
    </div>
  );
}
