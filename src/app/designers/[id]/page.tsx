"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { EntityFormByType } from "@/components/forms/EntityForm";
import type { EntityType } from "@/lib/schemas/entities";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DashboardData {
  designer: {
    id: string; fullName: string; preferredName?: string; email: string;
    level: string; discipline: string; productArea: string;
    startDate: string; managerName?: string; currentStatus: string; notes?: string;
  };
  activeAssignments: Array<{ id: string; role: string; project: { id: string; projectName: string; status: string } }>;
  lastBiweeklyCheckin: { id: string; biweekStart: string; completedOn?: string; status: string } | null;
  nextMeetingOn: string | null;
  impactEntries: Array<{ id: string; date: string; dimension: string; magnitude: string; summary: string }>;
  happinessSeries: Array<{ id: string; date: string; happiness: number | null }>;
  feedback: {
    sentimentCounts: Record<string, number>;
    themeCounts: Record<string, number>;
    recent: Array<{ id: string; summary: string; quote?: string | null; sentiment: string; theme: string; occurredOn: string; partnerName?: string | null; feedbackSource: string }>;
    total: number;
  };
  highlights: Array<{ id: string; kind: string; description: string; occurredOn: string }>;
  currentCycleReview: { id: string; cycleId: string; rubricRating?: string | null; finalStatus: string; cycle: { year: number; quarter: string; checkinDate: string }; rubric: { dimensions: string } } | null;
  openBlockers: Array<{ id: string; description: string; raisedOn: string; owner: string }>;
  openActionItems: Array<{ id: string; description: string; dueDate?: string | null; status: string; snoozedUntil?: string | null }>;
  openConcerns: Array<{ id: string; concern: string; theme: string; severity: string; status: string; createdAt: string }>;
  openRiskSignals: Array<{ id: string; signalType: string; severity: string; evidence: string; detectedOn: string; autoDecayOn: string; mitigationPlan?: string | null }>;
  personalitySignals: Array<{ id: string; trait: string; evidence: string; confidence: string; lastUpdated: string }>;
  communityActivities: Array<{ id: string; title: string; date: string; activity: string; role?: string | null }>;
  oneOnOneHistory: Array<{ id: string; date: string; durationMinutes?: number | null; happinessIndex?: number | null; topicsDiscussed: string; nextMeetingOn?: string | null }>;
  sourceInbox: Array<{ id: string; subject?: string | null; senderName?: string | null; receivedOn?: string | null; status: string; source: string; createdAt: string }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MAGNITUDE_SIZE: Record<string, number> = { small: 40, meaningful: 80, significant: 140, exceptional: 200 };
const DIMENSION_COLOR: Record<string, string> = {
  craft_quality: "#6366f1", business_outcome: "#10b981", team_multiplier: "#f59e0b",
  client_trust: "#3b82f6", innovation: "#8b5cf6", delivery_reliability: "#14b8a6", mentorship: "#f97316",
};

function tenureLabel(startDate: string): string {
  const months = Math.floor((Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24 * 30));
  if (months < 12) return `${months}m`;
  return `${(months / 12).toFixed(1)}y`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function sentimentColor(s: string) {
  if (s === "positive") return "bg-green-100 text-green-800";
  if (s === "needs_improvement") return "bg-amber-100 text-amber-800";
  return "bg-gray-100 text-gray-700";
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, addEntity, addLabel, children }: {
  title: string; addEntity?: EntityType; addLabel?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  async function handleAdd(data: Record<string, unknown>) {
    if (!addEntity) return;
    const res = await fetch(`/api/entities/${addEntity}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error ?? "Save failed"); throw new Error(); }
    toast.success("Saved — refresh to see changes.");
    setOpen(false);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {addEntity && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOpen(true)}>+ {addLabel ?? "Add"}</Button>
        )}
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
      {addEntity && (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="right" className="w-[480px] overflow-y-auto">
            <SheetHeader><SheetTitle>Add {addLabel ?? addEntity}</SheetTitle></SheetHeader>
            <div className="mt-4">
              <EntityFormByType entityType={addEntity} onSubmit={handleAdd} onCancel={() => setOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </Card>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function DesignerDashboard() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inboxExpanded, setInboxExpanded] = useState(false);
  const [profileState, setProfileState] = useState<"idle" | "loading" | "done">("idle");
  const [profile, setProfile] = useState<{ headline: string; summary: string } | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  async function refreshProfile() {
    setProfileState("loading");
    setProfileOpen(true);
    try {
      const res = await fetch(`/api/reports/designer/${id}`, { method: "POST" });
      const json = await res.json();
      setProfile(json.data);
      setProfileState("done");
    } catch {
      toast.error("Failed to generate profile");
      setProfileState("idle");
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/designers/${id}/dashboard`);
      if (!res.ok) { router.push("/designers"); return; }
      setData(await res.json());
    } catch { toast.error("Failed to load dashboard"); }
    finally { setLoading(false); }
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!data) return null;

  const { designer, activeAssignments, lastBiweeklyCheckin, nextMeetingOn,
    impactEntries, happinessSeries, feedback, highlights, currentCycleReview,
    openBlockers, openActionItems, openConcerns, openRiskSignals,
    personalitySignals, communityActivities, oneOnOneHistory, sourceInbox } = data;

  const impactChartData = impactEntries.map((e, i) => ({
    x: new Date(e.date).getTime(),
    y: i % 7,
    size: MAGNITUDE_SIZE[e.magnitude] ?? 60,
    color: DIMENSION_COLOR[e.dimension] ?? "#888",
    label: e.summary,
    dimension: e.dimension,
    magnitude: e.magnitude,
  }));

  let rubricRatings: Array<{ dimension: string; rating: string }> = [];
  if (currentCycleReview?.rubricRating) {
    try {
      const raw = JSON.parse(currentCycleReview.rubricRating) as Record<string, { rating: string }>;
      rubricRatings = Object.entries(raw).map(([dimension, v]) => ({ dimension, rating: v.rating }));
    } catch { /* no-op */ }
  }

  const now = Date.now();

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <Link href="/designers" className="text-xs text-muted-foreground hover:underline">← All designers</Link>

      {/* Header */}
      <div className="rounded-xl border bg-card px-6 py-5 space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{designer.fullName}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {designer.level} · {designer.discipline} · {designer.productArea.replace(/_/g, " ")} · {tenureLabel(designer.startDate)}
              {" "}· <span className={designer.currentStatus === "active" ? "text-green-600" : "text-amber-600"}>{designer.currentStatus}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshProfile}
              disabled={profileState === "loading"}
            >
              {profileState === "loading" ? "Generating…" : "✦ AI summary"}
            </Button>
            <Link href={`/one-on-ones/prep/${id}`}>
              <Button variant="outline" size="sm">Prep brief →</Button>
            </Link>
          </div>
        </div>
        {/* AI Profile Summary panel */}
        {profileOpen && (
          <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">AI profile summary</p>
              <button onClick={() => setProfileOpen(false)} className="text-xs text-blue-400 hover:text-blue-600">✕</button>
            </div>
            {profileState === "loading" && (
              <p className="text-sm text-blue-500">Generating summary…</p>
            )}
            {profileState === "done" && profile && (
              <>
                <p className="text-sm font-semibold text-blue-900">{profile.headline}</p>
                {profile.summary.split("\n\n").map((para, i) => (
                  <p key={i} className="text-sm text-blue-800 leading-relaxed">{para}</p>
                ))}
              </>
            )}
          </div>
        )}

        {activeAssignments.length > 0 && (
          <p className="text-sm">
            <span className="text-muted-foreground">Currently: </span>
            {activeAssignments.map((a, i) => (
              <span key={a.id}>{a.project.projectName} ({a.role}){i < activeAssignments.length - 1 ? " · " : ""}</span>
            ))}
          </p>
        )}
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>Last biweekly: {lastBiweeklyCheckin ? `${fmtDate(lastBiweeklyCheckin.biweekStart)} (${lastBiweeklyCheckin.status})` : "—"}</span>
          <span>Next 1:1: {fmtDate(nextMeetingOn)}</span>
        </div>
      </div>

      {/* Impact timeline */}
      <Section title={`Impact timeline (${impactEntries.length})`} addEntity="impact-entry" addLabel="Log impact">
        {impactEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No impact entries yet.</p>
        ) : (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <XAxis dataKey="x" type="number" scale="time" domain={["auto", "auto"]} tickFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short" })} tick={{ fontSize: 11 }} />
                <YAxis dataKey="y" hide />
                <Tooltip content={({ payload }) => {
                  const d = payload?.[0]?.payload;
                  if (!d) return null;
                  return <div className="bg-background border rounded px-2 py-1 text-xs shadow"><p className="font-medium">{d.dimension.replace(/_/g, " ")}</p><p>{d.label}</p><p className="text-muted-foreground">{d.magnitude}</p></div>;
                }} />
                <Scatter data={impactChartData} fill="#6366f1" shape={(props: { cx?: number; cy?: number; payload?: { size: number; color: string } }) => {
                  const { cx = 0, cy = 0, payload } = props;
                  const r = Math.sqrt((payload?.size ?? 60) / Math.PI) * 2;
                  return <circle cx={cx} cy={cy} r={r} fill={payload?.color ?? "#6366f1"} fillOpacity={0.7} />;
                }} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>

      {/* Two-col: Happiness + Wins */}
      <div className="grid grid-cols-2 gap-4">
        <Section title="Happiness trend">
          {happinessSeries.filter((h) => h.happiness !== null).length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={happinessSeries.filter((h) => h.happiness !== null)} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short" })} tick={{ fontSize: 10 }} />
                  <YAxis domain={[1, 10]} ticks={[1, 5, 10]} tick={{ fontSize: 10 }} width={20} />
                  <Tooltip formatter={(v) => [v, "happiness"]} labelFormatter={(l) => fmtDate(l as string)} />
                  <Line dataKey="happiness" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Section>

        <Section title={`Wins (last 60d) — ${highlights.length}`} addEntity="highlight" addLabel="Win">
          {highlights.length === 0 ? <p className="text-sm text-muted-foreground">None recorded.</p> : (
            <ul className="space-y-1.5">
              {highlights.slice(0, 4).map((h) => (
                <li key={h.id} className="text-sm">
                  <span className="text-muted-foreground text-xs mr-1">{h.kind.replace(/_/g, " ")}</span>
                  {h.description}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* Feedback */}
      <Section title={`Feedback (last 60d — ${feedback.total})`} addEntity="feedback" addLabel="Feedback">
        {feedback.total === 0 ? (
          <p className="text-sm text-muted-foreground">No feedback in the last 60 days.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-3 flex-wrap">
              {Object.entries(feedback.sentimentCounts).map(([s, n]) => (
                <Badge key={s} variant="outline" className={sentimentColor(s)}>{s.replace("_", " ")} ({n})</Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(feedback.themeCounts).sort((a, b) => b[1] - a[1]).map(([t, n]) => (
                <Badge key={t} variant="secondary" className="text-xs">{t} ({n})</Badge>
              ))}
            </div>
            <Separator />
            <ul className="space-y-2">
              {feedback.recent.map((f) => (
                <li key={f.id} className="text-sm">
                  {f.quote ? (
                    <blockquote className="border-l-2 pl-2 text-muted-foreground italic text-xs">&ldquo;{f.quote}&rdquo;{f.partnerName ? ` — ${f.partnerName}` : ""}, {fmtDate(f.occurredOn)}</blockquote>
                  ) : (
                    <p className="text-muted-foreground text-xs">{f.summary} — {f.partnerName ?? f.feedbackSource}, {fmtDate(f.occurredOn)}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      {/* Rubric snapshot */}
      {currentCycleReview && (
        <Section title={`Rubric snapshot — ${currentCycleReview.cycle.quarter} ${currentCycleReview.cycle.year} (${currentCycleReview.finalStatus})`}>
          {rubricRatings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No ratings yet.</p>
          ) : (
            <ul className="space-y-1">
              {rubricRatings.map((r) => (
                <li key={r.dimension} className="flex items-center justify-between text-sm">
                  <span>{r.dimension.replace(/_/g, " ")}</span>
                  <Badge variant="outline" className="text-xs">{r.rating}</Badge>
                </li>
              ))}
            </ul>
          )}
          <Link href={`/cycles/${currentCycleReview.cycleId}`} className="text-xs text-primary hover:underline mt-2 inline-block">Open cycle review →</Link>
        </Section>
      )}

      {/* Blockers */}
      <Section title={`Open blockers (${openBlockers.length})`} addEntity="blocker" addLabel="Blocker">
        {openBlockers.length === 0 ? <p className="text-sm text-muted-foreground">None. ✓</p> : (
          <ul className="space-y-2">
            {openBlockers.map((b) => (
              <li key={b.id} className="text-sm flex items-start justify-between gap-2">
                <span>{b.description}</span>
                <span className="text-xs text-muted-foreground shrink-0">raised {fmtDate(b.raisedOn)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Action items */}
      <Section title={`My open actions (${openActionItems.length})`} addEntity="action-item" addLabel="Action">
        {openActionItems.length === 0 ? <p className="text-sm text-muted-foreground">All clear. ✓</p> : (
          <ul className="space-y-2">
            {openActionItems.map((a) => (
              <li key={a.id} className="text-sm flex items-start justify-between gap-2">
                <span>{a.description}</span>
                <span className={`text-xs shrink-0 ${a.dueDate && new Date(a.dueDate) < new Date() ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                  {a.dueDate ? `due ${fmtDate(a.dueDate)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Team concerns */}
      <Section title={`Team concerns raised (${openConcerns.length})`} addEntity="team-concern" addLabel="Concern">
        {openConcerns.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : (
          <ul className="space-y-2">
            {openConcerns.map((c) => (
              <li key={c.id} className="text-sm">
                <span className="text-xs text-muted-foreground">{c.theme} · {c.status} · </span>
                {c.concern}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Risk signals */}
      <Section title={`Risk signals (${openRiskSignals.length})`} addEntity="risk-signal" addLabel="Risk">
        {openRiskSignals.length === 0 ? <p className="text-sm text-muted-foreground">None open. ✓</p> : (
          <ul className="space-y-3">
            {openRiskSignals.map((r) => (
              <li key={r.id} className="text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs ${r.severity === "high" ? "bg-red-100 text-red-800" : r.severity === "med" ? "bg-amber-100 text-amber-800" : ""}`}>{r.severity}</Badge>
                  <span className="text-xs text-muted-foreground">{r.signalType.replace(/_/g, " ")}</span>
                  {new Date(r.autoDecayOn).getTime() < now && (
                    <Badge variant="outline" className="text-xs bg-gray-100">decayed — still relevant?</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{r.evidence}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Personality sketch */}
      <Section title="Personality sketch" addEntity="personality-signal" addLabel="Signal">
        {personalitySignals.length === 0 ? <p className="text-sm text-muted-foreground">No signals recorded yet.</p> : (
          <ul className="space-y-1.5">
            {personalitySignals.map((p) => (
              <li key={p.id} className="text-sm">
                <span className="font-medium">{p.trait}</span>
                <span className="text-muted-foreground"> — {p.evidence}</span>
                <span className="text-xs text-muted-foreground ml-1">[{p.confidence} · {fmtDate(p.lastUpdated)}]</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Community */}
      <Section title="Community (last 90d)" addEntity="community-activity" addLabel="Activity">
        {communityActivities.length === 0 ? <p className="text-sm text-muted-foreground">None recorded.</p> : (
          <ul className="space-y-1.5">
            {communityActivities.map((a) => (
              <li key={a.id} className="text-sm">
                <span className="text-muted-foreground text-xs">{fmtDate(a.date)} · {a.role ?? a.activity} · </span>
                {a.title}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* 1:1 history */}
      <Section title="1:1 history">
        {oneOnOneHistory.length === 0 ? <p className="text-sm text-muted-foreground">No 1:1s logged.</p> : (
          <ul className="space-y-2">
            {oneOnOneHistory.map((o) => (
              <li key={o.id}>
                <Link href={`/one-on-ones/${o.id}`} className="text-sm hover:underline flex items-center justify-between">
                  <span>
                    {fmtDate(o.date)}{o.durationMinutes ? ` · ${o.durationMinutes}m` : ""}
                    {o.happinessIndex !== null ? ` · ☺ ${o.happinessIndex}` : ""}
                    {" "}· {o.topicsDiscussed.slice(0, 60)}{o.topicsDiscussed.length > 60 ? "…" : ""}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2">
          <Link href={`/one-on-ones/new?designer=${id}`}>
            <Button variant="outline" size="sm" className="text-xs">+ New 1:1 log</Button>
          </Link>
        </div>
      </Section>

      {/* Source inbox (collapsible) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3 cursor-pointer" onClick={() => setInboxExpanded((v) => !v)}>
          <CardTitle className="text-sm font-medium">Source inbox ({sourceInbox.length})</CardTitle>
          <span className="text-xs text-muted-foreground">{inboxExpanded ? "▼" : "▶"} expand</span>
        </CardHeader>
        {inboxExpanded && (
          <CardContent className="pt-0">
            {sourceInbox.length === 0 ? <p className="text-sm text-muted-foreground">No emails ingested for this designer yet.</p> : (
              <ul className="space-y-2">
                {sourceInbox.map((e) => (
                  <li key={e.id} className="text-sm flex items-center justify-between gap-2">
                    <span className="truncate">{e.subject ?? e.senderName ?? "(untitled)"}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">{fmtDate(e.receivedOn ?? e.createdAt)}</span>
                      <Badge variant="outline" className={`text-xs ${e.status === "processed" ? "bg-green-50 text-green-700" : ""}`}>{e.status}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
