// GET /api/cycles/[id] — full cycle workspace data
// PATCH /api/cycles/[id] — update status
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const cycle = await db.reviewCycle.findUnique({
    where: { id },
    include: {
      outreach: {
        where: { archivedAt: null },
        orderBy: { createdAt: "asc" },
        include: {
          designer: { select: { id: true, fullName: true, level: true } },
          partner: { select: { id: true, fullName: true, role: true, orgOrTeam: true, email: true } },
        },
      },
      cycleReviews: {
        where: { archivedAt: null },
        include: {
          designer: { select: { id: true, fullName: true, level: true } },
        },
      },
    },
  });

  if (!cycle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Load designers for the outreach matrix (Stage 1)
  const designers = await db.designer.findMany({
    where: { archivedAt: null, currentStatus: "active" },
    select: { id: true, fullName: true, level: true, productArea: true },
    orderBy: { fullName: "asc" },
  });

  // Load assignments that overlap this cycle's quarter to suggest (designer × partner) pairs
  const cycleStart = new Date(cycle.year, ["Q1","Q2","Q3","Q4"].indexOf(cycle.quarter) * 3, 1);
  const cycleEnd = new Date(cycle.year, (["Q1","Q2","Q3","Q4"].indexOf(cycle.quarter) + 1) * 3, 0);

  const assignments = await db.assignment.findMany({
    where: {
      archivedAt: null,
      startDate: { lte: cycleEnd },
      OR: [{ endDate: null }, { endDate: { gte: cycleStart } }],
    },
    include: { project: { select: { id: true, projectName: true, primaryPartnerId: true } } },
  });

  // Partners associated with cycle-relevant projects
  const projectIds = [...new Set(assignments.map((a) => a.projectId))];
  const partners = await db.partner.findMany({
    where: { archivedAt: null },
    select: { id: true, fullName: true, role: true, orgOrTeam: true, email: true },
    orderBy: { fullName: "asc" },
  });

  return NextResponse.json({
    cycle,
    designers,
    partners,
    projectIds,
    cycleStart: cycleStart.toISOString(),
    cycleEnd: cycleEnd.toISOString(),
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updated = await db.reviewCycle.update({ where: { id }, data: body as any });
  return NextResponse.json({ data: updated });
}
