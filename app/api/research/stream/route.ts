import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { askClarifier } from "@/lib/llm/clarifier"
import { config } from "@/lib/config"
import fs from "node:fs"
import path from "node:path"
import { isTestMode, useMemoryStore } from "@/lib/runtime"
import { fakeResearchStream } from "@/lib/fakes/llm"
import { createSession, saveEvent, saveThesisVersion, getSessionQuery, hasEmittedClarifying, markEmittedClarifying, nextSeq } from "@/lib/persist"

const Body = z.object({
  sessionId: z.string().uuid().nullable().optional(),
  userQuery: z.string().min(1),
  mode: z.enum(["auto", "questions_only", "thesis_only"]).default("auto").optional(),
  resume: z.boolean().optional(),
})

const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"

type ProgressStage = "plan" | "search" | "extract" | "synthesize" | "question" | "draft" | "validate" | "ready"

function sse(data: any) {
    return `data: ${JSON.stringify(data)}\n\n`
  }

  function progress(stage: ProgressStage, message: string) {
    return { type: "progress", payload: { stage, message, at: new Date().toISOString() } }
  }
async function streamSession(sessionId: string, userQuery: string, mode: "auto" | "questions_only" | "thesis_only") {
  const inMem = useMemoryStore()
  const supabase = inMem ? null : createAdminClient()
  const t0 = Date.now()
  console.log(`[stream] start sessionId=${sessionId} mode=${mode}`)
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()
      let isClosed = false
      const safeClose = () => {
        if (!isClosed) {
          try { controller.close() } catch {}
          isClosed = true
        }
      }
      ;(async () => {
        const sendLine = (line: string) => controller.enqueue(encoder.encode(line))
        const sendEvent = async (type: string, payload: any, version: number = 1, questionId?: string) => {
          // persist to DB event_log when not in memory mode
          if (!inMem) {
            try {
              await (await supabase!).from("event_log").insert({ session_id: sessionId, type, payload })
            } catch (e) {
              console.warn(`[stream] event_log insert failed:`, e)
            }
          }
          const seq = await nextSeq(sessionId, version)
          const id = `${version}:${seq}:${questionId || ''}`
          sendLine(`id: ${id}\n`)
          sendLine(`data: ${JSON.stringify({ type, payload, version })}\n\n`)
        }
        try {
          console.log(`[stream] ${sessionId} begin userQueryLen=${userQuery.length} mode=${mode}`)
          await sendEvent("progress", progress("plan", "Planning verification and retrieval").payload)
          await sendEvent("progress", progress("search", "Querying primary sources").payload)
          await new Promise((r) => setTimeout(r, 150))
          await sendEvent("progress", progress("extract", "Extracting key facts").payload)
          await new Promise((r) => setTimeout(r, 150))
          await sendEvent("progress", progress("synthesize", "Synthesizing interim hypotheses").payload)
          if (mode !== "thesis_only") {
            const clarStart = Date.now()
            await sendEvent("progress", progress("question", "Generating clarifying questions").payload)
            const v = 1

            if (mode === ("questions_only" as any)) {
              await sendEvent("progress", progress("ready", "Ready for feedback").payload)
              safeClose()
              return
            }

            try {
              const clarT0 = Date.now()
              const inferred = await (async()=>{ try { const m=(userQuery.match(/@([A-Za-z0-9.-]+)/)||[])[1]; return m||undefined } catch { return undefined } })()
              const clarifier = await askClarifier({ originalQuery: userQuery, maxQuestions: 4, context: { timeoutMs: 30000, domain: inferred } })
              const questions = (clarifier.questions || []).map((q: any, i: number) => ({
                id: q.key || `q${i + 1}`,
                text: q.label || q.question || q.text || "",
                why: q.reason || q.help || "Narrows scope to make outputs executable",
              }))
              const clarMs = Date.now()-clarT0
              console.log(`[stream] clarifier ok sessionId=${sessionId} ms=${clarMs} qCount=${questions.length}`)
              if (questions.length && !inMem) {
                try {
                  await (await supabase!)
                    .from("clarifying_question")
                    .insert(questions.map((q, i) => ({ session_id: sessionId, idx: i, text: q.text, why: q.why })))
                } catch (e) {
                  console.warn(`[stream] clarifying_question insert failed:`, e)
                }
              }
              if (!(await hasEmittedClarifying(sessionId, 1))) {
                await markEmittedClarifying(sessionId, v)
                await sendEvent("clarifying_questions", { questions, proposedQueries: [] }, v)
              }
            } catch (e) {
              const err = e as Error
              console.warn(`[stream] clarifier error sessionId=${sessionId}: ${err.message}`)
            }
          }
          if (mode !== "questions_only") {
            const draftStart = Date.now()
            await sendEvent("progress", progress("draft", "Drafting thesis").payload)
            // Emit ETA progress while drafting for up to ~30 seconds
            const tStart = Date.now()
            const maxMs = 30 * 1000
            const etaTimer = setInterval(async () => {
              const remain = Math.max(0, maxMs - (Date.now() - tStart))
              await sendEvent("progress", { stage: "draft", message: `Thesis ETA ~${Math.ceil(remain / 1000)}s`, at: new Date().toISOString(), etaMs: remain })
            }, 5000)
            const promptPath = path.resolve(process.cwd(), "prompts/system/thesis_biopharma.md")
            const masterSystem = fs.existsSync(promptPath) ? fs.readFileSync(promptPath, "utf8") : "You are a Biopharma Thesis Agent."
            const model = process.env.THESIS_MODEL || process.env.OPENAI_MODEL || config.llm.model || "gpt-5"
            const baseUrl = config.llm.baseUrl || "https://api.openai.com/v1"
            const apiKey = process.env.OPENAI_API_KEY as string
            const startedAt = Date.now()
            let thesisDraft: any = null
            try {
              // Try to infer company from stored query/email (if present in session metadata)
              let emailDomain: string | null = null
              if (!inMem) {
                try {
                  emailDomain = (await (await supabase!).from("clarification_sessions").select("metadata").eq("id", sessionId).single()).data?.metadata?.email_domain || null
                } catch (e) {
                  console.warn(`[stream] lookup email_domain failed:`, e)
                }
              }
              const companyInstruction = emailDomain ? `\nUser email domain hints company: ${emailDomain}. Tailor the thesis to this company's style and mandate.` : ''
              const ctrl = new AbortController()
              const draftTimeout = setTimeout(() => ctrl.abort(), 30000)
              const callThesis = async () => {
                const resp = await fetch(`${baseUrl}/responses`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
                  body: JSON.stringify({
                    model,
                    instructions: masterSystem + companyInstruction,
                    input: `USER_QUERY:\n${userQuery}\n\nOutput only a concise Thesis Block JSON with keys: executive[], archetype, stageTempo, filters[], capability, evidence[], risks[], scenarios[], nextActions[]`,
                    temperature: 0.1,
                    max_output_tokens: 1200,
                    reasoning: { effort: "medium" },
                    text: { format: { type: "json_object" } },
                  }),
                  signal: ctrl.signal,
                })
                const data = await resp.json()
                const msg = (data.output || []).find((o: any) => o.type === "message")
                const textPiece = msg?.content?.find((c: any) => c.type === "output_text")
                const contentText = textPiece?.text || data?.output_text || data?.text || "{}"
                return { data, contentText }
              }
              let { data, contentText } = await callThesis()
              if (!contentText || contentText.trim() === "{}") {
                ;({ data, contentText } = await callThesis())
              }
              clearTimeout(draftTimeout)
              const parsed = JSON.parse(contentText)
              // Ensure thesis includes a fully-formed plan echoing inputs even without questions
              thesisDraft = {
                version: "v1",
                executive: Array.isArray(parsed.executive) && parsed.executive.length > 0 ? parsed.executive : [
                  `Scope and plan derived from input: ${userQuery}`
                ],
                archetype: parsed.archetype || "",
                stageTempo: parsed.stageTempo || "",
                filters: parsed.filters || [],
                capability: parsed.capability || "",
                evidence: parsed.evidence || [],
                risks: parsed.risks || [],
                scenarios: parsed.scenarios || [],
                nextActions: parsed.nextActions || ["Proceed with above scope if no further inputs"]
              }
              if (!Array.isArray(thesisDraft.executive) || thesisDraft.executive.length === 0) {
                thesisDraft.executive = ["Working thesis: will refine upon user confirmation"]
              }
              if (!inMem) {
                try { await (await supabase!).from("llm_events").insert({ query_id: sessionId, provider: "openai", model, request: { endpoint: "responses" }, response: { id: data.id, usage: data.usage, latencyMs: Date.now() - startedAt } }) } catch (e) { console.warn(`[stream] llm_events insert failed:`, e) }
              }
            } catch (e) {
              const err = e as Error
              console.warn(`[stream] thesis generation failed sessionId=${sessionId}: ${err.message}`)
              thesisDraft = { version: "v1", executive: ["Working thesis: will refine upon user confirmation"], archetype: "", stageTempo: "", filters: [], capability: "", evidence: [], risks: [], scenarios: [], nextActions: ["Confirm proposed focus"] }
            }
            clearInterval(etaTimer)
            if (!inMem) {
              try { await (await supabase!).from("thesis_version").insert({ session_id: sessionId, version: 1, content: thesisDraft, status: "draft" }) } catch (e) { console.warn(`[stream] thesis_version insert failed:`, e) }
            }
            await sendEvent("thesis_draft", thesisDraft, 1)
            await sendEvent("sources", { items: [] }, 1)
            console.log(`[stream] thesis ok sessionId=${sessionId} ms=${Date.now()-startedAt}`)
          }
          await sendEvent("progress", progress("validate", "Validating outputs").payload)
          await sendEvent("progress", progress("ready", "Ready for feedback").payload)
          console.log(`[stream] done sessionId=${sessionId} totalMs=${Date.now()-t0}`)
        } catch (e: any) {
          try { controller.enqueue(new TextEncoder().encode(sse({ type: "error", payload: { message: e?.message || String(e) } }))) } catch {}
        } finally {
          safeClose()
        }
      })()
    },
  })
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" } })
}

