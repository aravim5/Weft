"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

// ── types ──────────────────────────────────────────────────────────────────
interface Designer { id: string; fullName: string; level: string; productArea: string }
interface Partner  { id: string; fullName: string; role: string; orgOrTeam: string | null; email: string }
interface OutreachRow {
  id: string; designerId: string; partnerId: string; status: string;
  subject: string | null; body: string | null; sentOn: string | null;
  responseReceivedOn: string | null;
  designer: Designer; partner: Partner;
}
interface CycleReview {
  id: string; designerId: string; finalStatus: string;
  summaryMarkdown: string | null; signedOffOn: string | null;
  designer: Designer;
}
interface CycleData {
  id: string; year: number; quarter: string; checkinDate: string; status: string;
  outreach: OutreachRow[];
  cycleReviews: CycleReview[];
}
interface PageData {
  cycle: CycleData;
  designers: Designer[];
  partners: Partner[];
}

const STAGES = ["Plan", "Draft emails", "Send", "Collect", "Summarize"] as const;
type Stage = typeof STAGES[number];

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function statusBadge(s: string) {
  if (s === "sent") return "bg-blue-50 text-blue-700";
  if (s === "responded") return "bg-green-50 text-green-700";
  if (s === "approved") return "bg-purple-50 text-purple-700";
  if (s === "no_response") return "bg-red-50 text-red-700";
  return "bg-muted text-muted-foreground";
}

