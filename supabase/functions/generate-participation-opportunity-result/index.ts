const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  
  const OPENAI_TIMEOUT_MS = 45_000;
  
  // Static content bank -- category names/descriptions from the assessment spec.
  // The vector store (file_search) supplies the actual explanatory depth;
  // this just tells the model which category it's writing about.
  const CATEGORIES: Record<string, { title: string; description: string }> = {
    CFA: { title: "Create a Clear First Action", description: "Employees are not consistently given one clear, manageable first step when they encounter well-being efforts." },
    BPM: { title: "Build Participation Momentum", description: "Employees are not consistently given a next relevant reason or opportunity to participate after their first activity." },
    MPS: { title: "Make Participation More Social", description: "Employees have limited opportunities to participate alongside coworkers, teams, or peer groups." },
    EWP: { title: "Expand the Ways Employees Can Participate", description: "Participation options are limited to a narrow set of topics or formats." },
    RAB: { title: "Reduce the Administrative Burden", description: "Launching or managing a well-being activity requires more staff time and effort than the team can sustain." },
    IVW: { title: "Improve Visibility Into What Is Working", description: "The organization lacks quick access to participation data needed to see what is working and what isn't." },
  };
  
  function buildFallback(primaryCategory: string, orgName: string) {
    const cat = CATEGORIES[primaryCategory];
    return {
      header: "Your Employee Participation Opportunity",
      primary: {
        title: cat?.title ?? "Your Primary Opportunity",
        explanation: `Based on your responses, ${orgName || "your organization"}'s most practical opportunity is: ${cat?.title ?? primaryCategory}.`,
        likely_cause: "",
        thirty_day_action: "",
        measure: "",
        how_connect_can_help: "A member of our team will follow up with your full personalized results shortly.",
      },
      secondary: null,
      closing: "You do not necessarily need to replace the resources you already offer. The opportunity may be to make participation easier to begin, more compelling to continue, or simpler to manage.",
      cta: "See how Propel Connect could support your recommended next step.",
    };
  }
  
  Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
  
    try {
      const { secure_token } = await req.json();
      if (!secure_token) {
        return new Response(JSON.stringify({ error: "secure_token is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
  
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
      const dbFetch = async (path: string, init: RequestInit = {}) => {
        const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
          ...init,
          headers: {
            apikey: supabaseServiceKey,
            Authorization: `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
            Prefer: init.method === "POST" ? "return=representation" : "",
            ...(init.headers ?? {}),
          },
        });
        if (!res.ok) throw new Error(`DB request failed (${res.status}): ${await res.text()}`);
        return res.json();
      };
  
      // 1. Resolve the instance by token
      const instances = await dbFetch(
        `assessment_instances?secure_token=eq.${secure_token}&select=id,status,organization_id`
      );
      const instance = instances[0];
      if (!instance) {
        return new Response(JSON.stringify({ error: "Invalid link" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!["submitted", "report_ready"].includes(instance.status)) {
        return new Response(JSON.stringify({ error: "This assessment has not been completed yet" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
  
      // 2. Return a cached result if one already exists (idempotent on refresh)
      const existing = await dbFetch(
        `participation_finder_generations?assessment_instance_id=eq.${instance.id}&select=output_json`
      );
      if (existing[0]) {
        return new Response(JSON.stringify(existing[0].output_json), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
  
      // 3. Gather scoring + org context
      const results = await dbFetch(
        `assessment_results?assessment_instance_id=eq.${instance.id}&select=result_snapshot`
      );
      const snapshot = results[0]?.result_snapshot;
      if (!snapshot) {
        return new Response(JSON.stringify({ error: "No scored result found for this assessment" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
  
      const orgs = await dbFetch(
        `organizations?id=eq.${instance.organization_id}&select=organization_name,industry,employee_count`
      );
      const org = orgs[0] ?? {};
      const orgName = org.organization_name ?? "your organization";
  
      const primaryKey = snapshot.primary_category as string;
      const secondaryKey = snapshot.secondary_category as string | null;
  
      // 4. Try AI generation; fall back to a deterministic message on any failure
      let outputJson: unknown;
      let usedFallback = false;
      let errorMessage: string | null = null;
      const modelName = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o";
  
      try {
        const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
        const vectorStoreId = Deno.env.get("OPENAI_VECTOR_STORE_ID");
            if (!openaiApiKey || !vectorStoreId) {
            throw new Error("OPENAI_API_KEY or OPENAI_VECTOR_STORE_ID not configured");
            }
  
        const primaryCat = CATEGORIES[primaryKey];
        const secondaryCat = secondaryKey ? CATEGORIES[secondaryKey] : null;
  
        const systemPrompt = `You write short, practical results for "The Well-being Participation Improvement Finder," a lead-magnet assessment. Use the attached knowledge base (via file search) for Propel's recommendation guidance and voice. Write direct, professional advice -- never cite source documents or mention "the knowledge base" or file names. A question should only influence a result when Propel Connect can directly support the resulting recommendation.
  
  Return ONLY valid JSON matching this exact shape, no markdown, no commentary:
  {
    "header": "Your Employee Participation Opportunity",
    "primary": {
      "title": "string",
      "explanation": "string -- 2-3 sentences on what this opportunity is",
      "likely_cause": "string -- 1-2 sentences on why this is likely happening here",
      "thirty_day_action": "string -- one concrete, low-lift action to take within 30 days",
      "measure": "string -- one simple thing to track",
      "how_connect_can_help": "string -- 1-2 sentences, specific to this opportunity"
    },
    "secondary": ${secondaryCat ? `{
      "title": "string",
      "description": "string -- one practical enhancement, 1-2 sentences",
      "connect_capability": "string -- one relevant Connect capability, 1 sentence"
    }` : "null"},
    "closing": "You do not necessarily need to replace the resources you already offer. The opportunity may be to make participation easier to begin, more compelling to continue, or simpler to manage.",
    "cta": "See how Propel Connect could support your recommended next step."
  }`;
  
        const userPrompt = `Organization: ${orgName}${org.industry ? ` (${org.industry})` : ""}${org.employee_count ? `, ${org.employee_count} employees` : ""}
  
  Primary opportunity: ${primaryCat.title} (${primaryKey}) -- ${primaryCat.description}. Score: ${snapshot.primary_score}/100.
  ${secondaryCat ? `Secondary opportunity: ${secondaryCat.title} (${secondaryKey}) -- ${secondaryCat.description}. Score: ${snapshot.secondary_score}/100.` : "No secondary opportunity met the threshold for this organization."}
  
  Write the result now, following the JSON shape exactly.`;
  
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  
        const aiRes = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { Authorization: `Bearer ${openaiApiKey}`, "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            model: modelName,
            input: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            tools: [{ type: "file_search", vector_store_ids: [vectorStoreId] }],
            text: { format: { type: "json_object" } },
          }),
        });
        clearTimeout(timeoutId);
  
        if (!aiRes.ok) throw new Error(`OpenAI request failed (${aiRes.status}): ${await aiRes.text()}`);
        const aiData = await aiRes.json();
        const text = aiData.output_text ?? aiData.output?.[0]?.content?.[0]?.text;
        if (!text) throw new Error("No text in OpenAI response");
        outputJson = JSON.parse(text);
      } catch (err) {
        console.error("Participation finder AI generation failed, using fallback:", err);
        outputJson = buildFallback(primaryKey, orgName);
        usedFallback = true;
        errorMessage = err instanceof Error ? err.message : String(err);
      }
  
      // 5. Store and return -- always a 200 with valid content, even on fallback
      await dbFetch("participation_finder_generations", {
        method: "POST",
        body: JSON.stringify({
          assessment_instance_id: instance.id,
          status: usedFallback ? "failed" : "succeeded",
          output_json: outputJson,
          used_fallback: usedFallback,
          error_message: errorMessage,
          model_name: modelName,
        }),
      });
  
      return new Response(JSON.stringify(outputJson), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("Unhandled error in generate-participation-opportunity-result:", err);
      return new Response(JSON.stringify({ error: "Something went wrong generating your result" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  });