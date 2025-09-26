"use client"

import { useState } from "react"
import { useFormStatus } from "react-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { login } from "@/lib/actions/auth"
import Image from "next/image"

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      className="w-full bg-emerald-600 hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-200"
      disabled={pending}
    >
      {pending ? "Signing in..." : "Continue"}
    </Button>
  )
}

export function LoginForm() {
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setError(null)
    const result = await login(formData)
    if (!result.success && result.error) {
      setError(result.error)
    }
  }

  return (
    <Card className="w-full max-w-md bg-slate-900/95 backdrop-blur-sm border-emerald-500/20 rounded-2xl shadow-2xl shadow-emerald-500/10">
      <CardHeader className="space-y-6 text-center">
        <div className="flex items-center justify-center gap-3">
          <Image src="/convexia-logo.png" alt="Convexia" width={32} height={32} className="w-8 h-8" />
          <span className="text-2xl font-semibold tracking-tight text-white">Convexia</span>
        </div>
        <CardTitle className="text-2xl font-semibold tracking-tight text-white">Sign in</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium text-gray-200">
                Username
              </Label>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="Enter username"
                required
                className={`bg-slate-800/50 border-slate-700 text-white placeholder:text-gray-400 focus:border-emerald-500 focus:ring-emerald-500/20 transition-colors ${error ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                aria-describedby={error ? "error-message" : undefined}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-200">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Enter password"
                required
                className={`bg-slate-800/50 border-slate-700 text-white placeholder:text-gray-400 focus:border-emerald-500 focus:ring-emerald-500/20 transition-colors ${error ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                aria-describedby={error ? "error-message" : undefined}
              />
            </div>
          </div>

          {error && (
            <div
              id="error-message"
              className="text-sm text-red-400 bg-red-950/50 p-3 rounded-lg border border-red-800/50"
              role="alert"
              aria-live="polite"
            >
              {error}
            </div>
          )}

          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  )
}
