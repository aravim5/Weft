/**
 * Job 2 — Extract from free-form note (AI_JOB_SPECS.md §Job 2)
 *
 * Turn pasted free-form text (rough notes, Slack pastes, personal observations)
 * into structured rows. No sender context — source defaults to "self".
 *
 * Model: Haiku 4.5 | Temp: 0.1 | Writes: proposal only (user approves)
 */
import { z } from "zod";
import { callHaiku } from "@/lib/claude";

// ── Input type ───────────────────────────────────────────────────────────────

export interface ExtractNoteInput {
  body: string;
  noteDate: string | null; // ISO date — when the observation was made
  relatedDesigners: Array<{ id: string; fullName: string; email: string; productArea: string }>;
  relatedProjectId: string | null;
  relatedProjectName: string | null;
  relatedProjectDescription: string | null;
}

// ── Response schema ──────────────────────────────────────────────────────────

const ProposedFeedbackSchema = z.object({
  designerId: z.string(),
  feedbackSource: z.enum(["self", "peer", "manager", "project_lead", "client", "stakeholder"]),
  sentiment: z.enum(["positive", "neutral", "needs_improvement"]),
  theme: z.enum(["craft", "communication", "ownership", "collaboration", "leadership", "delivery", "growth"]),
  summary: z.string().max(250),
  quote: z.string().nullable(),
  occurredOn: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
});

const ProposedImpactEntrySchema = z.object({
  designerId: z.string(),
  dimension: z.enum(["craft_quality", "business_outcome", "team_multiplier", "client_trust", "innovation", "delivery_reliability", "mentorship"]),
  summary: z.string().max(250),
  evidence: z.string().nullable(),
  magnitude: z.enum(["small", "meaningful", "significant", "exceptional"]),
  date: z.string(),
});

const ProposedHighlightSchema = z.object({
  designerId: z.string(),
  kind: z.enum(["standout_work", "kudos", "community", "mentorship", "speaking", "learning", "small_win", "big_win"]),
  description: z.string(),
  occurredOn: z.string(),
});

const ProposedRiskSignalSchema = z.object({
  designerId: z.string(),
  signalType: z.enum(["engagement_drop", "comp_concern", "growth_blocked", "interpersonal_friction", "external_opportunity", "personal_life_change"]),
  severity: z.enum(["low", "med", "high"]),
  evidence: z.string().min(20),
});

export const responseSchema = z.object({
  proposedFeedback: z.array(ProposedFeedbackSchema),
  proposedImpactEntries: z.array(ProposedImpactEntrySchema).optional().default([]),
  proposedHighlights: z.array(ProposedHighlightSchema).optional().default([]),
  proposedRiskSignals: z.array(ProposedRiskSignalSchema).optional().default([]),
  extractionNotes: z.string(),
});

export type ExtractNoteOutput = z.infer<typeof responseSchema>;

// ── Tool schema ──────────────────────────────────────────────────────────────

