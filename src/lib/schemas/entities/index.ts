// Entity schemas and types (designer.ts also exports all shared base enums: RowSourceSchema, DisciplineSchema, etc.)
export * from "./designer";
export * from "./partner";
export * from "./rubric";
export * from "./project";
export * from "./assignment";
export * from "./impact-entry";
export * from "./feedback";
export * from "./inbox-email";
export * from "./personality-signal";
export * from "./highlight";
export * from "./community-activity";
export * from "./one-on-one";
export * from "./blocker";
export * from "./action-item";
export * from "./team-concern";
export * from "./risk-signal";
export * from "./behavioral-incident";
export * from "./biweekly-checkin";
export * from "./review-cycle";
export * from "./cycle-review";
export * from "./outreach";

// Union of all entity type strings
export type EntityType =
  | "designer"
  | "partner"
  | "rubric"
  | "project"
  | "assignment"
  | "impact-entry"
  | "feedback"
  | "inbox-email"
  | "personality-signal"
  | "highlight"
  | "community-activity"
  | "one-on-one"
  | "blocker"
  | "action-item"
  | "team-concern"
  | "risk-signal"
  | "behavioral-incident"
  | "biweekly-checkin"
  | "review-cycle"
  | "cycle-review"
  | "outreach";

export const ENTITY_TYPES: EntityType[] = [
  "designer",
  "partner",
  "rubric",
  "project",
  "assignment",
  "impact-entry",
  "feedback",
  "inbox-email",
  "personality-signal",
  "highlight",
  "community-activity",
  "one-on-one",
  "blocker",
  "action-item",
  "team-concern",
  "risk-signal",
  "behavioral-incident",
  "biweekly-checkin",
  "review-cycle",
  "cycle-review",
  "outreach",
];
