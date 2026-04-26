/**
 * Job 7 — Generate Cycle Review (AI_JOB_SPECS.md §Job 7)
 *
 * Generate a structured quarterly review draft for one (designer, cycle) pair.
 * Every rating requires evidence. Tone is fair, specific, growth-oriented.
 *
 * Model: Sonnet | Temp: 0.3 | Writes: draft cycle_review row
 */
import { z } from "zod";
import { callSonnet } from "@/lib/claude";

// ── Input type ──────────────────────────────────────────────────────────────────

export interface GenerateCycleReviewInput {
  designer: {
    id: string;
    fullName: string;
    level: string;
    productArea: string;
    startDate: string;
  };
  cycle: {
    quarter: string;
    year: number;
    checkinDate: string;
  };
  rubric: string; // full rubric JSON as string
  impactEntries: Array<{
    id: string;
    summary: string;
    dimension: string;
    magnitude: string;
    date: string;
  }>;
  feedback: Array<{
    id: string;
    sentiment: string;
    theme: string;
    summary: string;
    source: string;
    occurredOn: string;
    partnerName?: string | null;
  }>;
  oneOnOnes: Array<{
    id: string;
    date: string;
    topicsDiscussed: string;
    happinessIndex?: number | null;
  }>;
  highlights: Array<{
    id: string;
    kind: string;
    description: string;
  }>;
  openRiskSignals: Array<{
    id: string;
    signalType: string;
    severity: string;
  }>;
  teamConcerns: Array<{
    id: string;
    concern: string;
    theme: string;
    severity: string;
  }>;
  previousReview?: {
    summaryMarkdown: string;
    rubricRating: string;
  } | null;
}

// ── Response schema ─────────────────────────────────────────────────────────────

const rubricDimensionSchema = z.object({
  rating: z.enum(["needs_improvement", "developing", "strong", "outstanding"]),
  justification_markdown: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
});

export const responseSchema = z.object({
  summary_markdown: z.string(),
  strengths_markdown: z.string(),
  improvements_markdown: z.string(),
  rubric_rating: z.record(z.string(), rubricDimensionSchema),
  risk_watch: z.string().nullable(),
  continuity_note: z.string().nullable(),
});

export type GenerateCycleReviewOutput = z.infer<typeof responseSchema>;

// ── Tool schema ─────────────────────────────────────────────────────────────────

const TOOL_SCHEMA = {
  properties: {
    summary_markdown: {
      type: "string",
      description:
        "3–5 sentence narrative summary of the quarter. Cover: overall arc of their work, standout contribution, and any notable pattern (positive or concerning). If feedback is heavily skewed in one direction (all positive or all negative), flag it here explicitly. Honest, direct, growth-oriented. Not a list — flowing prose.",
    },
    strengths_markdown: {
      type: "string",
      description:
        "Bulleted markdown list of concrete strengths observed this quarter. Each bullet must include at least one citation in the form [impact-entry:id] or [feedback:id]. Do not generalise — each bullet should point to something specific that happened. Aim for 3–5 bullets.",
    },
    improvements_markdown: {
      type: "string",
      description:
        "Bulleted markdown list of areas for growth or improvement. Each bullet must include at least one citation in the form [impact-entry:id] or [feedback:id]. Frame as growth opportunities, not deficiencies. Aim for 2–4 bullets. If there is genuinely nothing to improve, write one bullet about what to sustain or deepen — but do not fabricate a weakness.",
    },
    rubric_rating: {
      type: "object",
      description:
        "Rating for each dimension in the rubric. Keys must be the exact dimension names from the rubric. For each dimension provide: rating, justification_markdown (1–2 sentences with at least one citation), and confidence.",
      additionalProperties: {
        type: "object",
        required: ["rating", "justification_markdown", "confidence"],
        properties: {
          rating: {
            type: "string",
            enum: ["needs_improvement", "developing", "strong", "outstanding"],
            description:
              "Rating for this dimension. 'outstanding' is rare — only when there is clear, unambiguous evidence of excellence above level expectations. When evidence is thin, use 'developing' or lower with confidence='low'. Never inflate.",
          },
          justification_markdown: {
            type: "string",
            description:
              "1–2 sentences explaining this rating with at least one concrete citation [impact-entry:id] or [feedback:id]. If evidence is thin, say so explicitly.",
          },
          confidence: {
            type: "string",
            enum: ["low", "medium", "high"],
            description:
              "'low' when evidence is thin or mixed. 'medium' when there is reasonable evidence but some gaps. 'high' when multiple independent data points clearly support the rating.",
          },
        },
      },
    },
    risk_watch: {
      type: ["string", "null"],
      description:
        "If there are open risk signals or concerning patterns in 1:1 happiness data or team concerns, write a brief (1–3 sentence) note for Ravi's eyes only. Do NOT recommend any specific action. Return null if there are no meaningful risk signals.",
    },
    continuity_note: {
      type: ["string", "null"],
      description:
        "If there is a previous review, write a 1–2 sentence note on how this quarter compares — progress made on prior improvement areas, sustained strengths, or new patterns. Return null if there is no previous review.",
    },
  },
  required: [
    "summary_markdown",
    "strengths_markdown",
    "improvements_markdown",
    "rubric_rating",
    "risk_watch",
    "continuity_note",
  ],
};

