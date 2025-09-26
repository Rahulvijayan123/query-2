import { isTestMode } from "@/lib/runtime"

export async function buildEnriched(input: { originalQuery: string; answersJson: Record<string, unknown>; email?: string; feedback?: string }) {
  const startTime = Date.now()
  const logPrefix = `[THESIS-GENERATOR]`
  
  console.log(`${logPrefix} Starting thesis generation`, {
    query: input.originalQuery,
    answerCount: Object.keys(input.answersJson || {}).length,
    email: input.email,
    timestamp: new Date().toISOString()
  })
  
  const model = process.env.ENRICHER_MODEL || process.env.OPENAI_MODEL || 'gpt-4o'
  const apiKey = process.env.OPENAI_API_KEY as string
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'

  console.log(`${logPrefix} Model configuration`, {
    model,
    hasApiKey: !!apiKey,
    baseUrl
  })

  // Anti-loop validation
  if (!input.originalQuery || input.originalQuery.trim().length < 3) {
    console.error(`${logPrefix} Invalid query provided`, { query: input.originalQuery })
    throw new Error("Query too short or empty for thesis generation")
  }
  
  // Content validation for pharma relevance
  const queryLower = input.originalQuery.toLowerCase()
  const nonPharmaKeywords = [
    'everything', 'anything', 'random', 'test', 'hello', 'hi',
    'fuck', 'shit', 'damn', 'hell', 'ass', 'bitch', 'sex', 'porn', 'nsfw'
  ]
  
  const hasNonPharmaContent = nonPharmaKeywords.some(keyword => 
    queryLower.includes(keyword) || queryLower === keyword
  )
  
  if (hasNonPharmaContent) {
    console.warn(`${logPrefix} Non-pharma content detected in thesis generation`, { query: input.originalQuery })
    // Return a structured "not enough information" response
    const fallback = {
      thesis: {
        executive_summary: "Not enough information provided to generate a meaningful pharmaceutical analysis.",
        key_assumptions: [
          "The provided query does not contain sufficient pharmaceutical or biotech-related information",
          "A valid query should specify drug targets, indications, modalities, or therapeutic areas",
          "More specific information is needed to conduct meaningful asset research"
        ],
        refined_scope: "Unable to define scope due to insufficient pharmaceutical context",
        search_parameters: {
          primary_targets: [],
          indication_focus: [],
          development_stages: [],
          modality_filters: [],
          geographic_scope: [],
          exclusion_criteria: []
        },
        strategic_rationale: "Cannot provide strategic guidance without relevant pharmaceutical context. Please provide a query related to drug assets, therapeutic areas, or biotech research.",
        market_intelligence: "Please re-enter your query with specific pharmaceutical or biotech-related terms to enable meaningful analysis."
      }
    }
    
    return JSON.stringify(fallback)
  }

  const startedAt = Date.now()
  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), 30000)

  const system = `You are an elite pharma intelligence analyst with 15+ years experience in drug discovery, clinical development, and competitive intelligence. Your analyses are used by C-suite executives for strategic decision-making.

Based on the original query and clarifying answers, generate a comprehensive, authoritative thesis that demonstrates deep pharma expertise.

VALIDATION RULES:
- If the query lacks pharmaceutical context (no drug names, targets, indications, modalities), respond with "Not enough information" structure
- If the query is non-pharmaceutical (random text, profanity, irrelevant topics), respond with "Not enough information" structure
- Only generate full analysis for legitimate pharmaceutical/biotech queries
 - Validate and canonicalize all user-provided parameters (fix misspellings, map brand→generic names, normalize modality/stage terms). If a term is unknown or non-pharma, exclude it and mention that in assumptions.

Output structure (JSON only):
{
  "thesis": {
    "executive_summary": "Compelling 2-3 sentence summary positioning this as a strategic opportunity OR 'Not enough information provided for pharmaceutical analysis'",
    "key_assumptions": [
      "Market-based assumption with competitive context",
      "Clinical development assumption with regulatory insight", 
      "Commercial assumption with pharma business model context"
    ],
    "refined_scope": "Precisely defined scope using VALIDATED parameters (after correction) OR 'Unable to define scope due to insufficient pharmaceutical context'",
    "search_parameters": {
      "primary_targets": ["specific molecular targets"],
      "indication_focus": ["specific therapeutic areas"],
      "development_stages": ["clinical phases or pre-clinical"],
      "modality_filters": ["drug types/formulations"],
      "geographic_scope": ["markets/regions"],
      "exclusion_criteria": ["what to filter out"]
    },
    "strategic_rationale": "Why this scope balances opportunity size with competitive differentiation OR request for more specific pharmaceutical information",
    "market_intelligence": "Brief insight on competitive dynamics or market trends relevant to this search OR guidance to re-enter with pharmaceutical context"
  }
}

CRITICAL: Demonstrate pharma expertise through:
- Specific knowledge of drug development timelines, regulatory pathways
- Understanding of competitive landscapes and market dynamics  
- Insight into commercial considerations (pricing, market access, etc.)
- Strategic thinking about portfolio positioning
- Professional terminology and authoritative tone

Do NOT use markdown formatting or code blocks.`

  const user = `ORIGINAL QUERY: ${input.originalQuery}

USER ANSWERS: ${JSON.stringify(input.answersJson, null, 2)}

USER EMAIL: ${input.email || 'not provided'}

${input.feedback ? `
USER FEEDBACK ON PREVIOUS THESIS: ${input.feedback}

