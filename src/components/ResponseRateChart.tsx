"use client";

import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChevronDown } from "lucide-react";

const ALL_DATA = [
  { campaign: "ML Research", sent: 18, responses: 4 },
  { campaign: "NLP 2024", sent: 24, responses: 7 },
  { campaign: "CV & Robotics", sent: 15, responses: 5 },
  { campaign: "Bio-AI", sent: 20, responses: 9 },
  { campaign: "Data Science", sent: 22, responses: 8 },
  { campaign: "HCI Labs", sent: 16, responses: 6 },
  { campaign: "Systems AI", sent: 28, responses: 11 },
];

const RANGES = ["All Campaigns", "Last 5", "Last 3"] as const;

const SENT_COLOR = "#60a5fa";
const RESP_COLOR = "#34d399";

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { dataKey: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg border px-3 py-2.5 text-xs shadow-lg"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-default)",
        color: "var(--ink)",
        minWidth: 140,
      }}
    >
      <p className="font-semibold mb-2" style={{ color: "var(--ink)" }}>{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 mb-1 last:mb-0">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entry.color }} />
          <span style={{ color: "var(--ink-muted)" }}>
            {entry.dataKey === "sent" ? "Emails Sent" : "Responses"}
          </span>
          <span className="ml-auto font-semibold tabular-nums" style={{ color: "var(--ink)" }}>
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ResponseRateChart() {
  const [range, setRange] = useState<typeof RANGES[number]>("All Campaigns");

  const data =
    range === "Last 3" ? ALL_DATA.slice(-3)
    : range === "Last 5" ? ALL_DATA.slice(-5)
    : ALL_DATA;

  return (
    <div
      className="rounded-xl border mb-6"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-subtle)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3.5 border-b"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <h2 className="text-xs font-semibold" style={{ color: "var(--ink)" }}>
          Response Rate
        </h2>

        <div className="flex items-center gap-4">
          {/* Legend */}
          <div className="flex items-center gap-3.5">
            <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--ink-muted)" }}>
              <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: SENT_COLOR }} />
              Emails Sent
            </span>
            <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--ink-muted)" }}>
              <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: RESP_COLOR }} />
              Responses
            </span>
          </div>

          {/* Filter */}
          <div className="relative">
            <select
              value={range}
              onChange={(e) => setRange(e.target.value as typeof RANGES[number])}
              className="appearance-none text-xs rounded-lg border pl-2.5 pr-7 py-1 cursor-pointer"
              style={{
                background: "var(--bg-card)",
                borderColor: "var(--border-subtle)",
                color: "var(--ink-muted)",
                outline: "none",
              }}
            >
              {RANGES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <ChevronDown
              className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none"
              style={{ color: "var(--ink-muted)" }}
            />
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="px-2 pt-5 pb-3" style={{ height: 490 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 30, bottom: 5, left: 20 }}>
            <defs>
              <linearGradient id="rrSentGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SENT_COLOR} stopOpacity={0.14} />
                <stop offset="100%" stopColor={SENT_COLOR} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="rrRespGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={RESP_COLOR} stopOpacity={0.18} />
                <stop offset="100%" stopColor={RESP_COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              vertical={false}
              stroke="rgba(187,210,221,0.08)"
            />

            <XAxis
              dataKey="campaign"
              ticks={data.map((d) => d.campaign)}
              tick={{ fontSize: 10, fill: "rgba(187,210,221,0.6)" }}
              tickLine={false}
              axisLine={false}
              dy={8}
              padding={{ left: 60, right: 60 }}
            />

            <YAxis hide />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: "rgba(103,142,141,0.25)", strokeWidth: 1, strokeDasharray: "3 3" }}
            />

            <Area
              type="monotone"
              dataKey="sent"
              stroke={SENT_COLOR}
              strokeWidth={1.75}
              fill="url(#rrSentGrad)"
              dot={false}
              activeDot={{ r: 4, fill: SENT_COLOR, strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="responses"
              stroke={RESP_COLOR}
              strokeWidth={1.75}
              fill="url(#rrRespGrad)"
              dot={false}
              activeDot={{ r: 4, fill: RESP_COLOR, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
