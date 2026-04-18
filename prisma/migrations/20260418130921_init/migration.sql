-- CreateTable
CREATE TABLE "Designer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual_form',
    "createdBy" TEXT NOT NULL DEFAULT 'owner',
    "fullName" TEXT NOT NULL,
    "preferredName" TEXT,
    "email" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "productArea" TEXT NOT NULL,
    "secondaryProductAreas" TEXT NOT NULL DEFAULT '[]',
    "startDate" DATETIME NOT NULL,
    "managerName" TEXT,
    "currentStatus" TEXT NOT NULL DEFAULT 'active',
    "statusVisibility" TEXT NOT NULL DEFAULT 'public',
    "lastWorkingDay" DATETIME,
    "notes" TEXT,
    "archivedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual_form',
    "createdBy" TEXT NOT NULL DEFAULT 'owner',
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "orgOrTeam" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastOutreachOn" DATETIME,
    "responseRate" REAL,
    "notes" TEXT,
    "archivedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Rubric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual_form',
    "createdBy" TEXT NOT NULL DEFAULT 'owner',
    "version" TEXT NOT NULL,
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "dimensions" TEXT NOT NULL,
    "notes" TEXT,
    "archivedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual_form',
    "createdBy" TEXT NOT NULL DEFAULT 'owner',
    "projectName" TEXT NOT NULL,
    "clientOrTeam" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "description" TEXT,
    "strategicWeight" INTEGER,
    "primaryPartnerId" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "archivedAt" DATETIME,
    CONSTRAINT "Project_primaryPartnerId_fkey" FOREIGN KEY ("primaryPartnerId") REFERENCES "Partner" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual_form',
    "createdBy" TEXT NOT NULL DEFAULT 'owner',
    "designerId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "partnerIds" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "archivedAt" DATETIME,
    CONSTRAINT "Assignment_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "Designer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Assignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImpactEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual_form',
    "createdBy" TEXT NOT NULL DEFAULT 'owner',
    "designerId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "projectId" TEXT,
    "date" DATETIME NOT NULL,
    "dimension" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "evidence" TEXT,
    "magnitude" TEXT NOT NULL,
    "link" TEXT,
    "archivedAt" DATETIME,
    CONSTRAINT "ImpactEntry_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "Designer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ImpactEntry_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ImpactEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual_form',
    "createdBy" TEXT NOT NULL DEFAULT 'owner',
    "designerId" TEXT NOT NULL,
    "feedbackSource" TEXT NOT NULL,
    "partnerId" TEXT,
    "sentiment" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "quote" TEXT,
    "occurredOn" DATETIME NOT NULL,
    "inboxEmailId" TEXT,
    "cycleId" TEXT,
    "confidence" TEXT,
    "archivedAt" DATETIME,
    CONSTRAINT "Feedback_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "Designer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Feedback_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Feedback_inboxEmailId_fkey" FOREIGN KEY ("inboxEmailId") REFERENCES "InboxEmail" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Feedback_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ReviewCycle" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InboxEmail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual_form',
    "createdBy" TEXT NOT NULL DEFAULT 'owner',
    "pastedOn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "senderName" TEXT,
    "senderEmail" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "receivedOn" DATETIME,
    "relatedDesignerIds" TEXT NOT NULL DEFAULT '[]',
    "relatedProjectId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "rawHash" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "PersonalitySignal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual_form',
    "createdBy" TEXT NOT NULL DEFAULT 'owner',
    "designerId" TEXT NOT NULL,
    "trait" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidence" TEXT NOT NULL,
    "archivedAt" DATETIME,
    CONSTRAINT "PersonalitySignal_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "Designer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Highlight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual_form',
    "createdBy" TEXT NOT NULL DEFAULT 'owner',
    "designerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "size" TEXT,
    "description" TEXT NOT NULL,
    "occurredOn" DATETIME NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'internal',
    "evidenceLink" TEXT,
    "inboxEmailId" TEXT,
    "archivedAt" DATETIME,
    CONSTRAINT "Highlight_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "Designer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Highlight_inboxEmailId_fkey" FOREIGN KEY ("inboxEmailId") REFERENCES "InboxEmail" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommunityActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual_form',
    "createdBy" TEXT NOT NULL DEFAULT 'owner',
    "designerId" TEXT,
    "activity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "role" TEXT,
    "notes" TEXT,
    "archivedAt" DATETIME,
    CONSTRAINT "CommunityActivity_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "Designer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OneOnOne" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual_form',
    "createdBy" TEXT NOT NULL DEFAULT 'owner',
    "designerId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "durationMinutes" INTEGER,
    "mood" TEXT,
    "happinessIndex" INTEGER,
    "happinessSource" TEXT,
    "topicsDiscussed" TEXT NOT NULL,
    "vibeNotes" TEXT,
    "nextMeetingOn" DATETIME,
    "archivedAt" DATETIME,
    CONSTRAINT "OneOnOne_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "Designer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Blocker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual_form',
    "createdBy" TEXT NOT NULL DEFAULT 'owner',
    "designerId" TEXT NOT NULL,
    "oneOnOneId" TEXT,
    "projectId" TEXT,
    "description" TEXT NOT NULL,
    "raisedOn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'open',
    "owner" TEXT NOT NULL DEFAULT 'you',
    "resolvedOn" DATETIME,
    "resolutionNote" TEXT,
    "archivedAt" DATETIME,
    CONSTRAINT "Blocker_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "Designer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Blocker_oneOnOneId_fkey" FOREIGN KEY ("oneOnOneId") REFERENCES "OneOnOne" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Blocker_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual_form',
    "createdBy" TEXT NOT NULL DEFAULT 'owner',
    "designerId" TEXT,
    "oneOnOneId" TEXT,
    "description" TEXT NOT NULL,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'open',
    "completedOn" DATETIME,
    "snoozedUntil" DATETIME,
    "notes" TEXT,
    "archivedAt" DATETIME,
    CONSTRAINT "ActionItem_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "Designer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ActionItem_oneOnOneId_fkey" FOREIGN KEY ("oneOnOneId") REFERENCES "OneOnOne" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamConcern" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual_form',
    "createdBy" TEXT NOT NULL DEFAULT 'owner',
    "raisedByDesignerId" TEXT NOT NULL,
    "oneOnOneId" TEXT,
    "concern" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'noted',
    "actionTaken" TEXT,
    "occurredOn" DATETIME NOT NULL,
    "archivedAt" DATETIME,
    CONSTRAINT "TeamConcern_raisedByDesignerId_fkey" FOREIGN KEY ("raisedByDesignerId") REFERENCES "Designer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeamConcern_oneOnOneId_fkey" FOREIGN KEY ("oneOnOneId") REFERENCES "OneOnOne" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RiskSignal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual_form',
    "createdBy" TEXT NOT NULL DEFAULT 'owner',
    "designerId" TEXT NOT NULL,
    "signalType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "mitigationPlan" TEXT,
    "detectedOn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'open',
    "autoDecayOn" DATETIME NOT NULL,
    "inboxEmailId" TEXT,
    "archivedAt" DATETIME,
    CONSTRAINT "RiskSignal_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "Designer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RiskSignal_inboxEmailId_fkey" FOREIGN KEY ("inboxEmailId") REFERENCES "InboxEmail" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BehavioralIncident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual_form',
    "createdBy" TEXT NOT NULL DEFAULT 'owner',
    "designerId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "actionTaken" TEXT NOT NULL,
    "occurredOn" DATETIME NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedOn" DATETIME,
    "archivedAt" DATETIME,
    CONSTRAINT "BehavioralIncident_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "Designer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BiweeklyCheckin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual_form',
    "createdBy" TEXT NOT NULL DEFAULT 'owner',
    "designerId" TEXT NOT NULL,
    "biweekStart" DATETIME NOT NULL,
    "biweekEnd" DATETIME NOT NULL,
    "completedOn" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "sectionsTouched" TEXT NOT NULL DEFAULT '{}',
    "autoSurfacedFlags" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "archivedAt" DATETIME,
    CONSTRAINT "BiweeklyCheckin_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "Designer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewCycle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual_form',
    "createdBy" TEXT NOT NULL DEFAULT 'owner',
    "year" INTEGER NOT NULL,
    "quarter" TEXT NOT NULL,
    "checkinDate" DATETIME NOT NULL,
    "outreachOpenOn" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "notes" TEXT,
    "archivedAt" DATETIME
);

