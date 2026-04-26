"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EntityFormByType } from "@/components/forms/EntityForm";

// The 13 sections in order
const SECTIONS = [
  { key: "projects",       label: "Projects",            entityType: "assignment",          hint: "New assignments, status changes, shipped work?" },
  { key: "impact",         label: "Impact",              entityType: "impact-entry",        hint: "Anything noteworthy to record?" },
  { key: "feedback",       label: "Feedback received",   entityType: "feedback",            hint: "Any emails to log? Peer kudos?" },
  { key: "one_on_one",     label: "1:1 notes",           entityType: "one-on-one",          hint: "Did you meet? Anything to log?" },
  { key: "blockers",       label: "Blockers",            entityType: "blocker",             hint: "Still open? Any new ones?" },
  { key: "action_items",   label: "My action items",     entityType: "action-item",         hint: "Any completed? Any new ones?" },
  { key: "wins",           label: "Wins",                entityType: "highlight",           hint: "Small or big wins this biweek?" },
  { key: "happiness",      label: "Happiness read",      entityType: "one-on-one",          hint: "Your gut read (separate from their self-report)" },
  { key: "team_concerns",  label: "Team concerns",       entityType: "team-concern",        hint: "Did they raise anything about the team/env?" },
  { key: "risk_signals",   label: "Risk signals",        entityType: "risk-signal",         hint: "Any new signals? Any existing to update?" },
  { key: "highlights",     label: "Highlights",          entityType: "highlight",           hint: "Anything standout?" },
  { key: "community",      label: "Community",           entityType: "community-activity",  hint: "Any design-team or community activity?" },
  { key: "personality",    label: "Personality signals", entityType: "personality-signal",  hint: "Anything new to note or refine?" },
] as const;

type SectionKey = typeof SECTIONS[number]["key"];
type EntityType = typeof SECTIONS[number]["entityType"];

interface Flag {
  section: string;
  severity: "info" | "nudge" | "urgent";
  message: string;
  suggested_action: string | null;
}

interface PrepData {
  designer: { id: string; fullName: string; level: string; productArea: string; title: string };
  biweekStart: string;
  biweekEnd: string;
  checkinId: string | null;
  checkinStatus: string;
  sectionsTouched: Record<string, boolean>;
  flags: Flag[];
  aiDisabled?: boolean;
  sectionData: Record<string, unknown[]>;
}

