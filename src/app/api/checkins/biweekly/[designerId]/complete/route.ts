// POST /api/checkins/biweekly/[designerId]/complete — upsert checkin row on submit
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const Body = z.object({
  biweekStart: z.string(),
  biweekEnd: z.string(),
  sectionsTouched: z.record(z.string(), z.boolean()), // { projects: true, impact: false, ... }
  status: z.enum(["in_progress", "complete", "skipped"]).default("complete"),
  notes: z.string().optional(),
  autoSurfacedFlags: z.array(z.unknown()).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ designerId: string }> }
) {
  const { designerId } = await params;
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 422 });
  }

  const { biweekStart, biweekEnd, sectionsTouched, status, notes, autoSurfacedFlags } = parsed.data;
  const start = new Date(biweekStart);
  const end = new Date(biweekEnd);

  const existing = await db.biweeklyCheckin.findFirst({
    where: { designerId, biweekStart: start },
  });

  const data = {
    designerId,
    biweekStart: start,
    biweekEnd: end,
    status: status as "in_progress" | "complete" | "skipped",
    sectionsTouched: JSON.stringify(sectionsTouched),
    autoSurfacedFlags: autoSurfacedFlags ? JSON.stringify(autoSurfacedFlags) : undefined,
    notes: notes ?? undefined,
    completedOn: status === "complete" ? new Date() : undefined,
    source: "manual_form" as const,
  };

  const checkin = existing
    ? await db.biweeklyCheckin.update({ where: { id: existing.id }, data })
    : await db.biweeklyCheckin.create({ data });

  return NextResponse.json({ data: checkin });
}