Please incorporate this feedback and make the requested changes.
` : ''}

Generate a thesis based on this information.`

  try {
    console.log(`${logPrefix} Making API call`, {
      model,
      systemPromptLength: system.length,
      userPromptLength: user.length
    })

    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        max_completion_tokens: 500 // Reduced for faster response while maintaining quality
      }),
      signal: ctrl.signal,
    })
    
    if (!resp.ok) {
      let errorText = ""
      try { errorText = await resp.text() } catch {}
      console.error(`${logPrefix} API call failed`, {
        status: resp.status,
        error: errorText.slice(0, 300),
        model
      })
      throw new Error(`HTTP ${resp.status}: ${errorText.slice(0, 100)}`)
    }
    
    const data = await resp.json()
    clearTimeout(timeout)
    const content = data.choices?.[0]?.message?.content || '{}'
    
    console.log(`${logPrefix} API call successful`, {
      model,
      responseLength: content.length,
      duration: Date.now()-startedAt
    })
    
    // Clean and validate response content
    let cleanContent = content.trim()
    
    // Remove markdown code blocks if present
    if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim()
    }
    
    try {
      const parsed = JSON.parse(cleanContent)
      if (!parsed.thesis && !parsed.filters) {
        console.warn(`${logPrefix} Response missing expected fields`, {
          keys: Object.keys(parsed),
          contentPreview: cleanContent.slice(0, 200)
        })
      } else {
        console.log(`${logPrefix} Thesis generation successful`, {
          hasThesis: !!parsed.thesis,
          hasFilters: !!parsed.filters,
          totalDuration: Date.now() - startTime
        })
      }
      
      return cleanContent // Return the cleaned JSON
    } catch (parseErr) {
      console.error(`${logPrefix} Invalid JSON response - applying fallback`, {
        error: parseErr,
        originalContent: content.slice(0, 300),
        cleanedContent: cleanContent.slice(0, 300)
      })
      
      // Return structured fallback
      const fallback = {
        thesis: {
          summary: `Analysis of ${input.originalQuery}`,
          key_findings: ["Detailed analysis requires additional research"],
          recommendations: ["Manual review recommended"]
        },
        filters: { 
          unit: 'asset', 
          assumptions: [`JSON parse error: ${parseErr.message}`], 
          notes: 'fallback_due_to_parse_error' 
        }
      }
      
      return JSON.stringify(fallback)
    }
    
    return content
  } catch (e) {
    const err = e as Error
    console.error(`${logPrefix} Thesis generation failed - providing fallback`, {
      model,
      duration: Date.now()-startedAt,
      error: err.message,
      query: input.originalQuery
    })
    
    // Enhanced fallback with more context
    const fallback = {
      thesis: {
        summary: `Analysis of ${input.originalQuery}`,
        key_findings: [
          "This query requires further research to provide specific insights",
          "Manual follow-up recommended for detailed analysis"
        ],
        recommendations: [
          "Gather additional data sources",
          "Consult domain experts",
          "Perform market research"
        ]
      },
      filters: { 
        unit: 'asset', 
        assumptions: [`Fallback response due to API error: ${err.message}`], 
        notes: 'fallback_generated' 
      }
    }
    
    return JSON.stringify(fallback)
  }
}


