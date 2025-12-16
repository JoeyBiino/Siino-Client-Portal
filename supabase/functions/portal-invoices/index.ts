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
  if (error || !data || data.length === 0) return null
  const session = data[0]
  if (!session.is_valid) return null
  return session
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
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
        JSON.stringify({ error: "Invalid session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const { data: invoices, error: invoicesError } = await supabase
      .from("invoices")
      .select(`*, invoice_line_items(*)`)
      .eq("client_id", session.client_id)
      .eq("client_visible", true)
      .order("issue_date", { ascending: false })

    if (invoicesError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch invoices" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const paid = invoices?.filter(i => i.status === 'paid') || []
    const outstanding = invoices?.filter(i => i.status === 'unpaid' || i.status === 'overdue') || []

    return new Response(
      JSON.stringify({
        invoices: invoices || [],
        summary: {
          total_paid: paid.reduce((sum, i) => sum + i.total_amount, 0),
          total_outstanding: outstanding.reduce((sum, i) => sum + i.total_amount, 0),
          paid_count: paid.length,
          outstanding_count: outstanding.length,
        },
        client: { name: session.client_name, email: session.client_email },
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
