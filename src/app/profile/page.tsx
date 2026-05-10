"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, PenLine, Check, X } from "lucide-react";

type Path = "A" | "B";

interface FormState {
  path: Path;
  cvName: string;
  cvText: string;
  cvParsed: boolean;
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
  cvText: "",
  cvParsed: false,
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

// ── Shared profile fields (shown for Path B, and for Path A after parsing) ──

function ProfileFields({
  form,
  errors,
  set,
}: {
  form: FormState;
  errors: Errors;
  set: <K extends keyof FormState>(key: K, val: FormState[K]) => void;
}) {
  return (
    <>
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
          placeholder="Your university or institution"
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
          placeholder="e.g. Freshman, Junior, Graduate student"
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
          placeholder="Your major or strongest subjects"
          className={inputClass}
          style={{ ...inputStyle, borderColor: errors.whatYouStudy ? "#f87171" : "var(--border-default)" }}
          onFocus={(e) => (e.target.style.borderColor = errors.whatYouStudy ? "#f87171" : "var(--border-strong)")}
          onBlur={(e) => (e.target.style.borderColor = errors.whatYouStudy ? "#f87171" : "var(--border-default)")}
        />
      </Field>

      <Field label="Relevant coursework" optional>
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

      <Field label="Research, lab, or project experience" optional>
        <textarea
          value={form.experience}
          onChange={(e) => set("experience", e.target.value)}
          rows={4}
          placeholder="Formal research, class projects, independent reading, internships. Nothing is too small."
          className={inputClass + " leading-relaxed resize-y"}
          style={inputStyle}
          onFocus={(e) => (e.target.style.borderColor = "var(--border-strong)")}
          onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
        />
      </Field>

      <Field label="Skills" optional>
        <textarea
          value={form.skills}
          onChange={(e) => set("skills", e.target.value)}
          rows={3}
          placeholder="Programming languages, lab techniques, tools, foreign languages, methods"
          className={inputClass + " leading-relaxed resize-y"}
          style={inputStyle}
          onFocus={(e) => (e.target.style.borderColor = "var(--border-strong)")}
          onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
        />
      </Field>

      <Field label="Extracurriculars and activities" optional>
        <textarea
          value={form.extracurriculars}
          onChange={(e) => set("extracurriculars", e.target.value)}
          rows={3}
          placeholder="Clubs, leadership, competitions, publications, awards"
          className={inputClass + " leading-relaxed resize-y"}
          style={inputStyle}
          onFocus={(e) => (e.target.style.borderColor = "var(--border-strong)")}
          onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
        />
      </Field>

      <SectionLabel title="Anything else?" />

      <Field label="Anything you'd like researchers to know" optional>
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
    </>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(defaultForm);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isEditView, setIsEditView] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});

  // Load profile from Supabase on mount
  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then(({ profile }) => {
        if (profile) {
          setForm({
            path: profile.cv_text ? "A" : "B",
            cvName: profile.cv_text ? "Uploaded resume" : "",
            cvText: profile.cv_text ?? "",
            cvParsed: !!profile.cv_text,
            name: profile.name ?? "",
            school: profile.school ?? "",
            year: profile.year ?? "",
            whatYouStudy: profile.major ?? "",
            coursework: profile.coursework ?? "",
            experience: profile.experience ?? "",
            skills: profile.skills ?? "",
            extracurriculars: profile.extracurriculars ?? "",
            anythingElse: profile.anything_else ?? "",
          });
          setIsEditView(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
    setSaved(false);
    setSaveError(null);
    setErrors((e) => {
      if (key in e) return { ...e, [key]: undefined };
      return e;
    });
  };

  const setPath = (p: Path) => {
    setForm((f) => ({ ...f, path: p, cvParsed: false, cvName: "", cvText: "" }));
    setSaved(false);
    setErrors({});
    setParseError(null);
  };

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setParseError("File must be under 5MB.");
      return;
    }
    setParseError(null);
    set("cvName", file.name);
    setParsing(true);

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/profile/parse-cv", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Parse failed");

      const { fields, cvText } = data;
      setForm((f) => ({
        ...f,
        cvText,
        cvParsed: true,
        name: fields.name ?? f.name,
        school: fields.school ?? f.school,
        year: fields.year ?? f.year,
        whatYouStudy: fields.major ?? f.whatYouStudy,
        coursework: fields.coursework ?? f.coursework,
        experience: fields.experience ?? f.experience,
        skills: fields.skills ?? f.skills,
        extracurriculars: fields.extracurriculars ?? f.extracurriculars,
        anythingElse: fields.anything_else ?? f.anythingElse,
      }));
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Could not read CV.");
      set("cvName", "");
    } finally {
      setParsing(false);
    }
  };

  const validate = (): boolean => {
    const e: Errors = {};
    if (!form.name.trim()) e.name = "Required";
    if (!form.school.trim()) e.school = "Required";
    if (!form.year.trim()) e.year = "Required";
    if (!form.whatYouStudy.trim()) e.whatYouStudy = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    // For Path A: require CV uploaded; for Path B: require core fields
    if (form.path === "A" && !form.cvParsed) return;
    if (!validate()) return;

    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          school: form.school,
          year: form.year,
          major: form.whatYouStudy,
          coursework: form.coursework,
          experience: form.experience,
          skills: form.skills,
          extracurriculars: form.extracurriculars,
          anything_else: form.anythingElse,
          cv_text: form.cvText || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");

      if (isEditView) {
        setSaved(true);
      } else {
        router.push("/profile/complete");
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  const cardStyle = (active: boolean) => ({
    background: active ? "rgba(31,73,89,0.05)" : "var(--bg-card)",
    borderColor: active ? "#1F4959" : "var(--border-default)",
  });
  const iconBg = (active: boolean) => active ? "rgba(31,73,89,0.1)" : "var(--bg-elevated)";
  const iconColor = (active: boolean) => active ? "#1F4959" : "var(--ink-muted)";
  const labelColor = (active: boolean) => active ? "#1F4959" : "var(--ink)";

  // For Path A, show form fields only after CV has been parsed
  const showFields = form.path === "B" || form.cvParsed;

  // Save button is disabled while uploading, parsing, or saving
  const saveDisabled = parsing || saving || (form.path === "A" && !form.cvParsed);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">

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

        {/* Path A: upload zone */}
        {form.path === "A" && (
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--ink-muted)" }}>Resume</p>
            <CVUploadZone
              cvName={form.cvName}
              parsing={parsing}
              onUpload={handleUpload}
              onClear={() => setForm((f) => ({ ...f, cvName: "", cvText: "", cvParsed: false }))}
            />
            {parseError && (
              <p className="text-xs mt-2" style={{ color: "#f87171" }}>{parseError}</p>
            )}
            {form.cvParsed && (
              <p className="text-xs mt-2" style={{ color: "#34d399" }}>
                Fields extracted. Review and edit below before saving.
              </p>
            )}
          </div>
        )}

        {/* Shared form fields: shown for Path B always, Path A after parsing */}
        {showFields && (
          <ProfileFields form={form} errors={errors} set={set} />
        )}

        {/* Save button */}
        <div className="mt-8">
          {saveError && (
            <p className="text-xs mb-3" style={{ color: "#f87171" }}>{saveError}</p>
          )}
          <button
            onClick={handleSave}
            disabled={saveDisabled}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "#1F4959", color: "#fff", boxShadow: "0 0 16px rgba(31,73,89,0.4)" }}
          >
            {saving ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving…
              </>
            ) : saved ? (
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
