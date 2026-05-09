"use client";

import { useState, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar,
} from "recharts";
import { ChevronDown } from "lucide-react";
import { sentEmails } from "@/lib/mock-data";

const SENT_COLOR = "#60a5fa";
const RESP_COLOR = "#34d399";
const NEG_COLOR = "#ef4444";
const GRAY_COLOR = "#6b7280";

// --- Shared card shell ---

function CardShell({
  title,
  children,
  action,
  filter,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  filter?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border flex flex-col"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-subtle)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <h2 className="text-xs font-semibold" style={{ color: "var(--ink)" }}>
          {title}
        </h2>
        {(action || filter) && (
          <div className="flex items-center gap-2">
            {action}
            {filter}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

// --- Card 1: Response Rate Over Time ---

const LINE_DATA = [
  { campaign: "ML Research", sent: 18, responses: 4 },
  { campaign: "NLP 2024", sent: 24, responses: 7 },
  { campaign: "CV & Robotics", sent: 15, responses: 5 },
  { campaign: "Bio-AI", sent: 20, responses: 9 },
  { campaign: "Data Science", sent: 22, responses: 8 },
  { campaign: "HCI Labs", sent: 16, responses: 6 },
  { campaign: "Systems AI", sent: 28, responses: 11 },
];

const RANGES = ["All Campaigns", "Last 5", "Last 3"] as const;

function LineTooltip({
  active,
  payload,
  label,
}: {
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
      <p className="font-semibold mb-2" style={{ color: "var(--ink)" }}>
        {label}
      </p>
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

function ResponseRateCard() {
  const [range, setRange] = useState<(typeof RANGES)[number]>("All Campaigns");

  const data =
    range === "Last 3"
      ? LINE_DATA.slice(-3)
      : range === "Last 5"
      ? LINE_DATA.slice(-5)
      : LINE_DATA;

  return (
    <CardShell
      title="Response Rate Over Time"
      action={
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--ink-muted)" }}>
            <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: SENT_COLOR }} />
            Emails Sent
          </span>
          <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--ink-muted)" }}>
            <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: RESP_COLOR }} />
            Responses
          </span>
        </div>
      }
      filter={
        <div className="relative">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as (typeof RANGES)[number])}
            className="appearance-none text-xs rounded-lg border pl-2.5 pr-7 py-1 cursor-pointer"
            style={{
              background: "var(--bg-card)",
              borderColor: "var(--border-subtle)",
              color: "var(--ink-muted)",
              outline: "none",
            }}
          >
            {RANGES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <ChevronDown
            className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none"
            style={{ color: "var(--ink-muted)" }}
          />
        </div>
      }
    >
      <div className="px-2 pt-4 pb-2" style={{ height: 178 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="crSentGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SENT_COLOR} stopOpacity={0.14} />
                <stop offset="100%" stopColor={SENT_COLOR} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="crRespGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={RESP_COLOR} stopOpacity={0.18} />
                <stop offset="100%" stopColor={RESP_COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="rgba(92,124,137,0.09)" />
            <XAxis
              dataKey="campaign"
              tick={{ fontSize: 9, fill: "#7A9DAB" }}
              tickLine={false}
              axisLine={false}
              dy={6}
            />
            <YAxis hide />
            <Tooltip
              content={<LineTooltip />}
              cursor={{ stroke: "rgba(92,124,137,0.15)", strokeWidth: 1, strokeDasharray: "3 3" }}
            />
            <Area
              type="monotone"
              dataKey="sent"
              stroke={SENT_COLOR}
              strokeWidth={1.75}
              fill="url(#crSentGrad)"
              dot={false}
              activeDot={{ r: 4, fill: SENT_COLOR, strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="responses"
              stroke={RESP_COLOR}
              strokeWidth={1.75}
              fill="url(#crRespGrad)"
              dot={false}
              activeDot={{ r: 4, fill: RESP_COLOR, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </CardShell>
  );
}

// --- Card 2: Response Breakdown (Donut) ---

const DONUT_COLORS: Record<string, string> = {
  "Positive Reply": RESP_COLOR,
  "No Response": GRAY_COLOR,
  "Negative Reply": NEG_COLOR,
};

function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number }[];
}) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-lg"
      style={{ background: "var(--bg-card)", borderColor: "var(--border-default)" }}
    >
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: DONUT_COLORS[name] }} />
        <span style={{ color: "var(--ink-muted)" }}>{name}</span>
        <span className="ml-2 font-semibold tabular-nums" style={{ color: "var(--ink)" }}>
          {value}
        </span>
      </div>
    </div>
  );
}

