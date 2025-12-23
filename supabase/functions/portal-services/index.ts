// Supabase Edge Function: portal-services
// Returns active services and categories for the client's team

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
    const { team_id } = session;

    // Fetch active categories
    const { data: categories, error: categoriesError } = await supabase
      .from('service_categories')
      .select('id, name, description, color, is_active, sort_order')
      .eq('team_id', team_id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (categoriesError) {
      throw categoriesError;
    }

    // Fetch active services with category info
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
        sort_order,
        category:service_categories (
          id,
          name,
          description,
          color
        )
      `)
      .eq('team_id', team_id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (servicesError) {
      throw servicesError;
    }

    return new Response(
      JSON.stringify({ services, categories }),
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
