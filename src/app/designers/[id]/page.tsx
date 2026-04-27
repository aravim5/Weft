"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from "recharts";
import { toast } from "sonner";
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
  wins: Array<{ id: string; kind: string; size: string | null; description: string; occurredOn: string; evidenceLink: string | null }>;
  highlights: Array<{ id: string; kind: string; size: string | null; description: string; occurredOn: string; evidenceLink: string | null }>;
  currentCycleReview: { id: string; cycleId: string; rubricRating?: string | null; finalStatus: string; cycle: { year: number; quarter: string; checkinDate: string }; rubric: { dimensions: string } } | null;
  openBlockers: Array<{ id: string; description: string; raisedOn: string; owner: string; projectId: string | null; project: { id: string; projectName: string } | null }>;
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

const SENTIMENT_COLOR: Record<string, string> = {
  positive: "bg-green-50 text-green-700",
  needs_improvement: "bg-amber-50 text-amber-700",
  neutral: "bg-zinc-100 text-zinc-600",
  constructive: "bg-amber-50 text-amber-700",
  concerning: "bg-red-50 text-red-700",
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

/**
 * Detect a 2+ checkpoint downward trend in the most recent happiness values.
 * Returns true if the last 3 (or more) consecutive non-null values are strictly decreasing.
 */
function detectDownwardTrend(series: Array<{ happiness: number | null }>): boolean {
  const values = series.map((s) => s.happiness).filter((v): v is number => v != null);
  if (values.length < 3) return false;
  const recent = values.slice(-3);
  return recent[0] > recent[1] && recent[1] > recent[2];
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, action, addEntity, addLabel, designerId, onSaved, children }: {
  title: string;
  action?: React.ReactNode;
  addEntity?: EntityType;
  addLabel?: string;
  designerId?: string;
  onSaved?: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  async function handleAdd(data: Record<string, unknown>) {
    if (!addEntity) return;
    const payload = designerId ? { ...data, designerId } : data;
    const res = await fetch(`/api/entities/${addEntity}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error ?? "Save failed"); throw new Error(); }
    toast.success("Saved");
    setOpen(false);
    onSaved?.();
  }

  return (
    <section className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
      <header className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
        <div className="flex items-center gap-2">
          {action}
          {addEntity && (
            <button
              onClick={() => setOpen(true)}
              className="text-xs px-2.5 py-1 rounded-lg text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              + {addLabel ?? "Add"}
            </button>
          )}
        </div>
      </header>
      <div className="px-5 py-4">{children}</div>

      {/* Slide-over modal for Add */}
      {addEntity && open && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          style={{ background: "rgba(0,0,0,0.25)", backdropFilter: "blur(8px)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-[480px] bg-white h-full overflow-y-auto p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-900">Add {addLabel ?? addEntity}</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 text-lg leading-none"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <EntityFormByType entityType={addEntity} onSubmit={handleAdd} onCancel={() => setOpen(false)} />
          </div>
        </div>
      )}
    </section>
  );
}

function Pill({ children, tone = "zinc" }: { children: React.ReactNode; tone?: "zinc" | "blue" | "green" | "amber" | "red" | "purple" }) {
  const cls = {
    zinc: "bg-zinc-100 text-zinc-600",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    purple: "bg-purple-50 text-purple-700",
  }[tone];
  return <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${cls}`}>{children}</span>;
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

  if (loading) return <div className="max-w-5xl mx-auto px-4 py-8"><p className="text-sm text-zinc-400">Loading…</p></div>;
  if (!data) return null;

  const { designer, activeAssignments, lastBiweeklyCheckin, nextMeetingOn,
    impactEntries, happinessSeries, feedback, wins, highlights, currentCycleReview,
    openBlockers, openActionItems, openConcerns, openRiskSignals,
    personalitySignals, communityActivities, oneOnOneHistory, sourceInbox } = data;

  const happinessFiltered = happinessSeries.filter((h) => h.happiness !== null);
  const trendingDown = detectDownwardTrend(happinessSeries);

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
  const smallWins = wins.filter((w) => w.kind === "small_win" || w.size === "small");
  const bigWins = wins.filter((w) => w.kind === "big_win" || w.size === "big");

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
      <Link href="/designers" className="text-sm text-zinc-500 hover:text-zinc-700 inline-flex items-center gap-1">
        ← All designers
      </Link>

      {/* Header card */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-zinc-900">{designer.fullName}</h1>
              <Pill tone={designer.currentStatus === "active" ? "green" : "amber"}>{designer.currentStatus}</Pill>
            </div>
            <p className="text-sm text-zinc-500 mt-1">
              {designer.level} · {designer.discipline} · <span className="capitalize">{designer.productArea.replace(/_/g, " ")}</span> · {tenureLabel(designer.startDate)}
              {designer.managerName ? ` · mgr: ${designer.managerName}` : ""}
            </p>

            {activeAssignments.length > 0 && (
              <p className="text-sm text-zinc-700 mt-2">
                <span className="text-zinc-400">Currently: </span>
                {activeAssignments.map((a, i) => (
                  <span key={a.id}>{a.project.projectName} <span className="text-zinc-400">({a.role})</span>{i < activeAssignments.length - 1 ? " · " : ""}</span>
                ))}
              </p>
            )}

            <div className="flex gap-4 text-xs text-zinc-500 mt-3">
              <span>Last biweekly: <span className="text-zinc-700">{lastBiweeklyCheckin ? `${fmtDate(lastBiweeklyCheckin.biweekStart)} (${lastBiweeklyCheckin.status})` : "—"}</span></span>
              <span>Next 1:1: <span className="text-zinc-700">{fmtDate(nextMeetingOn)}</span></span>
            </div>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <button
              onClick={refreshProfile}
              disabled={profileState === "loading"}
              className="px-3 py-1.5 text-sm font-medium border border-zinc-200 rounded-xl hover:bg-zinc-50 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {profileState === "loading" ? "Generating…" : "✦ AI summary"}
            </button>
            <Link
              href={`/one-on-ones/prep/${id}`}
              className="px-3 py-1.5 text-sm font-medium border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-colors text-center"
            >
              Prep brief →
            </Link>
          </div>
        </div>

        {/* AI Profile Summary panel */}
        {profileOpen && (
          <div className="mt-4 rounded-xl p-4 space-y-2" style={{ background: "rgba(0,122,255,0.06)", border: "1px solid rgba(0,122,255,0.15)" }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#007AFF" }}>AI profile summary</p>
              <button onClick={() => setProfileOpen(false)} className="text-xs text-zinc-400 hover:text-zinc-700">✕</button>
            </div>
            {profileState === "loading" && <p className="text-sm text-zinc-500">Generating…</p>}
            {profileState === "done" && profile && (
              <>
                <p className="text-sm font-semibold text-zinc-900">{profile.headline}</p>
                {profile.summary.split("\n\n").map((para, i) => (
                  <p key={i} className="text-sm text-zinc-700 leading-relaxed">{para}</p>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Impact timeline */}
      <Section
        title={`Impact timeline · ${impactEntries.length}`}
        addEntity="impact-entry"
        addLabel="Log impact"
        designerId={id}
        onSaved={load}
      >
        {impactEntries.length === 0 ? (
          <p className="text-sm text-zinc-400">No impact entries yet.</p>
        ) : (
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <XAxis dataKey="x" type="number" scale="time" domain={["auto", "auto"]} tickFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short" })} tick={{ fontSize: 11, fill: "#71717a" }} />
                <YAxis dataKey="y" hide />
                <Tooltip content={({ payload }) => {
                  const d = payload?.[0]?.payload;
                  if (!d) return null;
                  return (
                    <div className="bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs shadow-md">
                      <p className="font-semibold capitalize">{d.dimension.replace(/_/g, " ")}</p>
                      <p className="text-zinc-700">{d.label}</p>
                      <p className="text-zinc-400">{d.magnitude}</p>
                    </div>
                  );
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

      {/* Two-col: Happiness + Big wins */}
      <div className="grid grid-cols-2 gap-4">
        <Section
          title="Happiness trend"
          action={trendingDown ? <Pill tone="red">↘ trending down</Pill> : null}
        >
          {happinessFiltered.length === 0 ? (
            <p className="text-sm text-zinc-400">No data yet.</p>
          ) : (
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={happinessFiltered} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short" })} tick={{ fontSize: 10, fill: "#71717a" }} />
                  <YAxis domain={[1, 10]} ticks={[1, 5, 10]} tick={{ fontSize: 10, fill: "#71717a" }} width={20} />
                  <Tooltip formatter={(v) => [v, "happiness"]} labelFormatter={(l) => fmtDate(l as string)} />
                  <Line dataKey="happiness" stroke={trendingDown ? "#ff3b30" : "#007AFF"} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Section>

        <Section
          title={`Big wins · ${bigWins.length}`}
          addEntity="highlight"
          addLabel="Big win"
          designerId={id}
          onSaved={load}
        >
          {bigWins.length === 0 ? (
            <p className="text-sm text-zinc-400">None recorded.</p>
          ) : (
            <ul className="space-y-1.5">
              {bigWins.slice(0, 5).map((w) => (
                <li key={w.id} className="text-sm text-zinc-700">
                  <span className="text-xs text-zinc-400 mr-1">{fmtDate(w.occurredOn)}</span>
                  {w.description}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* Small wins (full width) */}
      <Section
        title={`Small wins · ${smallWins.length}`}
        addEntity="highlight"
        addLabel="Small win"
        designerId={id}
        onSaved={load}
      >
        {smallWins.length === 0 ? (
          <p className="text-sm text-zinc-400">None recorded.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {smallWins.slice(0, 8).map((w) => (
              <li key={w.id} className="text-sm text-zinc-700">
                <span className="text-xs text-zinc-400 mr-1">{fmtDate(w.occurredOn)}</span>
                {w.description}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Feedback */}
      <Section
        title={`Feedback · last 60d · ${feedback.total}`}
        addEntity="feedback"
        addLabel="Feedback"
        designerId={id}
        onSaved={load}
      >
        {feedback.total === 0 ? (
          <p className="text-sm text-zinc-400">No feedback in the last 60 days.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              {Object.entries(feedback.sentimentCounts).map(([s, n]) => (
                <Pill key={s} tone={s === "positive" ? "green" : s === "needs_improvement" || s === "constructive" ? "amber" : s === "concerning" ? "red" : "zinc"}>
                  {s.replace(/_/g, " ")} · {n}
                </Pill>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(feedback.themeCounts).sort((a, b) => b[1] - a[1]).map(([t, n]) => (
                <Pill key={t} tone="zinc">{t.replace(/_/g, " ")} · {n}</Pill>
              ))}
            </div>
            <ul className="space-y-2 pt-2" style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
              {feedback.recent.map((f) => (
                <li key={f.id} className="text-sm pt-2">
                  {f.quote ? (
                    <blockquote className="border-l-2 border-zinc-200 pl-3 text-zinc-600 italic">
                      &ldquo;{f.quote}&rdquo;
                      <span className="text-xs text-zinc-400 not-italic ml-2">— {f.partnerName ?? f.feedbackSource}, {fmtDate(f.occurredOn)}</span>
                    </blockquote>
                  ) : (
                    <p className="text-zinc-600">
                      {f.summary}
                      <span className="text-xs text-zinc-400 ml-2">— {f.partnerName ?? f.feedbackSource}, {fmtDate(f.occurredOn)}</span>
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      {/* Rubric snapshot */}
      {currentCycleReview && (
        <Section
          title={`Rubric snapshot · ${currentCycleReview.cycle.quarter.toUpperCase()} ${currentCycleReview.cycle.year}`}
          action={<Pill tone={currentCycleReview.finalStatus === "signed_off" ? "green" : "amber"}>{currentCycleReview.finalStatus.replace(/_/g, " ")}</Pill>}
        >
          {rubricRatings.length === 0 ? (
            <p className="text-sm text-zinc-400">No ratings yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {rubricRatings.map((r) => (
                <li key={r.dimension} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-zinc-700">{r.dimension.replace(/_/g, " ")}</span>
                  <Pill tone="blue">{r.rating}</Pill>
                </li>
              ))}
            </ul>
          )}
          <Link href={`/cycles/${currentCycleReview.cycleId}`} className="text-xs text-blue-600 hover:underline mt-3 inline-block">Open cycle review →</Link>
        </Section>
      )}

      {/* Two-col: Blockers + Actions */}
      <div className="grid grid-cols-2 gap-4">
        <Section
          title={`Open blockers · ${openBlockers.length}`}
          addEntity="blocker"
          addLabel="Blocker"
          designerId={id}
          onSaved={load}
        >
          {openBlockers.length === 0 ? <p className="text-sm text-zinc-400">None ✓</p> : (
            <ul className="space-y-2">
              {openBlockers.map((b) => (
                <li key={b.id} className="text-sm">
                  <p className="text-zinc-700">{b.description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {b.project && (
                      <Pill tone="zinc">{b.project.projectName}</Pill>
                    )}
                    <span className="text-xs text-zinc-400">owner: {b.owner} · {fmtDate(b.raisedOn)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title={`My open actions · ${openActionItems.length}`}
          addEntity="action-item"
          addLabel="Action"
          designerId={id}
          onSaved={load}
        >
          {openActionItems.length === 0 ? <p className="text-sm text-zinc-400">All clear ✓</p> : (
            <ul className="space-y-2">
              {openActionItems.map((a) => {
                const overdue = a.dueDate && new Date(a.dueDate) < new Date();
                return (
                  <li key={a.id} className="text-sm flex items-start justify-between gap-2">
                    <span className="text-zinc-700">{a.description}</span>
                    {a.dueDate && (
                      <span className={`text-xs shrink-0 ${overdue ? "text-red-600 font-semibold" : "text-zinc-400"}`}>
                        {overdue ? "overdue " : "due "}{fmtDate(a.dueDate)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>

      {/* Team concerns */}
      <Section
        title={`Team concerns raised · ${openConcerns.length}`}
        addEntity="team-concern"
        addLabel="Concern"
        designerId={id}
        onSaved={load}
      >
        {openConcerns.length === 0 ? <p className="text-sm text-zinc-400">None.</p> : (
          <ul className="space-y-2">
            {openConcerns.map((c) => (
              <li key={c.id} className="text-sm">
                <div className="flex items-center gap-2 mb-0.5">
                  <Pill tone={c.severity === "high" ? "red" : c.severity === "med" ? "amber" : "zinc"}>{c.severity}</Pill>
                  <Pill tone="zinc">{c.theme}</Pill>
                  <Pill tone={c.status === "acting" ? "blue" : "zinc"}>{c.status}</Pill>
                </div>
                <p className="text-zinc-700">{c.concern}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Risk signals */}
      <Section
        title={`Risk signals · ${openRiskSignals.length}`}
        addEntity="risk-signal"
        addLabel="Risk"
        designerId={id}
        onSaved={load}
      >
        {openRiskSignals.length === 0 ? <p className="text-sm text-zinc-400">None open ✓</p> : (
          <ul className="space-y-3">
            {openRiskSignals.map((r) => {
              const decayed = new Date(r.autoDecayOn).getTime() < now;
              return (
                <li key={r.id} className="text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Pill tone={r.severity === "high" ? "red" : r.severity === "med" ? "amber" : "zinc"}>{r.severity}</Pill>
                    <span className="text-xs text-zinc-500 capitalize">{r.signalType.replace(/_/g, " ")}</span>
                    <span className="text-xs text-zinc-400">detected {fmtDate(r.detectedOn)}</span>
                    {decayed && <Pill tone="zinc">decayed — still relevant?</Pill>}
                  </div>
                  <p className="text-zinc-600 mt-1">{r.evidence}</p>
                  {r.mitigationPlan && (
                    <p className="text-xs text-zinc-500 mt-1"><span className="font-medium">Plan:</span> {r.mitigationPlan}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* Standout highlights (non-win) */}
      <Section
        title={`Standout highlights · ${highlights.length}`}
        addEntity="highlight"
        addLabel="Highlight"
        designerId={id}
        onSaved={load}
      >
        {highlights.length === 0 ? <p className="text-sm text-zinc-400">None recorded.</p> : (
          <div className="grid grid-cols-2 gap-3">
            {highlights.slice(0, 6).map((h) => (
              <div key={h.id} className="rounded-xl p-3" style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.05)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <Pill tone="purple">{h.kind.replace(/_/g, " ")}</Pill>
                  <span className="text-xs text-zinc-400">{fmtDate(h.occurredOn)}</span>
                </div>
                <p className="text-sm text-zinc-700">{h.description}</p>
                {h.evidenceLink && (
                  <a href={h.evidenceLink} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                    evidence ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Personality sketch */}
      <Section
        title="Personality sketch"
        addEntity="personality-signal"
        addLabel="Signal"
        designerId={id}
        onSaved={load}
      >
        {personalitySignals.length === 0 ? <p className="text-sm text-zinc-400">No signals recorded yet.</p> : (
          <ul className="space-y-2">
            {personalitySignals.map((p) => (
              <li key={p.id} className="text-sm">
                <span className="font-semibold text-zinc-900">{p.trait}</span>
                <span className="text-zinc-600"> — {p.evidence}</span>
                <span className="text-xs text-zinc-400 ml-1">[{p.confidence} · {fmtDate(p.lastUpdated)}]</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Community */}
      <Section
        title={`Community · last 90d · ${communityActivities.length}`}
        addEntity="community-activity"
        addLabel="Activity"
        designerId={id}
        onSaved={load}
      >
        {communityActivities.length === 0 ? <p className="text-sm text-zinc-400">None recorded.</p> : (
          <ul className="space-y-1.5">
            {communityActivities.map((a) => (
              <li key={a.id} className="text-sm text-zinc-700">
                <span className="text-xs text-zinc-400 mr-2">{fmtDate(a.date)}</span>
                <span className="text-xs text-zinc-500 mr-2">· {a.role ?? a.activity} ·</span>
                {a.title}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* 1:1 history */}
      <Section
        title="1:1 history"
        action={
          <Link href={`/one-on-ones/new?designer=${id}`} className="text-xs px-2.5 py-1 rounded-lg text-zinc-600 hover:bg-zinc-50 transition-colors">
            + New 1:1
          </Link>
        }
      >
        {oneOnOneHistory.length === 0 ? <p className="text-sm text-zinc-400">No 1:1s logged.</p> : (
          <ul className="space-y-2">
            {oneOnOneHistory.map((o) => (
              <li key={o.id}>
                <Link href={`/one-on-ones/${o.id}`} className="block hover:bg-zinc-50 -mx-2 px-2 py-1 rounded-lg transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-zinc-700 truncate">
                      <span className="text-zinc-500">{fmtDate(o.date)}</span>
                      {o.durationMinutes ? <span className="text-zinc-400"> · {o.durationMinutes}m</span> : ""}
                      {o.happinessIndex != null ? <span className="text-zinc-400"> · ☺ {o.happinessIndex}</span> : ""}
                      <span className="text-zinc-700"> · {o.topicsDiscussed.slice(0, 80)}{o.topicsDiscussed.length > 80 ? "…" : ""}</span>
                    </span>
                    <span className="text-xs text-zinc-300 shrink-0">›</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Source inbox (collapsible) */}
      <section className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
        <button
          onClick={() => setInboxExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-zinc-50 transition-colors"
          style={{ borderBottom: inboxExpanded ? "1px solid rgba(0,0,0,0.05)" : undefined }}
        >
          <span className="text-sm font-semibold text-zinc-900">Source inbox · {sourceInbox.length}</span>
          <span className="text-xs text-zinc-400">{inboxExpanded ? "▼" : "▶"}</span>
        </button>
        {inboxExpanded && (
          <div className="px-5 py-4">
            {sourceInbox.length === 0 ? <p className="text-sm text-zinc-400">No emails ingested for this designer yet.</p> : (
              <ul className="space-y-2">
                {sourceInbox.map((e) => (
                  <li key={e.id} className="text-sm flex items-center justify-between gap-2">
                    <span className="truncate text-zinc-700">{e.subject ?? e.senderName ?? "(untitled)"}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-zinc-400">{fmtDate(e.receivedOn ?? e.createdAt)}</span>
                      <Pill tone={e.status === "processed" ? "green" : "zinc"}>{e.status}</Pill>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
