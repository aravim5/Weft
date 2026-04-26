// GET /api/cycles — list all review cycles
// POST /api/cycles — create a new cycle
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const CreateSchema = z.object({
  year: z.number().int().min(2024).max(2030),
  quarter: z.enum(["Q1", "Q2", "Q3", "Q4"]),
  checkinDate: z.string(),
  outreachOpenOn: z.string(),
  notes: z.string().optional(),
});

export async function GET() {
  const cycles = await db.reviewCycle.findMany({
    where: { archivedAt: null },
    orderBy: [{ year: "desc" }, { quarter: "desc" }],
    include: {
      cycleReviews: { select: { id: true, finalStatus: true, designerId: true } },
      _count: { select: { outreach: true } },
    },
  });
  return NextResponse.json({ data: cycles });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 422 });
  }
  const cycle = await db.reviewCycle.create({
    data: {
      year: parsed.data.year,
      quarter: parsed.data.quarter as "Q1" | "Q2" | "Q3" | "Q4",
      checkinDate: new Date(parsed.data.checkinDate),
      outreachOpenOn: new Date(parsed.data.outreachOpenOn),
      notes: parsed.data.notes,
      source: "manual_form",
    },
  });
  return NextResponse.json({ data: cycle }, { status: 201 });
}