// ── System prompt ───────────────────────────────────────────────────────────────

export const systemPrompt = `You are helping a design manager draft a quarterly performance review for one of their designers. This is a draft — the manager will edit it before it becomes final. Your job is to synthesise the evidence faithfully and write something fair, specific, and useful.

RATING RULES — enforce these strictly:
1. Every rubric rating MUST cite at least one concrete impact_entry or feedback row using [impact-entry:id] or [feedback:id] notation. Uncited ratings are not acceptable.
2. "outstanding" is rare. Reserve it for cases where the evidence clearly shows performance above level expectations — not just "they did their job well." When in doubt, use "strong."
3. When evidence for a dimension is thin, use "developing" or lower AND set confidence="low". Never inflate to make the designer look good. An honest "developing / low confidence" is more useful than a false "strong."
4. "needs_improvement" should only appear when there is direct evidence of performance clearly below expectations for the level — not just absence of evidence.
5. Parse the rubric string carefully. The dimension names in rubric_rating must exactly match the dimension names in the rubric.

TONE RULES:
1. Fair, specific, growth-oriented. Not a compliance document, not a pep talk.
2. Do not use corporate euphemisms. "Could grow in X" is fine; "demonstrates opportunities for development in stakeholder engagement" is not.
3. Do not recommend promotion, termination, salary changes, or any HR action. That is not your job.
4. If feedback data is heavily one-sided (overwhelmingly positive or negative), acknowledge this explicitly in the summary — it may indicate data gaps, not reality.

CITATION FORMAT:
- Impact entries: [impact-entry:ID]
- Feedback rows: [feedback:ID]
- Use these inline within text. Example: "Drove the navigation redesign to launch [impact-entry:abc123], which cross-functional partners praised for reducing ambiguity [feedback:def456]."

SCOPE:
- Only rate dimensions that appear in the rubric. Do not invent dimensions.
- Only cite IDs that appear in the input data. Do not fabricate IDs.
- risk_watch and continuity_note are for Ravi's eyes only — be candid there.`;

// ── User prompt builder ─────────────────────────────────────────────────────────

