"use client";

import { useEffect, useState } from "react";
import { X, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const inputClass = "w-full px-3.5 py-2.5 rounded-lg border text-sm block transition-colors";
const inputStyle = {
  background: "var(--bg-card)",
  borderColor: "var(--border-default)",
  color: "var(--ink)",
  outline: "none",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
};

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const supabase = createClient();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("users")
        .select("name, email")
        .eq("id", user.id)
        .single();

      const resolvedName = data?.name ?? user.user_metadata?.full_name ?? "";
      const resolvedEmail = data?.email ?? user.email ?? "";
      setName(resolvedName);
      setOriginalName(resolvedName);
      setEmail(resolvedEmail);
      setLoaded(true);
    }
    load();
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function handleSaveName() {
    if (!name.trim() || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("users")
        .update({ name: name.trim() })
        .eq("id", user.id);
      if (error) throw error;
      setOriginalName(name.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const nameChanged = name.trim() !== originalName;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ background: "rgba(35, 44, 51, 0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl animate-scale-in"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "0 24px 64px rgba(35,44,51,0.35), 0 4px 16px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5 border-b"
          style={{ borderColor: "var(--border-default)" }}
        >
          <h2
            className="text-base font-semibold"
            style={{ color: "var(--ink)", letterSpacing: "-0.02em" }}
          >
            Settings
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: "var(--ink-muted)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-elevated)";
              e.currentTarget.style.color = "var(--ink)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--ink-muted)";
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          {/* Section label */}
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-5"
            style={{ color: "var(--accent)", letterSpacing: "0.08em" }}
          >
            Account
          </p>

          {!loaded ? (
            <div className="space-y-4 animate-pulse">
              <div>
                <div className="h-3 w-10 rounded mb-2" style={{ background: "var(--bg-elevated)" }} />
                <div className="h-10 rounded-lg" style={{ background: "var(--bg-elevated)" }} />
              </div>
              <div>
                <div className="h-3 w-10 rounded mb-2" style={{ background: "var(--bg-elevated)" }} />
                <div className="h-10 rounded-lg" style={{ background: "var(--bg-elevated)" }} />
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--ink-secondary)" }}>
                  Name
                </label>
                <div className="flex gap-2">
                  <input
                    value={name}
                    onChange={(e) => { setName(e.target.value); setSaved(false); setSaveError(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter" && nameChanged) handleSaveName(); }}
                    className={inputClass}
                    style={inputStyle}
                    onFocus={(e) => (e.target.style.borderColor = "var(--border-strong)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
                    placeholder="Your name"
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={!nameChanged || saving}
                    className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: "var(--accent)", color: "#FFFFFF" }}
                    onMouseEnter={(e) => { if (nameChanged && !saving) e.currentTarget.style.background = "var(--accent-hover)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "var(--accent)"; }}
                  >
                    {saving ? (
                      <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : saved ? (
                      <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                    ) : null}
                    {saved ? "Saved" : "Save"}
                  </button>
                </div>
                {saveError && (
                  <p className="text-xs mt-1.5" style={{ color: "#ef4444" }}>{saveError}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--ink-secondary)" }}>
                  Email
                </label>
                <div
                  className="w-full px-3.5 py-2.5 rounded-lg border text-sm"
                  style={{
                    background: "var(--bg-elevated)",
                    borderColor: "var(--border-default)",
                    color: "var(--ink-secondary)",
                  }}
                >
                  {email}
                </div>
                <p className="text-xs mt-1.5" style={{ color: "var(--ink-muted)" }}>
                  Linked to your Google account and cannot be changed here.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
