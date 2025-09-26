import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { buildEnriched } from "@/lib/llm/enricher"

const Body = z.object({
  sessionId: z.string().uuid(),
  feedback: z.string().min(1),
})

export async function POST(req: Request) {
  const logPrefix = `[REGENERATE-THESIS]`
  console.log(`${logPrefix} Regeneration request received`)

  try {
    const body = Body.parse(await req.json())
    const supabase = createAdminClient()

    // Get session and original query
    const { data: session } = await supabase
      .from("clarification_sessions")
      .select("original_query")
      .eq("id", body.sessionId)
      .single()

    if (!session) {
      console.error(`${logPrefix} Session not found: ${body.sessionId}`)
      return new Response(JSON.stringify({ error: "Session not found" }), { status: 404 })
    }

    // Get existing answers
    const { data: answers } = await supabase
      .from("clarification_answers")
      .select("question_id, value, clarification_questions(key, label)")
      .eq("session_id", body.sessionId)

    const answersJson = answers?.reduce((acc, ans) => {
      const questionData = ans.clarification_questions as any
      acc[questionData?.key || ans.question_id] = ans.value
      return acc
    }, {} as Record<string, any>) || {}

    console.log(`${logPrefix} Regenerating with feedback`, {
      sessionId: body.sessionId,
      feedbackLength: body.feedback.length,
      answerCount: Object.keys(answersJson).length
    })

    // Enhanced system prompt with feedback integration
    const enhancedInput = {
      originalQuery: session.original_query,
      answersJson,
      email: undefined,
      feedback: body.feedback // Add feedback to the input
    }

    // Generate new thesis with feedback
    const newThesis = await buildEnriched(enhancedInput)

    console.log(`${logPrefix} Thesis regenerated successfully`, {
      sessionId: body.sessionId,
      newThesisLength: newThesis.length
    })

    return Response.json({ 
      thesis: newThesis,
      sessionId: body.sessionId 
    })

  } catch (error) {
    console.error(`${logPrefix} Error:`, error)
    return new Response(
      JSON.stringify({ error: "Failed to regenerate thesis" }), 
      { status: 500 }
    )
  }
}
