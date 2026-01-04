import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Normalize phone number - strip all non-digits
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { phone, team_id } = await req.json()
    
    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const normalizedPhone = normalizePhone(phone)
    
    if (normalizedPhone.length < 10) {
      return new Response(
        JSON.stringify({ error: 'Please enter a valid phone number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Look up client by phone number
    // We search for phone numbers that contain the normalized digits
    let query = supabase
      .from('clients')
      .select('id, name, email, phone, address, city, province, postal_code, team_id')

    // If team_id provided, filter by it
    if (team_id) {
      query = query.eq('team_id', team_id)
    }

    const { data: clients, error } = await query

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Find client whose normalized phone matches
    const client = clients?.find(c => {
      if (!c.phone) return false
      return normalizePhone(c.phone) === normalizedPhone
    })

    if (!client) {
      return new Response(
        JSON.stringify({ error: 'No account found with this phone number' }),
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
