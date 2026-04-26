// GET /api/audit — paginated audit log with optional filters
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = 50;
  const skip = (page - 1) * limit;
  const jobName = searchParams.get("jobName") ?? undefined;
  const userAction = searchParams.get("userAction") ?? undefined;

  const where = {
    ...(jobName ? { jobName } : {}),
    ...(userAction ? { userAction } : {}),
  };

  const [entries, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.auditLog.count({ where }),
  ]);

  // Resolve designer names for entries that have a designerId
  const designerIds = [...new Set(entries.map((e) => e.designerId).filter(Boolean))] as string[];
  const designers =
    designerIds.length > 0
      ? await db.designer.findMany({
          where: { id: { in: designerIds } },
          select: { id: true, fullName: true },
        })
      : [];
  const designerMap = new Map(designers.map((d) => [d.id, d]));

  const data = entries.map((e) => ({
    ...e,
    designer: e.designerId ? (designerMap.get(e.designerId) ?? null) : null,
  }));

  return NextResponse.json({
    data,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}
