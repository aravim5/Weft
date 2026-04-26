import { NextRequest, NextResponse } from "next/server";
import { getEntityConfig } from "@/lib/entity-dispatcher";
import type { EntityType } from "@/lib/schemas/entities";

type Params = { params: Promise<{ type: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { type } = await params;
  const config = getEntityConfig(type as EntityType);
  if (!config) return NextResponse.json({ error: "Unknown entity type" }, { status: 404 });

  const url = new URL(req.url);
  const take = parseInt(url.searchParams.get("take") ?? "100");
  const skip = parseInt(url.searchParams.get("skip") ?? "0");
  const rows = await config.model.findMany({ where: { archivedAt: null }, take, skip, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { type } = await params;
  const config = getEntityConfig(type as EntityType);
  if (!config) return NextResponse.json({ error: "Unknown entity type" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = config.createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 422 });
  }

  const row = await config.model.create({ data: parsed.data });
  return NextResponse.json({ data: row }, { status: 201 });
}
