import { z } from "zod";
import { RowSourceSchema } from "./designer";

export const PersonalityConfidenceSchema = z.enum([
  "tentative",
  "observed",
  "confirmed",
]);

export const PersonalitySignalCreateSchema = z.object({
  source: RowSourceSchema.optional().default("manual_form"),
  createdBy: z.string().optional().default("owner"),
  designerId: z.string().cuid(),
  trait: z.string().min(1),
  evidence: z.string().min(10),
  lastUpdated: z.coerce.date().optional(),
  confidence: PersonalityConfidenceSchema,
});

export const PersonalitySignalUpdateSchema =
  PersonalitySignalCreateSchema.partial();

export const PersonalitySignalSchema = PersonalitySignalCreateSchema.extend({
  id: z.string().cuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  archivedAt: z.coerce.date().optional().nullable(),
});

export type PersonalitySignalCreate = z.infer<
  typeof PersonalitySignalCreateSchema
>;
export type PersonalitySignalUpdate = z.infer<
  typeof PersonalitySignalUpdateSchema
>;
export type PersonalitySignal = z.infer<typeof PersonalitySignalSchema>;
