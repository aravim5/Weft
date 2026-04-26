// GET /api/partners — list all partners with feedback count
// POST /api/partners — create a new partner
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export async function GET() {
  const partners = await db.partner.findMany({
    where: { archivedAt: null },
    orderBy: { fullName: "asc" },
    include: {
      _count: { select: { feedback: true, outreach: true } },
    },
  });
  return NextResponse.json({ data: partners });
}

const CreateSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["engineering_manager", "product_manager", "client", "peer_designer", "cross_functional", "project_lead"]),
  orgOrTeam: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 422 });
  }
  const partner = await db.partner.create({ data: { ...parsed.data, source: "manual_form" } });
  return NextResponse.json({ data: partner }, { status: 201 });
}
