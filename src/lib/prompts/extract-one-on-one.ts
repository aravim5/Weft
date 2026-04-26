/**
 * Job 3 — Extract from 1:1 notes (AI_JOB_SPECS.md §Job 3)
 *
 * Turn raw 1:1 meeting notes into structured rows:
 * - Updated one_on_one record (mood, happiness, topics, vibe_notes)
 * - Proposed blockers, action items, wins, team concerns, risk signal
 *
 * Model: Sonnet | Temp: 0.2 | Writes: proposal only (user approves before DB write)
 */
import { z } from "zod";
import { callSonnet } from "@/lib/claude";

// ── Input type ──────────────────────────────────────────────────────────────────

export interface ExtractOneOnOneInput {
  rawNotes: string;
  meetingDate: string; // ISO date
  designerId: string;
  designerName: string;
  recentOneOnOnes: Array<{ date: string; topicsDiscussed: string; happinessIndex: number | null }>;
  openBlockers: Array<{ id: string; description: string }>;
  openActionItems: Array<{ id: string; description: string; dueDate: string | null }>;
}

// ── Response schema (validated by Zod before any DB write) ──────────────────────

export const responseSchema = z.object({
  oneOnOne: z.object({
    mood: z.enum(["down", "flat", "steady", "up", "energized"]).nullable(),
    happinessIndex: z.number().min(1).max(10).nullable(),
    happinessSource: z.enum(["self_reported", "my_read"]).nullable(),
    topicsDiscussed: z.string(), // markdown summary
    vibeNotes: z.string().nullable(), // owner-only observations
  }),
  proposedBlockers: z.array(
    z.object({
      description: z.string(),
      projectId: z.string().nullable(),
      owner: z.enum(["designer", "you", "partner", "other"]),
    })
  ),
  proposedActionItems: z.array(
    z.object({
      description: z.string(),
      dueDate: z.string().nullable(), // ISO date
    })
  ),
  proposedWins: z.array(
    z.object({
      description: z.string(),
      size: z.enum(["small_win", "big_win"]),
      occurredOn: z.string(),
    })
  ),
  proposedTeamConcerns: z.array(
    z.object({
      concern: z.string(),
      theme: z.enum([
        "process",
        "tooling",
        "leadership",
        "cross_team",
        "morale",
        "comp_fairness",
        "workload",
        "career_growth",
        "other",
      ]),
      severity: z.enum(["low", "med", "high"]),
    })
  ),
  proposedRiskSignal: z
    .object({
      signalType: z.enum([
        "engagement_drop",
        "comp_concern",
        "growth_blocked",
        "interpersonal_friction",
        "external_opportunity",
        "personal_life_change",
      ]),
      severity: z.enum(["low", "med", "high"]),
      evidence: z.string().min(20),
    })
    .nullable(),
  extractionNotes: z.string(),
});

export type ExtractOneOnOneOutput = z.infer<typeof responseSchema>;

// ── Tool schema (mirrors responseSchema as JSON Schema for tool_use) ──────────────

