// Supabase Edge Function: portal-create-booking
// Creates a new booking request from the client portal

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyPortalToken, getSupabaseClient } from '../_shared/auth.ts';

interface CreateBookingRequest {
  service_id: string;
  start_time: string;
  end_time: string;
  notes?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Verify portal token
    const payload = await verifyPortalToken(req.headers.get('Authorization'));
    if (!payload) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: CreateBookingRequest = await req.json();
    const { service_id, start_time, end_time, notes } = body;

    if (!service_id || !start_time || !end_time) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: service_id, start_time, end_time' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseClient();
    const { client_id, team_id } = payload;

    // Verify service exists and is active
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('*')
      .eq('id', service_id)
      .eq('team_id', team_id)
      .eq('is_active', true)
      .single();

    if (serviceError || !service) {
      return new Response(
        JSON.stringify({ error: 'Service not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify client exists
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, email')
      .eq('id', client_id)
      .eq('team_id', team_id)
      .single();

    if (clientError || !client) {
      return new Response(
        JSON.stringify({ error: 'Client not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const startDate = new Date(start_time);
    const endDate = new Date(end_time);
    const now = new Date();
    const bufferMinutes = service.buffer_minutes || 0;

    // Validate booking time is in the future
    const minBookingTime = new Date(now.getTime() + service.lead_time_hours * 60 * 60 * 1000);
    if (startDate < minBookingTime) {
      return new Response(
        JSON.stringify({ error: `Bookings must be made at least ${service.lead_time_hours} hours in advance` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate booking is within max advance days
    const maxBookingDate = new Date(now.getTime() + service.max_advance_days * 24 * 60 * 60 * 1000);
    if (startDate > maxBookingDate) {
      return new Response(
        JSON.stringify({ error: `Bookings can only be made up to ${service.max_advance_days} days in advance` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for conflicts with existing bookings
    const slotEndWithBuffer = new Date(endDate.getTime() + bufferMinutes * 60 * 1000);
    
    const { data: conflicts, error: conflictError } = await supabase
      .from('bookings')
      .select('id')
      .eq('team_id', team_id)
      .in('status', ['pending', 'confirmed'])
      .or(`and(start_time.lt.${slotEndWithBuffer.toISOString()},end_time.gt.${startDate.toISOString()})`);

    if (conflictError) {
      throw conflictError;
    }

    if (conflicts && conflicts.length > 0) {
      return new Response(
        JSON.stringify({ error: 'This time slot is no longer available' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for blocked times
    const { data: blockedConflicts, error: blockedError } = await supabase
      .from('blocked_times')
      .select('id')
      .eq('team_id', team_id)
      .lt('start_time', slotEndWithBuffer.toISOString())
      .gt('end_time', startDate.toISOString());

    if (blockedError) {
      throw blockedError;
    }

    if (blockedConflicts && blockedConflicts.length > 0) {
      return new Response(
        JSON.stringify({ error: 'This time slot is blocked' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the booking
    const bookingTitle = `${service.name} - ${client.name}`;
    
    const { data: booking, error: insertError } = await supabase
      .from('bookings')
      .insert({
        team_id,
        service_id,
        client_id,
        title: bookingTitle,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        status: 'pending',
        notes: notes || '',
      })
      .select(`
        id,
        service_id,
        title,
        start_time,
        end_time,
        status,
        notes,
        created_at,
        service:services (
          id,
          name,
          description,
          duration_minutes,
          price
        )
      `)
      .single();

    if (insertError) {
      throw insertError;
    }

    return new Response(
      JSON.stringify({ booking }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
