import { z } from "zod";
import { RowSourceSchema } from "./designer";

export const QuarterSchema = z.enum(["Q1", "Q2", "Q3", "Q4"]);

export const CycleStatusSchema = z.enum([
  "planned",
  "outreach_sent",
  "collecting",
  "summarizing",
  "complete",
]);

export const ReviewCycleCreateSchema = z.object({
  source: RowSourceSchema.optional().default("manual_form"),
  createdBy: z.string().optional().default("owner"),
  year: z.number().int().min(2020).max(2100),
  quarter: QuarterSchema,
  checkinDate: z.coerce.date(),
  outreachOpenOn: z.coerce.date(),
  status: CycleStatusSchema.optional().default("planned"),
  notes: z.string().optional().nullable(),
});

export const ReviewCycleUpdateSchema = ReviewCycleCreateSchema.partial();

export const ReviewCycleSchema = ReviewCycleCreateSchema.extend({
  id: z.string().cuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  archivedAt: z.coerce.date().optional().nullable(),
});

export type ReviewCycleCreate = z.infer<typeof ReviewCycleCreateSchema>;
export type ReviewCycleUpdate = z.infer<typeof ReviewCycleUpdateSchema>;
export type ReviewCycle = z.infer<typeof ReviewCycleSchema>;
