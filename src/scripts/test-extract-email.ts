/**
 * Dev test for extract-email prompt (Job 1)
 * Run: npm run test:extract-email
 *
 * Requires AI_MODE=anthropicDirect and ANTHROPIC_API_KEY in .env.local
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config(); // fallback to .env
import { run, type ExtractEmailInput } from "@/lib/prompts/extract-email";

const SAMPLE_EMAIL: ExtractEmailInput = {
  senderName: "Alex Rivera",
  senderEmail: "alex.rivera@example.com",
  subject: "Quick note on Priya",
  receivedOn: "2026-01-22",
  body: `Hey Ravi,

Just wanted to take a second and say that Priya has been absolutely fantastic to work with on the onboarding redesign. She came into our kickoff already having done a competitive analysis we didn't ask for — just showed up with the context. That set the tone for the whole engagement.

What really stands out is how she manages the back-and-forth with the eng team. She doesn't just hand off specs and disappear. She's in the review threads, she flags edge cases before they become problems. Last week she caught an accessibility issue in a flow we were about to commit to and redirected us without making anyone feel bad about it.

Honestly she's one of the strongest design partners I've worked with here. Keep doing whatever you're doing with her.

Alex`,
  relatedDesigners: [
    {
      id: "designer-priya-id",
      fullName: "Priya Nair",
      email: "priya.nair@example.com",
      productArea: "servicing_platforms",
    },
  ],
  relatedProjectId: "project-onboarding-id",
  relatedProjectName: "Advisor Onboarding Redesign",
  relatedProjectDescription: "End-to-end redesign of the advisor onboarding flow.",
  existingPartner: {
    id: "partner-alex-id",
    fullName: "Alex Rivera",
    role: "project_lead",
  },
};

async function main() {
  console.log("=== test:extract-email ===\n");
  console.log("Input email from:", SAMPLE_EMAIL.senderName);
  console.log("About:", SAMPLE_EMAIL.relatedDesigners.map((d) => d.fullName).join(", "));
  console.log("\nRunning extraction...\n");

  try {
    const result = await run(SAMPLE_EMAIL);

    console.log("✓ Extraction complete\n");
    console.log("Sender match:", result.senderMatch);
    console.log("\n=== Proposed Feedback ===");
    for (const f of result.proposedFeedback) {
      console.log(`\n  Designer: ${f.designerId}`);
      console.log(`  Source: ${f.feedbackSource} | Sentiment: ${f.sentiment} | Theme: ${f.theme}`);
      console.log(`  Confidence: ${f.confidence}`);
      console.log(`  Summary: ${f.summary}`);
      if (f.quote) console.log(`  Quote: "${f.quote.substring(0, 100)}..."`);
    }

    if (result.proposedImpactEntries?.length) {
      console.log("\n=== Proposed Impact Entries ===");
      for (const ie of result.proposedImpactEntries) {
        console.log(`  ${ie.dimension} | ${ie.magnitude} | ${ie.summary}`);
      }
    }

    if (result.proposedHighlights?.length) {
      console.log("\n=== Proposed Highlights ===");
      for (const h of result.proposedHighlights) {
        console.log(`  ${h.kind}: ${h.description}`);
      }
    }

    if (result.proposedRiskSignals?.length) {
      console.log("\n=== Proposed Risk Signals ===");
      for (const r of result.proposedRiskSignals) {
        console.log(`  ${r.signalType} | ${r.severity} | ${r.evidence.substring(0, 80)}`);
      }
    }

    console.log("\n=== Extraction Notes ===");
    console.log(result.extractionNotes);
    console.log("\n✓ Zod validation passed — all fields match schema");
  } catch (err) {
    console.error("\n✗ Extraction failed:");
    console.error(err);
    process.exit(1);
  }
}

main();
