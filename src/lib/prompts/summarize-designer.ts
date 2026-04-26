/**
 * Job 6 — Rolling Profile Summary (AI_JOB_SPECS.md §Job 6)
 *
 * Generate or refresh a designer's living manager-notes summary.
 * Produces a 2-3 paragraph markdown summary and a one-sentence headline
 * suitable for a dashboard card.
 *
 * Model: Sonnet | Temp: 0.3 | Writes: draft (human-approved before save)
 */
import { z } from "zod";
import { callSonnet } from "@/lib/claude";

// ── Input type ──────────────────────────────────────────────────────────────────

export interface SummarizeDesignerInput {
  designer: {
    fullName: string;
    level: string;
    productArea: string;
    startDate: string;
    currentStatus: string;
  };
  recentImpactEntries: Array<{
    summary: string;
    dimension: string;
    magnitude: string;
    date: string;
  }>;
  recentFeedback: Array<{
    sentiment: string;
    theme: string;
    summary: string;
    source: string;
  }>;
  recentOneOnOnes: Array<{
    date: string;
    topicsDiscussed: string;
    happinessIndex: number | null;
  }>;
  openRisks: Array<{
    signalType: string;
    severity: string;
    evidence: string;
  }>;
  openBlockers: Array<{
    description: string;
  }>;
  highlights: Array<{
    kind: string;
    description: string;
  }>;
  teamConcerns: Array<{
    concern: string;
    theme: string;
  }>;
  previousSummary: string | null;
}

// ── Response schema ─────────────────────────────────────────────────────────────

export const responseSchema = z.object({
  summary: z.string(),
  headline: z.string(),
});

export type SummarizeDesignerOutput = z.infer<typeof responseSchema>;

// ── Tool schema ─────────────────────────────────────────────────────────────────

const TOOL_SCHEMA = {
  properties: {
    summary: {
      type: "string",
      description:
        "2-3 paragraphs of markdown. Paragraph 1: overall state and recent impact — what this person has been doing and how it's landing. Paragraph 2: feedback patterns and happiness trend from 1:1s — what the data says about how they're experiencing work. Paragraph 3 (optional — omit if nothing significant): things to watch — open risks, blockers, or team concerns worth keeping an eye on. Only include paragraph 3 if there is at least one concrete thing to flag.",
    },
    headline: {
      type: "string",
      description:
        "One sentence, 15 words or fewer. Captures the most important thing about where this person is right now. Suitable for a dashboard card. No quotes.",
    },
  },
  required: ["summary", "headline"],
};

// ── System prompt ───────────────────────────────────────────────────────────────

export const systemPrompt = `You are helping Ravi, a design manager, maintain a living profile summary for each designer he manages. This is not a formal performance review — it is Ravi's own manager notes, written from his direct perspective so he can stay oriented on where each person is.

VOICE AND TONE:
- Write in first-person manager voice, as if Ravi wrote it himself. Direct, specific, grounded.
- Not HR-speak. Not corporate. Not a performance review. These are clear-eyed, supportive notes.
- Tone should feel like: "Here's who this person is right now and what I'm tracking."
- Every specific claim must be anchored to something in the provided data. Do not invent.

CONTENT RULES:
- Do not mention salary, compensation, promotion, or termination.
- If data is sparse (new hire, quiet quarter, or few entries), say so honestly. A short, honest summary is better than an inflated one.
- Para 1: Overall state + recent impact. What has this person been working on? What's the quality and magnitude of their contributions? Pull from impact entries and highlights.
- Para 2: Feedback patterns + happiness. What are partners and peers saying? How is this person experiencing work based on 1:1 mood and topics discussed?
- Para 3 (only if warranted): Things to watch. Open risks, unresolved blockers, team concerns this person has raised. Be factual, not alarmist. If there is nothing meaningful to flag, omit this paragraph entirely.
- Headline: One sentence, ≤15 words. The most important thing about where this person is right now.

If a previous summary exists, use it for continuity — do not repeat what hasn't changed, do update what has.`;

