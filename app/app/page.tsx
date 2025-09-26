import { requireAuth } from "@/lib/auth"
import { ConvexiaBackground } from "@/components/convexia-background"
import { AppNavigation } from "@/components/app-navigation"
import { QueryComposer } from "@/components/query-composer"
// removed RecentQueries per product request

export default async function AppPage() {
  await requireAuth()

  return (
    <div className="min-h-screen">
      <ConvexiaBackground />
      <AppNavigation />
      <main className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-foreground mb-6">
              Uncover Drug Assets <span className="text-emerald-400">10x faster</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Give us context; we'll do the digging.
            </p>
          </div>

          {/* Query Composer */}
          <QueryComposer />

          {/* Recent Queries removed */}
        </div>
      </main>
    </div>
  )
}
