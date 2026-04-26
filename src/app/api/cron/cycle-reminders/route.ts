// POST /api/cron/cycle-reminders — 4wk/2wk/1wk banners for upcoming cycles
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST() {
  const now = new Date();

  const upcomingCycles = await db.reviewCycle.findMany({
    where: {
      archivedAt: null,
      status: { in: ["planned", "outreach_sent", "collecting", "summarizing"] },
      checkinDate: { gte: now },
    },
    orderBy: { checkinDate: "asc" },
    take: 5,
  });

  const reminders = upcomingCycles.map((cycle) => {
    const daysUntil = Math.ceil((cycle.checkinDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    let urgency: "info" | "nudge" | "urgent" = "info";
    let message = "";

    if (daysUntil <= 7) {
      urgency = "urgent";
      message = `${cycle.quarter} ${cycle.year} check-in is in ${daysUntil} day${daysUntil !== 1 ? "s" : ""} — generate draft summaries now.`;
    } else if (daysUntil <= 14) {
      urgency = "nudge";
      message = `${cycle.quarter} ${cycle.year}: ${daysUntil} days to go — have you received enough responses?`;
    } else if (daysUntil <= 28) {
      urgency = "info";
      message = `${cycle.quarter} ${cycle.year} outreach is due to start — plan your (designer × partner) matrix.`;
    }

    return { cycleId: cycle.id, quarter: cycle.quarter, year: cycle.year, daysUntil, urgency, message, status: cycle.status };
  });

  return NextResponse.json({ reminders, checkedAt: now.toISOString() });
}
