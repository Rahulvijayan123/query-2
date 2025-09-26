import { expect } from "vitest"
import * as matchers from "@testing-library/jest-dom/matchers"
import fs from "node:fs"
import path from "node:path"
import dotenv from "dotenv"

// Load .env.local for tests so route handlers see Supabase/OpenAI keys
const envLocal = path.resolve(process.cwd(), ".env.local")
if (fs.existsSync(envLocal)) {
  dotenv.config({ path: envLocal })
} else {
  dotenv.config()
}

// Validate critical envs to avoid cryptic failures
const requiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
]
for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required env: ${key}. Populate in .env.local before running tests.`)
  }
}

// @ts-expect-error jest-dom types
expect.extend(matchers)


