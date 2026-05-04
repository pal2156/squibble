"use client";

import { useState } from "react";
import { student } from "@/lib/mock-data";
import { Upload, Save, Check, FileText, Plus, X } from "lucide-react";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--ink-muted)", letterSpacing: "0.08em" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  background: "var(--bg-card)",
  borderColor: "var(--border-default)",
  color: "var(--ink)",
  outline: "none",
};

export default function ProfilePage() {
  const [saved, setSaved] = useState(false);
  const [cvUploaded, setCvUploaded] = useState(true);
  const [name, setName] = useState(student.name.replace(".", ""));
  const [university, setUniversity] = useState(student.university);
  const [year, setYear] = useState(student.year);
  const [gpa, setGpa] = useState(student.gpa);
  const [fields, setFields] = useState(student.fields.join(", "));
  const [subfield, setSubfield] = useState(student.subfield);
  const [coursework, setCoursework] = useState(student.coursework);
  const [newCourse, setNewCourse] = useState("");
  const [experience, setExperience] = useState(student.experience);
  const [availability, setAvailability] = useState(student.availability);
  const [preference, setPreference] = useState(student.preference);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const addCourse = () => {
    if (newCourse.trim()) {
      setCoursework([...coursework, newCourse.trim()]);
      setNewCourse("");
    }
  };

  const removeCourse = (i: number) => {
    setCoursework(coursework.filter((_, idx) => idx !== i));
  };

  return (
    <div className="px-10 py-10 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-1.5" style={{ color: "var(--ink)" }}>
          Profile
        </h1>
        <p className="text-sm" style={{ color: "var(--ink-secondary)" }}>
          This is what Claude uses to personalize your emails. Keep it accurate.
        </p>
      </div>

      <div className="space-y-7">
        {/* Basic info */}
        <div
          className="rounded-2xl border p-6 space-y-5"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
        >
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--ink-muted)" }}>
            Basic Info
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Full Name">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border text-sm transition-colors"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "var(--border-strong)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
              />
            </Field>
            <Field label="University">
              <input
                type="text"
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border text-sm transition-colors"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "var(--border-strong)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
              />
            </Field>
            <Field label="Year">
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border text-sm appearance-none cursor-pointer"
                style={inputStyle}
              >
                {["Freshman", "Sophomore", "Junior", "Senior", "Graduate"].map((y) => (
                  <option key={y} value={y} style={{ background: "var(--bg-elevated)" }}>{y}</option>
                ))}
              </select>
            </Field>
            <Field label="GPA">
              <input
                type="text"
                value={gpa}
                onChange={(e) => setGpa(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border text-sm"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "var(--border-strong)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
              />
            </Field>
          </div>
        </div>

        {/* Academic focus */}
        <div
          className="rounded-2xl border p-6 space-y-5"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
        >
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--ink-muted)" }}>
            Academic Focus
          </h2>

          <Field label="Field(s) of Interest">
            <input
              type="text"
              value={fields}
              onChange={(e) => setFields(e.target.value)}
              placeholder="e.g. Physics, Mathematics"
              className="w-full px-3.5 py-2.5 rounded-xl border text-sm"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--border-strong)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
            />
          </Field>

          <Field label="Subfield / Research Interest">
            <input
              type="text"
              value={subfield}
              onChange={(e) => setSubfield(e.target.value)}
              placeholder="e.g. Condensed Matter, Quantum Computing"
              className="w-full px-3.5 py-2.5 rounded-xl border text-sm"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--border-strong)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
            />
          </Field>

          <Field label="Relevant Coursework">
            <div className="flex flex-wrap gap-2 mb-2.5">
              {coursework.map((course, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full"
                  style={{ background: "var(--bg-elevated)", color: "var(--ink-secondary)", border: "1px solid var(--border-default)" }}
                >
                  {course}
                  <button onClick={() => removeCourse(i)} style={{ color: "var(--ink-muted)" }}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCourse}
                onChange={(e) => setNewCourse(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCourse()}
                placeholder="Add a course..."
                className="flex-1 px-3.5 py-2 rounded-xl border text-sm"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "var(--border-strong)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
              />
              <button
                onClick={addCourse}
                className="px-3 py-2 rounded-xl border text-sm transition-colors"
                style={{ background: "var(--bg-elevated)", borderColor: "var(--border-default)", color: "var(--ink-secondary)" }}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </Field>
        </div>

        {/* Background */}
        <div
          className="rounded-2xl border p-6 space-y-5"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
        >
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--ink-muted)" }}>
            Background & Availability
          </h2>

          <Field label="Research Experience">
            <textarea
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              rows={4}
              placeholder="Describe any relevant research, lab, or project experience..."
              className="w-full px-3.5 py-3 rounded-xl border text-sm leading-relaxed resize-none"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--border-strong)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Availability">
              <input
                type="text"
                value={availability}
                onChange={(e) => setAvailability(e.target.value)}
                placeholder="e.g. Summer 2025, starting mid-May"
                className="w-full px-3.5 py-2.5 rounded-xl border text-sm"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "var(--border-strong)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
              />
            </Field>
            <Field label="Location Preference">
              <select
                value={preference}
                onChange={(e) => setPreference(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border text-sm appearance-none cursor-pointer"
                style={inputStyle}
              >
                {["In-person", "Remote", "In-person or hybrid", "No preference"].map((p) => (
                  <option key={p} value={p} style={{ background: "var(--bg-elevated)" }}>{p}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        {/* CV Upload */}
        <div
          className="rounded-2xl border p-6"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
        >
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--ink-muted)" }}>
            Curriculum Vitae
          </h2>
          {cvUploaded ? (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl border"
              style={{ background: "rgba(52,211,153,0.04)", borderColor: "rgba(52,211,153,0.15)" }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(52,211,153,0.12)" }}
              >
                <FileText className="w-4 h-4" style={{ color: "#34d399" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>Paul_Lacarriere_CV.pdf</p>
                <p className="text-xs" style={{ color: "var(--ink-muted)" }}>Uploaded Apr 8, 2025 · 184 KB</p>
              </div>
              <button
                onClick={() => setCvUploaded(false)}
                className="text-xs font-medium transition-colors"
                style={{ color: "var(--ink-muted)" }}
              >
                Replace
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCvUploaded(true)}
              className="w-full border-2 border-dashed rounded-xl py-8 flex flex-col items-center gap-2 transition-all duration-150 group"
              style={{ borderColor: "var(--border-default)" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-strong)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")}
            >
              <Upload className="w-6 h-6" style={{ color: "var(--ink-muted)" }} />
              <div className="text-center">
                <p className="text-sm font-medium" style={{ color: "var(--ink-secondary)" }}>
                  Click to upload CV
                </p>
                <p className="text-xs" style={{ color: "var(--ink-muted)" }}>PDF up to 5MB</p>
              </div>
            </button>
          )}
        </div>

        {/* Save */}
        <div className="flex justify-end pb-4">
          <button
            onClick={handleSave}
            className="flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
            style={
              saved
                ? {
                    background: "rgba(52,211,153,0.1)",
                    color: "#34d399",
                    border: "1px solid rgba(52,211,153,0.2)",
                  }
                : {
                    background: "var(--accent)",
                    color: "#fff",
                    boxShadow: "0 0 20px rgba(124,111,247,0.25)",
                  }
            }
          >
            {saved ? (
              <>
                <Check className="w-4 h-4" strokeWidth={2.5} />
                Saved
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Profile
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
