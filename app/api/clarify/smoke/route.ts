import { z } from "zod"
import { askClarifier } from "@/lib/llm/clarifier"

const Body = z.object({
  originalQuery: z.string().min(1),
  context: z
    .object({
      domain: z.enum(["code", "analysis", "docs", "qa", "other"]).optional(),
    })
    .optional(),
  maxQuestions: z.number().int().positive().max(10).optional(),
})

export async function POST(req: Request) {
  const body = Body.parse(await req.json())
  const clarifier = await askClarifier({
    originalQuery: body.originalQuery,
    context: body.context,
    maxQuestions: body.maxQuestions ?? 5,
  })
  return Response.json(clarifier)
}


