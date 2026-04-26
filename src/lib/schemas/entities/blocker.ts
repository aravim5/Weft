import { z } from "zod";
import { RowSourceSchema } from "./designer";

export const BlockerStatusSchema = z.enum([
  "open",
  "unblocked",
  "escalated",
  "wont_fix",
]);

export const BlockerOwnerSchema = z.enum([
  "designer",
  "you",
  "partner",
  "other",
]);

export const BlockerCreateSchema = z.object({
  source: RowSourceSchema.optional().default("manual_form"),
  createdBy: z.string().optional().default("owner"),
  designerId: z.string().cuid(),
  oneOnOneId: z.string().cuid().optional().nullable(),
  projectId: z.string().cuid().optional().nullable(),
  description: z.string().min(1),
  raisedOn: z.coerce.date().optional(),
  status: BlockerStatusSchema.optional().default("open"),
  owner: BlockerOwnerSchema.optional().default("you"),
  resolvedOn: z.coerce.date().optional().nullable(),
  resolutionNote: z.string().optional().nullable(),
});

export const BlockerUpdateSchema = BlockerCreateSchema.partial();

export const BlockerSchema = BlockerCreateSchema.extend({
  id: z.string().cuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  archivedAt: z.coerce.date().optional().nullable(),
});

export type BlockerCreate = z.infer<typeof BlockerCreateSchema>;
export type BlockerUpdate = z.infer<typeof BlockerUpdateSchema>;
export type Blocker = z.infer<typeof BlockerSchema>;
