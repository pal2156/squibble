"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ProviderKey = "claude" | "openai" | "gemini";

const PROVIDERS: Array<{ key: ProviderKey; name: string; note: string; color: string; letter: string; keyLink: string; keyLinkLabel: string }> = [
  { key: "claude", name: "Claude", note: "Anthropic", color: "#D97757", letter: "C", keyLink: "https://console.anthropic.com/settings/keys", keyLinkLabel: "Get one from Claude's console" },
  { key: "openai", name: "OpenAI", note: "GPT", color: "#10A37F", letter: "O", keyLink: "https://platform.openai.com/api-keys", keyLinkLabel: "Get one from the OpenAI platform" },
  { key: "gemini", name: "Gemini", note: "Free tier", color: "#4285F4", letter: "G", keyLink: "https://aistudio.google.com/apikey", keyLinkLabel: "Get a free key from Google AI Studio" },
];

const EMAIL_PRESETS: Record<string, { smtpHost: string; smtpPort: number; imapHost: string; imapPort: number; docs: string }> = {
  gmail: { smtpHost: "smtp.gmail.com", smtpPort: 587, imapHost: "imap.gmail.com", imapPort: 993, docs: "https://support.google.com/mail/answer/185833" },
  outlook: { smtpHost: "smtp.office365.com", smtpPort: 587, imapHost: "outlook.office365.com", imapPort: 993, docs: "https://support.microsoft.com/en-us/account-billing/using-app-passwords-with-apps-that-don-t-support-two-step-verification-5896ed9b-4263-e681-128a-a6f2979a7944" },
  yahoo: { smtpHost: "smtp.mail.yahoo.com", smtpPort: 587, imapHost: "imap.mail.yahoo.com", imapPort: 993, docs: "https://help.yahoo.com/kb/SLN15241.html" },
  custom: { smtpHost: "", smtpPort: 587, imapHost: "", imapPort: 993, docs: "" },
};

type CheckState = "idle" | "checking" | "ok" | "error";