export function buildUserPrompt(input: GenerateCycleReviewInput): string {
  // Format impact entries
  const impactSection =
    input.impactEntries.length > 0
      ? input.impactEntries
          .map(
            (e) =>
              `- [impact-entry:${e.id}] ${e.date} | ${e.dimension} | ${e.magnitude}\n  ${e.summary}`
          )
          .join("\n")
      : "None recorded this quarter.";

  // Format feedback
  const feedbackSection =
    input.feedback.length > 0
      ? input.feedback
          .map((f) => {
            const partner = f.partnerName ? ` (from ${f.partnerName})` : "";
            return `- [feedback:${f.id}] ${f.occurredOn} | ${f.sentiment} | ${f.theme}${partner}\n  ${f.summary}`;
          })
          .join("\n")
      : "None recorded this quarter.";

  // Format 1:1s
  const oneOnOneSection =
    input.oneOnOnes.length > 0
      ? input.oneOnOnes
          .map((o) => {
            const happiness =
              o.happinessIndex != null ? ` | Happiness: ${o.happinessIndex}/10` : "";
            return `- ${o.date}${happiness}\n  Topics: ${o.topicsDiscussed}`;
          })
          .join("\n")
      : "None recorded this quarter.";

  // Format highlights
  const highlightsSection =
    input.highlights.length > 0
      ? input.highlights.map((h) => `- [${h.kind}] ${h.description}`).join("\n")
      : "None recorded this quarter.";

  // Format risk signals
  const riskSection =
    input.openRiskSignals.length > 0
      ? input.openRiskSignals
          .map((r) => `- ${r.signalType} (severity: ${r.severity})`)
          .join("\n")
      : "No open risk signals.";

  // Format team concerns
  const concernsSection =
    input.teamConcerns.length > 0
      ? input.teamConcerns
          .map((c) => `- [${c.theme}] ${c.concern} (severity: ${c.severity})`)
          .join("\n")
      : "No open team concerns.";

  // Format previous review
  const previousReviewSection = input.previousReview
    ? `PREVIOUS QUARTER REVIEW SUMMARY:\n${input.previousReview.summaryMarkdown}\n\nPREVIOUS RUBRIC RATINGS:\n${input.previousReview.rubricRating}`
    : "No previous review on record (this may be their first cycle or first quarter tracked).";

  return `Generate a quarterly cycle review draft for the following designer.

---

DESIGNER:
- Name: ${input.designer.fullName}
- Level: ${input.designer.level}
- Product area: ${input.designer.productArea}
- Start date: ${input.designer.startDate}

REVIEW CYCLE: ${input.cycle.quarter} ${input.cycle.year}
Checkin date: ${input.cycle.checkinDate}

---

RUBRIC (parse this carefully — dimension names must match exactly in your output):
${input.rubric}

---

IMPACT ENTRIES (${input.impactEntries.length} total):
${impactSection}

---

FEEDBACK (${input.feedback.length} total):
${feedbackSection}

---

1:1 MEETINGS (${input.oneOnOnes.length} total):
${oneOnOneSection}

---

HIGHLIGHTS (${input.highlights.length} total):
${highlightsSection}

---

OPEN RISK SIGNALS:
${riskSection}

---

TEAM CONCERNS RAISED BY THIS DESIGNER:
${concernsSection}

---

${previousReviewSection}

---

Now generate the structured cycle review. Remember:
- Every rating needs a citation.
- "outstanding" only when evidence clearly supports above-level performance.
- Thin evidence = "developing" with confidence="low", not inflated.
- Dimension names in rubric_rating must exactly match the rubric above.
- Do not recommend promotion, termination, or compensation changes.`;
}

// ── run() ───────────────────────────────────────────────────────────────────────

export async function run(input: GenerateCycleReviewInput): Promise<GenerateCycleReviewOutput> {
  return callSonnet(
    "generate-cycle-review",
    systemPrompt,
    buildUserPrompt(input),
    {
      toolName: "submit_cycle_review",
      toolDescription:
        "Submit the structured quarterly cycle review draft with narrative, strengths, improvements, rubric ratings, and optional risk/continuity notes.",
      toolSchema: TOOL_SCHEMA,
      responseSchema,
    },
    0.3,
  );
}
