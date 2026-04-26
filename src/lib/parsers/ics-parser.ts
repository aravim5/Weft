// ICS calendar parser with full RRULE (recurring event) expansion
// Matches event titles against designer names to detect 1:1 meetings

import { RRule, rrulestr } from "rrule";

export interface IcsEvent {
  uid: string;
  summary: string;
  dtstart: Date;
  dtend: Date;
  durationMinutes: number;
  location: string | null;
  description: string | null;
  isRecurring: boolean;
  rrule: string | null;
  exdates: Date[];         // cancelled occurrences
}

export interface DetectedOneOnOne {
  uid: string;
  occurrenceDate: Date;
  durationMinutes: number;
  summary: string;
  matchedDesignerName: string;
  designerId: string;
  location: string | null;
}

// ─── Low-level ICS text parser ────────────────────────────────────────────────

function parseIcsDateTime(val: string): Date {
  // Handles: 20260115T090000Z, 20260115T090000, 20260115
  const clean = val.replace(/^TZID=[^:]+:/, "").trim();
  if (/^\d{8}T\d{6}Z$/.test(clean)) {
    return new Date(
      `${clean.slice(0,4)}-${clean.slice(4,6)}-${clean.slice(6,8)}T${clean.slice(9,11)}:${clean.slice(11,13)}:${clean.slice(13,15)}Z`
    );
  }
  if (/^\d{8}T\d{6}$/.test(clean)) {
    return new Date(
      `${clean.slice(0,4)}-${clean.slice(4,6)}-${clean.slice(6,8)}T${clean.slice(9,11)}:${clean.slice(11,13)}:${clean.slice(13,15)}`
    );
  }
  if (/^\d{8}$/.test(clean)) {
    return new Date(`${clean.slice(0,4)}-${clean.slice(4,6)}-${clean.slice(6,8)}`);
  }
  return new Date(clean);
}

function parseDuration(dur: string): number {
  // PT1H, PT30M, P1DT2H, PT1H30M
  let minutes = 0;
  const dayMatch = dur.match(/(\d+)D/);
  const hourMatch = dur.match(/(\d+)H/);
  const minMatch = dur.match(/(\d+)M/);
  if (dayMatch) minutes += parseInt(dayMatch[1]) * 24 * 60;
  if (hourMatch) minutes += parseInt(hourMatch[1]) * 60;
  if (minMatch) minutes += parseInt(minMatch[1]);
  return minutes;
}

function unfoldLines(raw: string): string {
  // ICS lines can be folded with CRLF + whitespace
  return raw.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

export function parseIcs(icsText: string): IcsEvent[] {
  const unfolded = unfoldLines(icsText);
  const lines = unfolded.split(/\r?\n/);
  const events: IcsEvent[] = [];

  let inEvent = false;
  let current: Record<string, string> = {};
  const exdateLines: string[] = [];

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      current = {};
      exdateLines.length = 0;
      continue;
    }
    if (line === "END:VEVENT") {
      inEvent = false;

      const summary = current["SUMMARY"] ?? "";
      const uid = current["UID"] ?? Math.random().toString(36);

      // Parse DTSTART — may have TZID param: DTSTART;TZID=Asia/Kolkata:20260115T090000
      const dtstartRaw = current["DTSTART"] ?? "";
      const dtendRaw = current["DTEND"] ?? "";
      const durationRaw = current["DURATION"] ?? "";
      const rruleRaw = current["RRULE"] ?? null;

      let dtstart: Date;
      let dtend: Date;
      try { dtstart = parseIcsDateTime(dtstartRaw); } catch { dtstart = new Date(); }
      if (dtendRaw) {
        try { dtend = parseIcsDateTime(dtendRaw); } catch { dtend = new Date(dtstart.getTime() + 60 * 60 * 1000); }
      } else if (durationRaw) {
        const mins = parseDuration(durationRaw);
        dtend = new Date(dtstart.getTime() + mins * 60 * 1000);
      } else {
        dtend = new Date(dtstart.getTime() + 60 * 60 * 1000);
      }

      const durationMinutes = Math.round((dtend.getTime() - dtstart.getTime()) / 60000);

      // Parse EXDATEs
      const exdates = exdateLines.flatMap((line) => {
        const vals = line.replace(/^EXDATE[^:]*:/, "").split(",");
        return vals.map((v) => { try { return parseIcsDateTime(v.trim()); } catch { return null; } }).filter(Boolean) as Date[];
      });

      events.push({
        uid,
        summary,
        dtstart,
        dtend,
        durationMinutes: durationMinutes > 0 ? durationMinutes : 60,
        location: current["LOCATION"] ?? null,
        description: current["DESCRIPTION"] ?? null,
        isRecurring: !!rruleRaw,
        rrule: rruleRaw,
        exdates,
      });
      continue;
    }

    if (!inEvent) continue;

    // Handle property names with params (e.g. DTSTART;TZID=...)
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const propFull = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);
    const propName = propFull.split(";")[0].toUpperCase();

    if (propName === "EXDATE") {
      exdateLines.push(line);
    } else {
      // Store with original value including TZID for dtstart/dtend parsing
      current[propName] = propFull.includes(";") ? `${propFull.slice(propName.length)}:${value}` : value;
      // For simple props, just store value
      if (!["DTSTART", "DTEND"].includes(propName)) {
        current[propName] = value;
      }
    }
  }

  return events;
}

