"use client";

import { useEffect, useState } from "react";
import { X, Check, RefreshCw } from "lucide-react";
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

  const [watchExpiration, setWatchExpiration] = useState<number | null | undefined>(undefined);
  const [renewingWatch, setRenewingWatch] = useState(false);
  const [watchRenewed, setWatchRenewed] = useState(false);
  const [watchError, setWatchError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: userData }, { data: watchData }] = await Promise.all([
        supabase.from("users").select("name, email").eq("id", user.id).single(),
        supabase.from("gmail_watch").select("expiration").eq("user_id", user.id).single(),
      ]);

      const resolvedName = userData?.name ?? user.user_metadata?.full_name ?? "";
      const resolvedEmail = userData?.email ?? user.email ?? "";
      setName(resolvedName);
      setOriginalName(resolvedName);
      setEmail(resolvedEmail);
      setWatchExpiration(watchData?.expiration ?? null);
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

  async function handleRenewWatch() {
    if (renewingWatch) return;
    setRenewingWatch(true);
    setWatchError(null);
    setWatchRenewed(false);
    try {
      const res = await fetch("/api/gmail/watch", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Renewal failed");
      setWatchExpiration(json.expiration ?? null);
      setWatchRenewed(true);
      setTimeout(() => setWatchRenewed(false), 3000);
    } catch (err) {
      setWatchError(err instanceof Error ? err.message : "Renewal failed");
    } finally {
      setRenewingWatch(false);
    }
  }

  function watchStatusLabel(): { text: string; color: string } {
    if (watchExpiration === undefined) return { text: "Loading...", color: "var(--ink-muted)" };
    if (watchExpiration === null) return { text: "Not registered", color: "#ef4444" };
    const expiresIn = watchExpiration - Date.now();
    if (expiresIn <= 0) return { text: "Expired", color: "#ef4444" };
    const days = Math.floor(expiresIn / 86_400_000);
    const hours = Math.floor((expiresIn % 86_400_000) / 3_600_000);
    const label = days > 0 ? `Active, expires in ${days}d ${hours}h` : `Active, expires in ${hours}h`;
    return { text: label, color: "#678E8D" };
  }

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
            className="text-xs font-semibold uppercase tracking-widest mb-4"
            style={{ color: "var(--accent)", letterSpacing: "0.08em" }}
          >
            Connections
          </p>

          {/* Gmail watch */}
          <div
            className="flex items-center justify-between gap-4 rounded-xl px-4 py-3.5 border mb-6"
            style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}
          >
            <div className="min-w-0">
              <p className="text-xs font-medium mb-0.5" style={{ color: "var(--ink)" }}>
                Gmail reply detection
              </p>
              {(() => {
                const { text, color } = watchStatusLabel();
                return (
                  <p className="text-xs" style={{ color }}>
                    {text}
                  </p>
                );
              })()}
              {watchError && (
                <p className="text-xs mt-1" style={{ color: "#ef4444" }}>{watchError}</p>
              )}
            </div>
            <button
              onClick={handleRenewWatch}
              disabled={renewingWatch}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: watchRenewed ? "rgba(103,142,141,0.1)" : "var(--bg-card)",
                borderColor: watchRenewed ? "#678E8D" : "var(--border-default)",
                color: watchRenewed ? "#678E8D" : "var(--ink-secondary)",
              }}
              onMouseEnter={(e) => {
                if (!renewingWatch && !watchRenewed) {
                  e.currentTarget.style.borderColor = "var(--border-strong)";
                  e.currentTarget.style.color = "var(--ink)";
                }
              }}
              onMouseLeave={(e) => {
                if (!watchRenewed) {
                  e.currentTarget.style.borderColor = "var(--border-default)";
                  e.currentTarget.style.color = "var(--ink-secondary)";
                }
              }}
            >
              {renewingWatch ? (
                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : watchRenewed ? (
                <Check className="w-3 h-3" strokeWidth={2.5} />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              {watchRenewed ? "Renewed" : "Renew"}
            </button>
          </div>

          {/* Account section label */}
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
