// GET /api/action-items — open action items for the my-actions inbox
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const items = await db.actionItem.findMany({
    where: {
      archivedAt: null,
      status: { in: ["open", "in_progress", "snoozed"] },
    },
    include: {
      designer: { select: { id: true, fullName: true } },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({
    data: items.map((a) => ({
      id: a.id,
      description: a.description,
      dueDate: a.dueDate?.toISOString() ?? null,
      status: a.status,
      snoozedUntil: a.snoozedUntil?.toISOString() ?? null,
      designerId: a.designerId ?? null,
      designerName: a.designer?.fullName ?? null,
    })),
  });
}
