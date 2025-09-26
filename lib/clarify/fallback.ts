type SupabaseInputs = {
  query_id?: string
  email?: string | null
  facets?: Record<string, any> | null
}

const stageKeywords = ["phase", "ph1", "ph2", "ph3", "fih", "pivotal", "registrational", "proof-of-concept", "ind", "cta"]
const geoKeywords = ["us", "united states", "eu", "europe", "uk", "japan", "china", "global"]
const modalityKeywords = ["antibody", "adc", "cell", "gene", "rna", "aso", "sirna", "car-t", "vector", "small molecule", "peptide", "biologic"]

function normalize(text: string | null | undefined): string {
  return (text || "").toLowerCase()
}

function chooseFallbackType(query: string, facets?: Record<string, any> | null): "stage" | "geo" | "modality" | "scope" {
  const q = normalize(query)
  const stageFacet = normalize(facets?.stage as string)
  if (stageKeywords.some((kw) => q.includes(kw) || stageFacet.includes(kw))) return "stage"
  const geoFacet = normalize(facets?.geography as string)
  if (geoKeywords.some((kw) => q.includes(kw) || geoFacet.includes(kw))) return "geo"
  const modalityFacet = normalize(facets?.modality as string)
  if (modalityKeywords.some((kw) => q.includes(kw) || modalityFacet.includes(kw))) return "modality"
  return "scope"
}

export function inputNeedsQuestion({ originalQuery }: { originalQuery: string; supabaseInputs?: SupabaseInputs }): boolean {
  // Requirement: always provide at least one high-value question if LLM skipped.
  return originalQuery.trim().length > 0
}

// Fallback question generation removed per product directive: no hard-coded questions.

export function inferQuestionType(q: any): "single_select" | "multi_select" | "text" | "textarea" | "number" | "date" | "file" {
  if (typeof q?.type === "string") return q.type
  if (Array.isArray(q?.options) && q.options.length > 0) return "single_select"
  return "text"
}

export function defaultQuestionOptions(q: any) {
  if (Array.isArray(q?.options) && q.options.length > 0) return q.options
  return [
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" },
  ]
}


