import { z } from "zod";
import { RowSourceSchema } from "./designer";

export const OutreachStatusSchema = z.enum([
  "not_started",
  "drafts_ready",
  "sent",
  "responses_in",
  "closed",
]);

export const ReviewFinalStatusSchema = z.enum(["draft", "signed_off"]);

export const CycleReviewCreateSchema = z.object({
  source: RowSourceSchema.optional().default("manual_form"),
  createdBy: z.string().optional().default("owner"),
  designerId: z.string().cuid(),
  cycleId: z.string().cuid(),
  rubricVersion: z.string().min(1),
  outreachStatus: OutreachStatusSchema.optional().default("not_started"),
  summaryMarkdown: z.string().optional().nullable(),
  strengthsMarkdown: z.string().optional().nullable(),
  improvementsMarkdown: z.string().optional().nullable(),
  rubricRating: z
    .string()
    .optional()
    .nullable()
    .refine(
      (val) => {
        if (val === null || val === undefined) return true;
        try {
          JSON.parse(val);
          return true;
        } catch {
          return false;
        }
      },
      { message: "rubricRating must be valid JSON when provided" }
    ),
  riskWatch: z.string().optional().nullable(),
  continuityNote: z.string().optional().nullable(),
  finalStatus: ReviewFinalStatusSchema.optional().default("draft"),
  signedOffOn: z.coerce.date().optional().nullable(),
  exportedPdfPath: z.string().optional().nullable(),
});

export const CycleReviewUpdateSchema = CycleReviewCreateSchema.partial();

export const CycleReviewSchema = CycleReviewCreateSchema.extend({
  id: z.string().cuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  archivedAt: z.coerce.date().optional().nullable(),
});

export type CycleReviewCreate = z.infer<typeof CycleReviewCreateSchema>;
export type CycleReviewUpdate = z.infer<typeof CycleReviewUpdateSchema>;
export type CycleReview = z.infer<typeof CycleReviewSchema>;
