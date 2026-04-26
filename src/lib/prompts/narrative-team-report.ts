/**
 * Job — Narrative Team Report (AI_JOB_SPECS.md)
 *
 * Turn computed team metrics into a 3-paragraph director-ready narrative.
 * Intended for use in cycle snapshots, weekly director updates, or ad-hoc
 * team health exports.
 *
 * Model: Sonnet | Temp: 0.4 | Writes: draft (read-only generation)
 */
import { z } from "zod";
import { callSonnet } from "@/lib/claude";

// ── Input type ──────────────────────────────────────────────────────────────────

export interface NarrativeTeamReportInput {
  reportDate: string; // ISO date
  teamSize: number;
  metrics: {
    impactEntriesThisQuarter: number;
    topDimension: string; // e.g. "craft_quality"
    positiveFeedbackRate: number; // 0-1
    averageHappiness: number | null;
    happinessTrend: "up" | "flat" | "down" | "mixed";
    openRisks: number;
    highSeverityRisks: number;
    overdueActions: number;
    biweeklyCompletionRate: number; // 0-1
    teamConcernCount: number;
    topConcernTheme: string | null;
    cycleReviewSignOffRate: number | null; // 0-1 or null if no active cycle
  };
  designersNeedingAttention: string[]; // just their names
  recentWins: string[]; // highlight descriptions, max 5
}

// ── Response schema ─────────────────────────────────────────────────────────────

export const responseSchema = z.object({
  narrative: z.string(),
  title: z.string(),
});

export type NarrativeTeamReportOutput = z.infer<typeof responseSchema>;

// ── Tool schema ─────────────────────────────────────────────────────────────────

const TOOL_SCHEMA = {
  properties: {
    narrative: {
      type: "string",
      description:
        "Exactly 3 paragraphs of markdown, separated by a blank line. Paragraph 1: impact and momentum — what the team shipped this quarter and how strong the output has been. Paragraph 2: team health — happiness trend, concerns, open risks. Paragraph 3: what needs attention and a single concrete recommended focus for the next two weeks. Each paragraph must be 120 words or fewer. End with one concrete recommendation (in paragraph 3).",
    },
    title: {
      type: "string",
      description:
        "Report title. Format example: 'Q2 2026 Design Team — Mid-cycle snapshot'. Should reflect the report date and nature of the snapshot.",
    },
  },
  required: ["narrative", "title"],
};

// ── System prompt ───────────────────────────────────────────────────────────────

export const systemPrompt = `You are helping Ravi, a design manager, produce a concise director-ready narrative from computed team metrics. This narrative will be read by a design director — it must be confident, factual, and efficient.

STRUCTURE (non-negotiable):
- Exactly 3 paragraphs. No more, no less.
- Paragraph 1: Impact and momentum. What did the team produce this quarter? How strong and consistent is the output? Reference impact volume, top dimension, and any standout wins.
- Paragraph 2: Team health. Summarise happiness trend, open risks, team concerns, and any operational friction (overdue actions, checkin completion rate). Be honest — do not soften real problems, but also do not catastrophise.
- Paragraph 3: What needs attention and a single concrete recommendation. Name designers who need attention only if relevant to a win or a publicly visible concern — never name individuals in the context of risks. End this paragraph with one specific, actionable recommendation.

TONE AND STYLE:
- Executive summary for a design director. Confident, factual, brief.
- No HR language: do not use words like "performer", "underperformer", "top talent", "bottom quartile", or similar.
- Each paragraph must be 120 words or fewer.
- Write numbers as numerals (e.g. 7 designers, 84%, 3 open risks).
- Use plain markdown — no headers within the narrative, no bullet lists. Flowing prose only.
- The title should read naturally — e.g. "Q2 2026 Design Team — Mid-cycle snapshot" or "April 2026 Design Team Health Report".`;

// ── Helpers ─────────────────────────────────────────────────────────────────────

function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function formatHappiness(avg: number | null): string {
  if (avg === null) return "not recorded";
  return avg.toFixed(1);
}

function formatDimension(dim: string): string {
  // Convert snake_case dimension names to readable form
  return dim.replace(/_/g, " ");
}

// ── User prompt builder ─────────────────────────────────────────────────────────

export function buildUserPrompt(input: NarrativeTeamReportInput): string {
  const { metrics } = input;
  const lines: string[] = [];

  lines.push(`REPORT DATE: ${input.reportDate}`);
  lines.push(`TEAM SIZE: ${input.teamSize} designers`);
  lines.push("");

  lines.push("IMPACT & OUTPUT:");
  lines.push(`- Impact entries logged this quarter: ${metrics.impactEntriesThisQuarter}`);
  lines.push(`- Top impact dimension: ${formatDimension(metrics.topDimension)}`);
  lines.push(`- Positive feedback rate: ${formatPercent(metrics.positiveFeedbackRate)}`);
  lines.push("");

  lines.push("TEAM HEALTH:");
  lines.push(`- Average happiness index: ${formatHappiness(metrics.averageHappiness)} / 10`);
  lines.push(`- Happiness trend: ${metrics.happinessTrend}`);
  lines.push(`- Open risks: ${metrics.openRisks} (of which high severity: ${metrics.highSeverityRisks})`);
  lines.push(`- Open team concerns: ${metrics.teamConcernCount}${metrics.topConcernTheme ? ` (top theme: ${formatDimension(metrics.topConcernTheme)})` : ""}`);
  lines.push("");

  lines.push("OPERATIONAL RHYTHM:");
  lines.push(`- Biweekly checkin completion rate: ${formatPercent(metrics.biweeklyCompletionRate)}`);
  lines.push(`- Overdue action items (Ravi owes designers): ${metrics.overdueActions}`);
  if (metrics.cycleReviewSignOffRate !== null) {
    lines.push(`- Cycle review sign-off rate: ${formatPercent(metrics.cycleReviewSignOffRate)}`);
  } else {
    lines.push("- Cycle review sign-off rate: no active cycle");
  }
  lines.push("");

  if (input.recentWins.length > 0) {
    lines.push("RECENT WINS (use in paragraph 1 where relevant):");
    for (const win of input.recentWins) {
      lines.push(`- ${win}`);
    }
  } else {
    lines.push("RECENT WINS: None recorded.");
  }
  lines.push("");

  if (input.designersNeedingAttention.length > 0) {
    lines.push("DESIGNERS FLAGGED FOR ATTENTION:");
    lines.push(input.designersNeedingAttention.join(", "));
    lines.push("(Reference these designers by name only if relevant to wins or publicly visible concerns — never in the context of risks.)");
  } else {
    lines.push("DESIGNERS FLAGGED FOR ATTENTION: None.");
  }

  lines.push("");
  lines.push("Write the 3-paragraph director narrative and title using the submit_team_narrative tool. Each paragraph must be 120 words or fewer.");

  return lines.join("\n");
}

// ── run() ───────────────────────────────────────────────────────────────────────

export async function run(input: NarrativeTeamReportInput): Promise<NarrativeTeamReportOutput> {
  return callSonnet(
    "narrative-team-report",
    systemPrompt,
    buildUserPrompt(input),
    {
      toolName: "submit_team_narrative",
      toolDescription: "Submit the director-ready narrative team report.",
      toolSchema: TOOL_SCHEMA,
      responseSchema,
    },
    0.4,
  );
}
