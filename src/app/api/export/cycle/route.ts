// GET /api/export/cycle?id=[cycleId] — CSV export of all cycle reviews for a cycle
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const cycleId = req.nextUrl.searchParams.get("id");
  if (!cycleId) {
    return NextResponse.json({ error: "Missing ?id=" }, { status: 400 });
  }

  const cycle = await db.reviewCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) return NextResponse.json({ error: "Cycle not found" }, { status: 404 });

  const reviews = await db.cycleReview.findMany({
    where: { cycleId, archivedAt: null },
    include: {
      designer: {
        select: { fullName: true, level: true, productArea: true },
      },
    },
    orderBy: { designer: { fullName: "asc" } },
  });

  type ReviewRow = {
    Name: string;
    Level: string;
    "Product Area": string;
    Quarter: string;
    Year: number;
    Status: string;
    "Signed Off": string;
    "Rubric Version": string;
    Summary: string;
    Strengths: string;
    Improvements: string;
    "Risk Watch": string;
    "Continuity Note": string;
  };

  const rows: ReviewRow[] = reviews.map((r) => {
    let rubricRatings = "";
    try {
      const parsed = JSON.parse(r.rubricRating ?? "{}") as Record<string, unknown>;
      rubricRatings = Object.entries(parsed)
        .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
        .join("; ");
    } catch {
      rubricRatings = r.rubricRating ?? "";
    }

    return {
      Name: r.designer.fullName,
      Level: r.designer.level,
      "Product Area": r.designer.productArea.replace(/_/g, " "),
      Quarter: cycle.quarter,
      Year: cycle.year,
      Status: r.finalStatus,
      "Signed Off": r.signedOffOn ? new Date(r.signedOffOn).toLocaleDateString() : "—",
      "Rubric Version": r.rubricVersion,
      Summary: (r.summaryMarkdown ?? "").replace(/\n/g, " ").replace(/"/g, "'"),
      Strengths: (r.strengthsMarkdown ?? "").replace(/\n/g, " ").replace(/"/g, "'"),
      Improvements: (r.improvementsMarkdown ?? "").replace(/\n/g, " ").replace(/"/g, "'"),
      "Risk Watch": (r.riskWatch ?? "").replace(/\n/g, " "),
      "Continuity Note": (r.continuityNote ?? "").replace(/\n/g, " "),
    };
  });

  if (rows.length === 0) {
    return new NextResponse("No reviews", { status: 204 });
  }

  const headers = Object.keys(rows[0]) as (keyof ReviewRow)[];
  const csvLines = [
    headers.join(","),
    ...rows.map((r) =>
      headers
        .map((h) => {
          const val = String(r[h] ?? "");
          return val.includes(",") || val.includes('"') ? `"${val}"` : val;
        })
        .join(",")
    ),
  ];

  const filename = `cycle-${cycle.quarter}-${cycle.year}-reviews-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csvLines.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
