// POST /api/reports/narrative — generate AI team narrative from pre-computed metrics
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProvider } from "@/lib/ai/provider";
import { run as generateNarrative } from "@/lib/prompts/narrative-team-report";

const Body = z.object({
  teamSize: z.number(),
  reportDate: z.string(),
  metrics: z.object({
    impactEntriesThisQuarter: z.number(),
    topDimension: z.string(),
    positiveFeedbackRate: z.number(),
    averageHappiness: z.number().nullable(),
    happinessTrend: z.enum(["up", "flat", "down", "mixed"]),
    openRisks: z.number(),
    highSeverityRisks: z.number(),
    overdueActions: z.number(),
    biweeklyCompletionRate: z.number(),
    teamConcernCount: z.number(),
    topConcernTheme: z.string().nullable(),
    cycleReviewSignOffRate: z.number().nullable(),
  }),
  designersNeedingAttention: z.array(z.string()),
  recentWins: z.array(z.string()),
});

export async function POST(req: NextRequest) {
  const provider = getProvider();
  if (!provider.available) {
    return NextResponse.json({
      data: {
        title: "AI Disabled",
        narrative: "_Enable AI_MODE in .env.local to generate the team narrative._",
        aiDisabled: true,
      },
    });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 422 });
  }

  try {
    const result = await generateNarrative(parsed.data);
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("[reports/narrative]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
