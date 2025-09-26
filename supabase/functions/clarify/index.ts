/**
 * Edge Function: "clarify"
 * Supports two modes:
 *  A) Supabase DB Webhook (payload.type === "INSERT" with payload.record)
 *  B) Direct call with body { query_id: "<uuid>" } from the frontend
 *
 * Behavior:
 *  - Build an OpenAI Responses API request to a reasoning-capable model (e.g., gpt-5)
 *  - Use JSON Schema structured output
 *  - Update public.asset_queries row: set llm_output + status="clarified_pending_user"
 *
 * Env (Project Settings → Functions):
 *  - OPENAI_API_KEY
 *  - OPENAI_MODEL (default: gpt-5)
 *  - SUPABASE_URL
 *  - SUPABASE_SERVICE_ROLE_KEY
 *  - WEBHOOK_TOKEN (shared secret for DB Webhook; choose any long random string)
 */

import OpenAI from "npm:openai";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ---- ENV ----
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const OPENAI_MODEL   = Deno.env.get("OPENAI_MODEL") ?? "gpt-5";
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE   = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_TOKEN  = Deno.env.get("WEBHOOK_TOKEN")!;

// ---- STATIC PROMPT ----
const SUPER_PROMPT = await (await fetch(new URL("./prompt.system.txt", import.meta.url))).text();

// ---- JSON SCHEMA for structured output ----
const ClarifySchema = {
  name: "ClarifyOutput",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      refined_query: {
        type: "object",
        additionalProperties: false,
        properties: {
          company: { type: "string" },
          drug_name: { type: "string" },
          therapeutic_area: { type: "string" },
          intent: { type: "string", description: "what the user is trying to accomplish" },
          scope: { type: "string", description: "narrowed scope incl. populations, endpoints, geos, timelines" },
          assumptions: { type: "array", items: { type: "string" } }
        },
        required: ["intent"]
      },
      clarifying_questions: {
        type: "array",
        minItems: 3,
        maxItems: 10,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            key: { type: "string" },
            question: { type: "string" },
            why_it_matters: { type: "string" },
            expected_formats: { type: "string" }
          },
          required: ["key", "question"]
        }
      },
      one_pager: {
        type: "object",
        additionalProperties: false,
        properties: {
          markdown: { type: "string" },
          sections: {
            type: "object",
            additionalProperties: false,
            properties: {
              summary: { type: "string" },
              company_overview: { type: "string" },
              asset_overview: { type: "string" },
              mechanism: { type: "string" },
              development_stage: { type: "string" },
              trials_pipeline: { type: "string" },
              competitive_landscape: { type: "string" },
              risks_unknowns: { type: "string" },
              research_plan: { type: "string" }
            }
          },
          confidence: { type: "number" }
        },
        required: ["markdown"]
      },
      ui_suggested_actions: { type: "array", items: { type: "string" } }
    },
    required: ["refined_query", "clarifying_questions", "one_pager"]
  }
} as const;

// ---- Helpers ----
function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
function err(msg: string, status = 400) {
  console.error("[clarify] " + msg);
  return new Response(msg, { status });
}

// Extract text JSON robustly from Responses API
function extractJsonText(resp: any): string | null {
  if (!resp) return null;
  if (resp.output_text && typeof resp.output_text === "string") return resp.output_text;
  try {
    const pieces: string[] = [];
    for (const item of resp.output ?? []) {
      for (const content of (item?.content ?? [])) {
        if (content?.type === "output_text" && typeof content?.text === "string") {
          pieces.push(content.text);
        }
        if (content?.type === "text" && typeof content?.text === "string") {
          pieces.push(content.text);
        }
      }
    }
    return pieces.join("\n").trim() || null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  // CORS (optional)
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type"
      }
    });
  }

  // Init clients
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Parse body
  let body: any = null;
  try { body = await req.json(); } catch { body = null; }

  // Mode A: DB Webhook (verify secret + check INSERT payload)
  const authHeader = req.headers.get("authorization") || "";
  const isWebhook = !!body?.type && !!body?.record;
  if (isWebhook) {
    if (authHeader !== `Bearer ${WEBHOOK_TOKEN}`) {
      return err("Unauthorized (webhook)", 401);
    }
  }

  // Determine the query record
  let record: any = null;

  if (isWebhook && body.type === "INSERT" && body.record) {
    record = body.record;
  } else if (body?.query_id) {
    // Mode B: direct call with query_id
    const { data, error } = await supabase
      .from("asset_queries")
      .select("*")
      .eq("id", body.query_id)
      .single();
    if (error || !data) return err("query_id not found", 404);
    record = data;
  } else {
    return err("Bad request: provide DB webhook INSERT payload or { query_id }", 400);
  }

  // Prepare model input
  const userContext = {
    company: record.company ?? null,
    drug_name: record.drug_name ?? null,
    therapeutic_area: record.therapeutic_area ?? null,
    free_text: record.free_text ?? null
  };

  // Call OpenAI Responses API
  let parsed: any = null;
  try {
    const resp = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: SUPER_PROMPT },
        { role: "user", content: JSON.stringify({ user_context: userContext, mode: "initial_generation" }) }
      ],
      text: { format: { type: "json_schema", json_schema: ClarifySchema } }
    });

    const text = extractJsonText(resp);
    if (!text) return err("Model returned empty response", 502);
    parsed = JSON.parse(text);
  } catch (e) {
    console.error(e);
    return err("OpenAI call failed", 502);
  }

  // Persist to DB
  const { error: upErr } = await supabase
    .from("asset_queries")
    .update({
      llm_output: parsed,
      status: "clarified_pending_user",
      updated_at: new Date().toISOString()
    })
    .eq("id", record.id);

  if (upErr) return err("DB update failed", 500);

  return ok({ ok: true, query_id: record.id });
});
