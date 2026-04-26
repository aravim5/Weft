import { z } from "zod";
import { RowSourceSchema } from "./designer";

export const ImpactDimensionSchema = z.enum([
  "craft_quality",
  "business_outcome",
  "team_multiplier",
  "client_trust",
  "innovation",
  "delivery_reliability",
  "mentorship",
]);

export const ImpactMagnitudeSchema = z.enum([
  "small",
  "meaningful",
  "significant",
  "exceptional",
]);

export const ImpactEntryCreateSchema = z.object({
  source: RowSourceSchema.optional().default("manual_form"),
  createdBy: z.string().optional().default("owner"),
  designerId: z.string().cuid(),
  assignmentId: z.string().cuid().optional().nullable(),
  projectId: z.string().cuid().optional().nullable(),
  date: z.coerce.date(),
  dimension: ImpactDimensionSchema,
  summary: z.string().min(1),
  evidence: z.string().optional(),
  magnitude: ImpactMagnitudeSchema,
  link: z.string().url().optional().nullable(),
});

export const ImpactEntryUpdateSchema = ImpactEntryCreateSchema.partial();

export const ImpactEntrySchema = ImpactEntryCreateSchema.extend({
  id: z.string().cuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  archivedAt: z.coerce.date().optional().nullable(),
});

export type ImpactEntryCreate = z.infer<typeof ImpactEntryCreateSchema>;
export type ImpactEntryUpdate = z.infer<typeof ImpactEntryUpdateSchema>;
export type ImpactEntry = z.infer<typeof ImpactEntrySchema>;
