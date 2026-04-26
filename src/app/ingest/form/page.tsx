"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ENTITY_TYPES, type EntityType } from "@/lib/schemas/entities";
import { EntityFormByType } from "@/components/forms/EntityForm";

const ENTITY_LABELS: Record<EntityType, string> = {
  "designer": "Designer",
  "partner": "Partner",
  "rubric": "Rubric",
  "project": "Project",
  "assignment": "Assignment",
  "impact-entry": "Impact Entry",
  "feedback": "Feedback",
  "inbox-email": "Inbox Email",
  "personality-signal": "Personality Signal",
  "highlight": "Highlight",
  "community-activity": "Community Activity",
  "one-on-one": "1:1",
  "blocker": "Blocker",
  "action-item": "Action Item",
  "team-concern": "Team Concern",
  "risk-signal": "Risk Signal",
  "behavioral-incident": "Behavioral Incident",
  "biweekly-checkin": "Biweekly Check-in",
  "review-cycle": "Review Cycle",
  "cycle-review": "Cycle Review",
  "outreach": "Outreach",
};

export default function IngestFormPage() {
  const [entityType, setEntityType] = useState<EntityType>("feedback");
  const [lastResult, setLastResult] = useState<{ id: string; type: EntityType } | null>(null);

  async function handleSubmit(data: Record<string, unknown>) {
    const res = await fetch(`/api/entities/${entityType}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) {
      const msg = json.error ?? JSON.stringify(json);
      toast.error(`Failed to save: ${msg}`);
      throw new Error(msg);
    }
    const id = json.data?.id ?? json.id;
    setLastResult({ id, type: entityType });
    toast.success(`${ENTITY_LABELS[entityType]} saved`);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Manual Entry</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create any entity directly without AI extraction.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Entity type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label>Select entity</Label>
            <select
              className="w-full border rounded-md px-3 py-1.5 text-sm bg-background"
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value as EntityType);
                setLastResult(null);
              }}
            >
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>{ENTITY_LABELS[t] ?? t}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{ENTITY_LABELS[entityType] ?? entityType}</CardTitle>
        </CardHeader>
        <CardContent>
          <EntityFormByType
            key={entityType}
            entityType={entityType}
            onSubmit={handleSubmit}
          />
        </CardContent>
      </Card>

      {lastResult && (
        <p className="text-sm text-muted-foreground text-center">
          Last saved: {ENTITY_LABELS[lastResult.type]} (id: {lastResult.id})
        </p>
      )}
    </div>
  );
}
