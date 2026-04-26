// GET /api/designers/[id]/dashboard — all widget data in one shot
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const designer = await db.designer.findUnique({
    where: { id },
    include: {
      assignments: {
        where: { archivedAt: null },
        include: { project: { select: { id: true, projectName: true, status: true } } },
        orderBy: { startDate: "desc" },
      },
    },
  });

  if (!designer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date();
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const [
    impactEntries,
    recentOneOnOnes,
    recentFeedback,
    recentHighlights,
    currentCycleReview,
    openBlockers,
    openActionItems,
    openConcerns,
    openRiskSignals,
    personalitySignals,
    communityActivities,
    oneOnOneHistory,
    lastBiweeklyCheckin,
    sourceInbox,
  ] = await Promise.all([
    // Impact entries (last 6 months)
    db.impactEntry.findMany({
      where: { designerId: id, archivedAt: null, date: { gte: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000) } },
      orderBy: { date: "asc" },
      select: { id: true, date: true, dimension: true, magnitude: true, summary: true, projectId: true },
    }),

    // Last 6 1:1s for happiness sparkline
    db.oneOnOne.findMany({
      where: { designerId: id, archivedAt: null },
      orderBy: { date: "desc" },
      take: 6,
      select: { id: true, date: true, happinessIndex: true, durationMinutes: true, topicsDiscussed: true },
    }),

    // Feedback (last 60d)
    db.feedback.findMany({
      where: { designerId: id, archivedAt: null, occurredOn: { gte: sixtyDaysAgo } },
      orderBy: { occurredOn: "desc" },
      include: { partner: { select: { fullName: true } } },
    }),

    // Highlights (wins, last 60d)
    db.highlight.findMany({
      where: { designerId: id, archivedAt: null, occurredOn: { gte: sixtyDaysAgo } },
      orderBy: { occurredOn: "desc" },
      select: { id: true, kind: true, description: true, occurredOn: true },
    }),

    // Latest open cycle review
    db.cycleReview.findFirst({
      where: { designerId: id, archivedAt: null, finalStatus: "draft" },
      orderBy: { createdAt: "desc" },
      include: {
        cycle: { select: { year: true, quarter: true, checkinDate: true } },
        rubric: { select: { version: true, dimensions: true } },
      },
    }),

    // Open blockers
    db.blocker.findMany({
      where: { designerId: id, archivedAt: null, status: "open" },
      orderBy: { raisedOn: "desc" },
      select: { id: true, description: true, raisedOn: true, owner: true, projectId: true },
    }),

    // Open action items for this designer
    db.actionItem.findMany({
      where: { designerId: id, archivedAt: null, status: "open" },
      orderBy: { dueDate: "asc" },
      select: { id: true, description: true, dueDate: true, status: true, snoozedUntil: true },
    }),

    // Open team concerns raised by this designer
    db.teamConcern.findMany({
      where: { raisedByDesignerId: id, archivedAt: null, status: { in: ["noted", "acting"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, concern: true, theme: true, severity: true, status: true, createdAt: true },
    }),

    // Open risk signals
    db.riskSignal.findMany({
      where: { designerId: id, archivedAt: null, status: "open" },
      orderBy: { detectedOn: "desc" },
      select: { id: true, signalType: true, severity: true, evidence: true, detectedOn: true, autoDecayOn: true, mitigationPlan: true },
    }),

    // Personality signals
    db.personalitySignal.findMany({
      where: { designerId: id, archivedAt: null },
      orderBy: { lastUpdated: "desc" },
      select: { id: true, trait: true, evidence: true, confidence: true, lastUpdated: true },
    }),

    // Community activities (last 90d)
    db.communityActivity.findMany({
      where: { designerId: id, archivedAt: null, date: { gte: ninetyDaysAgo } },
      orderBy: { date: "desc" },
      select: { id: true, title: true, date: true, activity: true, role: true },
    }),

    // 1:1 history (last 5 for preview)
    db.oneOnOne.findMany({
      where: { designerId: id, archivedAt: null },
      orderBy: { date: "desc" },
      take: 5,
      select: { id: true, date: true, durationMinutes: true, happinessIndex: true, topicsDiscussed: true, nextMeetingOn: true },
    }),

    // Last biweekly check-in
    db.biweeklyCheckin.findFirst({
      where: { designerId: id, archivedAt: null },
      orderBy: { biweekStart: "desc" },
      select: { id: true, biweekStart: true, completedOn: true, status: true },
    }),

    // Source inbox (all inbox_emails related to this designer)
    db.inboxEmail.findMany({
      where: { relatedDesignerIds: { contains: id } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, subject: true, senderName: true, receivedOn: true, status: true, source: true, createdAt: true },
    }),
  ]);

  // Compute next 1:1 date
  const nextMeetingOn = oneOnOneHistory.find((o) => o.nextMeetingOn && new Date(o.nextMeetingOn) > now)?.nextMeetingOn ?? null;

  // Feedback summary
  const sentimentCounts = recentFeedback.reduce<Record<string, number>>((acc, f) => {
    acc[f.sentiment] = (acc[f.sentiment] ?? 0) + 1;
    return acc;
  }, {});
  const themeCounts = recentFeedback.reduce<Record<string, number>>((acc, f) => {
    acc[f.theme] = (acc[f.theme] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    designer: {
      id: designer.id,
      fullName: designer.fullName,
      preferredName: designer.preferredName,
      email: designer.email,
      level: designer.level,
      discipline: designer.discipline,
      productArea: designer.productArea,
      startDate: designer.startDate,
      managerName: designer.managerName,
      currentStatus: designer.currentStatus,
      notes: designer.notes,
    },
    activeAssignments: designer.assignments.filter((a) => {
      const p = a.project;
      return p && ["in_progress", "planned"].includes(p.status);
    }).map((a) => ({
      id: a.id,
      role: a.role,
      project: { id: a.project.id, projectName: a.project.projectName, status: a.project.status },
    })),
    lastBiweeklyCheckin,
    nextMeetingOn,
    impactEntries,
    happinessSeries: [...recentOneOnOnes].reverse().map((o) => ({
      id: o.id,
      date: o.date,
      happiness: o.happinessIndex,
    })),
    feedback: {
      sentimentCounts,
      themeCounts,
      recent: recentFeedback.slice(0, 5).map((f) => ({
        id: f.id,
        summary: f.summary,
        quote: f.quote,
        sentiment: f.sentiment,
        theme: f.theme,
        occurredOn: f.occurredOn,
        partnerName: f.partner?.fullName ?? null,
        feedbackSource: f.feedbackSource,
      })),
      total: recentFeedback.length,
    },
    highlights: recentHighlights,
    currentCycleReview,
    openBlockers,
    openActionItems,
    openConcerns,
    openRiskSignals,
    personalitySignals,
    communityActivities: communityActivities.map((a) => ({
      id: a.id,
      title: a.title,
      date: a.date,
      activity: a.activity,
      role: a.role ?? null,
    })),
    oneOnOneHistory,
    sourceInbox,
  });
}
