import { getRecentQueries } from "@/lib/actions/queries"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export async function RecentQueries({ email }: { email?: string }) {
  const result = await getRecentQueries(email)
  const queries = result.success && Array.isArray(result.data) ? result.data : []

  return (
    <Card className="mt-12 bg-card/95 backdrop-blur-sm border-border/50 rounded-2xl">
      <CardHeader>
        <CardTitle className="text-xl font-semibold tracking-tight">Recent queries</CardTitle>
      </CardHeader>
      <CardContent>
        {queries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent queries yet.</p>
        ) : (
          <div className="space-y-4">
            {queries.map((q: any, idx: number) => (
              <div key={q.id ?? idx} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-foreground/90">{q.query_text ?? "(no text)"}</p>
                  <span className="text-xs text-muted-foreground">{new Date(q.created_at).toLocaleString()}</span>
                </div>
                {idx < queries.length - 1 && <Separator />}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}


