import { assertClarifySchema } from "@/lib/supabase/guard"
import { spawnSync } from "node:child_process"
import path from "node:path"

async function main() {
  try {
    await assertClarifySchema()
    console.log("Clarify schema present.")
    process.exit(0)
  } catch {
    const token = process.env.SUPABASE_ACCESS_TOKEN
    const projectRef = process.env.SUPABASE_PROJECT_REF

    if (token && projectRef) {
      console.log("Clarify schema missing. Attempting to apply via Supabase CLI...")
      let r = spawnSync("supabase", ["login", "--token", token], { stdio: "inherit" })
      if (r.status !== 0) process.exit(r.status ?? 1)

      r = spawnSync("supabase", ["link", "--project-ref", projectRef], { stdio: "inherit" })
      if (r.status !== 0) process.exit(r.status ?? 1)

      r = spawnSync("supabase", ["db", "push"], { stdio: "inherit" })
      if (r.status !== 0) process.exit(r.status ?? 1)

      try {
        await assertClarifySchema()
        console.log("Clarify schema applied successfully.")
        process.exit(0)
      } catch (e: any) {
        console.error("Schema still missing after push:", e?.message || e)
        process.exit(1)
      }
    } else {
      const file = path.resolve("supabase/migrations/20250101_clarify.sql")
      console.error(
        `Clarify schema missing. Open Supabase SQL editor and paste file: supabase/migrations/20250101_clarify.sql\n(Local absolute path: ${file})`
      )
      process.exit(2)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
