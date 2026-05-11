"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useCampaignDraft } from "@/components/CampaignDraftContext";

function LoadingModal({
  message,
  visible,
}: {
  message: string;
  visible: boolean;
}) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{
        background: "rgba(14, 22, 28, 0.45)",
        backdropFilter: "blur(4px)",
        opacity: visible ? 1 : 0,
        transition: "opacity 300ms ease",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <div
        className="rounded-2xl px-10 py-10 flex flex-col items-center gap-7 shadow-2xl"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          minWidth: 320,
        }}
      >
        <div className="flex items-center gap-2.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="block w-2 h-2 rounded-full"
              style={{
                background: "var(--accent)",
                animation: `pulse-dot 1.2s ease-in-out ${i * 0.18}s infinite`,
              }}
            />
          ))}
        </div>
        <p
          className="text-sm font-medium text-center"
          style={{ color: "var(--ink-secondary)", minWidth: 240 }}
        >
          {message}
        </p>
      </div>
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1);   }
        }
      `}</style>
    </div>
  );
}

const inputStyle = (filled: boolean) => ({
  background: "var(--bg-card)",
  borderColor: filled ? "var(--border-strong)" : "var(--border-default)",
  color: "var(--ink)",
  outline: "none",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
});

const selectClassName =
  "w-full px-3.5 py-3 rounded-lg text-sm border transition-all duration-150 appearance-none";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ink-tertiary, var(--ink-secondary))" }}>
      {children}
    </p>
  );
}

export default function CampaignPage() {
  const router = useRouter();
  const { draft, setDraft, resetDraft } = useCampaignDraft();
  const { university, research, positionType, timeCommitment, availability, locationPref, contactCount, rawCount } = draft;
  const [loading, setLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState("Finding the right department...");
  const [error, setError] = useState<string | null>(null);

  const ready = university.trim() && research.trim();

  const handleFindFaculty = async () => {
    if (!ready || loading) return;
    setError(null);
    setLoading(true);
    setProgressMessage("Creating campaign...");

    try {
      // Step 1: Create campaign in Supabase
      const createRes = await fetch("/api/campaign/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          university,
          research_interest: research,
          position_type: positionType || null,
          time_commitment: timeCommitment || null,
          availability: availability || null,
          location_preference: locationPref || null,
          professor_count: contactCount,
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error ?? "Failed to create campaign");

      const campaignId: string = createData.campaign.id;
      setProgressMessage("Finding the right department...");

      // Step 2: Stream faculty finding via SSE
      const res = await fetch("/api/campaign/find-faculty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });

      if (!res.ok) throw new Error("Faculty search failed");

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "progress") setProgressMessage(event.message);
            if (event.type === "error") throw new Error(event.message);
            if (event.type === "done") {
              resetDraft();
              router.push(`/campaign/professors?campaignId=${campaignId}`);
              return;
            }
          } catch (e) {
            if (e instanceof Error && e.message !== "Unexpected end of JSON input") throw e;
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-9 text-center">
          <h1 className="text-2xl font-bold tracking-tight mb-2" style={{ color: "var(--ink)" }}>
            New campaign
          </h1>
          <p className="text-sm" style={{ color: "var(--ink-secondary)" }}>
            We&apos;ll find the right faculty, write every email, send them, and track every response.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-5 mb-6">
          {/* Left: Campaign scope */}
          <div className="flex-1 rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
            <SectionLabel>Campaign scope</SectionLabel>
            <div className="space-y-2.5">
              <input
                type="text"
                value={university}
                onChange={(e) => setDraft({ university: e.target.value })}
                placeholder="Which university?"
                className="w-full px-3.5 py-3 rounded-lg text-sm border transition-all duration-150"
                style={inputStyle(!!university)}
              />
              <textarea
                value={research}
                onChange={(e) => setDraft({ research: e.target.value })}
                placeholder="e.g. Condensed matter physics or Behavioral economics"
                rows={4}
                className="w-full px-3.5 py-3 rounded-lg text-sm border transition-all duration-150 resize-none"
                style={inputStyle(!!research)}
              />
            </div>
          </div>

          {/* Right: Logistics */}
          <div className="flex-1 rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
            <SectionLabel>Logistics</SectionLabel>
            <div className="space-y-2.5">
              <select
                value={positionType}
                onChange={(e) => setDraft({ positionType: e.target.value })}
                className={selectClassName}
                style={inputStyle(!!positionType)}
              >
                <option value="" disabled>Position type</option>
                <option>Paid</option>
                <option>Unpaid</option>
                <option>Flexible / Open to any</option>
              </select>

              <select
                value={timeCommitment}
                onChange={(e) => setDraft({ timeCommitment: e.target.value })}
                className={selectClassName}
                style={inputStyle(!!timeCommitment)}
              >
                <option value="" disabled>Time commitment</option>
                <option>Full-time (40+ hrs/week)</option>
                <option>Part-time (10-20 hrs/week)</option>
                <option>Part-time (20-30 hrs/week)</option>
                <option>Flexible</option>
              </select>

              <input
                type="text"
                value={availability}
                onChange={(e) => setDraft({ availability: e.target.value })}
                placeholder="When and how long are you available?"
                className="w-full px-3.5 py-3 rounded-lg text-sm border transition-all duration-150"
                style={inputStyle(!!availability)}
              />
              <p className="text-xs" style={{ color: "var(--ink-secondary)", marginTop: 2 }}>
                e.g. Mid-May to mid-August
              </p>

              <select
                value={locationPref}
                onChange={(e) => setDraft({ locationPref: e.target.value })}
                className={selectClassName}
                style={inputStyle(!!locationPref)}
              >
                <option value="" disabled>Location preference</option>
                <option>On-site only</option>
                <option>Remote only</option>
                <option>Hybrid</option>
                <option>No preference</option>
              </select>
            </div>
          </div>
        </div>

        {/* Researcher count */}
        <div className="rounded-xl p-5 mb-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
              How many researchers would you like us to find?
            </p>
            <input
              type="text"
              inputMode="numeric"
              value={rawCount}
              onChange={(e) => setDraft({ rawCount: e.target.value })}
              onBlur={() => {
                const n = parseInt(rawCount, 10);
                const clamped = isNaN(n) || n < 1 ? 1 : n > 20 ? 20 : n;
                setDraft({ contactCount: clamped, rawCount: String(clamped) });
              }}
              className="text-3xl font-bold text-center w-14 rounded-lg bg-transparent border-0 focus:outline-none cursor-pointer"
              style={{ color: "var(--accent)" }}
            />
          </div>
          <input
            type="range"
            min={1}
            max={20}
            value={contactCount}
            onChange={(e) => {
              const n = Number(e.target.value);
              setDraft({ contactCount: n, rawCount: String(n) });
            }}
            className="w-full cursor-pointer"
            style={{ accentColor: "var(--accent)" }}
          />
          <p className="text-xs mt-3" style={{ color: "var(--ink-secondary)" }}>
            Up to 20 researchers per campaign.
          </p>
        </div>

        {error && (
          <p className="text-xs mb-4 text-center" style={{ color: "#f87171" }}>{error}</p>
        )}

        <button
          onClick={handleFindFaculty}
          disabled={!ready || loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          style={
            ready && !loading
              ? { background: "var(--accent)", color: "#fff", boxShadow: "0 0 24px rgba(31,73,89,0.5)" }
              : { background: "var(--bg-elevated)", color: "var(--ink-secondary)" }
          }
        >
          Find faculty
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <LoadingModal message={progressMessage} visible={loading} />
    </div>
  );
}
