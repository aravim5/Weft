/**
 * Job 1 — Extract from email (AI_JOB_SPECS.md §Job 1)
 *
 * Turn a pasted feedback email into structured rows:
 * - One or more `feedback` entries
 * - Optional `impact_entries`, `highlights`, `risk_signals`
 *
 * Model: Haiku 4.5 | Temp: 0.1 | Writes: proposal only (user approves before DB write)
 */
import { z } from "zod";
import { callHaiku } from "@/lib/claude";

// ── Input type ──────────────────────────────────────────────────────────────────

export interface ExtractEmailInput {
  senderName: string | null;
  senderEmail: string | null;
  subject: string | null;
  receivedOn: string | null; // ISO date string
  body: string;
  relatedDesigners: Array<{ id: string; fullName: string; email: string; productArea: string }>;
  relatedProjectId: string | null;
  relatedProjectName: string | null;
  relatedProjectDescription: string | null;
  existingPartner: { id: string; fullName: string; role: string } | null;
}

// ── Response schema (validated by Zod before any DB write) ──────────────────────

const ProposedFeedbackSchema = z.object({
  designerId: z.string(),
  feedbackSource: z.enum(["self", "peer", "manager", "project_lead", "client", "stakeholder"]),
  sentiment: z.enum(["positive", "neutral", "needs_improvement"]),
  theme: z.enum(["craft", "communication", "ownership", "collaboration", "leadership", "delivery", "growth"]),
  summary: z.string().max(250),
  quote: z.string().nullable(),
  occurredOn: z.string(), // ISO date
  confidence: z.enum(["low", "medium", "high"]),
});

const ProposedImpactEntrySchema = z.object({
  designerId: z.string(),
  dimension: z.enum(["craft_quality", "business_outcome", "team_multiplier", "client_trust", "innovation", "delivery_reliability", "mentorship"]),
  summary: z.string().max(250),
  evidence: z.string().nullable(),
  magnitude: z.enum(["small", "meaningful", "significant", "exceptional"]),
  date: z.string(), // ISO date
});

const ProposedHighlightSchema = z.object({
  designerId: z.string(),
  kind: z.enum(["standout_work", "kudos", "community", "mentorship", "speaking", "learning", "small_win", "big_win"]),
  description: z.string(),
  occurredOn: z.string(), // ISO date
});

const ProposedRiskSignalSchema = z.object({
  designerId: z.string(),
  signalType: z.enum(["engagement_drop", "comp_concern", "growth_blocked", "interpersonal_friction", "external_opportunity", "personal_life_change"]),
  severity: z.enum(["low", "med", "high"]),
  evidence: z.string().min(20),
});

export const responseSchema = z.object({
  senderMatch: z.enum(["existing", "unknown"]),
  proposedFeedback: z.array(ProposedFeedbackSchema),
  proposedImpactEntries: z.array(ProposedImpactEntrySchema).optional().default([]),
  proposedHighlights: z.array(ProposedHighlightSchema).optional().default([]),
  proposedRiskSignals: z.array(ProposedRiskSignalSchema).optional().default([]),
  extractionNotes: z.string(),
});

export type ExtractEmailOutput = z.infer<typeof responseSchema>;

// ── Tool schema (mirrors responseSchema as JSON Schema for tool_use) ──────────────

const TOOL_SCHEMA = {
  properties: {
    senderMatch: {
      type: "string",
      enum: ["existing", "unknown"],
      description: "Whether the sender matches an existing partner in the system.",
    },
    proposedFeedback: {
      type: "array",
      description: "Structured feedback rows extracted from the email. One entry per designer per distinct point.",
      items: {
        type: "object",
        required: ["designerId", "feedbackSource", "sentiment", "theme", "summary", "occurredOn", "confidence"],
        properties: {
          designerId: { type: "string", description: "ID from the provided designer roster." },
          feedbackSource: { type: "string", enum: ["self", "peer", "manager", "project_lead", "client", "stakeholder"] },
          sentiment: { type: "string", enum: ["positive", "neutral", "needs_improvement"] },
          theme: { type: "string", enum: ["craft", "communication", "ownership", "collaboration", "leadership", "delivery", "growth"] },
          summary: { type: "string", maxLength: 250, description: "Your one-sentence distillation (≤200 chars). Write as 'Sender praised X's...' or 'Sender flagged...'" },
          quote: { type: ["string", "null"], description: "Verbatim excerpt from the email that supports this feedback. Must appear verbatim in the body." },
          occurredOn: { type: "string", description: "ISO date. Default to the email's received_on date." },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
        },
      },
    },
    proposedImpactEntries: {
      type: "array",
      description: "Optional impact entries if the email describes a measurable outcome.",
      items: {
        type: "object",
        required: ["designerId", "dimension", "summary", "magnitude", "date"],
        properties: {
          designerId: { type: "string" },
          dimension: { type: "string", enum: ["craft_quality", "business_outcome", "team_multiplier", "client_trust", "innovation", "delivery_reliability", "mentorship"] },
          summary: { type: "string", maxLength: 250 },
          evidence: { type: ["string", "null"] },
          magnitude: { type: "string", enum: ["small", "meaningful", "significant", "exceptional"] },
          date: { type: "string" },
        },
      },
    },
    proposedHighlights: {
      type: "array",
      description: "Optional highlight rows for standout moments, kudos, wins.",
      items: {
        type: "object",
        required: ["designerId", "kind", "description", "occurredOn"],
        properties: {
          designerId: { type: "string" },
          kind: { type: "string", enum: ["standout_work", "kudos", "community", "mentorship", "speaking", "learning", "small_win", "big_win"] },
          description: { type: "string" },
          occurredOn: { type: "string" },
        },
      },
    },
    proposedRiskSignals: {
      type: "array",
      description: "Only propose risk signals if the email contains MULTIPLE concerning phrases — one offhand comment is not enough.",
      items: {
        type: "object",
        required: ["designerId", "signalType", "severity", "evidence"],
        properties: {
          designerId: { type: "string" },
          signalType: { type: "string", enum: ["engagement_drop", "comp_concern", "growth_blocked", "interpersonal_friction", "external_opportunity", "personal_life_change"] },
          severity: { type: "string", enum: ["low", "med", "high"] },
          evidence: { type: "string", minLength: 20, description: "Quote the specific phrases that support this." },
        },
      },
    },
    extractionNotes: {
      type: "string",
      description: "One short paragraph: what you saw in the email, why you made the extraction choices you did, anything ambiguous.",
    },
  },
  required: ["senderMatch", "proposedFeedback", "extractionNotes"],
};

