"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface Cluster {
  label: string;
  theme: string;
  concernIds: string[];
  raisedByCount: number;
  severityHighWatermark: string;
  summary: string;
  recommendedAttention: "watch" | "act" | "urgent";
}

interface Concern {
  id: string;
  concern: string;
  theme: string;
  severity: string;
  status: string;
  createdAt: string;
  raisedByDesignerId: string;
  raisedByDesigner?: { fullName: string; id: string };
}

interface ClusterResult {
  clusters: Cluster[];
  orphans: string[];
  generatedAt: string;
  aiDisabled?: boolean;
  concernCount?: number;
}

function attentionColor(a: string) {
  if (a === "urgent") return "bg-red-100 text-red-800 border-red-200";
  if (a === "act") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-blue-50 text-blue-800 border-blue-200";
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ConcernsPage() {
  const [clusters, setClusters] = useState<ClusterResult | null>(null);
  const [concerns, setConcerns] = useState<Concern[]>([]);
  const [clustering, setClustering] = useState(false);
  const [loadingConcerns, setLoadingConcerns] = useState(true);

  const loadConcerns = useCallback(() => {
    fetch("/api/entities/team-concern")
      .then((r) => r.json())
      .then((d) => setConcerns(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingConcerns(false));
  }, []);

  useEffect(() => { loadConcerns(); }, [loadConcerns]);

  async function runCluster() {
    setClustering(true);
    try {
      const res = await fetch("/api/concerns/cluster", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Clustering failed"); return; }
      setClusters(data);
      if (data.aiDisabled) toast.info("AI disabled — no clusters generated.");
      else toast.success(`Clustered ${data.concernCount ?? 0} concerns into ${data.clusters?.length ?? 0} groups.`);
    } catch (err) {
      toast.error(String(err));
    } finally { setClustering(false); }
  }

  const openConcerns = concerns.filter((c) => c.status === "noted" || c.status === "acting");
  const orphanIds = new Set(clusters?.orphans ?? []);
  const clusteredIds = new Set((clusters?.clusters ?? []).flatMap((c) => c.concernIds));
  const concernMap = Object.fromEntries(concerns.map((c) => [c.id, c]));

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Team concerns</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{openConcerns.length} open concerns across the team</p>
        </div>
        <button onClick={runCluster} disabled={clustering} className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-colors">{clustering ? "Clustering…" : "Re-cluster with AI"}</button>
      </div>

      {/* Clusters */}
      {clusters && clusters.clusters.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Clusters</h2>
            <span className="text-xs text-muted-foreground">Generated {fmtDate(clusters.generatedAt)}</span>
          </div>
          <div className="grid gap-3">
            {clusters.clusters.map((c, i) => (
              <Card key={i} className={`border ${attentionColor(c.recommendedAttention)}`}>
                <CardHeader className="py-3 flex flex-row items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-semibold">{c.label}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {c.raisedByCount} designer{c.raisedByCount !== 1 ? "s" : ""} · {c.theme} · {c.severityHighWatermark} severity
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-md font-medium shrink-0 ${attentionColor(c.recommendedAttention)}`}>{c.recommendedAttention}</span>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <p className="text-sm text-muted-foreground">{c.summary}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {c.concernIds.map((cid) => {
                      const concern = concernMap[cid];
                      if (!concern) return null;
                      return (
                        <Link key={cid} href={`/designers/${concern.raisedByDesignerId}`} className="text-xs px-2 py-0.5 rounded-md font-medium bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors">
                          {concern.raisedByDesigner?.fullName ?? "Designer"}: {concern.concern.slice(0, 40)}{concern.concern.length > 40 ? "…" : ""}
                        </Link>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {clusters && clusters.clusters.length === 0 && !clusters.aiDisabled && (
        <Card className="bg-muted/40">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">No clusters found — fewer than 2 designers raised similar concerns. See individual concerns below.</p>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Individual concerns table */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">All open concerns</h2>
        {loadingConcerns ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : openConcerns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open concerns. ✓</p>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Designer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Concern</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Theme</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Severity</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Raised</th>
                  <th className="px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Cluster</th>
                </tr>
              </thead>
              <tbody>
                {openConcerns.map((c, i) => (
                  <tr key={c.id} style={i < openConcerns.length - 1 ? { borderBottom: "1px solid rgba(0,0,0,0.05)" } : {}} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/designers/${c.raisedByDesignerId}`} className="text-xs font-medium text-zinc-600 hover:text-blue-600 transition-colors">
                        {c.raisedByDesigner?.fullName ?? "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 max-w-xs text-zinc-900">{c.concern}</td>
                    <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-md font-medium bg-zinc-100 text-zinc-600">{c.theme}</span></td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${c.severity === "high" ? "bg-red-50 text-red-700" : c.severity === "med" ? "bg-amber-50 text-amber-700" : "bg-zinc-100 text-zinc-600"}`}>{c.severity}</span>
                    </td>
                    <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-md font-medium bg-zinc-100 text-zinc-600">{c.status}</span></td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{fmtDate(c.createdAt)}</td>
                    <td className="px-4 py-3 text-center">
                      {clusteredIds.has(c.id) ? <span className="text-xs text-blue-500">●</span> : orphanIds.has(c.id) ? <span className="text-xs text-zinc-400">○</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
