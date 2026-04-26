"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

interface ActionItem {
  id: string;
  description: string;
  dueDate: string | null;
  status: string;
  snoozedUntil: string | null;
  designerId: string | null;
  designerName: string | null;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

export default function MyActionsPage() {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupByDesigner, setGroupByDesigner] = useState(false);
  const [sortKey, setSortKey] = useState<"dueDate" | "designer">("dueDate");

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/action-items")
      .then((r) => r.json())
      .then((d) => setItems(d.data ?? []))
      .catch(() => toast.error("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function patch(id: string, body: object) {
    const res = await fetch(`/api/action-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) { toast.error("Update failed"); return; }
    toast.success("Updated");
    load();
  }

  const open = items.filter((a) => a.status === "open" || a.status === "in_progress" || a.status === "snoozed");
  const overdueCount = open.filter((a) => isOverdue(a.dueDate)).length;

  const sorted = [...open].sort((a, b) => {
    if (sortKey === "dueDate") {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    return (a.designerName ?? "").localeCompare(b.designerName ?? "");
  });

  // Group by designer
  const grouped = groupByDesigner
    ? sorted.reduce<Record<string, ActionItem[]>>((acc, item) => {
        const key = item.designerName ?? "Unassigned";
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
      }, {})
    : null;

  function renderRow(item: ActionItem, i: number, arr: ActionItem[]) {
    const overdue = isOverdue(item.dueDate);
    return (
      <tr key={item.id} style={i < arr.length - 1 ? { borderBottom: "1px solid rgba(0,0,0,0.05)" } : {}} className="hover:bg-zinc-50 transition-colors">
        <td className="px-4 py-3">
          <Checkbox
            checked={item.status === "done"}
            onCheckedChange={(v) => patch(item.id, { status: v ? "done" : "open" })}
          />
        </td>
        <td className="px-4 py-3 max-w-xs">
          <span className={item.status === "done" ? "line-through text-zinc-400" : "font-medium text-zinc-900"}>{item.description}</span>
        </td>
        <td className="px-4 py-3">
          {item.designerId ? (
            <Link href={`/designers/${item.designerId}`} className="text-xs text-zinc-500 hover:text-blue-600 transition-colors">{item.designerName}</Link>
          ) : <span className="text-zinc-400 text-xs">—</span>}
        </td>
        <td className="px-4 py-3">
          {item.dueDate ? (
            <span className={`text-xs font-medium ${overdue ? "text-red-600" : "text-zinc-500"}`}>
              {overdue ? "⚠ " : ""}{fmtDate(item.dueDate)}
            </span>
          ) : <span className="text-xs text-zinc-400">—</span>}
        </td>
        <td className="px-4 py-3">
          <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${item.status === "snoozed" ? "bg-amber-50 text-amber-700" : "bg-zinc-100 text-zinc-600"}`}>{item.status}</span>
        </td>
        <td className="px-4 py-3">
          <div className="flex gap-1">
            <button className="px-2 py-0.5 text-xs text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded-md transition-colors" onClick={() => patch(item.id, { snoozeDays: 3 })}>+3d</button>
            <button className="px-2 py-0.5 text-xs text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded-md transition-colors" onClick={() => patch(item.id, { snoozeDays: 7 })}>+7d</button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">My actions</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {open.length} open{overdueCount > 0 ? <span className="text-red-600 font-medium"> · {overdueCount} overdue</span> : ""}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <label className="flex items-center gap-1.5 text-sm text-zinc-600 cursor-pointer">
            <Checkbox checked={groupByDesigner} onCheckedChange={(v) => setGroupByDesigner(!!v)} />
            Group by designer
          </label>
          <select className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-800 outline-none focus:ring-2 focus:ring-blue-500/30" value={sortKey} onChange={(e) => setSortKey(e.target.value as "dueDate" | "designer")}>
            <option value="dueDate">Sort by due date</option>
            <option value="designer">Sort by designer</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-400 py-8 text-center">Loading…</p>
      ) : open.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-10 text-center">
          <p className="text-zinc-400 text-sm">All caught up. ✓</p>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                <th className="px-4 py-3 w-8"></th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Action</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Designer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Due</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Snooze</th>
              </tr>
            </thead>
            <tbody>
              {grouped
                ? Object.entries(grouped).map(([name, group]) => (
                    <>
                      <tr key={`group-${name}`} style={{ borderBottom: "1px solid rgba(0,0,0,0.05)", background: "rgba(0,0,0,0.02)" }}>
                        <td colSpan={6} className="px-4 py-2 text-xs font-semibold text-zinc-500">{name}</td>
                      </tr>
                      {group.map(renderRow)}
                    </>
                  ))
                : sorted.map((item, i, arr) => renderRow(item, i, arr))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
