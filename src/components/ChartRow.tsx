"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { ChevronDown } from "lucide-react";
import { SentEmail } from "@/lib/types";

const SENT_COLOR = "#678E8D";
const RESP_COLOR = "#3C5352";
const NEG_COLOR = "#BBD2DD";
const GRAY_COLOR = "#BBD2DD";

const DONUT_COLORS: Record<string, string> = {
  "Positive Reply": "#678E8D",
  "No Response": "#BBD2DD",
  "Negative Reply": "#3C5352",
};

type TimeRange = "All Campaigns" | "Last 7 Days" | "Last 30 Days" | "Last 90 Days";
const RANGES: TimeRange[] = ["All Campaigns", "Last 7 Days", "Last 30 Days", "Last 90 Days"];

// --- Shared card shell ---

function CardShell({
  title,
  children,
  filter,
  legend,
}: {
  title: string;
  children: React.ReactNode;
  filter?: React.ReactNode;
  legend?: React.ReactNode;
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
        <div className="flex items-center gap-4">
          <h2 className="text-xs font-semibold" style={{ color: "var(--ink)" }}>
            {title}
          </h2>
          {legend}
        </div>
        {filter}
      </div>
      {children}
    </div>
  );
}

// --- Card 1: Response Rate Over Time (dual-line per campaign) ---

function parseMs(s: string) {
  return new Date(s).getTime();
}

type CampaignPoint = { campaign: string; sent: number; responses: number };

function CampaignTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const sent = payload.find((p) => p.dataKey === "sent")?.value ?? 0;
  const responses = payload.find((p) => p.dataKey === "responses")?.value ?? 0;
  const rate = sent > 0 ? Math.round((responses / sent) * 100) : 0;
  return (
    <div
      className="rounded-xl border px-4 py-3 text-xs shadow-lg"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-default)",
        minWidth: 190,
      }}
    >
      <p className="font-bold text-sm mb-3" style={{ color: "var(--ink)" }}>
        {label}
      </p>
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: SENT_COLOR }}
        />
        <span style={{ color: "var(--ink-muted)" }}>Emails Sent</span>
        <span className="ml-auto font-bold tabular-nums" style={{ color: "var(--ink)" }}>
          {sent}
        </span>
      </div>
      <div className="flex items-center gap-2 mb-2.5">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: RESP_COLOR }}
        />
        <span style={{ color: "var(--ink-muted)" }}>Responses</span>
        <span className="ml-auto font-bold tabular-nums" style={{ color: "var(--ink)" }}>
          {responses}
        </span>
      </div>
      <div
        className="flex items-center gap-2 pt-2 border-t"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <span style={{ color: "var(--ink-muted)" }}>Response Rate</span>
        <span
          className="ml-auto font-bold tabular-nums"
          style={{ color: RESP_COLOR }}
        >
          {rate}%
        </span>
      </div>
    </div>
  );
}

function splitLabel(text: string): string[] {
  if (text.length <= 20) return [text];
  const mid = Math.floor(text.length / 2);
  let before = mid;
  let after = mid;
  while (before > 0 && text[before] !== " ") before--;
  while (after < text.length && text[after] !== " ") after++;
  const splitAt = (mid - before) <= (after - mid) ? before : after;
  if (splitAt <= 0 || splitAt >= text.length) {
    return [text.slice(0, mid), text.slice(mid)];
  }
  return [text.slice(0, splitAt).trim(), text.slice(splitAt).trim()];
}

