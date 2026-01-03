// Supabase Edge Function: public-services
// Returns active services and categories for a team (public access)
// Requires team_id as query parameter

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get team_id from query params
    const url = new URL(req.url);
    const teamId = url.searchParams.get('team_id');

    if (!teamId) {
      return new Response(
        JSON.stringify({ error: 'team_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify team exists and has public booking enabled (optional check)
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return new Response(
        JSON.stringify({ error: 'Team not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch active categories
    const { data: categories, error: categoriesError } = await supabase
      .from('service_categories')
      .select('id, name, description, color, is_active, sort_order')
      .eq('team_id', teamId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (categoriesError) {
      throw categoriesError;
    }

    // Fetch active services
    const { data: services, error: servicesError } = await supabase
      .from('services')
      .select(`
        id,
        category_id,
        name,
        description,
        duration_minutes,
        price,
        lead_time_hours,
        buffer_minutes,
        max_advance_days,
        is_active,
        sort_order
      `)
      .eq('team_id', teamId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (servicesError) {
      throw servicesError;
    }

    return new Response(
      JSON.stringify({ 
        services, 
        categories,
        team: { id: team.id, name: team.name }
      }),
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
