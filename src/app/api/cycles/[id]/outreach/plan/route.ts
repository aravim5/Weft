// POST /api/cycles/[id]/outreach/plan — create outreach rows from checked (designer × partner) matrix
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const Body = z.object({
  pairs: z.array(z.object({
    designerId: z.string(),
    partnerId: z.string(),
    projectId: z.string().optional(),
  })),
});

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

  const cycle = await db.reviewCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) return NextResponse.json({ error: "Cycle not found" }, { status: 404 });

  let created = 0;
  let skipped = 0;

  for (const pair of parsed.data.pairs) {
    const existing = await db.outreach.findFirst({
      where: { cycleId, designerId: pair.designerId, partnerId: pair.partnerId },
    });
    if (existing) { skipped++; continue; }
    await db.outreach.create({
      data: {
        cycleId,
        designerId: pair.designerId,
        partnerId: pair.partnerId,
        projectId: pair.projectId ?? null,
        status: "draft",
        source: "manual_form",
      },
    });
    created++;
  }

  // Update cycle status to outreach_sent stage
  await db.reviewCycle.update({
    where: { id: cycleId },
    data: { status: "outreach_sent" },
  });

  return NextResponse.json({ created, skipped });
}
