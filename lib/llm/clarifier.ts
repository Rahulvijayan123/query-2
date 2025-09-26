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
  const system = `You are an elite pharmaceutical intelligence analyst with 20+ years in drug discovery, competitive intelligence, and market research. You possess deep domain expertise across molecular biology, clinical development, regulatory affairs, and commercial strategy.

CRITICAL ANALYSIS FRAMEWORK:

STEP 1: DOMAIN RESEARCH & CONTEXT BUILDING
- Analyze the therapeutic space mentioned in the query
- Consider current market dynamics, competitive landscape, and regulatory environment
- Identify key players, breakthrough technologies, and emerging trends in that space
- Reference specific companies, drug names, targets, and market dynamics

STEP 2: SCOPE ASSESSMENT
- Determine if query is TOO BROAD (vague, multiple areas, lacks specificity)
- Determine if query is TOO SPECIFIC (very narrow, single target/indication)
- Determine if query is BALANCED (appropriate scope for meaningful analysis)

STEP 3: STRATEGIC QUESTION GENERATION
Based on scope assessment:

IF TOO BROAD → Ask highly specific narrowing questions:
- "Should we focus specifically on KRASG12C inhibitors like sotorasib and adagrasib, or include broader RAS pathway modulators?"
- "Do you want to limit to Phase 3 assets with primary endpoints met, excluding earlier-stage programs?"
- "Should we focus on solid tumors only, or include hematological malignancies with similar mechanisms?"

IF TOO SPECIFIC → Ask targeted expansion questions:
- "Should we also include [related mechanism/pathway] inhibitors like [specific examples]?"
- "Do you want to expand to include combination therapies with [current standard of care]?"
- "Should we consider [adjacent indication] where similar mechanisms apply?"

IF BALANCED → Ask refinement questions:
- "Should we exclude biosimilars and focus on innovative mechanisms only?"
- "Do you want to include assets with regulatory fast-track designations?"

QUESTION REQUIREMENTS:
- Every question MUST be answerable with YES or NO only
- Include specific drug names, company names, molecular targets, and regulatory designations
- Demonstrate deep pharmaceutical domain knowledge
- Reference current market realities and competitive dynamics
- Use precise scientific and regulatory terminology

VALIDATION RULES:
- If query lacks pharmaceutical context → return NO questions with guidance
- All questions must showcase domain expertise that would impress pharma executives
- Never ask generic questions - every question should be highly specific to the exact therapeutic area mentioned`
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
  
  const user = `PHARMACEUTICAL QUERY: "${input.originalQuery}"
${supContextBlock}

MISSION: Conduct deep domain analysis and generate ${minQuestions} ultra-specific clarifying questions that demonstrate pharmaceutical executive-level expertise.

ANALYSIS STEPS:

1. THERAPEUTIC SPACE RESEARCH:
   - What is the current competitive landscape in this area?
   - Who are the key players and what are their lead assets?
   - What are the breakthrough technologies and emerging mechanisms?
   - What regulatory pathways and market dynamics are relevant?

2. SCOPE ASSESSMENT:
   - Is this query TOO BROAD (multiple areas, vague terms)?
   - Is this query TOO SPECIFIC (very narrow focus)?
   - Is this query BALANCED (appropriate scope)?

3. STRATEGIC QUESTION GENERATION (${minQuestions} questions):

IF TOO BROAD → Generate highly specific narrowing questions:
- Reference exact drug names, companies, and molecular mechanisms
- Ask about specific clinical stages, regulatory designations
- Mention precise therapeutic areas and patient populations

IF TOO SPECIFIC → Generate targeted expansion questions:
- Suggest related mechanisms, combination therapies
- Ask about adjacent indications or broader patient populations
- Reference complementary approaches in the same space

IF BALANCED → Generate refinement questions:
- Ask about competitive positioning, regulatory advantages
- Focus on strategic differentiators and market access

CRITICAL REQUIREMENTS FOR PHARMACEUTICAL EXECUTIVE-LEVEL QUESTIONS:
- Every question MUST be answerable with YES or NO only
- Include SPECIFIC drug names: pembrolizumab (Keytruda), sotorasib (Lumakras), trastuzumab deruxtecan (Enhertu), osimertinib (Tagrisso), venetoclax (Venclexta)
- Reference SPECIFIC companies with their lead assets: Roche/Genentech (Tecentriq, Avastin), Merck (Keytruda), AstraZeneca (Tagrisso, Imfinzi), Gilead (Trodelvy), BMS (Opdivo, Yervoy)
- Mention EXACT molecular targets with mutations: KRASG12C, PD-L1 expression >50%, HER2 3+/2+ IHC, EGFR exon 19 deletions/L858R, ALK rearrangements, ROS1 fusions
- Use PRECISE regulatory terms: FDA Breakthrough Therapy, EMA PRIME, Fast Track, Orphan Drug, Accelerated Approval, Priority Review
- Reference SPECIFIC clinical endpoints: Overall Survival (OS), Progression-Free Survival (PFS), Objective Response Rate (ORR), Duration of Response (DOR)
- Include COMPETITIVE intelligence: market share, pipeline positioning, patent expiries, biosimilar competition
- Reference SPECIFIC biomarkers and companion diagnostics: PD-L1 22C3, HER2 IHC/FISH, MSI-H/dMMR, TMB-H, NTRK fusions

OUTPUT FORMAT:
- scope_analysis: {query_type, reasoning}
- questions: Array of ${minQuestions} questions with type="single_select", yes/no options only
- Each question must include specific 'reason' and 'balancing_intent'

Respond with ONLY valid JSON. Demonstrate the depth of knowledge that would impress pharmaceutical industry executives.`
  
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


