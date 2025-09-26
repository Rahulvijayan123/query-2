# Convexia Clarifier (Supabase → Edge Function → OpenAI)

## Env (Supabase → Project Settings → Functions)
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5
SUPABASE_URL=https://<YOUR-PROJECT>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
WEBHOOK_TOKEN=super_long_random_secret

## Deploy
supabase functions deploy clarify

## Trigger Options
Option 1 (client): after inserting into public.asset_queries, call:
  await supabase.functions.invoke("clarify", { body: { query_id } });

Option 2 (DB Webhook): Create a Database Webhook on INSERT for table public.asset_queries with:
  - URL: https://<YOUR-PROJECT>.supabase.co/functions/v1/clarify
  - Method: POST
  - Header: Authorization: Bearer WEBHOOK_TOKEN
  - Body: default event payload

## Flow
Form submit → INSERT asset_queries → (Trigger) → Edge Function
→ OpenAI Responses API (reasoning + JSON schema)
→ Update row with llm_output + status='clarified_pending_user' → UI renders.

## UI Hints
- Render llm_output.clarifying_questions (with inputs).
- Render llm_output.one_pager.markdown (Markdown preview).
- Approve → set status='approved'.
- Changes/answers → upsert into asset_query_answers and re-run function with { query_id } to refine.
