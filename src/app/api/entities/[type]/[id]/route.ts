import { NextRequest, NextResponse } from "next/server";
import { getEntityConfig } from "@/lib/entity-dispatcher";
import type { EntityType } from "@/lib/schemas/entities";

type Params = { params: Promise<{ type: string; id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { type, id } = await params;
  const config = getEntityConfig(type as EntityType);
  if (!config) return NextResponse.json({ error: "Unknown entity type" }, { status: 404 });

  const row = await config.model.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: row });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { type, id } = await params;
  const config = getEntityConfig(type as EntityType);
  if (!config) return NextResponse.json({ error: "Unknown entity type" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = config.updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 422 });
  }

  const row = await config.model.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ data: row });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { type, id } = await params;
  const config = getEntityConfig(type as EntityType);
  if (!config) return NextResponse.json({ error: "Unknown entity type" }, { status: 404 });

  // Soft delete — set archivedAt
  const row = await config.model.update({ where: { id }, data: { archivedAt: new Date() } });
  return NextResponse.json({ data: row });
}
