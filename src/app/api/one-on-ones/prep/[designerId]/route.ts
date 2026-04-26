// GET /api/one-on-ones/prep/[designerId] — generate pre-1:1 brief (markdown)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { run as preBrief } from "@/lib/prompts/pre-one-on-one-brief";
import { getProvider } from "@/lib/ai/provider";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ designerId: string }> }
) {
  const { designerId } = await params;

  const designer = await db.designer.findUnique({
    where: { id: designerId, archivedAt: null },
    select: { id: true, fullName: true, level: true, productArea: true, startDate: true },
  });
  if (!designer) return NextResponse.json({ error: "Designer not found" }, { status: 404 });

  const provider = getProvider();
  if (!provider.available) {
    return NextResponse.json({
      markdown: `# Prep for 1:1 with ${designer.fullName}\n\n_AI disabled. Enable AI_MODE in .env.local to generate a brief._`,
      aiDisabled: true,
    });
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);

  const [openActionItems, openBlockers, recentOneOnOnes, recentFeedback, openConcerns, openRiskSignals, recentImpactEntries] = await Promise.all([
    db.actionItem.findMany({
      where: { designerId, archivedAt: null, status: "open" },
      orderBy: { dueDate: "asc" },
      select: { description: true, dueDate: true },
    }),
    db.blocker.findMany({
      where: { designerId, archivedAt: null, status: "open" },
      orderBy: { raisedOn: "asc" },
      select: { description: true, raisedOn: true },
    }),
    db.oneOnOne.findMany({
      where: { designerId, archivedAt: null },
      orderBy: { date: "desc" }, take: 6,
      select: { date: true, happinessIndex: true, topicsDiscussed: true },
    }),
    db.feedback.findMany({
      where: { designerId, archivedAt: null, occurredOn: { gte: thirtyDaysAgo } },
      orderBy: { occurredOn: "desc" },
      include: { partner: { select: { fullName: true } } },
    }),
    db.teamConcern.findMany({
      where: { raisedByDesignerId: designerId, archivedAt: null, status: { in: ["noted", "acting"] } },
      select: { concern: true, theme: true, severity: true },
    }),
    db.riskSignal.findMany({
      where: { designerId, archivedAt: null, status: "open" },
      select: { signalType: true, severity: true, evidence: true },
    }),
    db.impactEntry.findMany({
      where: { designerId, archivedAt: null, date: { gte: quarterStart } },
      orderBy: { date: "desc" },
      select: { dimension: true, magnitude: true, summary: true, date: true },
    }),
  ]);

  try {
    const markdown = await preBrief({
      designer: {
        id: designer.id,
        fullName: designer.fullName,
        level: designer.level,
        productArea: designer.productArea,
        startDate: designer.startDate.toISOString().slice(0, 10),
      },
      openActionItems: openActionItems.map((a) => ({
        description: a.description,
        dueDate: a.dueDate?.toISOString().slice(0, 10) ?? null,
      })),
      openBlockers: openBlockers.map((b) => ({
        description: b.description,
        raisedOn: b.raisedOn.toISOString().slice(0, 10),
      })),
      recentOneOnOnes: recentOneOnOnes.map((o) => ({
        date: o.date.toISOString().slice(0, 10),
        happinessIndex: o.happinessIndex,
        topicsDiscussed: o.topicsDiscussed,
      })),
      recentFeedback: recentFeedback.map((f) => ({
        sentiment: f.sentiment,
        summary: f.summary,
        occurredOn: f.occurredOn.toISOString().slice(0, 10),
        partnerName: f.partner?.fullName ?? null,
      })),
      openConcerns: openConcerns.map((c) => ({
        concern: c.concern,
        theme: c.theme,
        severity: c.severity,
      })),
      openRiskSignals: openRiskSignals.map((r) => ({
        signalType: r.signalType,
        severity: r.severity,
        evidence: r.evidence,
      })),
      recentImpactEntries: recentImpactEntries.map((ie) => ({
        dimension: ie.dimension,
        magnitude: ie.magnitude,
        summary: ie.summary,
        date: ie.date.toISOString().slice(0, 10),
      })),
      meetingDate: now.toISOString().slice(0, 10),
    });
    return NextResponse.json({ markdown });
  } catch (err) {
    console.error("[one-on-ones/prep]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
