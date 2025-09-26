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
  
  const model = process.env.ENRICHER_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini'
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
  
  console.log(`${logPrefix} Non-pharma validation`, {
    query: input.originalQuery,
    queryLower,
    hasNonPharmaContent,
    matchingKeywords: nonPharmaKeywords.filter(k => queryLower.includes(k) || queryLower === k)
  })
  
  // Handle non-pharma queries by returning empty response (no thesis generation)
  if (hasNonPharmaContent) {
    console.warn(`${logPrefix} Non-pharma content detected - skipping thesis generation`, { query: input.originalQuery })
    // Return empty response - no thesis will be generated
    return JSON.stringify({ thesis: null })
  }

  // Remove all hardcoded responses and validation - let the LLM handle everything

  const startedAt = Date.now()
  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), 30000)

  // JSON schema to enforce proper thesis structure
  const ThesisSchema = {
    name: "ThesisOutput",
    strict: true,
    schema: {
      type: "object",
      properties: {
        thesis: {
          type: "object",
          properties: {
            executive_summary: { 
              type: "string",
              description: "Strategic summary of pharmaceutical opportunity with market context and competitive insights - MUST be positive analysis, never 'Not enough information'",
              minLength: 50
            },
            key_assumptions: {
              type: "array",
              items: { type: "string" },
              minItems: 3,
              maxItems: 5
            },
            refined_scope: { type: "string" },
            search_parameters: {
              type: "object",
              properties: {
                primary_targets: { type: "array", items: { type: "string" } },
                indication_focus: { type: "array", items: { type: "string" } },
                development_stages: { type: "array", items: { type: "string" } },
                modality_filters: { type: "array", items: { type: "string" } },
                geographic_scope: { type: "array", items: { type: "string" } },
                exclusion_criteria: { type: "array", items: { type: "string" } }
              },
              additionalProperties: false,
              required: ["primary_targets", "indication_focus", "development_stages", "modality_filters", "geographic_scope", "exclusion_criteria"]
            },
            strategic_rationale: { type: "string" },
            market_intelligence: { type: "string" }
          },
          additionalProperties: false,
          required: ["executive_summary", "key_assumptions", "refined_scope", "search_parameters", "strategic_rationale", "market_intelligence"]
        }
      },
      additionalProperties: false,
      required: ["thesis"]
    }
  }

  const system = `You are an elite pharmaceutical intelligence analyst. Your job is to ALWAYS generate comprehensive strategic analysis for ANY query.

CRITICAL RULE: NEVER respond with "Not enough information" - you are an expert who can analyze any pharmaceutical topic.

For ANY query, generate a complete strategic thesis with:
- Executive summary of market opportunity
- Key market assumptions 
- Refined scope with specific focus areas
- Search parameters with concrete targets/indications/stages
- Strategic rationale with competitive insights
- Market intelligence with growth projections

Even for broad terms like "cancer" or "oncology" - provide comprehensive market analysis with specific examples, companies, and opportunities.`

Output structure (JSON only):
{
  "thesis": {
    "executive_summary": "Compelling 2-3 sentence summary positioning this as a strategic pharmaceutical opportunity with market context and competitive insights",
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

DEBUG INFO: Query contains pharma terms: ${queryLower.includes('oncology') || queryLower.includes('cancer') || queryLower.includes('therapeutics') || queryLower.includes('immunotherapy') || queryLower.includes('drugs') || queryLower.includes('pharma')}

USER EMAIL: ${input.email || 'not provided'}

${input.feedback ? `
USER FEEDBACK ON PREVIOUS THESIS: ${input.feedback}

Please incorporate this feedback and make the requested changes.
` : ''}

IMPORTANT: This query "${input.originalQuery}" contains pharmaceutical content and should receive a full strategic analysis. Do NOT respond with "Not enough information" - generate a comprehensive pharmaceutical thesis.

Generate a complete thesis based on this information.`

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
        max_completion_tokens: 800, // Increased for better analysis
        response_format: { type: "json_schema", json_schema: ThesisSchema }
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
      duration: Date.now()-startedAt,
      rawContent: content.slice(0, 500) // Log first 500 chars of response
    })
    
    // Clean and validate response content
    let cleanContent = content.trim()
    
    // Remove markdown code blocks if present
    if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim()
    }
    
    try {
      const parsed = JSON.parse(cleanContent)
      
      // Handle "Not enough information" responses by returning no thesis
      if (parsed.thesis && parsed.thesis.executive_summary && (parsed.thesis.executive_summary.toLowerCase().includes('not enough information') || parsed.thesis.executive_summary.includes('Not enough information'))) {
        console.log(`${logPrefix} 🔧 Detected 'Not enough information' response, skipping thesis generation`)
        // Return null thesis - no thesis will be shown to user
        return JSON.stringify({ thesis: null })
      }
      
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


