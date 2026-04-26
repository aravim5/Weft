import { z } from "zod";
import { RowSourceSchema } from "./designer";

export const OutreachRowStatusSchema = z.enum([
  "draft",
  "approved",
  "sent",
  "responded",
  "no_response",
  "skipped",
]);

export const OutreachCreateSchema = z.object({
  source: RowSourceSchema.optional().default("manual_form"),
  createdBy: z.string().optional().default("owner"),
  cycleId: z.string().cuid(),
  designerId: z.string().cuid(),
  partnerId: z.string().cuid(),
  status: OutreachRowStatusSchema.optional().default("draft"),
  subject: z.string().optional().nullable(),
  body: z.string().optional().nullable(),
  sentOn: z.coerce.date().optional().nullable(),
  responseReceivedOn: z.coerce.date().optional().nullable(),
  responseFeedbackId: z.string().cuid().optional().nullable(),
  reminderSentOn: z.coerce.date().optional().nullable(),
  projectId: z.string().cuid().optional().nullable(),
});

export const OutreachUpdateSchema = OutreachCreateSchema.partial();

export const OutreachSchema = OutreachCreateSchema.extend({
  id: z.string().cuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  archivedAt: z.coerce.date().optional().nullable(),
});

export type OutreachCreate = z.infer<typeof OutreachCreateSchema>;
export type OutreachUpdate = z.infer<typeof OutreachUpdateSchema>;
export type Outreach = z.infer<typeof OutreachSchema>;
