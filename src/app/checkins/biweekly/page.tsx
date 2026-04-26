"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";

interface DesignerRow {
  id: string;
  fullName: string;
  title: string;
  checkinId: string | null;
  status: string;
  sectionsTouched: number;
  completedOn: string | null;
}

interface OverviewData {
  biweekStart: string;
  biweekEnd: string;
  daysRemaining: number;
  completionRate: number;
  designers: DesignerRow[];
}

function statusColor(s: string) {
  if (s === "complete") return "bg-green-100 text-green-800 border-green-200";
  if (s === "in_progress") return "bg-blue-100 text-blue-800 border-blue-200";
  if (s === "overdue") return "bg-red-100 text-red-800 border-red-200";
  if (s === "skipped") return "bg-muted text-muted-foreground";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function BiweeklyOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/checkins/biweekly")
      .then((r) => r.json())
      .then(setData)
      .catch(() => toast.error("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runReminders() {
    setRunning(true);
    try {
      const res = await fetch("/api/cron/biweekly-reminders", { method: "POST" });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Failed"); return; }
      toast.success(`Created ${json.created} new rows, marked ${json.markedOverdue} overdue.`);
      load();
    } catch (err) {
      toast.error(String(err));
    } finally { setRunning(false); }
  }

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!data) return <div className="p-8 text-sm text-muted-foreground">Failed to load.</div>;

  const complete = data.designers.filter((d) => d.status === "complete").length;
  const overdue = data.designers.filter((d) => d.status === "overdue").length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Biweekly check-ins</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {fmtDate(data.biweekStart)} – {fmtDate(data.biweekEnd)} · {data.daysRemaining} days remaining
          </p>
        </div>
        <button onClick={runReminders} disabled={running} className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-colors">
          {running ? "Running…" : "Sync biweeks"}
        </button>
      </div>

      {/* Progress card */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-zinc-900">{complete} of {data.designers.length} complete</span>
          <span className="text-zinc-500 font-medium">{data.completionRate}%</span>
        </div>
        <div className="w-full bg-zinc-100 rounded-full h-1.5">
          <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${data.completionRate}%` }} />
        </div>
        {overdue > 0 && (
          <p className="text-xs text-red-600 font-medium">{overdue} overdue from previous biweek</p>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Designer</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Sections</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Completed</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {data.designers.map((d, i) => (
              <tr key={d.id} style={i < data.designers.length - 1 ? { borderBottom: "1px solid rgba(0,0,0,0.05)" } : {}} className="hover:bg-zinc-50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-zinc-900">{d.fullName}</p>
                  <p className="text-xs text-zinc-400">{d.title}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${statusColor(d.status)}`}>
                    {d.status.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-zinc-500">
                  {d.status !== "upcoming" ? `${d.sectionsTouched} / 13` : "—"}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-500">
                  {d.completedOn ? fmtDate(d.completedOn) : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/checkins/biweekly/${d.id}`} className="text-xs font-medium text-zinc-500 hover:text-blue-600 transition-colors">
                    {d.status === "complete" ? "View" : "Start →"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
