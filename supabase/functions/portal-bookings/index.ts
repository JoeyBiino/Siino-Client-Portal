// Supabase Edge Function: portal-bookings
// Returns the client's bookings

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { validateSession, getSupabaseClient } from '../_shared/auth.ts';

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify session
    const session = await validateSession(req.headers.get('Authorization'));
    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseClient();
    const { client_id, team_id } = session;

    // Fetch bookings for this client
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
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
          price,
          category:service_categories (
            id,
            name,
            color
          )
        )
      `)
      .eq('team_id', team_id)
      .eq('client_id', client_id)
      .order('start_time', { ascending: false });

    if (bookingsError) {
      throw bookingsError;
    }

    return new Response(
      JSON.stringify({ bookings: bookings || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
