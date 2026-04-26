// POST /api/concerns/cluster — run Job 10 clustering on open team concerns
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { run as clusterConcerns } from "@/lib/prompts/cluster-team-concerns";
import { getProvider } from "@/lib/ai/provider";

export async function POST() {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const concerns = await db.teamConcern.findMany({
    where: { archivedAt: null, status: { in: ["noted", "acting"] }, createdAt: { gte: ninetyDaysAgo } },
    include: { raisedBy: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
  });

  if (concerns.length === 0) {
    return NextResponse.json({ clusters: [], orphans: [], generatedAt: new Date().toISOString(), concernCount: 0 });
  }

  const provider = getProvider();
  if (!provider.available) {
    return NextResponse.json({
      clusters: [], orphans: concerns.map((c) => c.id),
      generatedAt: new Date().toISOString(),
      aiDisabled: true,
    });
  }

  try {
    const result = await clusterConcerns({
      concerns: concerns.map((c) => ({
        id: c.id,
        concern: c.concern,
        theme: c.theme,
        severity: c.severity,
        raisedByDesignerName: c.raisedBy.fullName,
        createdAt: c.createdAt.toISOString().slice(0, 10),
        status: c.status,
      })),
    });
    return NextResponse.json({ ...result, concernCount: concerns.length });
  } catch (err) {
    console.error("[concerns/cluster]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
