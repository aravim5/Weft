// POST /api/one-on-ones/extract — extract structured rows from dump-mode 1:1 notes
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { run as extractOneOnOne } from "@/lib/prompts/extract-one-on-one";
import { getProvider } from "@/lib/ai/provider";

const RequestSchema = z.object({
  designerId: z.string(),
  rawNotes: z.string().min(10),
  meetingDate: z.string(), // ISO date
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 422 });
  }
  const { designerId, rawNotes, meetingDate } = parsed.data;

  const designer = await db.designer.findUnique({
    where: { id: designerId, archivedAt: null },
    select: { id: true, fullName: true },
  });
  if (!designer) return NextResponse.json({ error: "Designer not found" }, { status: 404 });

  const provider = getProvider();
  if (!provider.available) {
    return NextResponse.json({ status: "ok", aiDisabled: true, proposals: null, message: "AI disabled." });
  }

  const [recentOneOnOnes, openBlockers, openActionItems] = await Promise.all([
    db.oneOnOne.findMany({
      where: { designerId, archivedAt: null },
      orderBy: { date: "desc" }, take: 3,
      select: { date: true, topicsDiscussed: true, happinessIndex: true },
    }),
    db.blocker.findMany({
      where: { designerId, archivedAt: null, status: "open" },
      select: { id: true, description: true },
    }),
    db.actionItem.findMany({
      where: { designerId, archivedAt: null, status: "open" },
      select: { id: true, description: true, dueDate: true },
    }),
  ]);

  try {
    const result = await extractOneOnOne({
      rawNotes,
      meetingDate,
      designerId,
      designerName: designer.fullName,
      recentOneOnOnes: recentOneOnOnes.map((o) => ({
        date: o.date.toISOString().slice(0, 10),
        topicsDiscussed: o.topicsDiscussed,
        happinessIndex: o.happinessIndex,
      })),
      openBlockers,
      openActionItems: openActionItems.map((a) => ({
        id: a.id,
        description: a.description,
        dueDate: a.dueDate?.toISOString().slice(0, 10) ?? null,
      })),
    });
    return NextResponse.json({ status: "ok", designerId, proposals: result });
  } catch (err) {
    console.error("[one-on-ones/extract]", err);
    return NextResponse.json({ status: "extraction_failed", error: String(err) });
  }
}
