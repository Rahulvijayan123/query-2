import { makeFakeSupabase } from "../../utils/fakeSupabase"

const fake = makeFakeSupabase()

export const __fakeSupabase = fake

export function createAdminClient() {
  return fake as any
}



