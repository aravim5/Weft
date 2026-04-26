"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface Designer { id: string; fullName: string; }
interface Project { id: string; projectName: string; }
interface ProposedFeedback { designerId: string; feedbackSource: string; sentiment: string; theme: string; summary: string; occurredOn?: string | null; confidence: string; }
interface ProposedImpactEntry { designerId: string; dimension: string; magnitude: string; summary: string; }
interface ProposedHighlight { designerId: string; kind: string; description: string; }
interface ProposedRiskSignal { designerId: string; signalType: string; severity: string; evidence: string; }

interface ExtractionResult {
  status: string; inboxEmailId: string;
  proposals?: { feedback: ProposedFeedback[]; impactEntries: ProposedImpactEntry[]; highlights: ProposedHighlight[]; riskSignals: ProposedRiskSignal[]; };
  extractionNotes?: string; fileName?: string; aiDisabled?: boolean; error?: string; existingId?: string; existingDate?: string;
}

const ACCEPT = ".csv,.xlsx,.xls,.pdf,.txt";

export default function IngestUploadPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"form" | "preview" | "done">("form");
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [noteDate, setNoteDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedDesignerIds, setSelectedDesignerIds] = useState<string[]>([]);
  const [relatedProjectId, setRelatedProjectId] = useState("");
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);

  const [feedbackItems, setFeedbackItems] = useState<ProposedFeedback[]>([]);
  const [feedbackChecked, setFeedbackChecked] = useState<boolean[]>([]);
  const [impactItems, setImpactItems] = useState<ProposedImpactEntry[]>([]);
  const [impactChecked, setImpactChecked] = useState<boolean[]>([]);
  const [highlightItems, setHighlightItems] = useState<ProposedHighlight[]>([]);
  const [highlightChecked, setHighlightChecked] = useState<boolean[]>([]);
  const [riskItems, setRiskItems] = useState<ProposedRiskSignal[]>([]);
  const [riskChecked, setRiskChecked] = useState<boolean[]>([]);

  useEffect(() => {
    fetch("/api/entities/designer").then((r) => r.json()).then((d) => setDesigners(d.data ?? [])).catch(() => {});
    fetch("/api/entities/project").then((r) => r.json()).then((d) => setProjects(d.data ?? [])).catch(() => {});
  }, []);

  const toggleDesigner = useCallback((id: string) => {
    setSelectedDesignerIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }, []);

  async function handleUpload() {
    if (!selectedFile) { toast.error("Choose a file first."); return; }
    if (selectedDesignerIds.length === 0) { toast.error("Select at least one designer."); return; }
    setIsUploading(true);
    try {
      const form = new FormData();
      form.append("file", selectedFile);
      form.append("relatedDesignerIds", JSON.stringify(selectedDesignerIds));
      form.append("noteDate", noteDate);
      if (relatedProjectId) form.append("relatedProjectId", relatedProjectId);
      const res = await fetch("/api/ingest/file", { method: "POST", body: form });
      const data: ExtractionResult = await res.json();
      setExtraction(data);
      if (data.status === "duplicate") { toast.warning(`Already ingested on ${data.existingDate?.slice(0, 10) ?? "unknown"}.`); return; }
      if (!res.ok) { toast.error(data.error ?? "Upload failed"); return; }
      const p = data.proposals;
      const fb = p?.feedback ?? []; const ie = p?.impactEntries ?? []; const hl = p?.highlights ?? []; const rs = p?.riskSignals ?? [];
      setFeedbackItems(fb); setFeedbackChecked(fb.map(() => true));
      setImpactItems(ie); setImpactChecked(ie.map(() => true));
      setHighlightItems(hl); setHighlightChecked(hl.map(() => true));
      setRiskItems(rs); setRiskChecked(rs.map(() => true));
      setStep("preview");
      if (data.aiDisabled) toast.info("AI disabled — no proposals generated.");
    } catch (err) {
      toast.error(`Error: ${String(err)}`);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleCommit() {
    if (!extraction?.inboxEmailId) return;
    const approvedFeedback = feedbackItems.filter((_, i) => feedbackChecked[i]);
    const approvedImpact = impactItems.filter((_, i) => impactChecked[i]);
    const approvedHighlights = highlightItems.filter((_, i) => highlightChecked[i]);
    const approvedRisk = riskItems.filter((_, i) => riskChecked[i]);
    const total = approvedFeedback.length + approvedImpact.length + approvedHighlights.length + approvedRisk.length;
    if (total === 0) { toast.warning("Nothing selected."); return; }
    setIsSaving(true);
    try {
      const res = await fetch("/api/ingest/email/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inboxEmailId: extraction.inboxEmailId,
          approved: { feedback: approvedFeedback, impactEntries: approvedImpact, highlights: approvedHighlights, riskSignals: approvedRisk },
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Commit failed"); setIsSaving(false); return; }
      toast.success(data.summary);
      setStep("done");
      if (data.primaryDesignerId) setTimeout(() => router.push(`/designers/${data.primaryDesignerId}`), 1500);
    } catch (err) {
      toast.error(`Error: ${String(err)}`);
      setIsSaving(false);
    }
  }

  const totalChecked = feedbackChecked.filter(Boolean).length + impactChecked.filter(Boolean).length + highlightChecked.filter(Boolean).length + riskChecked.filter(Boolean).length;
  const totalProposals = feedbackItems.length + impactItems.length + highlightItems.length + riskItems.length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Upload File</h1>
        <p className="text-sm text-muted-foreground mt-1">Upload a CSV, Excel, PDF, or text file — Claude extracts structured rows for your review.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">File + Context</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>File <span className="text-muted-foreground text-xs">(CSV, XLSX, PDF, TXT)</span></Label>
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setSelectedFile(f); }}
            >
              {selectedFile ? (
                <p className="text-sm font-medium">{selectedFile.name} <span className="text-muted-foreground">({(selectedFile.size / 1024).toFixed(1)} KB)</span></p>
              ) : (
                <p className="text-sm text-muted-foreground">Drag & drop or click to choose</p>
              )}
              <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setSelectedFile(f); }} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Date of document</Label>
            <Input type="date" className="w-48 text-sm" value={noteDate} onChange={(e) => setNoteDate(e.target.value)} disabled={step === "preview"} />
          </div>
          <div className="space-y-1.5">
            <Label>About which designers? <span className="text-destructive">*</span></Label>
            <div className="flex flex-wrap gap-2">
              {designers.map((d) => (
                <button key={d.id} type="button" disabled={step === "preview"} onClick={() => toggleDesigner(d.id)}
                  className={`rounded-full px-3 py-1 text-xs border transition-colors ${selectedDesignerIds.includes(d.id) ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border hover:bg-muted"}`}>
                  {d.fullName}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Related project (optional)</Label>
            <select className="w-full border rounded-md px-3 py-1.5 text-sm bg-background" value={relatedProjectId} onChange={(e) => setRelatedProjectId(e.target.value)} disabled={step === "preview"}>
              <option value="">— none —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.projectName}</option>)}
            </select>
          </div>
          {step === "form" && <Button onClick={handleUpload} disabled={isUploading} className="w-full">{isUploading ? "Uploading + extracting…" : "Upload & Extract"}</Button>}
          {step === "preview" && <Button variant="outline" size="sm" onClick={() => setStep("form")}>← Change file</Button>}
        </CardContent>
      </Card>

      {extraction?.status === "duplicate" && (
        <Card className="border-amber-300 bg-amber-50"><CardContent className="pt-4"><p className="text-sm font-medium text-amber-800">Already ingested on {extraction.existingDate?.slice(0, 10) ?? "unknown"}.</p></CardContent></Card>
      )}

      {extraction?.status === "extraction_failed" && step === "preview" && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-4 space-y-2">
            <p className="text-sm font-medium text-destructive">Extraction failed</p>
            <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Show error</summary><pre className="mt-2 whitespace-pre-wrap">{extraction.error}</pre></details>
          </CardContent>
        </Card>
      )}

      {step === "preview" && extraction?.status === "ok" && (
        <>
          {extraction.extractionNotes && (
            <Card className="bg-muted/40"><CardContent className="pt-4"><p className="text-xs text-muted-foreground"><span className="font-medium">AI notes:</span> {extraction.extractionNotes}</p></CardContent></Card>
          )}

          {feedbackItems.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2">Feedback <Badge variant="secondary">{feedbackChecked.filter(Boolean).length}/{feedbackItems.length}</Badge></CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {feedbackItems.map((item, i) => (
                  <div key={i} className={`border rounded-lg p-4 space-y-2 transition-opacity ${feedbackChecked[i] ? "" : "opacity-40"}`}>
                    <div className="flex items-start gap-3">
                      <Checkbox checked={feedbackChecked[i]} onCheckedChange={() => setFeedbackChecked((prev) => prev.map((v, j) => j === i ? !v : v))} className="mt-0.5" />
                      <div className="flex-1 space-y-1">
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className="font-medium text-sm">{designers.find((d) => d.id === item.designerId)?.fullName ?? item.designerId}</span>
                          <Badge variant="outline" className="text-xs">{item.sentiment}</Badge>
                          <Badge variant="outline" className="text-xs">{item.theme}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{item.summary}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {impactItems.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2">Impact Entries <Badge variant="secondary">{impactChecked.filter(Boolean).length}/{impactItems.length}</Badge></CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {impactItems.map((item, i) => (
                  <div key={i} className={`border rounded-lg p-4 space-y-1 transition-opacity ${impactChecked[i] ? "" : "opacity-40"}`}>
                    <div className="flex items-start gap-3">
                      <Checkbox checked={impactChecked[i]} onCheckedChange={() => setImpactChecked((prev) => prev.map((v, j) => j === i ? !v : v))} className="mt-0.5" />
                      <div className="flex-1">
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className="font-medium text-sm">{designers.find((d) => d.id === item.designerId)?.fullName ?? item.designerId}</span>
                          <Badge variant="outline" className="text-xs">{item.dimension}</Badge>
                          <Badge variant="outline" className="text-xs">{item.magnitude}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{item.summary}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {highlightItems.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2">Highlights <Badge variant="secondary">{highlightChecked.filter(Boolean).length}/{highlightItems.length}</Badge></CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {highlightItems.map((item, i) => (
                  <div key={i} className={`border rounded-lg p-4 transition-opacity ${highlightChecked[i] ? "" : "opacity-40"}`}>
                    <div className="flex items-start gap-3">
                      <Checkbox checked={highlightChecked[i]} onCheckedChange={() => setHighlightChecked((prev) => prev.map((v, j) => j === i ? !v : v))} className="mt-0.5" />
                      <div className="flex-1">
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className="font-medium text-sm">{designers.find((d) => d.id === item.designerId)?.fullName ?? item.designerId}</span>
                          <Badge variant="outline" className="text-xs">{item.kind}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {riskItems.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2">Risk Signals <Badge variant="secondary" className="bg-red-100 text-red-800">{riskChecked.filter(Boolean).length}/{riskItems.length}</Badge></CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {riskItems.map((item, i) => (
                  <div key={i} className={`border rounded-lg p-4 transition-opacity ${riskChecked[i] ? "" : "opacity-40"}`}>
                    <div className="flex items-start gap-3">
                      <Checkbox checked={riskChecked[i]} onCheckedChange={() => setRiskChecked((prev) => prev.map((v, j) => j === i ? !v : v))} className="mt-0.5" />
                      <div className="flex-1">
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className="font-medium text-sm">{designers.find((d) => d.id === item.designerId)?.fullName ?? item.designerId}</span>
                          <Badge variant="outline" className="text-xs text-red-800">{item.severity}</Badge>
                          <Badge variant="outline" className="text-xs">{item.signalType}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{item.evidence}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {totalProposals === 0 && (
            <Card className="bg-muted/40"><CardContent className="pt-4"><p className="text-sm text-muted-foreground">No proposals extracted from this file.</p></CardContent></Card>
          )}

          <Separator />
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{totalChecked} of {totalProposals} rows selected</p>
            <Button onClick={handleCommit} disabled={isSaving}>{isSaving ? "Saving…" : `Save ${totalChecked} row${totalChecked !== 1 ? "s" : ""}`}</Button>
          </div>
        </>
      )}

      {step === "done" && (
        <Card className="border-green-300 bg-green-50"><CardContent className="pt-4"><p className="text-sm font-medium text-green-800">Saved. Redirecting…</p></CardContent></Card>
      )}
    </div>
  );
}
