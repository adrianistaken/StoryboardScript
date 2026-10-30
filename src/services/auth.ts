import { readonly, ref } from 'vue'
import { createClient, type User } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const supabase = url && key ? createClient(url, key) : undefined
export const accountsEnabled = !!supabase
const user = ref<User | null>(null)
export const accountUser = readonly(user)
export const authReady = ref(!supabase)
export const authError = ref('')

export async function initializeAuth() {
  if (!supabase) return
  supabase.auth.onAuthStateChange((_event, session) => {
    user.value = session?.user ?? null
  })
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    user.value = data.session?.user ?? null
  } catch {
    authError.value =
      'Unable to restore your sign-in. You can still use scripts saved in this browser.'
  } finally {
    authReady.value = true
  }
}
export async function sendSignIn(email: string) {
  if (!supabase) throw new Error('Accounts are not configured for this site.')
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${location.origin}/` },
  })
  if (error) throw error
}
export async function signOut() {
  if (!supabase) return
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  if (error) throw error
}
