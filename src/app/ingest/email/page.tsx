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

// ─── Types ──────────────────────────────────────────────────────────────────

interface Designer {
  id: string;
  fullName: string;
  email: string;
  productArea: string;
}

interface Project {
  id: string;
  projectName: string;
}

interface ProposedFeedback {
  designerId: string;
  partnerId?: string | null;
  feedbackSource: string;
  sentiment: string;
  theme: string;
  summary: string;
  quote?: string | null;
  confidence: string;
  occurredOn?: string | null;
  projectId?: string | null;
}

interface ProposedImpactEntry {
  designerId: string;
  projectId?: string | null;
  dimension: string;
  magnitude: string;
  summary: string;
  occurredOn?: string | null;
}

interface ProposedHighlight {
  designerId: string;
  kind: string;
  description: string;
  occurredOn?: string | null;
  projectId?: string | null;
}

interface ProposedRiskSignal {
  designerId: string;
  signalType: string;
  severity: string;
  evidence: string;
  occurredOn?: string | null;
}

interface ExtractionResult {
  status: string;
  inboxEmailId: string;
  senderMatch?: string;
  proposals?: {
    feedback: ProposedFeedback[];
    impactEntries: ProposedImpactEntry[];
    highlights: ProposedHighlight[];
    riskSignals: ProposedRiskSignal[];
  };
  extractionNotes?: string;
  existingPartner?: { id: string; fullName: string } | null;
  aiDisabled?: boolean;
  error?: string;
  existingId?: string;
  existingDate?: string;
}

type Step = "form" | "preview" | "saving" | "done";

// ─── Helpers ────────────────────────────────────────────────────────────────

function sentimentColor(s: string) {
  if (s === "positive") return "bg-green-100 text-green-800";
  if (s === "constructive") return "bg-amber-100 text-amber-800";
  if (s === "mixed") return "bg-blue-100 text-blue-800";
  return "bg-gray-100 text-gray-700";
}

function severityColor(s: string) {
  if (s === "high") return "bg-red-100 text-red-800";
  if (s === "medium") return "bg-amber-100 text-amber-800";
  return "bg-gray-100 text-gray-700";
}

// ─── Row components ──────────────────────────────────────────────────────────

