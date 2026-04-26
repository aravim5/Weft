import { z } from "zod";
import { RowSourceSchema } from "./designer";

export const EmailStatusSchema = z.enum(["new", "processed", "archived"]);

export const InboxEmailCreateSchema = z.object({
  source: RowSourceSchema.optional().default("manual_form"),
  createdBy: z.string().optional().default("owner"),
  pastedOn: z.coerce.date().optional(),
  senderName: z.string().optional().nullable(),
  senderEmail: z.string().email().optional().nullable(),
  subject: z.string().optional().nullable(),
  body: z.string().min(1),
  receivedOn: z.coerce.date().optional().nullable(),
  relatedDesignerIds: z.string().optional().default("[]"),
  relatedProjectId: z.string().cuid().optional().nullable(),
  status: EmailStatusSchema.optional().default("new"),
  rawHash: z.string().min(1),
});

export const InboxEmailUpdateSchema = InboxEmailCreateSchema.partial();

export const InboxEmailSchema = InboxEmailCreateSchema.extend({
  id: z.string().cuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type InboxEmailCreate = z.infer<typeof InboxEmailCreateSchema>;
export type InboxEmailUpdate = z.infer<typeof InboxEmailUpdateSchema>;
export type InboxEmail = z.infer<typeof InboxEmailSchema>;
