import { z } from "zod";
import { RowSourceSchema } from "./designer";

export const AssignmentRoleSchema = z.enum([
  "lead",
  "contributor",
  "support",
  "reviewer",
]);

export const AssignmentCreateSchema = z.object({
  source: RowSourceSchema.optional().default("manual_form"),
  createdBy: z.string().optional().default("owner"),
  designerId: z.string().cuid(),
  projectId: z.string().cuid(),
  role: AssignmentRoleSchema,
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
  partnerIds: z.string().optional().default("[]"),
  notes: z.string().optional(),
});

export const AssignmentUpdateSchema = AssignmentCreateSchema.partial();

export const AssignmentSchema = AssignmentCreateSchema.extend({
  id: z.string().cuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  archivedAt: z.coerce.date().optional().nullable(),
});

export type AssignmentCreate = z.infer<typeof AssignmentCreateSchema>;
export type AssignmentUpdate = z.infer<typeof AssignmentUpdateSchema>;
export type Assignment = z.infer<typeof AssignmentSchema>;
