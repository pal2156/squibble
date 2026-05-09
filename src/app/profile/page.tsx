"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, ArrowRight, ArrowLeft, Check, X } from "lucide-react";

const TOTAL_STEPS = 2;
const STORAGE_KEY = "truble_profile";

interface StoredProfile {
  profile_complete: boolean;
  cvName: string;
  extra: string;
}

interface FormState {
  cvName: string;
  extra: string;
}

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-0 mb-12">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const n = i + 1;
        const done = n < step;
        const active = n === step;
        return (
          <div key={n} className="flex items-center flex-1 last:flex-none">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all duration-300"
              style={
                done
                  ? { background: "#1F4959", color: "#fff" }
                  : active
                  ? { background: "#5C7C89", color: "#fff", boxShadow: "0 0 12px rgba(92,124,137,0.4)" }
                  : { background: "var(--bg-elevated)", color: "var(--ink-muted)" }
              }
            >
              {done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : n}
            </div>
            {n < TOTAL_STEPS && (
              <div
                className="flex-1 h-px mx-1.5 transition-all duration-500"
                style={{ background: done ? "#1F4959" : "var(--border-subtle)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold tracking-tight mb-1" style={{ color: "var(--ink)" }}>{title}</h2>
      {subtitle && <p className="text-xs" style={{ color: "var(--ink-secondary)" }}>{subtitle}</p>}
    </div>
  );
}

function CVUploadZone({
  cvName,
  parsing,
  onUpload,
  onClear,
  onReplace,
  compact,
}: {
  cvName: string;
  parsing: boolean;
  onUpload: (file: File | null) => void;
  onClear: () => void;
  onReplace?: () => void;
  compact?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    onUpload(e.dataTransfer.files?.[0] ?? null);
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => { onUpload(e.target.files?.[0] ?? null); if (fileRef.current) fileRef.current.value = ""; }}
      />
      {!cvName ? (
        <button
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="w-full border-2 border-dashed rounded-2xl flex flex-col items-center gap-3 transition-all duration-150"
          style={{ borderColor: "var(--border-default)", padding: compact ? "2.5rem 1rem" : "3.5rem 1rem" }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-strong)")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")}
        >
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "var(--bg-elevated)" }}>
            <Upload className="w-5 h-5" style={{ color: "var(--ink-muted)" }} />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium mb-0.5" style={{ color: "var(--ink-secondary)" }}>
              Drag & drop or <span style={{ color: "#5C7C89" }}>click to browse</span>
            </p>
            <p className="text-xs" style={{ color: "var(--ink-muted)" }}>PDF up to 5MB</p>
          </div>
        </button>
      ) : parsing ? (
        <div className="rounded-2xl border p-5 flex items-center gap-4" style={{ background: "var(--bg-card)", borderColor: "var(--border-subtle)" }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--bg-elevated)" }}>
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" style={{ color: "#5C7C89" }}>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>{cvName}</p>
            <p className="text-xs" style={{ color: "var(--ink-muted)" }}>Reading your CV…</p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border p-5 flex items-center gap-4" style={{ background: "rgba(52,211,153,0.04)", borderColor: "rgba(52,211,153,0.18)" }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(52,211,153,0.1)" }}>
            <FileText className="w-5 h-5" style={{ color: "#34d399" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: "var(--ink)" }}>{cvName}</p>
            {onReplace && (
              <button
                onClick={() => fileRef.current?.click()}
                className="text-xs underline underline-offset-2"
                style={{ color: "var(--ink-muted)" }}
              >
                Replace
              </button>
            )}
          </div>
          <button onClick={onClear} style={{ color: "var(--ink-muted)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [parsing, setParsing] = useState(false);
  const [form, setForm] = useState<FormState>({ cvName: "", extra: "" });
  const [isEditView, setIsEditView] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored: StoredProfile = JSON.parse(raw);
        if (stored.profile_complete) {
          setForm({ cvName: stored.cvName ?? "", extra: stored.extra ?? "" });
          setIsEditView(true);
        }
      }
    } catch { /* ignore corrupt storage */ }
    setLoaded(true);
  }, []);

  const set = useCallback(<K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
    setSaved(false);
  }, []);

  const handleUpload = (file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return;
    set("cvName", file.name);
    setParsing(true);
    setTimeout(() => setParsing(false), 1800);
  };

  const persist = (f: FormState) =>
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile_complete: true, ...f } satisfies StoredProfile));

  const handleContinue = () => {
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
    } else {
      persist(form);
      router.push("/profile/complete");
    }
  };

  const handleSave = () => {
    persist(form);
    setSaved(true);
  };

  if (!loaded) return null;

  // ── Edit view (return visits) ──────────────────────────────────────────────
  if (isEditView) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold tracking-tight mb-2" style={{ color: "var(--ink)" }}>Your profile</h2>
            <p className="text-sm" style={{ color: "var(--ink-secondary)" }}>Edit and save at any time.</p>
          </div>

          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--ink-muted)" }}>CV</p>
          <div className="mb-6">
            <CVUploadZone
              cvName={form.cvName}
              parsing={parsing}
              onUpload={handleUpload}
              onClear={() => set("cvName", "")}
              onReplace={() => {}}
              compact
            />
          </div>

          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--ink-muted)" }}>Anything else?</p>
          <textarea
            value={form.extra}
            onChange={(e) => set("extra", e.target.value)}
            rows={10}
            className="w-full px-3.5 py-3 rounded-lg border text-sm leading-relaxed resize-y mb-5"
            style={{
              background: "var(--bg-card)",
              borderColor: "var(--border-default)",
              color: "var(--ink)",
              outline: "none",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--border-strong)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
          />

          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150"
            style={{ background: "#1F4959", color: "#fff", boxShadow: "0 0 16px rgba(31,73,89,0.4)" }}
          >
            {saved ? (
              <><Check className="w-4 h-4" strokeWidth={2.5} /> Saved</>
            ) : (
              "Save changes"
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── First-time onboarding flow ─────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        <ProgressBar step={step} />

        {step === 1 && (
          <div className="animate-fade-in">
            <StepHeading
              title="Upload your CV"
              subtitle="We'll read it to personalize your emails."
            />
            <CVUploadZone
              cvName={form.cvName}
              parsing={parsing}
              onUpload={handleUpload}
              onClear={() => set("cvName", "")}
            />
            {!form.cvName && (
              <p className="text-center text-xs mt-4" style={{ color: "var(--ink-muted)" }}>
                Don't have one ready?{" "}
                <button
                  onClick={() => setStep(2)}
                  className="underline underline-offset-2"
                  style={{ color: "var(--accent-hover)" }}
                >
                  Skip for now
                </button>
              </p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in">
            <StepHeading
              title="Anything else you want us to know?"
            />
            <textarea
              value={form.extra}
              onChange={(e) => set("extra", e.target.value)}
              rows={12}
              className="w-full px-3.5 py-3 rounded-lg border text-sm leading-relaxed resize-y"
              style={{
                background: "var(--bg-card)",
                borderColor: "var(--border-default)",
                color: "var(--ink)",
                outline: "none",
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--border-strong)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
            />
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          {step > 1 ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-1.5 text-xs font-medium transition-colors px-3 py-2 rounded-lg"
              style={{ color: "var(--ink-muted)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink-secondary)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-muted)")}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
          ) : (
            <div />
          )}

          <button
            onClick={handleContinue}
            disabled={parsing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            style={
              !parsing
                ? { background: "#1F4959", color: "#fff", boxShadow: "0 0 16px rgba(31,73,89,0.4)" }
                : { background: "var(--bg-elevated)", color: "var(--ink-secondary)" }
            }
          >
            {step === TOTAL_STEPS ? "Save & continue" : "Continue"}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
