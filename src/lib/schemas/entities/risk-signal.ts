import { z } from "zod";
import { RowSourceSchema } from "./designer";

export const SignalTypeSchema = z.enum([
  "engagement_drop",
  "comp_concern",
  "growth_blocked",
  "interpersonal_friction",
  "external_opportunity",
  "personal_life_change",
]);

export const SeveritySchema = z.enum(["low", "med", "high"]);

export const RiskStatusSchema = z.enum(["open", "mitigating", "closed"]);

export const RiskSignalCreateSchema = z.object({
  source: RowSourceSchema.optional().default("manual_form"),
  createdBy: z.string().optional().default("owner"),
  designerId: z.string().cuid(),
  signalType: SignalTypeSchema,
  severity: SeveritySchema,
  evidence: z.string().min(10),
  mitigationPlan: z.string().optional().nullable(),
  detectedOn: z.coerce.date().optional(),
  status: RiskStatusSchema.optional().default("open"),
  autoDecayOn: z.coerce.date(),
  inboxEmailId: z.string().cuid().optional().nullable(),
});

export const RiskSignalUpdateSchema = RiskSignalCreateSchema.partial();

export const RiskSignalSchema = RiskSignalCreateSchema.extend({
  id: z.string().cuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  archivedAt: z.coerce.date().optional().nullable(),
});

export type RiskSignalCreate = z.infer<typeof RiskSignalCreateSchema>;
export type RiskSignalUpdate = z.infer<typeof RiskSignalUpdateSchema>;
export type RiskSignal = z.infer<typeof RiskSignalSchema>;
