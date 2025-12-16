import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
}

async function validateSession(supabase: any, token: string) {
  const { data, error } = await supabase.rpc("validate_portal_session", { p_token: token })
  if (error || !data || data.length === 0) return null
  return data[0]?.is_valid ? data[0] : null
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), 
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    const url = new URL(req.url)
    const invoiceId = url.searchParams.get("invoice_id")
    if (!invoiceId) {
      return new Response(JSON.stringify({ error: "Invoice ID required" }), 
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    const token = authHeader.replace("Bearer ", "")
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const session = await validateSession(supabase, token)
    if (!session) {
      return new Response(JSON.stringify({ error: "Invalid session" }), 
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(`*, invoice_line_items(*)`)
      .eq("id", invoiceId)
      .eq("client_id", session.client_id)
      .eq("client_visible", true)
      .single()

    if (invoiceError || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), 
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    const { data: team } = await supabase
      .from("teams")
      .select("name, billing_name, billing_address, billing_city, billing_province, billing_postal_code, billing_phone, tps_number, tvq_number, logo_url, primary_color")
      .eq("id", session.team_id)
      .single()

    return new Response(JSON.stringify({
      invoice,
      team: team || null,
      client: { name: session.client_name, email: session.client_email },
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })

  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal server error" }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
})
