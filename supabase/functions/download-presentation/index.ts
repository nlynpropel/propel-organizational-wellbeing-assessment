import { createClient } from "npm:@supabase/supabase-js@2.45.0";

// ============================================================
// CORS headers
// ============================================================
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 500);
  return "An unexpected error occurred";
}

// ============================================================
// Main handler — creates a short-lived signed URL after access verification
// ============================================================
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = userData.user.id;

    // 2. Parse request body
    const body = await req.json();
    const { presentation_generation_id } = body as {
      presentation_generation_id?: string;
    };

    if (!presentation_generation_id) {
      return new Response(
        JSON.stringify({ error: "presentation_generation_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Load the presentation generation record
    const { data: presGen, error: presErr } = await supabase
      .from("presentation_generations")
      .select("*")
      .eq("id", presentation_generation_id)
      .maybeSingle();

    if (presErr || !presGen) {
      return new Response(
        JSON.stringify({ error: "Presentation generation not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (presGen.status !== "completed" || !presGen.storage_path) {
      return new Response(
        JSON.stringify({ error: "Presentation is not ready for download" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Load the user's profile to check role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    const userRole = profile?.role as string | undefined;
    if (!userRole) {
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Verify access to the assessment instance
    const assessmentInstanceId = presGen.assessment_instance_id as string;

    if (userRole === "superadmin") {
      // Superadmin: full access
    } else if (userRole === "propel_csm" || userRole === "propel_sales") {
      // Propel CSM/Sales: must have org membership for the instance's org
      const { data: instance } = await supabase
        .from("assessment_instances")
        .select("organization_id")
        .eq("id", assessmentInstanceId)
        .maybeSingle();

      if (!instance) {
        return new Response(
          JSON.stringify({ error: "Assessment instance not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: membership } = await supabase
        .from("organization_memberships")
        .select("id")
        .eq("profile_id", userId)
        .eq("status", "active")
        .eq("organization_id", instance.organization_id)
        .maybeSingle();

      if (!membership) {
        return new Response(
          JSON.stringify({ error: "Access denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (userRole === "broker") {
      // Broker: must be the assigned broker or have org membership
      const { data: instance } = await supabase
        .from("assessment_instances")
        .select("broker_id, organization_id")
        .eq("id", assessmentInstanceId)
        .maybeSingle();

      if (!instance) {
        return new Response(
          JSON.stringify({ error: "Assessment instance not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const isAssignedBroker = instance.broker_id === userId;
      let hasOrgAccess = false;
      if (!isAssignedBroker) {
        const { data: membership } = await supabase
          .from("organization_memberships")
          .select("id")
          .eq("profile_id", userId)
          .eq("status", "active")
          .eq("organization_id", instance.organization_id)
          .maybeSingle();
        hasOrgAccess = !!membership;
      }

      if (!isAssignedBroker && !hasOrgAccess) {
        return new Response(
          JSON.stringify({ error: "Access denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Create a 5-minute signed URL
    const { data: signedUrlData, error: signedUrlErr } = await supabase.storage
      .from("strategy-presentations")
      .createSignedUrl(presGen.storage_path, 300);

    if (signedUrlErr || !signedUrlData?.signedUrl) {
      return new Response(
        JSON.stringify({ error: "Failed to create download link" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        signed_url: signedUrlData.signedUrl,
        file_name: presGen.file_name,
        expires_in_seconds: 300,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: safeErrorMessage(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
