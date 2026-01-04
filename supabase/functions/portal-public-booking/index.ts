import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

function generatePortalCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
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

    const body = await req.json()
    const {
      client_id,
      client_info,
      service_id,
      start_time,
      end_time,
      notes,
      location_address,
      location_contact_name,
      location_contact_phone,
    } = body

    // Validate required fields
    if (!service_id || !start_time || !end_time) {
      return new Response(
        JSON.stringify({ error: 'Missing required booking fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let finalClientId = client_id

    // If no client_id, create a new client
    if (!finalClientId && client_info) {
      // Validate client info
      if (!client_info.name || !client_info.email || !client_info.phone) {
        return new Response(
          JSON.stringify({ error: 'Client name, email, and phone are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check if client with this email already exists
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id')
        .eq('email', client_info.email)
        .single()

      if (existingClient) {
        finalClientId = existingClient.id
      } else {
        // Get team_id from service
        const { data: service, error: serviceError } = await supabase
          .from('services')
          .select('team_id')
          .eq('id', service_id)
          .single()

        if (serviceError || !service) {
          return new Response(
            JSON.stringify({ error: 'Service not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Create new client
        const portalCode = generatePortalCode()
        
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert({
            team_id: service.team_id,
            name: client_info.name,
            email: client_info.email,
            phone: client_info.phone,
            address: client_info.billing_address || '',
            city: client_info.billing_city || '',
            province: client_info.billing_province || 'QC',
            postal_code: client_info.billing_postal_code || '',
            portal_code: portalCode,
            portal_enabled: true,
          })
          .select('id')
          .single()

        if (clientError) {
          console.error('Error creating client:', clientError)
          return new Response(
            JSON.stringify({ error: 'Failed to create client' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        finalClientId = newClient.id
      }
    }

    if (!finalClientId) {
      return new Response(
        JSON.stringify({ error: 'Client information is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get service details for team_id
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('team_id, name')
      .eq('id', service_id)
      .single()

    if (serviceError || !service) {
      return new Response(
        JSON.stringify({ error: 'Service not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create the booking
    // Include location info in notes since bookings table doesn't have location columns
    let fullNotes = notes || '';
    if (location_address) {
      fullNotes += `\nLocation: ${location_address}`;
    }
    if (location_contact_name || location_contact_phone) {
      fullNotes += `\nOn-site Contact: ${location_contact_name || ''} ${location_contact_phone || ''}`.trim();
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        team_id: service.team_id,
        client_id: finalClientId,
        service_id: service_id,
        title: service.name,
        start_time: start_time,
        end_time: end_time,
        status: 'pending',
        notes: fullNotes.trim() || null,
      })
      .select('id')
      .single()

    if (bookingError) {
      console.error('Error creating booking:', bookingError)
      return new Response(
        JSON.stringify({ error: 'Failed to create booking' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        booking_id: booking.id,
        client_id: finalClientId,
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error creating public booking:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
