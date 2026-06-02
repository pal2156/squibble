"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { ChevronRight, X } from "lucide-react";
import Image from "next/image";
import { ChartRow } from "@/components/ChartRow";

type EmailStatus = "Positive Reply" | "No Response" | "Negative Reply";

interface SentEmail {
  id: string;
  professor: string;
  university: string;
  department: string;
  campaign: string;
  dateSent: string;
  status: EmailStatus;
  subject: string;
  body: string;
  reply?: { date: string; body: string };
}

type SortCol = "professor" | "university" | "department" | "campaign" | "dateSent" | "status";
type SortDir = "asc" | "desc";

const STATUS_TABS = ["All", "Positive Reply", "No Response", "Negative Reply"] as const;
type StatusTab = typeof STATUS_TABS[number];

const COLUMNS: { key: SortCol; label: string }[] = [
  { key: "professor", label: "Professor" },
  { key: "university", label: "University" },
  { key: "department", label: "Department" },
  { key: "campaign", label: "Campaign" },
  { key: "dateSent", label: "Date Sent" },
  { key: "status", label: "Status" },
];

const statusConfig: Record<EmailStatus, { label: string; dot: string; bg: string; text: string }> = {
  "Positive Reply": { label: "Positive Reply", dot: "#678E8D", bg: "rgba(103,142,141,0.1)", text: "#678E8D" },
  "No Response": { label: "No Response", dot: "#BBD2DD", bg: "rgba(187,210,221,0.25)", text: "#3C5352" },
  "Negative Reply": { label: "Negative Reply", dot: "#3C5352", bg: "rgba(60,83,82,0.08)", text: "#3C5352" },
};

function panelReplyStyle(status: EmailStatus) {
  if (status === "Positive Reply") return { bg: "rgba(103,142,141,0.05)", border: "#BBD2DD", name: "#678E8D" };
  if (status === "Negative Reply") return { bg: "rgba(60,83,82,0.05)", border: "#BBD2DD", name: "#3C5352" };
  return { bg: "#F1F6F9", border: "#BBD2DD", name: "#232C33" };
}

