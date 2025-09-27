# Convexia app build

*Automatically synced with your [v0.app](https://v0.app) deployments*

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/rahulvijayan184-4427s-projects/v0-convexia-app-build)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/projects/ZDfuGqBogWG)

## Overview

This repository will stay in sync with your deployed chats on [v0.app](https://v0.app).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.app](https://v0.app).

## Local Setup

1) Install dependencies

```bash
pnpm install
```

2) Configure environment

Create `.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
OPENAI_API_KEY=sk-...
# optional prompt file used to steer clarifier
SYSTEM_PROMPT_PATH=prompts/clarifier.system.txt
# optional
RESEND_API_KEY=your_resend_api_key
```

3) (Optional) Run Supabase locally

```bash
supabase start
supabase db reset  # seeds queries table
pnpm db:ensure     # ensures clarify schema; apply migrations under supabase/migrations
```

4) Start app

```bash
pnpm dev
```

## Architecture

- Next.js App Router (`app/`)
- UI via shadcn/radix components in `components/ui`
- Supabase client in `lib/supabase` (SSR and browser)
- Demo auth via cookie guard in `middleware.ts` and `lib/auth.ts`
- Query persistence in `lib/actions/queries.ts` (Supabase `queries` table)
- Email notifications via Resend in `lib/email.ts`
- Optional Supabase Edge Function mirror at `supabase/functions/send-email-notification`

### Clarifying Layer (GPT‑5 style)

APIs:
- `POST /api/query` → inserts `queries` row, calls LLM for clarifying questions, logs `llm_events`, returns `{ query_id, session_id, questions[] }`.
- `POST /api/answers` → upserts a single answer for a `question_id`, updates completeness.
- `GET /api/questions?query_id=...` → returns latest questions for the query.
- `POST /api/clarify/finalize` → composes enriched prompt and stores it.

DB (seeded in `supabase/seed.sql`):
- `clarification_sessions`, `clarification_questions`, `clarification_answers`, `clarification_events`.
Additional migrations:
- `llm_events` to store provider/model, request/response per LLM call.
### Smoke test (real LLM + DB)

With the app running (`pnpm dev`), run:

```bash
pnpm smoke:llm-flow
# or against deployed
BASE_URL=https://your-app.example.com pnpm smoke:llm-flow
```

It prints PASS/FAIL and IDs for verification in Supabase.

Client:
- `ClarifyFlow` renders a `ClarifyCard` inline in the chat UI and auto-saves answers.

Env keys:
- `SUPABASE_SERVICE_ROLE_KEY` (admin write for server routes)
- `OPENAI_API_KEY` (optional; falls back to heuristics)

### Email

Endpoints:
- `POST /api/test-email` sends a test email (uses `lib/email.ts`).
- `POST /api/webhook` accepts a `{ record }` payload and emails details.

### Supabase

Provide `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
Local dev uses `supabase/seed.sql` to create the `queries` table and permissive RLS policies for demo.

## Extending (Layers)

- Frontend: Add pages/components in `app/` and `components/`.
- Supabase: Add tables, policies, RPCs; seed via `supabase/seed.sql`.
- Email: Centralized in `lib/email.ts` for reuse in routes/actions.
- UI: Extend `components/ui` and theme in `app/globals.css`.

## Deployment

Your project is live at:

**[https://vercel.com/rahulvijayan184-4427s-projects/v0-convexia-app-build](https://vercel.com/rahulvijayan184-4427s-projects/v0-convexia-app-build)**

## Build your app

Continue building your app on:

**[https://v0.app/chat/projects/ZDfuGqBogWG](https://v0.app/chat/projects/ZDfuGqBogWG)**

## How It Works

1. Create and modify your project using [v0.app](https://v0.app)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository
# Trigger Vercel Redeploy
