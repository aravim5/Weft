// POST /api/ingest/email/commit — save approved proposals, mark inbox email processed
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const ApprovedFeedbackSchema = z.object({
  designerId: z.string(),
  partnerId: z.string().nullable().optional(),
  feedbackSource: z.enum(["self", "peer", "manager", "project_lead", "client", "stakeholder"]),
  sentiment: z.enum(["positive", "neutral", "needs_improvement"]),
  theme: z.enum(["craft", "communication", "ownership", "collaboration", "leadership", "delivery", "growth"]),
  summary: z.string(),
  quote: z.string().nullable().optional(),
  confidence: z.enum(["low", "medium", "high"]).optional(),
  occurredOn: z.string().optional(),
  projectId: z.string().nullable().optional(),
});

const ApprovedImpactEntrySchema = z.object({
  designerId: z.string(),
  projectId: z.string().nullable().optional(),
  dimension: z.enum(["craft_quality", "business_outcome", "team_multiplier", "client_trust", "innovation", "delivery_reliability", "mentorship"]),
  magnitude: z.enum(["small", "meaningful", "significant", "exceptional"]),
  summary: z.string(),
  date: z.string().optional(),
  occurredOn: z.string().optional(),
});

const ApprovedHighlightSchema = z.object({
  designerId: z.string(),
  kind: z.enum(["standout_work", "kudos", "community", "mentorship", "speaking", "learning", "small_win", "big_win"]),
  description: z.string(),
  occurredOn: z.string().optional(),
  projectId: z.string().nullable().optional(),
});

const ApprovedRiskSignalSchema = z.object({
  designerId: z.string(),
  signalType: z.enum(["engagement_drop", "comp_concern", "growth_blocked", "interpersonal_friction", "external_opportunity", "personal_life_change"]),
  severity: z.enum(["low", "med", "high"]),
  evidence: z.string(),
  occurredOn: z.string().optional(),
});

const NewPartnerSchema = z.object({
  fullName: z.string(),
  email: z.string().optional(),
  role: z.string().optional(),
  orgOrTeam: z.string().optional(),
});

const RequestSchema = z.object({
  inboxEmailId: z.string(),
  approved: z.object({
    feedback: z.array(ApprovedFeedbackSchema).optional().default([]),
    impactEntries: z.array(ApprovedImpactEntrySchema).optional().default([]),
    highlights: z.array(ApprovedHighlightSchema).optional().default([]),
    riskSignals: z.array(ApprovedRiskSignalSchema).optional().default([]),
  }),
  partner: z.union([
    z.object({ existingId: z.string() }),
    z.object({ new: NewPartnerSchema }),
  ]).nullable().optional(),
});

function parseDate(s?: string | null): Date {
  if (!s) return new Date();
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

function ninetyDaysOut(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 90);
  return d;
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

  const { inboxEmailId, approved, partner } = parsed.data;

  const inboxEmail = await db.inboxEmail.findUnique({ where: { id: inboxEmailId } });
  if (!inboxEmail) {
    return NextResponse.json({ error: "InboxEmail not found" }, { status: 404 });
  }
  if (inboxEmail.status === "processed") {
    return NextResponse.json({ error: "Already processed", inboxEmailId }, { status: 409 });
  }

  const createdBy = process.env.APP_USER_EMAIL ?? "owner";

  const result = await db.$transaction(async (tx) => {
    // Upsert partner if provided
    let resolvedPartnerId: string | null = null;
    if (partner) {
      if ("existingId" in partner) {
        resolvedPartnerId = partner.existingId;
      } else {
        const email = partner.new.email?.trim() || `partner-${Date.now()}@placeholder.local`;
        const existing = await tx.partner.findUnique({ where: { email } });
        if (existing) {
          resolvedPartnerId = existing.id;
        } else {
          const p = await tx.partner.create({
            data: {
              fullName: partner.new.fullName,
              email,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              role: (partner.new.role ?? "cross_functional") as any,
              orgOrTeam: partner.new.orgOrTeam ?? null,
              createdBy,
            },
          });
          resolvedPartnerId = p.id;
        }
      }
    }

    // Insert feedback rows
    const feedbackRows = await Promise.all(
      approved.feedback.map((f) =>
        tx.feedback.create({
          data: {
            designerId: f.designerId,
            partnerId: resolvedPartnerId ?? f.partnerId ?? null,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            feedbackSource: f.feedbackSource as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sentiment: f.sentiment as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            theme: f.theme as any,
            summary: f.summary,
            quote: f.quote ?? null,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            confidence: (f.confidence ?? "medium") as any,
            occurredOn: parseDate(f.occurredOn),
            inboxEmailId,
            source: "ai_extracted",
            createdBy,
          },
        })
      )
    );

    // Insert impact entries (Prisma field is `date`, not `occurredOn`)
    const impactRows = await Promise.all(
      approved.impactEntries.map((ie) =>
        tx.impactEntry.create({
          data: {
            designerId: ie.designerId,
            projectId: ie.projectId ?? null,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            dimension: ie.dimension as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            magnitude: ie.magnitude as any,
            summary: ie.summary,
            date: parseDate(ie.date ?? ie.occurredOn),
            source: "ai_extracted",
            createdBy,
          },
        })
      )
    );

    // Insert highlights
    const highlightRows = await Promise.all(
      approved.highlights.map((h) =>
        tx.highlight.create({
          data: {
            designerId: h.designerId,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            kind: h.kind as any,
            description: h.description,
            occurredOn: parseDate(h.occurredOn),
            inboxEmailId,
            source: "ai_extracted",
            createdBy,
          },
        })
      )
    );

    // Insert risk signals
    const riskRows = await Promise.all(
      approved.riskSignals.map((r) =>
        tx.riskSignal.create({
          data: {
            designerId: r.designerId,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            signalType: r.signalType as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            severity: r.severity as any,
            evidence: r.evidence,
            detectedOn: parseDate(r.occurredOn),
            autoDecayOn: ninetyDaysOut(),
            inboxEmailId,
            source: "ai_extracted",
            createdBy,
          },
        })
      )
    );

    // Mark inbox email processed
    await tx.inboxEmail.update({
      where: { id: inboxEmailId },
      data: { status: "processed" },
    });

    return {
      feedback: feedbackRows.length,
      impactEntries: impactRows.length,
      highlights: highlightRows.length,
      riskSignals: riskRows.length,
      partnerId: resolvedPartnerId,
    };
  });

  const primaryDesignerId =
    approved.feedback[0]?.designerId ??
    approved.impactEntries[0]?.designerId ??
    approved.highlights[0]?.designerId ??
    approved.riskSignals[0]?.designerId ??
    null;

  return NextResponse.json({
    status: "committed",
    inboxEmailId,
    ...result,
    primaryDesignerId,
    summary: `Saved ${result.feedback} feedback, ${result.impactEntries} impact entries, ${result.highlights} highlights, ${result.riskSignals} risk signals.`,
  });
}
