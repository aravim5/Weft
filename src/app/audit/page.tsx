"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface AuditEntry {
  id: string;
  createdAt: string;
  designerId: string | null;
  jobName: string;
  entityType: string | null;
  entityId: string | null;
  finalAccepted: boolean | null;
  acceptedAsIs: boolean | null;
  editedFields: string | null;
  userAction: string | null;
  designer: { fullName: string; id: string } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const JOB_LABEL: Record<string, string> = {
  "extract-email": "Email extract",
  "extract-note": "Note extract",
  "extract-one-on-one": "1:1 extract",
  "pre-one-on-one-brief": "Pre-1:1 brief",
  "biweekly-checklist-prep": "Biweekly prep",
  "summarize-designer": "Rolling profile",
  "generate-cycle-review": "Cycle review",
  "answer-query": "Chat",
  "draft-outreach": "Outreach draft",
  "cluster-team-concerns": "Cluster concerns",
};

const ACTION_STYLE: Record<string, string> = {
  accepted: "bg-green-50 text-green-700",
  edited_and_accepted: "bg-blue-50 text-blue-700",
  rejected: "bg-red-50 text-red-700",
  skipped: "bg-zinc-100 text-zinc-500",
  read_only: "bg-zinc-100 text-zinc-500",
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [jobFilter, setJobFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (jobFilter !== "all") params.set("jobName", jobFilter);
    if (actionFilter !== "all") params.set("userAction", actionFilter);

    fetch(`/api/audit?${params}`)
      .then((r) => r.json())
      .then((res) => {
        setEntries(res.data ?? []);
        setPagination(res.pagination ?? { page: 1, limit: 50, total: 0, pages: 0 });
      })
      .finally(() => setLoading(false));
  }, [page, jobFilter, actionFilter]);

  useEffect(() => { load(); }, [load]);

  const jobs = Object.keys(JOB_LABEL);
  const actions = ["accepted", "edited_and_accepted", "rejected", "skipped", "read_only"];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Audit log</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {pagination.total} AI operation{pagination.total !== 1 ? "s" : ""} recorded
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <select
          value={jobFilter}
          onChange={(e) => { setJobFilter(e.target.value); setPage(1); }}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-800 outline-none focus:ring-2 focus:ring-blue-500/30"
        >
          <option value="all">All jobs</option>
          {jobs.map((j) => <option key={j} value={j}>{JOB_LABEL[j]}</option>)}
        </select>
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-800 outline-none focus:ring-2 focus:ring-blue-500/30"
        >
          <option value="all">All outcomes</option>
          {actions.map((a) => <option key={a} value={a}>{a.replace(/_/g, " ")}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-sm text-zinc-400 py-8 text-center">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center space-y-2">
          <p className="text-zinc-500 text-sm font-medium">No AI operations recorded yet.</p>
          <p className="text-zinc-400 text-xs">Operations appear here once you use AI features — email extraction, 1:1 briefs, rolling profiles, and more.</p>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">When</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Job</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Designer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Entity</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Outcome</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Edited fields</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const editedFields: string[] = e.editedFields
                  ? (() => { try { return JSON.parse(e.editedFields!); } catch { return []; } })()
                  : [];
                return (
                  <tr
                    key={e.id}
                    style={i < entries.length - 1 ? { borderBottom: "1px solid rgba(0,0,0,0.05)" } : {}}
                    className="hover:bg-zinc-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">{fmtDate(e.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-zinc-100 text-zinc-600">
                        {JOB_LABEL[e.jobName] ?? e.jobName}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {e.designer ? (
                        <Link href={`/designers/${e.designer.id}`} className="text-xs font-medium text-zinc-700 hover:text-blue-600 transition-colors">
                          {e.designer.fullName}
                        </Link>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500 capitalize">
                      {e.entityType ? e.entityType.replace(/_/g, " ") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {e.userAction ? (
                        <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${ACTION_STYLE[e.userAction] ?? "bg-zinc-100 text-zinc-600"}`}>
                          {e.userAction.replace(/_/g, " ")}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {editedFields.length > 0 ? editedFields.join(", ") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-400">
            Page {pagination.page} of {pagination.pages} · {pagination.total} total
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ← Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
              disabled={page === pagination.pages}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
