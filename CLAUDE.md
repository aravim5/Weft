# Design Team Intelligence System — Copilot Context

## 1. Guiding principles

1. **Local-first.** SQLite + local files. No cloud DB. No real data leaves this machine.
2. **Structured + unstructured together.** Free-form notes are normalized into structured schema.
3. **Human-in-the-loop for sensitive fields.** Claude proposes; Ravi approves. Never direct-writes risk/behavioral/personality rows.
4. **Small enough to fit in context.** 12 designers — pass full structured profiles into Claude directly. No vector search needed.
5. **AI is optional.** Every feature has a manual fallback. AI_MODE=disabled must work everywhere.

## 2. Entity list (21 entities — see DATA_DICTIONARY.md for full field specs)

- `designers` — the 11 people Ravi manages. Root of almost everything.
- `partners` — external feedback-givers (PMs, EMs, peer designers, clients).
- `rubric` — Outstanding↔Needs Improvement framework, versioned JSON.
- `projects` — design initiatives (40–80 active/archived at a time).
- `assignments` — joins designers ↔ projects (role, date range).
- `impact_entries` — the spine: discrete, evidence-backed impact records. NOT deliverables or hours.
- `feedback` — structured feedback items (source, sentiment, theme, quote, occurred_on).
- `inbox_emails` — raw source-of-truth for every pasted email. Never auto-edited.
- `personality_signals` — living sketch of working style. Evidence required.
- `risk_signals` — engagement/retention risk indicators. Evidence required. Owner-only.
- `behavioral_incidents` — serious conduct issues. Most sensitive table. Owner-only.
- `highlights` — standout moments, wins (small/big), kudos.
- `community_activities` — design team rituals and learning sessions.
- `one_on_ones` — 1:1 meeting logs (mood, happiness, topics, vibe_notes [owner-only]).
- `blockers` — things blocking a designer's progress. Owner tracks resolution.
- `action_items` — things RAVI owes a designer. Ravi is always the owner.
- `team_concerns` — things designers raise about the team/environment. Clustered periodically.
- `biweekly_checkins` — one row per (designer, biweek). The rhythm keeper.
- `review_cycles` — quarterly check-in calendar (Q1–Q4 2026).
- `cycle_reviews` — one formal review per designer per cycle. The deliverable.
- `outreach` — partner outreach emails per (cycle, designer, partner) triple.

## 3. AI pipeline (10 jobs — see AI_JOB_SPECS.md for full contracts)

All AI calls go through `src/lib/ai/provider.ts`. Never import @anthropic-ai/sdk directly in route files.

| Job | Prompt file | Model | Writes? |
|---|---|---|---|
| 1 Extract email | extract-email.ts | Haiku | ✏️ proposal |
| 2 Extract note | extract-note.ts | Haiku | ✏️ proposal |
| 3 Extract 1:1 | extract-one-on-one.ts | Sonnet | ✏️ proposal |
| 4 Pre-1:1 brief | pre-one-on-one-brief.ts | Sonnet | read-only |
| 5 Biweekly prep | biweekly-checklist-prep.ts | Haiku | read-only |
| 6 Rolling profile | summarize-designer.ts | Sonnet | draft |
| 7 Cycle review | generate-cycle-review.ts | Sonnet | draft |
| 8 Chat | answer-query.ts | Sonnet | read-only |
| 9 Outreach draft | draft-outreach.ts | Sonnet | draft |
| 10 Cluster concerns | cluster-team-concerns.ts | Sonnet | cached |

## 4. Architecture rules

- **EntityForm** is the only form component. No bespoke forms per entity.
- **Zod schemas** live in `src/lib/schemas/entities/<entity>.ts`. Used for BOTH Claude output validation AND manual forms.
- **Every Claude call** uses `getProvider()` from `src/lib/ai/provider.ts`. Never direct fetch in route files.
- **AI_MODE=disabled** must work everywhere — every AI button has a manual fallback.
- **Sensitive fields** (`risk_signals`, `behavioral_incidents`, `personality_signals`, `vibe_notes`, post-signoff `cycle_reviews`) are audit-logged on every edit.
- **Soft deletes** — `archived_at` field, never hard-deletes except from settings.
- **Every entity** has: `id` (cuid), `createdAt`, `updatedAt`, `source` (manual_form|ai_extracted|ai_extracted_edited|imported).

## 5. Build rules

- Treat DATA_DICTIONARY.md as schema source of truth. Don't invent fields.
- Treat AI_JOB_SPECS.md as prompt contract. Don't deviate from output schemas.
- Cite the phase (VSCODE_PROMPT_PACK.md) in every commit message.
- Never commit data/ or .env*.
