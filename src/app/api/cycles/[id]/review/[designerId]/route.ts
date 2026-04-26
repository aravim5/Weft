// GET /api/cycles/[id]/review/[designerId] — get or init cycle review
// POST — generate AI review draft
// PATCH — update fields / sign off
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { run as generateReview } from "@/lib/prompts/generate-cycle-review";
import { getProvider } from "@/lib/ai/provider";

type Params = { params: Promise<{ id: string; designerId: string }> };

async function getOrCreate(cycleId: string, designerId: string) {
  const existing = await db.cycleReview.findUnique({
    where: { designerId_cycleId: { designerId, cycleId } },
  });
  if (existing) return existing;

  const rubric = await db.rubric.findFirst({ orderBy: { createdAt: "desc" } });
  return db.cycleReview.create({
    data: {
      cycleId,
      designerId,
      rubricVersion: rubric?.version ?? "1.0",
      source: "manual_form",
    },
  });
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id: cycleId, designerId } = await params;
  const review = await getOrCreate(cycleId, designerId);
  return NextResponse.json({ data: review });
}

export async function POST(_req: NextRequest, { params }: Params) {
  const { id: cycleId, designerId } = await params;

  const provider = getProvider();

  const [designer, cycle, rubric, review] = await Promise.all([
    db.designer.findUnique({ where: { id: designerId }, select: { id: true, fullName: true, level: true, productArea: true, startDate: true } }),
    db.reviewCycle.findUnique({ where: { id: cycleId } }),
    db.rubric.findFirst({ orderBy: { createdAt: "desc" }, select: { version: true, dimensions: true } }),
    getOrCreate(cycleId, designerId),
  ]);

  if (!designer || !cycle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const cycleStart = new Date(cycle.year, ["Q1","Q2","Q3","Q4"].indexOf(cycle.quarter) * 3, 1);
  const cycleEnd = new Date(cycle.year, (["Q1","Q2","Q3","Q4"].indexOf(cycle.quarter) + 1) * 3, 0);

  if (!provider.available) {
    const draft = {
      summaryMarkdown: `_AI disabled. Enable AI_MODE in .env.local to generate ${cycle.quarter} ${cycle.year} review for ${designer.fullName}._`,
      strengthsMarkdown: "",
      improvementsMarkdown: "",
      rubricRating: "{}",
      aiDisabled: true,
    };
    await db.cycleReview.update({ where: { id: review.id }, data: { summaryMarkdown: draft.summaryMarkdown } });
    return NextResponse.json({ data: draft });
  }

  const [impactEntries, feedback, oneOnOnes, highlights, riskSignals, teamConcerns, previousReview] = await Promise.all([
    db.impactEntry.findMany({
      where: { designerId, archivedAt: null, date: { gte: cycleStart, lte: cycleEnd } },
      select: { id: true, summary: true, dimension: true, magnitude: true, date: true },
    }),
    db.feedback.findMany({
      where: { designerId, archivedAt: null, occurredOn: { gte: cycleStart, lte: cycleEnd } },
      include: { partner: { select: { fullName: true } } },
    }),
    db.oneOnOne.findMany({
      where: { designerId, archivedAt: null, date: { gte: cycleStart, lte: cycleEnd } },
      select: { id: true, date: true, topicsDiscussed: true, happinessIndex: true },
    }),
    db.highlight.findMany({
      where: { designerId, archivedAt: null, occurredOn: { gte: cycleStart, lte: cycleEnd } },
      select: { id: true, kind: true, description: true },
    }),
    db.riskSignal.findMany({
      where: { designerId, archivedAt: null, status: "open" },
      select: { id: true, signalType: true, severity: true },
    }),
    db.teamConcern.findMany({
      where: { raisedByDesignerId: designerId, archivedAt: null, createdAt: { gte: cycleStart, lte: cycleEnd } },
      select: { id: true, concern: true, theme: true, severity: true },
    }),
    db.cycleReview.findFirst({
      where: { designerId, archivedAt: null, id: { not: review.id } },
      orderBy: { createdAt: "desc" },
      select: { summaryMarkdown: true, rubricRating: true },
    }),
  ]);

  try {
    const result = await generateReview({
      designer: {
        id: designer.id,
        fullName: designer.fullName,
        level: designer.level,
        productArea: designer.productArea,
        startDate: designer.startDate.toISOString().slice(0, 10),
      },
      cycle: {
        quarter: cycle.quarter,
        year: cycle.year,
        checkinDate: cycle.checkinDate.toISOString().slice(0, 10),
      },
      rubric: rubric?.dimensions ?? "{}",
      impactEntries: impactEntries.map((e) => ({ ...e, date: e.date.toISOString().slice(0, 10) })),
      feedback: feedback.map((f) => ({
        id: f.id, sentiment: f.sentiment, theme: f.theme, summary: f.summary,
        source: f.source, occurredOn: f.occurredOn.toISOString().slice(0, 10),
        partnerName: f.partner?.fullName ?? null,
      })),
      oneOnOnes: oneOnOnes.map((o) => ({ ...o, date: o.date.toISOString().slice(0, 10) })),
      highlights,
      openRiskSignals: riskSignals,
      teamConcerns,
      previousReview: previousReview
        ? { summaryMarkdown: previousReview.summaryMarkdown ?? "", rubricRating: previousReview.rubricRating ?? "{}" }
        : null,
    });

    const updated = await db.cycleReview.update({
      where: { id: review.id },
      data: {
        summaryMarkdown: result.summary_markdown,
        strengthsMarkdown: result.strengths_markdown,
        improvementsMarkdown: result.improvements_markdown,
        rubricRating: JSON.stringify(result.rubric_rating),
        riskWatch: result.risk_watch,
        continuityNote: result.continuity_note,
        rubricVersion: rubric?.version ?? "1.0",
      },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("[review/generate]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: cycleId, designerId } = await params;
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const PatchSchema = z.object({
    summaryMarkdown: z.string().optional(),
    strengthsMarkdown: z.string().optional(),
    improvementsMarkdown: z.string().optional(),
    rubricRating: z.string().optional(),
    riskWatch: z.string().nullable().optional(),
    continuityNote: z.string().nullable().optional(),
    finalStatus: z.enum(["draft", "signed_off"]).optional(),
  });

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 422 });
  }

  const review = await getOrCreate(cycleId, designerId);
  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.finalStatus === "signed_off") data.signedOffOn = new Date();

  const updated = await db.cycleReview.update({
    where: { id: review.id },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: data as any,
  });
  return NextResponse.json({ data: updated });
}
