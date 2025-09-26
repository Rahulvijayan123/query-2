"use server"

import { createClient } from "@/lib/supabase/server"
import { sendQueryNotificationEmail } from "@/lib/email"
import { requireAuth } from "@/lib/auth"

export interface QueryResult {
  success: boolean
  error?: string
  data?: any
}

const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"

export async function saveQuery(formData: FormData): Promise<QueryResult> {
  try {
    await requireAuth()

    const queryText = formData.get("query") as string
    const facets = formData.get("facets") as string
    const email = formData.get("email") as string



    if (!email) {
      return {
        success: false,
        error: "Email is required",
      }
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from("queries")
      .insert({
        user_id: DEMO_USER_ID,
        email,
        facets: facets || null,
        query_text: queryText,
      })
      .select("id, email, facets, query_text, created_at")
      .single()

    if (error) {
      console.error("[v0] Supabase error:", error)
      return {
        success: false,
        error: `Failed to save query: ${error.message}`,
      }
    }

    // Fire-and-forget email notification; do not block user on email failures
    try {
      await sendQueryNotificationEmail({
        email: data?.email,
        facets: data?.facets,
        query_text: data?.query_text,
        created_at: data?.created_at,
      })
    } catch (emailError) {
      console.error("[v0] Email notification error:", emailError)
    }

    return {
      success: true,
      data,
    }
  } catch (error) {
    console.error("[v0] Save query error:", error)
    return {
      success: false,
      error: "An unexpected error occurred",
    }
  }
}

export async function getRecentQueries(email?: string): Promise<QueryResult> {
  try {
    await requireAuth()

    const supabase = await createClient()

    // If an email is provided, filter by it; otherwise default to demo user_id
    const query = supabase
      .from("queries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5)

    const builder = email && email.trim().length > 0 ? query.eq("email", email) : query.eq("user_id", DEMO_USER_ID)

    const { data, error } = await builder

    if (error) {
      console.error("[v0] Supabase error:", error)
      return {
        success: false,
        error: "Failed to fetch queries",
      }
    }

    return {
      success: true,
      data: data || [],
    }
  } catch (error) {
    console.error("[v0] Get queries error:", error)
    return {
      success: false,
      error: "An unexpected error occurred",
    }
  }
}