// ── System prompt ───────────────────────────────────────────────────────────────

export const systemPrompt = `You are a careful note-taker for a design team manager. Your job is to extract structured feedback data from emails — not to interpret, judge, or embellish.

RULES:
1. Extract only what is explicitly stated. Do not infer intent or fill gaps.
2. One feedback row per designer per distinct point of feedback. Do not merge separate observations.
3. For "quote": copy verbatim from the email body. If no exact quotable phrase exists, set quote to null.
4. For "sentiment": use the explicit tone. "Neutral" means factual/status, not mixed.
5. For "confidence": set "low" when the email is ambiguous about who or what is being described.
6. For risk_signals: require MULTIPLE concerning phrases. One offhand negative comment is not a risk signal.
7. For impact_entries: only extract if the email describes a measurable or concrete outcome.
8. If the email is scheduling chatter, a logistics update, or contains no feedback: return empty proposedFeedback with an explanation in extractionNotes.
9. Never invent facts. If you're unsure, say so in extractionNotes and set confidence=low.
10. Preserve the designer's or sender's own words when quoting. Never paraphrase into a direct quote.

SENSITIVE DATA:
- Do not produce content that would be harmful if a designer read it.
- Do not recommend promotions, terminations, compensation, or hiring decisions.
- Distinguish observation from interpretation explicitly in extractionNotes.`;

// ── User prompt builder ─────────────────────────────────────────────────────────

export function buildUserPrompt(input: ExtractEmailInput): string {
  const designers = input.relatedDesigners.map(
    (d) => `  - ${d.fullName} (id: ${d.id}, area: ${d.productArea})`
  ).join("\n");

  const partnerCtx = input.existingPartner
    ? `Sender is a known partner: ${input.existingPartner.fullName} (${input.existingPartner.role}), id=${input.existingPartner.id}`
    : "Sender is NOT a known partner in the system.";

  const projectCtx = input.relatedProjectName
    ? `Related project: "${input.relatedProjectName}" — ${input.relatedProjectDescription ?? "no description"}`
    : "No project context provided.";

  return `EMAIL TO EXTRACT FROM:
---
From: ${input.senderName ?? "Unknown"} <${input.senderEmail ?? "unknown"}>
Subject: ${input.subject ?? "(no subject)"}
Date: ${input.receivedOn ?? "unknown"}

${input.body}
---

CONTEXT:
${partnerCtx}
${projectCtx}

DESIGNER ROSTER (the feedback is about one or more of these people):
${designers}

Use the designer IDs from the roster exactly as listed. Extract all feedback about any of these designers.`;
}

// ── Quote validator ─────────────────────────────────────────────────────────────

function normalizeForQuoteMatch(s: string): string {
  return s.replace(/[""]/g, '"').replace(/['']/g, "'").replace(/\s+/g, " ").trim();
}

function validateQuotes(output: ExtractEmailOutput, body: string): ExtractEmailOutput {
  const normalizedBody = normalizeForQuoteMatch(body);
  return {
    ...output,
    proposedFeedback: output.proposedFeedback.map((f) => {
      if (!f.quote) return f;
      const normalizedQuote = normalizeForQuoteMatch(f.quote);
      if (!normalizedBody.includes(normalizedQuote)) {
        console.warn(`[extract-email] Dropping quote that doesn't appear verbatim in body: "${f.quote.substring(0, 60)}..."`);
        return { ...f, quote: null };
      }
      return f;
    }),
  };
}

// ── run() ───────────────────────────────────────────────────────────────────────

export async function run(input: ExtractEmailInput): Promise<ExtractEmailOutput> {
  const result = await callHaiku(
    "extract-email",
    systemPrompt,
    buildUserPrompt(input),
    {
      toolName: "submit_email_extraction",
      toolDescription: "Submit the structured extraction result from the feedback email.",
      toolSchema: TOOL_SCHEMA,
      responseSchema,
    },
    0.1,
  );

  return validateQuotes(result, input.body);
}
