"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

// ── types ──────────────────────────────────────────────────────────────────
type Rating = "needs_improvement" | "developing" | "strong" | "outstanding";

interface RubricLevel { rating: Rating; descriptor: string }
interface RubricDim { id: string; name: string; description: string; levels: RubricLevel[] }

interface CycleReview {
  id: string;
  designerId: string;
  cycleId: string;
  rubricVersion: string;
  summaryMarkdown: string | null;
  strengthsMarkdown: string | null;
  improvementsMarkdown: string | null;
  rubricRating: string | null; // JSON
  riskWatch: string | null;
  continuityNote: string | null;
  finalStatus: "draft" | "signed_off";
  signedOffOn: string | null;
}

interface Designer {
  id: string; fullName: string; preferredName: string | null;
  level: string; discipline: string; productArea: string;
  startDate: string; managerName: string | null;
}

interface Cycle {
  id: string; quarter: string; year: number; checkinDate: string; status: string;
}

interface Evidence {
  impactEntries: { id: string; summary: string; dimension: string; magnitude: string; date: string; projectId: string | null }[];
  feedback: { id: string; summary: string; quote: string | null; sentiment: string; theme: string; occurredOn: string; source: string; partnerName: string | null; partnerRole: string | null }[];
  oneOnOnes: { id: string; date: string; topicsDiscussed: string | null; happinessIndex: number | null }[];
  highlights: { id: string; kind: string; size: string | null; description: string; occurredOn: string }[];
  openRiskSignals: { id: string; signalType: string; severity: string; evidence: string | null }[];
  teamConcerns: { id: string; concern: string; theme: string; severity: string }[];
  outreach: { id: string; status: string; partner: { fullName: string; role: string } | null; sentOn: string | null; responseReceivedOn: string | null }[];
}

interface PageData {
  data: CycleReview;
  designer: Designer;
  cycle: Cycle;
  rubric: { version: string; dimensions: string } | null;
  evidence: Evidence;
}

type RubricRatingMap = Record<string, { rating: Rating | ""; justification: string; confidence?: number }>;

// ── helpers ────────────────────────────────────────────────────────────────
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtShort(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const RATING_LABEL: Record<Rating, string> = {
  needs_improvement: "Needs improvement",
  developing: "Developing",
  strong: "Strong",
  outstanding: "Outstanding",
};
const RATING_COLOR: Record<Rating, string> = {
  needs_improvement: "bg-red-50 text-red-700",
  developing: "bg-amber-50 text-amber-700",
  strong: "bg-blue-50 text-blue-700",
  outstanding: "bg-green-50 text-green-700",
};

const SENT_COLOR: Record<string, string> = {
  positive: "bg-green-50 text-green-700",
  constructive: "bg-amber-50 text-amber-700",
  negative: "bg-red-50 text-red-700",
  neutral: "bg-zinc-100 text-zinc-700",
};

// ── small UI bits ──────────────────────────────────────────────────────────
function Pill({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}>
      {children}
    </span>
  );
}

function Field({
  label, value, onChange, rows = 4, hint, disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</label>
        {hint && <span className="text-[11px] text-zinc-400">{hint}</span>}
      </div>
      <textarea
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full rounded-xl border border-zinc-200 bg-white/60 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-60"
        placeholder="—"
      />
    </div>
  );
}

