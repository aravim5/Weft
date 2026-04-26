// POST /api/ingest/email — parse, dedup, extract proposals (does NOT write feedback rows)
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseRawEmail } from "@/lib/parsers/email";
import { run as extractEmail } from "@/lib/prompts/extract-email";
import { getProvider } from "@/lib/ai/provider";

const RequestSchema = z.object({
  rawEmail: z.string().min(10),
  relatedDesignerIds: z.array(z.string()).min(1),
  relatedProjectId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 422 });
  }

  const { rawEmail, relatedDesignerIds, relatedProjectId } = parsed.data;

  // 1. Parse email
  const email = await parseRawEmail(rawEmail);

  // 2. Dedup check
  const existing = await db.inboxEmail.findUnique({ where: { rawHash: email.rawHash } });
  if (existing) {
    return NextResponse.json({
      status: "duplicate",
      existingId: existing.id,
      existingDate: existing.receivedOn,
    }, { status: 200 });
  }

  // 3. Save InboxEmail with status=new
  const inboxEmail = await db.inboxEmail.create({
    data: {
      senderName: email.senderName,
      senderEmail: email.senderEmail,
      subject: email.subject,
      body: email.body,
      receivedOn: email.receivedOn ? new Date(email.receivedOn) : undefined,
      relatedDesignerIds: JSON.stringify(relatedDesignerIds),
      relatedProjectId: relatedProjectId ?? null,
      rawHash: email.rawHash,
      status: "new",
      source: "manual_form",
      createdBy: process.env.APP_USER_EMAIL ?? "owner",
    },
  });

  // 4. Check AI availability
  const provider = getProvider();
  if (!provider.available) {
    return NextResponse.json({
      status: "ok",
      inboxEmailId: inboxEmail.id,
      proposals: null,
      aiDisabled: true,
      message: "AI extraction disabled. Use manual entry or enable AI_MODE in .env.local.",
    });
  }

  // 5. Load context for extraction
  const designers = await db.designer.findMany({
    where: { id: { in: relatedDesignerIds }, archivedAt: null },
    select: { id: true, fullName: true, email: true, productArea: true },
  });

  let project = null;
  if (relatedProjectId) {
    project = await db.project.findUnique({
      where: { id: relatedProjectId },
      select: { projectName: true, description: true },
    });
  }

  // Find matching partner by sender email
  const existingPartner = email.senderEmail
    ? await db.partner.findUnique({
        where: { email: email.senderEmail },
        select: { id: true, fullName: true, role: true },
      })
    : null;

  // 6. Run extraction
  try {
    const proposals = await extractEmail({
      senderName: email.senderName,
      senderEmail: email.senderEmail,
      subject: email.subject,
      receivedOn: email.receivedOn,
      body: email.body,
      relatedDesigners: designers.map((d) => ({
        id: d.id,
        fullName: d.fullName,
        email: d.email,
        productArea: d.productArea,
      })),
      relatedProjectId: relatedProjectId ?? null,
      relatedProjectName: project?.projectName ?? null,
      relatedProjectDescription: project?.description ?? null,
      existingPartner: existingPartner
        ? { id: existingPartner.id, fullName: existingPartner.fullName, role: existingPartner.role }
        : null,
    });

    return NextResponse.json({
      status: "ok",
      inboxEmailId: inboxEmail.id,
      senderMatch: proposals.senderMatch,
      proposals: {
        feedback: proposals.proposedFeedback,
        impactEntries: proposals.proposedImpactEntries,
        highlights: proposals.proposedHighlights,
        riskSignals: proposals.proposedRiskSignals,
      },
      extractionNotes: proposals.extractionNotes,
      existingPartner: existingPartner
        ? { id: existingPartner.id, fullName: existingPartner.fullName }
        : null,
    });
  } catch (err) {
    // Extraction failed — return inboxEmailId so user can use manual entry
    console.error("[ingest/email] Extraction error:", err);
    return NextResponse.json({
      status: "extraction_failed",
      inboxEmailId: inboxEmail.id,
      error: String(err),
    }, { status: 200 }); // 200 because the email was saved; extraction is a soft failure
  }
}
