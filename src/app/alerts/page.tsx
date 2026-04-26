"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Alert, AlertSeverity, AlertType } from "@/app/api/alerts/route";

const TYPE_LABEL: Record<AlertType, string> = {
  no_one_on_one: "No 1:1",
  happiness_drop: "Happiness",
  overdue_action: "Overdue action",
  impact_gap: "Impact gap",
  stale_checkin: "Stale check-in",
  open_blocker: "Blocker",
  stale_risk: "Risk signal",
};

const SEVERITY_STYLE: Record<AlertSeverity, { dot: string; badge: string; row: string }> = {
  urgent: {
    dot: "bg-red-500",
    badge: "bg-red-50 text-red-700 border border-red-200",
    row: "border-l-2 border-l-red-400",
  },
  warning: {
    dot: "bg-amber-400",
    badge: "bg-amber-50 text-amber-700 border border-amber-200",
    row: "border-l-2 border-l-amber-400",
  },
  info: {
    dot: "bg-blue-400",
    badge: "bg-blue-50 text-blue-700 border border-blue-200",
    row: "border-l-2 border-l-blue-400",
  },
};

type Filter = "all" | AlertSeverity | AlertType;

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [counts, setCounts] = useState({ urgent: 0, warning: 0, info: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/alerts")
      .then((r) => r.json())
      .then((res) => {
        setAlerts(res.data ?? []);
        setCounts(res.counts ?? { urgent: 0, warning: 0, info: 0, total: 0 });
      })
      .finally(() => setLoading(false));
  }, []);

  const visible = alerts.filter((a) => {
    if (dismissed.has(a.id)) return false;
    if (filter === "all") return true;
    return a.severity === filter || a.type === filter;
  });

  const dismiss = (id: string) => setDismissed((prev) => new Set([...prev, id]));
  const dismissAll = () => setDismissed(new Set(alerts.map((a) => a.id)));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-zinc-500 text-sm">Computing alerts…</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Anomaly alerts</h1>
          <p className="text-sm text-zinc-500 mt-1">Auto-detected signals across your team</p>
        </div>
        {visible.length > 0 && (
          <button
            onClick={dismissAll}
            className="text-xs text-zinc-400 hover:text-zinc-600 mt-1"
          >
            Dismiss all
          </button>
        )}
      </div>

      {/* Summary chips */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "urgent", "warning", "info"] as const).map((f) => {
          const count =
            f === "all"
              ? counts.total - dismissed.size
              : alerts.filter((a) => a.severity === f && !dismissed.has(a.id)).length;
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1 rounded-full text-xs font-medium transition-all"
              style={
                active
                  ? { background: "rgba(0,122,255,0.12)", color: "#007AFF" }
                  : { background: "rgba(0,0,0,0.04)", color: "rgba(60,60,67,0.65)" }
              }
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)} {count > 0 && `· ${count}`}
            </button>
          );
        })}
      </div>

      {/* Alert list */}
      {visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-200 p-10 text-center">
          <p className="text-zinc-400 text-sm">
            {dismissed.size > 0 ? "All alerts dismissed for this session." : "No alerts — team looks healthy ✓"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((alert) => {
            const style = SEVERITY_STYLE[alert.severity];
            return (
              <div
                key={alert.id}
                className={`bg-white rounded-xl border border-zinc-200 px-4 py-3 flex items-start gap-3 ${style.row}`}
              >
                {/* Dot */}
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${style.dot}`} />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <Link
                      href={`/designers/${alert.designerId}`}
                      className="text-sm font-semibold text-zinc-900 hover:text-blue-600 transition-colors"
                    >
                      {alert.designerName}
                    </Link>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${style.badge}`}>
                      {TYPE_LABEL[alert.type]}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${style.badge}`}>
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-700">{alert.message}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{alert.detail}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/designers/${alert.designerId}`}
                    className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                  >
                    View
                  </Link>
                  <button
                    onClick={() => dismiss(alert.id)}
                    className="text-xs text-zinc-300 hover:text-zinc-500"
                    aria-label="Dismiss"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
