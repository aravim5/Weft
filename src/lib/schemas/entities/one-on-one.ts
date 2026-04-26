import { z } from "zod";
import { RowSourceSchema } from "./designer";

export const OneOnOneMoodSchema = z.enum([
  "down",
  "flat",
  "steady",
  "up",
  "energized",
]);

export const HappinessSourceSchema = z.enum(["self_reported", "my_read"]);

export const OneOnOneCreateSchema = z.object({
  source: RowSourceSchema.optional().default("manual_form"),
  createdBy: z.string().optional().default("owner"),
  designerId: z.string().cuid(),
  date: z.coerce.date(),
  durationMinutes: z.number().int().positive().optional().nullable(),
  mood: OneOnOneMoodSchema.optional().nullable(),
  happinessIndex: z.number().int().min(1).max(10).optional().nullable(),
  happinessSource: HappinessSourceSchema.optional().nullable(),
  topicsDiscussed: z.string().min(1),
  vibeNotes: z.string().optional().nullable(),
  nextMeetingOn: z.coerce.date().optional().nullable(),
});

export const OneOnOneUpdateSchema = OneOnOneCreateSchema.partial();

export const OneOnOneSchema = OneOnOneCreateSchema.extend({
  id: z.string().cuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  archivedAt: z.coerce.date().optional().nullable(),
});

export type OneOnOneCreate = z.infer<typeof OneOnOneCreateSchema>;
export type OneOnOneUpdate = z.infer<typeof OneOnOneUpdateSchema>;
export type OneOnOne = z.infer<typeof OneOnOneSchema>;
