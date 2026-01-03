// Supabase Edge Function: public-available-slots
// Calculates available booking slots for a specific service and date (public access)
// Fixed timezone handling for proper local time display

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface TimeSlot {
  start_time: string;
  end_time: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const serviceId = url.searchParams.get('service_id');
    const dateStr = url.searchParams.get('date');
    const teamId = url.searchParams.get('team_id');

    if (!serviceId || !dateStr || !teamId) {
      return new Response(
        JSON.stringify({ error: 'Missing service_id, date, or team_id parameter' }),
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
    const requestedDate = new Date(year, month - 1, day);
    const dayOfWeek = requestedDate.getDay();
    const now = new Date();

    const minDate = new Date(now.getTime() + service.lead_time_hours * 60 * 60 * 1000);
    const maxDate = new Date(now.getTime() + service.max_advance_days * 24 * 60 * 60 * 1000);

    const startOfRequestedDay = new Date(year, month - 1, day, 0, 0, 0);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    if (startOfRequestedDay < startOfToday || startOfRequestedDay > maxDate) {
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

    const dayStart = new Date(year, month - 1, day, 0, 0, 0);
    const dayEnd = new Date(year, month - 1, day, 23, 59, 59);

    const { data: blockedTimes } = await supabase
      .from('blocked_times')
      .select('*')
      .eq('team_id', teamId)
      .gte('end_time', dayStart.toISOString())
      .lte('start_time', dayEnd.toISOString());

    const { data: existingBookings } = await supabase
      .from('bookings')
      .select('start_time, end_time, status')
      .eq('team_id', teamId)
      .in('status', ['pending', 'confirmed'])
      .gte('end_time', dayStart.toISOString())
      .lte('start_time', dayEnd.toISOString());

    const slots: TimeSlot[] = [];
    const slotDuration = service.duration_minutes;
    const bufferMinutes = service.buffer_minutes || 0;

    let currentTime = new Date(year, month - 1, day, startHour, startMin, 0);
    const endTime = new Date(year, month - 1, day, endHour, endMin, 0);

    while (currentTime.getTime() + slotDuration * 60 * 1000 <= endTime.getTime()) {
      const slotStart = new Date(currentTime);
      const slotEnd = new Date(currentTime.getTime() + slotDuration * 60 * 1000);
      const slotEndWithBuffer = new Date(slotEnd.getTime() + bufferMinutes * 60 * 1000);

      if (slotStart <= minDate) {
        currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
        continue;
      }

      const isBlocked = (blockedTimes || []).some((block: any) => {
        const blockStart = new Date(block.start_time);
        const blockEnd = new Date(block.end_time);
        return slotStart < blockEnd && slotEndWithBuffer > blockStart;
      });

      if (isBlocked) {
        currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
        continue;
      }

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

      slots.push({
        start_time: slotStart.toISOString(),
        end_time: slotEnd.toISOString(),
      });

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
