import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as jwt from 'https://deno.land/x/djwt@v2.8/mod.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PORTAL_JWT_SECRET = Deno.env.get('PORTAL_JWT_SECRET') || 'your-portal-jwt-secret-key';

export interface PortalTokenPayload {
  client_id: string;
  team_id: string;
  exp: number;
}

export async function verifyPortalToken(authHeader: string | null): Promise<PortalTokenPayload | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(PORTAL_JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const payload = await jwt.verify(token, key) as PortalTokenPayload;
    
    // Check expiration
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return null;
    }
    
    return payload;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

export function getSupabaseClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}
