// POST /api/cron/biweekly-reminders — create new biweek rows, set overdue on stale ones
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

function currentBiweek(): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 13);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

export async function POST() {
  const { start, end } = currentBiweek();

  const designers = await db.designer.findMany({
    where: { archivedAt: null },
    select: { id: true },
  });

  let created = 0;
  let markedOverdue = 0;

  await db.$transaction(async (tx) => {
    for (const d of designers) {
      const existing = await tx.biweeklyCheckin.findFirst({
        where: { designerId: d.id, biweekStart: start },
      });
      if (!existing) {
        await tx.biweeklyCheckin.create({
          data: {
            designerId: d.id,
            biweekStart: start,
            biweekEnd: end,
            status: "upcoming",
            source: "manual_form",
          },
        });
        created++;
      }
    }

    const overdueResult = await tx.biweeklyCheckin.updateMany({
      where: {
        biweekEnd: { lt: start },
        status: { in: ["upcoming", "in_progress"] },
      },
      data: { status: "overdue" },
    });
    markedOverdue = overdueResult.count;
  });

  return NextResponse.json({
    status: "ok",
    biweekStart: start.toISOString(),
    biweekEnd: end.toISOString(),
    created,
    markedOverdue,
    designerCount: designers.length,
  });
}
