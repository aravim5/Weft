import { z } from "zod";
import { RowSourceSchema } from "./designer";

export const PartnerRoleSchema = z.enum([
  "project_lead",
  "engineering_manager",
  "product_manager",
  "client",
  "peer_designer",
  "cross_functional",
]);

export const PartnerCreateSchema = z.object({
  source: RowSourceSchema.optional().default("manual_form"),
  createdBy: z.string().optional().default("owner"),
  fullName: z.string().min(1),
  email: z.string().email(),
  role: PartnerRoleSchema,
  orgOrTeam: z.string().optional(),
  active: z.boolean().optional().default(true),
  lastOutreachOn: z.coerce.date().optional().nullable(),
  responseRate: z.number().min(0).max(1).optional().nullable(),
  notes: z.string().optional(),
});

export const PartnerUpdateSchema = PartnerCreateSchema.partial();

export const PartnerSchema = PartnerCreateSchema.extend({
  id: z.string().cuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  archivedAt: z.coerce.date().optional().nullable(),
});

export type PartnerCreate = z.infer<typeof PartnerCreateSchema>;
export type PartnerUpdate = z.infer<typeof PartnerUpdateSchema>;
export type Partner = z.infer<typeof PartnerSchema>;
