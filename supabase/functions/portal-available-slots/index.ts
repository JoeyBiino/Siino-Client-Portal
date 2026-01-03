// Supabase Edge Function: portal-available-slots
// Calculates available booking slots for authenticated portal users

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { validateSession, getSupabaseClient } from '../_shared/auth.ts';

interface TimeSlot {
  start_time: string;
  end_time: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate session
    const session = await validateSession(req.headers.get('Authorization'));
    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseClient();
    const teamId = session.team_id;

    const url = new URL(req.url);
    const serviceId = url.searchParams.get('service_id');
    const dateStr = url.searchParams.get('date');
    const tzOffsetParam = url.searchParams.get('tz_offset');
    const tzOffset = tzOffsetParam ? parseInt(tzOffsetParam) : 0;

    if (!serviceId || !dateStr) {
      return new Response(
        JSON.stringify({ error: 'Missing service_id or date parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('*')
      .eq('id', serviceId)
      .eq('team_id', teamId)
      .eq('is_active', true)
      .single();

    if (serviceError || !service) {
      return new Response(
        JSON.stringify({ error: 'Service not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const [year, month, day] = dateStr.split('-').map(Number);
    const tempDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const dayOfWeek = tempDate.getUTCDay();

    const nowUTC = new Date();
    const nowClientMs = nowUTC.getTime() - (tzOffset * 60 * 1000);
    const nowClient = new Date(nowClientMs);
    
    const minBookingTime = new Date(nowClientMs + service.lead_time_hours * 60 * 60 * 1000);
    const maxBookingTime = new Date(nowClientMs + service.max_advance_days * 24 * 60 * 60 * 1000);

    const requestedDateStart = Date.UTC(year, month - 1, day, 0, 0, 0) + (tzOffset * 60 * 1000);
    const todayStart = Date.UTC(nowClient.getUTCFullYear(), nowClient.getUTCMonth(), nowClient.getUTCDate(), 0, 0, 0);
    
    if (requestedDateStart < todayStart || requestedDateStart > maxBookingTime.getTime()) {
      return new Response(
        JSON.stringify({ slots: [], message: 'Date is outside booking window' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: availability, error: availError } = await supabase
      .from('team_availability')
      .select('*')
      .eq('team_id', teamId)
      .eq('day_of_week', dayOfWeek)
      .single();

    if (availError || !availability || !availability.is_available) {
      return new Response(
        JSON.stringify({ slots: [], message: 'Not available on this day' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const [startHour, startMin] = availability.start_time.split(':').map(Number);
    const [endHour, endMin] = availability.end_time.split(':').map(Number);

    const dayStartUTC = Date.UTC(year, month - 1, day, 0, 0, 0) + (tzOffset * 60 * 1000);
    const dayEndUTC = Date.UTC(year, month - 1, day, 23, 59, 59) + (tzOffset * 60 * 1000);

    const { data: blockedTimes } = await supabase
      .from('blocked_times')
      .select('*')
      .eq('team_id', teamId)
      .gte('end_time', new Date(dayStartUTC).toISOString())
      .lte('start_time', new Date(dayEndUTC).toISOString());

    const { data: existingBookings } = await supabase
      .from('bookings')
      .select('start_time, end_time, status')
      .eq('team_id', teamId)
      .in('status', ['pending', 'confirmed'])
      .gte('end_time', new Date(dayStartUTC).toISOString())
      .lte('start_time', new Date(dayEndUTC).toISOString());

    const slots: TimeSlot[] = [];
    const slotDuration = service.duration_minutes;
    const bufferMinutes = service.buffer_minutes || 0;

    let currentTimeUTC = Date.UTC(year, month - 1, day, startHour, startMin, 0) + (tzOffset * 60 * 1000);
    const endTimeUTC = Date.UTC(year, month - 1, day, endHour, endMin, 0) + (tzOffset * 60 * 1000);

    while (currentTimeUTC + slotDuration * 60 * 1000 <= endTimeUTC) {
      const slotStartUTC = currentTimeUTC;
      const slotEndUTC = currentTimeUTC + slotDuration * 60 * 1000;
      const slotEndWithBufferUTC = slotEndUTC + bufferMinutes * 60 * 1000;

      if (slotStartUTC <= minBookingTime.getTime()) {
        currentTimeUTC += 30 * 60 * 1000;
        continue;
      }

      const isBlocked = (blockedTimes || []).some((block: any) => {
        const blockStart = new Date(block.start_time).getTime();
        const blockEnd = new Date(block.end_time).getTime();
        return slotStartUTC < blockEnd && slotEndWithBufferUTC > blockStart;
      });

      if (isBlocked) {
        currentTimeUTC += 30 * 60 * 1000;
        continue;
      }

      const hasConflict = (existingBookings || []).some((booking: any) => {
        const bookingStart = new Date(booking.start_time).getTime();
        const bookingEnd = new Date(booking.end_time).getTime();
        const bookingEndWithBuffer = bookingEnd + bufferMinutes * 60 * 1000;
        return slotStartUTC < bookingEndWithBuffer && slotEndWithBufferUTC > bookingStart;
      });

      if (hasConflict) {
        currentTimeUTC += 30 * 60 * 1000;
        continue;
      }

      slots.push({
        start_time: new Date(slotStartUTC).toISOString(),
        end_time: new Date(slotEndUTC).toISOString(),
      });

      currentTimeUTC += 30 * 60 * 1000;
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
