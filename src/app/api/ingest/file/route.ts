// POST /api/ingest/file — multipart upload → parse → pipe to note extraction
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { db } from "@/lib/db";
import { parseUploadedFile } from "@/lib/parsers/file";
import { run as extractNote } from "@/lib/prompts/extract-note";
import { getProvider } from "@/lib/ai/provider";

const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function hashBuffer(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const relatedDesignerIdsRaw = formData.get("relatedDesignerIds");
  const relatedProjectId = (formData.get("relatedProjectId") as string) || undefined;
  const noteDate = (formData.get("noteDate") as string) || undefined;

  let relatedDesignerIds: string[] = [];
  try {
    relatedDesignerIds = JSON.parse(relatedDesignerIdsRaw as string);
    if (!Array.isArray(relatedDesignerIds) || relatedDesignerIds.length === 0) throw new Error();
  } catch {
    return NextResponse.json({ error: "relatedDesignerIds must be a non-empty JSON array" }, { status: 422 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fileHash = hashBuffer(buffer);

  // Dedup on file hash
  const existing = await db.inboxEmail.findUnique({ where: { rawHash: fileHash } });
  if (existing) {
    return NextResponse.json({
      status: "duplicate",
      existingId: existing.id,
      existingDate: existing.receivedOn?.toISOString().slice(0, 10) ?? existing.createdAt.toISOString().slice(0, 10),
    });
  }

  // Parse file → text
  let parsed;
  try {
    parsed = await parseUploadedFile(buffer, file.name, file.type);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 415 });
  }

  // Save raw file to data/uploads/<hash>.<ext>
  ensureUploadsDir();
  const ext = file.name.split(".").pop() ?? "bin";
  const filePath = path.join(UPLOADS_DIR, `${fileHash}.${ext}`);
  fs.writeFileSync(filePath, buffer);

  // Save InboxEmail row
  const inboxRow = await db.inboxEmail.create({
    data: {
      subject: file.name,
      body: parsed.text,
      receivedOn: noteDate ? new Date(noteDate) : new Date(),
      relatedDesignerIds: JSON.stringify(relatedDesignerIds),
      relatedProjectId: relatedProjectId ?? null,
      rawHash: fileHash,
      status: "new",
      source: "imported",
      createdBy: process.env.APP_USER_EMAIL ?? "owner",
    },
  });

  // Check AI
  const provider = getProvider();
  if (!provider.available) {
    return NextResponse.json({
      status: "ok",
      inboxEmailId: inboxRow.id,
      proposals: null,
      aiDisabled: true,
      parsedText: parsed.text.substring(0, 500),
      message: "AI extraction disabled.",
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

  const today = new Date().toISOString().slice(0, 10);

  try {
    const proposals = await extractNote({
      body: parsed.text,
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
      inboxEmailId: inboxRow.id,
      fileName: file.name,
      proposals: {
        feedback: proposals.proposedFeedback,
        impactEntries: proposals.proposedImpactEntries,
        highlights: proposals.proposedHighlights,
        riskSignals: proposals.proposedRiskSignals,
      },
      extractionNotes: proposals.extractionNotes,
    });
  } catch (err) {
    console.error("[ingest/file] Extraction error:", err);
    return NextResponse.json({
      status: "extraction_failed",
      inboxEmailId: inboxRow.id,
      error: String(err),
    });
  }
}
