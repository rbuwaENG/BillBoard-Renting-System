import { createClient } from '@supabase/supabase-js'
import { envCheck } from './env'

// createClient throws on an empty URL/key, which would take the whole bundle
// down at import time and leave a blank page. With a missing/invalid config
// we build an inert client against a placeholder instead; `main.tsx` checks
// `envCheck` and renders the configuration-error screen, so the app (and
// therefore this client) never actually runs in that state.
const PLACEHOLDER_URL = 'http://localhost:54321'
const PLACEHOLDER_KEY = 'missing-anon-key'

export const supabase = createClient(
  envCheck.ok ? envCheck.env.url : PLACEHOLDER_URL,
  envCheck.ok ? envCheck.env.anonKey : PLACEHOLDER_KEY,
)