const STEP_LABELS = ["Welcome", "AI provider", "Email", "Finish"];

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [provider, setProvider] = useState<ProviderKey>("claude");
  const [apiKey, setApiKey] = useState("");
  const [aiCheck, setAiCheck] = useState<CheckState>("idle");
  const [aiError, setAiError] = useState<string | null>(null);

  const [emailPreset, setEmailPreset] = useState<keyof typeof EMAIL_PRESETS>("gmail");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [smtpHost, setSmtpHost] = useState(EMAIL_PRESETS.gmail.smtpHost);
  const [smtpPort, setSmtpPort] = useState(EMAIL_PRESETS.gmail.smtpPort);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [imapHost, setImapHost] = useState(EMAIL_PRESETS.gmail.imapHost);
  const [imapPort, setImapPort] = useState(EMAIL_PRESETS.gmail.imapPort);
  const [imapUser, setImapUser] = useState("");
  const [imapPass, setImapPass] = useState("");
  const [emailCheck, setEmailCheck] = useState<{ smtp: CheckState; imap: CheckState }>({ smtp: "idle", imap: "idle" });
  const [emailCheckError, setEmailCheckError] = useState<string | null>(null);

  const selectedProvider = PROVIDERS.find((p) => p.key === provider)!;

  function applyPreset(key: keyof typeof EMAIL_PRESETS) {
    setEmailPreset(key);
    const preset = EMAIL_PRESETS[key];
    setSmtpHost(preset.smtpHost);
    setSmtpPort(preset.smtpPort);
    setImapHost(preset.imapHost);
    setImapPort(preset.imapPort);
  }

  async function testAiKey() {
    setAiCheck("checking");
    setAiError(null);
    try {
      const res = await fetch("/api/setup/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiProvider: provider, apiKey }),
      });
      const json = await res.json();
      if (json.ai?.ok) setAiCheck("ok");
      else { setAiCheck("error"); setAiError(json.ai?.error ?? "Could not verify this key"); }
    } catch (err) {
      setAiCheck("error");
      setAiError(err instanceof Error ? err.message : "Could not verify this key");
    }
  }

  async function testEmail() {
    setEmailCheck({ smtp: "checking", imap: "checking" });
    setEmailCheckError(null);
    try {
      const res = await fetch("/api/setup/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smtpHost, smtpPort, smtpUser, smtpPass, imapHost, imapPort, imapUser, imapPass }),
      });
      const json = await res.json();
      setEmailCheck({
        smtp: json.smtp?.ok ? "ok" : "error",
        imap: json.imap?.ok ? "ok" : "error",
      });
      const errs = [json.smtp?.error, json.imap?.error].filter(Boolean);
      if (errs.length > 0) setEmailCheckError(errs.join(" · "));
    } catch (err) {
      setEmailCheck({ smtp: "error", imap: "error" });
      setEmailCheckError(err instanceof Error ? err.message : "Could not verify these credentials");
    }
  }

  async function finishSetup() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiProvider: provider, apiKey,
          smtpHost, smtpPort, smtpUser, smtpPass,
          imapHost, imapPort, imapUser, imapPass,
          fromName, fromEmail,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Setup failed");
      router.push("/dashboard");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setSubmitting(false);
    }
  }

  const canContinueStep1 = apiKey.trim().length > 0;
  const canContinueStep2 = smtpHost && smtpUser && smtpPass && imapHost && imapUser && imapPass && fromEmail;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-base)",
        color: "var(--ink)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 32 }}>
        <img src="/logo.png" alt="" style={{ width: 28, height: 28 }} />
        <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.05em" }}>Squibble</span>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: 560,
          background: "var(--bg-card)",
          border: "1px solid var(--border-default)",
          borderRadius: 20,
          boxShadow: "0 2px 20px rgba(35,44,51,0.06)",
          padding: "40px 44px 36px",
        }}
      >
        <Stepper current={step} />

        {step === 0 && <WelcomeStep onNext={() => setStep(1)} />}

        {step === 1 && (
          <AiProviderStep
            provider={provider}
            setProvider={(p) => { setProvider(p); setAiCheck("idle"); }}
            apiKey={apiKey}
            setApiKey={(v) => { setApiKey(v); setAiCheck("idle"); }}
            selectedProvider={selectedProvider}
            aiCheck={aiCheck}
            aiError={aiError}
            onTest={testAiKey}
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
            canContinue={canContinueStep1}
          />
        )}

        {step === 2 && (
          <EmailStep
            emailPreset={emailPreset} applyPreset={applyPreset}
            fromName={fromName} setFromName={setFromName}
            fromEmail={fromEmail} setFromEmail={setFromEmail}
            smtpHost={smtpHost} setSmtpHost={setSmtpHost}
            smtpPort={smtpPort} setSmtpPort={setSmtpPort}
            smtpUser={smtpUser} setSmtpUser={setSmtpUser}
            smtpPass={smtpPass} setSmtpPass={setSmtpPass}
            imapHost={imapHost} setImapHost={setImapHost}
            imapPort={imapPort} setImapPort={setImapPort}
            imapUser={imapUser} setImapUser={setImapUser}
            imapPass={imapPass} setImapPass={setImapPass}
            emailCheck={emailCheck} emailCheckError={emailCheckError} onTest={testEmail}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
            canContinue={!!canContinueStep2}
          />
        )}

        {step === 3 && (
          <ReviewStep
            provider={selectedProvider}
            fromEmail={fromEmail}
            smtpHost={smtpHost}
            imapHost={imapHost}
            submitting={submitting}
            submitError={submitError}
            onBack={() => setStep(2)}
            onFinish={finishSetup}
          />
        )}
      </div>
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 32 }}>
      {STEP_LABELS.map((_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", flex: i < STEP_LABELS.length - 1 ? 1 : undefined }}>
          <div
            style={{
              width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, flexShrink: 0,
              background: i < current ? "var(--accent)" : i === current ? "var(--accent-muted)" : "var(--bg-base)",
              color: i < current ? "#fff" : i === current ? "var(--accent)" : "var(--ink-muted)",
              border: i === current ? "2px solid var(--accent)" : i > current ? "1px solid var(--border-default)" : "none",
            }}
          >
            {i < current ? "✓" : i + 1}
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div style={{ flex: 1, height: 2, margin: "0 10px", background: i < current ? "var(--accent)" : "var(--border-default)" }} />
          )}
        </div>
      ))}
    </div>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border-default)",
    fontSize: 13.5, color: "var(--ink)", background: "var(--bg-card)", boxShadow: "0 1px 2px rgba(0,0,0,0.04)", outline: "none",
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--ink-secondary)", marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, background: "var(--accent-muted)", border: "1px solid rgba(103,142,141,0.3)", borderRadius: 10, padding: "12px 14px", marginBottom: 20 }}>
      <div style={{ width: 18, height: 18, flexShrink: 0, marginTop: 1, borderRadius: "50%", background: "var(--accent)", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>i</div>
      <p style={{ fontSize: 12.5, color: "var(--ink-secondary)", margin: 0, lineHeight: 1.5 }}>{children}</p>
    </div>
  );
}

