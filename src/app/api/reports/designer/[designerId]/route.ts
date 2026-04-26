// POST /api/reports/designer/[designerId] — generate rolling profile summary
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getProvider } from "@/lib/ai/provider";
import { run as summarizeDesigner } from "@/lib/prompts/summarize-designer";

type Params = { params: Promise<{ designerId: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { designerId } = await params;
  const provider = getProvider();

  const designer = await db.designer.findUnique({
    where: { id: designerId },
    select: { id: true, fullName: true, level: true, productArea: true, startDate: true, currentStatus: true },
  });
  if (!designer) return NextResponse.json({ error: "Designer not found" }, { status: 404 });

  if (!provider.available) {
    return NextResponse.json({
      data: {
        headline: `${designer.fullName} — AI disabled`,
        summary: "_Enable AI_MODE in .env.local to generate this designer's rolling profile._",
        aiDisabled: true,
      },
    });
  }

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [impactEntries, feedback, oneOnOnes, riskSignals, blockers, highlights, teamConcerns, previousSummary] =
    await Promise.all([
      db.impactEntry.findMany({
        where: { designerId, archivedAt: null, date: { gte: ninetyDaysAgo } },
        select: { summary: true, dimension: true, magnitude: true, date: true },
        orderBy: { date: "desc" },
        take: 10,
      }),
      db.feedback.findMany({
        where: { designerId, archivedAt: null, occurredOn: { gte: ninetyDaysAgo } },
        select: { sentiment: true, theme: true, summary: true, source: true },
        orderBy: { occurredOn: "desc" },
        take: 8,
      }),
      db.oneOnOne.findMany({
        where: { designerId, archivedAt: null, date: { gte: ninetyDaysAgo } },
        select: { date: true, topicsDiscussed: true, happinessIndex: true },
        orderBy: { date: "desc" },
        take: 6,
      }),
      db.riskSignal.findMany({
        where: { designerId, archivedAt: null, status: "open" },
        select: { signalType: true, severity: true, evidence: true },
      }),
      db.blocker.findMany({
        where: { designerId, archivedAt: null, status: "open" },
        select: { description: true },
      }),
      db.highlight.findMany({
        where: { designerId, archivedAt: null, occurredOn: { gte: ninetyDaysAgo } },
        select: { kind: true, description: true },
        orderBy: { occurredOn: "desc" },
        take: 5,
      }),
      db.teamConcern.findMany({
        where: { raisedByDesignerId: designerId, archivedAt: null },
        select: { concern: true, theme: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      db.cycleReview.findFirst({
        where: { designerId, archivedAt: null },
        select: { summaryMarkdown: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  try {
    const result = await summarizeDesigner({
      designer: {
        fullName: designer.fullName,
        level: designer.level,
        productArea: designer.productArea,
        startDate: designer.startDate.toISOString().slice(0, 10),
        currentStatus: designer.currentStatus,
      },
      recentImpactEntries: impactEntries.map((e) => ({ ...e, date: e.date.toISOString().slice(0, 10) })),
      recentFeedback: feedback,
      recentOneOnOnes: oneOnOnes.map((o) => ({ ...o, date: o.date.toISOString().slice(0, 10) })),
      openRisks: riskSignals,
      openBlockers: blockers,
      highlights,
      teamConcerns,
      previousSummary: previousSummary?.summaryMarkdown ?? null,
    });
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("[reports/designer]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
