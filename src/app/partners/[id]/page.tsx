"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type PartnerRole =
  | "engineering_manager" | "product_manager" | "client"
  | "peer_designer" | "cross_functional" | "project_lead";

type OutreachStatus = "draft" | "approved" | "sent" | "responded" | "no_response" | "skipped";

interface FeedbackRow {
  id: string;
  sentiment: string;
  theme: string;
  summary: string;
  quote: string | null;
  occurredOn: string;
  designer: { id: string; fullName: string; productArea: string };
  cycle: { id: string; year: number; quarter: string } | null;
}

interface OutreachRow {
  id: string;
  status: OutreachStatus;
  subject: string | null;
  sentOn: string | null;
  responseReceivedOn: string | null;
  createdAt: string;
  designer: { id: string; fullName: string };
  cycle: { id: string; year: number; quarter: string } | null;
}

interface PartnerDetail {
  id: string;
  fullName: string;
  email: string;
  role: PartnerRole;
  orgOrTeam: string | null;
  active: boolean;
  lastOutreachOn: string | null;
  responseRate: number | null;
  computedResponseRate: number | null;
  notes: string | null;
  feedback: FeedbackRow[];
  outreach: OutreachRow[];
  stats: { feedbackCount: number; outreachCount: number; sent: number; responded: number };
}

const ROLE_LABEL: Record<PartnerRole, string> = {
  engineering_manager: "EM",
  product_manager: "PM",
  client: "Client",
  peer_designer: "Peer designer",
  cross_functional: "Cross-functional",
  project_lead: "Project lead",
};

const ROLE_COLOR: Record<PartnerRole, string> = {
  engineering_manager: "bg-blue-50 text-blue-700",
  product_manager: "bg-purple-50 text-purple-700",
  client: "bg-amber-50 text-amber-700",
  peer_designer: "bg-green-50 text-green-700",
  cross_functional: "bg-zinc-100 text-zinc-600",
  project_lead: "bg-orange-50 text-orange-700",
};

const ROLES: PartnerRole[] = [
  "engineering_manager", "product_manager", "client",
  "peer_designer", "cross_functional", "project_lead",
];

const STATUS_COLOR: Record<OutreachStatus, string> = {
  draft: "bg-zinc-100 text-zinc-600",
  approved: "bg-blue-50 text-blue-700",
  sent: "bg-amber-50 text-amber-700",
  responded: "bg-green-50 text-green-700",
  no_response: "bg-red-50 text-red-700",
  skipped: "bg-zinc-100 text-zinc-500",
};

