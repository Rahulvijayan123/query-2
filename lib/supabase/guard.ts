import { createAdminClient } from "@/lib/supabase/admin"

export async function assertClarifySchema(): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from("clarification_sessions").select("id").limit(1)
  if (error) {
    throw new Error("Clarify schema missing: ensure migrations are applied")
  }
}


