// POST /api/calendar/import — parse ICS, return detected 1:1 occurrences
// POST /api/calendar/import?action=log — log selected occurrences as OneOnOnes
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseIcs, detectOneOnOnes } from "@/lib/parsers/ics-parser";

const RANGE_MONTHS_BACK = 12;  // look back 12 months for past occurrences
const RANGE_MONTHS_AHEAD = 3;  // look ahead 3 months for upcoming

export async function POST(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");

  // ── action=log: log selected occurrences into OneOnOne table ──────────────
  if (action === "log") {
    let body: { occurrences: { designerId: string; date: string; durationMinutes: number; summary: string }[] };
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const results = await Promise.allSettled(
      body.occurrences.map(async (o) => {
        // Avoid duplicates: skip if a 1:1 already exists for this designer on this date
        const date = new Date(o.date);
        const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);

        const existing = await db.oneOnOne.findFirst({
          where: { designerId: o.designerId, date: { gte: dayStart, lte: dayEnd } },
        });
        if (existing) return { skipped: true, designerId: o.designerId, date: o.date };

        await db.oneOnOne.create({
          data: {
            designerId: o.designerId,
            date,
            durationMinutes: o.durationMinutes,
            source: "imported",
            topicsDiscussed: `Imported from Outlook calendar: "${o.summary}"`,
          },
        });
        return { logged: true, designerId: o.designerId, date: o.date };
      })
    );

    const logged = results.filter((r) => r.status === "fulfilled" && (r.value as { logged?: boolean }).logged).length;
    const skipped = results.filter((r) => r.status === "fulfilled" && (r.value as { skipped?: boolean }).skipped).length;

    return NextResponse.json({ logged, skipped });
  }

  // ── Default: parse ICS and return detected 1:1s ───────────────────────────
  const contentType = req.headers.get("content-type") ?? "";
  let icsText: string;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    icsText = await file.text();
  } else {
    icsText = await req.text();
  }

  if (!icsText.includes("BEGIN:VCALENDAR")) {
    return NextResponse.json({ error: "Not a valid ICS file" }, { status: 422 });
  }

  // Load designers
  const designers = await db.designer.findMany({
    where: { archivedAt: null, currentStatus: "active" },
    select: { id: true, fullName: true },
  });

  const now = new Date();
  const rangeStart = new Date(now);
  rangeStart.setMonth(rangeStart.getMonth() - RANGE_MONTHS_BACK);
  const rangeEnd = new Date(now);
  rangeEnd.setMonth(rangeEnd.getMonth() + RANGE_MONTHS_AHEAD);

  const events = parseIcs(icsText);
  const oneOnOnes = detectOneOnOnes(events, designers, rangeStart, rangeEnd);

  // Check which ones are already logged
  const existingDates = await db.oneOnOne.findMany({
    where: {
      date: { gte: rangeStart, lte: rangeEnd },
      designerId: { in: designers.map((d) => d.id) },
    },
    select: { designerId: true, date: true },
  });
  const existingSet = new Set(
    existingDates.map((e) => `${e.designerId}_${new Date(e.date).toDateString()}`)
  );

  const annotated = oneOnOnes.map((o) => ({
    ...o,
    occurrenceDate: o.occurrenceDate.toISOString(),
    alreadyLogged: existingSet.has(`${o.designerId}_${o.occurrenceDate.toDateString()}`),
  }));

  return NextResponse.json({
    detected: annotated,
    totalEvents: events.length,
    recurringEvents: events.filter((e) => e.isRecurring).length,
    designers: designers.length,
  });
}
