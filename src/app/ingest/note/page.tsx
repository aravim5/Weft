"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface Designer { id: string; fullName: string; email: string; productArea: string; }
interface Project { id: string; projectName: string; }

interface ProposedFeedback { designerId: string; feedbackSource: string; sentiment: string; theme: string; summary: string; quote?: string | null; confidence: string; occurredOn?: string | null; }
interface ProposedImpactEntry { designerId: string; dimension: string; magnitude: string; summary: string; date?: string; occurredOn?: string; }
interface ProposedHighlight { designerId: string; kind: string; description: string; occurredOn?: string; }
interface ProposedRiskSignal { designerId: string; signalType: string; severity: string; evidence: string; }

interface ExtractionResult {
  status: string; inboxEmailId: string;
  proposals?: { feedback: ProposedFeedback[]; impactEntries: ProposedImpactEntry[]; highlights: ProposedHighlight[]; riskSignals: ProposedRiskSignal[]; };
  extractionNotes?: string; aiDisabled?: boolean; error?: string; existingId?: string; existingDate?: string;
}

function sentimentColor(s: string) {
  if (s === "positive") return "bg-green-100 text-green-800";
  if (s === "needs_improvement") return "bg-amber-100 text-amber-800";
  return "bg-gray-100 text-gray-700";
}

export default function IngestNotePage() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "preview" | "done">("form");
  const [isSaving, setIsSaving] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);

  const [noteBody, setNoteBody] = useState("");
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

  async function handleExtract() {
    if (!noteBody.trim()) { toast.error("Paste a note first."); return; }
    if (selectedDesignerIds.length === 0) { toast.error("Select at least one designer."); return; }
    setIsExtracting(true);
    try {
      const res = await fetch("/api/ingest/note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteBody, noteDate, relatedDesignerIds: selectedDesignerIds, relatedProjectId: relatedProjectId || undefined }),
      });
      const data: ExtractionResult = await res.json();
      setExtraction(data);
      if (data.status === "duplicate") { toast.warning(`Already ingested on ${data.existingDate?.slice(0, 10) ?? "unknown date"}.`); return; }
      const p = data.proposals;
      const fb = p?.feedback ?? []; const ie = p?.impactEntries ?? []; const hl = p?.highlights ?? []; const rs = p?.riskSignals ?? [];
      setFeedbackItems(fb); setFeedbackChecked(fb.map(() => true));
      setImpactItems(ie); setImpactChecked(ie.map(() => true));
      setHighlightItems(hl); setHighlightChecked(hl.map(() => true));
      setRiskItems(rs); setRiskChecked(rs.map(() => true));
      setStep("preview");
      if (data.aiDisabled) toast.info("AI disabled — no proposals. Use manual entry instead.");
    } catch (err) {
      toast.error(`Error: ${String(err)}`);
    } finally {
      setIsExtracting(false);
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
        <h1 className="text-2xl font-semibold tracking-tight">Ingest Note</h1>
        <p className="text-sm text-muted-foreground mt-1">Paste a rough observation or note — Claude extracts structured rows for your review.</p>
      </div>

      {/* Form */}
      <Card>
        <CardHeader><CardTitle className="text-base">Note + Context</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Note text</Label>
            <Textarea placeholder="Paste your observation, rough notes, or Slack message here…" className="min-h-[160px] text-sm" value={noteBody} onChange={(e) => setNoteBody(e.target.value)} disabled={step === "preview"} />
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
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
          {step === "form" && <Button onClick={handleExtract} disabled={isExtracting} className="w-full">{isExtracting ? "Extracting…" : "Extract with AI"}</Button>}
          {step === "preview" && <Button variant="outline" size="sm" onClick={() => setStep("form")}>← Edit note</Button>}
        </CardContent>
      </Card>

      {/* Duplicate */}
      {extraction?.status === "duplicate" && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="pt-4">
            <p className="text-sm font-medium text-amber-800">Already ingested on {extraction.existingDate?.slice(0, 10) ?? "unknown date"}.</p>
          </CardContent>
        </Card>
      )}

      {/* Extraction failed */}
      {extraction?.status === "extraction_failed" && step === "preview" && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-4 space-y-2">
            <p className="text-sm font-medium text-destructive">AI extraction failed</p>
            <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Show error</summary><pre className="mt-2 whitespace-pre-wrap">{extraction.error}</pre></details>
          </CardContent>
        </Card>
      )}

      {/* Preview */}
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
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className="font-medium text-sm">{designers.find((d) => d.id === item.designerId)?.fullName ?? item.designerId}</span>
                          <Badge variant="outline" className={`text-xs ${sentimentColor(item.sentiment)}`}>{item.sentiment}</Badge>
                          <Badge variant="outline" className="text-xs">{item.theme}</Badge>
                          <Badge variant="outline" className="text-xs">{item.feedbackSource}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{item.summary}</p>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div><Label className="text-xs">Summary (edit)</Label><Input className="text-xs h-7" value={item.summary} onChange={(e) => setFeedbackItems((prev) => prev.map((v, j) => j === i ? { ...v, summary: e.target.value } : v))} /></div>
                          <div><Label className="text-xs">Occurred on</Label><Input className="text-xs h-7" type="date" value={item.occurredOn ?? ""} onChange={(e) => setFeedbackItems((prev) => prev.map((v, j) => j === i ? { ...v, occurredOn: e.target.value || null } : v))} /></div>
                        </div>
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
                  <div key={i} className={`border rounded-lg p-4 space-y-2 transition-opacity ${impactChecked[i] ? "" : "opacity-40"}`}>
                    <div className="flex items-start gap-3">
                      <Checkbox checked={impactChecked[i]} onCheckedChange={() => setImpactChecked((prev) => prev.map((v, j) => j === i ? !v : v))} className="mt-0.5" />
                      <div className="flex-1 space-y-2">
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
                  <div key={i} className={`border rounded-lg p-4 space-y-2 transition-opacity ${highlightChecked[i] ? "" : "opacity-40"}`}>
                    <div className="flex items-start gap-3">
                      <Checkbox checked={highlightChecked[i]} onCheckedChange={() => setHighlightChecked((prev) => prev.map((v, j) => j === i ? !v : v))} className="mt-0.5" />
                      <div className="flex-1">
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className="font-medium text-sm">{designers.find((d) => d.id === item.designerId)?.fullName ?? item.designerId}</span>
                          <Badge variant="outline" className="text-xs">{item.kind}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
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
                  <div key={i} className={`border rounded-lg p-4 space-y-2 transition-opacity ${riskChecked[i] ? "" : "opacity-40"}`}>
                    <div className="flex items-start gap-3">
                      <Checkbox checked={riskChecked[i]} onCheckedChange={() => setRiskChecked((prev) => prev.map((v, j) => j === i ? !v : v))} className="mt-0.5" />
                      <div className="flex-1">
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className="font-medium text-sm">{designers.find((d) => d.id === item.designerId)?.fullName ?? item.designerId}</span>
                          <Badge variant="outline" className="text-xs text-red-800">{item.severity}</Badge>
                          <Badge variant="outline" className="text-xs">{item.signalType}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{item.evidence}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {totalProposals === 0 && (
            <Card className="bg-muted/40"><CardContent className="pt-4"><p className="text-sm text-muted-foreground">No proposals extracted.</p></CardContent></Card>
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
