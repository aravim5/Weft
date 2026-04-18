// Phase 1 — Prisma seed: placeholder designers, partners, rubric, 2026 cycles, projects
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const dbUrl = process.env.DATABASE_URL ?? "file:./data/data.db";
const dbPath = dbUrl.replace(/^file:/, "");
const absolutePath = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);

const adapter = new PrismaBetterSqlite3({ url: absolutePath });
const prisma = new PrismaClient({ adapter } as Parameters<typeof PrismaClient>[0]);

async function main() {
  console.log("Seeding database...");
  console.log(`  DB: ${absolutePath}`);

  // ── Rubric v1-2026 ──────────────────────────────────────────────────────────
  const rubric = await prisma.rubric.upsert({
    where: { version: "v1-2026" },
    update: {},
    create: {
      version: "v1-2026",
      effectiveFrom: new Date("2026-01-01"),
      notes: "Initial rubric — adapt from firm-wide IC ladder",
      dimensions: JSON.stringify([
        {
          id: "craft",
          name: "Craft",
          description: "Quality and rigor of the design itself.",
          levels: [
            { rating: "needs_improvement", descriptor: "Work is inconsistent across projects; polish and detail require significant rework before handoff." },
            { rating: "developing", descriptor: "Work meets basic standards for the level; core elements are solid but edge cases and polish are inconsistent." },
            { rating: "strong", descriptor: "Work consistently meets the team bar; deliverables are thorough, well-considered, and require minimal rework." },
            { rating: "outstanding", descriptor: "Work sets the bar for the team; produces artifacts others reference as benchmarks; drives craft quality norms." },
          ],
        },
        {
          id: "ownership",
          name: "Ownership",
          description: "Taking responsibility for outcomes, not just outputs.",
          levels: [
            { rating: "needs_improvement", descriptor: "Waits to be told what to do next; needs frequent check-ins to stay on track." },
            { rating: "developing", descriptor: "Follows through on assigned work; flags blockers but may need nudging to escalate or self-direct." },
            { rating: "strong", descriptor: "Proactively identifies gaps, manages dependencies, and drives work to completion without close supervision." },
            { rating: "outstanding", descriptor: "Owns entire problem spaces; anticipates org-level blockers; others look to them to define what success looks like." },
          ],
        },
        {
          id: "collaboration",
          name: "Collaboration",
          description: "Working effectively with teammates, partners, and stakeholders.",
          levels: [
            { rating: "needs_improvement", descriptor: "Collaboration is reactive; contributes when asked but rarely initiates cross-functional connection." },
            { rating: "developing", descriptor: "Works well within the team; beginning to build relationships with engineering and product counterparts." },
            { rating: "strong", descriptor: "Sought out by partners; facilitates alignment across disciplines; strengthens the working relationships around their projects." },
            { rating: "outstanding", descriptor: "Multiplies team effectiveness; trusted to represent design in high-stakes cross-functional settings; brings people together." },
          ],
        },
        {
          id: "impact",
          name: "Impact",
          description: "Measurable outcomes that matter to the business or users.",
          levels: [
            { rating: "needs_improvement", descriptor: "Work does not yet connect to outcomes; hard to point to tangible results attributable to their contributions." },
            { rating: "developing", descriptor: "Contributes to outcomes within their project scope; impact is visible but not yet self-directed or substantial." },
            { rating: "strong", descriptor: "Consistently delivers measurable outcomes; can articulate the 'so what' of their design decisions in business terms." },
            { rating: "outstanding", descriptor: "Drives significant, clearly attributable outcomes; impact spans beyond their immediate project to the team or org." },
          ],
        },
        {
          id: "growth",
          name: "Growth",
          description: "Investing in their own development and raising the team's craft.",
          levels: [
            { rating: "needs_improvement", descriptor: "Growth is reactive; does not actively seek feedback or pursue skill development beyond assigned tasks." },
            { rating: "developing", descriptor: "Open to feedback and shows improvement; beginning to identify their own growth edges and act on them." },
            { rating: "strong", descriptor: "Actively seeks feedback, applies it visibly, and is developing in at least one stretch area each cycle." },
            { rating: "outstanding", descriptor: "Models a growth mindset for the team; invests in others' development through mentorship or knowledge-sharing." },
          ],
        },
      ]),
    },
  });
  console.log(`  ✓ Rubric: ${rubric.version}`);

  // ── Review Cycles 2026 ─────────────────────────────────────────────────────
  const cycles = [
    { year: 2026, quarter: "Q1" as const, checkinDate: new Date("2026-03-28"), outreachOpenOn: new Date("2026-02-28"), status: "complete" as const },
    { year: 2026, quarter: "Q2" as const, checkinDate: new Date("2026-06-26"), outreachOpenOn: new Date("2026-05-29"), status: "planned" as const },
    { year: 2026, quarter: "Q3" as const, checkinDate: new Date("2026-09-25"), outreachOpenOn: new Date("2026-08-28"), status: "planned" as const },
    { year: 2026, quarter: "Q4" as const, checkinDate: new Date("2026-12-18"), outreachOpenOn: new Date("2026-11-20"), status: "planned" as const },
  ];
  for (const c of cycles) {
    await prisma.reviewCycle.upsert({
      where: { year_quarter: { year: c.year, quarter: c.quarter } },
      update: {},
      create: { ...c, notes: `${c.quarter} 2026` },
    });
  }
  console.log("  ✓ Review cycles: Q1–Q4 2026");

  // ── Placeholder Partners ───────────────────────────────────────────────────
  const partnersData = [
    { fullName: "Partner01", email: "partner01@example.com", role: "project_lead" as const, orgOrTeam: "Engineering Org A" },
    { fullName: "Partner02", email: "partner02@example.com", role: "project_lead" as const, orgOrTeam: "Engineering Org B" },
    { fullName: "Partner03", email: "partner03@example.com", role: "project_lead" as const, orgOrTeam: "Engineering Org C" },
    { fullName: "Partner04", email: "partner04@example.com", role: "engineering_manager" as const, orgOrTeam: "Platform Eng" },
    { fullName: "Partner05", email: "partner05@example.com", role: "engineering_manager" as const, orgOrTeam: "Core Services Eng" },
    { fullName: "Partner06", email: "partner06@example.com", role: "product_manager" as const, orgOrTeam: "Product Org" },
    { fullName: "Partner07", email: "partner07@example.com", role: "peer_designer" as const, orgOrTeam: "Design Chapter" },
    { fullName: "Partner08", email: "partner08@example.com", role: "client" as const, orgOrTeam: "Wealth Management" },
  ];
  for (const p of partnersData) {
    await prisma.partner.upsert({
      where: { email: p.email },
      update: {},
      create: p,
    });
  }
  console.log("  ✓ Partners: 8 placeholder");

  // ── Placeholder Designers ──────────────────────────────────────────────────
  const designersData = [
    { fullName: "Designer01", email: "designer01@example.com", level: "601", discipline: "product" as const, productArea: "servicing_platforms" as const, startDate: new Date("2019-10-01") },
    { fullName: "Designer02", email: "designer02@example.com", level: "601", discipline: "product" as const, productArea: "client_platforms" as const, startDate: new Date("2017-02-15") },
    { fullName: "Designer03", email: "designer03@example.com", level: "601", discipline: "product" as const, productArea: "advisor_platforms" as const, startDate: new Date("2019-04-01") },
    { fullName: "Designer04", email: "designer04@example.com", level: "601", discipline: "design_system" as const, productArea: "connect_core" as const, startDate: new Date("2020-04-01") },
    { fullName: "Designer05", email: "designer05@example.com", level: "602", discipline: "product" as const, productArea: "advisor_platforms" as const, startDate: new Date("2019-01-12") },
    { fullName: "Designer06", email: "designer06@example.com", level: "602", discipline: "product" as const, productArea: "advisor_platforms" as const, startDate: new Date("2016-12-01") },
    { fullName: "Designer07", email: "designer07@example.com", level: "602", discipline: "product" as const, productArea: "client_onboarding" as const, startDate: new Date("2016-12-01") },
    { fullName: "Designer08", email: "designer08@example.com", level: "602", discipline: "product" as const, productArea: "client_onboarding" as const, startDate: new Date("2016-04-01") },
    { fullName: "Designer09", email: "designer09@example.com", level: "602", discipline: "research" as const, productArea: "advisor_core" as const, startDate: new Date("2015-04-01") },
    { fullName: "Designer10", email: "designer10@example.com", level: "602", discipline: "content" as const, productArea: "shared" as const, startDate: new Date("2016-04-01") },
    { fullName: "Designer11", email: "designer11@example.com", level: "602", discipline: "content" as const, productArea: "servicing_platforms" as const, startDate: new Date("2018-04-01") },
    { fullName: "Designer12", email: "designer12@example.com", level: "601", discipline: "visual" as const, productArea: "client_platforms" as const, startDate: new Date("2024-01-15"), currentStatus: "departing" as const, lastWorkingDay: new Date("2026-06-30"), statusVisibility: "owner_only" as const },
  ];
  for (const d of designersData) {
    await prisma.designer.upsert({
      where: { email: d.email },
      update: {},
      create: d,
    });
  }
  console.log("  ✓ Designers: 12 placeholder (11 active, 1 departing)");

  // ── Placeholder Projects ───────────────────────────────────────────────────
  const projectsData = [
    { projectName: "Advisor Onboarding Redesign", status: "in_progress" as const, startDate: new Date("2026-01-15"), strategicWeight: 4, description: "End-to-end redesign of the advisor onboarding flow." },
    { projectName: "Client Portal v3", status: "in_progress" as const, startDate: new Date("2025-10-01"), strategicWeight: 5, description: "Major version upgrade to the client-facing portal." },
    { projectName: "Design System Tokens 2.0", status: "in_progress" as const, startDate: new Date("2026-02-01"), strategicWeight: 3, description: "Unified token system across all product surfaces." },
    { projectName: "Billing Portal Refresh", status: "shipped" as const, startDate: new Date("2025-07-01"), endDate: new Date("2026-02-28"), strategicWeight: 3, description: "Redesigned billing portal shipped Feb 2026." },
    { projectName: "Servicing Hub Consolidation", status: "planned" as const, startDate: new Date("2026-05-01"), strategicWeight: 4, description: "Consolidate three servicing surfaces into one hub." },
    { projectName: "Research Ops Tooling", status: "paused" as const, startDate: new Date("2025-09-01"), strategicWeight: 2, description: "Internal tooling to streamline research repository." },
  ];
  for (const p of projectsData) {
    const existing = await prisma.project.findFirst({ where: { projectName: p.projectName } });
    if (!existing) {
      await prisma.project.create({ data: p });
    }
  }
  console.log("  ✓ Projects: 6 placeholder");

  // Summary
  const counts = {
    designers: await prisma.designer.count(),
    partners: await prisma.partner.count(),
    projects: await prisma.project.count(),
    cycles: await prisma.reviewCycle.count(),
    rubrics: await prisma.rubric.count(),
  };
  console.log("\n  Inserted rows:");
  for (const [table, count] of Object.entries(counts)) {
    console.log(`    ${table}: ${count}`);
  }
  console.log("\nSeed complete ✓");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
