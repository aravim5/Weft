# Design Team Intelligence System

A local-first web app for a solo design team manager to track feedback, 1:1s, quarterly reviews, and team health signals for their designers — powered by Claude when available, fully functional without AI.

## Local setup

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill in env vars
cp .env.local.example .env.local
# edit .env.local: set ANTHROPIC_API_KEY, APP_USER_EMAIL, APP_USER_NAME
# set AI_MODE=disabled (work) or AI_MODE=anthropicDirect (home, synthetic data only)

# 3. Create the data directory (gitignored)
mkdir -p data

# 4. Run database migration
npx prisma migrate dev

# 5. Seed with placeholder data
npm run seed:synthetic       # fake data for home/testing
# npm run seed:real          # real data (work laptop only, gitignored)

# 6. Start the dev server
npm run dev

# 7. (Optional) Start cron worker in a second terminal
npm run cron
```

Open [http://localhost:3000](http://localhost:3000).

## Example queries (chat interface)

- "Who's at risk of leaving?"
- "Who had the most impact in Q1?"
- "Which designers should I pair for mentorship?"
- "Summarize Priya's Q1 in three sentences"
- "Who hasn't had partner feedback this quarter?"
- "What themes are coming up in team concerns?"
- "Whose happiness is trending down?"

## Daily use — the biweekly rhythm

Every other Monday: `/checkins/biweekly` → click a designer → work through the 13-section checklist. The system flags what's stale. "No change" is a valid answer for each section — the goal is *completion*, not forced input.

## Quarterly cycle walkthrough

1. `/cycles` → click the next planned cycle.
2. Stage 1 (T-4 weeks): Review the outreach matrix, uncheck any pairs that don't make sense.
3. Stage 2 (T-3 weeks): Generate email drafts, review and approve each.
4. Stage 3: Send via `mailto:` (copy to your mail client) or SMTP if configured.
5. Stage 4: As replies arrive, paste them into `/ingest/email`.
6. Stage 5 (check-in week): Generate cycle reviews for each designer, edit, sign off, export PDF.

## Privacy & ethics (non-negotiable)

- **Never commit data/.** HR data stays on the local machine only.
- **Never commit .env files.** API keys and personal config stay local.
- **Evidence required for sensitive fields.** `risk_signals`, `personality_signals`, `behavioral_incidents` all require an `evidence` field — no labels without proof.
- **Claude proposes, you approve.** No AI output writes directly to sensitive tables.
- **Decay old signals.** Risk and personality signals prompt you to re-evaluate at 90 days.
- **Would you be comfortable if the designer read it?** Use this as the litmus test for any note.

## AI modes

| `AI_MODE` | Where | What happens |
|---|---|---|
| `disabled` | Work (default) | AI buttons show "Enter manually". Zero network calls. |
| `clipboard` | Optional | Generates prompt, copies to clipboard, waits for pasted response. |
| `anthropicDirect` | Home only | Calls `api.anthropic.com` directly. Use with synthetic data only. |
| `bedrock` | Future | AWS Bedrock — see `docs/BEDROCK_UPGRADE.md`. |

## Tech stack

Next.js 15 App Router · TypeScript · SQLite + Prisma · Tailwind + shadcn/ui · Recharts · Claude API (Haiku + Sonnet) · Zod · react-hook-form · node-cron
