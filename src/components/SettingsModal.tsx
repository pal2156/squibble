"use client";

import { useEffect, useState } from "react";
import { X, Check, RefreshCw } from "lucide-react";

interface SettingsModalProps {
  onClose: () => void;
}

type Config = {
  aiProvider: string | null;
  fromName: string | null;
  fromEmail: string | null;
  smtpHost: string | null;
  imapHost: string | null;
  imapConfigured: boolean;
};

const PROVIDER_LABEL: Record<string, string> = { claude: "Claude", openai: "OpenAI", gemini: "Gemini" };

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const [config, setConfig] = useState<Config | null>(null);

  const [polling, setPolling] = useState(false);
  const [pollResult, setPollResult] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/config").then((r) => r.json()).then(setConfig).catch(() => {});
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

  async function handleCheckReplies() {
    if (polling) return;
    setPolling(true);
    setPollError(null);
    setPollResult(null);
    try {
      const res = await fetch("/api/mailer/poll", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Check failed");
      setPollResult(json.found > 0 ? `Found ${json.found} new repl${json.found === 1 ? "y" : "ies"}` : "No new replies");
      setTimeout(() => setPollResult(null), 4000);
    } catch (err) {
      setPollError(err instanceof Error ? err.message : "Check failed");
    } finally {
      setPolling(false);
    }
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
          <h2 className="text-base font-semibold" style={{ color: "var(--ink)", letterSpacing: "-0.02em" }}>
            Settings
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: "var(--ink-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-elevated)"; e.currentTarget.style.color = "var(--ink)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--ink-muted)"; }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--accent)", letterSpacing: "0.08em" }}>
            Reply detection
          </p>

          <div
            className="flex items-center justify-between gap-4 rounded-xl px-4 py-3.5 border mb-6"
            style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}
          >
            <div className="min-w-0">
              <p className="text-xs font-medium mb-0.5" style={{ color: "var(--ink)" }}>IMAP polling</p>
              <p className="text-xs" style={{ color: config?.imapConfigured ? "#678E8D" : "#ef4444" }}>
                {config === null ? "Loading..." : config.imapConfigured ? "Configured — checks automatically in the background" : "Not configured"}
              </p>
              {pollResult && <p className="text-xs mt-1" style={{ color: "#678E8D" }}>{pollResult}</p>}
              {pollError && <p className="text-xs mt-1" style={{ color: "#ef4444" }}>{pollError}</p>}
            </div>
            <button
              onClick={handleCheckReplies}
              disabled={polling || !config?.imapConfigured}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "var(--bg-card)", borderColor: "var(--border-default)", color: "var(--ink-secondary)" }}
              onMouseEnter={(e) => { if (!polling) { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--ink)"; } }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; e.currentTarget.style.color = "var(--ink-secondary)"; }}
            >
              {polling ? (
                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : pollResult ? (
                <Check className="w-3 h-3" strokeWidth={2.5} />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              Check now
            </button>
          </div>

          <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--accent)", letterSpacing: "0.08em" }}>
            Configuration
          </p>

          {config === null ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-10 rounded-lg" style={{ background: "var(--bg-elevated)" }} />
              <div className="h-10 rounded-lg" style={{ background: "var(--bg-elevated)" }} />
            </div>
          ) : (
            <div className="space-y-3">
              <ConfigRow label="AI provider" value={config.aiProvider ? PROVIDER_LABEL[config.aiProvider] ?? config.aiProvider : "Not set"} />
              <ConfigRow label="Sending as" value={config.fromEmail ?? "Not set"} />
              <ConfigRow label="SMTP host" value={config.smtpHost ?? "Not set"} />
              <ConfigRow label="IMAP host" value={config.imapHost ?? "Not set"} />
            </div>
          )}

          <p className="text-xs mt-4" style={{ color: "var(--ink-muted)" }}>
            To change these, edit <code>.env.local</code> in the project folder and restart the server — secrets never
            round-trip through this UI once they&apos;re set.
          </p>
        </div>
      </div>
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg px-3.5 py-2.5 border text-sm" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-default)" }}>
      <span style={{ color: "var(--ink-secondary)" }}>{label}</span>
      <span style={{ color: "var(--ink)", fontWeight: 500 }}>{value}</span>
    </div>
  );
}
