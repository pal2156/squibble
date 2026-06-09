"use client";

import { useEffect, useState } from "react";

interface UsageData {
  searches_remaining: number;
  emails_remaining: number;
}

function UsageRow({ label, remaining }: { label: string; remaining: number }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-sm font-medium" style={{ color: "#232C33" }}>
        {label}
      </span>
      <span className="text-sm tabular-nums" style={{ color: "#3C5352" }}>
        {remaining}
      </span>
    </div>
  );
}

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
        {loading ? (
          <div className="space-y-5 animate-pulse">
            {[0, 1].map((i) => (
              <div key={i} className="flex justify-between">
                <div className="h-4 w-40 rounded-md" style={{ background: "#F1F6F9" }} />
                <div className="h-4 w-14 rounded-md" style={{ background: "#F1F6F9" }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            <UsageRow
              label="Professor searches remaining"
              remaining={data?.searches_remaining ?? 0}
            />
            <UsageRow
              label="Emails remaining"
              remaining={data?.emails_remaining ?? 0}
            />
          </div>
        )}
      </div>
    </div>
  );
}
