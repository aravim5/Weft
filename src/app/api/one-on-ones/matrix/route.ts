// GET /api/one-on-ones/matrix?year=2026
// Returns all designers + their logged 1:1s for the year, keyed by YYYY-MM
// Also returns calendar occurrences (from imported ICS data) when available
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const year = parseInt(req.nextUrl.searchParams.get("year") ?? "2026");
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);

  const [designers, oneOnOnes] = await Promise.all([
    db.designer.findMany({
      where: { archivedAt: null, currentStatus: "active" },
      select: { id: true, fullName: true, productArea: true, level: true },
      orderBy: { fullName: "asc" },
    }),
    db.oneOnOne.findMany({
      where: {
        archivedAt: null,
        date: { gte: yearStart, lte: yearEnd },
      },
      select: {
        id: true,
        designerId: true,
        date: true,
        durationMinutes: true,
        mood: true,
        happinessIndex: true,
        topicsDiscussed: true,
        source: true,
      },
      orderBy: { date: "asc" },
    }),
  ]);

  // Group 1:1s by designerId + month key (YYYY-MM)
  const loggedMap: Record<string, Record<string, {
    id: string;
    date: string;
    durationMinutes: number | null;
    mood: string | null;
    happinessIndex: number | null;
    topicsDiscussed: string;
    source: string;
  }>> = {};

  for (const o of oneOnOnes) {
    const d = new Date(o.date);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!loggedMap[o.designerId]) loggedMap[o.designerId] = {};
    // If multiple in a month, keep the most recent
    if (!loggedMap[o.designerId][monthKey] || new Date(o.date) > new Date(loggedMap[o.designerId][monthKey].date)) {
      loggedMap[o.designerId][monthKey] = {
        id: o.id,
        date: new Date(o.date).toISOString(),
        durationMinutes: o.durationMinutes,
        mood: o.mood,
        happinessIndex: o.happinessIndex,
        topicsDiscussed: o.topicsDiscussed,
        source: o.source,
      };
    }
  }

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(year, i, 1);
    return {
      key: `${year}-${String(i + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-US", { month: "short" }),
      month: i,
      year,
    };
  });

  const now = new Date();

  const rows = designers.map((d) => ({
    designerId: d.id,
    fullName: d.fullName,
    productArea: d.productArea,
    level: d.level,
    months: months.map((m) => {
      const logged = loggedMap[d.id]?.[m.key] ?? null;
      const monthDate = new Date(year, m.month, 1);
      const isPast = monthDate < new Date(now.getFullYear(), now.getMonth(), 1);
      const isCurrent = monthDate.getFullYear() === now.getFullYear() && monthDate.getMonth() === now.getMonth();
      const isFuture = monthDate > new Date(now.getFullYear(), now.getMonth(), 1);

      return {
        monthKey: m.key,
        label: m.label,
        state: logged ? "logged" : isPast ? "missed" : isCurrent ? "current" : "upcoming",
        logged,
        isPast,
        isCurrent,
        isFuture,
      };
    }),
  }));

  return NextResponse.json({ rows, months, year });
}
