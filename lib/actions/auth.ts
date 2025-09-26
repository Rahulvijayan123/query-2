"use server"

import { redirect } from "next/navigation"
import { validateCredentials, createSession, destroySession } from "@/lib/auth"

export interface LoginResult {
  success: boolean
  error?: string
}

export async function login(formData: FormData): Promise<LoginResult> {
  const username = formData.get("username") as string
  const password = formData.get("password") as string

  if (!username || !password) {
    return {
      success: false,
      error: "Username and password are required",
    }
  }

  const isValid = await validateCredentials(username, password)

  if (!isValid) {
    return {
      success: false,
      error: "Invalid credentials",
    }
  }

  await createSession()
  redirect("/app")
}

export async function logout(): Promise<void> {
  await destroySession()
  redirect("/login")
}
