// Prompt B — load seed/synthetic/ data into the database
import "dotenv/config";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SEED_DIR = path.join(process.cwd(), "seed/synthetic");
const CREATED_BY = "seed-synthetic";

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(SEED_DIR, file), "utf8")) as T;
}

// ─── Parse markdown email blocks ──────────────────────────────────────────────

interface RawEmail {
  from: string;
  fromEmail: string;
  to: string;
  date: string;
  subject: string;
  body: string;
}

function parseEmails(file: string): RawEmail[] {
  const raw = fs.readFileSync(path.join(SEED_DIR, file), "utf8");
  const blocks = raw.split("---EMAIL---").slice(1);
  return blocks.flatMap((block) => {
    const end = block.indexOf("---END---");
    const content = end >= 0 ? block.substring(0, end) : block;
    const lines = content.trim().split("\n");
    const headers: Record<string, string> = {};
    let bodyStart = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith("From:")) {
        headers["from"] = line.replace("From:", "").trim();
      } else if (line.startsWith("To:")) {
        headers["to"] = line.replace("To:", "").trim();
      } else if (line.startsWith("Date:")) {
        headers["date"] = line.replace("Date:", "").trim();
      } else if (line.startsWith("Subject:")) {
        headers["subject"] = line.replace("Subject:", "").trim();
      } else if (line.trim() === "" && Object.keys(headers).length >= 4) {
        bodyStart = i + 1;
        break;
      }
    }
    const body = lines.slice(bodyStart).join("\n").trim();
    const fromMatch = headers["from"]?.match(/^(.+?)\s*<([^>]+)>/);
    const result = {
      from: fromMatch ? fromMatch[1].trim() : headers["from"] ?? "",
      fromEmail: fromMatch ? fromMatch[2] : "",
      to: headers["to"] ?? "",
      date: headers["date"] ?? "",
      subject: headers["subject"] ?? "",
      body,
    };
    // Skip malformed blocks
    if (!result.date || isNaN(new Date(result.date).getTime()) || !result.subject) return [];
    return [result];
  });
}

// ─── Parse markdown 1:1 blocks ────────────────────────────────────────────────

interface RawNote {
  designerName: string;
  date: string;
  rawText: string;
}

function parseNotes(file: string): RawNote[] {
  const raw = fs.readFileSync(path.join(SEED_DIR, file), "utf8");
  const blocks = raw.split("---NOTE---").slice(1);
  return blocks.map((block) => {
    const end = block.indexOf("---END---");
    const content = end >= 0 ? block.substring(0, end) : block;
    const lines = content.trim().split("\n");
    const designerLine = lines.find((l) => l.startsWith("Designer:"));
    const dateLine = lines.find((l) => l.startsWith("Date:"));
    const designerName = designerLine?.replace("Designer:", "").trim() ?? "";
    const date = dateLine?.replace("Date:", "").trim() ?? "";
    const rawText = lines.slice(3).join("\n").trim();
    return { designerName, date, rawText };
  });
}

// ─── Sentiment inference from email content ────────────────────────────────────

function inferSentiment(body: string): "positive" | "neutral" | "needs_improvement" {
  const lbody = body.toLowerCase();
  const negWords = ["concern", "frustrat", "miss", "absent", "issue", "problem", "struggle", "difficult", "below", "late", "slow", "defensive", "inconsistent", "unclear", "gap"];
  const posWords = ["excellent", "outstanding", "fantastic", "great", "strong", "solid", "impressive", "rare", "best", "love", "terrific", "exceptional", "praised"];
  const negCount = negWords.filter((w) => lbody.includes(w)).length;
  const posCount = posWords.filter((w) => lbody.includes(w)).length;
  if (posCount > negCount + 1) return "positive";
  if (negCount > posCount) return "needs_improvement";
  return "neutral";
}

// ─── Map designer name to DB id ───────────────────────────────────────────────

async function buildDesignerMap(): Promise<Map<string, string>> {
  const designers = await prisma.designer.findMany({ select: { id: true, fullName: true } });
  return new Map(designers.map((d) => [d.fullName, d.id]));
}

