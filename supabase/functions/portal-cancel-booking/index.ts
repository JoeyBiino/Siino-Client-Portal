// Supabase Edge Function: portal-cancel-booking
// Allows a client to cancel their pending or confirmed booking

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { validateSession, getSupabaseClient } from '../_shared/auth.ts';

interface CancelBookingRequest {
  booking_id: string;
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
    // Verify session
    const session = await validateSession(req.headers.get('Authorization'));
    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: CancelBookingRequest = await req.json();
    const { booking_id } = body;

    if (!booking_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: booking_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseClient();
    const { client_id, team_id } = session;

    // Verify booking exists and belongs to this client
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .eq('team_id', team_id)
      .eq('client_id', client_id)
      .single();

    if (bookingError || !booking) {
      return new Response(
        JSON.stringify({ error: 'Booking not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if booking can be cancelled
    if (!['pending', 'confirmed'].includes(booking.status)) {
      return new Response(
        JSON.stringify({ error: `Cannot cancel a booking with status: ${booking.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if booking is in the past
    const now = new Date();
    const bookingStart = new Date(booking.start_time);
    if (bookingStart < now) {
      return new Response(
        JSON.stringify({ error: 'Cannot cancel a past booking' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update booking status to cancelled
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: 'Cancelled by client via portal',
      })
      .eq('id', booking_id);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Booking cancelled successfully' }),
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