// ── Evidence panel ─────────────────────────────────────────────────────────
function EvidencePanel({ ev }: { ev: Evidence }) {
  const sections: { title: string; count: number; node: React.ReactNode }[] = [
    {
      title: "Impact this cycle",
      count: ev.impactEntries.length,
      node: (
        <ul className="divide-y divide-zinc-200/70">
          {ev.impactEntries.map((i) => (
            <li key={i.id} className="py-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-500">{fmtShort(i.date)}</span>
                <span className="text-[10px] text-zinc-400">{i.dimension} · {i.magnitude}</span>
              </div>
              <p className="text-zinc-800 mt-0.5 line-clamp-3">{i.summary}</p>
            </li>
          ))}
        </ul>
      ),
    },
    {
      title: "Feedback collected",
      count: ev.feedback.length,
      node: (
        <ul className="divide-y divide-zinc-200/70">
          {ev.feedback.map((f) => (
            <li key={f.id} className="py-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-700 font-medium">{f.partnerName ?? "—"} <span className="text-zinc-400 font-normal">· {f.theme}</span></span>
                <Pill className={SENT_COLOR[f.sentiment] ?? SENT_COLOR.neutral}>{f.sentiment}</Pill>
              </div>
              <p className="text-zinc-700 mt-0.5 line-clamp-3">{f.summary}</p>
              {f.quote && <p className="text-zinc-500 italic mt-1 line-clamp-2">&ldquo;{f.quote}&rdquo;</p>}
              <p className="text-[10px] text-zinc-400 mt-1">{fmtShort(f.occurredOn)} · {f.source}</p>
            </li>
          ))}
        </ul>
      ),
    },
    {
      title: "1:1s",
      count: ev.oneOnOnes.length,
      node: (
        <ul className="divide-y divide-zinc-200/70">
          {ev.oneOnOnes.map((o) => (
            <li key={o.id} className="py-2 text-xs flex items-start justify-between gap-2">
              <div className="flex-1">
                <span className="text-zinc-500">{fmtShort(o.date)}</span>
                <p className="text-zinc-700 line-clamp-2">{o.topicsDiscussed ?? "—"}</p>
              </div>
              {o.happinessIndex != null && (
                <Pill className="bg-zinc-100 text-zinc-700">😊 {o.happinessIndex}</Pill>
              )}
            </li>
          ))}
        </ul>
      ),
    },
    {
      title: "Highlights & wins",
      count: ev.highlights.length,
      node: (
        <ul className="divide-y divide-zinc-200/70">
          {ev.highlights.map((h) => (
            <li key={h.id} className="py-2 text-xs">
              <div className="flex items-center gap-2">
                <Pill className="bg-blue-50 text-blue-700">{h.kind.replace(/_/g, " ")}</Pill>
                <span className="text-zinc-400 text-[10px]">{fmtShort(h.occurredOn)}</span>
              </div>
              <p className="text-zinc-700 mt-1 line-clamp-2">{h.description}</p>
            </li>
          ))}
        </ul>
      ),
    },
    {
      title: "Open risk signals",
      count: ev.openRiskSignals.length,
      node: (
        <ul className="divide-y divide-zinc-200/70">
          {ev.openRiskSignals.map((r) => (
            <li key={r.id} className="py-2 text-xs">
              <div className="flex items-center gap-2">
                <Pill className="bg-red-50 text-red-700">{r.signalType.replace(/_/g, " ")}</Pill>
                <Pill className="bg-zinc-100 text-zinc-700">severity {r.severity}</Pill>
              </div>
              <p className="text-zinc-700 mt-1 line-clamp-3">{r.evidence}</p>
            </li>
          ))}
        </ul>
      ),
    },
    {
      title: "Concerns raised",
      count: ev.teamConcerns.length,
      node: (
        <ul className="divide-y divide-zinc-200/70">
          {ev.teamConcerns.map((c) => (
            <li key={c.id} className="py-2 text-xs">
              <div className="flex items-center gap-2">
                <Pill className="bg-amber-50 text-amber-700">{c.theme}</Pill>
                <span className="text-zinc-400">severity {c.severity}</span>
              </div>
              <p className="text-zinc-700 mt-1 line-clamp-2">{c.concern}</p>
            </li>
          ))}
        </ul>
      ),
    },
    {
      title: "Outreach for this cycle",
      count: ev.outreach.length,
      node: (
        <ul className="divide-y divide-zinc-200/70">
          {ev.outreach.map((o) => (
            <li key={o.id} className="py-2 text-xs flex items-center justify-between gap-2">
              <div>
                <p className="text-zinc-800">{o.partner?.fullName ?? "—"}</p>
                <p className="text-zinc-400 text-[10px]">{o.partner?.role ?? ""}</p>
              </div>
              <Pill className={
                o.status === "responded" ? "bg-green-50 text-green-700"
                  : o.status === "sent" ? "bg-blue-50 text-blue-700"
                  : o.status === "no_response" ? "bg-red-50 text-red-700"
                  : "bg-zinc-100 text-zinc-700"
              }>{o.status.replace(/_/g, " ")}</Pill>
            </li>
          ))}
        </ul>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      {sections.map((s) => (
        <details key={s.title} className="bg-white border border-zinc-200 rounded-2xl overflow-hidden group" open={s.count > 0 && s.count <= 4}>
          <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-zinc-700">{s.title}</span>
            <span className="text-xs text-zinc-500">{s.count}</span>
          </summary>
          {s.count > 0 ? (
            <div className="px-4 pb-3 border-t border-zinc-200">{s.node}</div>
          ) : (
            <div className="px-4 pb-3 border-t border-zinc-200 text-xs text-zinc-400">None.</div>
          )}
        </details>
      ))}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function CycleReviewEditorPage() {
  const { id, designerId } = useParams<{ id: string; designerId: string }>();
  const [page, setPage] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [signing, setSigning] = useState(false);
  const [dirty, setDirty] = useState(false);

  // editable state
  const [summary, setSummary] = useState("");
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [riskWatch, setRiskWatch] = useState("");
  const [continuity, setContinuity] = useState("");
  const [ratings, setRatings] = useState<RubricRatingMap>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cycles/${id}/review/${designerId}`);
      const json = (await res.json()) as PageData;
      if (!res.ok) throw new Error("Load failed");
      setPage(json);

      const r = json.data;
      setSummary(r.summaryMarkdown ?? "");
      setStrengths(r.strengthsMarkdown ?? "");
      setImprovements(r.improvementsMarkdown ?? "");
      setRiskWatch(r.riskWatch ?? "");
      setContinuity(r.continuityNote ?? "");
      try {
        setRatings(r.rubricRating ? JSON.parse(r.rubricRating) : {});
      } catch {
        setRatings({});
      }
      setDirty(false);
    } catch {
      toast.error("Failed to load review");
    } finally {
      setLoading(false);
    }
  }, [id, designerId]);

  useEffect(() => { load(); }, [load]);

  const dimensions = useMemo<RubricDim[]>(() => {
    if (!page?.rubric?.dimensions) return [];
    try {
      return JSON.parse(page.rubric.dimensions);
    } catch {
      return [];
    }
  }, [page?.rubric?.dimensions]);

  const isSignedOff = page?.data.finalStatus === "signed_off";
  const hasDraft = !!(summary || strengths || improvements);

  function setRatingFor(dimId: string, patch: Partial<{ rating: Rating | ""; justification: string }>) {
    setRatings((prev) => ({
      ...prev,
      [dimId]: { rating: prev[dimId]?.rating ?? "", justification: prev[dimId]?.justification ?? "", ...patch },
    }));
    setDirty(true);
  }

  function bind<T extends string>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setDirty(true); };
  }

  async function generate() {
    if (isSignedOff) return;
    if (dirty && !confirm("You have unsaved edits. Regenerate will overwrite them. Continue?")) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/cycles/${id}/review/${designerId}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Generate failed");
      toast.success("Review generated.");
      await load();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setGenerating(false);
    }
  }

  async function saveDraft() {
    if (isSignedOff) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/cycles/${id}/review/${designerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summaryMarkdown: summary,
          strengthsMarkdown: strengths,
          improvementsMarkdown: improvements,
          riskWatch: riskWatch || null,
          continuityNote: continuity || null,
          rubricRating: JSON.stringify(ratings),
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Save failed");
      }
      toast.success("Draft saved.");
      setDirty(false);
      await load();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSaving(false);
    }
  }

  async function signOff() {
    if (isSignedOff) return;
    if (!confirm("Sign off this review? After sign-off, every edit is audit-logged.")) return;
    setSigning(true);
    try {
      // Save current edits first if dirty
      if (dirty) {
        await fetch(`/api/cycles/${id}/review/${designerId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            summaryMarkdown: summary,
            strengthsMarkdown: strengths,
            improvementsMarkdown: improvements,
            riskWatch: riskWatch || null,
            continuityNote: continuity || null,
            rubricRating: JSON.stringify(ratings),
          }),
        });
      }
      const res = await fetch(`/api/cycles/${id}/review/${designerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalStatus: "signed_off" }),
      });
      if (!res.ok) throw new Error("Sign-off failed");
      toast.success("Signed off ✓");
      setDirty(false);
      await load();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSigning(false);
    }
  }

  if (loading) return <div className="p-8 text-sm text-zinc-500">Loading…</div>;
  if (!page) return <div className="p-8 text-sm text-zinc-500">Not found.</div>;

  const { designer, cycle, evidence } = page;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 pb-32 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/cycles" className="hover:text-zinc-900">Cycles</Link>
        <span>/</span>
        <Link href={`/cycles/${cycle.id}`} className="hover:text-zinc-900">{cycle.quarter} {cycle.year}</Link>
        <span>/</span>
        <span className="text-zinc-700">{designer.fullName}</span>
      </div>

      {/* Header */}
      <div className="bg-white border border-zinc-200 rounded-2xl px-6 py-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{designer.fullName}</h1>
          <p className="text-sm text-zinc-600 mt-0.5">
            {designer.level} · {designer.discipline} · {designer.productArea}
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            Started {fmtDate(designer.startDate)}{designer.managerName ? ` · Manager ${designer.managerName}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Pill className={isSignedOff ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}>
            {isSignedOff ? `Signed off ${fmtShort(page.data.signedOffOn)}` : "Draft"}
          </Pill>
          <p className="text-xs text-zinc-500">{cycle.quarter} {cycle.year} · check-in {fmtShort(cycle.checkinDate)}</p>
          <p className="text-[11px] text-zinc-400">Rubric v{page.data.rubricVersion}</p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI generate banner */}
          {!hasDraft && !isSignedOff && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-900 font-medium">No draft yet.</p>
                <p className="text-xs text-blue-800/80">Generate an AI starting point grounded in this cycle&rsquo;s evidence.</p>
              </div>
              <button
                onClick={generate}
                disabled={generating}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-sm font-medium disabled:opacity-50"
              >
                {generating ? "Generating…" : "Generate draft"}
              </button>
            </div>
          )}

          {/* Narrative section */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-5">
            <h2 className="text-base font-semibold text-zinc-900">Narrative</h2>
            <Field label="Summary" value={summary} onChange={bind(setSummary)} rows={6} hint="High-level story of the cycle" disabled={isSignedOff} />
            <Field label="Strengths" value={strengths} onChange={bind(setStrengths)} rows={5} hint="What worked. Cite evidence." disabled={isSignedOff} />
            <Field label="Areas to grow" value={improvements} onChange={bind(setImprovements)} rows={5} hint="What to work on next cycle" disabled={isSignedOff} />
          </div>

          {/* Rubric ratings */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-900">Rubric ratings</h2>
              <span className="text-xs text-zinc-500">{dimensions.length} dimensions</span>
            </div>
            {dimensions.length === 0 && (
              <p className="text-sm text-zinc-500">No rubric dimensions defined.</p>
            )}
            <div className="space-y-5">
              {dimensions.map((d) => {
                const cur = ratings[d.id] ?? { rating: "" as Rating | "", justification: "" };
                const ratingObj = cur.rating as Rating | "";
                const descriptor = ratingObj ? d.levels.find((l) => l.rating === ratingObj)?.descriptor : null;
                return (
                  <div key={d.id} className="space-y-2 pb-5 last:pb-0 border-b last:border-b-0 border-zinc-200/70">
                    <div className="flex items-baseline justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-900">{d.name}</h3>
                        <p className="text-xs text-zinc-500 mt-0.5">{d.description}</p>
                      </div>
                      {ratingObj && (
                        <Pill className={RATING_COLOR[ratingObj as Rating]}>{RATING_LABEL[ratingObj as Rating]}</Pill>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {(["needs_improvement", "developing", "strong", "outstanding"] as Rating[]).map((r) => {
                        const active = cur.rating === r;
                        return (
                          <button
                            key={r}
                            type="button"
                            disabled={isSignedOff}
                            onClick={() => setRatingFor(d.id, { rating: r })}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${
                              active
                                ? `${RATING_COLOR[r]} border-transparent ring-2 ring-blue-500/30`
                                : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                            } disabled:opacity-60`}
                          >
                            {RATING_LABEL[r]}
                          </button>
                        );
                      })}
                      {cur.rating && !isSignedOff && (
                        <button
                          type="button"
                          onClick={() => setRatingFor(d.id, { rating: "" })}
                          className="px-2 py-1 rounded-full text-[11px] text-zinc-400 hover:text-zinc-600"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {descriptor && (
                      <p className="text-xs text-zinc-500 italic mt-1">{descriptor}</p>
                    )}
                    <textarea
                      value={cur.justification}
                      disabled={isSignedOff}
                      onChange={(e) => setRatingFor(d.id, { justification: e.target.value })}
                      rows={2}
                      placeholder="Justification — cite evidence from the right panel"
                      className="w-full rounded-xl border border-zinc-200 bg-white/60 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-60"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Watch + continuity */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-5">
            <h2 className="text-base font-semibold text-zinc-900">Watch & continuity</h2>
            <Field label="Risk watch" value={riskWatch} onChange={bind(setRiskWatch)} rows={3} hint="Engagement / retention things to watch (private)" disabled={isSignedOff} />
            <Field label="Continuity note" value={continuity} onChange={bind(setContinuity)} rows={3} hint="What the next manager would need to know" disabled={isSignedOff} />
          </div>
        </div>

        {/* Evidence */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-6 space-y-3">
            <div className="px-1 flex items-center justify-between">
              <h2 className="text-[11px] uppercase tracking-wider text-zinc-700 font-semibold">Evidence for this cycle</h2>
              <span className="text-[11px] text-zinc-400">
                {cycle.quarter} {cycle.year}
              </span>
            </div>
            <EvidencePanel ev={evidence} />
          </div>
        </div>
      </div>

      {/* Sticky action bar */}
      <div
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 px-4 py-2.5 rounded-2xl border border-zinc-200 flex items-center gap-3"
        style={{
          background: "rgba(255,255,255,0.78)",
          backdropFilter: "blur(40px) saturate(200%)",
          WebkitBackdropFilter: "blur(40px) saturate(200%)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        <span className="text-xs text-zinc-500">
          {isSignedOff ? "Signed off — read-only" : dirty ? "Unsaved edits" : "All changes saved"}
        </span>
        {!isSignedOff && (
          <>
            <button
              onClick={generate}
              disabled={generating || saving || signing}
              className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-sm text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
            >
              {generating ? "Generating…" : hasDraft ? "Regenerate" : "Generate"}
            </button>
            <button
              onClick={saveDraft}
              disabled={saving || generating || signing || !dirty}
              className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-sm text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save draft"}
            </button>
            <button
              onClick={signOff}
              disabled={signing || generating || saving || !hasDraft}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {signing ? "Signing…" : "Sign off"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
