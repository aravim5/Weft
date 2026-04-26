import { z } from "zod";
import { RowSourceSchema } from "./designer";

export const ActionStatusSchema = z.enum([
  "open",
  "in_progress",
  "done",
  "dropped",
  "snoozed",
]);

export const ActionItemCreateSchema = z.object({
  source: RowSourceSchema.optional().default("manual_form"),
  createdBy: z.string().optional().default("owner"),
  designerId: z.string().cuid().optional().nullable(),
  oneOnOneId: z.string().cuid().optional().nullable(),
  description: z.string().min(1),
  dueDate: z.coerce.date().optional().nullable(),
  status: ActionStatusSchema.optional().default("open"),
  completedOn: z.coerce.date().optional().nullable(),
  snoozedUntil: z.coerce.date().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const ActionItemUpdateSchema = ActionItemCreateSchema.partial();

export const ActionItemSchema = ActionItemCreateSchema.extend({
  id: z.string().cuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  archivedAt: z.coerce.date().optional().nullable(),
});

export type ActionItemCreate = z.infer<typeof ActionItemCreateSchema>;
export type ActionItemUpdate = z.infer<typeof ActionItemUpdateSchema>;
export type ActionItem = z.infer<typeof ActionItemSchema>;
