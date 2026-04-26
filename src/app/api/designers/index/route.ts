// GET /api/designers/index — summary stats for all designers (team table)
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const now = new Date();
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);

  const designers = await db.designer.findMany({
    where: { archivedAt: null, currentStatus: "active" },
    orderBy: { fullName: "asc" },
    include: {
      assignments: {
        where: { archivedAt: null },
        include: { project: { select: { status: true } } },
      },
      impactEntries: {
        where: { archivedAt: null, date: { gte: quarterStart } },
        select: { id: true },
      },
      feedback: {
        where: { archivedAt: null, occurredOn: { gte: quarterStart }, sentiment: "positive" },
        select: { id: true },
      },
      riskSignals: {
        where: { archivedAt: null, status: "open" },
        select: { id: true },
      },
      cycleReviews: {
        where: { archivedAt: null, finalStatus: "draft" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { finalStatus: true },
      },
      biweeklyCheckins: {
        orderBy: { biweekStart: "desc" },
        take: 1,
        select: { biweekStart: true },
      },
      oneOnOnes: {
        where: { archivedAt: null },
        orderBy: { date: "desc" },
        take: 3,
        select: { happinessIndex: true },
      },
      actionItems: {
        where: { archivedAt: null, status: "open", dueDate: { lt: now } },
        select: { id: true },
      },
    },
  });

  const rows = designers.map((d) => {
    const moods = d.oneOnOnes.map((o) => o.happinessIndex).filter((h): h is number => h !== null);
    let happinessTrend: "up" | "flat" | "down" | null = null;
    if (moods.length >= 2) {
      const delta = moods[0] - moods[moods.length - 1];
      happinessTrend = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
    }

    const activeProjects = d.assignments.filter((a) =>
      a.project && ["in_progress", "planned"].includes(a.project.status)
    ).length;

    return {
      id: d.id,
      fullName: d.fullName,
      level: d.level,
      productArea: d.productArea,
      currentStatus: d.currentStatus,
      startDate: d.startDate,
      openRisks: d.riskSignals.length,
      positiveFeedbackThisQuarter: d.feedback.length,
      impactEntriesThisQuarter: d.impactEntries.length,
      activeProjects,
      cycleReviewStatus: d.cycleReviews[0]?.finalStatus ?? null,
      lastBiweeklyDate: d.biweeklyCheckins[0]?.biweekStart?.toISOString() ?? null,
      happinessTrend,
      overdueActions: d.actionItems.length,
    };
  });

  return NextResponse.json({ designers: rows });
}
