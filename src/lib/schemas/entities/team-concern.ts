import { z } from "zod";
import { RowSourceSchema } from "./designer";

export const ConcernThemeSchema = z.enum([
  "process",
  "tooling",
  "leadership",
  "cross_team",
  "morale",
  "comp_fairness",
  "workload",
  "career_growth",
]);

export const ConcernSeveritySchema = z.enum(["low", "med", "high"]);

export const ConcernStatusSchema = z.enum([
  "noted",
  "acting",
  "resolved",
  "archived",
]);

export const TeamConcernCreateSchema = z.object({
  source: RowSourceSchema.optional().default("manual_form"),
  createdBy: z.string().optional().default("owner"),
  raisedByDesignerId: z.string().cuid(),
  oneOnOneId: z.string().cuid().optional().nullable(),
  concern: z.string().min(1),
  theme: ConcernThemeSchema,
  severity: ConcernSeveritySchema,
  status: ConcernStatusSchema.optional().default("noted"),
  actionTaken: z.string().optional().nullable(),
  occurredOn: z.coerce.date(),
});

export const TeamConcernUpdateSchema = TeamConcernCreateSchema.partial();

export const TeamConcernSchema = TeamConcernCreateSchema.extend({
  id: z.string().cuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  archivedAt: z.coerce.date().optional().nullable(),
});

export type TeamConcernCreate = z.infer<typeof TeamConcernCreateSchema>;
export type TeamConcernUpdate = z.infer<typeof TeamConcernUpdateSchema>;
export type TeamConcern = z.infer<typeof TeamConcernSchema>;
