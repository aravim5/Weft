// GET    /api/partners/[id] — partner detail + feedback + outreach history
// PATCH  /api/partners/[id] — edit partner fields (name, role, org, notes, active)
// DELETE /api/partners/[id] — archive (soft-delete) partner
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const partner = await db.partner.findUnique({
    where: { id },
    include: {
      feedback: {
        where: { archivedAt: null },
        orderBy: { occurredOn: "desc" },
        include: {
          designer: { select: { id: true, fullName: true, productArea: true } },
          cycle: { select: { id: true, year: true, quarter: true } },
        },
      },
      outreach: {
        where: { archivedAt: null },
        orderBy: { createdAt: "desc" },
        include: {
          designer: { select: { id: true, fullName: true } },
          cycle: { select: { id: true, year: true, quarter: true } },
        },
      },
    },
  });

  if (!partner) {
    return NextResponse.json({ error: "Partner not found" }, { status: 404 });
  }

  // Compute response rate on the fly (also stored on record, but this guarantees fresh)
  const sent = partner.outreach.filter(
    (o) => o.status === "sent" || o.status === "responded" || o.status === "no_response"
  ).length;
  const responded = partner.outreach.filter(
    (o) => o.responseReceivedOn || o.status === "responded"
  ).length;
  const computedResponseRate = sent > 0 ? responded / sent : null;

  return NextResponse.json({
    data: {
      ...partner,
      computedResponseRate,
      stats: {
        feedbackCount: partner.feedback.length,
        outreachCount: partner.outreach.length,
        sent,
        responded,
      },
    },
  });
}

const PatchSchema = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z
    .enum([
      "engineering_manager",
      "product_manager",
      "client",
      "peer_designer",
      "cross_functional",
      "project_lead",
    ])
    .optional(),
  orgOrTeam: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 422 });
  }

  const existing = await db.partner.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Partner not found" }, { status: 404 });
  }

  const updated = await db.partner.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const existing = await db.partner.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Partner not found" }, { status: 404 });
  }
  const archived = await db.partner.update({
    where: { id },
    data: { archivedAt: new Date(), active: false },
  });
  return NextResponse.json({ data: archived });
}
