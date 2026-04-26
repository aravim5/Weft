"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function PrepBriefPage() {
  const { designerId } = useParams<{ designerId: string }>();
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [designerName, setDesignerName] = useState("");

  const generate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/one-on-ones/prep/${designerId}`);
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed"); return; }
      setMarkdown(data.markdown);
      if (data.aiDisabled) toast.info("AI disabled — showing placeholder brief.");
    } catch (err) {
      toast.error(String(err));
    } finally { setLoading(false); }
  }, [designerId]);

  useEffect(() => {
    fetch(`/api/entities/designer/${designerId}`)
      .then((r) => r.json())
      .then((d) => setDesignerName(d.data?.fullName ?? ""))
      .catch(() => {});
    generate();
  }, [designerId, generate]);

  function copyMarkdown() {
    if (!markdown) return;
    navigator.clipboard.writeText(markdown).then(() => toast.success("Copied to clipboard"));
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4 print:px-0 print:py-0">
      {/* Actions — hidden on print */}
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/designers/${designerId}`} className="text-xs text-muted-foreground hover:underline">← {designerName || "Designer"}</Link>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyMarkdown} disabled={!markdown}>Copy markdown</Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>Print</Button>
          <Button size="sm" onClick={generate} disabled={loading}>{loading ? "Generating…" : "Regenerate"}</Button>
        </div>
      </div>

      {loading && !markdown && (
        <div className="py-16 text-center text-sm text-muted-foreground">Generating brief…</div>
      )}

      {markdown && (
        <article className="prose prose-sm max-w-none dark:prose-invert print:prose-xs">
          {markdown.split("\n").map((line, i) => {
            if (line.startsWith("# ")) return <h1 key={i} className="text-xl font-bold mt-0">{line.slice(2)}</h1>;
            if (line.startsWith("## ")) return <h2 key={i} className="text-base font-semibold mt-5 mb-1 border-b pb-1">{line.slice(3)}</h2>;
            if (line.startsWith("- ") || line.startsWith("* ")) return <li key={i} className="ml-4 text-sm">{line.slice(2)}</li>;
            if (line.trim() === "") return <div key={i} className="h-2" />;
            return <p key={i} className="text-sm">{line}</p>;
          })}
        </article>
      )}

      <style>{`@media print { .print\\:hidden { display: none !important; } }`}</style>
    </div>
  );
}
