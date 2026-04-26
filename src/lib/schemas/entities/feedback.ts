import { z } from "zod";
import { RowSourceSchema } from "./designer";

export const FeedbackSourceSchema = z.enum([
  "self",
  "peer",
  "manager",
  "project_lead",
  "client",
  "stakeholder",
]);

export const SentimentSchema = z.enum([
  "positive",
  "neutral",
  "needs_improvement",
]);

export const FeedbackThemeSchema = z.enum([
  "craft",
  "communication",
  "ownership",
  "collaboration",
  "leadership",
  "delivery",
  "growth",
]);

export const ConfidenceSchema = z.enum(["low", "medium", "high"]);

export const FeedbackCreateSchema = z.object({
  source: RowSourceSchema.optional().default("manual_form"),
  createdBy: z.string().optional().default("owner"),
  designerId: z.string().cuid(),
  feedbackSource: FeedbackSourceSchema,
  partnerId: z.string().cuid().optional().nullable(),
  sentiment: SentimentSchema,
  theme: FeedbackThemeSchema,
  summary: z.string().min(1),
  quote: z.string().optional(),
  occurredOn: z.coerce.date(),
  inboxEmailId: z.string().cuid().optional().nullable(),
  cycleId: z.string().cuid().optional().nullable(),
  confidence: ConfidenceSchema.optional().nullable(),
});

export const FeedbackUpdateSchema = FeedbackCreateSchema.partial();

export const FeedbackSchema = FeedbackCreateSchema.extend({
  id: z.string().cuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  archivedAt: z.coerce.date().optional().nullable(),
});

export type FeedbackCreate = z.infer<typeof FeedbackCreateSchema>;
export type FeedbackUpdate = z.infer<typeof FeedbackUpdateSchema>;
export type Feedback = z.infer<typeof FeedbackSchema>;
