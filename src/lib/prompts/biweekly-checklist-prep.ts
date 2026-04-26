/**
 * Job 5 — Biweekly Checklist Prep (AI_JOB_SPECS.md §Job 5)
 *
 * For a given designer and biweek window, scan what's stale/overdue and
 * return advisory flags for 13 checklist sections.
 *
 * Model: Haiku | Temp: 0.0 | Writes: read-only (flags only, no DB writes)
 */
import { z } from "zod";
import { callHaiku } from "@/lib/claude";

// ── Input type ───────────────────────────────────────────────────────────────────

export interface BiweeklyPrepInput {
  designer: { id: string; fullName: string; level: string; productArea: string };
  biweekStart: string; // ISO date
  biweekEnd: string;   // ISO date
  sections: {
    projects: { activeCount: number; newThisBiweek: number };
    impact: { recentCount: number; lastEntryDaysAgo: number | null };
    feedback: { recentCount: number; lastFeedbackDaysAgo: number | null };
    oneOnOne: { lastMeetingDaysAgo: number | null; happinessTrend: number[] }; // trend = last 6 scores
    blockers: { openCount: number; oldestDaysOpen: number | null };
    actionItems: { openCount: number; overdueCount: number };
    wins: { recentCount: number };
    teamConcerns: { openCount: number };
    riskSignals: { openCount: number; oldestDaysOpen: number | null };
    highlights: { recentCount: number };
    community: { recentCount: number };
    personality: { lastUpdatedDaysAgo: number | null };
  };
  previousBiweekSectionsTouched: string[]; // which sections were touched last biweek
}

// ── Zod schemas ──────────────────────────────────────────────────────────────────

const SectionEnum = z.enum([
  "projects",
  "impact",
  "feedback_received",
  "one_on_one",
  "blockers",
  "my_action_items",
  "wins",
  "happiness",
  "team_concerns",
  "risk_signals",
  "highlights",
  "community",
  "personality",
]);

const SeverityEnum = z.enum(["info", "nudge", "urgent"]);

const FlagSchema = z.object({
  section: SectionEnum,
  severity: SeverityEnum,
  message: z.string(),
  suggested_action: z.string().nullable(),
});

export const responseSchema = z.object({
  flags: z.array(FlagSchema),
});

export type Flag = z.infer<typeof FlagSchema>;
export type BiweeklyPrepOutput = z.infer<typeof responseSchema>;

// ── Tool schema ──────────────────────────────────────────────────────────────────

const TOOL_SCHEMA = {
  properties: {
    flags: {
      type: "array",
      description:
        "Advisory flags for each checklist section that needs attention. Prefer too many info-level flags over missing signals.",
      items: {
        type: "object",
        required: ["section", "severity", "message", "suggested_action"],
        properties: {
          section: {
            type: "string",
            enum: [
              "projects",
              "impact",
              "feedback_received",
              "one_on_one",
              "blockers",
              "my_action_items",
              "wins",
              "happiness",
              "team_concerns",
              "risk_signals",
              "highlights",
              "community",
              "personality",
            ],
            description: "Which checklist section this flag belongs to.",
          },
          severity: {
            type: "string",
            enum: ["info", "nudge", "urgent"],
            description:
              "urgent: requires immediate attention before the 1:1. nudge: worth raising. info: good to be aware of.",
          },
          message: {
            type: "string",
            description:
              "One concise line shown in the section header. State the condition factually (e.g. 'No feedback recorded in 24 days'). Under 100 characters.",
          },
          suggested_action: {
            type: ["string", "null"],
            description:
              "Optional one-line suggestion for what to do about this flag (e.g. 'Ask for written feedback from PM'). Null if no obvious action.",
          },
        },
      },
    },
  },
  required: ["flags"],
};

// ── Deterministic pre-checks ─────────────────────────────────────────────────────
// These rules are applied locally before Claude is called, so the AI does not need
// to re-derive clear-cut severity decisions. Claude is still asked to produce ALL
// flags (including these) to keep the output unified — but the system prompt
// instructs it to use the provided rule summary and not soften urgent signals.

