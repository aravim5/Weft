// Parse CSV / XLSX / PDF uploads into plain text for AI extraction
import Papa from "papaparse";
import * as XLSX from "xlsx";

export type ParsedFile = {
  text: string;
  mimeType: string;
  originalName: string;
};

export async function parseUploadedFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
): Promise<ParsedFile> {
  const ext = originalName.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "csv" || mimeType === "text/csv") {
    const text = buffer.toString("utf-8");
    const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
    const rows = result.data as string[][];
    const plain = rows.map((row) => row.join("\t")).join("\n");
    return { text: plain, mimeType, originalName };
  }

  if (ext === "xlsx" || ext === "xls" || mimeType.includes("spreadsheet") || mimeType.includes("excel")) {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const parts: string[] = [];
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(ws, { skipHidden: true });
      if (csv.trim()) parts.push(`## Sheet: ${sheetName}\n${csv}`);
    }
    return { text: parts.join("\n\n"), mimeType, originalName };
  }

  if (ext === "pdf" || mimeType === "application/pdf") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParse: any = (await import("pdf-parse"));
    const data = await (pdfParse.default ?? pdfParse)(buffer);
    return { text: data.text, mimeType, originalName };
  }

  if (ext === "txt" || mimeType.startsWith("text/")) {
    return { text: buffer.toString("utf-8"), mimeType, originalName };
  }

  throw new Error(`Unsupported file type: ${ext || mimeType}. Supported: csv, xlsx, pdf, txt.`);
}
