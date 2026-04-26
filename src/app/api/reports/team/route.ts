// GET /api/reports/team — aggregate team metrics for all 10 report charts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const now = new Date();
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const [
    designers,
    impactEntries,
    feedback,
    oneOnOnes,
    riskSignals,
    actionItems,
    teamConcerns,
    communityActivities,
    highlights,
    biweeklyCheckins,
    cycleReviews,
  ] = await Promise.all([
    db.designer.findMany({
      where: { archivedAt: null, currentStatus: "active" },
      select: { id: true, fullName: true, productArea: true, level: true },
    }),
    db.impactEntry.findMany({
      where: { archivedAt: null, date: { gte: quarterStart } },
      select: { designerId: true, dimension: true, magnitude: true, date: true },
    }),
    db.feedback.findMany({
      where: { archivedAt: null, occurredOn: { gte: ninetyDaysAgo } },
      select: { designerId: true, sentiment: true, theme: true, occurredOn: true },
    }),
    db.oneOnOne.findMany({
      where: { archivedAt: null, date: { gte: ninetyDaysAgo } },
      select: { designerId: true, happinessIndex: true, date: true },
      orderBy: { date: "asc" },
    }),
    db.riskSignal.findMany({
      where: { archivedAt: null, status: "open" },
      select: { designerId: true, severity: true, signalType: true },
    }),
    db.actionItem.findMany({
      where: { status: { in: ["open", "snoozed"] }, archivedAt: null },
      select: { designerId: true, status: true, dueDate: true },
    }),
    db.teamConcern.findMany({
      where: { archivedAt: null },
      select: { raisedByDesignerId: true, theme: true, severity: true, createdAt: true },
    }),
    db.communityActivity.findMany({
      where: { archivedAt: null, date: { gte: quarterStart } },
      select: { designerId: true, activity: true },
    }),
    db.highlight.findMany({
      where: { archivedAt: null, occurredOn: { gte: quarterStart } },
      select: { designerId: true, kind: true, size: true, description: true },
    }),
    db.biweeklyCheckin.findMany({
      where: { biweekStart: { gte: thirtyDaysAgo } },
      select: { designerId: true, status: true, biweekStart: true, completedOn: true },
    }),
    db.cycleReview.findMany({
      where: { archivedAt: null },
      select: { designerId: true, finalStatus: true, cycleId: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const designerMap = new Map(designers.map((d) => [d.id, d]));

  // 1. Impact heatmap: dimension × magnitude counts
  const dimensionOrder = ["craft_quality", "business_outcome", "team_multiplier", "client_trust", "innovation", "delivery_reliability", "mentorship"];
  const magnitudeOrder = ["small", "meaningful", "significant", "exceptional"];
  const impactHeatmap = dimensionOrder.map((dim) => {
    const row: Record<string, number | string> = { dimension: dim };
    for (const mag of magnitudeOrder) {
      row[mag] = impactEntries.filter((e) => e.dimension === dim && e.magnitude === mag).length;
    }
    row.total = impactEntries.filter((e) => e.dimension === dim).length;
    return row;
  });

  // 2. Sentiment trend: group feedback by week, positive vs negative
  const weekMap = new Map<string, { positive: number; negative: number; neutral: number }>();
  for (const f of feedback) {
    const d = new Date(f.occurredOn);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = weekStart.toISOString().slice(0, 10);
    if (!weekMap.has(key)) weekMap.set(key, { positive: 0, negative: 0, neutral: 0 });
    const bucket = weekMap.get(key)!;
    if (f.sentiment === "positive") bucket.positive++;
    else if (f.sentiment === "needs_improvement") bucket.negative++;
    else bucket.neutral++;
  }
  const sentimentTrend = Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, counts]) => ({ week, ...counts }));

  // 3. Happiness by designer: average over the period
  const happinessByDesigner = designers.map((d) => {
    const entries = oneOnOnes.filter((o) => o.designerId === d.id && o.happinessIndex !== null);
    const avg = entries.length ? entries.reduce((sum, e) => sum + (e.happinessIndex ?? 0), 0) / entries.length : null;
    return { name: d.fullName.split(" ")[0], designerId: d.id, avg: avg !== null ? Math.round(avg * 10) / 10 : null, count: entries.length };
  });

  // 4. Risk chart: by designer, severity breakdown
  const riskChart = designers.map((d) => {
    const dRisks = riskSignals.filter((r) => r.designerId === d.id);
    return {
      name: d.fullName.split(" ")[0],
      designerId: d.id,
      high: dRisks.filter((r) => r.severity === "high").length,
      med: dRisks.filter((r) => r.severity === "med").length,
      low: dRisks.filter((r) => r.severity === "low").length,
      total: dRisks.length,
    };
  });

  // 5. Actions by designer: open vs overdue
  const actionsByDesigner = designers.map((d) => {
    const dActions = actionItems.filter((a) => a.designerId === d.id);
    const overdue = dActions.filter((a) => a.dueDate && new Date(a.dueDate) < now && a.status === "open").length;
    return { name: d.fullName.split(" ")[0], designerId: d.id, open: dActions.length, overdue };
  });

  // 6. Concerns chart: count by theme
  const concernThemes = ["craft", "communication", "ownership", "collaboration", "leadership", "delivery", "growth"];
  const concernsChart = concernThemes.map((theme) => ({
    theme,
    count: teamConcerns.filter((c) => c.theme === theme).length,
    high: teamConcerns.filter((c) => c.theme === theme && c.severity === "high").length,
  }));

  // 7. Community by designer: count of activities
  const communityByDesigner = designers.map((d) => ({
    name: d.fullName.split(" ")[0],
    designerId: d.id,
    count: communityActivities.filter((c) => c.designerId === d.id).length,
  }));

  // 8. Highlights data: by kind
  const highlightKinds = ["standout_work", "kudos", "community", "mentorship", "speaking", "learning", "small_win", "big_win"];
  const highlightsData = highlightKinds.map((kind) => ({
    kind,
    count: highlights.filter((h) => h.kind === kind).length,
  })).filter((h) => h.count > 0);

  // 9. Biweekly completion chart: recent biweeks by designer
  const biweeklyChart = designers.map((d) => {
    const dCheckins = biweeklyCheckins.filter((c) => c.designerId === d.id);
    const complete = dCheckins.filter((c) => c.status === "complete").length;
    const total = dCheckins.length;
    return { name: d.fullName.split(" ")[0], designerId: d.id, complete, total, rate: total ? complete / total : 0 };
  });

  const activeCheckins = biweeklyCheckins.filter((c) => c.biweekStart >= thirtyDaysAgo);
  const currentBiweekRate = activeCheckins.length
    ? activeCheckins.filter((c) => c.status === "complete").length / activeCheckins.length
    : 0;

  // 10. Cycle health: sign-off rate per cycle
  const cycleMap = new Map<string, { total: number; signedOff: number }>();
  for (const r of cycleReviews) {
    if (!cycleMap.has(r.cycleId)) cycleMap.set(r.cycleId, { total: 0, signedOff: 0 });
    const bucket = cycleMap.get(r.cycleId)!;
    bucket.total++;
    if (r.finalStatus === "signed_off") bucket.signedOff++;
  }
  const cycleHealth = Array.from(cycleMap.entries()).map(([cycleId, { total, signedOff }]) => ({
    cycleId,
    total,
    signedOff,
    rate: total ? signedOff / total : 0,
  }));

  // Summary metrics for narrative generation
  const totalImpact = impactEntries.length;
  const dimensionCounts = dimensionOrder.map((d) => ({ d, c: impactEntries.filter((e) => e.dimension === d).length }));
  dimensionCounts.sort((a, b) => b.c - a.c);
  const topDimension = dimensionCounts[0]?.d ?? "craft_quality";
  const positiveFeedback = feedback.filter((f) => f.sentiment === "positive").length;
  const positiveFeedbackRate = feedback.length ? positiveFeedback / feedback.length : 0;
  const happinessValues = oneOnOnes.filter((o) => o.happinessIndex !== null).map((o) => o.happinessIndex!);
  const averageHappiness = happinessValues.length ? happinessValues.reduce((a, b) => a + b, 0) / happinessValues.length : null;
  const openRisks = riskSignals.length;
  const highSeverityRisks = riskSignals.filter((r) => r.severity === "high").length;
  const overdueActions = actionItems.filter((a) => a.dueDate && new Date(a.dueDate) < now && a.status === "open").length;
  const topConcernEntry = Object.entries(
    teamConcerns.reduce<Record<string, number>>((acc, c) => { acc[c.theme] = (acc[c.theme] ?? 0) + 1; return acc; }, {})
  ).sort(([, a], [, b]) => b - a)[0];

  const latestCycleHealth = cycleHealth[cycleHealth.length - 1] ?? null;

  const summary = {
    teamSize: designers.length,
    impactEntriesThisQuarter: totalImpact,
    topDimension,
    positiveFeedbackRate,
    averageHappiness,
    openRisks,
    highSeverityRisks,
    overdueActions,
    biweeklyCompletionRate: currentBiweekRate,
    teamConcernCount: teamConcerns.length,
    topConcernTheme: topConcernEntry?.[0] ?? null,
    cycleReviewSignOffRate: latestCycleHealth ? latestCycleHealth.rate : null,
  };

  const recentWins = highlights
    .filter((h) => h.kind === "big_win" || h.kind === "standout_work")
    .slice(0, 5)
    .map((h) => {
      const d = designerMap.get(h.designerId);
      return d ? `${d.fullName}: ${h.description}` : h.description;
    });

  const designersNeedingAttention = riskSignals
    .filter((r) => r.severity === "high")
    .map((r) => designerMap.get(r.designerId)?.fullName)
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i) as string[];

  return NextResponse.json({
    data: {
      impactHeatmap,
      sentimentTrend,
      happinessByDesigner,
      riskChart,
      actionsByDesigner,
      concernsChart,
      communityByDesigner,
      highlightsData,
      biweeklyChart,
      currentBiweekRate,
      cycleHealth,
      summary,
      recentWins,
      designersNeedingAttention,
    },
  });
}
