// GET /api/alerts — compute anomaly alerts across all active designers
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export type AlertSeverity = "urgent" | "warning" | "info";
export type AlertType =
  | "no_one_on_one"
  | "happiness_drop"
  | "overdue_action"
  | "impact_gap"
  | "stale_checkin"
  | "open_blocker"
  | "stale_risk";

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  designerId: string;
  designerName: string;
  message: string;
  detail: string;
  detectedAt: string;
}

export async function GET() {
  const now = new Date();
  const nowMs = now.getTime();

  const DAY = 24 * 60 * 60 * 1000;

  const designers = await db.designer.findMany({
    where: { archivedAt: null, currentStatus: "active" },
    select: {
      id: true,
      fullName: true,
      oneOnOnes: {
        where: { archivedAt: null },
        orderBy: { date: "desc" },
        take: 4,
        select: { id: true, date: true, happinessIndex: true },
      },
      actionItems: {
        where: { archivedAt: null, status: "open" },
        select: { id: true, description: true, dueDate: true },
      },
      impactEntries: {
        where: { archivedAt: null },
        orderBy: { date: "desc" },
        take: 1,
        select: { date: true },
      },
      biweeklyCheckins: {
        orderBy: { biweekStart: "desc" },
        take: 2,
        select: { id: true, biweekStart: true, completedOn: true, status: true },
      },
      blockers: {
        where: { archivedAt: null, status: "open" },
        select: { id: true, description: true, raisedOn: true },
      },
      riskSignals: {
        where: { archivedAt: null, status: "open" },
        select: { id: true, signalType: true, severity: true, detectedOn: true, mitigationPlan: true },
      },
    },
  });

  const alerts: Alert[] = [];

  for (const d of designers) {
    const name = d.fullName;

    // ── 1. No 1:1 ────────────────────────────────────────────────────────────
    const lastOneOnOne = d.oneOnOnes[0];
    if (lastOneOnOne) {
      const daysSince = Math.floor((nowMs - new Date(lastOneOnOne.date).getTime()) / DAY);
      if (daysSince >= 35) {
        alerts.push({
          id: `no_oo_${d.id}`,
          type: "no_one_on_one",
          severity: "urgent",
          designerId: d.id,
          designerName: name,
          message: `No 1:1 in ${daysSince} days`,
          detail: `Last 1:1 was on ${new Date(lastOneOnOne.date).toLocaleDateString()}. Needs immediate attention.`,
          detectedAt: now.toISOString(),
        });
      } else if (daysSince >= 21) {
        alerts.push({
          id: `no_oo_${d.id}`,
          type: "no_one_on_one",
          severity: "warning",
          designerId: d.id,
          designerName: name,
          message: `No 1:1 in ${daysSince} days`,
          detail: `Last 1:1 was on ${new Date(lastOneOnOne.date).toLocaleDateString()}.`,
          detectedAt: now.toISOString(),
        });
      }
    } else {
      alerts.push({
        id: `no_oo_${d.id}`,
        type: "no_one_on_one",
        severity: "urgent",
        designerId: d.id,
        designerName: name,
        message: "No 1:1 on record",
        detail: "No 1:1 meeting has ever been logged for this designer.",
        detectedAt: now.toISOString(),
      });
    }

    // ── 2. Happiness drop ────────────────────────────────────────────────────
    const moods = d.oneOnOnes
      .map((o) => o.happinessIndex)
      .filter((h): h is number => h !== null);

    if (moods.length >= 2) {
      const recent = moods.slice(0, 2);
      const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const trending = moods.length >= 3 && recent[0] < moods[2]; // current lower than 3 back

      if (avg < 5) {
        alerts.push({
          id: `happiness_${d.id}`,
          type: "happiness_drop",
          severity: "urgent",
          designerId: d.id,
          designerName: name,
          message: `Happiness avg ${avg.toFixed(1)}/10 — critically low`,
          detail: `Last ${recent.length} recorded: ${recent.join(", ")}. Needs immediate follow-up.`,
          detectedAt: now.toISOString(),
        });
      } else if (avg < 6.5 && trending) {
        alerts.push({
          id: `happiness_${d.id}`,
          type: "happiness_drop",
          severity: "warning",
          designerId: d.id,
          designerName: name,
          message: `Happiness trending down — avg ${avg.toFixed(1)}/10`,
          detail: `Last ${recent.length} recorded: ${recent.join(", ")}. Watch closely.`,
          detectedAt: now.toISOString(),
        });
      }
    }

    // ── 3. Overdue actions ───────────────────────────────────────────────────
    for (const action of d.actionItems) {
      if (!action.dueDate) continue;
      const daysOverdue = Math.floor((nowMs - new Date(action.dueDate).getTime()) / DAY);
      if (daysOverdue >= 14) {
        alerts.push({
          id: `action_${action.id}`,
          type: "overdue_action",
          severity: "urgent",
          designerId: d.id,
          designerName: name,
          message: `Action item ${daysOverdue}d overdue`,
          detail: action.description,
          detectedAt: now.toISOString(),
        });
      } else if (daysOverdue >= 7) {
        alerts.push({
          id: `action_${action.id}`,
          type: "overdue_action",
          severity: "warning",
          designerId: d.id,
          designerName: name,
          message: `Action item ${daysOverdue}d overdue`,
          detail: action.description,
          detectedAt: now.toISOString(),
        });
      }
    }

    // ── 4. Impact gap ────────────────────────────────────────────────────────
    const lastImpact = d.impactEntries[0];
    if (lastImpact) {
      const daysSince = Math.floor((nowMs - new Date(lastImpact.date).getTime()) / DAY);
      if (daysSince >= 35) {
        alerts.push({
          id: `impact_${d.id}`,
          type: "impact_gap",
          severity: "warning",
          designerId: d.id,
          designerName: name,
          message: `No impact entries in ${daysSince} days`,
          detail: `Last entry was ${new Date(lastImpact.date).toLocaleDateString()}. May indicate underlogged work or stalled delivery.`,
          detectedAt: now.toISOString(),
        });
      }
    } else {
      alerts.push({
        id: `impact_${d.id}`,
        type: "impact_gap",
        severity: "info",
        designerId: d.id,
        designerName: name,
        message: "No impact entries on record",
        detail: "Start logging impact entries for this designer.",
        detectedAt: now.toISOString(),
      });
    }

    // ── 5. Stale biweekly checkin ─────────────────────────────────────────────
    const lastCheckin = d.biweeklyCheckins[0];
    if (!lastCheckin || lastCheckin.status !== "complete") {
      const daysSince = lastCheckin
        ? Math.floor((nowMs - new Date(lastCheckin.biweekStart).getTime()) / DAY)
        : 999;
      if (daysSince >= 14) {
        alerts.push({
          id: `checkin_${d.id}`,
          type: "stale_checkin",
          severity: "info",
          designerId: d.id,
          designerName: name,
          message: `Biweekly check-in ${daysSince >= 999 ? "never completed" : `${daysSince}d stale`}`,
          detail: "Mark the current biweekly check-in complete to keep the rhythm intact.",
          detectedAt: now.toISOString(),
        });
      }
    }

    // ── 6. Long-open blockers ─────────────────────────────────────────────────
    for (const blocker of d.blockers) {
      const daysOpen = Math.floor((nowMs - new Date(blocker.raisedOn).getTime()) / DAY);
      if (daysOpen >= 14) {
        alerts.push({
          id: `blocker_${blocker.id}`,
          type: "open_blocker",
          severity: daysOpen >= 21 ? "warning" : "info",
          designerId: d.id,
          designerName: name,
          message: `Blocker open for ${daysOpen} days`,
          detail: blocker.description,
          detectedAt: now.toISOString(),
        });
      }
    }

    // ── 7. Stale risk signals ─────────────────────────────────────────────────
    for (const risk of d.riskSignals) {
      const daysOpen = Math.floor((nowMs - new Date(risk.detectedOn).getTime()) / DAY);
      const hasMitigation = !!risk.mitigationPlan;
      if (daysOpen >= 45 && !hasMitigation) {
        alerts.push({
          id: `risk_${risk.id}`,
          type: "stale_risk",
          severity: risk.severity === "high" ? "urgent" : "warning",
          designerId: d.id,
          designerName: name,
          message: `${risk.signalType.replace(/_/g, " ")} risk open ${daysOpen}d, no mitigation`,
          detail: `Severity: ${risk.severity}. No mitigation plan recorded.`,
          detectedAt: now.toISOString(),
        });
      }
    }
  }

  // Sort: urgent first, then warning, then info
  const ORDER = { urgent: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);

  return NextResponse.json({
    data: alerts,
    counts: {
      urgent: alerts.filter((a) => a.severity === "urgent").length,
      warning: alerts.filter((a) => a.severity === "warning").length,
      info: alerts.filter((a) => a.severity === "info").length,
      total: alerts.length,
    },
  });
}
