// Assembles the full team snapshot injected into every chat system prompt.
// Runs entirely on the server side — never exposed to the client.
import { db } from "@/lib/db";

export interface TeamContext {
  snapshotText: string;
  designerIds: string[];
}

function trend(scores: (number | null)[]): "up" | "flat" | "down" | "unknown" {
  const valid = scores.filter((s): s is number => s !== null);
  if (valid.length < 2) return "unknown";
  const diff = valid[valid.length - 1] - valid[0];
  if (diff >= 1) return "up";
  if (diff <= -1) return "down";
  return "flat";
}

export async function assembleContext(): Promise<TeamContext> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);

  const [designers, rubric, recentEmails, recentOneOnOnes, activeCycle, recentConcerns] = await Promise.all([
    db.designer.findMany({
      where: { archivedAt: null },
      orderBy: { fullName: "asc" },
      include: {
        oneOnOnes: { orderBy: { date: "desc" }, take: 6, select: { date: true, happinessIndex: true, topicsDiscussed: true } },
        riskSignals: { where: { archivedAt: null, status: "open" }, select: { id: true, signalType: true, severity: true } },
        actionItems: { where: { archivedAt: null, status: { in: ["open", "in_progress"] } }, select: { id: true } },
        impactEntries: { where: { archivedAt: null, date: { gte: quarterStart } }, select: { id: true, dimension: true, magnitude: true, summary: true } },
        feedback: { where: { archivedAt: null, occurredOn: { gte: thirtyDaysAgo } }, select: { id: true, sentiment: true, theme: true } },
      },
    }),
    db.rubric.findFirst({ orderBy: { createdAt: "desc" }, select: { dimensions: true } }),
    db.inboxEmail.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, subject: true, body: true, senderName: true, createdAt: true },
    }),
    db.oneOnOne.findMany({
      where: { archivedAt: null, date: { gte: thirtyDaysAgo } },
      orderBy: { date: "desc" },
      take: 20,
      include: { designer: { select: { fullName: true } } },
    }),
    db.reviewCycle.findFirst({
      where: { status: { in: ["planned", "outreach_sent", "collecting", "summarizing"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, quarter: true, year: true, status: true },
    }),
    db.teamConcern.findMany({
      where: { archivedAt: null, status: { in: ["noted", "acting"] }, createdAt: { gte: thirtyDaysAgo } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { raisedBy: { select: { fullName: true } } },
    }),
  ]);

  const lines: string[] = [];

  // === Designer profiles ===
  lines.push("## TEAM PROFILES");
  lines.push(`${designers.length} designers as of ${now.toISOString().slice(0, 10)}.\n`);

  for (const d of designers) {
    const happinessScores = d.oneOnOnes.map((o) => o.happinessIndex);
    const latestHappiness = happinessScores.find((s) => s !== null) ?? null;
    const happinessTrend = trend(happinessScores);
    const openRisks = d.riskSignals.length;
    const openActions = d.actionItems.length;
    const recentImpact = d.impactEntries.length;
    const positiveFeedback = d.feedback.filter((f) => f.sentiment === "positive").length;
    const lastOneOnOne = d.oneOnOnes[0] ?? null;

    lines.push(`### ${d.fullName} [designer:${d.id}]`);
    lines.push(`Level: ${d.level} | Area: ${d.productArea} | Status: ${d.currentStatus}`);
    lines.push(`Happiness: ${latestHappiness ?? "unknown"}/10 (trend: ${happinessTrend})`);
    lines.push(`Open risks: ${openRisks} | Open actions (yours): ${openActions}`);
    lines.push(`Impact entries this quarter: ${recentImpact} | Positive feedback (30d): ${positiveFeedback}`);
    if (lastOneOnOne) {
      lines.push(`Last 1:1: ${lastOneOnOne.date.toISOString().slice(0, 10)} [one-on-one:${d.oneOnOnes[0]?.date ? d.id : ""}]`);
      lines.push(`Topics: ${lastOneOnOne.topicsDiscussed.slice(0, 200)}`);
    }
    if (openRisks > 0) {
      lines.push(`Risk signals: ${d.riskSignals.map((r) => `${r.signalType}(${r.severity}) [risk-signal:${r.id}]`).join(", ")}`);
    }
    lines.push("");
  }

  // === Rubric ===
  if (rubric?.dimensions) {
    lines.push("## RUBRIC (compact)");
    lines.push(rubric.dimensions.slice(0, 2000));
    lines.push("");
  }

  // === Recent inbox emails ===
  if (recentEmails.length > 0) {
    lines.push("## RECENT INBOX EMAILS (last 30d)");
    for (const email of recentEmails) {
      lines.push(`[inbox-email:${email.id}] From: ${email.senderName ?? "unknown"} | Subject: ${email.subject ?? "(none)"}`);
      lines.push(email.body.slice(0, 500));
      lines.push("");
    }
  }

  // === Recent 1:1 summaries ===
  if (recentOneOnOnes.length > 0) {
    lines.push("## RECENT 1:1 SUMMARIES (last 30d)");
    for (const o of recentOneOnOnes) {
      lines.push(`[one-on-one:${o.id}] ${o.designer.fullName} — ${o.date.toISOString().slice(0, 10)} | happiness: ${o.happinessIndex ?? "??"}/10`);
      lines.push(o.topicsDiscussed.slice(0, 300));
      lines.push("");
    }
  }

  // === Active cycle ===
  if (activeCycle) {
    lines.push("## ACTIVE REVIEW CYCLE");
    lines.push(`${activeCycle.quarter} ${activeCycle.year} — status: ${activeCycle.status} [review-cycle:${activeCycle.id}]`);
    lines.push("");
  }

  // === Recent team concerns ===
  if (recentConcerns.length > 0) {
    lines.push("## RECENT TEAM CONCERNS (last 30d)");
    for (const c of recentConcerns) {
      lines.push(`[team-concern:${c.id}] ${c.raisedBy.fullName}: ${c.concern} (${c.theme}/${c.severity})`);
    }
    lines.push("");
  }

  return {
    snapshotText: lines.join("\n"),
    designerIds: designers.map((d) => d.id),
  };
}
