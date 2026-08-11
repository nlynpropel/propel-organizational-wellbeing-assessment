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

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

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

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profileData } = await userClient
      .from("profiles")
      .select("role, status")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (!profileData || profileData.role !== "superadmin" || profileData.status !== "active") {
      return new Response(JSON.stringify({ error: "Superadmin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const url = new URL(req.url);
    const action = url.pathname.split("/").pop() || "";

    if (action === "resend") {
      return await handleResend(adminClient, body as ResendRequestBody);
    }

    return await handleInvite(adminClient, body as InviteRequestBody);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getRedirectUrl(): string {
  const siteUrl = Deno.env.get("SITE_URL");
  if (!siteUrl) {
    throw new Error("SITE_URL environment variable is not configured. Set it to the deployed app origin (e.g. https://example.com).");
  }
  return `${siteUrl.replace(/\/$/, "")}/auth/callback`;
}

function normalizeDomain(email: string): string {
  const parts = email.split("@");
  if (parts.length < 2) return "";
  return parts[parts.length - 1].toLowerCase().trim();
}

async function handleInvite(
  adminClient: ReturnType<typeof createClient>,
  body: InviteRequestBody
): Promise<Response> {
  const { email, role, organization_id } = body;

  if (!email || !role) {
    return new Response(JSON.stringify({ error: "Email and role are required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const validRoles = ["superadmin", "propel_csm", "propel_sales", "broker"];
  if (!validRoles.includes(role)) {
    return new Response(JSON.stringify({ error: "Invalid role" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Validate email domain against approved_domains before creating any records
  const domain = normalizeDomain(email);
  if (!domain) {
    return new Response(JSON.stringify({ error: "Invalid email address" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: domainApproved, error: domainErr } = await adminClient
    .from("approved_domains")
    .select("id")
    .ilike("domain", domain)
    .maybeSingle();

  if (domainErr) {
    return new Response(JSON.stringify({ error: "Failed to validate email domain" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!domainApproved) {
    return new Response(JSON.stringify({
      error: `Email domain @${domain} is not approved. Invitations can only be sent to email domains approved by the Superadmin.`,
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const orgId = organization_id || null;
  const { data: userId, error: rpcErr } = await userClient.rpc("admin_invite_user", {
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

  let redirectTo: string;
  try {
    redirectTo = getRedirectUrl();
  } catch {
    return new Response(JSON.stringify({
      user_id: userId,
      warning: "User created but SITE_URL is not configured. Set the SITE_URL edge function secret to send invitation emails.",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { invited_via: "superadmin" },
  });

  if (inviteErr) {
    return new Response(JSON.stringify({
      user_id: userId,
      warning: "User created but invitation email could not be sent. Use resend to try again.",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ user_id: userId, sent: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleResend(
  adminClient: ReturnType<typeof createClient>,
  body: ResendRequestBody
): Promise<Response> {
  const { user_id } = body;

  if (!user_id) {
    return new Response(JSON.stringify({ error: "User ID is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: email, error: rpcErr } = await adminClient.rpc("admin_resend_invitation", {
    p_user_id: user_id,
  });

  if (rpcErr) {
    return new Response(JSON.stringify({ error: rpcErr.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let redirectTo: string;
  try {
    redirectTo = getRedirectUrl();
  } catch {
    return new Response(JSON.stringify({ error: "SITE_URL is not configured. Set it to send invitation emails." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(email as string, {
    redirectTo,
    data: { invited_via: "superadmin_resend" },
  });

  if (inviteErr) {
    return new Response(JSON.stringify({ error: inviteErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ sent: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
