// GET /api/checkins/biweekly/[designerId]/prep — load section data + run AI flags
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { run as biweeklyPrep } from "@/lib/prompts/biweekly-checklist-prep";
import { getProvider } from "@/lib/ai/provider";

function currentBiweek(): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 13);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

function daysSince(d: Date | null | undefined): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ designerId: string }> }
) {
  const { designerId } = await params;
  const { start, end } = currentBiweek();
  const eightWeeksAgo = new Date(start.getTime() - 56 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const designer = await db.designer.findUnique({
    where: { id: designerId, archivedAt: null },
    select: { id: true, fullName: true, level: true, productArea: true },
  });
  if (!designer) return NextResponse.json({ error: "Designer not found" }, { status: 404 });

  const [
    assignments, impactEntries, feedback, oneOnOnes, blockers, actionItems,
    highlights, teamConcerns, riskSignals, communityActivities, personalitySignals,
    existingCheckin, prevCheckin,
  ] = await Promise.all([
    db.assignment.findMany({
      where: { designerId, archivedAt: null },
      include: { project: { select: { projectName: true, status: true } } },
      orderBy: { startDate: "desc" },
    }),
    db.impactEntry.findMany({
      where: { designerId, archivedAt: null, date: { gte: eightWeeksAgo } },
      orderBy: { date: "desc" },
      select: { id: true, summary: true, dimension: true, magnitude: true, date: true },
    }),
    db.feedback.findMany({
      where: { designerId, archivedAt: null, occurredOn: { gte: eightWeeksAgo } },
      orderBy: { occurredOn: "desc" },
      include: { partner: { select: { fullName: true } } },
    }),
    db.oneOnOne.findMany({
      where: { designerId, archivedAt: null },
      orderBy: { date: "desc" },
      take: 6,
      select: { id: true, date: true, happinessIndex: true, mood: true, topicsDiscussed: true },
    }),
    db.blocker.findMany({
      where: { designerId, archivedAt: null, status: "open" },
      orderBy: { raisedOn: "asc" },
      select: { id: true, description: true, status: true, raisedOn: true },
    }),
    db.actionItem.findMany({
      where: { designerId, archivedAt: null, status: { in: ["open", "in_progress", "snoozed"] } },
      orderBy: { dueDate: "asc" },
      select: { id: true, description: true, dueDate: true, status: true },
    }),
    db.highlight.findMany({
      where: { designerId, archivedAt: null, occurredOn: { gte: thirtyDaysAgo } },
      orderBy: { occurredOn: "desc" },
      select: { id: true, kind: true, description: true, occurredOn: true },
    }),
    db.teamConcern.findMany({
      where: { raisedByDesignerId: designerId, archivedAt: null, status: { in: ["noted", "acting"] } },
      select: { id: true, concern: true, theme: true, severity: true, status: true, createdAt: true },
    }),
    db.riskSignal.findMany({
      where: { designerId, archivedAt: null, status: "open" },
      select: { id: true, signalType: true, severity: true, evidence: true, detectedOn: true },
    }),
    db.communityActivity.findMany({
      where: { designerId, archivedAt: null, date: { gte: thirtyDaysAgo } },
      select: { id: true, activity: true, title: true, date: true },
    }),
    db.personalitySignal.findMany({
      where: { designerId, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, trait: true, evidence: true, updatedAt: true },
    }),
    db.biweeklyCheckin.findFirst({
      where: { designerId, biweekStart: start },
    }),
    db.biweeklyCheckin.findFirst({
      where: { designerId, biweekStart: { lt: start } },
      orderBy: { biweekStart: "desc" },
    }),
  ]);

  const now = new Date();
  const overdueActions = actionItems.filter((a) => a.dueDate && new Date(a.dueDate) < now);
  const lastOneOnOne = oneOnOnes[0] ?? null;
  const lastFeedback = feedback[0] ?? null;
  const lastImpact = impactEntries[0] ?? null;
  const lastPersonality = personalitySignals[0] ?? null;
  const lastCommunity = communityActivities[0] ?? null;
  const oldestBlockerDays = blockers[0] ? daysSince(blockers[0].raisedOn) : null;
  const oldestRiskDays = riskSignals[0] ? daysSince(riskSignals[0].detectedOn) : null;
  const happinessTrend = oneOnOnes.map((o) => o.happinessIndex).filter(Boolean) as number[];

  const prevSectionsTouched = prevCheckin
    ? Object.keys(JSON.parse(prevCheckin.sectionsTouched ?? "{}"))
    : [];

  // Build section data payload (returned to UI regardless of AI)
  const sectionData = {
    assignments,
    impactEntries,
    feedback,
    oneOnOnes,
    blockers,
    actionItems,
    highlights,
    teamConcerns,
    riskSignals,
    communityActivities,
    personalitySignals,
  };

  // If AI disabled, return zero flags
  const provider = getProvider();
  if (!provider.available) {
    return NextResponse.json({
      designer,
      biweekStart: start.toISOString(),
      biweekEnd: end.toISOString(),
      checkinId: existingCheckin?.id ?? null,
      checkinStatus: existingCheckin?.status ?? "upcoming",
      sectionsTouched: existingCheckin ? JSON.parse(existingCheckin.sectionsTouched ?? "{}") : {},
      flags: [],
      aiDisabled: true,
      sectionData,
    });
  }

  try {
    const { flags } = await biweeklyPrep({
      designer: {
        id: designer.id,
        fullName: designer.fullName,
        level: designer.level,
        productArea: designer.productArea,
      },
      biweekStart: start.toISOString().slice(0, 10),
      biweekEnd: end.toISOString().slice(0, 10),
      sections: {
        projects: {
          activeCount: assignments.length,
          newThisBiweek: assignments.filter((a) => a.startDate && new Date(a.startDate) >= start).length,
        },
        impact: {
          recentCount: impactEntries.filter((e) => new Date(e.date) >= start).length,
          lastEntryDaysAgo: daysSince(lastImpact?.date),
        },
        feedback: {
          recentCount: feedback.filter((f) => new Date(f.occurredOn) >= start).length,
          lastFeedbackDaysAgo: daysSince(lastFeedback?.occurredOn),
        },
        oneOnOne: {
          lastMeetingDaysAgo: daysSince(lastOneOnOne?.date),
          happinessTrend,
        },
        blockers: {
          openCount: blockers.length,
          oldestDaysOpen: oldestBlockerDays,
        },
        actionItems: {
          openCount: actionItems.length,
          overdueCount: overdueActions.length,
        },
        wins: {
          recentCount: highlights.filter((h) => new Date(h.occurredOn) >= start).length,
        },
        teamConcerns: { openCount: teamConcerns.length },
        riskSignals: {
          openCount: riskSignals.length,
          oldestDaysOpen: oldestRiskDays,
        },
        highlights: {
          recentCount: highlights.length,
        },
        community: {
          recentCount: communityActivities.length,
        },
        personality: {
          lastUpdatedDaysAgo: daysSince(lastPersonality?.updatedAt),
        },
      },
      previousBiweekSectionsTouched: prevSectionsTouched,
    });

    return NextResponse.json({
      designer,
      biweekStart: start.toISOString(),
      biweekEnd: end.toISOString(),
      checkinId: existingCheckin?.id ?? null,
      checkinStatus: existingCheckin?.status ?? "upcoming",
      sectionsTouched: existingCheckin ? JSON.parse(existingCheckin.sectionsTouched ?? "{}") : {},
      flags,
      sectionData,
    });
  } catch (err) {
    console.error("[checkins/biweekly/prep]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
