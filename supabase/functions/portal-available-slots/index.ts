// Supabase Edge Function: portal-available-slots
// Calculates available booking slots for a specific service and date

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { validateSession, getSupabaseClient } from '../_shared/auth.ts';

interface TimeSlot {
  start_time: string;
  end_time: string;
}

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

    const url = new URL(req.url);
    const serviceId = url.searchParams.get('service_id');
    const dateStr = url.searchParams.get('date'); // YYYY-MM-DD format

    if (!serviceId || !dateStr) {
      return new Response(
        JSON.stringify({ error: 'Missing service_id or date parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseClient();
    const { team_id } = session;

    // Fetch service details
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('*')
      .eq('id', serviceId)
      .eq('team_id', team_id)
      .eq('is_active', true)
      .single();

    if (serviceError || !service) {
      return new Response(
        JSON.stringify({ error: 'Service not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the requested date
    const requestedDate = new Date(dateStr + 'T00:00:00');
    const dayOfWeek = requestedDate.getDay(); // 0 = Sunday, 6 = Saturday
    const now = new Date();

    // Check if date is within booking window
    const minDate = new Date(now.getTime() + service.lead_time_hours * 60 * 60 * 1000);
    const maxDate = new Date(now.getTime() + service.max_advance_days * 24 * 60 * 60 * 1000);

    if (requestedDate < new Date(now.toDateString()) || requestedDate > maxDate) {
      return new Response(
        JSON.stringify({ slots: [], message: 'Date is outside booking window' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch team availability for this day of week
    const { data: availability, error: availError } = await supabase
      .from('team_availability')
      .select('*')
      .eq('team_id', team_id)
      .eq('day_of_week', dayOfWeek)
      .single();

    if (availError || !availability || !availability.is_available) {
      return new Response(
        JSON.stringify({ slots: [], message: 'Not available on this day' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse working hours (format: "HH:MM:SS")
    const [startHour, startMin] = availability.start_time.split(':').map(Number);
    const [endHour, endMin] = availability.end_time.split(':').map(Number);

    // Fetch blocked times for this date
    const dayStart = new Date(dateStr + 'T00:00:00');
    const dayEnd = new Date(dateStr + 'T23:59:59');

    const { data: blockedTimes, error: blockedError } = await supabase
      .from('blocked_times')
      .select('*')
      .eq('team_id', team_id)
      .gte('end_time', dayStart.toISOString())
      .lte('start_time', dayEnd.toISOString());

    if (blockedError) {
      throw blockedError;
    }

    // Fetch existing confirmed/pending bookings for this date
    const { data: existingBookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('start_time, end_time, status')
      .eq('team_id', team_id)
      .in('status', ['pending', 'confirmed'])
      .gte('end_time', dayStart.toISOString())
      .lte('start_time', dayEnd.toISOString());

    if (bookingsError) {
      throw bookingsError;
    }

    // Generate time slots (30-minute intervals)
    const slots: TimeSlot[] = [];
    const slotDuration = service.duration_minutes;
    const bufferMinutes = service.buffer_minutes || 0;

    // Create slots starting from working hours
    let currentTime = new Date(requestedDate);
    currentTime.setHours(startHour, startMin, 0, 0);

    const endTime = new Date(requestedDate);
    endTime.setHours(endHour, endMin, 0, 0);

    while (currentTime.getTime() + slotDuration * 60 * 1000 <= endTime.getTime()) {
      const slotStart = new Date(currentTime);
      const slotEnd = new Date(currentTime.getTime() + slotDuration * 60 * 1000);
      const slotEndWithBuffer = new Date(slotEnd.getTime() + bufferMinutes * 60 * 1000);

      // Check if slot is in the past (considering lead time)
      if (slotStart <= minDate) {
        currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000); // Move to next 30-min slot
        continue;
      }

      // Check if slot overlaps with blocked times
      const isBlocked = (blockedTimes || []).some((block: any) => {
        const blockStart = new Date(block.start_time);
        const blockEnd = new Date(block.end_time);
        return slotStart < blockEnd && slotEndWithBuffer > blockStart;
      });

      if (isBlocked) {
        currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
        continue;
      }

      // Check if slot overlaps with existing bookings (including buffer)
      const hasConflict = (existingBookings || []).some((booking: any) => {
        const bookingStart = new Date(booking.start_time);
        const bookingEnd = new Date(booking.end_time);
        const bookingEndWithBuffer = new Date(bookingEnd.getTime() + bufferMinutes * 60 * 1000);
        return slotStart < bookingEndWithBuffer && slotEndWithBuffer > bookingStart;
      });

      if (hasConflict) {
        currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
        continue;
      }

      // Slot is available
      slots.push({
        start_time: slotStart.toISOString(),
        end_time: slotEnd.toISOString(),
      });

      // Move to next 30-minute interval
      currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
    }

    return new Response(
      JSON.stringify({ slots }),
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