function flagColor(s: Flag["severity"]) {
  if (s === "urgent") return "bg-red-50 border-red-200 text-red-800";
  if (s === "nudge") return "bg-amber-50 border-amber-200 text-amber-800";
  return "bg-blue-50 border-blue-200 text-blue-700";
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

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
      // Restore saved touched state
      setTouched(json.sectionsTouched ?? {});
      // Auto-expand urgent + nudge sections
      const autoExpand = new Set<string>();
      (json.flags as Flag[]).forEach((f) => {
        if (f.severity === "urgent" || f.severity === "nudge") autoExpand.add(f.section);
      });
      setExpanded(autoExpand);
      // Check if this covers >2 weeks (catchup mode)
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
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function handleAddSubmit(values: Record<string, unknown>) {
    if (!addSheet) return;
    const res = await fetch(`/api/entities/${addSheet.entityType}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, designerId }),
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

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!data) return <div className="p-8 text-sm text-muted-foreground">Not found.</div>;

  const touchedCount = Object.values(touched).filter(Boolean).length;
  const flagsMap = new Map<string, Flag>();
  data.flags.forEach((f) => flagsMap.set(f.section, f));

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/checkins/biweekly" className="text-xs text-muted-foreground hover:underline">← All check-ins</Link>
        <Link href={`/designers/${designerId}`} className="text-xs text-muted-foreground hover:underline">View profile →</Link>
      </div>

      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{data.designer.fullName}</h1>
        <p className="text-sm text-muted-foreground">
          Biweek {fmtDate(data.biweekStart)} – {fmtDate(data.biweekEnd)}
          {data.checkinStatus === "complete" && <span className="ml-2 text-green-600 font-medium">✓ Complete</span>}
        </p>
      </div>

      {catchupMode && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          This covers more than 2 weeks — extra attention suggested on stale sections.
        </div>
      )}

      {data.aiDisabled && (
        <div className="rounded-md border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
          AI disabled — no smart flags. Enable AI_MODE in .env.local.
        </div>
      )}

      {/* 13 sections */}
      {SECTIONS.map(({ key, label, entityType, hint }) => {
        const flag = flagsMap.get(key);
        const isDone = touched[key] === true;
        const isOpen = expanded.has(key);

        return (
          <Card key={key} className={`transition-all ${isDone ? "opacity-70" : ""}`}>
            <CardHeader
              className="py-3 cursor-pointer select-none"
              onClick={() => toggleExpand(key)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${isDone ? "line-through text-muted-foreground" : "font-medium"}`}>
                    {label}
                  </span>
                  {flag && (
                    <Badge variant="outline" className={`text-xs ${flagColor(flag.severity)}`}>
                      {flag.severity}
                    </Badge>
                  )}
                  {isDone && <span className="text-xs text-green-600">✓</span>}
                </div>
                <span className="text-xs text-muted-foreground">{isOpen ? "▲" : "▼"}</span>
              </div>
              {flag && !isOpen && (
                <p className="text-xs text-muted-foreground mt-0.5 ml-0">{flag.message}</p>
              )}
            </CardHeader>

            {isOpen && (
              <CardContent className="pt-0 space-y-3">
                {flag && (
                  <div className={`rounded-md border px-3 py-2 text-xs ${flagColor(flag.severity)}`}>
                    <span className="font-medium">{flag.message}</span>
                    {flag.suggested_action && (
                      <span className="ml-1 opacity-80">→ {flag.suggested_action}</span>
                    )}
                  </div>
                )}

                <p className="text-xs text-muted-foreground italic">{hint}</p>

                {key === "feedback" && (
                  <Link href="/ingest/email" className="text-xs text-primary hover:underline">
                    → Paste email to extract feedback
                  </Link>
                )}
                {key === "one_on_one" && (
                  <Link href={`/one-on-ones/new?designerId=${designerId}`} className="text-xs text-primary hover:underline">
                    → Log new 1:1
                  </Link>
                )}

                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs px-2"
                    onClick={() => setAddSheet({ sectionKey: key, entityType })}
                  >
                    + Add
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs px-2 text-muted-foreground"
                    onClick={() => markNoChange(key)}
                    disabled={isDone}
                  >
                    No change this biweek
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Bottom bar */}
      <div className="sticky bottom-4 rounded-xl border bg-background/95 backdrop-blur shadow-lg px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{touchedCount} of 13 sections reviewed</span>
            <span>{Math.round((touchedCount / 13) * 100)}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5">
            <div
              className="bg-primary h-1.5 rounded-full transition-all"
              style={{ width: `${(touchedCount / 13) * 100}%` }}
            />
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => submit("skipped")}
            disabled={submitting}
          >
            Skip biweek
          </Button>
          <Button
            size="sm"
            onClick={() => submit("complete")}
            disabled={submitting || touchedCount === 0}
          >
            {submitting ? "Saving…" : "Mark complete"}
          </Button>
        </div>
      </div>

      {/* Add entity sheet */}
      <Sheet open={!!addSheet} onOpenChange={(o) => { if (!o) setAddSheet(null); }}>
        <SheetContent side="right" className="w-[480px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              Add {SECTIONS.find((s) => s.key === addSheet?.sectionKey)?.label ?? ""}
            </SheetTitle>
          </SheetHeader>
          {addSheet && (
            <div className="mt-4">
              <EntityFormByType
                entityType={addSheet.entityType}
                initialValues={{ designerId, raisedByDesignerId: designerId }}
                mode="create"
                onSubmit={handleAddSubmit}
                onCancel={() => setAddSheet(null)}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
