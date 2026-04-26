"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EntityFormByType } from "@/components/forms/EntityForm";

interface OneOnOneData {
  id: string;
  designerId: string;
  date: string;
  durationMinutes?: number | null;
  mood?: string | null;
  happinessIndex?: number | null;
  happinessSource?: string | null;
  topicsDiscussed: string;
  vibeNotes?: string | null;
  nextMeetingOn?: string | null;
  designer: { id: string; fullName: string };
  blockers: Array<{ id: string; description: string; status: string; raisedOn: string }>;
  actionItems: Array<{ id: string; description: string; dueDate?: string | null; status: string }>;
  highlights: Array<{ id: string; kind: string; description: string }>;
  teamConcerns: Array<{ id: string; concern: string; theme: string; severity: string; status: string }>;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" });
}

export default function OneOnOneDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<OneOnOneData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/entities/one-on-one/${id}`)
      .then((r) => r.json())
      .then((d) => setData(d.data))
      .catch(() => toast.error("Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleEdit(values: Record<string, unknown>) {
    const res = await fetch(`/api/entities/one-on-one/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error ?? "Save failed"); throw new Error(); }
    toast.success("Updated");
    setEditOpen(false);
    setData(json.data);
  }

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!data) return <div className="p-8 text-sm text-muted-foreground">Not found.</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
      <div className="flex items-center justify-between">
        <Link href={`/designers/${data.designerId}`} className="text-xs text-muted-foreground hover:underline">← {data.designer?.fullName}</Link>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>Edit</Button>
      </div>

      {/* Header */}
      <div className="rounded-xl border bg-card px-6 py-4 space-y-2">
        <h1 className="text-xl font-semibold">1:1 — {fmtDate(data.date)}</h1>
        <div className="flex flex-wrap gap-2 text-sm">
          {data.durationMinutes && <Badge variant="secondary">{data.durationMinutes}m</Badge>}
          {data.mood && <Badge variant="outline">{data.mood}</Badge>}
          {data.happinessIndex && (
            <Badge variant="outline">☺ {data.happinessIndex}/10{data.happinessSource ? ` (${data.happinessSource.replace("_", " ")})` : ""}</Badge>
          )}
        </div>
        {data.nextMeetingOn && <p className="text-xs text-muted-foreground">Next meeting: {fmtDate(data.nextMeetingOn)}</p>}
      </div>

      {/* Topics */}
      <Card>
        <CardHeader className="py-3"><CardTitle className="text-sm">Topics discussed</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm whitespace-pre-wrap">{data.topicsDiscussed}</p>
        </CardContent>
      </Card>

      {/* Vibe notes */}
      {data.vibeNotes && (
        <Card className="border-dashed">
          <CardHeader className="py-3"><CardTitle className="text-sm text-muted-foreground">Vibe notes (owner-only)</CardTitle></CardHeader>
          <CardContent className="pt-0"><p className="text-sm text-muted-foreground whitespace-pre-wrap">{data.vibeNotes}</p></CardContent>
        </Card>
      )}

      {/* Spawned rows */}
      {(data.blockers ?? []).length > 0 && (
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-sm">Blockers from this 1:1</CardTitle></CardHeader>
          <CardContent className="pt-0 space-y-1">
            {data.blockers.map((b) => (
              <div key={b.id} className="flex items-center justify-between text-sm">
                <span>{b.description}</span>
                <Badge variant="outline" className="text-xs">{b.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {(data.actionItems ?? []).length > 0 && (
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-sm">Actions from this 1:1</CardTitle></CardHeader>
          <CardContent className="pt-0 space-y-1">
            {data.actionItems.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <span>{a.description}</span>
                <div className="flex items-center gap-2">
                  {a.dueDate && <span className="text-xs text-muted-foreground">due {new Date(a.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                  <Badge variant="outline" className="text-xs">{a.status}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {(data.highlights ?? []).length > 0 && (
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-sm">Wins from this 1:1</CardTitle></CardHeader>
          <CardContent className="pt-0 space-y-1">
            {data.highlights.map((h) => (
              <div key={h.id} className="text-sm">
                <Badge variant="secondary" className="text-xs mr-1">{h.kind.replace(/_/g, " ")}</Badge>{h.description}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {(data.teamConcerns ?? []).length > 0 && (
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-sm">Concerns from this 1:1</CardTitle></CardHeader>
          <CardContent className="pt-0 space-y-1">
            {data.teamConcerns.map((c) => (
              <div key={c.id} className="text-sm">
                <Badge variant="outline" className="text-xs mr-1">{c.theme}/{c.severity}</Badge>{c.concern}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="w-[480px] overflow-y-auto">
          <SheetHeader><SheetTitle>Edit 1:1</SheetTitle></SheetHeader>
          <div className="mt-4">
            <EntityFormByType entityType="one-on-one" initialValues={data as unknown as Record<string, unknown>} mode="edit" onSubmit={handleEdit} onCancel={() => setEditOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
