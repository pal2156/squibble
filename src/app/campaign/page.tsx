"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ArrowRight, Sparkles } from "lucide-react";

const fields = ["Physics", "Mathematics", "Computer Science", "Chemistry", "Biology", "Economics", "Psychology", "Neuroscience"];
const universities = ["Columbia University", "MIT", "Harvard University", "Princeton University", "Stanford University", "Yale University", "UC Berkeley", "Caltech", "University of Chicago", "Cornell University"];

const subfields: Record<string, string[]> = {
  Physics: ["Condensed Matter", "Quantum Computing", "Astrophysics", "Particle Physics", "Biophysics", "Atomic Physics", "Nuclear Physics", "Plasma Physics"],
  Mathematics: ["Algebraic Topology", "Number Theory", "Differential Geometry", "Probability & Statistics", "Combinatorics", "Numerical Analysis"],
  "Computer Science": ["Machine Learning", "Computer Vision", "Systems", "Algorithms", "Programming Languages", "Human-Computer Interaction"],
  Chemistry: ["Organic Chemistry", "Physical Chemistry", "Biochemistry", "Materials Chemistry", "Computational Chemistry"],
  Biology: ["Molecular Biology", "Genetics", "Evolutionary Biology", "Neuroscience", "Ecology"],
  Economics: ["Behavioral Economics", "Macroeconomics", "Development Economics", "Financial Economics"],
  Psychology: ["Cognitive Psychology", "Social Psychology", "Clinical Psychology", "Developmental Psychology"],
  Neuroscience: ["Computational Neuroscience", "Systems Neuroscience", "Cognitive Neuroscience", "Molecular Neuroscience"],
};

function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full appearance-none px-4 py-3.5 pr-10 rounded-xl text-sm font-medium border transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: "var(--bg-card)",
          borderColor: value ? "var(--border-strong)" : "var(--border-default)",
          color: value ? "var(--ink)" : "var(--ink-muted)",
          outline: "none",
        }}
      >
        <option value="" disabled hidden>{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o} style={{ background: "var(--bg-elevated)", color: "var(--ink)" }}>
            {o}
          </option>
        ))}
      </select>
      <ChevronDown
        className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
        style={{ color: "var(--ink-muted)" }}
      />
    </div>
  );
}

export default function CampaignPage() {
  const router = useRouter();
  const [field, setField] = useState("");
  const [university, setUniversity] = useState("");
  const [subfield, setSubfield] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFieldChange = (v: string) => {
    setField(v);
    setSubfield("");
  };

  const ready = field && university && subfield;

  const handleFind = async () => {
    if (!ready) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1400));
    router.push("/campaign/professors");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-12 text-center">
          <div
            className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-5"
            style={{ background: "var(--accent-muted)", color: "var(--accent-hover)" }}
          >
            <Sparkles className="w-3 h-3" />
            AI-Powered Matching
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-3" style={{ color: "var(--ink)" }}>
            Start a Campaign
          </h1>
          <p className="text-base" style={{ color: "var(--ink-secondary)" }}>
            Tell us where to look. We'll find and rank the right professors for you.
          </p>
        </div>

        {/* Form */}
        <div className="space-y-3 mb-8">
          <Select
            value={field}
            onChange={handleFieldChange}
            options={fields}
            placeholder="Field of Study"
          />
          <Select
            value={university}
            onChange={setUniversity}
            options={universities}
            placeholder="Target University"
          />
          <Select
            value={subfield}
            onChange={setSubfield}
            options={field ? subfields[field] : []}
            placeholder={field ? "Subfield" : "Select a field first"}
            disabled={!field}
          />
        </div>

        {/* CTA */}
        <button
          onClick={handleFind}
          disabled={!ready || loading}
          className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          style={
            ready && !loading
              ? {
                  background: "var(--accent)",
                  color: "#fff",
                  boxShadow: "0 0 28px rgba(124,111,247,0.3)",
                }
              : {
                  background: "var(--bg-elevated)",
                  color: "var(--ink-secondary)",
                }
          }
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Finding professors...
            </>
          ) : (
            <>
              Find Professors
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        {ready && !loading && (
          <p className="text-center text-xs mt-4" style={{ color: "var(--ink-muted)" }}>
            Scanning {university} · {field} · {subfield}
          </p>
        )}
      </div>
    </div>
  );
}