const SENTIMENT_COLOR: Record<string, string> = {
  positive: "bg-green-50 text-green-700",
  constructive: "bg-amber-50 text-amber-700",
  concerning: "bg-red-50 text-red-700",
  neutral: "bg-zinc-100 text-zinc-600",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function cycleLabel(c: { year: number; quarter: string } | null) {
  return c ? `${c.quarter.toUpperCase()} ${c.year}` : "—";
}

export default function PartnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [partner, setPartner] = useState<PartnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fullName: "", email: "", role: "product_manager" as PartnerRole,
    orgOrTeam: "", notes: "",
  });

  useEffect(() => {
    fetch(`/api/partners/${id}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.data) {
          setPartner(res.data);
          setForm({
            fullName: res.data.fullName,
            email: res.data.email,
            role: res.data.role,
            orgOrTeam: res.data.orgOrTeam ?? "",
            notes: res.data.notes ?? "",
          });
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/partners/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email,
          role: form.role,
          orgOrTeam: form.orgOrTeam || null,
          notes: form.notes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Save failed"); return; }
      setPartner((p) => p ? { ...p, ...json.data } : p);
      setEditing(false);
      toast.success("Partner updated");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive() {
    if (!partner) return;
    const res = await fetch(`/api/partners/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !partner.active }),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error ?? "Update failed"); return; }
    setPartner((p) => p ? { ...p, active: json.data.active } : p);
    toast.success(json.data.active ? "Partner activated" : "Partner deactivated");
  }

  async function handleArchive() {
    if (!confirm("Archive this partner? They'll be hidden from lists.")) return;
    const res = await fetch(`/api/partners/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Archive failed"); return; }
    toast.success("Partner archived");
    router.push("/partners");
  }

  if (loading) {
    return <div className="max-w-5xl mx-auto px-4 py-8"><p className="text-sm text-zinc-400">Loading…</p></div>;
  }
  if (!partner) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <p className="text-sm text-zinc-500">Partner not found.</p>
        <Link href="/partners" className="text-sm text-blue-600 hover:underline mt-2 inline-block">← Back to partners</Link>
      </div>
    );
  }

  const responseRatePct =
    partner.computedResponseRate != null
      ? Math.round(partner.computedResponseRate * 100)
      : null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Breadcrumb */}
      <Link href="/partners" className="text-sm text-zinc-500 hover:text-zinc-700 inline-flex items-center gap-1">
        ← Partners
      </Link>

      {/* Header card */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-zinc-900">{partner.fullName}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${ROLE_COLOR[partner.role]}`}>
                {ROLE_LABEL[partner.role]}
              </span>
              {!partner.active && (
                <span className="text-xs text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-md">inactive</span>
              )}
            </div>
            <p className="text-sm text-zinc-500 mt-1">{partner.email}</p>
            {partner.orgOrTeam && (
              <p className="text-sm text-zinc-500">{partner.orgOrTeam}</p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            {!editing && (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="px-3 py-1.5 text-sm font-medium border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={handleToggleActive}
                  className="px-3 py-1.5 text-sm font-medium border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-colors"
                >
                  {partner.active ? "Deactivate" : "Activate"}
                </button>
                <button
                  onClick={handleArchive}
                  className="px-3 py-1.5 text-sm font-medium border border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition-colors"
                >
                  Archive
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mt-5 pt-5" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
          <Stat label="Feedback given" value={partner.stats.feedbackCount} />
          <Stat label="Outreach sent" value={partner.stats.sent} />
          <Stat label="Responses" value={partner.stats.responded} />
          <Stat
            label="Response rate"
            value={responseRatePct != null ? `${responseRatePct}%` : "—"}
            tone={responseRatePct == null ? "muted" : responseRatePct >= 70 ? "good" : responseRatePct >= 40 ? "warn" : "bad"}
          />
        </div>
        <p className="text-xs text-zinc-400 mt-3">
          Last outreach: {fmtDate(partner.lastOutreachOn)}
        </p>
      </div>

      {/* Edit form */}
      {editing && (
        <form onSubmit={handleSave} className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-900">Edit partner</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Full name *</label>
              <input
                required value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white text-zinc-900 outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Email *</label>
              <input
                required type="email" value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white text-zinc-900 outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Role *</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as PartnerRole }))}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white text-zinc-900 outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Org / team</label>
              <input
                value={form.orgOrTeam}
                onChange={(e) => setForm((f) => ({ ...f, orgOrTeam: e.target.value }))}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white text-zinc-900 outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white text-zinc-900 outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-50">
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      )}

      {/* Notes (when not editing) */}
      {!editing && partner.notes && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-5">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Notes</p>
          <p className="text-sm text-zinc-700 whitespace-pre-wrap">{partner.notes}</p>
        </div>
      )}

      {/* Feedback history */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-900 mb-3">
          Feedback given <span className="text-zinc-400 font-normal">· {partner.feedback.length}</span>
        </h2>
        {partner.feedback.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-center">
            <p className="text-sm text-zinc-400">No feedback recorded from this partner yet.</p>
          </div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                  {["Date", "Designer", "Sentiment", "Theme", "Summary", "Cycle"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {partner.feedback.map((f, i) => (
                  <tr
                    key={f.id}
                    style={i < partner.feedback.length - 1 ? { borderBottom: "1px solid rgba(0,0,0,0.05)" } : {}}
                    className="hover:bg-zinc-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">{fmtDate(f.occurredOn)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/designers/${f.designer.id}`} className="font-medium text-zinc-900 hover:text-blue-600">
                        {f.designer.fullName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${SENTIMENT_COLOR[f.sentiment] ?? "bg-zinc-100 text-zinc-600"}`}>
                        {f.sentiment}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 capitalize">{f.theme.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-zinc-700 max-w-md">
                      <p className="line-clamp-2">{f.summary}</p>
                      {f.quote && <p className="text-xs text-zinc-400 italic mt-0.5 line-clamp-1">&ldquo;{f.quote}&rdquo;</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{cycleLabel(f.cycle)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Outreach history */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-900 mb-3">
          Outreach history <span className="text-zinc-400 font-normal">· {partner.outreach.length}</span>
        </h2>
        {partner.outreach.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-center">
            <p className="text-sm text-zinc-400">No outreach with this partner yet.</p>
          </div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                  {["Cycle", "Designer", "Status", "Subject", "Sent", "Response"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {partner.outreach.map((o, i) => (
                  <tr
                    key={o.id}
                    style={i < partner.outreach.length - 1 ? { borderBottom: "1px solid rgba(0,0,0,0.05)" } : {}}
                    className="hover:bg-zinc-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">{cycleLabel(o.cycle)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/designers/${o.designer.id}`} className="font-medium text-zinc-900 hover:text-blue-600">
                        {o.designer.fullName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${STATUS_COLOR[o.status]}`}>
                        {o.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 max-w-xs truncate">{o.subject ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">{fmtDate(o.sentOn)}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">{fmtDate(o.responseReceivedOn)}</td>
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

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "good" | "warn" | "bad" | "muted" }) {
  const color =
    tone === "good" ? "#34c759" :
    tone === "warn" ? "#ff9500" :
    tone === "bad" ? "#ff3b30" :
    tone === "muted" ? "rgba(60,60,67,0.35)" :
    "#1c1c1e";
  return (
    <div>
      <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-0.5 tabular-nums" style={{ color }}>{value}</p>
    </div>
  );
}
