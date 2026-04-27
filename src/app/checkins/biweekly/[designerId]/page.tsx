"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { EntityFormByType } from "@/components/forms/EntityForm";

// ── 13 sections in spec order ────────────────────────────────────────────────

const SECTIONS = [
  { key: "projects",      label: "Projects",            entityType: "assignment",         hint: "New assignments, status changes, shipped work?" },
  { key: "impact",        label: "Impact",              entityType: "impact-entry",       hint: "Anything noteworthy to record?" },
  { key: "feedback",      label: "Feedback received",   entityType: "feedback",           hint: "Any emails to log? Peer kudos?" },
  { key: "one_on_one",    label: "1:1 notes",           entityType: "one-on-one",         hint: "Did you meet? Anything to log?" },
  { key: "blockers",      label: "Blockers",            entityType: "blocker",            hint: "Still open? Any new ones?" },
  { key: "action_items",  label: "My action items",     entityType: "action-item",        hint: "Any completed? Any new ones?" },
  { key: "wins",          label: "Wins",                entityType: "highlight",          hint: "Small or big wins this biweek?" },
  { key: "happiness",     label: "Happiness read",      entityType: "one-on-one",         hint: "Your gut read (separate from their self-report)" },
  { key: "team_concerns", label: "Team concerns",       entityType: "team-concern",       hint: "Did they raise anything about team/env?" },
  { key: "risk_signals",  label: "Risk signals",        entityType: "risk-signal",        hint: "Any new signals? Any existing to update?" },
  { key: "highlights",    label: "Highlights",          entityType: "highlight",          hint: "Anything standout?" },
  { key: "community",     label: "Community",           entityType: "community-activity", hint: "Any design-team or community activity?" },
  { key: "personality",   label: "Personality signals", entityType: "personality-signal", hint: "Anything new to note or refine?" },
] as const;

type EntityType = typeof SECTIONS[number]["entityType"];

interface Flag {
  section: string;
  severity: "info" | "nudge" | "urgent";
  message: string;
  suggested_action: string | null;
}

interface SectionData {
  assignments: Array<{ id: string; role: string; project: { projectName: string; status: string } | null; startDate: string }>;
  impactEntries: Array<{ id: string; summary: string; dimension: string; magnitude: string; date: string }>;
  feedback: Array<{ id: string; summary: string; sentiment: string; theme: string; occurredOn: string; partner: { fullName: string } | null }>;
  oneOnOnes: Array<{ id: string; date: string; happinessIndex: number | null; mood: string | null; topicsDiscussed: string }>;
  blockers: Array<{ id: string; description: string; status: string; raisedOn: string }>;
  actionItems: Array<{ id: string; description: string; dueDate: string | null; status: string }>;
  highlights: Array<{ id: string; kind: string; description: string; occurredOn: string }>;
  teamConcerns: Array<{ id: string; concern: string; theme: string; severity: string; status: string; createdAt: string }>;
  riskSignals: Array<{ id: string; signalType: string; severity: string; evidence: string; detectedOn: string }>;
  communityActivities: Array<{ id: string; activity: string; title: string; date: string }>;
  personalitySignals: Array<{ id: string; trait: string; evidence: string; updatedAt: string }>;
}