function CampaignTick({
  x = 0,
  y = 0,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value: string };
}) {
  const parts = splitLabel(payload?.value ?? "");
  return (
    <g transform={`translate(${x},${y + 6})`}>
      <text textAnchor="middle" fontSize={9} fill="#3C5352">
        {parts.map((part, i) => (
          <tspan key={i} x={0} dy={i === 0 ? "0" : "1.2em"}>
            {part}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function ResponseRateCard({ emails }: { emails: SentEmail[] }) {
  const [range, setRange] = useState<TimeRange>("All Campaigns");

  const chartData = useMemo((): CampaignPoint[] => {
    if (emails.length === 0) return [];

    const maxMs = Math.max(...emails.map((e) => parseMs(e.dateSent)));
    const DAY = 86400000;
    const cutoffMs =
      range === "Last 7 Days"
        ? maxMs - 7 * DAY
        : range === "Last 30 Days"
        ? maxMs - 30 * DAY
        : range === "Last 90 Days"
        ? maxMs - 90 * DAY
        : 0;

    const filtered = emails.filter((e) => parseMs(e.dateSent) >= cutoffMs);

    type CampaignMeta = { sent: number; responses: number; firstDateMs: number; createdAtMs: number };
    const campaignMap = new Map<string, CampaignMeta>();

    filtered.forEach((e) => {
      const dateMs = parseMs(e.dateSent);
      const createdMs = e.campaignCreatedAt ? new Date(e.campaignCreatedAt).getTime() : 0;
      if (!campaignMap.has(e.campaign)) {
        campaignMap.set(e.campaign, { sent: 0, responses: 0, firstDateMs: dateMs, createdAtMs: createdMs });
      }
      const meta = campaignMap.get(e.campaign)!;
      if (dateMs < meta.firstDateMs) meta.firstDateMs = dateMs;
      meta.sent++;
      if (e.status !== "No Response") meta.responses++;
    });

    const campaignOrder = [...campaignMap.keys()].sort((a, b) => {
      const ma = campaignMap.get(a)!;
      const mb = campaignMap.get(b)!;
      if (ma.firstDateMs !== mb.firstDateMs) return ma.firstDateMs - mb.firstDateMs;
      return ma.createdAtMs - mb.createdAtMs;
    });

    return campaignOrder.map((campaign) => {
      const { sent, responses } = campaignMap.get(campaign)!;
      const name = campaign.split(" - ")[0];
      return { campaign: name, sent, responses };
    });
  }, [emails, range]);

  return (
    <CardShell
      title="Response Rate Over Time"
      legend={
        <div className="flex items-center gap-3">
          <span
            className="flex items-center gap-1.5 text-[11px]"
            style={{ color: "var(--ink-muted)" }}
          >
            <span
              className="w-3 h-0.5 rounded-full inline-block"
              style={{ background: SENT_COLOR }}
            />
            Emails Sent
          </span>
          <span
            className="flex items-center gap-1.5 text-[11px]"
            style={{ color: "var(--ink-muted)" }}
          >
            <span
              className="w-3 h-0.5 rounded-full inline-block"
              style={{ background: RESP_COLOR }}
            />
            Responses
          </span>
        </div>
      }
      filter={
        <div className="relative">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as TimeRange)}
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
          <AreaChart data={chartData} margin={{ top: 4, right: 12, bottom: 40, left: 0 }}>
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
            <CartesianGrid vertical={false} stroke="rgba(187,210,221,0.6)" />
            <XAxis
              dataKey="campaign"
              ticks={chartData.map((d) => d.campaign)}
              tick={(props) => <CampaignTick {...props} />}
              tickLine={false}
              axisLine={false}
            />
            <YAxis hide />
            <Tooltip
              content={<CampaignTooltip />}
              cursor={{
                stroke: "rgba(103,142,141,0.3)",
                strokeWidth: 1,
                strokeDasharray: "4 3",
              }}
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

// --- Card 2: Response Breakdown (EV-style donut) ---

function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { name: string; value: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0].payload;
  return (
    <div
      className="rounded-xl border px-3 py-2.5 text-xs shadow-lg"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-default)",
        minWidth: 160,
      }}
    >
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: DONUT_COLORS[name] }} />
        <span style={{ color: "var(--ink-muted)" }}>{name}</span>
        <span className="ml-auto font-bold tabular-nums" style={{ color: "var(--ink)" }}>{value}</span>
      </div>
    </div>
  );
}

const RADIAN = Math.PI / 180;

function SegmentLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  value,
  name,
}: {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  value: number;
  name: string;
}) {
  if (!value) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  const textColor = name === "No Response" ? "#232C33" : "#FFFFFF";
  return (
    <text
      x={x}
      y={y}
      fill={textColor}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={600}
    >
      {value}
    </text>
  );
}

function ResponseBreakdownCard({ emails }: { emails: SentEmail[] }) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {
      "Positive Reply": 0,
      "No Response": 0,
      "Negative Reply": 0,
    };
    emails.forEach((e) => {
      counts[e.status] = (counts[e.status] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [emails]);

  const total = emails.length;

  return (
    <CardShell title="Response Breakdown">
      <div className="flex items-center px-4 py-4 gap-3" style={{ height: 178 }}>
        {/* Total */}
        <div className="flex flex-col justify-center flex-shrink-0" style={{ width: 80 }}>
          <p
            className="text-[10px] uppercase tracking-wider mb-0.5"
            style={{ color: "var(--ink-muted)" }}
          >
            Total Sent
          </p>
          <p
            className="text-3xl font-bold leading-none"
            style={{ color: "var(--ink)" }}
          >
            {total}
          </p>
        </div>

        {/* Donut */}
        <div className="flex-1 min-w-0" style={{ height: 146 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                content={<DonutTooltip />}
                cursor={false}
              />
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="42%"
                outerRadius="82%"
                paddingAngle={4}
                cornerRadius={6}
                dataKey="value"
                strokeWidth={0}
                isAnimationActive={false}
                label={SegmentLabel as never}
                labelLine={false}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={DONUT_COLORS[entry.name]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </CardShell>
  );
}

// --- Row export ---

export function ChartRow({ emails }: { emails: SentEmail[] }) {
  return (
    <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "2fr 1fr" }}>
      <ResponseRateCard emails={emails} />
      <ResponseBreakdownCard emails={emails} />
    </div>
  );
}
