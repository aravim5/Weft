"use client";

import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";

interface DetectedOneOnOne {
  uid: string;
  occurrenceDate: string;
  durationMinutes: number;
  summary: string;
  matchedDesignerName: string;
  designerId: string;
  location: string | null;
  alreadyLogged: boolean;
}

interface ParseResult {
  detected: DetectedOneOnOne[];
  totalEvents: number;
  recurringEvents: number;
  designers: number;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

function fmtDuration(mins: number) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function isPast(iso: string) {
  return new Date(iso) < new Date();
}

export default function CalendarImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [logging, setLogging] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loggedUids, setLoggedUids] = useState<Set<string>>(new Set());

  const parseFile = useCallback(async (file: File) => {
    if (!file.name.endsWith(".ics")) {
      toast.error("Please select an .ics calendar file.");
      return;
    }
    setParsing(true);
    setResult(null);
    setSelected(new Set());
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/calendar/import", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Parse failed"); return; }
      setResult(data);

      // Auto-select: past occurrences not already logged
      const autoSelect = new Set(
        (data.detected as DetectedOneOnOne[])
          .filter((o) => isPast(o.occurrenceDate) && !o.alreadyLogged)
          .map((o) => o.uid)
      );
      setSelected(autoSelect);

      if (data.detected.length === 0) {
        toast.info("No 1:1s detected — check that designer names appear in event titles.");
      } else {
        toast.success(`Found ${data.detected.length} occurrence${data.detected.length !== 1 ? "s" : ""} across ${new Set((data.detected as DetectedOneOnOne[]).map(o => o.designerId)).size} designers.`);
      }
    } catch (err) {
      toast.error(String(err));
    } finally {
      setParsing(false);
    }
  }, []);

  async function handleLog() {
    if (selected.size === 0) { toast.warning("Nothing selected."); return; }
    const toLog = result!.detected
      .filter((o) => selected.has(o.uid))
      .map((o) => ({
        designerId: o.designerId,
        date: o.occurrenceDate,
        durationMinutes: o.durationMinutes,
        summary: o.summary,
      }));

    setLogging(true);
    try {
      const res = await fetch("/api/calendar/import?action=log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occurrences: toLog }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Log failed"); return; }
      toast.success(`Logged ${data.logged} 1:1${data.logged !== 1 ? "s" : ""}${data.skipped > 0 ? ` · ${data.skipped} already existed` : ""}.`);
      setLoggedUids((prev) => new Set([...prev, ...selected]));
      setSelected(new Set());
    } catch (err) {
      toast.error(String(err));
    } finally {
      setLogging(false);
    }
  }

  // Group by designer
  const byDesigner = result
    ? result.detected.reduce<Record<string, DetectedOneOnOne[]>>((acc, o) => {
        if (!acc[o.matchedDesignerName]) acc[o.matchedDesignerName] = [];
        acc[o.matchedDesignerName].push(o);
        return acc;
      }, {})
    : null;

  const selectedCount = selected.size;
  const newCount = result?.detected.filter((o) => !o.alreadyLogged && !loggedUids.has(o.uid)).length ?? 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Import from Outlook</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Export your Outlook calendar as .ics — the app detects your 1:1s by matching designer names in event titles, including all recurring occurrences.
        </p>
      </div>

      {/* How to export hint */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 space-y-1">
        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">How to export from Outlook</p>
        <ol className="text-xs text-blue-700 space-y-0.5 list-decimal list-inside">
          <li>Open Outlook → File → Open &amp; Export → Import/Export</li>
          <li>Choose "Export to a file" → "iCalendar (.ics)"</li>
          <li>Select your Calendar → save the .ics file</li>
          <li>Drop it below</li>
        </ol>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) parseFile(f);
        }}
        className="bg-white border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all"
        style={{ borderColor: dragging ? "#007AFF" : "rgba(0,0,0,0.12)" }}
      >
        <input
          ref={fileRef} type="file" accept=".ics" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); }}
        />
        <p className="text-3xl mb-3">📅</p>
        {parsing ? (
          <p className="text-sm text-zinc-500 font-medium">Parsing calendar and expanding recurring events…</p>
        ) : (
          <>
            <p className="text-sm font-semibold text-zinc-700">Drop your .ics file here</p>
            <p className="text-xs text-zinc-400 mt-1">or click to browse</p>
          </>
        )}
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Stats bar */}
          <div className="flex gap-4 flex-wrap">
            {[
              { label: "Events in file", value: result.totalEvents },
              { label: "Recurring", value: result.recurringEvents },
              { label: "1:1s detected", value: result.detected.length },
              { label: "New to log", value: newCount },
            ].map((s) => (
              <div key={s.label} className="bg-white border border-zinc-200 rounded-xl px-4 py-3 flex-1 min-w-[100px]">
                <p className="text-xl font-bold text-zinc-900">{s.value}</p>
                <p className="text-xs text-zinc-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {result.detected.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-2xl p-10 text-center">
              <p className="text-zinc-500 text-sm font-medium">No 1:1s detected.</p>
              <p className="text-zinc-400 text-xs mt-1">Make sure your event titles contain designer first or last names (e.g. "1:1 Sruthi", "Ravi / Arun").</p>
            </div>
          ) : (
            <>
              {/* Per-designer groups */}
              <div className="space-y-4">
                {Object.entries(byDesigner!).sort(([a], [b]) => a.localeCompare(b)).map(([name, occurrences]) => {
                  const allSelected = occurrences.every((o) => selected.has(o.uid) || o.alreadyLogged || loggedUids.has(o.uid));
                  const toggleAll = () => {
                    const eligible = occurrences.filter((o) => !o.alreadyLogged && !loggedUids.has(o.uid));
                    const allOn = eligible.every((o) => selected.has(o.uid));
                    setSelected((prev) => {
                      const next = new Set(prev);
                      eligible.forEach((o) => allOn ? next.delete(o.uid) : next.add(o.uid));
                      return next;
                    });
                  };

                  return (
                    <div key={name} className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
                      <div
                        className="flex items-center justify-between px-4 py-3 cursor-pointer"
                        style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}
                        onClick={toggleAll}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: "rgba(0,122,255,0.10)", color: "#007AFF" }}>
                            {name.charAt(0)}
                          </div>
                          <p className="text-sm font-semibold text-zinc-900">{name}</p>
                          <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-zinc-100 text-zinc-500">
                            {occurrences.length} session{occurrences.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <span className="text-xs text-zinc-400 hover:text-zinc-600">{allSelected ? "Deselect all" : "Select all"}</span>
                      </div>

                      <div>
                        {occurrences.map((o, i) => {
                          const alreadyDone = o.alreadyLogged || loggedUids.has(o.uid);
                          const isSelected = selected.has(o.uid);
                          const future = !isPast(o.occurrenceDate);

                          return (
                            <div
                              key={o.uid}
                              style={i < occurrences.length - 1 ? { borderBottom: "1px solid rgba(0,0,0,0.05)" } : {}}
                              className={`flex items-center gap-3 px-4 py-3 transition-colors ${alreadyDone ? "opacity-50" : "hover:bg-zinc-50 cursor-pointer"}`}
                              onClick={() => {
                                if (alreadyDone) return;
                                setSelected((prev) => {
                                  const next = new Set(prev);
                                  isSelected ? next.delete(o.uid) : next.add(o.uid);
                                  return next;
                                });
                              }}
                            >
                              {/* Checkbox */}
                              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${alreadyDone ? "border-green-400 bg-green-400" : isSelected ? "border-blue-500 bg-blue-500" : "border-zinc-300"}`}>
                                {(alreadyDone || isSelected) && (
                                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                    <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </div>

                              {/* Date + meta */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium text-zinc-900">{fmtDate(o.occurrenceDate)}</span>
                                  <span className="text-xs text-zinc-400">{fmtDuration(o.durationMinutes)}</span>
                                  {future && <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-blue-50 text-blue-600">upcoming</span>}
                                  {alreadyDone && !loggedUids.has(o.uid) && <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-green-50 text-green-600">already logged</span>}
                                  {loggedUids.has(o.uid) && <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-green-50 text-green-600">✓ just logged</span>}
                                </div>
                                {o.location && <p className="text-xs text-zinc-400 mt-0.5 truncate">{o.location}</p>}
                              </div>

                              {/* Event title */}
                              <p className="text-xs text-zinc-400 truncate max-w-[180px] shrink-0">{o.summary}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action bar */}
              <div className="flex items-center justify-between bg-white border border-zinc-200 rounded-2xl px-5 py-4">
                <p className="text-sm text-zinc-600">
                  <span className="font-semibold text-zinc-900">{selectedCount}</span> occurrence{selectedCount !== 1 ? "s" : ""} selected
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const eligible = result.detected.filter((o) => !o.alreadyLogged && !loggedUids.has(o.uid) && isPast(o.occurrenceDate));
                      setSelected(new Set(eligible.map((o) => o.uid)));
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded-lg transition-colors"
                  >
                    Select all past
                  </button>
                  <button
                    onClick={handleLog}
                    disabled={logging || selectedCount === 0}
                    className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 disabled:opacity-40 transition-colors"
                  >
                    {logging ? "Logging…" : `Log ${selectedCount} 1:1${selectedCount !== 1 ? "s" : ""}`}
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