function ResponseBreakdownCard() {
  const data = useMemo(() => {
    const counts: Record<string, number> = {
      "Positive Reply": 0,
      "No Response": 0,
      "Negative Reply": 0,
    };
    sentEmails.forEach((e) => {
      counts[e.status] = (counts[e.status] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, []);

  return (
    <CardShell title="Response Breakdown">
      <div
        className="flex items-center justify-center gap-5 px-4"
        style={{ height: 178, paddingTop: 10, paddingBottom: 10 }}
      >
        <ResponsiveContainer width="45%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="52%"
              outerRadius="78%"
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={DONUT_COLORS[entry.name]} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        <div className="flex flex-col gap-3">
          {data.map((entry) => (
            <div key={entry.name} className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: DONUT_COLORS[entry.name] }}
              />
              <span className="text-[11px]" style={{ color: "var(--ink-muted)" }}>
                {entry.name}
              </span>
              <span
                className="text-[11px] font-semibold tabular-nums ml-1"
                style={{ color: "var(--ink)" }}
              >
                {entry.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </CardShell>
  );
}

// --- Card 3: Replies by Campaign ---

function BarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number; fill: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg border px-3 py-2.5 text-xs shadow-lg"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-default)",
        minWidth: 148,
      }}
    >
      <p className="font-semibold mb-2" style={{ color: "var(--ink)" }}>
        {label}
      </p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 mb-1 last:mb-0">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entry.fill }} />
          <span style={{ color: "var(--ink-muted)" }}>
            {entry.dataKey === "sent" ? "Emails Sent" : "Positive Replies"}
          </span>
          <span className="ml-auto font-semibold tabular-nums" style={{ color: "var(--ink)" }}>
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function RepliesByCampaignCard() {
  const data = useMemo(() => {
    const map: Record<string, { sent: number; positive: number }> = {};
    sentEmails.forEach((e) => {
      if (!map[e.campaign]) map[e.campaign] = { sent: 0, positive: 0 };
      map[e.campaign].sent++;
      if (e.status === "Positive Reply") map[e.campaign].positive++;
    });
    return Object.entries(map).map(([fullName, vals]) => ({
      name: fullName.split(" — ")[0].split(" ").slice(0, 2).join(" "),
      sent: vals.sent,
      positive: vals.positive,
    }));
  }, []);

  return (
    <CardShell
      title="Replies by Campaign"
      action={
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--ink-muted)" }}>
            <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: SENT_COLOR }} />
            Sent
          </span>
          <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--ink-muted)" }}>
            <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: RESP_COLOR }} />
            Positive
          </span>
        </div>
      }
    >
      <div className="px-2 pt-3 pb-2" style={{ height: 178 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 14, bottom: 0, left: 4 }}
            barCategoryGap="28%"
            barGap={2}
          >
            <CartesianGrid horizontal={false} stroke="rgba(92,124,137,0.09)" />
            <XAxis
              type="number"
              tick={{ fontSize: 9, fill: "#7A9DAB" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 9, fill: "#7A9DAB" }}
              tickLine={false}
              axisLine={false}
              width={84}
            />
            <Tooltip
              content={<BarTooltip />}
              cursor={{ fill: "rgba(92,124,137,0.05)" }}
            />
            <Bar dataKey="sent" fill={SENT_COLOR} radius={[0, 3, 3, 0]} />
            <Bar dataKey="positive" fill={RESP_COLOR} radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </CardShell>
  );
}

// --- Row export ---

export function ChartRow() {
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      <ResponseRateCard />
      <ResponseBreakdownCard />
      <RepliesByCampaignCard />
    </div>
  );
}