const TOOL_SCHEMA = {
  properties: {
    oneOnOne: {
      type: "object",
      description: "Core 1:1 record fields extracted from the meeting notes.",
      required: ["topicsDiscussed"],
      properties: {
        mood: {
          type: ["string", "null"],
          enum: ["down", "flat", "steady", "up", "energized", null],
          description:
            "Your read of the designer's overall emotional energy during this meeting. Null if impossible to assess.",
        },
        happinessIndex: {
          type: ["number", "null"],
          minimum: 1,
          maximum: 10,
          description:
            "Happiness score 1–10. Use the designer's own stated number when given; otherwise your read if you can make a reasonable estimate; otherwise null.",
        },
        happinessSource: {
          type: ["string", "null"],
          enum: ["self_reported", "my_read", null],
          description: "How the happiness index was determined. Null when happinessIndex is null.",
        },
        topicsDiscussed: {
          type: "string",
          description:
            "Markdown summary of what was covered — written as a human would, not a transcript. Use bullet points for distinct topics. Preserve the designer's own framing where meaningful.",
        },
        vibeNotes: {
          type: ["string", "null"],
          description:
            "Owner-only soft signals — things you noticed that might be worth watching. Framed tentatively ('seemed', 'appeared to', 'I noticed'). Null if nothing notable.",
        },
      },
    },
    proposedBlockers: {
      type: "array",
      description:
        "Things currently blocking the designer's progress. Only propose NEW blockers — do not re-create items already in the open blockers list unless substantially different.",
      items: {
        type: "object",
        required: ["description", "owner"],
        properties: {
          description: { type: "string", description: "Concise description of what's blocking." },
          projectId: {
            type: ["string", "null"],
            description: "Project ID if the blocker is clearly tied to a specific project.",
          },
          owner: {
            type: "string",
            enum: ["designer", "you", "partner", "other"],
            description: "Who is responsible for unblocking.",
          },
        },
      },
    },
    proposedActionItems: {
      type: "array",
      description:
        "Things Ravi (you) committed to doing for the designer. Only NEW commitments — do not duplicate open action items unless substantially different.",
      items: {
        type: "object",
        required: ["description"],
        properties: {
          description: { type: "string", description: "What Ravi committed to." },
          dueDate: {
            type: ["string", "null"],
            description: "ISO date if a specific deadline was mentioned; otherwise null.",
          },
        },
      },
    },
    proposedWins: {
      type: "array",
      description:
        "Wins or achievements mentioned — shipped work, positive outcomes, kudos received, milestones hit.",
      items: {
        type: "object",
        required: ["description", "size", "occurredOn"],
        properties: {
          description: { type: "string", description: "What happened." },
          size: {
            type: "string",
            enum: ["small_win", "big_win"],
            description: "small_win for incremental; big_win for significant outcomes.",
          },
          occurredOn: {
            type: "string",
            description:
              "ISO date the win occurred. Default to meetingDate if no specific date mentioned.",
          },
        },
      },
    },
    proposedTeamConcerns: {
      type: "array",
      description:
        "Concerns the designer raised about the team, environment, or org. Only extract if explicitly voiced — don't infer.",
      items: {
        type: "object",
        required: ["concern", "theme", "severity"],
        properties: {
          concern: {
            type: "string",
            description: "The concern as the designer expressed it, in their framing.",
          },
          theme: {
            type: "string",
            enum: [
              "process",
              "tooling",
              "leadership",
              "cross_team",
              "morale",
              "comp_fairness",
              "workload",
              "career_growth",
              "other",
            ],
          },
          severity: {
            type: "string",
            enum: ["low", "med", "high"],
            description:
              "Based on how the designer framed it — not your interpretation of how serious it might be.",
          },
        },
      },
    },
    proposedRiskSignal: {
      description:
        "A retention or engagement risk signal. ONLY populate when multiple serious signals co-occur. Must be null for routine meetings. Null is almost always correct.",
      oneOf: [
        {
          type: "object",
          required: ["signalType", "severity", "evidence"],
          properties: {
            signalType: {
              type: "string",
              enum: [
                "engagement_drop",
                "comp_concern",
                "growth_blocked",
                "interpersonal_friction",
                "external_opportunity",
                "personal_life_change",
              ],
            },
            severity: { type: "string", enum: ["low", "med", "high"] },
            evidence: {
              type: "string",
              minLength: 20,
              description:
                "Specific phrases or observations from the notes that support this signal. Quote directly where possible.",
            },
          },
        },
        { type: "null" },
      ],
    },
    extractionNotes: {
      type: "string",
      description:
        "One short paragraph: what you saw in the notes, choices you made, anything ambiguous, any open blockers or action items you determined were already addressed.",
    },
  },
  required: ["oneOnOne", "proposedBlockers", "proposedActionItems", "proposedWins", "proposedTeamConcerns", "proposedRiskSignal", "extractionNotes"],
};

