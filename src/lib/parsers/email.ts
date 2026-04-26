// Email parser — strips quoted replies, extracts headers
import { simpleParser, type ParsedMail } from "mailparser";
import crypto from "crypto";

export interface ParsedEmail {
  senderName: string | null;
  senderEmail: string | null;
  subject: string | null;
  receivedOn: string | null; // ISO date string
  body: string; // cleaned text body
  rawHash: string; // sha256 of normalized body — for dedup
}

export async function parseRawEmail(raw: string): Promise<ParsedEmail> {
  let parsed: ParsedMail;
  try {
    parsed = await simpleParser(raw);
  } catch {
    // Not a valid MIME email — treat as plain text paste
    return parsePlainText(raw);
  }

  const from = parsed.from?.value?.[0];
  const senderName = from?.name || null;
  const senderEmail = from?.address || null;
  const subject = parsed.subject ?? null;
  const date = parsed.date ? parsed.date.toISOString().slice(0, 10) : null;
  const body = (parsed.text ?? raw).trim();

  return {
    senderName,
    senderEmail,
    subject,
    receivedOn: date,
    body,
    rawHash: hashBody(body),
  };
}

function parsePlainText(raw: string): ParsedEmail {
  const lines = raw.split("\n");
  const headers: Record<string, string> = {};
  let bodyStart = 0;

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i];
    if (/^From:/i.test(line)) { headers.from = line.replace(/^From:\s*/i, "").trim(); bodyStart = i + 1; }
    else if (/^Subject:/i.test(line)) { headers.subject = line.replace(/^Subject:\s*/i, "").trim(); bodyStart = i + 1; }
    else if (/^Date:/i.test(line)) { headers.date = line.replace(/^Date:\s*/i, "").trim(); bodyStart = i + 1; }
    else if (line.trim() === "" && Object.keys(headers).length > 0) { bodyStart = i + 1; break; }
  }

  const fromMatch = headers.from?.match(/^(.+?)\s*<([^>]+)>/);
  const senderName = fromMatch ? fromMatch[1].trim() : headers.from ?? null;
  const senderEmail = fromMatch ? fromMatch[2] : null;
  const body = lines.slice(bodyStart).join("\n").trim();

  return {
    senderName,
    senderEmail,
    subject: headers.subject ?? null,
    receivedOn: headers.date ? tryParseDate(headers.date) : null,
    body: body || raw.trim(),
    rawHash: hashBody(body || raw.trim()),
  };
}

function hashBody(body: string): string {
  return crypto.createHash("sha256").update(body.replace(/\s+/g, " ").trim()).digest("hex");
}

function tryParseDate(s: string): string | null {
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  } catch { return null; }
}
