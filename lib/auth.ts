import { cookies } from "next/headers"
import { redirect } from "next/navigation"

const DEMO_USERNAME = "demouser"
const DEMO_PASSWORD = "fjq49r9f"
const SESSION_COOKIE = "convexia_session"
const SESSION_VALUE = "demo"

export async function validateCredentials(username: string, password: string): Promise<boolean> {
  return username === DEMO_USERNAME && password === DEMO_PASSWORD
}

export async function createSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, SESSION_VALUE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 1 day
    path: "/",
  })
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export async function getSession(): Promise<string | null> {
  const cookieStore = await cookies()
  const session = cookieStore.get(SESSION_COOKIE)
  return session?.value || null
}

export async function requireAuth(): Promise<void> {
  const session = await getSession()
  if (!session) {
    redirect("/login")
  }
}
