// POST /api/cycles/[id]/outreach/send — mark outreach row(s) as sent
// Side effects:
//   - sets partner.lastOutreachOn = now()
//   - recomputes partner.responseRate (responded / sent) across all their outreach history
//   - bumps review cycle to "collecting" status
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const Body = z.object({
  outreachIds: z.array(z.string()),
});

type Params = { params: Promise<{ id: string }> };

/**
 * Recompute responseRate for a partner from scratch based on their outreach history.
 * responseRate = responded / sent (where sent = any outreach that went out)
 */
async function recomputePartnerStats(partnerId: string) {
  const outreach = await db.outreach.findMany({
    where: { partnerId, archivedAt: null },
    select: { status: true, sentOn: true, responseReceivedOn: true },
  });

  const sent = outreach.filter(
    (o) => o.status === "sent" || o.status === "responded" || o.status === "no_response"
  ).length;
  const responded = outreach.filter(
    (o) => o.responseReceivedOn || o.status === "responded"
  ).length;
  const responseRate = sent > 0 ? responded / sent : null;

  // most recent sentOn across all outreach for this partner
  const lastSent = outreach
    .map((o) => o.sentOn)
    .filter((d): d is Date => d != null)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  await db.partner.update({
    where: { id: partnerId },
    data: {
      responseRate,
      lastOutreachOn: lastSent,
    },
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id: cycleId } = await params;
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 422 });
  }

  // Which partners are affected? Fetch before updating so we know who to recompute.
  const affected = await db.outreach.findMany({
    where: { id: { in: parsed.data.outreachIds }, cycleId },
    select: { partnerId: true },
  });
  const partnerIds = Array.from(new Set(affected.map((o) => o.partnerId)));

  const now = new Date();
  const updated = await db.outreach.updateMany({
    where: { id: { in: parsed.data.outreachIds }, cycleId },
    data: { status: "sent", sentOn: now },
  });

  // Side effects: recompute per-partner stats + bump cycle status
  if (updated.count > 0) {
    await Promise.all(partnerIds.map((pid) => recomputePartnerStats(pid)));
    await db.reviewCycle.update({
      where: { id: cycleId },
      data: { status: "collecting" },
    });
  }

  return NextResponse.json({
    updated: updated.count,
    partnersUpdated: partnerIds.length,
  });
}
