"use client";

import { useEffect, useState } from "react";
import { PLAN_LIMITS, type Plan } from "@/lib/plans";

interface UsageData {
  plan: Plan;
  searches_used: number;
  emails_sent: number;
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = Math.min(limit > 0 ? (used / limit) * 100 : 0, 100);
  const nearLimit = pct >= 90;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium" style={{ color: "#232C33" }}>
          {label}
        </span>
        <span className="text-sm tabular-nums" style={{ color: "#3C5352" }}>
          {used} / {limit}
        </span>
      </div>
      <div
        className="h-2 w-full rounded-full overflow-hidden"
        style={{ background: "rgba(103,142,141,0.15)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: nearLimit ? "#3C5352" : "#678E8D",
          }}
        />
      </div>
    </div>
  );
}

const PLAN_LABELS: Record<Plan, string> = {
  free: "Free",
  pro: "Pro",
  max: "Max",
};

export default function UsagePage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/usage")
      .then((r) => r.json())
      .then((d: UsageData) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const plan: Plan = data?.plan ?? "free";
  const limits = PLAN_LIMITS[plan];
  const planLabel = PLAN_LABELS[plan];

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold mb-1" style={{ color: "#232C33" }}>
          Usage
        </h1>
      </div>

      <div
        className="rounded-xl border p-6"
        style={{ background: "#FFFFFF", borderColor: "#BBD2DD" }}
      >
        <div
          className="flex items-center gap-2.5 pb-5 mb-5 border-b"
          style={{ borderColor: "#BBD2DD" }}
        >
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#3C5352" }}>
            Current plan
          </span>
          <span
            className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: "rgba(103,142,141,0.12)", color: "#678E8D" }}
          >
            {planLabel}
          </span>
        </div>

        {loading ? (
          <div className="space-y-7 animate-pulse">
            {[0, 1].map((i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between">
                  <div className="h-4 w-40 rounded-md" style={{ background: "#F1F6F9" }} />
                  <div className="h-4 w-14 rounded-md" style={{ background: "#F1F6F9" }} />
                </div>
                <div className="h-2 rounded-full" style={{ background: "#F1F6F9" }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-7">
            <UsageBar
              label="Professors Scouted"
              used={data?.searches_used ?? 0}
              limit={limits.searches}
            />
            <UsageBar
              label="Emails Sent"
              used={data?.emails_sent ?? 0}
              limit={limits.emails}
            />
          </div>
        )}
      </div>
    </div>
  );
}