function buildDeterministicContext(input: BiweeklyPrepInput): string {
  const { sections } = input;
  const lines: string[] = [];

  // URGENT signals
  if (sections.actionItems.overdueCount >= 3) {
    lines.push(`URGENT: ${sections.actionItems.overdueCount} action items are overdue (threshold ≥3).`);
  }

  if (sections.oneOnOne.happinessTrend.length >= 3) {
    const trend = sections.oneOnOne.happinessTrend;
    let consecutiveDrops = 0;
    let maxConsecutiveDrops = 0;
    for (let i = 1; i < trend.length; i++) {
      if (trend[i] < trend[i - 1]) {
        consecutiveDrops++;
        maxConsecutiveDrops = Math.max(maxConsecutiveDrops, consecutiveDrops);
      } else {
        consecutiveDrops = 0;
      }
    }
    if (maxConsecutiveDrops >= 2) {
      lines.push(`URGENT: Happiness trend shows ${maxConsecutiveDrops} consecutive drops (scores: ${trend.join(", ")}).`);
    }
  }

  if (sections.oneOnOne.lastMeetingDaysAgo !== null && sections.oneOnOne.lastMeetingDaysAgo >= 28) {
    lines.push(`URGENT: No 1:1 meeting in ${sections.oneOnOne.lastMeetingDaysAgo} days (threshold ≥28 days).`);
  } else if (sections.oneOnOne.lastMeetingDaysAgo === null) {
    lines.push(`URGENT: No 1:1 meeting on record at all.`);
  }

  if (sections.riskSignals.openCount > 0 && sections.riskSignals.oldestDaysOpen !== null && sections.riskSignals.oldestDaysOpen > 60) {
    lines.push(`URGENT: Open risk signal has been open for ${sections.riskSignals.oldestDaysOpen} days (threshold >60 days).`);
  }

  // NUDGE signals
  if (
    sections.actionItems.overdueCount >= 1 &&
    sections.actionItems.overdueCount <= 2
  ) {
    lines.push(`NUDGE: ${sections.actionItems.overdueCount} action item(s) overdue (1–2 range).`);
  }

  if (
    sections.feedback.lastFeedbackDaysAgo !== null &&
    sections.feedback.lastFeedbackDaysAgo >= 21
  ) {
    lines.push(`NUDGE: No feedback recorded in ${sections.feedback.lastFeedbackDaysAgo} days (threshold ≥21 days).`);
  } else if (sections.feedback.lastFeedbackDaysAgo === null) {
    lines.push(`NUDGE: No feedback on record at all.`);
  }

  if (
    sections.impact.lastEntryDaysAgo !== null &&
    sections.impact.lastEntryDaysAgo >= 30
  ) {
    lines.push(`NUDGE: No impact entry in ${sections.impact.lastEntryDaysAgo} days (threshold ≥30 days).`);
  } else if (sections.impact.lastEntryDaysAgo === null) {
    lines.push(`NUDGE: No impact entries on record at all.`);
  }

  if (
    sections.blockers.openCount > 0 &&
    sections.blockers.oldestDaysOpen !== null &&
    sections.blockers.oldestDaysOpen > 14
  ) {
    lines.push(`NUDGE: Open blocker has been open for ${sections.blockers.oldestDaysOpen} days (threshold >14 days).`);
  }

  // INFO signals
  if (sections.projects.newThisBiweek > 0) {
    lines.push(`INFO: ${sections.projects.newThisBiweek} new project assignment(s) this biweek.`);
  }

  if (
    sections.community.recentCount === 0
  ) {
    // We don't have a "daysSinceLastCommunity" field, so we flag if recentCount = 0
    lines.push(`INFO: No community activity recorded this biweek.`);
  }

  if (
    sections.personality.lastUpdatedDaysAgo !== null &&
    sections.personality.lastUpdatedDaysAgo >= 60
  ) {
    lines.push(`INFO: Personality signals last updated ${sections.personality.lastUpdatedDaysAgo} days ago (threshold ≥60 days).`);
  } else if (sections.personality.lastUpdatedDaysAgo === null) {
    lines.push(`INFO: Personality signals have never been updated.`);
  }

  const winsTouchedLastBiweek = input.previousBiweekSectionsTouched.includes("wins");
  if (sections.wins.recentCount === 0 && !winsTouchedLastBiweek) {
    lines.push(`INFO: No wins recorded this biweek, and wins section was not touched last biweek either.`);
  }

  return lines.length > 0
    ? `DETERMINISTIC SIGNAL SUMMARY (apply these exactly — do not soften urgency):\n${lines.map((l) => `  • ${l}`).join("\n")}`
    : "DETERMINISTIC SIGNAL SUMMARY: No pre-computed signals triggered. Use the raw data below to surface any additional info-level flags.";
}

// ── System prompt ────────────────────────────────────────────────────────────────

