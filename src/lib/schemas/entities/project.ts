import { z } from "zod";
import { RowSourceSchema } from "./designer";

export const ProjectStatusSchema = z.enum([
  "planned",
  "in_progress",
  "shipped",
  "dropped",
  "paused",
]);

export const ProjectCreateSchema = z.object({
  source: RowSourceSchema.optional().default("manual_form"),
  createdBy: z.string().optional().default("owner"),
  projectName: z.string().min(1),
  clientOrTeam: z.string().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
  status: ProjectStatusSchema.optional().default("in_progress"),
  description: z.string().optional(),
  strategicWeight: z.number().int().optional().nullable(),
  primaryPartnerId: z.string().cuid().optional().nullable(),
  tags: z.string().optional().default("[]"),
});

export const ProjectUpdateSchema = ProjectCreateSchema.partial();

export const ProjectSchema = ProjectCreateSchema.extend({
  id: z.string().cuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  archivedAt: z.coerce.date().optional().nullable(),
});

export type ProjectCreate = z.infer<typeof ProjectCreateSchema>;
export type ProjectUpdate = z.infer<typeof ProjectUpdateSchema>;
export type Project = z.infer<typeof ProjectSchema>;
