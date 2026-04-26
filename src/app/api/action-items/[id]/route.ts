// PATCH /api/action-items/[id] — quick-complete, snooze, update
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const PatchSchema = z.object({
  status: z.enum(["open","in_progress","done","dropped","snoozed"]).optional(),
  snoozeDays: z.number().int().positive().optional(), // bumps dueDate by N days
  dueDate: z.string().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 422 });
  }
  const { status, snoozeDays, dueDate } = parsed.data;

  const existing = await db.actionItem.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const update: Record<string, unknown> = {};
  if (status) {
    update.status = status;
    if (status === "done") update.completedOn = new Date();
    if (status === "snoozed") update.snoozedUntil = new Date(Date.now() + (snoozeDays ?? 3) * 24 * 60 * 60 * 1000);
  }
  if (snoozeDays && existing.dueDate) {
    update.dueDate = new Date(existing.dueDate.getTime() + snoozeDays * 24 * 60 * 60 * 1000);
    update.status = "snoozed";
  }
  if (dueDate !== undefined) {
    update.dueDate = dueDate ? new Date(dueDate) : null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updated = await db.actionItem.update({ where: { id }, data: update as any });
  return NextResponse.json({ data: updated });
}
