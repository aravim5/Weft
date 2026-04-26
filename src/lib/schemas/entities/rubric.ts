import { z } from "zod";
import { RowSourceSchema } from "./designer";

export const RubricCreateSchema = z.object({
  source: RowSourceSchema.optional().default("manual_form"),
  createdBy: z.string().optional().default("owner"),
  version: z.string().min(1),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional().nullable(),
  dimensions: z.string().refine(
    (val) => {
      try {
        JSON.parse(val);
        return true;
      } catch {
        return false;
      }
    },
    { message: "dimensions must be valid JSON" }
  ),
  notes: z.string().optional(),
});

export const RubricUpdateSchema = RubricCreateSchema.partial();

export const RubricSchema = RubricCreateSchema.extend({
  id: z.string().cuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  archivedAt: z.coerce.date().optional().nullable(),
});

export type RubricCreate = z.infer<typeof RubricCreateSchema>;
export type RubricUpdate = z.infer<typeof RubricUpdateSchema>;
export type Rubric = z.infer<typeof RubricSchema>;
