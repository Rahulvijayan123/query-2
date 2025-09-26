export function ConvexiaBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-black" />

      <div className="absolute top-20 right-10 w-32 h-32 bg-emerald-400/30 rounded-full blur-2xl animate-pulse" />
      <div className="absolute top-40 right-32 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl animate-pulse delay-500" />
      <div className="absolute top-60 right-20 w-24 h-24 bg-teal-400/25 rounded-full blur-xl animate-pulse delay-1000" />
      <div className="absolute bottom-32 right-16 w-64 h-64 bg-emerald-400/15 rounded-full blur-3xl animate-pulse delay-1500" />
      <div className="absolute bottom-20 right-40 w-40 h-40 bg-teal-500/20 rounded-full blur-2xl animate-pulse delay-2000" />

      <div className="absolute top-1/3 left-10 w-20 h-20 bg-emerald-300/20 rounded-full blur-xl animate-pulse delay-700" />
      <div className="absolute bottom-1/3 left-20 w-36 h-36 bg-teal-400/15 rounded-full blur-2xl animate-pulse delay-1200" />
    </div>
  )
}
