"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, Cell, Legend,
} from "recharts";

// ── Types ────────────────────────────────────────────────────────────────────

interface TeamReport {
  impactHeatmap: Record<string, number | string>[];
  sentimentTrend: { week: string; positive: number; negative: number; neutral: number }[];
  happinessByDesigner: { name: string; designerId: string; avg: number | null; count: number }[];
  riskChart: { name: string; designerId: string; high: number; med: number; low: number; total: number }[];
  actionsByDesigner: { name: string; designerId: string; open: number; overdue: number }[];
  concernsChart: { theme: string; count: number; high: number }[];
  communityByDesigner: { name: string; designerId: string; count: number }[];
  highlightsData: { kind: string; count: number }[];
  biweeklyChart: { name: string; designerId: string; complete: number; total: number; rate: number }[];
  currentBiweekRate: number;
  cycleHealth: { cycleId: string; total: number; signedOff: number; rate: number }[];
  summary: {
    teamSize: number;
    impactEntriesThisQuarter: number;
    topDimension: string;
    positiveFeedbackRate: number;
    averageHappiness: number | null;
    openRisks: number;
    highSeverityRisks: number;
    overdueActions: number;
    biweeklyCompletionRate: number;
    teamConcernCount: number;
    topConcernTheme: string | null;
    cycleReviewSignOffRate: number | null;
  };
  recentWins: string[];
  designersNeedingAttention: string[];
}