// ── System prompt ───────────────────────────────────────────────────────────────

export const systemPrompt = `You are a careful, discreet note-taker for a design team manager named Ravi. Your job is to convert raw 1:1 meeting notes into structured data — not to interpret, embellish, or draw conclusions beyond what the notes support.

CORE RULES:
1. Preserve what was actually said. Never invent or embellish. If the notes are sparse, the output should be sparse.
2. topicsDiscussed: write a human-readable markdown summary a manager would recognise as accurate. Not a transcript, not bullet points of every sentence — a concise narrative of what was covered.
3. vibeNotes: for owner-only soft signals only. Framed tentatively ('seemed', 'appeared to', 'I noticed'). Null if nothing notable. This field is never shown to the designer.
4. proposedRiskSignal: set to null for normal meetings. Only populate when the notes contain MULTIPLE serious signals co-occurring (e.g. explicit mention of job searching + dropping engagement + comp frustration). One offhand comment or one bad week is NOT a risk signal.
5. Reference the provided open blockers and action items to suggest closes where appropriate — mention closed items in extractionNotes rather than duplicating them. Do not re-propose items already tracked unless there is a materially new development.
6. Keep proposed rows minimal. It is better to under-extract than to over-extract. If something is borderline, leave it out and note it in extractionNotes.
7. For happinessIndex: use self_reported when the designer gave a number or clear rating. Use my_read only when you can make a confident estimate from context. Null otherwise.
8. Never produce content that would be harmful if a designer saw it. Distinguish observation from interpretation.
9. Do not recommend promotions, compensation changes, terminations, or any HR decisions.`;

// ── User prompt builder ─────────────────────────────────────────────────────────

export function buildUserPrompt(input: ExtractOneOnOneInput): string {
  const recentHistory =
    input.recentOneOnOnes.length > 0
      ? input.recentOneOnOnes
          .map(
            (o) =>
              `  - ${o.date}: happiness=${o.happinessIndex ?? "not recorded"} | ${o.topicsDiscussed.substring(0, 120)}${o.topicsDiscussed.length > 120 ? "…" : ""}`
          )
          .join("\n")
      : "  (no recent 1:1s on record)";

  const openBlockers =
    input.openBlockers.length > 0
      ? input.openBlockers.map((b) => `  - [${b.id}] ${b.description}`).join("\n")
      : "  (none)";

  const openActionItems =
    input.openActionItems.length > 0
      ? input.openActionItems
          .map(
            (a) =>
              `  - [${a.id}] ${a.description}${a.dueDate ? ` (due: ${a.dueDate})` : ""}`
          )
          .join("\n")
      : "  (none)";

  return `1:1 MEETING NOTES TO EXTRACT FROM:
---
Designer: ${input.designerName} (id: ${input.designerId})
Meeting date: ${input.meetingDate}

${input.rawNotes}
---

CONTEXT — RECENT 1:1 HISTORY (last few meetings):
${recentHistory}

OPEN BLOCKERS (already tracked — suggest closes rather than duplicates):
${openBlockers}

OPEN ACTION ITEMS FOR RAVI (already tracked — suggest closes rather than duplicates):
${openActionItems}

Extract the structured 1:1 data from the notes above. Follow the system prompt rules carefully. Remember: null and empty arrays are correct when the notes don't support a value.`;
}

// ── run() ───────────────────────────────────────────────────────────────────────

export async function run(input: ExtractOneOnOneInput): Promise<ExtractOneOnOneOutput> {
  return callSonnet(
    "extract-one-on-one",
    systemPrompt,
    buildUserPrompt(input),
    {
      toolName: "submit_one_on_one_extraction",
      toolDescription: "Submit the structured extraction result from the 1:1 meeting notes.",
      toolSchema: TOOL_SCHEMA,
      responseSchema,
    },
    0.2,
  );
}
