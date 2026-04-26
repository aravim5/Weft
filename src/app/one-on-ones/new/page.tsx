"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";

interface Designer { id: string; fullName: string; }

// ── Live mode ────────────────────────────────────────────────────────────────

function LiveMode({ designers }: { designers: Designer[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [designerId, setDesignerId] = useState(searchParams.get("designer") ?? "");
  const [date, setDate] = useState(searchParams.get("date") ?? new Date().toISOString().slice(0, 10));
  const [duration, setDuration] = useState(searchParams.get("duration") ?? "");
  const [happiness, setHappiness] = useState(7);
  const [happinessSource, setHappinessSource] = useState<"self_reported" | "my_read">("self_reported");
  const [mood, setMood] = useState("");
  const [topics, setTopics] = useState("");
  const [vibeNotes, setVibeNotes] = useState("");
  const [nextMeeting, setNextMeeting] = useState("");
  const [blockers, setBlockers] = useState<string[]>([""]);
  const [actions, setActions] = useState<Array<{ desc: string; due: string }>>([{ desc: "", due: "" }]);
  const [wins, setWins] = useState<Array<{ desc: string; size: "small_win" | "big_win" }>>([]);
  const [concerns, setConcerns] = useState<string[]>([""]);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!designerId) { toast.error("Select a designer"); return; }
    if (!topics.trim()) { toast.error("Topics discussed is required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/one-on-ones/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          designerId,
          meetingDate: date,
          oneOnOne: {
            mood: mood || null,
            happinessIndex: happiness,
            happinessSource,
            topicsDiscussed: topics,
            vibeNotes: vibeNotes || null,
            durationMinutes: duration ? parseInt(duration) : null,
            nextMeetingOn: nextMeeting || null,
          },
          blockers: blockers.filter((b) => b.trim()).map((b) => ({ description: b, owner: "you" })),
          actionItems: actions.filter((a) => a.desc.trim()).map((a) => ({ description: a.desc, dueDate: a.due || null })),
          wins: wins.filter((w) => w.desc.trim()).map((w) => ({ description: w.desc, kind: w.size })),
          teamConcerns: concerns.filter((c) => c.trim()).map((c) => ({
            concern: c,
            theme: "other" as const,
            severity: "low" as const,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Save failed"); return; }
      toast.success(data.summary);
      router.push(`/one-on-ones/${data.oneOnOneId}`);
    } finally { setSaving(false); }
  }

  const MOODS = ["down", "flat", "steady", "up", "energized"];

  return (
    <div className="space-y-5">
      {/* Header fields */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label>Designer *</Label>
          <select className="w-full border rounded-md px-3 py-1.5 text-sm bg-background" value={designerId} onChange={(e) => setDesignerId(e.target.value)}>
            <option value="">— select —</option>
            {designers.map((d) => <option key={d.id} value={d.id}>{d.fullName}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Duration (min)</Label>
          <Input type="number" placeholder="30" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </div>
      </div>

      {/* Mood + Happiness */}
      <div className="space-y-3">
        <div className="space-y-1">
          <Label>Mood</Label>
          <div className="flex gap-2">
            {MOODS.map((m) => (
              <button key={m} type="button" onClick={() => setMood(mood === m ? "" : m)}
                className={`px-3 py-1 rounded-full text-xs border transition-colors ${mood === m ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Happiness: {happiness}/10</Label>
          <Slider min={1} max={10} step={1} value={[happiness]} onValueChange={(v) => setHappiness(Array.isArray(v) ? v[0] : v)} className="w-full max-w-xs" />
          <div className="flex gap-3 text-xs">
            {(["self_reported", "my_read"] as const).map((s) => (
              <label key={s} className="flex items-center gap-1 cursor-pointer">
                <input type="radio" checked={happinessSource === s} onChange={() => setHappinessSource(s)} />
                {s.replace("_", " ")}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Topics */}
      <div className="space-y-1">
        <Label>Topics discussed *</Label>
        <Textarea placeholder="What did you cover? Write naturally — a few sentences or bullet points." className="min-h-[100px] text-sm" value={topics} onChange={(e) => setTopics(e.target.value)} />
      </div>

      {/* Vibe notes */}
      <div className="space-y-1">
        <Label>Vibe notes <span className="text-xs text-muted-foreground">(owner-only)</span></Label>
        <Textarea placeholder="Soft observations — energy, tone, what wasn't said…" className="min-h-[60px] text-sm" value={vibeNotes} onChange={(e) => setVibeNotes(e.target.value)} />
      </div>

      {/* Blockers */}
      <div className="space-y-2">
        <Label>Blockers raised</Label>
        {blockers.map((b, i) => (
          <div key={i} className="flex gap-2">
            <Input placeholder="Describe the blocker…" value={b} onChange={(e) => setBlockers((prev) => prev.map((v, j) => j === i ? e.target.value : v))} />
            {blockers.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => setBlockers((prev) => prev.filter((_, j) => j !== i))}>✕</Button>}
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setBlockers((prev) => [...prev, ""])}>+ Blocker</Button>
      </div>

      {/* Action items */}
      <div className="space-y-2">
        <Label>Action items (yours)</Label>
        {actions.map((a, i) => (
          <div key={i} className="flex gap-2">
            <Input placeholder="What you'll do…" value={a.desc} onChange={(e) => setActions((prev) => prev.map((v, j) => j === i ? { ...v, desc: e.target.value } : v))} />
            <Input type="date" className="w-36 shrink-0" value={a.due} onChange={(e) => setActions((prev) => prev.map((v, j) => j === i ? { ...v, due: e.target.value } : v))} />
            {actions.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => setActions((prev) => prev.filter((_, j) => j !== i))}>✕</Button>}
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setActions((prev) => [...prev, { desc: "", due: "" }])}>+ Action</Button>
      </div>

      {/* Wins */}
      <div className="space-y-2">
        <Label>Wins / highlights</Label>
        {wins.map((w, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Input placeholder="Describe the win…" value={w.desc} onChange={(e) => setWins((prev) => prev.map((v, j) => j === i ? { ...v, desc: e.target.value } : v))} />
            <select className="border rounded px-2 py-1.5 text-sm bg-background shrink-0" value={w.size} onChange={(e) => setWins((prev) => prev.map((v, j) => j === i ? { ...v, size: e.target.value as "small_win" | "big_win" } : v))}>
              <option value="small_win">small</option>
              <option value="big_win">big</option>
            </select>
            <Button type="button" variant="ghost" size="sm" onClick={() => setWins((prev) => prev.filter((_, j) => j !== i))}>✕</Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setWins((prev) => [...prev, { desc: "", size: "small_win" }])}>+ Win</Button>
      </div>

      {/* Team concerns */}
      <div className="space-y-2">
        <Label>Team concerns raised</Label>
        {concerns.map((c, i) => (
          <div key={i} className="flex gap-2">
            <Input placeholder="Concern they raised…" value={c} onChange={(e) => setConcerns((prev) => prev.map((v, j) => j === i ? e.target.value : v))} />
            {concerns.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => setConcerns((prev) => prev.filter((_, j) => j !== i))}>✕</Button>}
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setConcerns((prev) => [...prev, ""])}>+ Concern</Button>
      </div>

      {/* Next meeting */}
      <div className="space-y-1">
        <Label>Next meeting on</Label>
        <Input type="date" className="w-48" value={nextMeeting} onChange={(e) => setNextMeeting(e.target.value)} />
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? "Saving…" : "Save 1:1 log"}</Button>
    </div>
  );
}

// ── Dump mode ────────────────────────────────────────────────────────────────

function DumpMode({ designers }: { designers: Designer[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [designerId, setDesignerId] = useState(searchParams.get("designer") ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rawNotes, setRawNotes] = useState("");
  const [step, setStep] = useState<"input" | "preview" | "done">("input");
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [proposals, setProposals] = useState<{
    oneOnOne: { mood?: string | null; happinessIndex?: number | null; happinessSource?: string | null; topicsDiscussed: string; vibeNotes?: string | null };
    proposedBlockers: Array<{ description: string; owner: string }>;
    proposedActionItems: Array<{ description: string; dueDate?: string | null }>;
    proposedWins: Array<{ description: string; size: string; occurredOn: string }>;
    proposedTeamConcerns: Array<{ concern: string; theme: string; severity: string }>;
    proposedRiskSignal: { signalType: string; severity: string; evidence: string } | null;
    extractionNotes: string;
  } | null>(null);

  // Editable approval state
  const [keepOneOnOne, setKeepOneOnOne] = useState(true);
  const [blockerChecked, setBlockerChecked] = useState<boolean[]>([]);
  const [actionChecked, setActionChecked] = useState<boolean[]>([]);
  const [winChecked, setWinChecked] = useState<boolean[]>([]);
  const [concernChecked, setConcernChecked] = useState<boolean[]>([]);
  const [keepRisk, setKeepRisk] = useState(false);

  async function handleExtract() {
    if (!designerId) { toast.error("Select a designer"); return; }
    if (!rawNotes.trim()) { toast.error("Paste notes first"); return; }
    setExtracting(true);
    try {
      const res = await fetch("/api/one-on-ones/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designerId, rawNotes, meetingDate: date }),
      });
      const data = await res.json();
      if (data.status === "extraction_failed") { toast.error("Extraction failed: " + data.error); return; }
      if (data.aiDisabled) { toast.info("AI disabled — switch to Live mode."); return; }
      const p = data.proposals;
      setProposals(p);
      setBlockerChecked((p.proposedBlockers ?? []).map(() => true));
      setActionChecked((p.proposedActionItems ?? []).map(() => true));
      setWinChecked((p.proposedWins ?? []).map(() => true));
      setConcernChecked((p.proposedTeamConcerns ?? []).map(() => true));
      setKeepRisk(!!p.proposedRiskSignal);
      setStep("preview");
    } catch (err) {
      toast.error(String(err));
    } finally { setExtracting(false); }
  }

  async function handleCommit() {
    if (!proposals) return;
    setSaving(true);
    try {
      const res = await fetch("/api/one-on-ones/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          designerId,
          meetingDate: date,
          oneOnOne: keepOneOnOne ? proposals.oneOnOne : { topicsDiscussed: rawNotes.slice(0, 500) },
          blockers: (proposals.proposedBlockers ?? []).filter((_, i) => blockerChecked[i]),
          actionItems: (proposals.proposedActionItems ?? []).filter((_, i) => actionChecked[i]),
          wins: (proposals.proposedWins ?? []).filter((_, i) => winChecked[i]).map((w) => ({ ...w, kind: w.size })),
          teamConcerns: (proposals.proposedTeamConcerns ?? []).filter((_, i) => concernChecked[i]),
          riskSignal: keepRisk ? proposals.proposedRiskSignal : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Save failed"); return; }
      toast.success(data.summary);
      setStep("done");
      setTimeout(() => router.push(`/one-on-ones/${data.oneOnOneId}`), 1200);
    } finally { setSaving(false); }
  }

  if (step === "done") return <div className="py-8 text-center text-sm text-green-700 font-medium">Saved. Redirecting…</div>;

  if (step === "preview" && proposals) {
    return (
      <div className="space-y-4">
        {proposals.extractionNotes && (
          <Card className="bg-muted/40"><CardContent className="pt-3 text-xs text-muted-foreground"><span className="font-medium">AI notes:</span> {proposals.extractionNotes}</CardContent></Card>
        )}

        {/* 1:1 core */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-2">
            <CardTitle className="text-sm">1:1 summary</CardTitle>
            <Checkbox checked={keepOneOnOne} onCheckedChange={(v) => setKeepOneOnOne(!!v)} />
          </CardHeader>
          <CardContent className="pt-0 space-y-1 text-sm">
            {proposals.oneOnOne.mood && <p><span className="text-muted-foreground">Mood:</span> {proposals.oneOnOne.mood}</p>}
            {proposals.oneOnOne.happinessIndex && <p><span className="text-muted-foreground">Happiness:</span> {proposals.oneOnOne.happinessIndex}/10 ({proposals.oneOnOne.happinessSource})</p>}
            <p className="text-muted-foreground text-xs mt-1">{proposals.oneOnOne.topicsDiscussed}</p>
          </CardContent>
        </Card>

        {/* Blockers */}
        {(proposals.proposedBlockers ?? []).length > 0 && (
          <Card>
            <CardHeader className="py-2"><CardTitle className="text-sm">Blockers ({blockerChecked.filter(Boolean).length}/{proposals.proposedBlockers.length})</CardTitle></CardHeader>
            <CardContent className="pt-0 space-y-2">
              {proposals.proposedBlockers.map((b, i) => (
                <div key={i} className={`flex gap-3 text-sm ${blockerChecked[i] ? "" : "opacity-40"}`}>
                  <Checkbox checked={blockerChecked[i]} onCheckedChange={() => setBlockerChecked((prev) => prev.map((v, j) => j === i ? !v : v))} />
                  <span>{b.description}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Action items */}
        {(proposals.proposedActionItems ?? []).length > 0 && (
          <Card>
            <CardHeader className="py-2"><CardTitle className="text-sm">Action items ({actionChecked.filter(Boolean).length}/{proposals.proposedActionItems.length})</CardTitle></CardHeader>
            <CardContent className="pt-0 space-y-2">
              {proposals.proposedActionItems.map((a, i) => (
                <div key={i} className={`flex gap-3 text-sm ${actionChecked[i] ? "" : "opacity-40"}`}>
                  <Checkbox checked={actionChecked[i]} onCheckedChange={() => setActionChecked((prev) => prev.map((v, j) => j === i ? !v : v))} />
                  <span>{a.description}{a.dueDate ? <span className="text-xs text-muted-foreground ml-1">(due {a.dueDate})</span> : ""}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Wins */}
        {(proposals.proposedWins ?? []).length > 0 && (
          <Card>
            <CardHeader className="py-2"><CardTitle className="text-sm">Wins ({winChecked.filter(Boolean).length}/{proposals.proposedWins.length})</CardTitle></CardHeader>
            <CardContent className="pt-0 space-y-2">
              {proposals.proposedWins.map((w, i) => (
                <div key={i} className={`flex gap-3 text-sm ${winChecked[i] ? "" : "opacity-40"}`}>
                  <Checkbox checked={winChecked[i]} onCheckedChange={() => setWinChecked((prev) => prev.map((v, j) => j === i ? !v : v))} />
                  <span><Badge variant="secondary" className="text-xs mr-1">{w.size}</Badge>{w.description}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Concerns */}
        {(proposals.proposedTeamConcerns ?? []).length > 0 && (
          <Card>
            <CardHeader className="py-2"><CardTitle className="text-sm">Team concerns ({concernChecked.filter(Boolean).length}/{proposals.proposedTeamConcerns.length})</CardTitle></CardHeader>
            <CardContent className="pt-0 space-y-2">
              {proposals.proposedTeamConcerns.map((c, i) => (
                <div key={i} className={`flex gap-3 text-sm ${concernChecked[i] ? "" : "opacity-40"}`}>
                  <Checkbox checked={concernChecked[i]} onCheckedChange={() => setConcernChecked((prev) => prev.map((v, j) => j === i ? !v : v))} />
                  <span><Badge variant="outline" className="text-xs mr-1">{c.theme} / {c.severity}</Badge>{c.concern}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Risk signal */}
        {proposals.proposedRiskSignal && (
          <Card className="border-red-200">
            <CardHeader className="flex flex-row items-center justify-between py-2">
              <CardTitle className="text-sm text-red-700">Risk signal</CardTitle>
              <Checkbox checked={keepRisk} onCheckedChange={(v) => setKeepRisk(!!v)} />
            </CardHeader>
            <CardContent className="pt-0 text-sm">
              <Badge variant="outline" className="text-xs bg-red-50 text-red-800 mr-2">{proposals.proposedRiskSignal.severity}</Badge>
              {proposals.proposedRiskSignal.signalType.replace(/_/g, " ")}
              <p className="text-xs text-muted-foreground mt-1">{proposals.proposedRiskSignal.evidence}</p>
            </CardContent>
          </Card>
        )}

        <Separator />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep("input")}>← Edit notes</Button>
          <Button onClick={handleCommit} disabled={saving} className="flex-1">{saving ? "Saving…" : "Save approved rows"}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Designer *</Label>
          <select className="w-full border rounded-md px-3 py-1.5 text-sm bg-background" value={designerId} onChange={(e) => setDesignerId(e.target.value)}>
            <option value="">— select —</option>
            {designers.map((d) => <option key={d.id} value={d.id}>{d.fullName}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label>Meeting date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Rough notes</Label>
        <Textarea placeholder="Paste your raw 1:1 notes here — bullet points, stream of consciousness, anything…" className="min-h-[200px] font-mono text-sm" value={rawNotes} onChange={(e) => setRawNotes(e.target.value)} />
      </div>
      <Button onClick={handleExtract} disabled={extracting} className="w-full">{extracting ? "Extracting…" : "Extract with AI"}</Button>
    </div>
  );
}

// ── Page wrapper ─────────────────────────────────────────────────────────────

function NewOneOnOneContent() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"live" | "dump">(searchParams.get("mode") === "dump" ? "dump" : "live");
  const [designers, setDesigners] = useState<Designer[]>([]);

  useEffect(() => {
    fetch("/api/entities/designer").then((r) => r.json()).then((d) => setDesigners(d.data ?? [])).catch(() => {});
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Log 1:1</h1>
        <p className="text-sm text-muted-foreground mt-1">Live mode: fill as you go. Dump mode: paste rough notes → AI extracts.</p>
      </div>

      <div className="flex gap-1 border-b">
        {(["live", "dump"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t === "live" ? "Live mode" : "Dump mode"}
          </button>
        ))}
      </div>

      {tab === "live" ? <LiveMode designers={designers} /> : <DumpMode designers={designers} />}
    </div>
  );
}

export default function NewOneOnOnePage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading…</div>}>
      <NewOneOnOneContent />
    </Suspense>
  );
}