interface PrepData {
  designer: { id: string; fullName: string; level: string; productArea: string };
  biweekStart: string;
  biweekEnd: string;
  checkinId: string | null;
  checkinStatus: string;
  sectionsTouched: Record<string, boolean>;
  flags: Flag[];
  aiDisabled?: boolean;
  sectionData: SectionData;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function flagStyle(s: Flag["severity"]) {
  if (s === "urgent") return { background: "rgba(255,59,48,0.06)", border: "1px solid rgba(255,59,48,0.20)", color: "#c0392b" };
  if (s === "nudge")  return { background: "rgba(255,149,0,0.07)", border: "1px solid rgba(255,149,0,0.22)", color: "#a05a00" };
  return                       { background: "rgba(0,122,255,0.06)", border: "1px solid rgba(0,122,255,0.20)", color: "#005bb5" };
}

function flagPillTone(s: Flag["severity"]): "red" | "amber" | "blue" {
  if (s === "urgent") return "red";
  if (s === "nudge")  return "amber";
  return "blue";
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

// ── Inline section content (current state) ───────────────────────────────────

function SectionInlineData({ sectionKey, data, designerId }: {
  sectionKey: string;
  data: SectionData;
  designerId: string;
}) {
  const empty = (msg: string) => <p className="text-xs text-zinc-400">{msg}</p>;

  switch (sectionKey) {
    case "projects": {
      const active = data.assignments.filter((a) => a.project && ["in_progress", "planned"].includes(a.project.status));
      if (active.length === 0) return empty("No active assignments.");
      return (
        <ul className="space-y-1">
          {active.map((a) => (
            <li key={a.id} className="text-sm text-zinc-700 flex items-center gap-2">
              <Pill tone="zinc">{a.role}</Pill>
              <span>{a.project?.projectName}</span>
              <span className="text-xs text-zinc-400">since {fmtDate(a.startDate)}</span>
            </li>
          ))}
        </ul>
      );
    }
    case "impact": {
      const recent = data.impactEntries.slice(0, 3);
      if (recent.length === 0) return empty("No impact entries in the last 8 weeks.");
      return (
        <ul className="space-y-1.5">
          {recent.map((e) => (
            <li key={e.id} className="text-sm text-zinc-700">
              <span className="text-xs text-zinc-400 mr-2">{fmtDate(e.date)}</span>
              <span className="text-xs text-zinc-500 capitalize mr-2">{e.dimension.replace(/_/g, " ")} · {e.magnitude}</span>
              {e.summary}
            </li>
          ))}
          {data.impactEntries.length > 3 && (
            <li className="text-xs text-zinc-400">+ {data.impactEntries.length - 3} more</li>
          )}
        </ul>
      );
    }
    case "feedback": {
      const recent = data.feedback.slice(0, 3);
      if (recent.length === 0) return empty("No feedback in the last 8 weeks.");
      return (
        <ul className="space-y-1.5">
          {recent.map((f) => (
            <li key={f.id} className="text-sm text-zinc-700">
              <Pill tone={f.sentiment === "positive" ? "green" : f.sentiment === "concerning" ? "red" : "amber"}>{f.sentiment}</Pill>
              <span className="text-xs text-zinc-500 ml-2">{f.partner?.fullName ?? "internal"} · {fmtDate(f.occurredOn)}</span>
              <p className="text-zinc-600 mt-0.5">{f.summary}</p>
            </li>
          ))}
        </ul>
      );
    }
    case "one_on_one": {
      const last = data.oneOnOnes[0];
      if (!last) return empty("No 1:1 logged yet.");
      const daysAgo = Math.floor((Date.now() - new Date(last.date).getTime()) / (1000 * 60 * 60 * 24));
      return (
        <div className="text-sm text-zinc-700 space-y-1">
          <p>
            <span className="text-zinc-500">Last 1:1: </span>
            {fmtDate(last.date)} <span className="text-xs text-zinc-400">({daysAgo}d ago)</span>
            {last.happinessIndex != null && <span className="ml-2">· ☺ {last.happinessIndex}/10</span>}
            {last.mood && <span className="ml-1 text-zinc-500">· {last.mood}</span>}
          </p>
          {last.topicsDiscussed && <p className="text-xs text-zinc-500 line-clamp-2">{last.topicsDiscussed}</p>}
        </div>
      );
    }
    case "blockers": {
      if (data.blockers.length === 0) return empty("No open blockers ✓");
      return (
        <ul className="space-y-1">
          {data.blockers.map((b) => (
            <li key={b.id} className="text-sm text-zinc-700">
              <span className="text-xs text-zinc-400 mr-2">raised {fmtDate(b.raisedOn)}</span>
              {b.description}
            </li>
          ))}
        </ul>
      );
    }
    case "action_items": {
      if (data.actionItems.length === 0) return empty("All clear ✓");
      return (
        <ul className="space-y-1">
          {data.actionItems.map((a) => {
            const overdue = a.dueDate && new Date(a.dueDate) < new Date();
            return (
              <li key={a.id} className="text-sm text-zinc-700 flex items-start justify-between gap-2">
                <span>{a.description}</span>
                {a.dueDate && (
                  <span className={`text-xs shrink-0 ${overdue ? "text-red-600 font-semibold" : "text-zinc-400"}`}>
                    {overdue ? "overdue " : "due "}{fmtDate(a.dueDate)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      );
    }
    case "wins":
    case "highlights": {
      const wantWins = sectionKey === "wins";
      const items = data.highlights.filter((h) =>
        wantWins
          ? h.kind === "small_win" || h.kind === "big_win"
          : h.kind !== "small_win" && h.kind !== "big_win"
      );
      if (items.length === 0) return empty(wantWins ? "No wins recorded recently." : "No highlights recorded recently.");
      return (
        <ul className="space-y-1">
          {items.slice(0, 4).map((h) => (
            <li key={h.id} className="text-sm text-zinc-700">
              <span className="text-xs text-zinc-400 mr-2">{fmtDate(h.occurredOn)}</span>
              <span className="text-xs text-zinc-500 capitalize mr-1">{h.kind.replace(/_/g, " ")} · </span>
              {h.description}
            </li>
          ))}
        </ul>
      );
    }
    case "happiness": {
      const series = data.oneOnOnes.map((o) => o.happinessIndex).filter((v): v is number => v != null);
      if (series.length === 0) return empty("No happiness data yet.");
      const trend = series.length >= 3 && series[0] < series[1] && series[1] < series[2] ? "down" : "ok";
      // series is most-recent first
      return (
        <div className="text-sm text-zinc-700 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Last {series.length} 1:1s:</span>
            <span className="font-mono">{series.join(" → ")}</span>
            {trend === "down" && <Pill tone="red">↘ trending down</Pill>}
          </div>
        </div>
      );
    }
    case "team_concerns": {
      if (data.teamConcerns.length === 0) return empty("None raised.");
      return (
        <ul className="space-y-1">
          {data.teamConcerns.map((c) => (
            <li key={c.id} className="text-sm text-zinc-700">
              <Pill tone={c.severity === "high" ? "red" : c.severity === "med" ? "amber" : "zinc"}>{c.severity}</Pill>
              <span className="text-xs text-zinc-500 ml-2">{c.theme} · {c.status}</span>
              <p className="text-zinc-600 mt-0.5">{c.concern}</p>
            </li>
          ))}
        </ul>
      );
    }
    case "risk_signals": {
      if (data.riskSignals.length === 0) return empty("No open risks ✓");
      return (
        <ul className="space-y-1">
          {data.riskSignals.map((r) => (
            <li key={r.id} className="text-sm text-zinc-700">
              <Pill tone={r.severity === "high" ? "red" : r.severity === "med" ? "amber" : "zinc"}>{r.severity}</Pill>
              <span className="text-xs text-zinc-500 ml-2 capitalize">{r.signalType.replace(/_/g, " ")} · detected {fmtDate(r.detectedOn)}</span>
              <p className="text-zinc-600 mt-0.5">{r.evidence}</p>
            </li>
          ))}
        </ul>
      );
    }
    case "community": {
      if (data.communityActivities.length === 0) return empty("No community activity in last 30d.");
      return (
        <ul className="space-y-1">
          {data.communityActivities.map((a) => (
            <li key={a.id} className="text-sm text-zinc-700">
              <span className="text-xs text-zinc-400 mr-2">{fmtDate(a.date)}</span>
              <span className="text-xs text-zinc-500 mr-1">{a.activity} ·</span>
              {a.title}
            </li>
          ))}
        </ul>
      );
    }
    case "personality": {
      if (data.personalitySignals.length === 0) return empty("No personality signals yet.");
      return (
        <ul className="space-y-1">
          {data.personalitySignals.map((p) => (
            <li key={p.id} className="text-sm text-zinc-700">
              <span className="font-semibold">{p.trait}</span>
              <span className="text-zinc-500"> — {p.evidence}</span>
              <span className="text-xs text-zinc-400 ml-1">[updated {fmtDate(p.updatedAt)}]</span>
            </li>
          ))}
        </ul>
      );
    }
    default:
      return null;
  }

  // Suppress unused designerId param warning (kept for future extension)
  void designerId;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function BiweeklyCheckinPage() {
  const { designerId } = useParams<{ designerId: string }>();
  const [data, setData] = useState<PrepData | null>(null);
  const [loading, setLoading] = useState(true);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addSheet, setAddSheet] = useState<{ sectionKey: string; entityType: EntityType } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [catchupMode, setCatchupMode] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/checkins/biweekly/${designerId}/prep`);
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Failed"); return; }
      setData(json);
      setTouched(json.sectionsTouched ?? {});
      const autoExpand = new Set<string>();
      (json.flags as Flag[]).forEach((f) => {
        if (f.severity === "urgent" || f.severity === "nudge") autoExpand.add(f.section);
      });
      setExpanded(autoExpand);
      if (json.biweekStart) {
        const prevBiweekEnd = new Date(json.biweekStart);
        prevBiweekEnd.setDate(prevBiweekEnd.getDate() - 1);
        const weeksBehind = Math.floor((Date.now() - prevBiweekEnd.getTime()) / (1000 * 60 * 60 * 24 * 7));
        if (weeksBehind > 2) setCatchupMode(true);
      }
    } catch (err) {
      toast.error(String(err));
    } finally { setLoading(false); }
  }, [designerId]);

  useEffect(() => { load(); }, [load]);

  function markNoChange(key: string) {
    setTouched((prev) => ({ ...prev, [key]: true }));
    toast.success(`${SECTIONS.find((s) => s.key === key)?.label} marked — no change.`);
  }

  function toggleExpand(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function expandAll() {
    setExpanded(new Set(SECTIONS.map((s) => s.key)));
  }
  function collapseAll() {
    setExpanded(new Set());
  }

  async function handleAddSubmit(values: Record<string, unknown>) {
    if (!addSheet) return;
    const res = await fetch(`/api/entities/${addSheet.entityType}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, designerId, raisedByDesignerId: designerId }),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error ?? "Save failed"); throw new Error(); }
    toast.success("Saved");
    setTouched((prev) => ({ ...prev, [addSheet.sectionKey]: true }));
    setAddSheet(null);
    load();
  }

  async function submit(status: "complete" | "skipped") {
    if (!data) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/checkins/biweekly/${designerId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          biweekStart: data.biweekStart,
          biweekEnd: data.biweekEnd,
          sectionsTouched: touched,
          status,
          autoSurfacedFlags: data.flags,
        }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Save failed"); return; }
      toast.success(status === "complete" ? "Biweek check-in complete ✓" : "Biweek skipped.");
      load();
    } catch (err) {
      toast.error(String(err));
    } finally { setSubmitting(false); }
  }

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-8"><p className="text-sm text-zinc-400">Loading…</p></div>;
  if (!data) return <div className="max-w-3xl mx-auto px-4 py-8"><p className="text-sm text-zinc-500">Not found.</p></div>;

  const touchedCount = Object.values(touched).filter(Boolean).length;
  const flagsMap = new Map<string, Flag>();
  data.flags.forEach((f) => flagsMap.set(f.section, f));

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-4 pb-32">
      {/* Top breadcrumbs */}
      <div className="flex items-center justify-between">
        <Link href="/checkins/biweekly" className="text-sm text-zinc-500 hover:text-zinc-700">← All check-ins</Link>
        <Link href={`/designers/${designerId}`} className="text-sm text-zinc-500 hover:text-zinc-700">View profile →</Link>
      </div>

      {/* Header card */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-zinc-900">{data.designer.fullName}</h1>
              {data.checkinStatus === "complete" && <Pill tone="green">✓ Complete</Pill>}
              {data.checkinStatus === "in_progress" && <Pill tone="blue">in progress</Pill>}
              {data.checkinStatus === "overdue" && <Pill tone="red">overdue</Pill>}
            </div>
            <p className="text-sm text-zinc-500 mt-1">
              Biweek {fmtDate(data.biweekStart)} – {fmtDate(data.biweekEnd)} · {data.designer.level} · <span className="capitalize">{data.designer.productArea.replace(/_/g, " ")}</span>
            </p>
          </div>
          <div className="flex gap-2 text-xs">
            <button onClick={expandAll} className="px-2.5 py-1 rounded-lg text-zinc-600 hover:bg-zinc-50 border border-zinc-200">Expand all</button>
            <button onClick={collapseAll} className="px-2.5 py-1 rounded-lg text-zinc-600 hover:bg-zinc-50 border border-zinc-200">Collapse all</button>
          </div>
        </div>

        {catchupMode && (
          <div className="mt-3 rounded-xl px-4 py-2 text-sm" style={{ background: "rgba(255,149,0,0.08)", border: "1px solid rgba(255,149,0,0.22)", color: "#a05a00" }}>
            ⚠ This covers more than 2 weeks — pay extra attention to stale sections.
          </div>
        )}
        {data.aiDisabled && (
          <div className="mt-3 rounded-xl px-4 py-2 text-xs" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.06)", color: "rgba(60,60,67,0.65)" }}>
            AI disabled — no smart flags. Set <code>AI_MODE</code> in <code>.env.local</code> to enable.
          </div>
        )}
        {data.flags.length > 0 && (
          <div className="mt-3 flex gap-2 flex-wrap text-xs">
            <span className="text-zinc-500">Smart flags:</span>
            <Pill tone="red">{data.flags.filter((f) => f.severity === "urgent").length} urgent</Pill>
            <Pill tone="amber">{data.flags.filter((f) => f.severity === "nudge").length} nudge</Pill>
            <Pill tone="blue">{data.flags.filter((f) => f.severity === "info").length} info</Pill>
          </div>
        )}
      </div>

      {/* 13 sections */}
      {SECTIONS.map(({ key, label, entityType, hint }) => {
        const flag = flagsMap.get(key);
        const isDone = touched[key] === true;
        const isOpen = expanded.has(key);

        return (
          <section
            key={key}
            className="bg-white border border-zinc-200 rounded-2xl overflow-hidden transition-all"
            style={isDone ? { opacity: 0.7 } : undefined}
          >
            <button
              onClick={() => toggleExpand(key)}
              className="w-full text-left px-5 py-3 hover:bg-zinc-50 transition-colors"
              style={isOpen ? { borderBottom: "1px solid rgba(0,0,0,0.05)" } : undefined}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm ${isDone ? "line-through text-zinc-400" : "font-semibold text-zinc-900"}`}>
                    {label}
                  </span>
                  {flag && <Pill tone={flagPillTone(flag.severity)}>{flag.severity}</Pill>}
                  {isDone && <span className="text-xs text-green-600 font-medium">✓ reviewed</span>}
                </div>
                <span className="text-xs text-zinc-400">{isOpen ? "▲" : "▼"}</span>
              </div>
              {flag && !isOpen && (
                <p className="text-xs text-zinc-500 mt-1">{flag.message}</p>
              )}
            </button>

            {isOpen && (
              <div className="px-5 py-4 space-y-3">
                {flag && (
                  <div className="rounded-xl px-3 py-2 text-xs" style={flagStyle(flag.severity)}>
                    <span className="font-semibold">{flag.message}</span>
                    {flag.suggested_action && (
                      <span className="ml-1 opacity-90">→ {flag.suggested_action}</span>
                    )}
                  </div>
                )}

                <p className="text-xs text-zinc-500 italic">{hint}</p>

                {/* Inline current-state data */}
                <SectionInlineData sectionKey={key} data={data.sectionData} designerId={designerId} />

                {/* Quick links for special sections */}
                {key === "feedback" && (
                  <Link href="/ingest/email" className="text-xs text-blue-600 hover:underline inline-block">
                    → Paste email to extract feedback
                  </Link>
                )}
                {key === "one_on_one" && (
                  <Link href={`/one-on-ones/new?designer=${designerId}`} className="text-xs text-blue-600 hover:underline inline-block">
                    → Log new 1:1
                  </Link>
                )}

                <div className="flex gap-2 pt-2" style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                  <button
                    onClick={() => setAddSheet({ sectionKey: key, entityType })}
                    className="text-xs px-3 py-1 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors"
                  >
                    + Add
                  </button>
                  <button
                    onClick={() => markNoChange(key)}
                    disabled={isDone}
                    className="text-xs px-3 py-1 rounded-lg text-zinc-500 hover:bg-zinc-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    No change this biweek
                  </button>
                </div>
              </div>
            )}
          </section>
        );
      })}

      {/* Sticky bottom bar */}
      <div
        className="fixed bottom-4 left-1/2 -translate-x-1/2 max-w-3xl w-[calc(100%-2rem)] rounded-2xl px-4 py-3 flex items-center justify-between gap-4 z-20"
        style={{
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(40px) saturate(200%)",
          WebkitBackdropFilter: "blur(40px) saturate(200%)",
          border: "1px solid rgba(0,0,0,0.07)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
        }}
      >
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>{touchedCount} of 13 sections reviewed</span>
            <span className="tabular-nums">{Math.round((touchedCount / 13) * 100)}%</span>
          </div>
          <div className="w-full bg-zinc-100 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full transition-all"
              style={{ width: `${(touchedCount / 13) * 100}%`, background: touchedCount === 13 ? "#34c759" : "#007AFF" }}
            />
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => submit("skipped")}
            disabled={submitting}
            className="text-sm px-3 py-1.5 rounded-xl text-zinc-600 hover:bg-zinc-50 border border-zinc-200 disabled:opacity-50 transition-colors"
          >
            Skip biweek
          </button>
          <button
            onClick={() => submit("complete")}
            disabled={submitting || touchedCount === 0}
            className="text-sm px-4 py-1.5 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors font-medium"
          >
            {submitting ? "Saving…" : "Mark complete"}
          </button>
        </div>
      </div>

      {/* Add slide-over */}
      {addSheet && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          style={{ background: "rgba(0,0,0,0.25)", backdropFilter: "blur(8px)" }}
          onClick={() => setAddSheet(null)}
        >
          <div
            className="w-[480px] bg-white h-full overflow-y-auto p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-900">
                Add {SECTIONS.find((s) => s.key === addSheet.sectionKey)?.label ?? ""}
              </h3>
              <button onClick={() => setAddSheet(null)} className="text-zinc-400 hover:text-zinc-700 text-lg leading-none">✕</button>
            </div>
            <EntityFormByType
              entityType={addSheet.entityType}
              initialValues={{ designerId, raisedByDesignerId: designerId }}
              mode="create"
              onSubmit={handleAddSubmit}
              onCancel={() => setAddSheet(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
