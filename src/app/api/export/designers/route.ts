// GET /api/export/designers — CSV export of all designers with key metrics
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const now = new Date();
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const designers = await db.designer.findMany({
    where: { archivedAt: null },
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      email: true,
      level: true,
      discipline: true,
      productArea: true,
      startDate: true,
      currentStatus: true,
      impactEntries: {
        where: { archivedAt: null, date: { gte: quarterStart } },
        select: { magnitude: true },
      },
      feedback: {
        where: { archivedAt: null, occurredOn: { gte: ninetyDaysAgo } },
        select: { sentiment: true },
      },
      oneOnOnes: {
        where: { archivedAt: null },
        orderBy: { date: "desc" },
        take: 3,
        select: { happinessIndex: true, date: true },
      },
      riskSignals: {
        where: { archivedAt: null, status: "open" },
        select: { severity: true },
      },
      actionItems: {
        where: { archivedAt: null, status: "open" },
        select: { dueDate: true },
      },
    },
  });

  const rows = designers.map((d) => {
    const impactCount = d.impactEntries.length;
    const positiveFeedback = d.feedback.filter((f) => f.sentiment === "positive").length;
    const feedbackTotal = d.feedback.length;
    const posRate = feedbackTotal > 0 ? `${Math.round((positiveFeedback / feedbackTotal) * 100)}%` : "—";

    const happinessVals = d.oneOnOnes
      .map((o) => o.happinessIndex)
      .filter((h): h is number => h !== null);
    const avgHappiness =
      happinessVals.length > 0
        ? (happinessVals.reduce((a, b) => a + b, 0) / happinessVals.length).toFixed(1)
        : "—";

    const lastOneOnOne = d.oneOnOnes[0]?.date
      ? new Date(d.oneOnOnes[0].date).toLocaleDateString()
      : "—";

    const openRisks = d.riskSignals.length;
    const highRisks = d.riskSignals.filter((r) => r.severity === "high").length;

    const overdueActions = d.actionItems.filter(
      (a) => a.dueDate && new Date(a.dueDate) < now
    ).length;

    return {
      Name: d.fullName,
      Email: d.email,
      Level: d.level,
      Discipline: d.discipline,
      "Product Area": d.productArea.replace(/_/g, " "),
      "Start Date": new Date(d.startDate).toLocaleDateString(),
      Status: d.currentStatus,
      "Impact (QTD)": impactCount,
      "Positive Feedback (90d)": posRate,
      "Avg Happiness": avgHappiness,
      "Last 1:1": lastOneOnOne,
      "Open Risks": openRisks,
      "High Risks": highRisks,
      "Overdue Actions": overdueActions,
    };
  });

  if (rows.length === 0) {
    return new NextResponse("No data", { status: 204 });
  }

  const headers = Object.keys(rows[0]);
  const csvLines = [
    headers.join(","),
    ...rows.map((r) =>
      headers
        .map((h) => {
          const val = String((r as Record<string, unknown>)[h] ?? "");
          return val.includes(",") ? `"${val}"` : val;
        })
        .join(",")
    ),
  ];

  return new NextResponse(csvLines.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="designers-${now.toISOString().slice(0, 10)}.csv"`,
    },
  });
}
