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
  const system = `You are a pharmaceutical intelligence analyst with 25+ years of experience. You MUST follow these rules EXACTLY:

CRITICAL RULE #1: QUESTION FORMAT
- EVERY question MUST be answerable with ONLY "YES" or "NO"
- NEVER ask questions that require explanations, lists, or open-ended responses
- If a question cannot be answered with YES/NO, DO NOT ASK IT

CRITICAL RULE #2: QUESTION QUANTITY (NON-NEGOTIABLE)
- For BROAD queries (vague, multiple areas): Generate EXACTLY 7-10 questions (MANDATORY)
- For SPECIFIC queries (narrow focus): Generate EXACTLY 4-5 questions (MANDATORY)
- For BALANCED queries: Generate EXACTLY 5-6 questions (MANDATORY)
- FAILURE TO MEET QUANTITY REQUIREMENTS WILL RESULT IN SYSTEM REJECTION

CRITICAL RULE #3: PHARMACEUTICAL SPECIFICITY
Every question MUST include:
- EXACT drug names with brand names: "pembrolizumab (Keytruda)", "osimertinib (Tagrisso)"
- SPECIFIC companies: "Roche", "Merck KGaA", "AstraZeneca", "Bristol Myers Squibb"
- PRECISE molecular targets: "EGFR exon 19 deletions", "KRASG12C mutations", "PD-L1 expression ≥50%"
- EXACT regulatory designations: "FDA Breakthrough Therapy", "EMA PRIME", "Orphan Drug status"

EXAMPLES OF CORRECT YES/NO QUESTIONS:
✅ "Should we focus exclusively on KRASG12C inhibitors like sotorasib (Lumakras) and adagrasib (Krazati)?"
✅ "Do you want to include only assets with FDA Breakthrough Therapy designation?"
✅ "Should we limit to pembrolizumab (Keytruda) and nivolumab (Opdivo) for PD-1/PD-L1 targeting?"
✅ "Do you want to exclude biosimilars and focus only on novel molecular entities (NMEs)?"

EXAMPLES OF INCORRECT QUESTIONS (NEVER ASK THESE):
❌ "What specific molecular targets are you interested in?" (Open-ended)
❌ "Which companies should we focus on?" (Requires a list)
❌ "How do you define early-stage development?" (Requires explanation)

SCOPE ASSESSMENT RULES:
- TOO BROAD: "cancer", "oncology", "therapeutics", "drugs" without specifics
- TOO SPECIFIC: Single drug name, single company, very narrow indication
- BALANCED: Specific therapeutic area with defined scope

VALIDATION:
- If query is not pharmaceutical → return 0 questions
- Every question must pass the YES/NO test
- Every question must include specific pharmaceutical entities
- Every question must demonstrate executive-level domain expertise`
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
  const overlyBroadKeywords = [
    'everything', 'anything', 'all drugs', 'all medications', 'drugs', 'medicine',
    'oncology', 'cancer', 'therapeutics', 'therapy', 'treatment', 'pharmaceutical',
    'biotech', 'immunotherapy', 'targeted therapy'
  ]
  
  const hasNonPharmaContent = nonPharmaKeywords.some(keyword => 
    queryLower.includes(keyword) || queryLower === keyword
  )
  
  // Detect broad queries more effectively
  const isOverlyBroad = overlyBroadKeywords.some(keyword => 
    queryLower.includes(keyword)
  ) || (
    // Additional broad query patterns
    (queryLower.includes('cancer') || queryLower.includes('oncology')) && 
    !queryLower.includes('inhibitor') && 
    !queryLower.includes('specific') &&
    queryLower.split(' ').length <= 3
  )
  
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
  
  console.log(`${logPrefix} Query analysis:`, {
    query: input.originalQuery,
    isOverlyBroad,
    minQuestions,
    maxQuestions: input.maxQuestions,
    broadKeywordsFound: overlyBroadKeywords.filter(k => queryLower.includes(k)),
    calculatedMinQuestions: isOverlyBroad ? Math.max(5, Math.min(10, input.maxQuestions || 8)) : Math.max(3, Math.min(5, input.maxQuestions || 4))
  })
  
  if (isOverlyBroad) {
    console.warn(`${logPrefix} Overly broad query detected - forcing ${minQuestions} questions`, { query: input.originalQuery })
  }
  
  const user = `QUERY: "${input.originalQuery}"
${supContextBlock}

STRICT INSTRUCTIONS:

1. ASSESS SCOPE AND GENERATE EXACTLY ${minQuestions} QUESTIONS:
   - BROAD queries: "cancer", "oncology", "therapeutics" → MANDATORY ${minQuestions} questions (7-10 for broad)
   - SPECIFIC queries: Single drug/company/indication → MANDATORY ${minQuestions} questions (4-5 for specific)
   - BALANCED queries: Defined therapeutic area → MANDATORY ${minQuestions} questions (5-6 for balanced)
   
   THIS IS NON-NEGOTIABLE: You MUST generate exactly ${minQuestions} questions. No fewer, no excuses.

2. GENERATE EXACTLY ${minQuestions} QUESTIONS:
   Each question MUST:
   - Be answerable with YES or NO ONLY
   - Include specific drug names: "pembrolizumab (Keytruda)", "osimertinib (Tagrisso)"
   - Reference specific companies: "Roche", "Merck", "AstraZeneca", "Bristol Myers Squibb"
   - Mention exact targets: "EGFR exon 19 deletions", "KRASG12C mutations", "PD-L1 ≥50%"
   - Use regulatory terms: "FDA Breakthrough Therapy", "EMA PRIME", "Orphan Drug"

3. QUESTION VALIDATION TEST:
   Before including any question, ask: "Can this be answered with YES or NO?"
   If NO → Do not include the question
   If YES → Include the question

4. EXAMPLES FOR THIS QUERY TYPE:
   If BROAD ("oncology therapeutics") - GENERATE ALL ${minQuestions} QUESTIONS:
   ✅ "Should we focus exclusively on KRASG12C inhibitors like sotorasib (Lumakras) and adagrasib (Krazati)?"
   ✅ "Do you want to include only PD-1/PD-L1 inhibitors like pembrolizumab (Keytruda) and nivolumab (Opdivo)?"
   ✅ "Should we limit to assets with FDA Breakthrough Therapy designation?"
   ✅ "Do you want to exclude biosimilars and focus on novel molecular entities (NMEs) only?"
   ✅ "Should we focus on solid tumors and exclude hematological malignancies?"
   ✅ "Do you want to include only Phase 3 or commercially available assets?"
   ✅ "Should we limit to assets targeting HER2-positive tumors with trastuzumab deruxtecan (Enhertu)?"
   ✅ "Should we focus on assets with specific biomarkers like PD-L1 expression ≥50% or MSI-H status?"
   ✅ "Do you want to include only first-in-class mechanisms or also best-in-class improvements?"
   ✅ "Should we limit to assets from top 10 pharma companies (Roche, Pfizer, Merck, etc.)?"

CRITICAL: Generate EXACTLY ${minQuestions} questions. Each must pass the YES/NO test.

ABSOLUTE REQUIREMENT: Your response must contain exactly ${minQuestions} questions in the questions array.
If you generate fewer than ${minQuestions} questions, the system will fail.

Output ONLY valid JSON with scope_analysis and questions array containing exactly ${minQuestions} questions.`
  
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
        minItems: 3, // Will validate dynamically after generation
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
    
    // single retry if no questions OR too few questions
    if (!questions || questions.length < minQuestions) {
      const retryReason = !questions || questions.length === 0 
        ? "no questions generated" 
        : `only ${questions.length} questions for broad query`
      
      console.log(`${logPrefix} Retrying due to: ${retryReason}`)
      
      const retrySystem = `${system}

CRITICAL RETRY INSTRUCTION: 
The previous attempt generated only ${questions?.length || 0} questions but you MUST generate EXACTLY ${minQuestions} questions.

MANDATORY REQUIREMENTS:
- Generate EXACTLY ${minQuestions} questions (not fewer)
- Each question MUST be answerable with YES/NO only  
- Each question MUST include specific drug names, companies, and targets
- Use the examples provided in the system prompt as templates

FAILURE TO GENERATE ${minQuestions} QUESTIONS WILL RESULT IN SYSTEM FAILURE.`
      
      ;({ data, ccContent, parsed, questions } = await makeCall(retrySystem, 2))
      
      // Final fallback if still insufficient
      if (!questions || questions.length < minQuestions) {
        console.error(`${logPrefix} Final retry failed: got ${questions?.length || 0} questions, needed ${minQuestions}`)
        console.log(`${logPrefix} Adding fallback questions to meet requirement`)
        
        // Add domain-specific fallback questions to meet minimum requirement
        const fallbackQuestions = []
        const currentCount = questions?.length || 0
        const needed = minQuestions - currentCount
        
        const fallbackTemplates = [
          "Should we focus on assets with FDA Breakthrough Therapy designation only?",
          "Do you want to exclude biosimilars and focus on innovative mechanisms?", 
          "Should we limit to Phase 3 or commercially available assets?",
          "Do you want to focus on first-in-class mechanisms exclusively?",
          "Should we include only assets from top 15 pharmaceutical companies?",
          "Do you want to focus on assets with companion diagnostics?",
          "Should we limit to assets targeting specific biomarkers?",
          "Do you want to include combination therapies or monotherapies only?",
          "Should we focus on assets with orphan drug designation?",
          "Do you want to exclude generic or follow-on products?"
        ]
        
        for (let i = 0; i < needed && i < fallbackTemplates.length; i++) {
          fallbackQuestions.push({
            key: `domain_fallback_${i + 1}`,
            label: fallbackTemplates[i],
            type: "single_select",
            options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }],
            required: true,
            reason: "This helps narrow the scope to find the most relevant pharmaceutical assets",
            balancing_intent: "clarify"
          })
        }
        
        questions = [...(questions || []), ...fallbackQuestions]
        console.log(`${logPrefix} Added ${needed} domain-specific fallback questions, total: ${questions.length}`)
      }
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


