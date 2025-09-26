# Convexia Clarifier – Project Context (Authoritative)

## 1) What we are building
A server-side “Clarifier” pipeline that turns a **drug/asset interest submission** into:
- **Clarifying questions** (3–10, prioritized, actionable).
- **Refined query** (intent, narrowed scope, explicit assumptions).
- **One-pager thesis** (Markdown; sections: Summary, Company Overview, Asset Overview, Mechanism, Development Stage, Trials/Pipeline, Competitive Landscape, Risks & Unknowns, Research Plan & Next Steps).
The clarifier **does not browse**; it identifies unknowns and proposes a research plan. Frontend shows the questions + one-pager and lets the user approve, deny, or add info.

## 2) Current state (pre-existing)
- We already have a frontend that submits the form and inserts a row into Supabase table `public.asset_queries`.
- The repo already includes the Edge Function `supabase/functions/clarify` that:
  - Accepts a DB webhook INSERT **or** `{ query_id }` direct call,
  - Calls OpenAI Responses API with **reasoning.effort="high"** and a **JSON Schema**,
  - Updates the same row with `llm_output` and sets `status='clarified_pending_user'`.

## 3) Architecture (target)
- **Data**: `public.asset_queries(id, company, drug_name, therapeutic_area, free_text, status, llm_output, …)`
- **Trigger**: Either
  - (A) Frontend calls `functions.invoke("clarify", { query_id })` after insert, or
  - (B) Database Webhook on INSERT posts to the function (Authorization header with shared secret).
- **Function**: Deno (Supabase Edge), calls OpenAI Responses API (GPT-5 or fallback) with our **system super-prompt** + **JSON Schema**, writes structured output.
- **UI**: Renders `llm_output` questions + one-pager Markdown; provides Approve / Request Changes. (Optional refinement mode can reuse same function with `mode: "refinement"`.)

## 4) UX contract (must remain true)
- Questions must be concrete, quickly answerable, and include a short “why it matters”.
- Refined query must include **intent**, a **sharpened scope** (population, endpoints, geography, timeframe), and explicit **assumptions**.
- One-pager must be clean Markdown, with every section filled or marked **“Unknown — needs research”** + a retrieval suggestion.
- Tone is neutral, clinical, and decision-useful (no medical advice, no hype, no competitor references).
- Always return JSON matching the schema so the UI can parse it without heuristics.

## 5) Non-goals
- No live data fetching, citations, or market/clinical claims presented as facts.
- No direct patient/medical guidance.
- No multi-company comparative marketing copy.

## 6) Security & compliance
- Do not log secrets or PII. Redact user free_text in logs if needed.
- Edge Function must be idempotent for a given `query_id` (re-invocation updates the same row deterministically).
- Timeouts, retries with backoff (where appropriate), and clear error messages.
- Keep service role keys server-side only. Verify DB webhook by a shared header.

## 7) Error handling
- If model returns empty/invalid JSON: write `status='received'` unchanged and log a concise error; do **not** partially write malformed JSON.
- If DB update fails: return 500 with message “DB update failed”.
- If OpenAI fails: return 502 with message “OpenAI call failed”.

## 8) Edge cases (handle gracefully)
- Only free_text provided; company/drug/TA are null → ask high-leverage questions first, produce scaffolded one-pager with TODOs.
- Multiple companies/assets implied → ask for prioritization, propose a default sorting.
- Very broad “therapeutic area” → narrow to a subtype and a single primary endpoint/timeframe.
- Ambiguous acronyms → ask for expansion.
- Requests that verge on medical advice → refuse that part; keep to research framing.

## 9) Acceptance tests (Definition of Done)
- Insert row → function produces:
  1) ≥3 clarifying questions with keys and reasons,
  2) refined_query.intent present and scope non-empty,
  3) one-pager Markdown with all sections present (allow “Unknown — needs research”),
  4) `status='clarified_pending_user'` and `llm_output` stored.
- JSON validates against the schema used by the function.
- Re-invoking with the same `query_id` is safe (replaces `llm_output` and updates timestamp).

## 10) Observability
- Console logs: request id, mode, query_id, timing (OpenAI total ms, DB update ms).
- Avoid logging raw free_text; log length + checksum if needed.

## 11) Future refinement (optional)
- Add `{ answers: Record<string,string> }` to request body, set `mode:"refinement"`, and merge answers into context → regenerate.
- Store answers in an `asset_query_answers` table keyed by `clarifying_questions[].key`.

## 12) Examples (canonical patterns)

**Example A (oncology, broad) – Input**
company: "HelixBio"
drug_name: "HB-201"
therapeutic_area: "Oncology"
free_text: "Interested in efficacy vs standard of care in 2L NSCLC, US & EU."

**Output shape (abridged)**
- clarifying_questions:
  - key: "population_subtype" question: "Which NSCLC subtype(s)..." why_it_matters: "..."
- refined_query.intent: "Evaluate HB-201 vs SOC in 2L NSCLC"
  scope: "Adeno vs squamous? PD-L1 strata? ..."
  assumptions: ["US/EU only", "Adult patients"]
- one_pager.markdown includes all sections; unknowns called out; research plan with how to verify (e.g., “search ClinicalTrials.gov for HB-201 NSCLC; stratify by PD-L1”).

**Example B (neuro, sparse input) – Input**
company: null, drug_name: null, therapeutic_area: "Neurology", free_text: "ALS options?"

**Behavior**
- Ask 3–5 high-leverage questions (mechanism interest, stage, endpoints, geography, time horizon).
- One-pager scaffold with “Unknown — needs research” and a prioritized research plan.

**Example C (multi-company) – Input**
free_text: "Compare Arcadia and Noventis Alzheimer portfolios; Q3 focus."

**Behavior**
- Ask to confirm which to prioritize; propose a default order (e.g., “Arcadia then Noventis”), and constrain to Q3 timelines.
