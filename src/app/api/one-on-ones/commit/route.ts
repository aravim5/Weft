// POST /api/one-on-ones/commit — save approved 1:1 extraction in a transaction
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const RequestSchema = z.object({
  designerId: z.string(),
  meetingDate: z.string(),
  oneOnOne: z.object({
    mood: z.enum(["down","flat","steady","up","energized"]).nullable().optional(),
    happinessIndex: z.number().min(1).max(10).nullable().optional(),
    happinessSource: z.enum(["self_reported","my_read"]).nullable().optional(),
    topicsDiscussed: z.string(),
    vibeNotes: z.string().nullable().optional(),
    durationMinutes: z.number().nullable().optional(),
    nextMeetingOn: z.string().nullable().optional(),
  }),
  blockers: z.array(z.object({
    description: z.string(),
    owner: z.enum(["designer","you","partner","other"]).optional(),
  })).optional().default([]),
  actionItems: z.array(z.object({
    description: z.string(),
    dueDate: z.string().nullable().optional(),
  })).optional().default([]),
  wins: z.array(z.object({
    description: z.string(),
    kind: z.enum(["standout_work","kudos","community","mentorship","speaking","learning","small_win","big_win"]).optional(),
    occurredOn: z.string().optional(),
  })).optional().default([]),
  teamConcerns: z.array(z.object({
    concern: z.string(),
    theme: z.enum(["process","tooling","leadership","cross_team","morale","comp_fairness","workload","career_growth","other"]),
    severity: z.enum(["low","med","high"]),
  })).optional().default([]),
  riskSignal: z.object({
    signalType: z.enum(["engagement_drop","comp_concern","growth_blocked","interpersonal_friction","external_opportunity","personal_life_change"]),
    severity: z.enum(["low","med","high"]),
    evidence: z.string(),
  }).nullable().optional(),
});

function parseDate(s?: string | null): Date {
  if (!s) return new Date();
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 422 });
  }
  const data = parsed.data;
  const createdBy = process.env.APP_USER_EMAIL ?? "owner";

  const result = await db.$transaction(async (tx) => {
    // Create the 1:1 record
    const oneOnOne = await tx.oneOnOne.create({
      data: {
        designerId: data.designerId,
        date: parseDate(data.meetingDate),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mood: data.oneOnOne.mood as any ?? null,
        happinessIndex: data.oneOnOne.happinessIndex ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        happinessSource: data.oneOnOne.happinessSource as any ?? null,
        topicsDiscussed: data.oneOnOne.topicsDiscussed,
        vibeNotes: data.oneOnOne.vibeNotes ?? null,
        durationMinutes: data.oneOnOne.durationMinutes ?? null,
        nextMeetingOn: data.oneOnOne.nextMeetingOn ? parseDate(data.oneOnOne.nextMeetingOn) : null,
        source: "manual_form",
        createdBy,
      },
    });

    // Blockers
    const blockers = await Promise.all(data.blockers.map((b) =>
      tx.blocker.create({
        data: {
          designerId: data.designerId,
          oneOnOneId: oneOnOne.id,
          description: b.description,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          owner: (b.owner ?? "you") as any,
          raisedOn: parseDate(data.meetingDate),
          source: "manual_form",
          createdBy,
        },
      })
    ));

    // Action items
    const actionItems = await Promise.all(data.actionItems.map((a) =>
      tx.actionItem.create({
        data: {
          designerId: data.designerId,
          oneOnOneId: oneOnOne.id,
          description: a.description,
          dueDate: a.dueDate ? parseDate(a.dueDate) : null,
          source: "manual_form",
          createdBy,
        },
      })
    ));

    // Wins → highlights
    const wins = await Promise.all(data.wins.map((w) =>
      tx.highlight.create({
        data: {
          designerId: data.designerId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          kind: (w.kind ?? "small_win") as any,
          description: w.description,
          occurredOn: parseDate(w.occurredOn ?? data.meetingDate),
          source: "manual_form",
          createdBy,
        },
      })
    ));

    // Team concerns
    const concerns = await Promise.all(data.teamConcerns.map((c) =>
      tx.teamConcern.create({
        data: {
          raisedByDesignerId: data.designerId,
          oneOnOneId: oneOnOne.id,
          concern: c.concern,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          theme: c.theme as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          severity: c.severity as any,
          occurredOn: new Date(),
          source: "manual_form",
          createdBy,
        },
      })
    ));

    // Risk signal (optional)
    let riskSignal = null;
    if (data.riskSignal) {
      riskSignal = await tx.riskSignal.create({
        data: {
          designerId: data.designerId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          signalType: data.riskSignal.signalType as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          severity: data.riskSignal.severity as any,
          evidence: data.riskSignal.evidence,
          detectedOn: parseDate(data.meetingDate),
          autoDecayOn: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          source: "manual_form",
          createdBy,
        },
      });
    }

    return {
      oneOnOneId: oneOnOne.id,
      blockers: blockers.length,
      actionItems: actionItems.length,
      wins: wins.length,
      concerns: concerns.length,
      riskSignal: !!riskSignal,
    };
  });

  return NextResponse.json({
    status: "committed",
    ...result,
    summary: `Logged 1:1. Created ${result.blockers} blockers, ${result.actionItems} actions, ${result.wins} wins, ${result.concerns} concerns.`,
  });
}
