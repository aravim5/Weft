import { z } from "zod";
import { RowSourceSchema } from "./designer";

export const ActivityKindSchema = z.enum([
  "design_jam",
  "book_club",
  "portfolio_review",
  "meetup",
  "brownbag",
  "hack_day",
  "mentorship_circle",
]);

export const ParticipationRoleSchema = z.enum([
  "organizer",
  "presenter",
  "attendee",
]);

export const CommunityActivityCreateSchema = z.object({
  source: RowSourceSchema.optional().default("manual_form"),
  createdBy: z.string().optional().default("owner"),
  designerId: z.string().cuid().optional().nullable(),
  activity: ActivityKindSchema,
  title: z.string().min(1),
  date: z.coerce.date(),
  role: ParticipationRoleSchema.optional().nullable(),
  notes: z.string().optional(),
});

export const CommunityActivityUpdateSchema =
  CommunityActivityCreateSchema.partial();

export const CommunityActivitySchema = CommunityActivityCreateSchema.extend({
  id: z.string().cuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  archivedAt: z.coerce.date().optional().nullable(),
});

export type CommunityActivityCreate = z.infer<
  typeof CommunityActivityCreateSchema
>;
export type CommunityActivityUpdate = z.infer<
  typeof CommunityActivityUpdateSchema
>;
export type CommunityActivity = z.infer<typeof CommunityActivitySchema>;
