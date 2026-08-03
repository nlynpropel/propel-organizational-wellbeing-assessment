import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InviteRequestBody {
  email: string;
  role: string;
  organization_id?: string;
}

interface ResendRequestBody {
  user_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create a service-role client for admin operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create a client with the user's JWT to verify they are a platform admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the caller is authenticated
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the caller is a platform admin by checking their profile
    const { data: profileData } = await userClient
      .from("profiles")
      .select("role, status")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (!profileData || profileData.role !== "admin" || profileData.status !== "active") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const url = new URL(req.url);
    const action = url.pathname.split("/").pop() || "";

    if (action === "resend") {
      return await handleResend(adminClient, body as ResendRequestBody, userData.user.id);
    }

    return await handleInvite(adminClient, body as InviteRequestBody, userData.user.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleInvite(
  adminClient: ReturnType<typeof createClient>,
  body: InviteRequestBody,
  actorId: string
): Promise<Response> {
  const { email, role, organization_id } = body;

  if (!email || !role) {
    return new Response(JSON.stringify({ error: "Email and role are required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (role !== "admin" && role !== "broker") {
    return new Response(JSON.stringify({ error: "Invalid role" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Call the RPC to create/update the user profile
  const orgId = organization_id || null;
  const { data: userId, error: rpcErr } = await adminClient.rpc("admin_invite_user", {
    p_email: email,
    p_role: role,
    p_organization_id: orgId,
  });

  if (rpcErr) {
    return new Response(JSON.stringify({ error: rpcErr.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Generate a magic link for the invited user
  const siteUrl = Deno.env.get("SITE_URL") || Deno.env.get("SUPABASE_URL");
  const redirectTo = siteUrl
    ? `${siteUrl.replace(/\/$/, "")}/auth/callback`
    : undefined;

  const { error: linkErr } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: redirectTo ? { redirectTo } : {},
  });

  if (linkErr) {
    // User was created but link generation failed
    // This is recoverable — admin can resend later
    return new Response(
      JSON.stringify({
        user_id: userId,
        warning: "User created but invitation email could not be sent. Use resend to try again.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  return new Response(JSON.stringify({ user_id: userId, sent: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleResend(
  adminClient: ReturnType<typeof createClient>,
  body: ResendRequestBody,
  actorId: string
): Promise<Response> {
  const { user_id } = body;

  if (!user_id) {
    return new Response(JSON.stringify({ error: "User ID is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Call the RPC to log the resend and get the user's email
  const { data: email, error: rpcErr } = await adminClient.rpc("admin_resend_invitation", {
    p_user_id: user_id,
  });

  if (rpcErr) {
    return new Response(JSON.stringify({ error: rpcErr.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Generate a new magic link
  const siteUrl = Deno.env.get("SITE_URL") || Deno.env.get("SUPABASE_URL");
  const redirectTo = siteUrl
    ? `${siteUrl.replace(/\/$/, "")}/auth/callback`
    : undefined;

  const { error: linkErr } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email: email as string,
    options: redirectTo ? { redirectTo } : {},
  });

  if (linkErr) {
    return new Response(JSON.stringify({ error: linkErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ sent: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