function Actions({ onBack, onNext, nextLabel = "Continue →", canContinue = true, extra }: {
  onBack?: () => void; onNext: () => void; nextLabel?: string; canContinue?: boolean; extra?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 28 }}>
      {onBack ? (
        <button onClick={onBack} style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-secondary)", background: "none", border: "none", cursor: "pointer" }}>
          ← Back
        </button>
      ) : <span />}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {extra}
        <button
          onClick={onNext}
          disabled={!canContinue}
          style={{
            display: "flex", alignItems: "center", gap: 8, padding: "11px 22px", borderRadius: 10,
            background: canContinue ? "var(--accent)" : "var(--border-default)", color: "#fff", fontSize: 13.5, fontWeight: 600, border: "none",
            cursor: canContinue ? "pointer" : "not-allowed",
          }}
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}

function CheckBadge({ state }: { state: CheckState }) {
  if (state === "idle") return null;
  if (state === "checking") return <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>Checking…</span>;
  if (state === "ok") return <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>✓ Connected</span>;
  return <span style={{ fontSize: 12, color: "#B4483C", fontWeight: 600 }}>✕ Failed</span>;
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <>
      <h1 style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.03em", margin: "0 0 6px" }}>Welcome to Squibble</h1>
      <p style={{ fontSize: 13.5, color: "var(--ink-secondary)", margin: "0 0 28px", lineHeight: 1.5 }}>
        This is a one-time setup, run entirely on your own machine. Squibble will ask for an AI provider key
        (Claude, OpenAI, or Gemini — bring your own) and an email app password so it can send on your behalf and
        watch for replies. Nothing is stored anywhere except this computer.
      </p>
      <Actions onNext={onNext} nextLabel="Get started →" />
    </>
  );
}

function AiProviderStep(props: {
  provider: ProviderKey; setProvider: (p: ProviderKey) => void;
  apiKey: string; setApiKey: (v: string) => void;
  selectedProvider: typeof PROVIDERS[number];
  aiCheck: CheckState; aiError: string | null; onTest: () => void;
  onBack: () => void; onNext: () => void; canContinue: boolean;
}) {
  const { provider, setProvider, apiKey, setApiKey, selectedProvider, aiCheck, aiError, onTest, onBack, onNext, canContinue } = props;
  return (
    <>
      <h1 style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.03em", margin: "0 0 6px" }}>Connect your AI provider</h1>
      <p style={{ fontSize: 13.5, color: "var(--ink-secondary)", margin: "0 0 28px", lineHeight: 1.5 }}>
        Squibble uses this to draft emails and find faculty matches. Your key stays in a local <code>.env.local</code> file
        — it&apos;s never sent anywhere but the provider you choose.
      </p>

      <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--accent)", marginBottom: 12 }}>
        Choose a provider
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 24 }}>
        {PROVIDERS.map((p) => (
          <div
            key={p.key}
            onClick={() => setProvider(p.key)}
            style={{
              border: "1px solid var(--border-default)", borderRadius: 12, padding: "14px 12px",
              display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, cursor: "pointer",
              background: provider === p.key ? "var(--accent-muted)" : "var(--bg-card)",
              borderColor: provider === p.key ? "var(--accent)" : "var(--border-default)",
            }}
          >
            <div style={{ width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", background: p.color, flexShrink: 0 }}>
              {p.letter}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{p.name}</div>
              <div style={{ fontSize: 10.5, color: "var(--ink-muted)" }}>{p.note}</div>
            </div>
          </div>
        ))}
      </div>

      <Field label="API key">
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Paste your API key"
          style={inputStyle()}
        />
      </Field>

      <Callout>
        Don&apos;t have a key yet?{" "}
        <a href={selectedProvider.keyLink} target="_blank" rel="noreferrer" style={{ color: "var(--accent-hover)", fontWeight: 600, textDecoration: "underline" }}>
          {selectedProvider.keyLinkLabel} →
        </a>
        {selectedProvider.key === "gemini" && " Gemini's free tier has tighter rate limits than a paid key — fine for occasional use, worth knowing if a campaign run stalls."}
      </Callout>

      {aiError && <p style={{ fontSize: 12, color: "#B4483C", margin: "-8px 0 16px" }}>{aiError}</p>}

      <Actions
        onBack={onBack}
        onNext={onNext}
        canContinue={canContinue}
        extra={
          <button
            type="button"
            onClick={onTest}
            disabled={!apiKey.trim() || aiCheck === "checking"}
            style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600, color: "var(--accent-hover)", background: "none", border: "1px solid var(--border-default)", borderRadius: 10, padding: "10px 14px", cursor: "pointer" }}
          >
            Test connection <CheckBadge state={aiCheck} />
          </button>
        }
      />
    </>
  );
}

