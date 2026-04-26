// POST /api/ingest/note — parse, dedup, extract proposals from free-form note
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/lib/db";
import { run as extractNote } from "@/lib/prompts/extract-note";
import { getProvider } from "@/lib/ai/provider";

const RequestSchema = z.object({
  body: z.string().min(10),
  noteDate: z.string().optional(),
  relatedDesignerIds: z.array(z.string()).min(1),
  relatedProjectId: z.string().optional(),
});

function hashBody(text: string): string {
  return crypto.createHash("sha256").update(text.replace(/\s+/g, " ").trim()).digest("hex");
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 422 });
  }

  const { body: noteBody, noteDate, relatedDesignerIds, relatedProjectId } = parsed.data;
  const rawHash = hashBody(noteBody);
  const today = new Date().toISOString().slice(0, 10);

  // Dedup check
  const existing = await db.inboxEmail.findUnique({ where: { rawHash } });
  if (existing) {
    return NextResponse.json({
      status: "duplicate",
      existingId: existing.id,
      existingDate: existing.receivedOn?.toISOString().slice(0, 10) ?? existing.createdAt.toISOString().slice(0, 10),
    });
  }

  // Save as InboxEmail (source=manual_form, no sender info)
  const inboxNote = await db.inboxEmail.create({
    data: {
      body: noteBody,
      receivedOn: noteDate ? new Date(noteDate) : new Date(),
      relatedDesignerIds: JSON.stringify(relatedDesignerIds),
      relatedProjectId: relatedProjectId ?? null,
      rawHash,
      status: "new",
      source: "manual_form",
      createdBy: process.env.APP_USER_EMAIL ?? "owner",
    },
  });

  // Check AI availability
  const provider = getProvider();
  if (!provider.available) {
    return NextResponse.json({
      status: "ok",
      inboxEmailId: inboxNote.id,
      proposals: null,
      aiDisabled: true,
      message: "AI extraction disabled. Use manual entry or enable AI_MODE in .env.local.",
    });
  }

  // Load context
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

  try {
    const proposals = await extractNote({
      body: noteBody,
      noteDate: noteDate ?? today,
      relatedDesigners: designers.map((d) => ({
        id: d.id,
        fullName: d.fullName,
        email: d.email,
        productArea: d.productArea,
      })),
      relatedProjectId: relatedProjectId ?? null,
      relatedProjectName: project?.projectName ?? null,
      relatedProjectDescription: project?.description ?? null,
    });

    return NextResponse.json({
      status: "ok",
      inboxEmailId: inboxNote.id,
      proposals: {
        feedback: proposals.proposedFeedback,
        impactEntries: proposals.proposedImpactEntries,
        highlights: proposals.proposedHighlights,
        riskSignals: proposals.proposedRiskSignals,
      },
      extractionNotes: proposals.extractionNotes,
    });
  } catch (err) {
    console.error("[ingest/note] Extraction error:", err);
    return NextResponse.json({
      status: "extraction_failed",
      inboxEmailId: inboxNote.id,
      error: String(err),
    });
  }
}