function StatusBadge({ status }: { status: EmailStatus }) {
  const cfg = statusConfig[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
      style={{ background: cfg.bg, color: cfg.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

function parseDate(s: string) {
  return new Date(s).getTime();
}

function parseSingleDate(raw: string): { month: number; day: number; year: number } | null {
  const m = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const month = +m[1], day = +m[2], year = +m[3];
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { month, day, year };
}

function dateMatchesExact(dateSent: string, parsed: { month: number; day: number; year?: number }): boolean {
  const d = new Date(dateSent);
  if (isNaN(d.getTime())) return false;
  if (d.getMonth() + 1 !== parsed.month || d.getDate() !== parsed.day) return false;
  if (parsed.year !== undefined && d.getFullYear() !== parsed.year) return false;
  return true;
}

export default function DashboardPage() {
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    function fetchData() {
      fetch("/api/dashboard")
        .then((r) => r.json())
        .then(({ emails }) => {
          if (cancelled || !emails) return;
          setSentEmails(emails);
          setSelectedEmail((prev) => {
            if (!prev) return null;
            return (emails as SentEmail[]).find((e) => e.id === prev.id) ?? prev;
          });
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    }

    fetchData();
    const intervalId = setInterval(fetchData, 30_000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  const totalSent = sentEmails.length;
  const positiveReplies = sentEmails.filter((e) => e.status === "Positive Reply").length;
  const replied = sentEmails.filter((e) => e.status !== "No Response").length;
  const responseRate = totalSent > 0 ? Math.round((replied / totalSent) * 100) : 0;
  const campaigns = [...new Set(sentEmails.map((e) => e.campaign))].length;

  const uniqueCampaigns = useMemo(
    () => [...new Set(sentEmails.map((e) => e.campaign))].sort(),
    [sentEmails]
  );
  const uniqueUniversities = useMemo(
    () => [...new Set(sentEmails.map((e) => e.university))].sort(),
    [sentEmails]
  );

  const [sortCol, setSortCol] = useState<SortCol>("dateSent");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [statusFilter, setStatusFilter] = useState<StatusTab>("All");
  const [search, setSearch] = useState("");
  const [monthInput, setMonthInput] = useState("");
  const [dayInput, setDayInput] = useState("");
  const [yearInput, setYearInput] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("All Campaigns");
  const [universityFilter, setUniversityFilter] = useState("All Universities");
  const [selectedEmail, setSelectedEmail] = useState<SentEmail | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selectedEmail) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setSelectedEmail(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedEmail]);

  const dateSearch = (monthInput || dayInput || yearInput)
    ? `${monthInput.padStart(2, "0")}/${dayInput.padStart(2, "0")}/${yearInput}`
    : "";
  const isDateInvalid = dateSearch !== "" && yearInput.length === 4 && parseSingleDate(dateSearch) === null;

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 2);
    if (val.length === 1 && +val > 1) {
      setMonthInput("0" + val);
      dayRef.current?.focus();
    } else {
      setMonthInput(val);
      if (val.length === 2) dayRef.current?.focus();
    }
  };

  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 2);
    if (val.length === 1 && +val > 3) {
      setDayInput("0" + val);
      yearRef.current?.focus();
    } else {
      setDayInput(val);
      if (val.length === 2) yearRef.current?.focus();
    }
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setYearInput(e.target.value.replace(/\D/g, "").slice(0, 4));
  };

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    let rows = [...sentEmails];

    if (statusFilter !== "All") {
      rows = rows.filter((r) => r.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.professor.toLowerCase().includes(q) ||
          r.university.toLowerCase().includes(q) ||
          r.department.toLowerCase().includes(q)
      );
    }

    if (dateSearch.trim()) {
      const parsed = parseSingleDate(dateSearch);
      if (parsed) {
        rows = rows.filter((r) => dateMatchesExact(r.dateSent, parsed));
      }
    }

    if (campaignFilter !== "All Campaigns") {
      rows = rows.filter((r) => r.campaign === campaignFilter);
    }

    if (universityFilter !== "All Universities") {
      rows = rows.filter((r) => r.university === universityFilter);
    }

    rows.sort((a, b) => {
      if (sortCol === "dateSent") {
        const diff = parseDate(a.dateSent) - parseDate(b.dateSent);
        return sortDir === "asc" ? diff : -diff;
      }
      const aVal = a[sortCol].toLowerCase();
      const bVal = b[sortCol].toLowerCase();
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return rows;
  }, [sentEmails, sortCol, sortDir, statusFilter, search, monthInput, dayInput, yearInput, campaignFilter, universityFilter]);

  const stats = [
    { label: "Emails Sent", value: totalSent, iconSrc: "/icons/emails-sent.png", bg: "rgba(103,142,141,0.1)" },
    { label: "Response Rate", value: `${responseRate}%`, iconSrc: "/icons/response-rate.png", bg: "rgba(103,142,141,0.1)" },
    { label: "Positive Replies", value: positiveReplies, iconSrc: "/icons/positive-replies.png", bg: "rgba(103,142,141,0.1)" },
    { label: "Campaigns Run", value: campaigns, iconSrc: "/icons/campaigns-run.png", bg: "rgba(103,142,141,0.1)" },
  ];

  if (loading) {
    return (
      <div className="flex overflow-hidden" style={{ height: "100vh" }}>
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="px-8 py-8 max-w-6xl mx-auto">
            {/* Subtitle skeleton */}
            <div className="mb-6 flex justify-center">
              <div className="h-3.5 w-56 rounded animate-pulse" style={{ background: "var(--bg-elevated)" }} />
            </div>

            {/* Stats cards skeleton */}
            <div
              className="flex items-stretch rounded-xl border mb-6 overflow-hidden animate-pulse"
              style={{ background: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
            >
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="flex-1 flex items-center gap-3 px-5 py-4"
                  style={{ borderLeft: idx > 0 ? "1px solid var(--border-subtle)" : "none" }}
                >
                  <div className="w-8 h-8 rounded-lg flex-shrink-0" style={{ background: "var(--bg-elevated)" }} />
                  <div className="space-y-2">
                    <div className="h-2.5 w-20 rounded" style={{ background: "var(--bg-elevated)" }} />
                    <div className="h-5 w-10 rounded" style={{ background: "var(--bg-elevated)" }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Chart area skeleton */}
            <div
              className="flex gap-5 mb-6 animate-pulse"
              style={{ height: "220px" }}
            >
              <div className="flex-1 rounded-xl border" style={{ background: "var(--bg-card)", borderColor: "var(--border-subtle)" }} />
              <div className="w-64 rounded-xl border" style={{ background: "var(--bg-card)", borderColor: "var(--border-subtle)" }} />
            </div>

            {/* Table skeleton */}
            <div
              className="rounded-xl border overflow-hidden animate-pulse"
              style={{ background: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "var(--border-subtle)" }}>
                <div className="h-3 w-24 rounded" style={{ background: "var(--bg-elevated)" }} />
                <div className="h-3 w-12 rounded" style={{ background: "var(--bg-elevated)" }} />
              </div>
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-5 px-5 py-3"
                  style={{ borderBottom: i < 4 ? "1px solid var(--border-subtle)" : "none" }}
                >
                  <div className="h-3 w-28 rounded" style={{ background: "var(--bg-elevated)" }} />
                  <div className="h-3 w-32 rounded" style={{ background: "var(--bg-elevated)" }} />
                  <div className="h-3 w-28 rounded" style={{ background: "var(--bg-elevated)" }} />
                  <div className="h-3 w-36 rounded" style={{ background: "var(--bg-elevated)" }} />
                  <div className="h-3 w-20 rounded" style={{ background: "var(--bg-elevated)" }} />
                  <div className="h-5 w-24 rounded-full ml-auto" style={{ background: "var(--bg-elevated)" }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex overflow-hidden" style={{ height: "100vh" }}>
    {/* Left: scrollable content */}
    <div className="flex-1 min-w-0 overflow-y-auto">
    <div className="px-8 py-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 text-center">
        <p className="text-xs" style={{ color: "var(--ink-secondary)" }}>
          Track your outreach across all campaigns.
        </p>
      </div>

      {/* Stats — compact inline row */}
      <div
        className="flex items-stretch rounded-xl border mb-6 overflow-hidden"
        style={{
          background: "var(--bg-card)",
          borderColor: "var(--border-subtle)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        {stats.map(({ label, value, iconSrc, bg }, idx) => (
          <div
            key={label}
            className="flex-1 flex items-center gap-3 px-5 py-4"
            style={{
              borderLeft: idx > 0 ? "1px solid var(--border-subtle)" : "none",
            }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
              <Image src={iconSrc} alt={label} width={14} height={14} />
            </div>
            <div>
              <p className="text-[11px] font-medium mb-0.5" style={{ color: "var(--ink-muted)" }}>{label}</p>
              <p className="text-xl font-bold tracking-tight leading-none" style={{ color: "var(--ink)" }}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <ChartRow emails={sentEmails} />


      {/* Filters row */}
      <div className="flex items-center gap-2.5 mb-2.5">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Image
            src="/icons/search.png"
            alt="Search"
            width={12}
            height={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search professor, university..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border"
            style={{
              background: "var(--bg-card)",
              borderColor: "var(--border-subtle)",
              color: "var(--ink)",
              outline: "none",
            }}
          />
        </div>

        {/* Date filter — segmented MM / DD / YYYY */}
        <div
          className="flex items-center gap-0 rounded-lg border px-2.5 py-1.5"
          style={{
            background: "var(--bg-card)",
            borderColor: isDateInvalid ? "#ef4444" : "var(--border-subtle)",
          }}
        >
          <Image
            src="/icons/calendar.png"
            alt="Calendar"
            width={12}
            height={12}
            className="mr-1.5 flex-shrink-0 pointer-events-none"
          />
          <input
            ref={monthRef}
            type="text"
            inputMode="numeric"
            placeholder="MM"
            value={monthInput}
            onChange={handleMonthChange}
            onKeyDown={(e) => { if (e.key === "Backspace" && monthInput === "") { setMonthInput(""); } }}
            className="text-xs bg-transparent text-center tabular-nums"
            style={{ width: "3ch", color: "var(--ink)", outline: "none" }}
          />
          <span className="text-xs select-none" style={{ color: "var(--ink-muted)" }}>/</span>
          <input
            ref={dayRef}
            type="text"
            inputMode="numeric"
            placeholder="DD"
            value={dayInput}
            onChange={handleDayChange}
            onKeyDown={(e) => { if (e.key === "Backspace" && dayInput === "") monthRef.current?.focus(); }}
            className="text-xs bg-transparent text-center tabular-nums"
            style={{ width: "3ch", color: "var(--ink)", outline: "none" }}
          />
          <span className="text-xs select-none" style={{ color: "var(--ink-muted)" }}>/</span>
          <input
            ref={yearRef}
            type="text"
            inputMode="numeric"
            placeholder="YYYY"
            value={yearInput}
            onChange={handleYearChange}
            onKeyDown={(e) => { if (e.key === "Backspace" && yearInput === "") dayRef.current?.focus(); }}
            className="text-xs bg-transparent text-center tabular-nums"
            style={{ width: "5ch", color: "var(--ink)", outline: "none" }}
          />
        </div>

        {/* Campaign dropdown */}
        <div className="relative">
          <select
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
            className="appearance-none text-xs rounded-lg border pl-2.5 pr-7 py-1.5 cursor-pointer"
            style={{
              background: "var(--bg-card)",
              borderColor: "var(--border-subtle)",
              color: campaignFilter === "All Campaigns" ? "var(--ink-muted)" : "var(--ink)",
              outline: "none",
            }}
          >
            <option value="All Campaigns">All Campaigns</option>
            {uniqueCampaigns.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <Image
            src="/icons/dropdown-chevron.png"
            alt="Expand"
            width={12}
            height={12}
            className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
          />
        </div>

        {/* University dropdown */}
        <div className="relative">
          <select
            value={universityFilter}
            onChange={(e) => setUniversityFilter(e.target.value)}
            className="appearance-none text-xs rounded-lg border pl-2.5 pr-7 py-1.5 cursor-pointer"
            style={{
              background: "var(--bg-card)",
              borderColor: "var(--border-subtle)",
              color: universityFilter === "All Universities" ? "var(--ink-muted)" : "var(--ink)",
              outline: "none",
            }}
          >
            <option value="All Universities">All Universities</option>
            {uniqueUniversities.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
          <Image
            src="/icons/dropdown-chevron.png"
            alt="Expand"
            width={12}
            height={12}
            className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
          />
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-0.5 mb-3">
        {STATUS_TABS.map((tab) => {
          const active = statusFilter === tab;
          return (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className="text-xs font-medium px-2.5 py-1 rounded-md transition-colors duration-100"
              style={{
                background: active ? "var(--accent-muted)" : "transparent",
                color: active ? "var(--accent-hover)" : "var(--ink-muted)",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.color = "var(--ink-secondary)";
                  e.currentTarget.style.background = "var(--bg-elevated)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.color = "var(--ink-muted)";
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{
          background: "var(--bg-card)",
          borderColor: "var(--border-subtle)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-3 border-b"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <h2 className="text-xs font-semibold" style={{ color: "var(--ink)" }}>
            All Outreach
          </h2>
          <span className="text-xs" style={{ color: "var(--ink-muted)" }}>
            {filtered.length} email{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                {COLUMNS.map(({ key, label }) => {
                  const active = sortCol === key;
                  return (
                    <th
                      key={key}
                      onClick={() => handleSort(key)}
                      className="group px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest cursor-pointer select-none transition-colors duration-100"
                      style={{ color: active ? "var(--ink-secondary)" : "var(--ink-muted)" }}
                    >
                      <span className="flex items-center gap-1">
                        {label}
                        {active ? (
                          sortDir === "asc" ? (
                            <Image src="/icons/sort.png" alt="Sort" width={12} height={12} className="flex-shrink-0" />
                          ) : (
                            <Image src="/icons/sort.png" alt="Sort" width={12} height={12} className="flex-shrink-0" />
                          )
                        ) : (
                          <Image src="/icons/sort.png" alt="Sort" width={12} height={12} className="flex-shrink-0 opacity-0 group-hover:opacity-40 transition-opacity" />
                        )}
                      </span>
                    </th>
                  );
                })}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-10 text-center text-xs"
                    style={{ color: "var(--ink-muted)" }}
                  >
                    No emails match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((email, i) => (
                  <tr
                    key={email.id}
                    onClick={() => setSelectedEmail(email)}
                    className="group cursor-pointer transition-colors duration-100 hover:bg-[#F1F6F9]"
                    style={{
                      borderBottom: i < filtered.length - 1 ? "1px solid var(--border-subtle)" : "none",
                    }}
                  >
                    <td className="px-5 py-3">
                      <span className="text-xs font-medium" style={{ color: "var(--ink)" }}>
                        {email.professor}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs" style={{ color: "var(--ink-secondary)" }}>
                        {email.university}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs" style={{ color: "var(--ink-secondary)" }}>
                        {email.department}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className="text-[10px] font-medium px-2 py-0.5 rounded-md"
                        style={{ background: "var(--accent-muted)", color: "var(--accent-hover)" }}
                      >
                        {email.campaign}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs tabular-nums" style={{ color: "var(--ink-secondary)" }}>
                        {email.dateSent}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={email.status} />
                    </td>
                    <td className="pr-4 py-3">
                      <ChevronRight
                        className="w-3.5 h-3.5 transition-colors duration-100"
                        style={{ color: "var(--border-default)" }}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </div>

    {/* Right: sliding detail panel */}
    <div
      ref={panelRef}
      className="flex-shrink-0 overflow-hidden"
      style={{
        width: selectedEmail ? "400px" : "0px",
        transition: "width 0.28s cubic-bezier(0.4,0,0.2,1)",
        borderLeft: selectedEmail ? "1px solid var(--border-subtle)" : "none",
        background: "var(--bg-card)",
        boxShadow: selectedEmail ? "-6px 0 24px rgba(0,0,0,0.05)" : "none",
      }}
    >
      {selectedEmail && (
        <div className="flex flex-col h-full" style={{ width: "400px" }}>
          {/* Panel header */}
          <div
            className="flex-shrink-0 flex items-start justify-between px-5 py-4 border-b"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: "var(--bg-elevated)", color: "var(--ink-secondary)" }}
              >
                {selectedEmail.professor.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>
                  {selectedEmail.professor}
                </h3>
                <p className="text-xs truncate" style={{ color: "var(--ink-muted)" }}>
                  {selectedEmail.department} · {selectedEmail.university}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedEmail(null)}
              className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ml-3 transition-colors"
              style={{ color: "var(--ink-muted)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-elevated)"; e.currentTarget.style.color = "var(--ink)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--ink-muted)"; }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Status + date */}
          <div
            className="flex-shrink-0 flex items-center gap-3 px-5 py-2.5 border-b"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <StatusBadge status={selectedEmail.status} />
            <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--ink-muted)" }}>
              <Image src="/icons/calendar.png" alt="Calendar" width={12} height={12} />
              {selectedEmail.dateSent}
            </span>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Email sent */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-2.5" style={{ color: "var(--ink-muted)" }}>
                Email Sent
              </p>
              <div className="rounded-lg border overflow-hidden" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}>
                <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: "var(--border-subtle)" }}>
                  <span className="text-xs font-semibold" style={{ color: "var(--ink)" }}>You</span>
                  <span className="text-xs" style={{ color: "var(--ink-muted)" }}>{selectedEmail.dateSent}</span>
                </div>
                <div className="px-4 pt-2.5 pb-1">
                  <p className="text-xs font-medium pb-2.5 mb-2.5 border-b" style={{ color: "var(--ink-secondary)", borderColor: "var(--border-subtle)" }}>
                    {selectedEmail.subject}
                  </p>
                  <p className="text-xs leading-6 whitespace-pre-wrap pb-3" style={{ color: "var(--ink-secondary)" }}>
                    {selectedEmail.body}
                  </p>
                </div>
              </div>
            </div>

            {/* Reply */}
            {selectedEmail.reply && (() => {
              const rs = panelReplyStyle(selectedEmail.status);
              return (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-2.5" style={{ color: "var(--ink-muted)" }}>
                    Reply
                  </p>
                  <div className="rounded-lg border overflow-hidden" style={{ background: rs.bg, borderColor: rs.border }}>
                    <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: rs.border }}>
                      <span className="text-xs font-semibold" style={{ color: rs.name }}>{selectedEmail.professor}</span>
                      <span className="text-xs" style={{ color: "var(--ink-muted)" }}>{selectedEmail.reply.date}</span>
                    </div>
                    <div className="px-4 pt-2.5 pb-3">
                      <p className="text-xs leading-6 whitespace-pre-wrap" style={{ color: "var(--ink-secondary)" }}>
                        {selectedEmail.reply.body}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
