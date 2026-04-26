"use client";
import { useState } from "react";
import { EntityFormByType } from "@/components/forms/EntityForm";
import type { EntityType } from "@/lib/schemas/entities";
import { ENTITY_TYPES } from "@/lib/schemas/entities";

export default function DevFormTestPage() {
  const [entityType, setEntityType] = useState<EntityType>("designer");
  const [lastResult, setLastResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(data: Record<string, unknown>) {
    setError(null);
    try {
      const res = await fetch(`/api/entities/${entityType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(JSON.stringify(json, null, 2));
      } else {
        setLastResult(json.data as Record<string, unknown>);
      }
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-bold">EntityForm dev test</h1>

      <div className="space-y-2">
        <label className="text-sm font-medium">Entity type</label>
        <select
          value={entityType}
          onChange={(e) => { setEntityType(e.target.value as EntityType); setLastResult(null); setError(null); }}
          className="border rounded px-3 py-2 text-sm w-full bg-background"
        >
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="border rounded-lg p-4">
        <EntityFormByType
          entityType={entityType}
          onSubmit={handleSubmit}
          mode="create"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-800">
          <p className="font-semibold mb-1">Error</p>
          <pre className="whitespace-pre-wrap">{error}</pre>
        </div>
      )}

      {lastResult && (
        <div className="bg-green-50 border border-green-200 rounded p-4 text-sm text-green-800">
          <p className="font-semibold mb-1">Created successfully</p>
          <pre className="whitespace-pre-wrap">{JSON.stringify(lastResult, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
