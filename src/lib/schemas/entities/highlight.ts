import { z } from "zod";
import { RowSourceSchema } from "./designer";

export const HighlightKindSchema = z.enum([
  "standout_work",
  "kudos",
  "community",
  "mentorship",
  "speaking",
  "learning",
  "small_win",
  "big_win",
]);

export const WinSizeSchema = z.enum(["small", "big"]);

export const VisibilitySchema = z.enum(["internal", "external"]);

export const HighlightCreateSchema = z.object({
  source: RowSourceSchema.optional().default("manual_form"),
  createdBy: z.string().optional().default("owner"),
  designerId: z.string().cuid(),
  kind: HighlightKindSchema,
  size: WinSizeSchema.optional().nullable(),
  description: z.string().min(1),
  occurredOn: z.coerce.date(),
  visibility: VisibilitySchema.optional().default("internal"),
  evidenceLink: z.string().url().optional().nullable(),
  inboxEmailId: z.string().cuid().optional().nullable(),
});

export const HighlightUpdateSchema = HighlightCreateSchema.partial();

export const HighlightSchema = HighlightCreateSchema.extend({
  id: z.string().cuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  archivedAt: z.coerce.date().optional().nullable(),
});

export type HighlightCreate = z.infer<typeof HighlightCreateSchema>;
export type HighlightUpdate = z.infer<typeof HighlightUpdateSchema>;
export type Highlight = z.infer<typeof HighlightSchema>;
