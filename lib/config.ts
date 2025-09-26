import fs from "node:fs"
import path from "node:path"

export type LlmProvider = "openai" | "anthropic" | "azure-openai"

export type AppConfig = {
  supabase: {
    url: string
    anonKey: string
    serviceRoleKey?: string
  }
  llm: {
    provider: LlmProvider
    model: string
    baseUrl?: string
    systemPromptPath?: string
    systemPrompt?: string
  }
}

function readEnv(name: string, { optional = false }: { optional?: boolean } = {}): string | undefined {
  const value = process.env[name]
  if (!optional && (!value || value.length === 0)) {
    throw new Error(`Missing required env: ${name}`)
  }
  return value
}

function loadSystemPrompt(systemPromptPath?: string): string | undefined {
  if (!systemPromptPath) return undefined
  try {
    const resolved = path.isAbsolute(systemPromptPath) ? systemPromptPath : path.resolve(process.cwd(), systemPromptPath)
    if (fs.existsSync(resolved)) {
      return fs.readFileSync(resolved, "utf8")
    }
  } catch {}
  return undefined
}

const providerRaw = (process.env.LLM_PROVIDER || "openai").toLowerCase()
const provider: LlmProvider = providerRaw === "anthropic" ? "anthropic" : providerRaw === "azure-openai" ? "azure-openai" : "openai"

export const config: AppConfig = {
  supabase: {
    url: readEnv("NEXT_PUBLIC_SUPABASE_URL") as string,
    anonKey: readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") as string,
    serviceRoleKey: readEnv("SUPABASE_SERVICE_ROLE_KEY", { optional: true }),
  },
  llm: {
    provider,
    model: process.env.OPENAI_MODEL || readEnv("LLM_MODEL", { optional: true }) || process.env.CLARIFIER_MODEL || "gpt-4o-mini",
    baseUrl: process.env.OPENAI_BASE_URL,
    systemPromptPath: process.env.SYSTEM_PROMPT_PATH,
    systemPrompt: loadSystemPrompt(process.env.SYSTEM_PROMPT_PATH),
  },
}

let probedModel: string | null = null

export async function assertServerSecrets(): Promise<void> {
  if (config.llm.provider === "openai") {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("Missing OPENAI_API_KEY. Set it in your environment.")
    }
    if (!config.llm.model) {
      throw new Error("Missing OPENAI_MODEL/LLM_MODEL. Set a valid model name in your env.")
    }
    if (probedModel !== config.llm.model) {
      try {
        await probeModelAvailability()
      } catch (e) {
        // Be lenient in dev: log and continue so requests can still flow
        console.warn("Model probe warning:", (e as Error).message)
      }
      probedModel = config.llm.model
    }
  }
  if (!config.supabase.serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY. Set it in your environment.")
  }
}

async function probeModelAvailability(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY as string
  const baseUrl = config.llm.baseUrl || "https://api.openai.com/v1"
  const model = config.llm.model

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    // Prefer Responses API probe
    let resp = await fetch(`${baseUrl}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, input: "ping" }),
      signal: controller.signal,
    })
    if (!resp.ok) {
      // Fallback to Chat Completions for probe
      resp = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages: [{ role: "user", content: "ping" }], max_completion_tokens: 1 }),
        signal: controller.signal,
      })
      if (!resp.ok) {
        // Do not hard fail the app if probe fails; log and continue
        let detail = ""
        try {
          const j = await resp.json()
          detail = j?.error?.message || JSON.stringify(j)
        } catch {
          try { detail = await resp.text() } catch {}
        }
        console.warn(`Model probe fell back and still failed for '${model}': ${resp.status}${detail ? ": " + detail : ""}`)
      }
    }
  } finally {
    clearTimeout(timeout)
  }
}
