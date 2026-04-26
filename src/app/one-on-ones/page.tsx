"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const YEAR = 2026;

interface LoggedEntry {
  id: string;
  date: string;
  durationMinutes: number | null;
  mood: string | null;
  happinessIndex: number | null;
  topicsDiscussed: string;
  source: string;
}

interface MonthCell {
  monthKey: string;
  label: string;
  state: "logged" | "missed" | "current" | "upcoming";
  logged: LoggedEntry | null;
  isPast: boolean;
  isCurrent: boolean;
  isFuture: boolean;
}

interface DesignerRow {
  designerId: string;
  fullName: string;
  productArea: string;
  level: string;
  months: MonthCell[];
}

interface Month {
  key: string;
  label: string;
  month: number;
  year: number;
}

interface MatrixData {
  rows: DesignerRow[];
  months: Month[];
  year: number;
}

// ─── Cell appearance ──────────────────────────────────────────────────────────

function cellStyle(cell: MonthCell, hovered: boolean) {
  if (cell.state === "logged") {
    return {
      background: hovered ? "rgba(52,199,89,0.20)" : "rgba(52,199,89,0.12)",
      border: "1px solid rgba(52,199,89,0.30)",
      color: "#1a7a32",
    };
  }
  if (cell.state === "missed") {
    return {
      background: hovered ? "rgba(255,59,48,0.10)" : "rgba(255,59,48,0.06)",
      border: "1px solid rgba(255,59,48,0.20)",
      color: "#c0392b",
    };
  }
  if (cell.state === "current") {
    return {
      background: hovered ? "rgba(0,122,255,0.12)" : "rgba(0,122,255,0.07)",
      border: "1px solid rgba(0,122,255,0.25)",
      color: "#007AFF",
    };
  }
  // upcoming
  return {
    background: hovered ? "rgba(0,0,0,0.04)" : "transparent",
    border: "1px solid rgba(0,0,0,0.07)",
    color: "rgba(60,60,67,0.35)",
  };
}