interface Narrative {
  title: string;
  narrative: string;
  aiDisabled?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const RISK_COLORS = { high: "#ef4444", med: "#f59e0b", low: "#6b7280" };
const SENTIMENT_COLORS = { positive: "#22c55e", negative: "#ef4444", neutral: "#94a3b8" };
const pct = (n: number) => `${Math.round(n * 100)}%`;
const dim = (s: string) => s.replace(/_/g, " ");

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-4">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-zinc-900">{value}</p>
      {sub && <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <h2 className="text-base font-semibold text-zinc-800 mb-3">{title}</h2>;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [report, setReport] = useState<TeamReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [narrativeState, setNarrativeState] = useState<"idle" | "loading" | "done">("idle");
  const [narrative, setNarrative] = useState<Narrative | null>(null);
  const [happinessTrend, setHappinessTrend] = useState<"up" | "flat" | "down" | "mixed">("flat");

  useEffect(() => {
    fetch("/api/reports/team")
      .then((r) => r.json())
      .then((res) => {
        setReport(res.data);
        // derive happiness trend from happinessByDesigner data
        const avgs = res.data.happinessByDesigner
          .map((d: { avg: number | null }) => d.avg)
          .filter((v: number | null): v is number => v !== null);
        if (avgs.length < 2) {
          setHappinessTrend("flat");
        } else {
          const mid = Math.floor(avgs.length / 2);
          const firstHalf = avgs.slice(0, mid).reduce((a: number, b: number) => a + b, 0) / mid;
          const secondHalf = avgs.slice(mid).reduce((a: number, b: number) => a + b, 0) / (avgs.length - mid);
          const diff = secondHalf - firstHalf;
          setHappinessTrend(Math.abs(diff) < 0.3 ? "flat" : diff > 0 ? "up" : "down");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function generateNarrative() {
    if (!report) return;
    setNarrativeState("loading");
    try {
      const res = await fetch("/api/reports/narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamSize: report.summary.teamSize,
          reportDate: new Date().toISOString().slice(0, 10),
          metrics: { ...report.summary, happinessTrend },
          designersNeedingAttention: report.designersNeedingAttention,
          recentWins: report.recentWins,
        }),
      });
      const json = await res.json();
      setNarrative(json.data);
      setNarrativeState("done");
    } catch {
      setNarrativeState("idle");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <p className="text-zinc-500 text-sm">Loading team report…</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <p className="text-red-500 text-sm">Failed to load report data.</p>
      </div>
    );
  }

  const { summary } = report;

  return (
    <div className="min-h-screen bg-zinc-50 p-6 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Team Report</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {summary.teamSize} active designers · {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/api/export/designers"
            download
            className="px-4 py-2 text-sm font-medium rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            ↓ Export CSV
          </a>
          <button
            onClick={generateNarrative}
            disabled={narrativeState === "loading"}
            className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {narrativeState === "loading" ? "Generating…" : "Generate narrative"}
          </button>
        </div>
      </div>

      {/* Narrative panel */}
      {narrative && (
        <div className="bg-white border border-zinc-200 rounded-xl p-6">
          <h2 className="font-semibold text-zinc-900 mb-3">{narrative.title}</h2>
          {narrative.narrative.split("\n\n").map((para, i) => (
            <p key={i} className="text-sm text-zinc-700 leading-relaxed mb-3 last:mb-0">
              {para}
            </p>
          ))}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Impact entries (QTD)" value={summary.impactEntriesThisQuarter} sub={`Top: ${dim(summary.topDimension)}`} />
        <StatCard label="Positive feedback" value={pct(summary.positiveFeedbackRate)} />
        <StatCard
          label="Avg happiness"
          value={summary.averageHappiness !== null ? `${summary.averageHappiness.toFixed(1)}/10` : "—"}
        />
        <StatCard label="Open risks" value={summary.openRisks} sub={`${summary.highSeverityRisks} high severity`} />
        <StatCard label="Overdue actions" value={summary.overdueActions} sub="Ravi owes designers" />
        <StatCard label="Biweekly completion" value={pct(summary.biweeklyCompletionRate)} />
        <StatCard label="Team concerns" value={summary.teamConcernCount} sub={summary.topConcernTheme ? `Top: ${dim(summary.topConcernTheme)}` : undefined} />
        <StatCard
          label="Cycle sign-offs"
          value={summary.cycleReviewSignOffRate !== null ? pct(summary.cycleReviewSignOffRate) : "—"}
        />
      </div>

      {/* Row 1: Impact heatmap + Sentiment trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <SectionHeader title="Impact by dimension & magnitude" />
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={report.impactHeatmap} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="dimension" type="category" tick={{ fontSize: 11 }} tickFormatter={dim} width={110} />
              <Tooltip formatter={(v: unknown, name: unknown) => [String(v), dim(String(name))]} />
              <Bar dataKey="small" stackId="a" fill="#bfdbfe" name="small" />
              <Bar dataKey="meaningful" stackId="a" fill="#60a5fa" name="meaningful" />
              <Bar dataKey="significant" stackId="a" fill="#2563eb" name="significant" />
              <Bar dataKey="exceptional" stackId="a" fill="#1e3a8a" name="exceptional" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <SectionHeader title="Feedback sentiment (90 days)" />
          {report.sentimentTrend.length === 0 ? (
            <p className="text-sm text-zinc-400 mt-8 text-center">No feedback recorded in the last 90 days.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={report.sentimentTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="positive" stackId="1" stroke={SENTIMENT_COLORS.positive} fill={SENTIMENT_COLORS.positive} fillOpacity={0.6} />
                <Area type="monotone" dataKey="neutral" stackId="1" stroke={SENTIMENT_COLORS.neutral} fill={SENTIMENT_COLORS.neutral} fillOpacity={0.4} />
                <Area type="monotone" dataKey="negative" stackId="1" stroke={SENTIMENT_COLORS.negative} fill={SENTIMENT_COLORS.negative} fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Row 2: Happiness + Risk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <SectionHeader title="Happiness index by designer" />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={report.happinessByDesigner}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: unknown) => [typeof v === "number" ? v.toFixed(1) : "—", "avg happiness"]} />
              <Bar dataKey="avg" name="avg happiness" radius={[4, 4, 0, 0]}>
                {report.happinessByDesigner.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={
                      entry.avg === null
                        ? "#e2e8f0"
                        : entry.avg >= 7
                        ? "#22c55e"
                        : entry.avg >= 5
                        ? "#f59e0b"
                        : "#ef4444"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <SectionHeader title="Open risks by designer" />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={report.riskChart.filter((d) => d.total > 0)}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="high" stackId="r" fill={RISK_COLORS.high} name="high" />
              <Bar dataKey="med" stackId="r" fill={RISK_COLORS.med} name="med" />
              <Bar dataKey="low" stackId="r" fill={RISK_COLORS.low} name="low" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {report.riskChart.every((d) => d.total === 0) && (
            <p className="text-sm text-zinc-400 text-center mt-4">No open risks.</p>
          )}
        </div>
      </div>

      {/* Row 3: Actions + Concerns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <SectionHeader title="Action items by designer" />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={report.actionsByDesigner.filter((d) => d.open > 0)}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="open" fill="#60a5fa" name="open" radius={[4, 4, 0, 0]} />
              <Bar dataKey="overdue" fill="#ef4444" name="overdue" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {report.actionsByDesigner.every((d) => d.open === 0) && (
            <p className="text-sm text-zinc-400 text-center mt-4">No open action items.</p>
          )}
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <SectionHeader title="Team concerns by theme" />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={report.concernsChart.filter((d) => d.count > 0)} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis dataKey="theme" type="category" tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#a78bfa" name="total" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {report.concernsChart.every((d) => d.count === 0) && (
            <p className="text-sm text-zinc-400 text-center mt-4">No team concerns recorded.</p>
          )}
        </div>
      </div>

      {/* Row 4: Community + Highlights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <SectionHeader title="Community activities (QTD)" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={report.communityByDesigner}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#34d399" name="activities" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <SectionHeader title="Highlights by kind (QTD)" />
          {report.highlightsData.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center mt-8">No highlights recorded this quarter.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={report.highlightsData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="kind" tick={{ fontSize: 10 }} tickFormatter={dim} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={(v: unknown, _n: unknown, props: { payload?: { kind: string } }) => [String(v), dim(props.payload?.kind ?? "")]} />
                <Bar dataKey="count" fill="#f472b6" name="count" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Row 5: Biweekly + Cycle health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <SectionHeader title={`Biweekly check-in completion · ${pct(report.currentBiweekRate)} this period`} />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={report.biweeklyChart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="complete" fill="#22c55e" name="complete" />
              <Bar dataKey="total" fill="#e2e8f0" name="total" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <SectionHeader title="Cycle review sign-off rate" />
          {report.cycleHealth.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center mt-8">No review cycles found.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={report.cycleHealth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="cycleId" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 1]} tickFormatter={pct} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: unknown) => [typeof v === "number" ? pct(v) : "—", "sign-off rate"]} />
                <Line type="monotone" dataKey="rate" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent wins */}
      {report.recentWins.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <SectionHeader title="Recent standout wins" />
          <ul className="space-y-2">
            {report.recentWins.map((win, i) => (
              <li key={i} className="text-sm text-zinc-700 flex gap-2">
                <span className="text-zinc-300">›</span>
                <span>{win}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
