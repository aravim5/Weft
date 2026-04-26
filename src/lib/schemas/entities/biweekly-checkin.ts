import { z } from "zod";
import { RowSourceSchema } from "./designer";

export const CheckinStatusSchema = z.enum([
  "upcoming",
  "in_progress",
  "complete",
  "skipped",
  "overdue",
]);

const isValidJson = (val: string) => {
  try {
    JSON.parse(val);
    return true;
  } catch {
    return false;
  }
};

export const BiweeklyCheckinCreateSchema = z.object({
  source: RowSourceSchema.optional().default("manual_form"),
  createdBy: z.string().optional().default("owner"),
  designerId: z.string().cuid(),
  biweekStart: z.coerce.date(),
  biweekEnd: z.coerce.date(),
  completedOn: z.coerce.date().optional().nullable(),
  status: CheckinStatusSchema.optional().default("upcoming"),
  sectionsTouched: z
    .string()
    .optional()
    .default("{}")
    .refine(isValidJson, { message: "sectionsTouched must be valid JSON" }),
  autoSurfacedFlags: z
    .string()
    .optional()
    .default("[]")
    .refine(isValidJson, { message: "autoSurfacedFlags must be valid JSON" }),
  notes: z.string().optional().nullable(),
});

export const BiweeklyCheckinUpdateSchema = BiweeklyCheckinCreateSchema.partial();

export const BiweeklyCheckinSchema = BiweeklyCheckinCreateSchema.extend({
  id: z.string().cuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  archivedAt: z.coerce.date().optional().nullable(),
});

export type BiweeklyCheckinCreate = z.infer<typeof BiweeklyCheckinCreateSchema>;
export type BiweeklyCheckinUpdate = z.infer<typeof BiweeklyCheckinUpdateSchema>;
export type BiweeklyCheckin = z.infer<typeof BiweeklyCheckinSchema>;