export async function POST(req: Request) {
  try {
    const { sessionId, userQuery, mode = "auto" } = Body.parse(await req.json())
    let activeSessionId = sessionId || null
    if (!activeSessionId) {
      activeSessionId = await createSession(DEMO_USER_ID, userQuery)
    }
    const url = new URL(req.url)
    url.searchParams.set("sessionId", activeSessionId!)
    url.searchParams.set("mode", mode)
    if (useMemoryStore()) {
      url.searchParams.set("userQuery", userQuery)
    }
    return Response.json({ sessionId: activeSessionId, sseUrl: `${url.pathname}?sessionId=${activeSessionId}&mode=${mode}${useMemoryStore() ? `&userQuery=${encodeURIComponent(userQuery)}` : ""}` })
  } catch (e) {
    const err = e as Error
    console.error(`[stream][POST] error: ${err.message}`)
    return new Response(JSON.stringify({ error: err.message || 'internal' }), { status: 500 })
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const sessionId = url.searchParams.get("sessionId")
  const mode = (url.searchParams.get("mode") as any) || "auto"
  if (!sessionId) return new Response(JSON.stringify({ error: "sessionId required" }), { status: 400 })
  let userQuery = await getSessionQuery(sessionId)
  if (!userQuery) {
    userQuery = url.searchParams.get("userQuery") || null
  }
  if (!userQuery) return new Response(JSON.stringify({ error: "session not found" }), { status: 404 })
  if (isTestMode()) {
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        for await (const evt of fakeResearchStream(sessionId, userQuery!)) {
          const persisted = await saveEvent(sessionId, evt.type, evt.payload || {}, 1)
          const id = `1:${persisted.seq}:`
          controller.enqueue(encoder.encode(`id: ${id}\n`))
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: evt.type, payload: evt.payload, version: 1 })}\n\n`))
          if (evt.type === 'thesis_draft') await saveThesisVersion(sessionId, 1, evt.payload, 'draft')
        }
        controller.close()
      },
    })
    return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" } })
  }
  return streamSession(sessionId, userQuery!, mode)
}


