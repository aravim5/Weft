// Maps EntityType → { prisma model delegate, create schema, update schema }
import { db } from "@/lib/db";
import type { ZodSchema } from "zod";
import {
  EntityType,
  DesignerCreateSchema, DesignerUpdateSchema,
  PartnerCreateSchema, PartnerUpdateSchema,
  RubricCreateSchema, RubricUpdateSchema,
  ProjectCreateSchema, ProjectUpdateSchema,
  AssignmentCreateSchema, AssignmentUpdateSchema,
  ImpactEntryCreateSchema, ImpactEntryUpdateSchema,
  FeedbackCreateSchema, FeedbackUpdateSchema,
  InboxEmailCreateSchema, InboxEmailUpdateSchema,
  PersonalitySignalCreateSchema, PersonalitySignalUpdateSchema,
  HighlightCreateSchema, HighlightUpdateSchema,
  CommunityActivityCreateSchema, CommunityActivityUpdateSchema,
  OneOnOneCreateSchema, OneOnOneUpdateSchema,
  BlockerCreateSchema, BlockerUpdateSchema,
  ActionItemCreateSchema, ActionItemUpdateSchema,
  TeamConcernCreateSchema, TeamConcernUpdateSchema,
  RiskSignalCreateSchema, RiskSignalUpdateSchema,
  BehavioralIncidentCreateSchema, BehavioralIncidentUpdateSchema,
  BiweeklyCheckinCreateSchema, BiweeklyCheckinUpdateSchema,
  ReviewCycleCreateSchema, ReviewCycleUpdateSchema,
  CycleReviewCreateSchema, CycleReviewUpdateSchema,
  OutreachCreateSchema, OutreachUpdateSchema,
} from "@/lib/schemas/entities";

type ModelDelegate = {
  findMany: (args?: object) => Promise<unknown[]>;
  findUnique: (args: object) => Promise<unknown>;
  create: (args: object) => Promise<unknown>;
  update: (args: object) => Promise<unknown>;
  delete: (args: object) => Promise<unknown>;
};

interface EntityConfig {
  model: ModelDelegate;
  createSchema: ZodSchema;
  updateSchema: ZodSchema;
}

export function getEntityConfig(type: EntityType): EntityConfig | null {
  const map: Record<EntityType, EntityConfig> = {
    "designer": { model: db.designer as ModelDelegate, createSchema: DesignerCreateSchema, updateSchema: DesignerUpdateSchema },
    "partner": { model: db.partner as ModelDelegate, createSchema: PartnerCreateSchema, updateSchema: PartnerUpdateSchema },
    "rubric": { model: db.rubric as ModelDelegate, createSchema: RubricCreateSchema, updateSchema: RubricUpdateSchema },
    "project": { model: db.project as ModelDelegate, createSchema: ProjectCreateSchema, updateSchema: ProjectUpdateSchema },
    "assignment": { model: db.assignment as ModelDelegate, createSchema: AssignmentCreateSchema, updateSchema: AssignmentUpdateSchema },
    "impact-entry": { model: db.impactEntry as ModelDelegate, createSchema: ImpactEntryCreateSchema, updateSchema: ImpactEntryUpdateSchema },
    "feedback": { model: db.feedback as ModelDelegate, createSchema: FeedbackCreateSchema, updateSchema: FeedbackUpdateSchema },
    "inbox-email": { model: db.inboxEmail as ModelDelegate, createSchema: InboxEmailCreateSchema, updateSchema: InboxEmailUpdateSchema },
    "personality-signal": { model: db.personalitySignal as ModelDelegate, createSchema: PersonalitySignalCreateSchema, updateSchema: PersonalitySignalUpdateSchema },
    "highlight": { model: db.highlight as ModelDelegate, createSchema: HighlightCreateSchema, updateSchema: HighlightUpdateSchema },
    "community-activity": { model: db.communityActivity as ModelDelegate, createSchema: CommunityActivityCreateSchema, updateSchema: CommunityActivityUpdateSchema },
    "one-on-one": { model: db.oneOnOne as ModelDelegate, createSchema: OneOnOneCreateSchema, updateSchema: OneOnOneUpdateSchema },
    "blocker": { model: db.blocker as ModelDelegate, createSchema: BlockerCreateSchema, updateSchema: BlockerUpdateSchema },
    "action-item": { model: db.actionItem as ModelDelegate, createSchema: ActionItemCreateSchema, updateSchema: ActionItemUpdateSchema },
    "team-concern": { model: db.teamConcern as ModelDelegate, createSchema: TeamConcernCreateSchema, updateSchema: TeamConcernUpdateSchema },
    "risk-signal": { model: db.riskSignal as ModelDelegate, createSchema: RiskSignalCreateSchema, updateSchema: RiskSignalUpdateSchema },
    "behavioral-incident": { model: db.behavioralIncident as ModelDelegate, createSchema: BehavioralIncidentCreateSchema, updateSchema: BehavioralIncidentUpdateSchema },
    "biweekly-checkin": { model: db.biweeklyCheckin as ModelDelegate, createSchema: BiweeklyCheckinCreateSchema, updateSchema: BiweeklyCheckinUpdateSchema },
    "review-cycle": { model: db.reviewCycle as ModelDelegate, createSchema: ReviewCycleCreateSchema, updateSchema: ReviewCycleUpdateSchema },
    "cycle-review": { model: db.cycleReview as ModelDelegate, createSchema: CycleReviewCreateSchema, updateSchema: CycleReviewUpdateSchema },
    "outreach": { model: db.outreach as ModelDelegate, createSchema: OutreachCreateSchema, updateSchema: OutreachUpdateSchema },
  };
  return map[type] ?? null;
}
