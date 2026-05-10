"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, PenLine, Check, X } from "lucide-react";

const STORAGE_KEY = "truble_profile";

type Path = "A" | "B";

interface FormState {
  path: Path;
  cvName: string;
  extra: string;
  name: string;
  school: string;
  year: string;
  whatYouStudy: string;
  coursework: string;
  experience: string;
  skills: string;
  extracurriculars: string;
  anythingElse: string;
}

interface Errors {
  name?: string;
  school?: string;
  year?: string;
  whatYouStudy?: string;
}

const defaultForm: FormState = {
  path: "A",
  cvName: "",
  extra: "",
  name: "",
  school: "",
  year: "",
  whatYouStudy: "",
  coursework: "",
  experience: "",
  skills: "",
  extracurriculars: "",
  anythingElse: "",
};

const inputStyle = {
  background: "var(--bg-card)",
  borderColor: "var(--border-default)",
  color: "var(--ink)",
  outline: "none",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
};

const inputClass = "w-full px-3.5 py-3 rounded-lg border text-sm block";

// ── CV Upload Zone ──────────────────────────────────────────────────────────

function CVUploadZone({
  cvName,
  parsing,
  onUpload,
  onClear,
}: {
  cvName: string;
  parsing: boolean;
  onUpload: (file: File | null) => void;
  onClear: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => {
          onUpload(e.target.files?.[0] ?? null);
          if (fileRef.current) fileRef.current.value = "";
        }}
      />
      {!cvName ? (
        <button
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onUpload(e.dataTransfer.files?.[0] ?? null);
          }}
          className="w-full border-2 border-dashed rounded-2xl flex flex-col items-center gap-3 transition-all duration-150"
          style={{ borderColor: "var(--border-default)", padding: "3.5rem 1rem" }}
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
            <button
              onClick={() => fileRef.current?.click()}
              className="text-xs underline underline-offset-2"
              style={{ color: "var(--ink-muted)" }}
            >
              Replace
            </button>
          </div>
          <button onClick={onClear} style={{ color: "var(--ink-muted)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  );
}

// ── Form field wrapper ──────────────────────────────────────────────────────

function Field({
  label,
  optional,
  error,
  children,
}: {
  label: string;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <p className="text-xs font-medium mb-1.5" style={{ color: "var(--ink-secondary)" }}>
        {label}
        {optional && <span style={{ color: "var(--ink-muted)" }}>, optional</span>}
      </p>
      {children}
      {error && (
        <p className="text-xs mt-1" style={{ color: "#f87171" }}>
          {error}
        </p>
      )}
    </div>
  );
}

function SectionLabel({ title, first }: { title: string; first?: boolean }) {
  return (
    <p
      className={`text-xs font-semibold uppercase tracking-wider mb-4${first ? "" : " mt-8"}`}
      style={{ color: "var(--ink-muted)" }}
    >
      {title}
    </p>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(defaultForm);
  const [parsing, setParsing] = useState(false);
  const [isEditView, setIsEditView] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw);
        if (stored.profile_complete) {
          setForm({
            path: stored.path ?? "A",
            cvName: stored.cvName ?? "",
            extra: stored.extra ?? "",
            name: stored.name ?? "",
            school: stored.school ?? "",
            year: stored.year ?? "",
            whatYouStudy: stored.whatYouStudy ?? "",
            coursework: stored.coursework ?? "",
            experience: stored.experience ?? "",
            skills: stored.skills ?? "",
            extracurriculars: stored.extracurriculars ?? "",
            anythingElse: stored.anythingElse ?? "",
          });
          setIsEditView(true);
        }
      }
    } catch { /* ignore corrupt storage */ }
    setLoaded(true);
  }, []);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
    setSaved(false);
    setErrors((e) => {
      if (key in e) return { ...e, [key]: undefined };
      return e;
    });
  };

  const setPath = (p: Path) => {
    setForm((f) => ({ ...f, path: p }));
    setSaved(false);
    setErrors({});
  };

  const handleUpload = (file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return;
    set("cvName", file.name);
    setParsing(true);
    setTimeout(() => setParsing(false), 1800);
  };

  const validate = (): boolean => {
    if (form.path === "A") return true;
    const e: Errors = {};
    if (!form.name.trim()) e.name = "Required";
    if (!form.school.trim()) e.school = "Required";
    if (!form.year.trim()) e.year = "Required";
    if (!form.whatYouStudy.trim()) e.whatYouStudy = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile_complete: true, ...form }));
    if (isEditView) {
      setSaved(true);
    } else {
      router.push("/profile/complete");
    }
  };

  if (!loaded) return null;

  const cardStyle = (active: boolean) => ({
    background: active ? "rgba(31,73,89,0.05)" : "var(--bg-card)",
    borderColor: active ? "#1F4959" : "var(--border-default)",
  });

  const iconBg = (active: boolean) =>
    active ? "rgba(31,73,89,0.1)" : "var(--bg-elevated)";

  const iconColor = (active: boolean) =>
    active ? "#1F4959" : "var(--ink-muted)";

  const labelColor = (active: boolean) =>
    active ? "#1F4959" : "var(--ink)";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">

        {/* Page header — edit view only */}
        {isEditView && (
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold tracking-tight mb-2" style={{ color: "var(--ink)" }}>
              Your profile
            </h2>
            <p className="text-sm" style={{ color: "var(--ink-secondary)" }}>
              Edit and save at any time.
            </p>
          </div>
        )}

        {/* Path selection cards */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={() => setPath("A")}
            className="flex-1 flex flex-col items-start gap-3 p-4 rounded-xl border text-left transition-all duration-150"
            style={cardStyle(form.path === "A")}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: iconBg(form.path === "A") }}>
              <Upload className="w-4 h-4" style={{ color: iconColor(form.path === "A") }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: labelColor(form.path === "A") }}>
              Upload your resume
            </p>
          </button>

          <button
            onClick={() => setPath("B")}
            className="flex-1 flex flex-col items-start gap-3 p-4 rounded-xl border text-left transition-all duration-150"
            style={cardStyle(form.path === "B")}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: iconBg(form.path === "B") }}>
              <PenLine className="w-4 h-4" style={{ color: iconColor(form.path === "B") }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: labelColor(form.path === "B") }}>
              Fill it in manually
            </p>
          </button>
        </div>

        {/* ── Path A ── */}
        {form.path === "A" && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--ink-muted)" }}>CV</p>
            <div className="mb-6">
              <CVUploadZone
                cvName={form.cvName}
                parsing={parsing}
                onUpload={handleUpload}
                onClear={() => set("cvName", "")}
              />
            </div>

            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--ink-muted)" }}>Anything else?</p>
            <textarea
              value={form.extra}
              onChange={(e) => set("extra", e.target.value)}
              rows={8}
              placeholder="Anything you'd like us to know that isn't on your resume…"
              className={inputClass + " leading-relaxed resize-y"}
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--border-strong)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
            />
          </div>
        )}

        {/* ── Path B ── */}
        {form.path === "B" && (
          <div>
            <SectionLabel title="About you" first />

            <Field label="Name" error={errors.name}>
              <input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Your full name"
                className={inputClass}
                style={{ ...inputStyle, borderColor: errors.name ? "#f87171" : "var(--border-default)" }}
                onFocus={(e) => (e.target.style.borderColor = errors.name ? "#f87171" : "var(--border-strong)")}
                onBlur={(e) => (e.target.style.borderColor = errors.name ? "#f87171" : "var(--border-default)")}
              />
            </Field>

            <Field label="School" error={errors.school}>
              <input
                value={form.school}
                onChange={(e) => set("school", e.target.value)}
                placeholder="Your university or high school"
                className={inputClass}
                style={{ ...inputStyle, borderColor: errors.school ? "#f87171" : "var(--border-default)" }}
                onFocus={(e) => (e.target.style.borderColor = errors.school ? "#f87171" : "var(--border-strong)")}
                onBlur={(e) => (e.target.style.borderColor = errors.school ? "#f87171" : "var(--border-default)")}
              />
            </Field>

            <Field label="Year" error={errors.year}>
              <input
                value={form.year}
                onChange={(e) => set("year", e.target.value)}
                placeholder="e.g. College freshman, High School Junior, Postdoc, Gap year"
                className={inputClass}
                style={{ ...inputStyle, borderColor: errors.year ? "#f87171" : "var(--border-default)" }}
                onFocus={(e) => (e.target.style.borderColor = errors.year ? "#f87171" : "var(--border-strong)")}
                onBlur={(e) => (e.target.style.borderColor = errors.year ? "#f87171" : "var(--border-default)")}
              />
            </Field>

            <SectionLabel title="Your academics" />

            <Field label="What do you study?" error={errors.whatYouStudy}>
              <input
                value={form.whatYouStudy}
                onChange={(e) => set("whatYouStudy", e.target.value)}
                placeholder="Your major, intended major, or strongest subjects"
                className={inputClass}
                style={{ ...inputStyle, borderColor: errors.whatYouStudy ? "#f87171" : "var(--border-default)" }}
                onFocus={(e) => (e.target.style.borderColor = errors.whatYouStudy ? "#f87171" : "var(--border-strong)")}
                onBlur={(e) => (e.target.style.borderColor = errors.whatYouStudy ? "#f87171" : "var(--border-default)")}
              />
            </Field>

            <Field label="Relevant coursework">
              <input
                value={form.coursework}
                onChange={(e) => set("coursework", e.target.value)}
                placeholder="e.g. Intro to Cognitive Psychology, Linear Algebra"
                className={inputClass}
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "var(--border-strong)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
              />
            </Field>

            <SectionLabel title="Your experience" />

            <Field label="Research, lab, or project experience">
              <textarea
                value={form.experience}
                onChange={(e) => set("experience", e.target.value)}
                rows={4}
                placeholder="Describe anything relevant: formal research, a class project, independent reading, science fair, internship. Nothing is too small."
                className={inputClass + " leading-relaxed resize-y"}
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "var(--border-strong)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
              />
            </Field>

            <Field label="Skills">
              <textarea
                value={form.skills}
                onChange={(e) => set("skills", e.target.value)}
                rows={3}
                placeholder="Anything applicable to research, programming languages, lab techniques, foreign languages, tools, methods, software"
                className={inputClass + " leading-relaxed resize-y"}
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "var(--border-strong)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
              />
            </Field>

            <Field label="Extracurriculars and activities">
              <textarea
                value={form.extracurriculars}
                onChange={(e) => set("extracurriculars", e.target.value)}
                rows={3}
                placeholder="Clubs, leadership roles, competitions, publications, awards, anything that shows who you are"
                className={inputClass + " leading-relaxed resize-y"}
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "var(--border-strong)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
              />
            </Field>

            <SectionLabel title="Anything else?" />

            <Field label="Is there anything you'd like researchers to know?" optional>
              <textarea
                value={form.anythingElse}
                onChange={(e) => set("anythingElse", e.target.value)}
                rows={3}
                placeholder="A personal connection to the field, an unusual background, something you are proud of"
                className={inputClass + " leading-relaxed resize-y"}
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "var(--border-strong)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
              />
            </Field>
          </div>
        )}

        {/* Save button */}
        <div className="mt-8">
          <button
            onClick={handleSave}
            disabled={parsing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "#1F4959", color: "#fff", boxShadow: "0 0 16px rgba(31,73,89,0.4)" }}
          >
            {saved ? (
              <><Check className="w-4 h-4" strokeWidth={2.5} /> Saved</>
            ) : isEditView ? (
              "Save changes"
            ) : (
              "Save & continue →"
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
