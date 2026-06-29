"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useCampaignDraft } from "@/components/CampaignDraftContext";


const inputStyle = (filled: boolean) => ({
  background: "var(--bg-card)",
  borderColor: filled ? "var(--border-strong)" : "var(--border-default)",
  color: "var(--ink)",
  outline: "none",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
});

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: "#678E8D", letterSpacing: "0.08em" }}>
      {children}
    </p>
  );
}

export default function CampaignPage() {
  const router = useRouter();
  const { draft, setDraft, resetDraft } = useCampaignDraft();
  const { university, research, availability, contactCount, rawCount } = draft;
  const [loading, setLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState("Finding the right department...");
  const [error, setError] = useState<string | null>(null);
  const [sliderMax, setSliderMax] = useState(20);
  const [scoutingRemaining, setScoutingRemaining] = useState<number | null>(null);

  useEffect(() => {
    function fetchUsage() {
      fetch("/api/usage")
        .then((r) => r.json())
        .then((d: { searches_remaining: number }) => {
          const remaining = d.searches_remaining ?? 0;
          setScoutingRemaining(remaining);
          const max = Math.min(20, remaining);
          setSliderMax(max);

          let defaultCount: number;
          if (remaining === 0) {
            defaultCount = 0;
          } else if (remaining <= 20) {
            defaultCount = Math.ceil(remaining / 2);
          } else {
            defaultCount = 10;
          }
          setDraft({ contactCount: defaultCount, rawCount: String(defaultCount) });
        })
        .catch(() => {});
    }

    fetchUsage();

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") fetchUsage();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const noScoutingQuota = scoutingRemaining !== null && scoutingRemaining === 0;
  const sliderDisabled = scoutingRemaining !== null && scoutingRemaining <= 1;
  const ready = university.trim() && research.trim() && !noScoutingQuota;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-5">
        <div className="flex items-center gap-2.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="block w-2 h-2 rounded-full" style={{ background: "var(--accent)", animation: `pulse-dot 1.2s ease-in-out ${i * 0.18}s infinite` }} />
          ))}
        </div>
        <p className="text-sm" style={{ color: "var(--ink-secondary)" }}>{progressMessage}</p>
        <style>{`@keyframes pulse-dot { 0%, 100% { opacity: 0.2; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1); } }`}</style>
      </div>
    );
  }

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
          availability: availability || null,
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
              try {
                const [profRes, usageRes] = await Promise.all([
                  fetch(`/api/professors?campaignId=${campaignId}`),
                  fetch("/api/usage"),
                ]);
                const [profData, usageData] = await Promise.all([profRes.json(), usageRes.json()]);
                sessionStorage.setItem(
                  `squibble_profs_${campaignId}`,
                  JSON.stringify({ profData, usageData })
                );
              } catch {
                // Prefetch failed; professors page will fetch on its own
              }
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
          <h1 className="text-2xl font-medium mb-2" style={{ color: "var(--ink)", letterSpacing: "-0.03em" }}>
            New campaign
          </h1>
          <p className="text-sm" style={{ color: "var(--ink-secondary)" }}>
            We&apos;ll find the right faculty, write every email, send them, and track every response.
          </p>
        </div>

        <div className="flex flex-col gap-5 mb-6">
          {/* Campaign scope */}
          <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
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
              <div>
                <textarea
                  value={research}
                  onChange={(e) => setDraft({ research: e.target.value })}
                  placeholder="What are you interested in researching?"
                  rows={4}
                  className="w-full px-3.5 py-3 rounded-lg text-sm border transition-all duration-150 resize-none"
                  style={inputStyle(!!research)}
                />
                <p className="text-xs" style={{ color: "var(--ink-secondary)", marginTop: 6 }}>
                  e.g. Number Theory; Behavioral Economics; The study of graphene, Moiré systems and Kagome lattices
                </p>
              </div>
            </div>
          </div>

          {/* Logistics */}
          <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
            <SectionLabel>Logistics</SectionLabel>
            <input
              type="text"
              value={availability}
              onChange={(e) => setDraft({ availability: e.target.value })}
              placeholder="When are you available?"
              className="w-full px-3.5 py-3 rounded-lg text-sm border transition-all duration-150"
              style={inputStyle(!!availability)}
            />
            <p className="text-xs" style={{ color: "var(--ink-secondary)", marginTop: 6 }}>
              e.g. Mid-May to mid-August
            </p>
          </div>
        </div>

        {/* Researcher count */}
        <div className="rounded-xl p-5 mb-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", opacity: scoutingRemaining === null ? 0 : 1 }}>
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
                const clamped = isNaN(n) || n < 1 ? 1 : n > sliderMax ? sliderMax : n;
                setDraft({ contactCount: clamped, rawCount: String(clamped) });
              }}
              className="text-3xl font-bold text-center w-14 rounded-lg bg-transparent border-0 focus:outline-none cursor-pointer"
              style={{ color: "var(--accent)" }}
            />
          </div>
          <input
            type="range"
            min={1}
            max={sliderMax > 0 ? sliderMax : 1}
            value={contactCount}
            disabled={sliderDisabled}
            onChange={(e) => {
              const n = Number(e.target.value);
              setDraft({ contactCount: n, rawCount: String(n) });
            }}
            className="w-full"
            style={{
              accentColor: "var(--accent)",
              cursor: sliderDisabled ? "not-allowed" : "pointer",
              opacity: sliderDisabled ? 0.4 : 1,
            }}
          />
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs" style={{ color: "var(--ink-secondary)" }}>
              {scoutingRemaining === null
                ? " "
                : scoutingRemaining === 0
                ? "0 searches remaining."
                : `${scoutingRemaining} search${scoutingRemaining === 1 ? "" : "es"} remaining.`}
            </p>
            {scoutingRemaining === 0 && (
              <p className="text-xs" style={{ color: "var(--ink-secondary)" }}>
                Buy more to continue.
              </p>
            )}
          </div>
        </div>

        {error && (
          <p className="text-xs mb-4 text-center" style={{ color: "#f87171" }}>{error}</p>
        )}

        <button
          onClick={handleFindFaculty}
          disabled={!ready || loading || noScoutingQuota}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          style={
            ready && !loading && !noScoutingQuota
              ? { background: "#678E8D", color: "#FFFFFF" }
              : { background: "#BBD2DD", color: "#FFFFFF" }
          }
        >
          Find faculty
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
}
