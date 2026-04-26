"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type PartnerRole =
  | "engineering_manager" | "product_manager" | "client"
  | "peer_designer" | "cross_functional" | "project_lead";

interface Partner {
  id: string;
  fullName: string;
  email: string;
  role: PartnerRole;
  orgOrTeam: string | null;
  active: boolean;
  responseRate: number | null;
  notes: string | null;
  _count: { feedback: number; outreach: number };
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

export default function PartnersPage() {
  const router = useRouter();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<PartnerRole | "all">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    fullName: "", email: "", role: "product_manager" as PartnerRole,
    orgOrTeam: "", notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/partners")
      .then((r) => r.json())
      .then((res) => setPartners(res.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, orgOrTeam: form.orgOrTeam || undefined }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Save failed"); return; }
      setPartners((prev) =>
        [...prev, { ...json.data, _count: { feedback: 0, outreach: 0 } }]
          .sort((a, b) => a.fullName.localeCompare(b.fullName))
      );
      setForm({ fullName: "", email: "", role: "product_manager", orgOrTeam: "", notes: "" });
      setShowAdd(false);
      toast.success(`${json.data.fullName} added`);
    } finally {
      setSaving(false);
    }
  }

  const filtered = partners.filter((p) => {
    const matchSearch = !search ||
      p.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (p.orgOrTeam ?? "").toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || p.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Partners</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{partners.length} feedback partners</p>
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors"
        >
          {showAdd ? "Cancel" : "+ Add partner"}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-900">New partner</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Full name *</label>
              <input
                required value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white text-zinc-900 outline-none focus:ring-2 focus:ring-blue-500/30"
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Email *</label>
              <input
                required type="email" value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white text-zinc-900 outline-none focus:ring-2 focus:ring-blue-500/30"
                placeholder="jane@company.com"
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
                placeholder="Platform Engineering"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white text-zinc-900 outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
              placeholder="Optional context…"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-50">
              {saving ? "Saving…" : "Add partner"}
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or org…"
          className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-800 outline-none focus:ring-2 focus:ring-blue-500/30 w-52"
        />
        <div className="flex gap-1.5 flex-wrap">
          {(["all", ...ROLES] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r === roleFilter ? "all" : (r as PartnerRole | "all"))}
              className="px-3 py-1 rounded-full text-xs font-medium transition-all"
              style={roleFilter === r
                ? { background: "rgba(0,122,255,0.12)", color: "#007AFF" }
                : { background: "rgba(0,0,0,0.04)", color: "rgba(60,60,67,0.65)" }}
            >
              {r === "all" ? "All" : ROLE_LABEL[r as PartnerRole]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-sm text-zinc-400 py-8 text-center">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-10 text-center">
          <p className="text-zinc-400 text-sm">
            {partners.length === 0 ? "No partners yet — add one above." : "No matches."}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                {["Name", "Role", "Org / team", "Feedback", "Outreach", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/partners/${p.id}`)}
                  style={i < filtered.length - 1 ? { borderBottom: "1px solid rgba(0,0,0,0.05)" } : {}}
                  className="hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/partners/${p.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="block"
                    >
                      <p className="font-medium text-zinc-900 hover:text-blue-600">{p.fullName}</p>
                      <p className="text-xs text-zinc-400">{p.email}</p>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${ROLE_COLOR[p.role]}`}>
                      {ROLE_LABEL[p.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{p.orgOrTeam ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-600 tabular-nums">{p._count.feedback}</td>
                  <td className="px-4 py-3 text-zinc-600 tabular-nums">{p._count.outreach}</td>
                  <td className="px-4 py-3">
                    {!p.active ? (
                      <span className="text-xs text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-md">inactive</span>
                    ) : (
                      <span className="text-xs text-zinc-300">›</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
