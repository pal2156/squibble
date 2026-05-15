"use client";

import { useState, useEffect, useRef } from "react";
import { Pencil, Check } from "lucide-react";

interface Props {
  university: string;
  research: string;
  availability: string;
  onConfirm: (name: string) => void;
}

type Phase = "generating" | "suggested" | "editing";

const FAMOUS_UNIS: Record<string, string> = {
  "university of california berkeley": "Berkeley",
  "uc berkeley": "Berkeley",
  "massachusetts institute of technology": "MIT",
  "california institute of technology": "Caltech",
  "harvard university": "Harvard",
  "stanford university": "Stanford",
  "princeton university": "Princeton",
  "yale university": "Yale",
  "columbia university": "Columbia",
  "university of pennsylvania": "Penn",
  "johns hopkins university": "JHU",
  "duke university": "Duke",
  "northwestern university": "Northwestern",
  "university of chicago": "Chicago",
  "university of illinois urbana-champaign": "UIUC",
  "university of illinois at urbana-champaign": "UIUC",
  "university of michigan": "UMich",
  "university of michigan ann arbor": "UMich",
};

// TODO: Connect to actual Claude API
async function mockGenerateName(
  university: string,
  research: string,
  _availability: string
): Promise<string> {
  await new Promise((r) => setTimeout(r, 1200 + Math.random() * 800));

  const uniKey = university.toLowerCase().trim();
  const uniShort =
    FAMOUS_UNIS[uniKey] ??
    university
      .replace(/^(University of |The University of |UC )/i, "")
      .split(",")[0]
      .trim()
      .split(" ")
      .slice(0, 2)
      .join(" ");

  const subfield = research
    .replace(/\b(research|study|explore|looking for|interested in|want to)\b/gi, "")
    .replace(/[^a-zA-Z\s]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter((w) => w.length > 0)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  return `${uniShort} ${subfield}`;
}

export function CampaignNameSuggestion({ university, research, availability, onConfirm }: Props) {
  const [phase, setPhase] = useState<Phase>("generating");
  const [name, setName] = useState("");
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    mockGenerateName(university, research, availability).then((result) => {
      if (!cancelled) {
        setName(result);
        setPhase("suggested");
      }
    });
    return () => { cancelled = true; };
  }, [university, research, availability]);

  useEffect(() => {
    if (phase === "editing") {
      setDraft(name);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [phase, name]);

  if (phase === "generating") {
    return (
      <div
        className="rounded-xl p-5 flex items-center gap-4"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
      >
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="block w-1.5 h-1.5 rounded-full"
              style={{
                background: "var(--accent)",
                animation: `pulse-dot 1.2s ease-in-out ${i * 0.18}s infinite`,
              }}
            />
          ))}
        </div>
        <p className="text-sm" style={{ color: "var(--ink-secondary)" }}>
          Generating campaign name…
        </p>
        <style>{`
          @keyframes pulse-dot {
            0%, 100% { opacity: 0.2; transform: scale(0.8); }
            50%       { opacity: 1;   transform: scale(1);   }
          }
        `}</style>
      </div>
    );
  }

  if (phase === "editing") {
    return (
      <div
        className="rounded-xl p-5 flex items-center gap-3"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              setName(draft.trim());
              setPhase("suggested");
            }
            if (e.key === "Escape") setPhase("suggested");
          }}
          className="flex-1 px-3 py-2 rounded-lg text-sm border"
          style={{
            background: "var(--bg-base)",
            borderColor: "var(--border-strong)",
            color: "var(--ink)",
            outline: "none",
          }}
        />
        <button
          onClick={() => {
            if (draft.trim()) { setName(draft.trim()); setPhase("suggested"); }
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          <Check className="w-3.5 h-3.5" />
          Done
        </button>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-3"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--ink-tertiary, var(--ink-secondary))" }}>
          Campaign name
        </p>
        <p className="text-sm font-medium truncate" style={{ color: "var(--ink)" }}>
          {name}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => setPhase("editing")}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            background: "var(--accent-muted)",
            color: "var(--accent)",
            border: "1px solid transparent",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "transparent")}
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit name
        </button>

        <button
          onClick={() => onConfirm(name)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all"
          style={{ background: "var(--accent)", color: "#fff", boxShadow: "0 0 16px rgba(103,142,141,0.35)" }}
        >
          <Check className="w-3.5 h-3.5" />
          Keep this name
        </button>
      </div>
    </div>
  );
}
