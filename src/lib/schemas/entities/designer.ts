import { z } from "zod";

export const RowSourceSchema = z.enum([
  "manual_form",
  "ai_extracted",
  "ai_extracted_edited",
  "imported",
]);

export const DisciplineSchema = z.enum([
  "product",
  "design_system",
  "content",
  "research",
  "visual",
]);

export const ProductAreaSchema = z.enum([
  "servicing_platforms",
  "client_platforms",
  "advisor_platforms",
  "client_onboarding",
  "advisor_core",
  "connect_core",
  "shared",
]);

export const DesignerStatusSchema = z.enum([
  "active",
  "on_leave",
  "departing",
  "departed",
]);

export const StatusVisibilitySchema = z.enum(["public", "owner_only"]);

export const DesignerCreateSchema = z.object({
  source: RowSourceSchema.optional().default("manual_form"),
  createdBy: z.string().optional().default("owner"),
  fullName: z.string().min(1),
  preferredName: z.string().optional(),
  email: z.string().email(),
  level: z.string().min(1),
  discipline: DisciplineSchema,
  productArea: ProductAreaSchema,
  secondaryProductAreas: z.string().optional().default("[]"),
  startDate: z.coerce.date(),
  managerName: z.string().optional(),
  currentStatus: DesignerStatusSchema.optional().default("active"),
  statusVisibility: StatusVisibilitySchema.optional().default("public"),
  lastWorkingDay: z.coerce.date().optional().nullable(),
  notes: z.string().optional(),
});

export const DesignerUpdateSchema = DesignerCreateSchema.partial();

export const DesignerSchema = DesignerCreateSchema.extend({
  id: z.string().cuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  archivedAt: z.coerce.date().optional().nullable(),
});

export type DesignerCreate = z.infer<typeof DesignerCreateSchema>;
export type DesignerUpdate = z.infer<typeof DesignerUpdateSchema>;
export type Designer = z.infer<typeof DesignerSchema>;
