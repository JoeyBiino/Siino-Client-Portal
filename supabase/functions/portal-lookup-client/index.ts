import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { portal_code, team_id } = await req.json()
    
    if (!portal_code) {
      return new Response(
        JSON.stringify({ error: 'Portal code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Look up client by portal code (optionally filtered by team)
    let query = supabase
      .from('clients')
      .select('id, name, email, phone, billing_address, billing_city, billing_province, billing_postal_code, team_id')
      .eq('portal_code', portal_code.trim().toUpperCase())

    // If team_id provided, filter by it
    if (team_id) {
      query = query.eq('team_id', team_id)
    }

    const { data: client, error } = await query.single()

    if (error || !client) {
      console.log('Lookup error:', error, 'Portal code:', portal_code)
      return new Response(
        JSON.stringify({ error: 'Client not found. Please check your portal code.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ client }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error looking up client:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