-- CreateTable
CREATE TABLE "CycleReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual_form',
    "createdBy" TEXT NOT NULL DEFAULT 'owner',
    "designerId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "rubricVersion" TEXT NOT NULL,
    "outreachStatus" TEXT NOT NULL DEFAULT 'not_started',
    "summaryMarkdown" TEXT,
    "strengthsMarkdown" TEXT,
    "improvementsMarkdown" TEXT,
    "rubricRating" TEXT,
    "riskWatch" TEXT,
    "continuityNote" TEXT,
    "finalStatus" TEXT NOT NULL DEFAULT 'draft',
    "signedOffOn" DATETIME,
    "exportedPdfPath" TEXT,
    "archivedAt" DATETIME,
    CONSTRAINT "CycleReview_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "Designer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CycleReview_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ReviewCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CycleReview_rubricVersion_fkey" FOREIGN KEY ("rubricVersion") REFERENCES "Rubric" ("version") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Outreach" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual_form',
    "createdBy" TEXT NOT NULL DEFAULT 'owner',
    "cycleId" TEXT NOT NULL,
    "designerId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "subject" TEXT,
    "body" TEXT,
    "sentOn" DATETIME,
    "responseReceivedOn" DATETIME,
    "responseFeedbackId" TEXT,
    "reminderSentOn" DATETIME,
    "projectId" TEXT,
    "archivedAt" DATETIME,
    CONSTRAINT "Outreach_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ReviewCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Outreach_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "Designer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Outreach_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Outreach_responseFeedbackId_fkey" FOREIGN KEY ("responseFeedbackId") REFERENCES "Feedback" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Outreach_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "designerId" TEXT,
    "jobName" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "inputHash" TEXT,
    "outputHash" TEXT,
    "proposed" TEXT,
    "finalAccepted" TEXT,
    "acceptedAsIs" BOOLEAN,
    "editedFields" TEXT,
    "userAction" TEXT
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "citations" TEXT NOT NULL DEFAULT '[]'
);

