import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ error: 'Missing Authorization header' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Verify the caller is a signed-in admin before doing anything privileged.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user: caller },
  } = await callerClient.auth.getUser()
  if (!caller) {
    return json({ error: 'Not authenticated' }, 401)
  }

  const { data: callerProfile } = await callerClient
    .from('profiles')
    .select('role, status')
    .eq('id', caller.id)
    .single()
  // A suspended admin keeps role = 'admin' but must lose admin powers
  // (matches public.is_admin(), 0034).
  if (callerProfile?.role !== 'admin' || callerProfile?.status !== 'active') {
    return json({ error: 'Only an admin can invite new admins' }, 403)
  }

  let body: { email?: string; name?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid request body' }, 400)
  }
  const email = body.email?.trim()
  const name = body.name?.trim()
  if (!email) {
    return json({ error: 'Email is required' }, 400)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const { data: invited, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { display_name: name || email.split('@')[0] },
      redirectTo: `${req.headers.get('origin') ?? ''}/login`,
    })
  if (inviteError || !invited.user) {
    return json({ error: inviteError?.message ?? 'Failed to invite user' }, 400)
  }

  const { error: promoteError } = await adminClient
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', invited.user.id)
  if (promoteError) {
    return json({ error: promoteError.message }, 500)
  }

  return json({ ok: true, userId: invited.user.id })
})