const TOOL_SCHEMA = {
  properties: {
    proposedFeedback: {
      type: "array",
      description: "Structured feedback rows. Source defaults to 'self' since this is the manager's own note.",
      items: {
        type: "object",
        required: ["designerId", "feedbackSource", "sentiment", "theme", "summary", "occurredOn", "confidence"],
        properties: {
          designerId: { type: "string", description: "ID from the designer roster." },
          feedbackSource: { type: "string", enum: ["self", "peer", "manager", "project_lead", "client", "stakeholder"], description: "Default 'self' for manager's own observations." },
          sentiment: { type: "string", enum: ["positive", "neutral", "needs_improvement"] },
          theme: { type: "string", enum: ["craft", "communication", "ownership", "collaboration", "leadership", "delivery", "growth"] },
          summary: { type: "string", maxLength: 250, description: "One sentence. Write as 'Observed that X...' for own notes." },
          quote: { type: ["string", "null"], description: "Only quote if the note clearly pastes someone else's words verbatim. Otherwise null." },
          occurredOn: { type: "string", description: "ISO date. Default to the note date if not specified." },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
        },
      },
    },
    proposedImpactEntries: {
      type: "array",
      description: "Optional impact entries for measurable/concrete outcomes described in the note.",
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
      description: "Optional highlights for standout moments, wins, or kudos mentioned in the note.",
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
      description: "Only propose if the note contains MULTIPLE concerning signals — not a single offhand mention.",
      items: {
        type: "object",
        required: ["designerId", "signalType", "severity", "evidence"],
        properties: {
          designerId: { type: "string" },
          signalType: { type: "string", enum: ["engagement_drop", "comp_concern", "growth_blocked", "interpersonal_friction", "external_opportunity", "personal_life_change"] },
          severity: { type: "string", enum: ["low", "med", "high"] },
          evidence: { type: "string", minLength: 20, description: "Quote or paraphrase the specific phrases that support this signal." },
        },
      },
    },
    extractionNotes: {
      type: "string",
      description: "One short paragraph: what you saw, why you made these extraction choices, anything ambiguous.",
    },
  },
  required: ["proposedFeedback", "extractionNotes"],
};

// ── System prompt ────────────────────────────────────────────────────────────

export const systemPrompt = `You are a careful note-taker for a design team manager. Your job is to extract structured data from the manager's own rough notes — not to interpret, judge, or embellish.

RULES:
1. Extract only what is explicitly stated. Do not infer intent or fill gaps.
2. This note is the manager's OWN observation, so feedbackSource defaults to "self" unless the note clearly attributes an observation to someone else.
3. For "quote": only use verbatim quotes if the note clearly pastes someone else's words. For the manager's own observations, set quote to null.
4. One feedback row per designer per distinct point. Do not merge separate observations.
5. For "sentiment": use the explicit tone of the note. "Neutral" means factual/status updates.
6. For "confidence": set "low" when the note is ambiguous about who or what is being described.
7. For risk_signals: require MULTIPLE concerning phrases. One offhand negative comment is not a risk signal.
8. For impact_entries: only extract if the note describes a measurable or concrete outcome.
9. If the note is a to-do list, scheduling note, or contains no feedback: return empty proposedFeedback with an explanation in extractionNotes.
10. Never invent facts. If unsure, say so in extractionNotes and set confidence=low.

SENSITIVE DATA:
- Do not produce content that would be harmful if a designer read it.
- Do not recommend promotions, terminations, compensation, or hiring decisions.
- Distinguish observation from interpretation explicitly in extractionNotes.`;

// ── User prompt builder ──────────────────────────────────────────────────────

export function buildUserPrompt(input: ExtractNoteInput): string {
  const designers = input.relatedDesigners
    .map((d) => `  - ${d.fullName} (id: ${d.id}, area: ${d.productArea})`)
    .join("\n");

  const projectCtx = input.relatedProjectName
    ? `Related project: "${input.relatedProjectName}" — ${input.relatedProjectDescription ?? "no description"}`
    : "No project context provided.";

  return `NOTE TO EXTRACT FROM:
---
Date: ${input.noteDate ?? "unknown"}

${input.body}
---

CONTEXT:
${projectCtx}

DESIGNER ROSTER (the note is about one or more of these people):
${designers}

Use the designer IDs from the roster exactly as listed. Extract all observations about any of these designers. Default feedbackSource to "self" since this is the manager's own note.`;
}

// ── run() ────────────────────────────────────────────────────────────────────

export async function run(input: ExtractNoteInput): Promise<ExtractNoteOutput> {
  return callHaiku(
    "extract-note",
    systemPrompt,
    buildUserPrompt(input),
    {
      toolName: "submit_note_extraction",
      toolDescription: "Submit the structured extraction result from the manager's note.",
      toolSchema: TOOL_SCHEMA,
      responseSchema,
    },
    0.1,
  );
}