// ─── Expand recurring events into occurrences ─────────────────────────────────

export function expandOccurrences(
  event: IcsEvent,
  rangeStart: Date,
  rangeEnd: Date
): Date[] {
  if (!event.isRecurring || !event.rrule) {
    // Non-recurring: only include if within range
    if (event.dtstart >= rangeStart && event.dtstart <= rangeEnd) {
      return [event.dtstart];
    }
    return [];
  }

  try {
    const rruleStr = `DTSTART:${formatIcsDate(event.dtstart)}\nRRULE:${event.rrule}`;
    const rule = rrulestr(rruleStr);
    const dates = rule.between(rangeStart, rangeEnd, true);

    // Filter out EXDATEs (cancelled occurrences)
    const exdateTs = new Set(event.exdates.map((d) => d.toDateString()));
    return dates.filter((d) => !exdateTs.has(d.toDateString()));
  } catch {
    // Fallback: just use dtstart if in range
    if (event.dtstart >= rangeStart && event.dtstart <= rangeEnd) {
      return [event.dtstart];
    }
    return [];
  }
}

function formatIcsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// ─── Match events against designer names ─────────────────────────────────────

export interface Designer {
  id: string;
  fullName: string;
}

export function detectOneOnOnes(
  events: IcsEvent[],
  designers: Designer[],
  rangeStart: Date,
  rangeEnd: Date
): DetectedOneOnOne[] {
  const results: DetectedOneOnOne[] = [];

  // Build name-matching tokens for each designer
  // Match on first name, last name, or full name (case-insensitive)
  const designerTokens = designers.map((d) => ({
    designer: d,
    tokens: [
      d.fullName.toLowerCase(),
      d.fullName.split(" ")[0].toLowerCase(),   // first name
      d.fullName.split(" ").slice(-1)[0].toLowerCase(), // last name
    ].filter((t) => t.length > 2), // skip very short tokens
  }));

  for (const event of events) {
    const summaryLower = event.summary.toLowerCase();

    // Find matching designer
    const match = designerTokens.find(({ tokens }) =>
      tokens.some((token) => summaryLower.includes(token))
    );
    if (!match) continue;

    // Expand occurrences
    const occurrences = expandOccurrences(event, rangeStart, rangeEnd);
    for (const date of occurrences) {
      results.push({
        uid: `${event.uid}_${date.toISOString()}`,
        occurrenceDate: date,
        durationMinutes: event.durationMinutes,
        summary: event.summary,
        matchedDesignerName: match.designer.fullName,
        designerId: match.designer.id,
        location: event.location,
      });
    }
  }

  // Sort by date desc
  results.sort((a, b) => b.occurrenceDate.getTime() - a.occurrenceDate.getTime());
  return results;
}
