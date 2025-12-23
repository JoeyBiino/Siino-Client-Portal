// Shared auth utilities for portal edge functions
// Uses database session validation (matches existing portal-auth system)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export interface PortalSession {
  client_id: string;
  client_name: string;
  client_email: string;
  team_id: string;
  is_valid: boolean;
}

export function getSupabaseClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Validate session token against database (same as other portal functions)
export async function validateSession(authHeader: string | null): Promise<PortalSession | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .rpc('validate_portal_session', { p_token: token });

    if (error || !data || data.length === 0) {
      console.error('Session validation error:', error);
      return null;
    }

    const session = data[0];
    if (!session.is_valid) {
      return null;
    }

    return {
      client_id: session.client_id,
      client_name: session.client_name,
      client_email: session.client_email,
      team_id: session.team_id,
      is_valid: session.is_valid,
    };
  } catch (error) {
    console.error('Session validation exception:', error);
    return null;
  }
}