-- CreateIndex
CREATE UNIQUE INDEX "Designer_email_key" ON "Designer"("email");

-- CreateIndex
CREATE INDEX "Designer_currentStatus_idx" ON "Designer"("currentStatus");

-- CreateIndex
CREATE INDEX "Designer_productArea_idx" ON "Designer"("productArea");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_email_key" ON "Partner"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Rubric_version_key" ON "Rubric"("version");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Assignment_designerId_idx" ON "Assignment"("designerId");

-- CreateIndex
CREATE INDEX "Assignment_projectId_idx" ON "Assignment"("projectId");

-- CreateIndex
CREATE INDEX "ImpactEntry_designerId_idx" ON "ImpactEntry"("designerId");

-- CreateIndex
CREATE INDEX "ImpactEntry_date_idx" ON "ImpactEntry"("date");

-- CreateIndex
CREATE INDEX "Feedback_designerId_idx" ON "Feedback"("designerId");

-- CreateIndex
CREATE INDEX "Feedback_occurredOn_idx" ON "Feedback"("occurredOn");

-- CreateIndex
CREATE INDEX "Feedback_cycleId_idx" ON "Feedback"("cycleId");

-- CreateIndex
CREATE UNIQUE INDEX "InboxEmail_rawHash_key" ON "InboxEmail"("rawHash");

-- CreateIndex
CREATE INDEX "InboxEmail_status_idx" ON "InboxEmail"("status");

-- CreateIndex
CREATE INDEX "InboxEmail_rawHash_idx" ON "InboxEmail"("rawHash");

-- CreateIndex
CREATE INDEX "PersonalitySignal_designerId_idx" ON "PersonalitySignal"("designerId");

