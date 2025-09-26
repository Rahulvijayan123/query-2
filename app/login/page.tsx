import { LoginForm } from "@/components/login-form"
import { ConvexiaBackground } from "@/components/convexia-background"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <ConvexiaBackground />
      <LoginForm />
    </div>
  )
}