// ── User prompt builder ─────────────────────────────────────────────────────────

export function buildUserPrompt(input: SummarizeDesignerInput): string {
  const { designer } = input;

  const lines: string[] = [];

  lines.push(`DESIGNER: ${designer.fullName}`);
  lines.push(`Level: ${designer.level} | Product area: ${designer.productArea} | Start date: ${designer.startDate} | Status: ${designer.currentStatus}`);
  lines.push("");

  // Impact entries
  if (input.recentImpactEntries.length > 0) {
    lines.push("RECENT IMPACT ENTRIES:");
    for (const entry of input.recentImpactEntries) {
      lines.push(`- [${entry.date}] ${entry.summary} (dimension: ${entry.dimension}, magnitude: ${entry.magnitude})`);
    }
  } else {
    lines.push("RECENT IMPACT ENTRIES: None on record.");
  }
  lines.push("");

  // Highlights
  if (input.highlights.length > 0) {
    lines.push("HIGHLIGHTS:");
    for (const h of input.highlights) {
      lines.push(`- [${h.kind}] ${h.description}`);
    }
  } else {
    lines.push("HIGHLIGHTS: None on record.");
  }
  lines.push("");

  // Feedback
  if (input.recentFeedback.length > 0) {
    lines.push("RECENT FEEDBACK:");
    for (const f of input.recentFeedback) {
      lines.push(`- [${f.sentiment}] Theme: ${f.theme} | Source: ${f.source} — ${f.summary}`);
    }
  } else {
    lines.push("RECENT FEEDBACK: None on record.");
  }
  lines.push("");

  // 1:1s
  if (input.recentOneOnOnes.length > 0) {
    lines.push("RECENT 1:1s:");
    for (const o of input.recentOneOnOnes) {
      const happiness = o.happinessIndex !== null ? `happiness ${o.happinessIndex}/10` : "happiness not recorded";
      lines.push(`- [${o.date}] ${happiness} — Topics: ${o.topicsDiscussed}`);
    }
  } else {
    lines.push("RECENT 1:1s: None on record.");
  }
  lines.push("");

  // Open risks
  if (input.openRisks.length > 0) {
    lines.push("OPEN RISKS:");
    for (const r of input.openRisks) {
      lines.push(`- [${r.severity}] ${r.signalType}: ${r.evidence}`);
    }
  } else {
    lines.push("OPEN RISKS: None.");
  }
  lines.push("");

  // Open blockers
  if (input.openBlockers.length > 0) {
    lines.push("OPEN BLOCKERS:");
    for (const b of input.openBlockers) {
      lines.push(`- ${b.description}`);
    }
  } else {
    lines.push("OPEN BLOCKERS: None.");
  }
  lines.push("");

  // Team concerns
  if (input.teamConcerns.length > 0) {
    lines.push("TEAM CONCERNS RAISED BY THIS DESIGNER:");
    for (const c of input.teamConcerns) {
      lines.push(`- [${c.theme}] ${c.concern}`);
    }
  } else {
    lines.push("TEAM CONCERNS: None raised.");
  }
  lines.push("");

  // Previous summary
  if (input.previousSummary) {
    lines.push("PREVIOUS SUMMARY (for continuity — update what has changed, carry forward what hasn't):");
    lines.push(input.previousSummary);
  } else {
    lines.push("PREVIOUS SUMMARY: None — this is the first summary for this designer.");
  }

  lines.push("");
  lines.push("Write the rolling profile summary for this designer using the submit_designer_summary tool.");

  return lines.join("\n");
}

// ── run() ───────────────────────────────────────────────────────────────────────

export async function run(input: SummarizeDesignerInput): Promise<SummarizeDesignerOutput> {
  return callSonnet(
    "summarize-designer",
    systemPrompt,
    buildUserPrompt(input),
    {
      toolName: "submit_designer_summary",
      toolDescription: "Submit the rolling profile summary for this designer.",
      toolSchema: TOOL_SCHEMA,
      responseSchema,
    },
    0.3,
  );
}