async function buildPartnerMap(): Promise<Map<string, string>> {
  const partners = await prisma.partner.findMany({ select: { id: true, email: true } });
  return new Map(partners.map((p) => [p.email, p.id]));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding synthetic data...");
  console.log(`  DB: ${absolutePath}`);

  // ── 0. Clear placeholder rows from prisma/seed.ts ───────────────────────────
  await prisma.designer.deleteMany({ where: { email: { contains: "designer" } } });
  await prisma.partner.deleteMany({ where: { email: { contains: "partner0" } } });
  console.log("  ✓ Cleared placeholder designers and partners");

  // ── 1. Designers ────────────────────────────────────────────────────────────
  const rawDesigners = readJson<Array<{
    fullName: string; email: string; level: string; discipline: string;
    productArea: string; startDate: string; currentStatus?: string;
    lastWorkingDay?: string; statusVisibility?: string;
  }>>("designers.json");

  for (const d of rawDesigners) {
    await prisma.designer.upsert({
      where: { email: d.email },
      update: {},
      create: {
        fullName: d.fullName,
        email: d.email,
        level: d.level,
        discipline: d.discipline as Parameters<typeof prisma.designer.create>[0]["data"]["discipline"],
        productArea: d.productArea as Parameters<typeof prisma.designer.create>[0]["data"]["productArea"],
        startDate: new Date(d.startDate),
        currentStatus: (d.currentStatus ?? "active") as Parameters<typeof prisma.designer.create>[0]["data"]["currentStatus"],
        lastWorkingDay: d.lastWorkingDay ? new Date(d.lastWorkingDay) : undefined,
        statusVisibility: d.statusVisibility as Parameters<typeof prisma.designer.create>[0]["data"]["statusVisibility"] | undefined,
        source: "imported",
        createdBy: CREATED_BY,
      },
    });
  }
  console.log(`  ✓ Designers: ${rawDesigners.length}`);

  // ── 2. Partners ─────────────────────────────────────────────────────────────
  const rawPartners = readJson<Array<{
    fullName: string; email: string; role: string; orgOrTeam: string;
  }>>("partners.json");

  for (const p of rawPartners) {
    await prisma.partner.upsert({
      where: { email: p.email },
      update: {},
      create: {
        fullName: p.fullName,
        email: p.email,
        role: p.role as Parameters<typeof prisma.partner.create>[0]["data"]["role"],
        orgOrTeam: p.orgOrTeam,
        source: "imported",
        createdBy: CREATED_BY,
      },
    });
  }
  console.log(`  ✓ Partners: ${rawPartners.length}`);

  // ── 3. Projects ─────────────────────────────────────────────────────────────
  const rawProjects = readJson<Array<{
    projectName: string; status: string; startDate: string; endDate?: string;
    strategicWeight: number; description: string;
  }>>("projects.json");

  for (const p of rawProjects) {
    const existing = await prisma.project.findFirst({ where: { projectName: p.projectName } });
    if (!existing) {
      await prisma.project.create({
        data: {
          projectName: p.projectName,
          status: p.status as Parameters<typeof prisma.project.create>[0]["data"]["status"],
          startDate: new Date(p.startDate),
          endDate: p.endDate ? new Date(p.endDate) : undefined,
          strategicWeight: p.strategicWeight,
          description: p.description,
          source: "imported",
          createdBy: CREATED_BY,
        },
      });
    }
  }
  console.log(`  ✓ Projects: ${rawProjects.length}`);

  // ── 4. InboxEmails + Feedback ────────────────────────────────────────────────
  const designerMap = await buildDesignerMap();
  const partnerMap = await buildPartnerMap();
  const emails = parseEmails("emails.md");

  // Map synthetic designer names mentioned in email subjects/bodies to designer IDs
  const nameToId = new Map<string, string>();
  for (const [name, id] of designerMap) {
    nameToId.set(name.toLowerCase(), id);
    const firstName = name.split(" ")[0].toLowerCase();
    nameToId.set(firstName, id);
  }

  let emailCount = 0;
  let feedbackCount = 0;

  for (const email of emails) {
    // Create InboxEmail
    const rawBody = `From: ${email.from} <${email.fromEmail}>\nTo: ${email.to}\nDate: ${email.date}\nSubject: ${email.subject}\n\n${email.body}`;
    const rawHash = crypto.createHash("sha256").update(rawBody).digest("hex");
    const inbox = await prisma.inboxEmail.upsert({
      where: { rawHash },
      update: {},
      create: {
        senderName: email.from,
        senderEmail: email.fromEmail,
        subject: email.subject,
        body: rawBody,
        receivedOn: new Date(email.date),
        rawHash,
        source: "imported",
        createdBy: CREATED_BY,
      },
    });
    emailCount++;

    // Find which designer this is about (naive: scan body for first names)
    const bodyLower = email.body.toLowerCase();
    const subjectLower = email.subject.toLowerCase();
    let designerId: string | null = null;
    for (const [nameLower, id] of nameToId) {
      if (bodyLower.includes(nameLower) || subjectLower.includes(nameLower)) {
        designerId = id;
        break;
      }
    }
    if (!designerId) continue;

    // Find partner by fromEmail
    const partnerId = partnerMap.get(email.fromEmail) ?? null;

    // Infer sentiment
    const sentiment = inferSentiment(email.body);

    // Create Feedback row
    const feedbackSource = partnerId
      ? (email.from.toLowerCase().includes("client") ? "client" : "project_lead")
      : "stakeholder";
    await prisma.feedback.create({
      data: {
        designerId,
        partnerId,
        inboxEmailId: inbox.id,
        occurredOn: new Date(email.date),
        feedbackSource: feedbackSource as Parameters<typeof prisma.feedback.create>[0]["data"]["feedbackSource"],
        sentiment,
        theme: "collaboration",
        summary: email.subject,
        quote: email.body.substring(0, 500),
        source: "imported",
        createdBy: CREATED_BY,
      },
    });
    feedbackCount++;
  }
  console.log(`  ✓ InboxEmails: ${emailCount}, Feedback rows: ${feedbackCount}`);

  // ── 5. OneOnOnes ────────────────────────────────────────────────────────────
  const notes = parseNotes("one-on-ones.md");
  let oneOnOneCount = 0;

  for (const note of notes) {
    const designerId = designerMap.get(note.designerName);
    if (!designerId) {
      console.warn(`  ! No designer found for: ${note.designerName}`);
      continue;
    }

    // Infer mood from text
    const textLower = note.rawText.toLowerCase();
    let mood: "down" | "flat" | "steady" | "up" | "energized" = "steady";
    if (textLower.includes("10/10") || textLower.includes("9/10") || textLower.includes("energized") || textLower.includes("fired up")) mood = "energized";
    else if (textLower.includes("8/10") || textLower.includes("excited") || textLower.includes("great energy")) mood = "up";
    else if (textLower.includes("5/10") || textLower.includes("stressed") || textLower.includes("distracted") || textLower.includes("tough")) mood = "flat";
    else if (textLower.includes("4/10") || textLower.includes("hard") || textLower.includes("not fully present")) mood = "down";

    // Infer happiness rating
    const happinessMatch = note.rawText.match(/(\d+)\/10/);
    const happinessRating = happinessMatch ? parseInt(happinessMatch[1]) : null;

    await prisma.oneOnOne.create({
      data: {
        designerId,
        date: new Date(note.date),
        mood,
        happinessIndex: happinessRating,
        happinessSource: "my_read",
        topicsDiscussed: note.rawText.substring(0, 800),
        vibeNotes: note.rawText.substring(0, 400),
        source: "imported",
        createdBy: CREATED_BY,
      },
    });
    oneOnOneCount++;
  }
  console.log(`  ✓ OneOnOnes: ${oneOnOneCount}`);

  // ── 6. Highlights (a few standout moments from the notes) ───────────────────
  const highlights = [
    { designerName: "Priya Nair", description: "Unsolicited competitive analysis at onboarding kickoff", kind: "standout_work", occurredOn: new Date("2026-01-22") },
    { designerName: "Rachel Goldstein", description: "Attended sprint planning voluntarily; delivered 3-month insight summary", kind: "community", occurredOn: new Date("2026-01-28") },
    { designerName: "Amara Diallo", description: "Engineer praise in retro: 'made work feel like a team effort'", kind: "kudos", occurredOn: new Date("2026-02-18") },
    { designerName: "James Thornton", description: "Advisor user shadowing — unprompted; shaped project direction", kind: "standout_work", occurredOn: new Date("2026-02-28") },
    { designerName: "Kevin Park", description: "Mobile-first onboarding approach noticed by leadership", kind: "small_win", occurredOn: new Date("2026-02-04") },
    { designerName: "Daniel Osei", description: "Led token workshop with platform engineering team", kind: "community", occurredOn: new Date("2026-01-28") },
  ];

  let highlightCount = 0;
  for (const h of highlights) {
    const designerId = designerMap.get(h.designerName);
    if (!designerId) continue;
    await prisma.highlight.create({
      data: {
        designerId,
        description: h.description,
        kind: h.kind as Parameters<typeof prisma.highlight.create>[0]["data"]["kind"],
        occurredOn: h.occurredOn,
        source: "imported",
        createdBy: CREATED_BY,
      },
    });
    highlightCount++;
  }
  console.log(`  ✓ Highlights: ${highlightCount}`);

  // ── 7. Blockers (extracted from 1:1 notes) ──────────────────────────────────
  const blockers = [
    { designerName: "Priya Nair", description: "Legal review of disclosure language blocking onboarding flow sign-off", dueDate: new Date("2026-03-07") },
    { designerName: "Ling Chen", description: "Waiting on content from Tom Vasquez before advisor flow screens can complete", dueDate: new Date("2026-02-11") },
    { designerName: "Amara Diallo", description: "Mobile scope decision from Frank Adeyemi not yet made", dueDate: new Date("2026-01-28") },
    { designerName: "Rachel Goldstein", description: "Dovetail seat stuck in procurement — 6+ weeks outstanding", dueDate: new Date("2026-03-01") },
    { designerName: "Nadia Petrov", description: "Legal review of regulated content sitting 3+ weeks", dueDate: new Date("2026-03-11") },
  ];

  let blockerCount = 0;
  for (const b of blockers) {
    const designerId = designerMap.get(b.designerName);
    if (!designerId) continue;
    await prisma.blocker.create({
      data: {
        designerId,
        description: b.description,
        status: "open",
        owner: "you",
        raisedOn: b.dueDate,
        source: "imported",
        createdBy: CREATED_BY,
      },
    });
    blockerCount++;
  }
  console.log(`  ✓ Blockers: ${blockerCount}`);

  // ── 8. Action Items (things Ravi owes) ──────────────────────────────────────
  const actions = [
    { designerName: "Priya Nair", description: "Intro to platform EM before sprint 1", dueDate: new Date("2026-01-21") },
    { designerName: "Priya Nair", description: "Find design crit buddy for Priya", dueDate: new Date("2026-02-01") },
    { designerName: "Marcus Webb", description: "Protect Thursday mornings as design time — update calendar", dueDate: new Date("2026-01-28") },
    { designerName: "Marcus Webb", description: "Help recruit usability test participants for transaction history study", dueDate: new Date("2026-02-07") },
    { designerName: "Ling Chen", description: "Direct conversation with Ling about communication norms", dueDate: new Date("2026-02-11") },
    { designerName: "Sofia Reyes", description: "Sort out RACI for advisor platform sprint — who is PM?", dueDate: new Date("2026-02-18") },
    { designerName: "Sofia Reyes", description: "Reduce Sofia's project load — discuss with Frank re: secondary advisor work", dueDate: new Date("2026-02-18") },
    { designerName: "James Thornton", description: "Revisit project assignment for Q3 — consider Servicing Hub lead", dueDate: new Date("2026-03-31") },
    { designerName: "Rachel Goldstein", description: "Escalate Dovetail seat procurement today", dueDate: new Date("2026-02-18") },
    { designerName: "Rachel Goldstein", description: "Join Research Ops check-in monthly for scope top-cover", dueDate: new Date("2026-03-01") },
    { designerName: "Kevin Park", description: "Introduce Kevin to compliance team lead", dueDate: new Date("2026-02-11") },
    { designerName: "Amara Diallo", description: "Send EAP info to Amara — informational, not crisis", dueDate: new Date("2026-01-28") },
    { designerName: "Nadia Petrov", description: "Put Nadia on agenda for next team share-out", dueDate: new Date("2026-03-11") },
    { designerName: "Ethan Cho", description: "Weekly check-in text for next 4 weeks", dueDate: new Date("2026-03-04") },
    { designerName: "Sofia Reyes", description: "Confirm Sofia is on all-hands agenda in 2 weeks", dueDate: new Date("2026-03-18") },
  ];

  let actionCount = 0;
  for (const a of actions) {
    const designerId = designerMap.get(a.designerName);
    if (!designerId) continue;
    await prisma.actionItem.create({
      data: {
        designerId,
        description: a.description,
        status: (new Date(a.dueDate) < new Date("2026-03-01") ? "done" : "open") as "done" | "open",
        dueDate: a.dueDate,
        source: "imported",
        createdBy: CREATED_BY,
      },
    });
    actionCount++;
  }
  console.log(`  ✓ ActionItems: ${actionCount}`);

  // ── Summary ──────────────────────────────────────────────────────────────────
  const counts = {
    designers: await prisma.designer.count(),
    partners: await prisma.partner.count(),
    projects: await prisma.project.count(),
    inboxEmails: await prisma.inboxEmail.count(),
    feedback: await prisma.feedback.count(),
    oneOnOnes: await prisma.oneOnOne.count(),
    highlights: await prisma.highlight.count(),
    blockers: await prisma.blocker.count(),
    actionItems: await prisma.actionItem.count(),
  };

  console.log("\n  DB row counts:");
  for (const [table, count] of Object.entries(counts)) {
    console.log(`    ${table}: ${count}`);
  }
  console.log("\nSynthetic seed complete ✓");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
