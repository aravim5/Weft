"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface DesignerRow {
  id: string;
  fullName: string;
  level: string;
  productArea: string;
  currentStatus: string;
  startDate: string;
  openRisks: number;
  positiveFeedbackThisQuarter: number;
  impactEntriesThisQuarter: number;
  activeProjects: number;
  cycleReviewStatus: string | null;
  lastBiweeklyDate: string | null;
  happinessTrend: "up" | "flat" | "down" | null;
  overdueActions: number;
}

type SortKey = keyof DesignerRow;

function trendArrow(t: DesignerRow["happinessTrend"]) {
  if (t === "up") return <span className="text-green-600 text-base">↗</span>;
  if (t === "down") return <span className="text-red-500 text-base">↘</span>;
  if (t === "flat") return <span className="text-muted-foreground text-base">→</span>;
  return "—";
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function DesignersPage() {
  const [rows, setRows] = useState<DesignerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("fullName");
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    fetch("/api/designers/index")
      .then((r) => r.json())
      .then((d) => setRows(d.designers ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleSort(key: SortKey) {
    if (key === sortKey) { setSortAsc((v) => !v); } else { setSortKey(key); setSortAsc(true); }
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortAsc ? cmp : -cmp;
  });

  function Th({ k, label }: { k: SortKey; label: string }) {
    return (
      <th
        className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap hover:text-zinc-600 transition-colors"
        onClick={() => handleSort(k)}
      >
        {label} {sortKey === k ? (sortAsc ? "↑" : "↓") : ""}
      </th>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Designers</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{rows.length} active</p>
        </div>
        <Link href="/ingest/form">
          <button className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors">
            + Add designer
          </button>
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-400 py-8 text-center">Loading…</p>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                <Th k="fullName" label="Name" />
                <Th k="level" label="Level" />
                <Th k="productArea" label="Area" />
                <Th k="activeProjects" label="Projects" />
                <Th k="impactEntriesThisQuarter" label="Impact" />
                <Th k="positiveFeedbackThisQuarter" label="Feedback +" />
                <Th k="openRisks" label="Risks" />
                <Th k="cycleReviewStatus" label="Review" />
                <Th k="lastBiweeklyDate" label="Biweekly" />
                <Th k="happinessTrend" label="Mood" />
                <Th k="overdueActions" label="Overdue" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((d, i) => (
                <tr
                  key={d.id}
                  style={i < sorted.length - 1 ? { borderBottom: "1px solid rgba(0,0,0,0.05)" } : {}}
                  className="hover:bg-zinc-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link href={`/designers/${d.id}`} className="font-medium text-zinc-900 hover:text-blue-600 transition-colors">{d.fullName}</Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs font-medium">{d.level}</td>
                  <td className="px-4 py-3 text-zinc-600 text-xs capitalize">{d.productArea.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3">
                    {d.activeProjects > 0
                      ? <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-zinc-100 text-zinc-600">{d.activeProjects}</span>
                      : <span className="text-zinc-400 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {d.impactEntriesThisQuarter > 0
                      ? <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-blue-50 text-blue-700">{d.impactEntriesThisQuarter}</span>
                      : <span className="text-zinc-400 text-xs">0</span>}
                  </td>
                  <td className="px-4 py-3">
                    {d.positiveFeedbackThisQuarter > 0
                      ? <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-green-50 text-green-700">{d.positiveFeedbackThisQuarter}</span>
                      : <span className="text-zinc-400 text-xs">0</span>}
                  </td>
                  <td className="px-4 py-3">
                    {d.openRisks > 0
                      ? <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-red-50 text-red-700">{d.openRisks}</span>
                      : <span className="text-zinc-400 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {d.cycleReviewStatus
                      ? <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-zinc-100 text-zinc-600">{d.cycleReviewStatus}</span>
                      : <span className="text-zinc-400 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{fmtDate(d.lastBiweeklyDate)}</td>
                  <td className="px-4 py-3">{trendArrow(d.happinessTrend)}</td>
                  <td className="px-4 py-3">
                    {d.overdueActions > 0
                      ? <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-amber-50 text-amber-700">{d.overdueActions}</span>
                      : <span className="text-zinc-400 text-xs">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
