import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
}

async function validateSession(supabase: any, token: string) {
  const { data, error } = await supabase
    .rpc("validate_portal_session", { p_token: token })

  if (error || !data || data.length === 0) {
    return null
  }

  const session = data[0]
  if (!session.is_valid) {
    return null
  }

  return session
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    if (req.method !== "GET") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const authHeader = req.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const token = authHeader.replace("Bearer ", "")

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const session = await validateSession(supabase, token)
    if (!session) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select(`
        id,
        name,
        deadline,
        notes,
        client_visible,
        created_at,
        updated_at,
        status:project_statuses (
          id,
          name,
          color
        ),
        project_type:project_types (
          id,
          name,
          color
        )
      `)
      .eq("client_id", session.client_id)
      .eq("client_visible", true)
      .eq("is_archived", false)
      .order("deadline", { ascending: true, nullsFirst: false })

    if (projectsError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch projects" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    return new Response(
      JSON.stringify({
        projects: projects || [],
        client: {
          name: session.client_name,
          email: session.client_email,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
