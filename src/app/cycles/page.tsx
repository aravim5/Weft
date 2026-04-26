"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface Cycle {
  id: string;
  year: number;
  quarter: string;
  checkinDate: string;
  outreachOpenOn: string;
  status: string;
  cycleReviews: { id: string; finalStatus: string; designerId: string }[];
  _count: { outreach: number };
}

function statusColor(s: string) {
  if (s === "complete") return "bg-green-100 text-green-800 border-green-200";
  if (s === "summarizing") return "bg-blue-100 text-blue-800 border-blue-200";
  if (s === "collecting") return "bg-amber-100 text-amber-800 border-amber-200";
  if (s === "outreach_sent") return "bg-purple-100 text-purple-800 border-purple-200";
  return "bg-muted text-muted-foreground";
}

function daysUntil(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function CyclesPage() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState({ year: new Date().getFullYear(), quarter: "Q2", checkinDate: "", outreachOpenOn: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/cycles")
      .then((r) => r.json())
      .then((d) => setCycles(d.data ?? []))
      .catch(() => toast.error("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  async function createCycle() {
    if (!form.checkinDate || !form.outreachOpenOn) { toast.error("Fill in all dates"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Failed"); return; }
      setCycles((prev) => [json.data, ...prev]);
      setNewOpen(false);
      toast.success(`${form.quarter} ${form.year} cycle created.`);
    } catch (err) { toast.error(String(err)); }
    finally { setSaving(false); }
  }

  const next = cycles.find((c) => c.status !== "complete");

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Review cycles</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Quarterly check-in workspaces</p>
        </div>
        <button onClick={() => setNewOpen(true)} className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors">+ New cycle</button>
      </div>

      {/* Next cycle countdown */}
      {next && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-zinc-900">Next up: {next.quarter} {next.year}</p>
            <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${statusColor(next.status)}`}>{next.status.replace(/_/g, " ")}</span>
          </div>
          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-xs text-zinc-400">Check-in date</p>
              <p className="font-semibold text-zinc-900 mt-0.5">{fmtDate(next.checkinDate)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400">Days remaining</p>
              <p className={`font-semibold mt-0.5 ${daysUntil(next.checkinDate) <= 14 ? "text-red-600" : "text-zinc-900"}`}>
                {daysUntil(next.checkinDate)}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-400">Reviews signed off</p>
              <p className="font-semibold text-zinc-900 mt-0.5">{next.cycleReviews.filter((r) => r.finalStatus === "signed_off").length} / {next.cycleReviews.length}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400">Outreach rows</p>
              <p className="font-semibold text-zinc-900 mt-0.5">{next._count.outreach}</p>
            </div>
          </div>
          <Link href={`/cycles/${next.id}`} className="inline-block px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors">
            Open workspace →
          </Link>
        </div>
      )}

      {/* All cycles */}
      {loading ? (
        <p className="text-sm text-zinc-400 py-8 text-center">Loading…</p>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Cycle</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Check-in date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Reviews</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Outreach</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {cycles.map((c, i) => (
                <tr key={c.id} style={i < cycles.length - 1 ? { borderBottom: "1px solid rgba(0,0,0,0.05)" } : {}} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-zinc-900">{c.quarter} {c.year}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${statusColor(c.status)}`}>{c.status.replace(/_/g, " ")}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{fmtDate(c.checkinDate)}</td>
                  <td className="px-4 py-3 text-xs text-zinc-600">
                    {c.cycleReviews.filter((r) => r.finalStatus === "signed_off").length}/{c.cycleReviews.length} signed off
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{c._count.outreach} rows</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/cycles/${c.id}`} className="text-xs font-medium text-zinc-500 hover:text-blue-600 transition-colors">Open →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={newOpen} onOpenChange={setNewOpen}>
        <SheetContent side="right" className="w-[400px]">
          <SheetHeader><SheetTitle>New review cycle</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-zinc-500 mb-1 block">Year</label>
                <input type="number" className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white text-zinc-900 outline-none focus:ring-2 focus:ring-blue-500/30" value={form.year}
                  onChange={(e) => setForm((f) => ({ ...f, year: parseInt(e.target.value) }))} />
              </div>
              <div className="flex-1">
                <label className="text-xs text-zinc-500 mb-1 block">Quarter</label>
                <select className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white text-zinc-900 outline-none focus:ring-2 focus:ring-blue-500/30" value={form.quarter}
                  onChange={(e) => setForm((f) => ({ ...f, quarter: e.target.value }))}>
                  {["Q1","Q2","Q3","Q4"].map((q) => <option key={q}>{q}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Outreach opens on</label>
              <input type="date" className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white text-zinc-900 outline-none focus:ring-2 focus:ring-blue-500/30" value={form.outreachOpenOn}
                onChange={(e) => setForm((f) => ({ ...f, outreachOpenOn: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Check-in date</label>
              <input type="date" className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white text-zinc-900 outline-none focus:ring-2 focus:ring-blue-500/30" value={form.checkinDate}
                onChange={(e) => setForm((f) => ({ ...f, checkinDate: e.target.value }))} />
            </div>
            <button onClick={createCycle} disabled={saving} className="w-full px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-50 transition-colors">{saving ? "Creating…" : "Create cycle"}</button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