-- CreateIndex
CREATE INDEX "Highlight_designerId_idx" ON "Highlight"("designerId");

-- CreateIndex
CREATE INDEX "Highlight_occurredOn_idx" ON "Highlight"("occurredOn");

-- CreateIndex
CREATE INDEX "CommunityActivity_designerId_idx" ON "CommunityActivity"("designerId");

-- CreateIndex
CREATE INDEX "CommunityActivity_date_idx" ON "CommunityActivity"("date");

-- CreateIndex
CREATE INDEX "OneOnOne_designerId_idx" ON "OneOnOne"("designerId");

-- CreateIndex
CREATE INDEX "OneOnOne_date_idx" ON "OneOnOne"("date");

-- CreateIndex
CREATE INDEX "Blocker_designerId_idx" ON "Blocker"("designerId");

-- CreateIndex
CREATE INDEX "Blocker_status_idx" ON "Blocker"("status");

-- CreateIndex
CREATE INDEX "ActionItem_designerId_idx" ON "ActionItem"("designerId");

-- CreateIndex
CREATE INDEX "ActionItem_status_idx" ON "ActionItem"("status");

-- CreateIndex
CREATE INDEX "ActionItem_dueDate_idx" ON "ActionItem"("dueDate");

-- CreateIndex
CREATE INDEX "TeamConcern_raisedByDesignerId_idx" ON "TeamConcern"("raisedByDesignerId");

-- CreateIndex
CREATE INDEX "TeamConcern_theme_idx" ON "TeamConcern"("theme");

-- CreateIndex
CREATE INDEX "TeamConcern_status_idx" ON "TeamConcern"("status");

-- CreateIndex
CREATE INDEX "RiskSignal_designerId_idx" ON "RiskSignal"("designerId");

-- CreateIndex
CREATE INDEX "RiskSignal_status_idx" ON "RiskSignal"("status");

-- CreateIndex
CREATE INDEX "RiskSignal_autoDecayOn_idx" ON "RiskSignal"("autoDecayOn");

-- CreateIndex
CREATE INDEX "BehavioralIncident_designerId_idx" ON "BehavioralIncident"("designerId");

-- CreateIndex
CREATE INDEX "BiweeklyCheckin_designerId_idx" ON "BiweeklyCheckin"("designerId");

-- CreateIndex
CREATE INDEX "BiweeklyCheckin_biweekStart_idx" ON "BiweeklyCheckin"("biweekStart");

-- CreateIndex
CREATE INDEX "BiweeklyCheckin_status_idx" ON "BiweeklyCheckin"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BiweeklyCheckin_designerId_biweekStart_key" ON "BiweeklyCheckin"("designerId", "biweekStart");

-- CreateIndex
CREATE INDEX "ReviewCycle_status_idx" ON "ReviewCycle"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewCycle_year_quarter_key" ON "ReviewCycle"("year", "quarter");

-- CreateIndex
CREATE INDEX "CycleReview_designerId_idx" ON "CycleReview"("designerId");

-- CreateIndex
CREATE INDEX "CycleReview_cycleId_idx" ON "CycleReview"("cycleId");

-- CreateIndex
CREATE INDEX "CycleReview_finalStatus_idx" ON "CycleReview"("finalStatus");

-- CreateIndex
CREATE UNIQUE INDEX "CycleReview_designerId_cycleId_key" ON "CycleReview"("designerId", "cycleId");

-- CreateIndex
CREATE UNIQUE INDEX "Outreach_responseFeedbackId_key" ON "Outreach"("responseFeedbackId");

-- CreateIndex
CREATE INDEX "Outreach_cycleId_idx" ON "Outreach"("cycleId");

-- CreateIndex
CREATE INDEX "Outreach_designerId_idx" ON "Outreach"("designerId");

-- CreateIndex
CREATE INDEX "Outreach_partnerId_idx" ON "Outreach"("partnerId");

-- CreateIndex
CREATE INDEX "Outreach_status_idx" ON "Outreach"("status");

-- CreateIndex
CREATE INDEX "AuditLog_designerId_idx" ON "AuditLog"("designerId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
