import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Alert } from "@/app/api/alerts/route";

function daysUntil(d: Date): number {
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

async function getUrgentAlerts(): Promise<Alert[]> {
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const res = await fetch(`${base}/api/alerts`, { cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json() as { data: Alert[] };
    return (json.data ?? []).filter((a) => a.severity === "urgent").slice(0, 4);
  } catch {
    return [];
  }
}

async function getPageData() {
  const [nextCycle, recentEmails, designers] = await Promise.all([
    db.reviewCycle.findFirst({
      where: { status: { in: ["planned", "collecting"] }, archivedAt: null },
      orderBy: { checkinDate: "asc" },
    }),
    db.inboxEmail.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, subject: true, senderName: true, status: true, createdAt: true, source: true },
    }),
    db.designer.findMany({
      where: { archivedAt: null },
      select: {
        id: true,
        fullName: true,
        biweeklyCheckins: {
          orderBy: { biweekStart: "desc" },
          take: 1,
          select: { biweekStart: true, completedOn: true },
        },
        oneOnOnes: {
          orderBy: { date: "desc" },
          take: 3,
          select: { happinessIndex: true },
        },
      },
    }),
  ]);

  // Designers needing attention: stale biweekly (> 14 days) or trending-down happiness
  const now = Date.now();
  const twoWeeks = 14 * 24 * 60 * 60 * 1000;

  const needsAttention = designers
    .map((d) => {
      const lastCheckin = d.biweeklyCheckins[0];
      const stale = !lastCheckin || (now - new Date(lastCheckin.biweekStart).getTime()) > twoWeeks;
      const moods = d.oneOnOnes.map((o) => o.happinessIndex).filter((h): h is number => h !== null);
      const trendingDown = moods.length >= 2 && moods[0] < moods[moods.length - 1];
      const reason = stale ? "Stale check-in" : trendingDown ? "Happiness trending down" : null;
      return { ...d, stale, trendingDown, reason };
    })
    .filter((d) => d.stale || d.trendingDown)
    .slice(0, 5);

  return { nextCycle, recentEmails, needsAttention };
}

const QUICK_ACTIONS = [
  { href: "/ingest/email", label: "Paste Email", desc: "AI-extract feedback from a pasted email", icon: "✉" },
  { href: "/ingest/note", label: "Paste Note", desc: "Turn rough notes into structured rows", icon: "📝" },
  { href: "/ingest/upload", label: "Upload File", desc: "CSV, Excel, or PDF extraction", icon: "📎" },
  { href: "/ingest/form", label: "Manual Entry", desc: "Create any entity directly", icon: "✏" },
  { href: "/one-on-ones/new", label: "Log 1:1", desc: "Record a 1:1 meeting", icon: "💬" },
];

export default async function HomePage() {
  const [{ nextCycle, recentEmails, needsAttention }, urgentAlerts] = await Promise.all([
    getPageData(),
    getUrgentAlerts(),
  ]);

  const cycleLabel = nextCycle ? `Q${nextCycle.quarter.replace("Q", "")} ${nextCycle.year}` : null;
  const daysLeft = nextCycle ? daysUntil(new Date(nextCycle.checkinDate)) : null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Top bar */}
      {nextCycle && (
        <div className="flex items-center justify-between rounded-xl border bg-card px-6 py-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Next cycle</p>
            <p className="text-lg font-semibold">{cycleLabel} — {new Date(nextCycle.checkinDate).toLocaleDateString("en-US", { month: "long", day: "numeric" })}</p>
          </div>
          <div className="text-right">
            <p className={`text-3xl font-bold tabular-nums ${daysLeft && daysLeft <= 14 ? "text-destructive" : ""}`}>{daysLeft ?? "—"}</p>
            <p className="text-xs text-muted-foreground">days away</p>
          </div>
        </div>
      )}

      {/* Urgent alerts banner */}
      {urgentAlerts.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
              {urgentAlerts.length} urgent alert{urgentAlerts.length > 1 ? "s" : ""}
            </p>
            <Link href="/alerts" className="text-xs font-medium text-red-600 hover:text-red-800">
              View all →
            </Link>
          </div>
          {urgentAlerts.map((a) => (
            <Link
              key={a.id}
              href={`/designers/${a.designerId}`}
              className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              <span className="font-medium text-red-800">{a.designerName}</span>
              <span className="text-red-600">—</span>
              <span className="text-red-700">{a.message}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">Quick actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {QUICK_ACTIONS.map((a) => (
            <Link key={a.href} href={a.href} className="rounded-xl border bg-card hover:bg-muted/60 transition-colors p-4 space-y-1 group">
              <div className="text-xl">{a.icon}</div>
              <p className="font-medium text-sm group-hover:text-primary">{a.label}</p>
              <p className="text-xs text-muted-foreground">{a.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent ingest activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent ingest activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentEmails.length === 0 ? (
              <p className="text-sm text-muted-foreground">No emails ingested yet.</p>
            ) : (
              <ul className="space-y-2">
                {recentEmails.map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{e.subject ?? e.senderName ?? "(untitled)"}</p>
                      <p className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleDateString()}</p>
                    </div>
                    <Badge variant="outline" className={`shrink-0 text-xs ${e.status === "processed" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                      {e.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Designers needing attention */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Designers needing attention</CardTitle>
          </CardHeader>
          <CardContent>
            {needsAttention.length === 0 ? (
              <p className="text-sm text-muted-foreground">All caught up.</p>
            ) : (
              <ul className="space-y-2">
                {needsAttention.map((d) => (
                  <li key={d.id}>
                    <Link href={`/designers/${d.id}`} className="flex items-center justify-between hover:underline">
                      <span className="text-sm font-medium">{d.fullName}</span>
                      <span className="text-xs text-muted-foreground">{d.reason}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