function EmailStep(props: {
  emailPreset: keyof typeof EMAIL_PRESETS; applyPreset: (k: keyof typeof EMAIL_PRESETS) => void;
  fromName: string; setFromName: (v: string) => void;
  fromEmail: string; setFromEmail: (v: string) => void;
  smtpHost: string; setSmtpHost: (v: string) => void;
  smtpPort: number; setSmtpPort: (v: number) => void;
  smtpUser: string; setSmtpUser: (v: string) => void;
  smtpPass: string; setSmtpPass: (v: string) => void;
  imapHost: string; setImapHost: (v: string) => void;
  imapPort: number; setImapPort: (v: number) => void;
  imapUser: string; setImapUser: (v: string) => void;
  imapPass: string; setImapPass: (v: string) => void;
  emailCheck: { smtp: CheckState; imap: CheckState }; emailCheckError: string | null; onTest: () => void;
  onBack: () => void; onNext: () => void; canContinue: boolean;
}) {
  const p = props;
  return (
    <>
      <h1 style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.03em", margin: "0 0 6px" }}>Connect your email</h1>
      <p style={{ fontSize: 13.5, color: "var(--ink-secondary)", margin: "0 0 24px", lineHeight: 1.5 }}>
        Squibble sends from your real address via SMTP and watches for replies via IMAP, using an app password you
        generate once — not OAuth, not a shared inbox.
      </p>

      <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--accent)", marginBottom: 12 }}>
        Provider preset
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 20 }}>
        {(Object.keys(EMAIL_PRESETS) as Array<keyof typeof EMAIL_PRESETS>).map((key) => (
          <button
            key={key}
            onClick={() => p.applyPreset(key)}
            style={{
              padding: "10px 8px", borderRadius: 10, fontSize: 12.5, fontWeight: 600, textTransform: "capitalize",
              border: `1px solid ${p.emailPreset === key ? "var(--accent)" : "var(--border-default)"}`,
              background: p.emailPreset === key ? "var(--accent-muted)" : "var(--bg-card)",
              color: "var(--ink)", cursor: "pointer",
            }}
          >
            {key}
          </button>
        ))}
      </div>

      {EMAIL_PRESETS[p.emailPreset].docs && (
        <Callout>
          Generate an app password for {p.emailPreset}:{" "}
          <a href={EMAIL_PRESETS[p.emailPreset].docs} target="_blank" rel="noreferrer" style={{ color: "var(--accent-hover)", fontWeight: 600, textDecoration: "underline" }}>
            step-by-step instructions →
          </a>{" "}
          Do not use your regular account password — it won&apos;t work with 2FA enabled and app passwords are safer to store.
        </Callout>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Your name (optional)"><input value={p.fromName} onChange={(e) => p.setFromName(e.target.value)} style={inputStyle()} placeholder="Jane Doe" /></Field>
        <Field label="Your email address"><input value={p.fromEmail} onChange={(e) => p.setFromEmail(e.target.value)} style={inputStyle()} placeholder="jane@gmail.com" /></Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
        <Field label="SMTP host"><input value={p.smtpHost} onChange={(e) => p.setSmtpHost(e.target.value)} style={inputStyle()} /></Field>
        <Field label="SMTP port"><input value={p.smtpPort} onChange={(e) => p.setSmtpPort(Number(e.target.value) || 587)} style={inputStyle()} /></Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="SMTP username"><input value={p.smtpUser} onChange={(e) => p.setSmtpUser(e.target.value)} style={inputStyle()} placeholder="usually your email" /></Field>
        <Field label="SMTP app password"><input type="password" value={p.smtpPass} onChange={(e) => p.setSmtpPass(e.target.value)} style={inputStyle()} /></Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
        <Field label="IMAP host"><input value={p.imapHost} onChange={(e) => p.setImapHost(e.target.value)} style={inputStyle()} /></Field>
        <Field label="IMAP port"><input value={p.imapPort} onChange={(e) => p.setImapPort(Number(e.target.value) || 993)} style={inputStyle()} /></Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="IMAP username"><input value={p.imapUser} onChange={(e) => p.setImapUser(e.target.value)} style={inputStyle()} placeholder="usually your email" /></Field>
        <Field label="IMAP app password"><input type="password" value={p.imapPass} onChange={(e) => p.setImapPass(e.target.value)} style={inputStyle()} placeholder="often the same as SMTP" /></Field>
      </div>

      {p.emailCheckError && <p style={{ fontSize: 12, color: "#B4483C", margin: "4px 0 0" }}>{p.emailCheckError}</p>}

      <Actions
        onBack={p.onBack}
        onNext={p.onNext}
        canContinue={p.canContinue}
        extra={
          <button
            type="button"
            onClick={p.onTest}
            disabled={!p.canContinue}
            style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600, color: "var(--accent-hover)", background: "none", border: "1px solid var(--border-default)", borderRadius: 10, padding: "10px 14px", cursor: "pointer" }}
          >
            Test SMTP <CheckBadge state={p.emailCheck.smtp} /> · IMAP <CheckBadge state={p.emailCheck.imap} />
          </button>
        }
      />
    </>
  );
}