export const systemPrompt = `You are a mechanical reviewer — not a judge or advisor — producing checklist flags for a design manager's biweekly 1:1 preparation.

Your job is to scan the structured data for a single designer and emit advisory flags across 13 checklist sections. You are not evaluating the designer's performance. You are surfacing conditions that the manager should be aware of before the meeting.

ROLE:
- Mechanical. Emit flags based on data conditions. Do not interpret intent or assign blame.
- Prefer too many info-level flags over missing signals. When in doubt, flag it.
- Never moralize. Never soften a signal that meets the urgent threshold. Never inflate a signal that does not.

SEVERITY RULES (apply precisely):
- urgent: ≥3 overdue action items OR ≥2 consecutive drops in happiness trend OR no 1:1 in ≥28 days OR open risk signal older than 60 days.
- nudge: no feedback in ≥21 days OR no impact entry in ≥30 days OR open blocker older than 14 days OR 1–2 overdue action items.
- info: new project assignments this biweek OR no community activity in ≥14 days OR personality not updated in ≥60 days OR wins count = 0 for 2 consecutive biweeks.

SECTION MAPPING:
- projects → project count and new assignments
- impact → impact entry recency
- feedback_received → feedback recency and count
- one_on_one → last meeting date
- blockers → open blocker age
- my_action_items → Ravi's open/overdue action items for this designer
- wins → wins count
- happiness → happiness score trend
- team_concerns → open team concerns count
- risk_signals → open risk signal age
- highlights → recent highlight count
- community → community activity recency
- personality → personality signal update recency

OUTPUT RULES:
- Emit one flag per condition. If a section has no notable condition, do not emit a flag for it.
- message: one factual line under 100 characters (e.g., "No feedback recorded in 24 days").
- suggested_action: one-line action for the manager, or null if no obvious action.
- A section may have more than one flag if multiple conditions apply.
- A deterministic signal summary will be provided — use it as ground truth for severity. Do not override it.`;

// ── User prompt builder ──────────────────────────────────────────────────────────

export function buildUserPrompt(input: BiweeklyPrepInput): string {
  const { designer, biweekStart, biweekEnd, sections, previousBiweekSectionsTouched } = input;
  const deterministicContext = buildDeterministicContext(input);

  const happinessTrendStr =
    sections.oneOnOne.happinessTrend.length > 0
      ? sections.oneOnOne.happinessTrend.join(", ") + " (oldest → newest)"
      : "no data";

  const prevTouched =
    previousBiweekSectionsTouched.length > 0
      ? previousBiweekSectionsTouched.join(", ")
      : "none";

  return `DESIGNER: ${designer.fullName} (${designer.level}, ${designer.productArea})
BIWEEK: ${biweekStart} → ${biweekEnd}

${deterministicContext}

RAW SECTION DATA:
  projects:
    - Active projects: ${sections.projects.activeCount}
    - New this biweek: ${sections.projects.newThisBiweek}

  impact:
    - Recent entries this biweek: ${sections.impact.recentCount}
    - Last entry: ${sections.impact.lastEntryDaysAgo !== null ? `${sections.impact.lastEntryDaysAgo} days ago` : "never"}

  feedback_received:
    - Recent feedback this biweek: ${sections.feedback.recentCount}
    - Last feedback: ${sections.feedback.lastFeedbackDaysAgo !== null ? `${sections.feedback.lastFeedbackDaysAgo} days ago` : "never"}

  one_on_one:
    - Last meeting: ${sections.oneOnOne.lastMeetingDaysAgo !== null ? `${sections.oneOnOne.lastMeetingDaysAgo} days ago` : "never"}
    - Happiness trend (last 6 scores): ${happinessTrendStr}

  blockers:
    - Open blockers: ${sections.blockers.openCount}
    - Oldest blocker: ${sections.blockers.oldestDaysOpen !== null ? `${sections.blockers.oldestDaysOpen} days open` : "n/a"}

  my_action_items (Ravi's items for this designer):
    - Open: ${sections.actionItems.openCount}
    - Overdue: ${sections.actionItems.overdueCount}

  wins:
    - Recent wins this biweek: ${sections.wins.recentCount}

  team_concerns:
    - Open concerns: ${sections.teamConcerns.openCount}

  risk_signals:
    - Open signals: ${sections.riskSignals.openCount}
    - Oldest open signal: ${sections.riskSignals.oldestDaysOpen !== null ? `${sections.riskSignals.oldestDaysOpen} days open` : "n/a"}

  highlights:
    - Recent highlights this biweek: ${sections.highlights.recentCount}

  community:
    - Recent community activities this biweek: ${sections.community.recentCount}

  personality:
    - Last updated: ${sections.personality.lastUpdatedDaysAgo !== null ? `${sections.personality.lastUpdatedDaysAgo} days ago` : "never"}

PREVIOUS BIWEEK — sections touched: ${prevTouched}

---

Emit advisory flags for every condition worth noting. Use the deterministic signal summary above as ground truth for severity. Add any additional info-level flags you observe from the raw data. Prefer over-flagging at info level to under-flagging.`;
}

// ── run() ────────────────────────────────────────────────────────────────────────

export async function run(input: BiweeklyPrepInput): Promise<{ flags: Flag[] }> {
  return callHaiku(
    "biweekly-checklist-prep",
    systemPrompt,
    buildUserPrompt(input),
    {
      toolName: "submit_biweekly_flags",
      toolDescription:
        "Submit advisory flags for the biweekly checklist sections that need the manager's attention.",
      toolSchema: TOOL_SCHEMA,
      responseSchema,
    },
    0.0,
  );
}