function FeedbackRow({
  item,
  index,
  checked,
  onChange,
  designers,
}: {
  item: ProposedFeedback;
  index: number;
  checked: boolean;
  onChange: (val: ProposedFeedback) => void;
  designers: Designer[];
}) {
  const designer = designers.find((d) => d.id === item.designerId);
  return (
    <div className={`border rounded-lg p-4 space-y-3 transition-opacity ${checked ? "" : "opacity-40"}`}>
      <div className="flex items-start gap-3">
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => onChange({ ...item })}
          id={`fb-${index}`}
          className="mt-0.5"
          onClick={() => onChange(item)}
        />
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="font-medium text-sm">{designer?.fullName ?? item.designerId}</span>
            <Badge variant="outline" className={`text-xs ${sentimentColor(item.sentiment)}`}>{item.sentiment}</Badge>
            <Badge variant="outline" className="text-xs">{item.theme}</Badge>
            <Badge variant="outline" className="text-xs">{item.feedbackSource}</Badge>
            <Badge variant="outline" className="text-xs">confidence: {item.confidence}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{item.summary}</p>
          {item.quote && (
            <blockquote className="border-l-2 pl-3 text-xs text-muted-foreground italic">
              &ldquo;{item.quote}&rdquo;
            </blockquote>
          )}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <Label className="text-xs">Summary (edit)</Label>
              <Input
                className="text-xs h-7"
                value={item.summary}
                onChange={(e) => onChange({ ...item, summary: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Occurred on</Label>
              <Input
                className="text-xs h-7"
                type="date"
                value={item.occurredOn ?? ""}
                onChange={(e) => onChange({ ...item, occurredOn: e.target.value || null })}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ImpactRow({
  item,
  index,
  checked,
  onChange,
  designers,
}: {
  item: ProposedImpactEntry;
  index: number;
  checked: boolean;
  onChange: (val: ProposedImpactEntry) => void;
  designers: Designer[];
}) {
  const designer = designers.find((d) => d.id === item.designerId);
  return (
    <div className={`border rounded-lg p-4 space-y-2 transition-opacity ${checked ? "" : "opacity-40"}`}>
      <div className="flex items-start gap-3">
        <Checkbox checked={checked} onCheckedChange={() => onChange(item)} id={`ie-${index}`} className="mt-0.5" />
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="font-medium text-sm">{designer?.fullName ?? item.designerId}</span>
            <Badge variant="outline" className="text-xs">{item.dimension}</Badge>
            <Badge variant="outline" className="text-xs">{item.magnitude}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{item.summary}</p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <Label className="text-xs">Summary (edit)</Label>
              <Input className="text-xs h-7" value={item.summary} onChange={(e) => onChange({ ...item, summary: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Occurred on</Label>
              <Input className="text-xs h-7" type="date" value={item.occurredOn ?? ""} onChange={(e) => onChange({ ...item, occurredOn: e.target.value || null })} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HighlightRow({
  item,
  index,
  checked,
  onChange,
  designers,
}: {
  item: ProposedHighlight;
  index: number;
  checked: boolean;
  onChange: (val: ProposedHighlight) => void;
  designers: Designer[];
}) {
  const designer = designers.find((d) => d.id === item.designerId);
  return (
    <div className={`border rounded-lg p-4 space-y-2 transition-opacity ${checked ? "" : "opacity-40"}`}>
      <div className="flex items-start gap-3">
        <Checkbox checked={checked} onCheckedChange={() => onChange(item)} id={`hl-${index}`} className="mt-0.5" />
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="font-medium text-sm">{designer?.fullName ?? item.designerId}</span>
            <Badge variant="outline" className="text-xs">{item.kind}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{item.description}</p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <Label className="text-xs">Description (edit)</Label>
              <Input className="text-xs h-7" value={item.description} onChange={(e) => onChange({ ...item, description: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Occurred on</Label>
              <Input className="text-xs h-7" type="date" value={item.occurredOn ?? ""} onChange={(e) => onChange({ ...item, occurredOn: e.target.value || null })} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RiskRow({
  item,
  index,
  checked,
  onChange,
  designers,
}: {
  item: ProposedRiskSignal;
  index: number;
  checked: boolean;
  onChange: (val: ProposedRiskSignal) => void;
  designers: Designer[];
}) {
  const designer = designers.find((d) => d.id === item.designerId);
  return (
    <div className={`border rounded-lg p-4 space-y-2 transition-opacity ${checked ? "" : "opacity-40"}`}>
      <div className="flex items-start gap-3">
        <Checkbox checked={checked} onCheckedChange={() => onChange(item)} id={`rs-${index}`} className="mt-0.5" />
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="font-medium text-sm">{designer?.fullName ?? item.designerId}</span>
            <Badge variant="outline" className={`text-xs ${severityColor(item.severity)}`}>{item.severity}</Badge>
            <Badge variant="outline" className="text-xs">{item.signalType}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{item.evidence}</p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <Label className="text-xs">Evidence (edit)</Label>
              <Input className="text-xs h-7" value={item.evidence} onChange={(e) => onChange({ ...item, evidence: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Occurred on</Label>
              <Input className="text-xs h-7" type="date" value={item.occurredOn ?? ""} onChange={(e) => onChange({ ...item, occurredOn: e.target.value || null })} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function IngestEmailPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("form");
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [rawEmail, setRawEmail] = useState("");
  const [selectedDesignerIds, setSelectedDesignerIds] = useState<string[]>([]);
  const [relatedProjectId, setRelatedProjectId] = useState("");
  const [extracting, setExtracting] = useState(false);

  // Data
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // Extraction result
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);

  // Preview state (edited + checked)
  const [feedbackItems, setFeedbackItems] = useState<ProposedFeedback[]>([]);
  const [feedbackChecked, setFeedbackChecked] = useState<boolean[]>([]);
  const [impactItems, setImpactItems] = useState<ProposedImpactEntry[]>([]);
  const [impactChecked, setImpactChecked] = useState<boolean[]>([]);
  const [highlightItems, setHighlightItems] = useState<ProposedHighlight[]>([]);
  const [highlightChecked, setHighlightChecked] = useState<boolean[]>([]);
  const [riskItems, setRiskItems] = useState<ProposedRiskSignal[]>([]);
  const [riskChecked, setRiskChecked] = useState<boolean[]>([]);

  // Partner state
  const [partnerMode, setPartnerMode] = useState<"none" | "existing" | "new">("none");
  const [newPartnerName, setNewPartnerName] = useState("");
  const [newPartnerEmail, setNewPartnerEmail] = useState("");
  const [newPartnerRole, setNewPartnerRole] = useState("");

  // Load designers + projects
  useEffect(() => {
    fetch("/api/entities/designer")
      .then((r) => r.json())
      .then((d) => setDesigners(d.data ?? []))
      .catch(() => {});
    fetch("/api/entities/project")
      .then((r) => r.json())
      .then((d) => setProjects(d.data ?? []))
      .catch(() => {});
  }, []);

  const toggleDesigner = useCallback((id: string) => {
    setSelectedDesignerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  async function handleExtract() {
    if (!rawEmail.trim()) { toast.error("Paste an email first."); return; }
    if (selectedDesignerIds.length === 0) { toast.error("Select at least one designer."); return; }
    setExtracting(true);
    try {
      const res = await fetch("/api/ingest/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawEmail,
          relatedDesignerIds: selectedDesignerIds,
          relatedProjectId: relatedProjectId || undefined,
        }),
      });
      const data: ExtractionResult = await res.json();
      setExtraction(data);

      if (data.status === "duplicate") {
        toast.warning(`Already ingested on ${data.existingDate?.slice(0, 10) ?? "unknown date"}.`);
        return;
      }

      if (data.status === "extraction_failed") {
        toast.error("AI extraction failed. You can still use the manual form.");
        setStep("preview");
        setFeedbackItems([]); setFeedbackChecked([]);
        setImpactItems([]); setImpactChecked([]);
        setHighlightItems([]); setHighlightChecked([]);
        setRiskItems([]); setRiskChecked([]);
        return;
      }

      // AI disabled or ok
      const p = data.proposals;
      const fb = p?.feedback ?? [];
      const ie = p?.impactEntries ?? [];
      const hl = p?.highlights ?? [];
      const rs = p?.riskSignals ?? [];
      setFeedbackItems(fb); setFeedbackChecked(fb.map(() => true));
      setImpactItems(ie); setImpactChecked(ie.map(() => true));
      setHighlightItems(hl); setHighlightChecked(hl.map(() => true));
      setRiskItems(rs); setRiskChecked(rs.map(() => true));

      // Pre-fill partner state
      if (data.existingPartner) {
        setPartnerMode("existing");
      } else if (data.senderMatch === "unknown") {
        setPartnerMode("new");
      }

      setStep("preview");
      if (data.aiDisabled) toast.info("AI disabled — no proposals generated. Add rows manually or use the manual form.");
    } catch (err) {
      toast.error(`Network error: ${String(err)}`);
    } finally {
      setExtracting(false);
    }
  }

  async function handleCommit() {
    if (!extraction?.inboxEmailId) return;
    setIsSaving(true);

    const approvedFeedback = feedbackItems.filter((_, i) => feedbackChecked[i]);
    const approvedImpact = impactItems.filter((_, i) => impactChecked[i]);
    const approvedHighlights = highlightItems.filter((_, i) => highlightChecked[i]);
    const approvedRisk = riskItems.filter((_, i) => riskChecked[i]);

    const total = approvedFeedback.length + approvedImpact.length + approvedHighlights.length + approvedRisk.length;
    if (total === 0) {
      toast.warning("Nothing selected — uncheck at least one row to save.");
      setIsSaving(false);
      return;
    }

    let partner: { existingId: string } | { new: { fullName: string; email?: string; role?: string } } | null = null;
    if (partnerMode === "existing" && extraction.existingPartner) {
      partner = { existingId: extraction.existingPartner.id };
    } else if (partnerMode === "new" && newPartnerName.trim()) {
      partner = { new: { fullName: newPartnerName.trim(), email: newPartnerEmail || undefined, role: newPartnerRole || undefined } };
    }

    try {
      const res = await fetch("/api/ingest/email/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inboxEmailId: extraction.inboxEmailId,
          approved: {
            feedback: approvedFeedback,
            impactEntries: approvedImpact,
            highlights: approvedHighlights,
            riskSignals: approvedRisk,
          },
          partner,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Commit failed");
        setIsSaving(false);
        return;
      }
      toast.success(data.summary);
      setStep("done");
      if (data.primaryDesignerId) {
        setTimeout(() => router.push(`/designers/${data.primaryDesignerId}`), 1500);
      }
    } catch (err) {
      toast.error(`Network error: ${String(err)}`);
      setIsSaving(false);
    }
  }

  const totalProposals = feedbackItems.length + impactItems.length + highlightItems.length + riskItems.length;
  const totalChecked = feedbackChecked.filter(Boolean).length + impactChecked.filter(Boolean).length + highlightChecked.filter(Boolean).length + riskChecked.filter(Boolean).length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ingest Email</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Paste a raw email — Claude will extract feedback, impact entries, highlights, and risk signals for your review.
        </p>
      </div>

      {/* ── STEP: FORM ── */}
      {(step === "form" || step === "preview") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Email + Context</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Raw email</Label>
              <Textarea
                placeholder="Paste the full email here (headers optional — plain text works too)…"
                className="min-h-[180px] font-mono text-xs"
                value={rawEmail}
                onChange={(e) => setRawEmail(e.target.value)}
                disabled={step === "preview"}
              />
            </div>

            <div className="space-y-1.5">
              <Label>About which designers? <span className="text-destructive">*</span></Label>
              <div className="flex flex-wrap gap-2">
                {designers.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    disabled={step === "preview"}
                    onClick={() => toggleDesigner(d.id)}
                    className={`rounded-full px-3 py-1 text-xs border transition-colors ${
                      selectedDesignerIds.includes(d.id)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-border hover:bg-muted"
                    }`}
                  >
                    {d.fullName}
                  </button>
                ))}
                {designers.length === 0 && (
                  <span className="text-xs text-muted-foreground">Loading designers…</span>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Related project (optional)</Label>
              <select
                className="w-full border rounded-md px-3 py-1.5 text-sm bg-background"
                value={relatedProjectId}
                onChange={(e) => setRelatedProjectId(e.target.value)}
                disabled={step === "preview"}
              >
                <option value="">— none —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.projectName}</option>
                ))}
              </select>
            </div>

            {step === "form" && (
              <Button onClick={handleExtract} disabled={extracting} className="w-full">
                {extracting ? "Extracting…" : "Extract with AI"}
              </Button>
            )}

            {step === "preview" && (
              <Button variant="outline" size="sm" onClick={() => setStep("form")}>
                ← Edit email
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── DUPLICATE NOTICE ── */}
      {extraction?.status === "duplicate" && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="pt-4">
            <p className="text-sm font-medium text-amber-800">This email was already ingested.</p>
            <p className="text-xs text-amber-700 mt-1">
              First seen: {extraction.existingDate?.slice(0, 10) ?? "unknown"} — ID: {extraction.existingId}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── EXTRACTION FAILED ── */}
      {extraction?.status === "extraction_failed" && step === "preview" && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-4 space-y-2">
            <p className="text-sm font-medium text-destructive">AI extraction failed</p>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Show error</summary>
              <pre className="mt-2 whitespace-pre-wrap break-all">{extraction.error}</pre>
            </details>
            <p className="text-xs text-muted-foreground">
              The email was saved. You can{" "}
              <a href="/ingest/form" className="underline">use the manual form</a> to add rows.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── PREVIEW PANEL ── */}
      {step === "preview" && extraction?.status === "ok" && (
        <>
          {extraction.extractionNotes && (
            <Card className="bg-muted/40">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground"><span className="font-medium">AI notes:</span> {extraction.extractionNotes}</p>
              </CardContent>
            </Card>
          )}

          {/* Partner section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sender / Partner</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {extraction.existingPartner ? (
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={partnerMode === "existing"}
                    onCheckedChange={(v) => setPartnerMode(v ? "existing" : "none")}
                    id="partner-existing"
                  />
                  <Label htmlFor="partner-existing" className="cursor-pointer">
                    Link to existing partner: <span className="font-medium">{extraction.existingPartner.fullName}</span>
                  </Label>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={partnerMode === "new"}
                      onCheckedChange={(v) => setPartnerMode(v ? "new" : "none")}
                      id="partner-new"
                    />
                    <Label htmlFor="partner-new" className="cursor-pointer">
                      Create new partner record for sender
                    </Label>
                  </div>
                  {partnerMode === "new" && (
                    <div className="grid grid-cols-3 gap-2 pl-7">
                      <div>
                        <Label className="text-xs">Full name *</Label>
                        <Input className="text-xs h-7" value={newPartnerName} onChange={(e) => setNewPartnerName(e.target.value)} placeholder="Alex Rivera" />
                      </div>
                      <div>
                        <Label className="text-xs">Email</Label>
                        <Input className="text-xs h-7" value={newPartnerEmail} onChange={(e) => setNewPartnerEmail(e.target.value)} placeholder="alex@…" />
                      </div>
                      <div>
                        <Label className="text-xs">Role</Label>
                        <Input className="text-xs h-7" value={newPartnerRole} onChange={(e) => setNewPartnerRole(e.target.value)} placeholder="PM, EM…" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Feedback */}
          {feedbackItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  Feedback
                  <Badge variant="secondary">{feedbackChecked.filter(Boolean).length}/{feedbackItems.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {feedbackItems.map((item, i) => (
                  <FeedbackRow
                    key={i}
                    item={item}
                    index={i}
                    checked={feedbackChecked[i]}
                    onChange={(updated) => {
                      if (updated === item) {
                        setFeedbackChecked((prev) => prev.map((v, j) => j === i ? !v : v));
                      } else {
                        setFeedbackItems((prev) => prev.map((v, j) => j === i ? updated : v));
                      }
                    }}
                    designers={designers}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Impact entries */}
          {impactItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  Impact Entries
                  <Badge variant="secondary">{impactChecked.filter(Boolean).length}/{impactItems.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {impactItems.map((item, i) => (
                  <ImpactRow
                    key={i}
                    item={item}
                    index={i}
                    checked={impactChecked[i]}
                    onChange={(updated) => {
                      if (updated === item) {
                        setImpactChecked((prev) => prev.map((v, j) => j === i ? !v : v));
                      } else {
                        setImpactItems((prev) => prev.map((v, j) => j === i ? updated : v));
                      }
                    }}
                    designers={designers}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Highlights */}
          {highlightItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  Highlights
                  <Badge variant="secondary">{highlightChecked.filter(Boolean).length}/{highlightItems.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {highlightItems.map((item, i) => (
                  <HighlightRow
                    key={i}
                    item={item}
                    index={i}
                    checked={highlightChecked[i]}
                    onChange={(updated) => {
                      if (updated === item) {
                        setHighlightChecked((prev) => prev.map((v, j) => j === i ? !v : v));
                      } else {
                        setHighlightItems((prev) => prev.map((v, j) => j === i ? updated : v));
                      }
                    }}
                    designers={designers}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Risk signals */}
          {riskItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  Risk Signals
                  <Badge variant="secondary" className="bg-red-100 text-red-800">{riskChecked.filter(Boolean).length}/{riskItems.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {riskItems.map((item, i) => (
                  <RiskRow
                    key={i}
                    item={item}
                    index={i}
                    checked={riskChecked[i]}
                    onChange={(updated) => {
                      if (updated === item) {
                        setRiskChecked((prev) => prev.map((v, j) => j === i ? !v : v));
                      } else {
                        setRiskItems((prev) => prev.map((v, j) => j === i ? updated : v));
                      }
                    }}
                    designers={designers}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {totalProposals === 0 && (
            <Card className="bg-muted/40">
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">No proposals extracted. The email may not contain structured feedback, or AI found nothing actionable.</p>
              </CardContent>
            </Card>
          )}

          <Separator />

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {totalChecked} of {totalProposals} rows selected
            </p>
            <Button onClick={handleCommit} disabled={isSaving}>
              {isSaving ? "Saving…" : `Save ${totalChecked} approved row${totalChecked !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </>
      )}

      {/* ── DONE ── */}
      {step === "done" && (
        <Card className="border-green-300 bg-green-50">
          <CardContent className="pt-4">
            <p className="text-sm font-medium text-green-800">Saved. Redirecting to designer page…</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
