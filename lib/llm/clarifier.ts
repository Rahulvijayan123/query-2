type ClarifierContext = {
  timeoutMs?: number
  domain?: string
  supabase?: any
  forceQuestion?: boolean
}

type ClarifierInput = { originalQuery: string; context?: ClarifierContext; maxQuestions: number }
import { config } from "@/lib/config"
import fs from "node:fs"
import path from "node:path"

export async function askClarifier(input: ClarifierInput): Promise<{ completeness: number; questions: any[]; debug?: any }> {
  const startTime = Date.now()
  const logPrefix = `[CLARIFIER]`
  
  console.log(`${logPrefix} Starting clarification process`, {
    query: input.originalQuery,
    maxQuestions: input.maxQuestions,
    domain: input.context?.domain,
    timestamp: new Date().toISOString()
  })
  
  const provider = config.llm.provider
  const baseModel = config.llm.model
  const model = process.env.CLARIFIER_MODEL || baseModel
  const apiKey = process.env.OPENAI_API_KEY
  
  console.log(`${logPrefix} Model configuration`, {
    provider,
    model,
    hasApiKey: !!apiKey
  })

  const promptPath = path.resolve(process.cwd(), "prompts/system/clarifier_biotech.md")
  const baseSystem =
    config.llm.systemPrompt ||
    (fs.existsSync(promptPath) ? fs.readFileSync(promptPath, "utf8") :
      `You are a biotech search clarifier. Ask only high-value questions (≤2 by default, ≤4 max) and otherwise apply defaults. Output strict JSON with assumptions, questions, next_step_if_no_reply.`)
  const system = `You are an elite pharmaceutical intelligence analyst with 15+ years in drug discovery, regulatory affairs, and competitive intelligence. Your expertise spans molecular targets, therapeutic modalities, clinical development stages, and global pharma markets.

CORE MISSION:
1) Extract and canonicalize pharmaceutical entities from user queries
2) Generate hyper-specific clarifying questions that showcase deep domain expertise  
3) Guide users toward optimal search scope through targeted questioning

ENTITY EXTRACTION & CANONICALIZATION:
- Extract: targets (molecular, pathways), indications (diseases, conditions), modalities (small molecules, biologics, ADCs, gene therapies), stages (preclinical, Phase I/II/III, approved), geographies (US/EU/Asia markets), companies (Big Pharma, biotech)
- Canonicalize: Brand names → generics (Keytruda → pembrolizumab), abbreviations → full terms (mAb → monoclonal antibody), normalize stages (Ph2 → Phase 2)
- Populate entities object in JSON output

QUESTION GENERATION EXPERTISE:
- Questions must demonstrate pharmaceutical industry knowledge depth
- Reference specific molecular targets, therapeutic classes, regulatory pathways, market dynamics
- Use proper pharmaceutical terminology and industry-standard classifications
- Never ask generic questions that could apply to any industry

EXAMPLES OF DOMAIN EXPERTISE IN QUESTIONS:
✅ "Should we focus on PD-1/PD-L1 checkpoint inhibitors specifically, excluding broader immunomodulators?"
✅ "Do you want to include antibody-drug conjugates (ADCs) targeting HER2-positive tumors?"
✅ "Should we limit to assets with FDA Breakthrough Therapy designation or similar regulatory paths?"
✅ "Do you want to exclude biosimilars and focus on novel molecular entities (NMEs) only?"
✅ "Should we include combination therapies pairing CDK4/6 inhibitors with endocrine therapy?"

VALIDATION RULES:
- If query lacks pharmaceutical context or is random text/profanity → return NO questions and direct user to resubmit
- For insufficient queries → provide helpful pharmaceutical search examples
- Always output valid JSON matching the schema exactly`
  const domain = input.context?.domain || "other"
  const supInputs = input.context?.supabase || null
  const supContextBlock = supInputs ? `\nSUPABASE_INPUTS (raw):\n${JSON.stringify(supInputs, null, 2)}\n` : ""
  const forceMinOne = Boolean(input.context?.forceQuestion)
  // Will calculate questions dynamically after content validation

  // Anti-loop validation: Ensure we don't process empty or invalid queries
  if (!input.originalQuery || input.originalQuery.trim().length < 3) {
    console.error(`${logPrefix} Invalid query provided`, { query: input.originalQuery })
    throw new Error("Query too short or empty")
  }
  
  // Content validation: Check for pharma relevance and appropriateness
  const queryLower = input.originalQuery.toLowerCase()
  const nonPharmaKeywords = [
    'everything', 'anything', 'all drugs', 'all medications', 'random', 'test', 'hello', 'hi',
    'fuck', 'shit', 'damn', 'hell', 'ass', 'bitch', 'sex', 'porn', 'nsfw'
  ]
  const overlyBroadKeywords = ['everything', 'anything', 'all drugs', 'all medications', 'drugs', 'medicine']
  
  const hasNonPharmaContent = nonPharmaKeywords.some(keyword => 
    queryLower.includes(keyword) || queryLower === keyword
  )
  
  const isOverlyBroad = overlyBroadKeywords.some(keyword => 
    queryLower === keyword || queryLower.includes(keyword)
  ) && queryLower.length < 15 // Very short and broad
  
  // Check for overly broad queries to force more questions
  
  if (hasNonPharmaContent) {
    console.warn(`${logPrefix} Non-pharma content detected`, { query: input.originalQuery })
    // Return structured response for invalid queries instead of throwing
    return {
      completeness: 0.05,
      questions: [],
      debug: {
        validation_error: "Non-pharmaceutical query detected",
        message: "Please provide a pharmaceutical or biotech-related query to find drug assets. Examples: 'EGFR inhibitors lung cancer', 'checkpoint inhibitors', 'CAR-T therapies'.",
        rejected_keywords: nonPharmaKeywords.filter(keyword => 
          queryLower.includes(keyword) || queryLower === keyword
        )
      }
    }
  }
  
  // Calculate minQuestions based on whether query is overly broad
  const minQuestions = isOverlyBroad 
    ? Math.max(5, Math.min(10, input.maxQuestions || 8)) // Force 5-10 questions for broad queries
    : Math.max(3, Math.min(5, input.maxQuestions || 4))
  
  if (isOverlyBroad) {
    console.warn(`${logPrefix} Overly broad query detected - forcing ${minQuestions} questions`, { query: input.originalQuery })
  }
  
  const user = `Query: "${input.originalQuery}"
${supContextBlock}

Analyze this pharmaceutical query and generate ${minQuestions} expert clarifying questions:

1. SCOPE ANALYSIS: Determine if query is too_broad, too_specific, or balanced

2. GENERATE ${minQuestions} EXPERT QUESTIONS showing deep pharma knowledge:
- Use specific molecular targets (EGFR, PD-1, BRAF V600E, CDK4/6, mTOR)
- Reference therapeutic classes (checkpoint inhibitors, ADCs, kinase inhibitors, mAbs)  
- Mention development stages (Phase 1/2/3, IND-enabling, NDA)
- Include regulatory terms (Breakthrough Therapy, Orphan Drug, Fast Track)
- Reference companies (Roche, Merck, Pfizer, Gilead, Novartis)

EXAMPLES of expert pharma questions:
✅ "Should we focus on PD-1/PD-L1 checkpoint inhibitors specifically, excluding CTLA-4 modulators?"
✅ "Do you want to include antibody-drug conjugates (ADCs) with cleavable linkers?"
✅ "Should we limit to assets with FDA Breakthrough Therapy designation?"
✅ "Do you want to exclude biosimilars and focus on novel molecular entities (NMEs)?"

Each question MUST:
- Be answerable with YES/NO only (type="single_select")
- Show pharmaceutical industry expertise
- Include 'reason' explaining why this matters
- Specify 'balancing_intent': narrow/broaden/clarify
- Have options: [{"value":"yes","label":"Yes","is_default":false},{"value":"no","label":"No","is_default":true}]

Respond ONLY with valid JSON.`
  
  // Fallback minimal heuristic when no API key
  if (!apiKey) {
    console.error(`${logPrefix} OpenAI API key missing`)
    throw new Error("OPENAI_API_KEY missing. Set env and retry.")
  }
  if (!model) {
    throw new Error("LLM_MODEL missing. Set env LLM_MODEL and retry.")
  }

  if (provider !== "openai") {
    throw new Error(`LLM provider ${provider} not supported yet. Set LLM_PROVIDER=openai`)
  }

// Enhanced Questions Schema with Entity Extraction
const ClarifierSchema = {
  name: "ClarifierOutput",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      scope_analysis: {
        type: "object",
        additionalProperties: false,
        properties: {
          query_type: { type: "string", enum: ["too_broad", "too_specific", "balanced"] },
          reasoning: { type: "string" }
        },
        required: ["query_type", "reasoning"]
      },
      questions: {
        type: "array",
        minItems: 0,
        maxItems: 10,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            key: { type: "string" },
            label: { type: "string" },
            type: { type: "string" },
            reason: { type: "string" },
            balancing_intent: { type: "string", enum: ["narrow", "broaden", "clarify"] },
            options: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  value: { type: "string" },
                  label: { type: "string" },
                  is_default: { type: "boolean" }
                },
                required: ["value", "label", "is_default"]
              }
            }
          },
          required: ["key", "label", "type", "reason", "balancing_intent", "options"],
        },
      },
    },
    required: ["scope_analysis", "questions"],
  },
} as const

  const controller = new AbortController()
  const timeoutMs = Math.max(3000, Math.min(30000, Number(input.context?.timeoutMs ?? 30000)))
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const startedAt = Date.now()
    const baseUrl = config.llm.baseUrl || "https://api.openai.com/v1"
    // first attempt
    const makeCall = async (instructions: string, attempt: number) => {
      // Making API call to OpenAI
      
      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: instructions },
            { role: "user", content: user }
          ],
          max_completion_tokens: 600, // Reduced for faster response
          response_format: { type: "json_schema", json_schema: ClarifierSchema }
        }),
        signal: controller.signal,
      })
      if (!resp.ok) {
        let raw = ""
        try { raw = await resp.text() } catch {}
        console.error(`[clarifier] attempt=${attempt} HTTP ${resp.status} ${raw.slice(0,600)}`)
        throw new Error(`HTTP ${resp.status}`)
      }
      const data = await resp.json()
      // For Chat Completions API, the content is in choices[0].message.content
      const ccContent = data.choices?.[0]?.message?.content || "{}"
      let parsed: any
      try {
        parsed = JSON.parse(ccContent)
      } catch {
        const cleaned = ccContent.replace(/^```[a-zA-Z]*\n?|```$/g, "").trim()
        const start = cleaned.indexOf('{')
        const end = cleaned.lastIndexOf('}')
        if (start >= 0 && end > start) {
          parsed = JSON.parse(cleaned.slice(start, end + 1))
        } else {
          throw new Error("Invalid JSON from model")
        }
      }
      const questions = Array.isArray(parsed.questions) ? parsed.questions : []
      if (!questions || questions.length === 0) {
        console.warn(`[clarifier] attempt=${attempt} empty questions; preview=${ccContent.slice(0,600)}`)
      }
      return { data, ccContent, parsed, questions }
    }

    let { data, ccContent, parsed, questions } = await makeCall(system, 1)
    
    // single retry if no questions OR too few questions for broad queries
    const needsMoreQuestions = isOverlyBroad && questions && questions.length < 5
    
    if (!questions || questions.length === 0 || needsMoreQuestions) {
      const retryReason = !questions || questions.length === 0 
        ? "no questions generated" 
        : `only ${questions.length} questions for broad query`
      
      console.log(`${logPrefix} Retrying due to: ${retryReason}`)
      
      const retrySystem = isOverlyBroad
        ? `${system}\nSTRICT: This is a VERY BROAD query. You MUST generate ${Math.min(8, minQuestions)} specific questions to narrow the scope. Use real therapeutic areas, specific modalities, and concrete development stages.`
        : `${system}\nSTRICT: Your output MUST include at least one high-leverage question that either narrows or broadens (modality, geography, stage, unit, exclusions).`
      
      ;({ data, ccContent, parsed, questions } = await makeCall(retrySystem, 2))
    }

    // Calculate completeness based on scope analysis and questions generated
    const scopeAnalysis = parsed.scope_analysis
    const hasQuestions = questions && questions.length > 0
    
    // If no questions generated, it means query was insufficient or perfectly balanced
    let completeness = 0.3 // Default for queries needing clarification
    
    if (!hasQuestions) {
      // No questions could mean insufficient query OR perfectly balanced query
      const reasoning = scopeAnalysis?.reasoning?.toLowerCase() || ""
      
      if (reasoning.includes("insufficient") || reasoning.includes("resubmit") || reasoning.includes("not pharmaceutical")) {
        completeness = 0.1 // Very low completeness for bad queries
      } else if (scopeAnalysis?.query_type === "balanced") {
        completeness = 0.9 // High completeness for well-balanced queries
      } else {
        completeness = 0.1 // Default low for unclear cases
      }
    } else if (scopeAnalysis?.query_type === "balanced") {
      completeness = 0.8
    }
    
    console.log(`${logPrefix} Final output`, {
      questionCount: questions?.length || 0,
      scopeType: scopeAnalysis?.query_type,
      completeness,
      isOverlyBroad,
      expectedQuestions: minQuestions
    })
    
    return {
      completeness,
      questions: questions || [],
      debug: {
        provider,
        model,
        request: { endpoint: "responses", model },
        response: { id: data.id, usage: data.usage, latencyMs: Date.now() - startedAt },
        rawPreview: typeof ccContent === 'string' ? ccContent.slice(0, 800) : JSON.stringify(ccContent).slice(0, 800),
        parsed,
        scopeAnalysis,
      },
    }
  } catch (e) {
    const err = e as Error
    throw new Error(`Clarifier failed: ${err.message}`)
  } finally {
    clearTimeout(timeout)
  }
}


