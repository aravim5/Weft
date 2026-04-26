// GET /api/checkins/biweekly — overview: all designers + current biweek checkin status
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

function currentBiweek(): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon...
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 13);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

export async function GET() {
  const { start, end } = currentBiweek();

  const designers = await db.designer.findMany({
    where: { archivedAt: null },
    include: {
      biweeklyCheckins: {
        where: { biweekStart: start },
        select: { id: true, status: true, sectionsTouched: true, completedOn: true },
        take: 1,
      },
    },
    orderBy: { fullName: "asc" },
  });

  const daysRemaining = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const complete = designers.filter((d) => d.biweeklyCheckins[0]?.status === "complete").length;

  return NextResponse.json({
    biweekStart: start.toISOString(),
    biweekEnd: end.toISOString(),
    daysRemaining,
    completionRate: designers.length > 0 ? Math.round((complete / designers.length) * 100) : 0,
    designers: designers.map((d) => {
      const checkin = d.biweeklyCheckins[0] ?? null;
      const touched = checkin ? Object.keys(JSON.parse(checkin.sectionsTouched ?? "{}")).length : 0;
      return {
        id: d.id,
        fullName: d.fullName,
        title: d.level,
        checkinId: checkin?.id ?? null,
        status: checkin?.status ?? "upcoming",
        sectionsTouched: touched,
        completedOn: checkin?.completedOn?.toISOString() ?? null,
      };
    }),
  });
}
