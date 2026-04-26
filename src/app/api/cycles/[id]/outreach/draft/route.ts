// POST /api/cycles/[id]/outreach/draft — generate AI draft for one outreach row
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { run as draftOutreach } from "@/lib/prompts/draft-outreach";
import { getProvider } from "@/lib/ai/provider";

const Body = z.object({ outreachId: z.string() });

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id: cycleId } = await params;
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 422 });
  }

  const outreach = await db.outreach.findFirst({
    where: { id: parsed.data.outreachId, cycleId },
    include: {
      designer: { select: { fullName: true, level: true, productArea: true, startDate: true } },
      partner: { select: { fullName: true, role: true, orgOrTeam: true } },
    },
  });
  if (!outreach) return NextResponse.json({ error: "Outreach row not found" }, { status: 404 });

  const cycle = await db.reviewCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) return NextResponse.json({ error: "Cycle not found" }, { status: 404 });

  const provider = getProvider();
  if (!provider.available) {
    return NextResponse.json({
      subject: `Feedback request: ${outreach.designer.fullName}`,
      body: `Hi ${outreach.partner.fullName},\n\nI'm collecting feedback for ${outreach.designer.fullName}'s ${cycle.quarter} ${cycle.year} review. Any observations you can share would be helpful.\n\nThanks,\nRavi`,
      notes: "AI disabled — placeholder draft.",
      aiDisabled: true,
    });
  }

  // Load projects linking this designer and partner
  const cycleStart = new Date(cycle.year, ["Q1","Q2","Q3","Q4"].indexOf(cycle.quarter) * 3, 1);
  const cycleEnd = new Date(cycle.year, (["Q1","Q2","Q3","Q4"].indexOf(cycle.quarter) + 1) * 3, 0);

  const assignments = await db.assignment.findMany({
    where: {
      designerId: outreach.designerId,
      archivedAt: null,
      startDate: { lte: cycleEnd },
      OR: [{ endDate: null }, { endDate: { gte: cycleStart } }],
    },
    include: { project: { select: { projectName: true } } },
  });

  const recentFeedback = await db.feedback.findMany({
    where: {
      designerId: outreach.designerId,
      partnerId: outreach.partnerId,
      archivedAt: null,
      occurredOn: { gte: cycleStart },
    },
    select: { summary: true },
  });

  try {
    const result = await draftOutreach({
      designer: {
        fullName: outreach.designer.fullName,
        level: outreach.designer.level,
        productArea: outreach.designer.productArea,
        startDate: outreach.designer.startDate.toISOString().slice(0, 10),
      },
      partner: {
        fullName: outreach.partner.fullName,
        role: outreach.partner.role,
        org: outreach.partner.orgOrTeam,
      },
      projects: assignments.map((a) => ({
        projectName: a.project.projectName,
        role: a.role,
        dateRange: `${a.startDate.toISOString().slice(0, 7)}${a.endDate ? ` – ${a.endDate.toISOString().slice(0, 7)}` : "–present"}`,
      })),
      checkinDate: cycle.checkinDate.toISOString().slice(0, 10),
      recentFeedbackFromPartner: recentFeedback.map((f) => f.summary),
    });

    // Save draft to outreach row
    await db.outreach.update({
      where: { id: outreach.id },
      data: { subject: result.subject, body: result.body },
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[outreach/draft]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
