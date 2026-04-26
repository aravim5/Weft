import type { ZodSchema } from "zod";
import type { EntityType } from "./entities";
import {
  DesignerCreateSchema, PartnerCreateSchema, RubricCreateSchema,
  ProjectCreateSchema, AssignmentCreateSchema, ImpactEntryCreateSchema,
  FeedbackCreateSchema, InboxEmailCreateSchema, PersonalitySignalCreateSchema,
  HighlightCreateSchema, CommunityActivityCreateSchema, OneOnOneCreateSchema,
  BlockerCreateSchema, ActionItemCreateSchema, TeamConcernCreateSchema,
  RiskSignalCreateSchema, BehavioralIncidentCreateSchema,
  BiweeklyCheckinCreateSchema, ReviewCycleCreateSchema,
  CycleReviewCreateSchema, OutreachCreateSchema,
} from "./entities";

const CREATE_SCHEMA_MAP: Record<EntityType, ZodSchema> = {
  "designer": DesignerCreateSchema,
  "partner": PartnerCreateSchema,
  "rubric": RubricCreateSchema,
  "project": ProjectCreateSchema,
  "assignment": AssignmentCreateSchema,
  "impact-entry": ImpactEntryCreateSchema,
  "feedback": FeedbackCreateSchema,
  "inbox-email": InboxEmailCreateSchema,
  "personality-signal": PersonalitySignalCreateSchema,
  "highlight": HighlightCreateSchema,
  "community-activity": CommunityActivityCreateSchema,
  "one-on-one": OneOnOneCreateSchema,
  "blocker": BlockerCreateSchema,
  "action-item": ActionItemCreateSchema,
  "team-concern": TeamConcernCreateSchema,
  "risk-signal": RiskSignalCreateSchema,
  "behavioral-incident": BehavioralIncidentCreateSchema,
  "biweekly-checkin": BiweeklyCheckinCreateSchema,
  "review-cycle": ReviewCycleCreateSchema,
  "cycle-review": CycleReviewCreateSchema,
  "outreach": OutreachCreateSchema,
};

export function getCreateSchema(type: EntityType): ZodSchema | null {
  return CREATE_SCHEMA_MAP[type] ?? null;
}
