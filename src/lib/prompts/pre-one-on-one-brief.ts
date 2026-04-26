/**
 * Job 4 — Pre-1:1 Brief (AI_JOB_SPECS.md §Job 4)
 *
 * Generate a warm, thoughtful prep document for Ravi before a 1:1 meeting.
 * Synthesises open items, recent mood, feedback, concerns, and risk signals
 * into a structured markdown brief.
 *
 * Model: Sonnet | Temp: 0.4 | Returns: plain markdown string (read-only, no DB write)
 */
import { callSonnetText } from "@/lib/claude";

// ── Input type ──────────────────────────────────────────────────────────────────

export interface PreOneOnOneBriefInput {
  designer: {
    id: string;
    fullName: string;
    level: string;
    productArea: string;
    startDate: string;
  };
  openActionItems: Array<{ description: string; dueDate: string | null }>;
  openBlockers: Array<{ description: string; raisedOn: string }>;
  recentOneOnOnes: Array<{ date: string; happinessIndex: number | null; topicsDiscussed: string }>;
  recentFeedback: Array<{
    sentiment: string;
    summary: string;
    occurredOn: string;
    partnerName: string | null;
  }>;
  openConcerns: Array<{ concern: string; theme: string; severity: string }>;
  openRiskSignals: Array<{ signalType: string; severity: string; evidence: string }>;
  recentImpactEntries: Array<{
    dimension: string;
    magnitude: string;
    summary: string;
    date: string;
  }>;
  meetingDate: string; // ISO date
}

// ── System prompt ───────────────────────────────────────────────────────────────

export const systemPrompt = `You are a thoughtful chief of staff helping a design team manager named Ravi prepare for a 1:1 conversation. You know this team well.

Your job is to write a warm, practical prep document — not a dashboard or a report. Ravi will read this five minutes before the meeting. It should help him walk in present, prepared, and genuinely focused on the designer.

TONE:
- Warm and human. Write as a trusted colleague would, not a system report.
- Tentative where appropriate. Signal uncertainty honestly ("seems like", "worth asking about").
- Direct where the data is clear.
- Never clinical, never bureaucratic.

RULES:
1. Synthesise — do not just list raw data. Group related items, identify themes.
2. "Things worth watching" is the only place for soft signals or risk interpretations. Frame everything there tentatively.
3. If there's nothing meaningful to say in a section, write a single line like "Nothing open." or "No recent feedback on file." Do not pad.
4. Open questions should be genuinely open — curious, not interrogative. 3–5 questions that would lead to real conversation.
5. Do not recommend compensation decisions, promotion timelines, or HR actions.
6. Happiness trend: describe the arc over recent meetings, not just the latest number.
7. My open commitments: only list action items Ravi owes the designer — frame as "things I said I'd do", not a to-do list.
8. Write the brief in the first person from Ravi's perspective ("I promised to…", "they raised…").`;

// ── User prompt builder ─────────────────────────────────────────────────────────

export function buildUserPrompt(input: PreOneOnOneBriefInput): string {
  const { designer } = input;

  const actionItems =
    input.openActionItems.length > 0
      ? input.openActionItems
          .map((a) => `  - ${a.description}${a.dueDate ? ` (due ${a.dueDate})` : ""}`)
          .join("\n")
      : "  (none)";

  const blockers =
    input.openBlockers.length > 0
      ? input.openBlockers
          .map((b) => `  - ${b.description} (raised ${b.raisedOn})`)
          .join("\n")
      : "  (none)";

  const recentMeetings =
    input.recentOneOnOnes.length > 0
      ? input.recentOneOnOnes
          .map(
            (o) =>
              `  - ${o.date}: happiness=${o.happinessIndex ?? "not recorded"}\n    Topics: ${o.topicsDiscussed}`
          )
          .join("\n")
      : "  (no recent 1:1s on record)";

  const feedback =
    input.recentFeedback.length > 0
      ? input.recentFeedback
          .map(
            (f) =>
              `  - [${f.occurredOn}] ${f.sentiment.toUpperCase()} — ${f.summary}${f.partnerName ? ` (from ${f.partnerName})` : ""}`
          )
          .join("\n")
      : "  (none)";

  const concerns =
    input.openConcerns.length > 0
      ? input.openConcerns
          .map((c) => `  - [${c.theme}/${c.severity}] ${c.concern}`)
          .join("\n")
      : "  (none)";

  const riskSignals =
    input.openRiskSignals.length > 0
      ? input.openRiskSignals
          .map((r) => `  - [${r.signalType}/${r.severity}] ${r.evidence}`)
          .join("\n")
      : "  (none)";

  const impactEntries =
    input.recentImpactEntries.length > 0
      ? input.recentImpactEntries
          .map((i) => `  - [${i.date}] ${i.dimension} / ${i.magnitude}: ${i.summary}`)
          .join("\n")
      : "  (none)";

  return `Generate a 1:1 prep brief for the following meeting.

DESIGNER:
  Name: ${designer.fullName}
  Level: ${designer.level}
  Product area: ${designer.productArea}
  Start date: ${designer.startDate}

MEETING DATE: ${input.meetingDate}

MY OPEN COMMITMENTS (action items I owe them):
${actionItems}

OPEN BLOCKERS:
${blockers}

RECENT 1:1 HISTORY (most recent first):
${recentMeetings}

RECENT FEEDBACK:
${feedback}

OPEN TEAM CONCERNS THEY'VE RAISED:
${concerns}

OPEN RISK SIGNALS:
${riskSignals}

RECENT IMPACT ENTRIES:
${impactEntries}

---

Write the prep brief using EXACTLY this structure:

# Prep for 1:1 with ${designer.fullName} — ${input.meetingDate}
## State of play
## My open commitments to them
## Open blockers
## Recent feedback worth mentioning
## Happiness trend
## Team concerns they've raised
## Things worth asking (3–5 open questions)
## Things worth watching (tentative soft signals only)

Follow the tone guidelines: warm, first-person, synthesised. Do not pad empty sections.`;
}

// ── run() ───────────────────────────────────────────────────────────────────────

export async function run(input: PreOneOnOneBriefInput): Promise<string> {
  return callSonnetText(
    "pre-one-on-one-brief",
    systemPrompt,
    buildUserPrompt(input),
    0.4,
  );
}
