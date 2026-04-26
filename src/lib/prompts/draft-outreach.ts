/**
 * Job 9 — Draft Partner Outreach (AI_JOB_SPECS.md §Job 9)
 *
 * Draft a partner outreach email for one (cycle, designer, partner) triple.
 * Sounds like Ravi — warm, specific, direct. Not HR, not a form letter.
 *
 * Model: Sonnet | Temp: 0.6 | Writes: draft outreach row
 */
import { z } from "zod";
import { callSonnet } from "@/lib/claude";

// ── Input type ──────────────────────────────────────────────────────────────────

export interface DraftOutreachInput {
  designer: {
    fullName: string;
    level: string;
    productArea: string;
    startDate: string;
  };
  partner: {
    fullName: string;
    role: string;
    org?: string | null;
  };
  projects: Array<{
    projectName: string;
    role: string;
    dateRange: string;
  }>; // what they worked on together
  checkinDate: string; // deadline ISO date
  recentFeedbackFromPartner: string[]; // summaries of feedback already given this quarter
  voiceSample?: string | null; // Ravi's voice sample if available
}

// ── Response schema ─────────────────────────────────────────────────────────────

export const responseSchema = z.object({
  subject: z.string(),
  body: z.string(),
  notes: z.string(),
});

export type DraftOutreachOutput = z.infer<typeof responseSchema>;

// ── Tool schema ─────────────────────────────────────────────────────────────────

const TOOL_SCHEMA = {
  properties: {
    subject: {
      type: "string",
      description:
        "Email subject line. Under 80 characters. Specific — name the designer or project, not generic like 'Quick question'. Should make the partner want to open it.",
    },
    body: {
      type: "string",
      description:
        "Email body in markdown. 4–8 short paragraphs. Warm but efficient — the partner is busy. Must: open with a personal anchor to the specific project(s), ask 2–3 concrete questions (not open-ended), include the deadline but be warm about flexibility, and close with explicit thanks. No corporate HR language.",
    },
    notes: {
      type: "string",
      description:
        "Internal notes explaining why the email was written this way — what questions were chosen and why, what tone decisions were made, what prior feedback context influenced the ask. Shown as a tooltip to Ravi.",
    },
  },
  required: ["subject", "body", "notes"],
};

// ── System prompt ───────────────────────────────────────────────────────────────

export const systemPrompt = `You are drafting a partner outreach email on behalf of Ravi, a design manager. Ravi is writing to a cross-functional partner to gather feedback on one of his designers.

VOICE RULES — this is the most important section:
1. Sound like Ravi, not like HR or a performance management tool. Ravi is direct, warm, and concise. He does not use phrases like "touch base", "circle back", "per our conversation", "any feedback would be appreciated", or "hope this finds you well."
2. Open with something specific to the project or the work — not a generic opener.
3. The email should feel like it's from a real manager who actually cares, not a template someone filled in.
4. Short sentences. Active voice. No corporate hedging.
5. If a voice sample is provided, match its rhythm and vocabulary closely.

CONTENT RULES:
1. Name the specific project(s) the designer and partner worked on together. Do not be vague.
2. Ask exactly 2–3 concrete, pointed questions. For example: "Did [designer] push back when the scope changed?" is better than "What did you think of their communication?". Questions should be answerable in a few sentences, not essays.
3. If there is recent feedback from this partner already, do NOT ask about the same things again. Build on what they've already shared or focus on different angles.
4. Include the checkin deadline, but soften it — Ravi is not being bureaucratic about it. Something like "I'm pulling things together by [date] — even a few lines would be gold."
5. Explicitly thank the partner. They're doing this as a favor.
6. Do not include a formal sign-off block — just "— Ravi" or similar.
7. Keep the whole email under 200 words in the body. Partners are busy.

OUTPUT FORMAT:
- body: markdown (use line breaks between paragraphs, no headers needed)
- subject: specific, under 80 chars
- notes: your internal reasoning (questions chosen, tone decisions, how prior feedback shaped the ask)`;

// ── User prompt builder ─────────────────────────────────────────────────────────

export function buildUserPrompt(input: DraftOutreachInput): string {
  const partnerOrg = input.partner.org ? ` (${input.partner.org})` : "";

  const projectList = input.projects
    .map((p) => `- ${p.projectName} — ${input.designer.fullName} was ${p.role} (${p.dateRange})`)
    .join("\n");

  const priorFeedback =
    input.recentFeedbackFromPartner.length > 0
      ? input.recentFeedbackFromPartner.map((f, i) => `${i + 1}. ${f}`).join("\n")
      : "None — this is the first outreach to this partner this quarter.";

  const voiceSection = input.voiceSample
    ? `\nRAVI'S VOICE SAMPLE (match this tone and rhythm):\n"""\n${input.voiceSample}\n"""\n`
    : "";

  const checkinFormatted = new Date(input.checkinDate).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });

  return `Draft a partner outreach email for the following situation.

DESIGNER:
- Name: ${input.designer.fullName}
- Level: ${input.designer.level}
- Product area: ${input.designer.productArea}
- Start date: ${input.designer.startDate}

PARTNER:
- Name: ${input.partner.fullName}
- Role: ${input.partner.role}${partnerOrg}

PROJECTS THEY WORKED ON TOGETHER:
${projectList}

FEEDBACK ALREADY GIVEN THIS QUARTER (do NOT repeat these angles):
${priorFeedback}

CHECKIN DEADLINE: ${checkinFormatted} (${input.checkinDate})
${voiceSection}
Draft the outreach email now. Make it sound like Ravi wrote it himself — not like it was generated. Ask 2–3 concrete, specific questions about ${input.designer.fullName}'s work on the project(s) above.`;
}

// ── run() ───────────────────────────────────────────────────────────────────────

export async function run(input: DraftOutreachInput): Promise<DraftOutreachOutput> {
  return callSonnet(
    "draft-outreach",
    systemPrompt,
    buildUserPrompt(input),
    {
      toolName: "submit_outreach_draft",
      toolDescription: "Submit the drafted partner outreach email with subject, body, and authoring notes.",
      toolSchema: TOOL_SCHEMA,
      responseSchema,
    },
    0.6,
  );
}
