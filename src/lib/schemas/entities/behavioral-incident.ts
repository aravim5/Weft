import { z } from "zod";
import { RowSourceSchema } from "./designer";

export const IncidentSeveritySchema = z.enum(["minor", "moderate", "serious"]);

export const BehavioralIncidentCreateSchema = z.object({
  source: RowSourceSchema.optional().default("manual_form"),
  createdBy: z.string().optional().default("owner"),
  designerId: z.string().cuid(),
  description: z.string().min(10),
  severity: IncidentSeveritySchema,
  actionTaken: z.string().min(1),
  occurredOn: z.coerce.date(),
  resolved: z.boolean().optional().default(false),
  resolvedOn: z.coerce.date().optional().nullable(),
});

export const BehavioralIncidentUpdateSchema =
  BehavioralIncidentCreateSchema.partial();

export const BehavioralIncidentSchema = BehavioralIncidentCreateSchema.extend({
  id: z.string().cuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  archivedAt: z.coerce.date().optional().nullable(),
});

export type BehavioralIncidentCreate = z.infer<
  typeof BehavioralIncidentCreateSchema
>;
export type BehavioralIncidentUpdate = z.infer<
  typeof BehavioralIncidentUpdateSchema
>;
export type BehavioralIncident = z.infer<typeof BehavioralIncidentSchema>;