function moodEmoji(mood: string | null) {
  const map: Record<string, string> = { down: "😔", flat: "😐", steady: "🙂", up: "😊", energized: "⚡" };
  return mood ? (map[mood] ?? "") : "";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Tooltip / popover on hover ───────────────────────────────────────────────

function CellTooltip({ cell, name }: { cell: MonthCell; name: string }) {
  if (cell.state === "upcoming") return null;
  return (
    <div
      className="absolute z-50 bottom-full left-1/2 mb-2 w-52 rounded-xl shadow-lg pointer-events-none"
      style={{
        transform: "translateX(-50%)",
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(0,0,0,0.08)",
        padding: "10px 12px",
      }}
    >
      <p className="text-xs font-semibold text-zinc-900 mb-1">{name} · {cell.label}</p>
      {cell.logged ? (
        <>
          <p className="text-xs text-zinc-500">{fmtDate(cell.logged.date)}{cell.logged.durationMinutes ? ` · ${cell.logged.durationMinutes}m` : ""}</p>
          {cell.logged.mood && <p className="text-xs text-zinc-500 mt-0.5">{moodEmoji(cell.logged.mood)} {cell.logged.mood}</p>}
          {cell.logged.happinessIndex && <p className="text-xs text-zinc-500">Happiness: {cell.logged.happinessIndex}/10</p>}
          <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{cell.logged.topicsDiscussed}</p>
        </>
      ) : (
        <p className="text-xs text-zinc-400">{cell.state === "missed" ? "Not logged — click to add" : "Current month — click to log"}</p>
      )}
    </div>
  );
}

// ─── Single cell ─────────────────────────────────────────────────────────────

function Cell({ cell, designer, onClick }: { cell: MonthCell; designer: DesignerRow; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const style = cellStyle(cell, hovered);
  const clickable = cell.state !== "upcoming";

  return (
    <td className="px-1 py-1.5" style={{ minWidth: 52 }}>
      <div className="relative flex justify-center">
        <button
          onClick={clickable ? onClick : undefined}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          disabled={!clickable}
          className="w-10 h-10 rounded-xl flex flex-col items-center justify-center transition-all text-center"
          style={{ ...style, cursor: clickable ? "pointer" : "default" }}
          title={cell.state}
        >
          {cell.logged ? (
            <>
              <span className="text-[9px] font-bold leading-none">{cell.logged.happinessIndex ?? "✓"}</span>
              {cell.logged.mood && <span className="text-[8px] leading-none mt-0.5">{moodEmoji(cell.logged.mood)}</span>}
            </>
          ) : cell.state === "missed" ? (
            <span className="text-[10px] font-bold">—</span>
          ) : cell.state === "current" ? (
            <span className="text-[9px] font-semibold">now</span>
          ) : (
            <span className="text-[9px] opacity-40">·</span>
          )}
        </button>
        {hovered && clickable && <CellTooltip cell={cell} name={designer.fullName.split(" ")[0]} />}
      </div>
    </td>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function OneOnOnesPage() {
  const router = useRouter();
  const [data, setData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/one-on-ones/matrix?year=${YEAR}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  function handleCellClick(designer: DesignerRow, cell: MonthCell) {
    if (cell.logged) {
      // View existing 1:1
      router.push(`/one-on-ones/${cell.logged.id}`);
      return;
    }
    // Pre-fill log form: pick the 15th of that month as default date
    const [y, m] = cell.monthKey.split("-").map(Number);
    const defaultDate = new Date(y, m - 1, 15).toISOString().slice(0, 10);
    router.push(`/one-on-ones/new?designer=${designer.designerId}&date=${defaultDate}`);
  }

  const now = new Date();
  const currentMonthIdx = now.getMonth(); // 0-indexed

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">1:1 Calendar</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Monthly catch-ups · {YEAR} · click any cell to log or view</p>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-4">
          {[
            { color: "rgba(52,199,89,0.15)", border: "rgba(52,199,89,0.3)", label: "Logged" },
            { color: "rgba(255,59,48,0.08)", border: "rgba(255,59,48,0.2)", label: "Missed" },
            { color: "rgba(0,122,255,0.10)", border: "rgba(0,122,255,0.25)", label: "Current" },
            { color: "transparent", border: "rgba(0,0,0,0.08)", label: "Upcoming" },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-md" style={{ background: l.color, border: `1px solid ${l.border}` }} />
              <span className="text-xs text-zinc-500">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-400 py-12 text-center">Loading…</p>
      ) : !data ? (
        <p className="text-sm text-zinc-400 py-12 text-center">Failed to load.</p>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                {/* Designer column */}
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide sticky left-0 bg-white z-10 min-w-[160px]">
                  Designer
                </th>
                {data.months.map((m, idx) => (
                  <th
                    key={m.key}
                    className="text-center px-1 py-3 text-xs font-semibold uppercase tracking-wide"
                    style={{
                      color: idx === currentMonthIdx ? "#007AFF" : "rgba(60,60,67,0.45)",
                      minWidth: 52,
                    }}
                  >
                    {m.label}
                  </th>
                ))}
                <th className="text-center px-3 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide min-w-[60px]">Done</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((designer, ri) => {
                const loggedCount = designer.months.filter((m) => m.logged).length;
                const pastMonths = designer.months.filter((m) => m.isPast || m.isCurrent).length;

                return (
                  <tr
                    key={designer.designerId}
                    style={ri < data.rows.length - 1 ? { borderBottom: "1px solid rgba(0,0,0,0.05)" } : {}}
                    className="hover:bg-zinc-50/50 transition-colors"
                  >
                    {/* Name */}
                    <td className="px-4 py-2 sticky left-0 bg-white z-10" style={{ borderRight: "1px solid rgba(0,0,0,0.05)" }}>
                      <p className="font-medium text-zinc-900 text-sm">{designer.fullName}</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5 capitalize">{designer.productArea.replace(/_/g, " ")}</p>
                    </td>

                    {/* Month cells */}
                    {designer.months.map((cell) => (
                      <Cell
                        key={cell.monthKey}
                        cell={cell}
                        designer={designer}
                        onClick={() => handleCellClick(designer, cell)}
                      />
                    ))}

                    {/* Completion count */}
                    <td className="px-3 py-2 text-center">
                      <span className="text-xs font-semibold text-zinc-500">
                        {loggedCount}
                        <span className="text-zinc-300 font-normal">/{pastMonths}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Footer summary row */}
            <tfoot>
              <tr style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                <td className="px-4 py-2 sticky left-0 bg-zinc-50/80 z-10">
                  <p className="text-xs font-semibold text-zinc-500">Team total</p>
                </td>
                {data.months.map((m, idx) => {
                  const logged = data.rows.filter((r) => r.months[idx]?.logged).length;
                  const total = data.rows.length;
                  const isPast = idx <= currentMonthIdx;
                  return (
                    <td key={m.key} className="px-1 py-2 text-center bg-zinc-50/80">
                      {isPast ? (
                        <span className="text-[10px] font-semibold" style={{ color: logged === total ? "#34c759" : logged > 0 ? "#ff9500" : "#c0392b" }}>
                          {logged}/{total}
                        </span>
                      ) : (
                        <span className="text-[10px] text-zinc-300">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-center bg-zinc-50/80">
                  <span className="text-xs font-semibold text-zinc-500">
                    {data.rows.reduce((sum, r) => sum + r.months.filter((m) => m.logged).length, 0)}
                    <span className="text-zinc-300 font-normal">
                      /{data.rows.reduce((sum, r) => sum + r.months.filter((m) => m.isPast || m.isCurrent).length, 0)}
                    </span>
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
