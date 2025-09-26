export function isTestMode(): boolean {
  return (
    process.env.LLM_FAKE === '1' ||
    process.env.CI === 'true' ||
    process.env.NODE_ENV === 'test'
  )
}

export function useMemoryStore(): boolean {
  // Explicit test/dev flags
  if (process.env.STORAGE_MODE === 'memory' || process.env.CI === 'true') return true
  // Fallback: if Supabase env is not configured, prefer in-memory to keep
  // multi-request flows (POST → GET) working locally and in tests.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return true
  return false
}