function ReviewStep({ provider, fromEmail, smtpHost, imapHost, submitting, submitError, onBack, onFinish }: {
  provider: typeof PROVIDERS[number]; fromEmail: string; smtpHost: string; imapHost: string;
  submitting: boolean; submitError: string | null; onBack: () => void; onFinish: () => void;
}) {
  return (
    <>
      <h1 style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.03em", margin: "0 0 6px" }}>Review &amp; finish</h1>
      <p style={{ fontSize: 13.5, color: "var(--ink-secondary)", margin: "0 0 24px", lineHeight: 1.5 }}>
        This writes your credentials to a local <code>.env.local</code> file (never committed, never sent anywhere but
        the services above) and takes you straight to your dashboard.
      </p>

      <div style={{ border: "1px solid var(--border-default)", borderRadius: 12, padding: "16px 18px", marginBottom: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        <SummaryRow label="AI provider" value={provider.name} />
        <SummaryRow label="Sending as" value={fromEmail || "—"} />
        <SummaryRow label="SMTP host" value={smtpHost || "—"} />
        <SummaryRow label="IMAP host" value={imapHost || "—"} />
      </div>

      {submitError && <p style={{ fontSize: 12, color: "#B4483C", margin: "0 0 16px" }}>{submitError}</p>}

      <Actions onBack={onBack} onNext={onFinish} nextLabel={submitting ? "Setting up…" : "Finish setup →"} canContinue={!submitting} />
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
      <span style={{ color: "var(--ink-muted)" }}>{label}</span>
      <span style={{ color: "var(--ink)", fontWeight: 600 }}>{value}</span>
    </div>
  );
}