// ── Stage 1: Plan ──────────────────────────────────────────────────────────
function Stage1Plan({ data, reload }: { data: PageData; reload: () => void }) {
  const { cycle, designers, partners } = data;
  const existingPairs = new Set(cycle.outreach.map((o) => `${o.designerId}:${o.partnerId}`));
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  function toggle(dId: string, pId: string) {
    const key = `${dId}:${pId}`;
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function save() {
    const pairs = Object.entries(checked)
      .filter(([, v]) => v)
      .map(([k]) => { const [designerId, partnerId] = k.split(":"); return { designerId, partnerId }; });
    if (pairs.length === 0) { toast.error("Select at least one pair"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/cycles/${cycle.id}/outreach/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairs }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Failed"); return; }
      toast.success(`Created ${json.created} outreach rows.`);
      reload();
    } catch (err) { toast.error(String(err)); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select which (designer × partner) pairs to reach out to. Check the pairs you want — uncheck anyone who shouldn't get an ask.
      </p>
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Designer</th>
              {partners.map((p) => (
                <th key={p.id} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">{p.fullName}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {designers.map((d) => (
              <tr key={d.id} className="hover:bg-muted/10">
                <td className="px-3 py-2 font-medium text-sm">{d.fullName}</td>
                {partners.map((p) => {
                  const key = `${d.id}:${p.id}`;
                  const already = existingPairs.has(key);
                  return (
                    <td key={p.id} className="px-2 py-2 text-center">
                      {already
                        ? <span className="text-xs text-green-600">✓</span>
                        : <input type="checkbox" checked={!!checked[key]} onChange={() => toggle(d.id, p.id)} className="cursor-pointer" />
                      }
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save outreach plan"}</Button>
    </div>
  );
}

// ── Stage 2: Draft emails ──────────────────────────────────────────────────
function Stage2Draft({ data, reload }: { data: PageData; reload: () => void }) {
  const { cycle } = data;
  const [drafting, setDrafting] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, { subject: string; body: string }>>({});

  async function generateDraft(outreachId: string) {
    setDrafting(outreachId);
    try {
      const res = await fetch(`/api/cycles/${cycle.id}/outreach/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outreachId }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Failed"); return; }
      setEditing((prev) => ({ ...prev, [outreachId]: { subject: json.subject, body: json.body } }));
      toast.success("Draft generated.");
      reload();
    } catch (err) { toast.error(String(err)); }
    finally { setDrafting(null); }
  }

  async function approve(row: OutreachRow) {
    const edit = editing[row.id];
    const subject = edit?.subject ?? row.subject ?? "";
    const body = edit?.body ?? row.body ?? "";
    const res = await fetch(`/api/entities/outreach/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved", subject, body }),
    });
    if (!res.ok) { toast.error("Update failed"); return; }
    toast.success("Approved.");
    reload();
  }

  const rows = cycle.outreach;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No outreach rows yet. Complete Stage 1 first.</p>;

  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const edit = editing[row.id];
        const subject = edit?.subject ?? row.subject ?? "";
        const body = edit?.body ?? row.body ?? "";
        return (
          <Card key={row.id}>
            <CardHeader className="py-3 flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle className="text-sm">{row.designer.fullName} → {row.partner.fullName}</CardTitle>
                <p className="text-xs text-muted-foreground">{row.partner.orgOrTeam ?? row.partner.role}</p>
              </div>
              <div className="flex gap-2 items-center">
                <Badge variant="outline" className={`text-xs ${statusBadge(row.status)}`}>{row.status}</Badge>
                <Button size="sm" variant="outline" className="h-7 text-xs px-2"
                  onClick={() => generateDraft(row.id)} disabled={drafting === row.id}>
                  {drafting === row.id ? "Generating…" : "Generate"}
                </Button>
                {subject && (
                  <Button size="sm" className="h-7 text-xs px-2" onClick={() => approve(row)}>Approve</Button>
                )}
              </div>
            </CardHeader>
            {(subject || body) && (
              <CardContent className="pt-0 space-y-2">
                <input
                  className="w-full border rounded px-2 py-1 text-xs font-mono"
                  value={subject}
                  onChange={(e) => setEditing((prev) => ({ ...prev, [row.id]: { ...prev[row.id], subject: e.target.value, body: prev[row.id]?.body ?? body } }))}
                  placeholder="Subject"
                />
                <textarea
                  className="w-full border rounded px-2 py-1 text-xs font-mono min-h-[120px] resize-y"
                  value={body}
                  onChange={(e) => setEditing((prev) => ({ ...prev, [row.id]: { ...prev[row.id], body: e.target.value, subject: prev[row.id]?.subject ?? subject } }))}
                  placeholder="Email body"
                />
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ── Stage 3: Send ──────────────────────────────────────────────────────────
function Stage3Send({ data, reload }: { data: PageData; reload: () => void }) {
  const { cycle } = data;
  const approved = cycle.outreach.filter((r) => r.status === "approved" || r.status === "draft");
  const [sending, setSending] = useState(false);

  function mailtoLink(row: OutreachRow) {
    const subject = encodeURIComponent(row.subject ?? "");
    const body = encodeURIComponent(row.body ?? "");
    return `mailto:${row.partner.email}?subject=${subject}&body=${body}`;
  }

  async function markSent(ids: string[]) {
    setSending(true);
    try {
      const res = await fetch(`/api/cycles/${cycle.id}/outreach/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outreachIds: ids }),
      });
      if (!res.ok) { toast.error("Failed to mark sent"); return; }
      toast.success(`Marked ${ids.length} as sent.`);
      reload();
    } catch (err) { toast.error(String(err)); }
    finally { setSending(false); }
  }

  if (approved.length === 0) return <p className="text-sm text-muted-foreground">No approved emails yet. Approve drafts in Stage 2.</p>;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => markSent(approved.map((r) => r.id))} disabled={sending}>
          {sending ? "Marking…" : `Mark all ${approved.length} as sent`}
        </Button>
      </div>
      <div className="rounded-lg border divide-y">
        {approved.map((row) => (
          <div key={row.id} className="px-3 py-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{row.designer.fullName} → {row.partner.fullName}</p>
              <p className="text-xs text-muted-foreground">{row.partner.email}</p>
            </div>
            <div className="flex gap-2">
              <a href={mailtoLink(row)} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => markSent([row.id])}>
                  Open in mail client
                </Button>
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Stage 4: Collect ──────────────────────────────────────────────────────
function Stage4Collect({ data }: { data: PageData }) {
  const { cycle } = data;
  const sent = cycle.outreach.filter((r) => r.status === "sent" || r.status === "responded" || r.status === "no_response");
  const responded = sent.filter((r) => r.status === "responded");

  return (
    <div className="space-y-4">
      <div className="flex gap-6 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Sent</p>
          <p className="text-2xl font-bold">{sent.length}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Responded</p>
          <p className="text-2xl font-bold text-green-600">{responded.length}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Response rate</p>
          <p className="text-2xl font-bold">{sent.length > 0 ? Math.round((responded.length / sent.length) * 100) : 0}%</p>
        </div>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="bg-green-500 h-2 rounded-full transition-all"
          style={{ width: sent.length > 0 ? `${(responded.length / sent.length) * 100}%` : "0%" }}
        />
      </div>
      <div className="rounded-lg border divide-y">
        {sent.map((row) => (
          <div key={row.id} className="px-3 py-2 flex items-center justify-between">
            <div>
              <p className="text-sm">{row.designer.fullName} ← {row.partner.fullName}</p>
              <p className="text-xs text-muted-foreground">Sent {fmtDate(row.sentOn)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-xs ${statusBadge(row.status)}`}>{row.status}</Badge>
              {row.status === "sent" && (
                <Link href={`/ingest/email?designerId=${row.designerId}&partnerId=${row.partnerId}`}>
                  <Button size="sm" variant="outline" className="h-7 text-xs px-2">Paste reply</Button>
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
      {sent.length === 0 && <p className="text-sm text-muted-foreground">No emails sent yet. Complete Stage 3.</p>}
    </div>
  );
}

// ── Stage 5: Summarize & sign off ─────────────────────────────────────────
function Stage5Summarize({ data, reload }: { data: PageData; reload: () => void }) {
  const { cycle, designers } = data;
  const [generating, setGenerating] = useState<string | null>(null);
  const [signingOff, setSigningOff] = useState<string | null>(null);

  const reviewMap = new Map(cycle.cycleReviews.map((r) => [r.designerId, r]));

  async function generate(designerId: string) {
    setGenerating(designerId);
    try {
      const res = await fetch(`/api/cycles/${cycle.id}/review/${designerId}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Generation failed"); return; }
      toast.success("Review generated.");
      reload();
    } catch (err) { toast.error(String(err)); }
    finally { setGenerating(null); }
  }

  async function signOff(designerId: string) {
    setSigningOff(designerId);
    try {
      const res = await fetch(`/api/cycles/${cycle.id}/review/${designerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalStatus: "signed_off" }),
      });
      if (!res.ok) { toast.error("Sign-off failed"); return; }
      toast.success("Signed off ✓");
      reload();
    } catch (err) { toast.error(String(err)); }
    finally { setSigningOff(null); }
  }

  const signedOff = cycle.cycleReviews.filter((r) => r.finalStatus === "signed_off").length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {signedOff} of {designers.length} reviews signed off.
      </p>
      <div className="space-y-3">
        {designers.map((d) => {
          const review = reviewMap.get(d.id);
          const isSignedOff = review?.finalStatus === "signed_off";
          const hasDraft = !!review?.summaryMarkdown;
          return (
            <Card key={d.id} className={isSignedOff ? "opacity-70" : ""}>
              <CardHeader className="py-3 flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm">{d.fullName}</CardTitle>
                  <p className="text-xs text-muted-foreground">{d.level} · {d.productArea}</p>
                </div>
                <div className="flex gap-2 items-center">
                  {isSignedOff
                    ? <Badge variant="outline" className="text-xs bg-green-50 text-green-700">signed off {fmtDate(review?.signedOffOn)}</Badge>
                    : <>
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2"
                          onClick={() => generate(d.id)} disabled={generating === d.id}>
                          {generating === d.id ? "Generating…" : hasDraft ? "Regenerate" : "Generate review"}
                        </Button>
                        {hasDraft && (
                          <Button size="sm" className="h-7 text-xs px-2"
                            onClick={() => signOff(d.id)} disabled={signingOff === d.id}>
                            {signingOff === d.id ? "Saving…" : "Sign off"}
                          </Button>
                        )}
                      </>
                  }
                </div>
              </CardHeader>
              {hasDraft && !isSignedOff && (
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">{review?.summaryMarkdown}</p>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function CycleWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<Stage>("Plan");

  const load = useCallback(() => {
    fetch(`/api/cycles/${id}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => toast.error("Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!data) return <div className="p-8 text-sm text-muted-foreground">Not found.</div>;

  const { cycle } = data;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/cycles" className="text-xs text-muted-foreground hover:underline">← Cycles</Link>
          <Separator orientation="vertical" className="h-4" />
          <h1 className="text-xl font-semibold">{cycle.quarter} {cycle.year} Review</h1>
          <Badge variant="outline" className="text-xs">{cycle.status.replace(/_/g, " ")}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">Check-in: {fmtDate(cycle.checkinDate)}</p>
      </div>

      {/* Stage tabs */}
      <div className="flex gap-1 border-b">
        {STAGES.map((s, i) => (
          <button
            key={s}
            onClick={() => setStage(s)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              stage === s
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="text-xs mr-1.5 opacity-60">{i + 1}.</span>{s}
          </button>
        ))}
      </div>

      {/* Stage content */}
      <div>
        {stage === "Plan"         && <Stage1Plan      data={data} reload={load} />}
        {stage === "Draft emails" && <Stage2Draft     data={data} reload={load} />}
        {stage === "Send"         && <Stage3Send      data={data} reload={load} />}
        {stage === "Collect"      && <Stage4Collect   data={data} />}
        {stage === "Summarize"    && <Stage5Summarize data={data} reload={load} />}
      </div>
    </div>
  );
}
