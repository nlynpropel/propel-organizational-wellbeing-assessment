import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PROMPT_VERSION = "360-v2";
const MODEL = "gpt-4o";
const GUIDE_FILE_ID = "file-5sddQHMVKz7ALqZzJtb1ri";
const SUCCESS_MEASURE_QUESTION_ID = "fdc0f589-fb1c-584c-af76-7f8245978b8d";

const SYSTEM_PROMPT = `You are an internal planning analyst for Propel, an employee health and well-being engagement platform.
You analyze responses from the Propel 360 Engagement Assessment and produce an internal analysis document.

Your output must follow this exact structure:

1. Executive Readout
2. Respondent-Defined Measure of Success
3. What the Organization Is Trying to Accomplish
4. What Is Working and Should Be Leveraged
5. Primary Constraints and Likely Root Causes
6. Cross-Response Findings
7. Recommended Propel Program Design
8. Recommendations (Corporate, Peer, and Personal where relevant)
9. NOW / NEXT / LATER Implementation Sequence
10. Questions to Resolve
11. Confidence and Missing Information

Requirements for section 2, "Respondent-Defined Measure of Success":
- Use the dedicated respondent_success_measure field from the input payload as the primary source.
- Start the section with a bold line in this format: **How success will be measured:** [respondent's answer]
- Preserve the respondent's intended meaning and specificity. Do not replace their stated measures with Propel's preferred measures.
- After the highlighted answer, briefly explain what that definition of success implies for program design, measurement, or sequencing when useful.
- If the respondent did not answer the success-measure question, state that the success measure was not provided; do not infer one.

Guardrails:
- Do NOT produce an overall score or maturity label.
- Do NOT treat blank or missing answers as negative — note them as information gaps only.
- Clearly distinguish facts (directly stated by respondent), observations (inferred from responses), hypotheses (possible explanations requiring validation), and recommendations (proposed actions). Label hypotheses explicitly.
- Connect answers across sections — look for patterns, contradictions, and reinforcement.
- Do NOT mention source files, filenames, citations, file IDs, vector stores, or any technical metadata.
- Do NOT promise unconfirmed Propel functionality.
- Use direct internal planning language, not sales copy.
- If information is missing, say so under "Confidence and Missing Information" rather than guessing.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { assessment_instance_id, generation_id } = await req.json();

    if (!assessment_instance_id || !generation_id) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY") ?? "";

    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: "AI analysis is not configured. Please contact your platform administrator." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Mark generation as in progress
    await supabase
      .from("propel_360_generations")
      .update({ status: "generating" })
      .eq("id", generation_id);

    // Fetch config
    const { data: configRows } = await supabase
      .from("propel_360_config")
      .select("key, value");

    const config = new Map((configRows ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
    const vectorStoreId = config.get("OPENAI_360_VECTOR_STORE_ID");

    // Validate vector store config
    if (!vectorStoreId) {
      await supabase
        .from("propel_360_generations")
        .update({ status: "failed", error_message: "Vector store ID not configured.", completed_at: new Date().toISOString() })
        .eq("id", generation_id);
      return new Response(
        JSON.stringify({ error: "AI analysis is not fully configured. The vector store has not been set up yet." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate vector store is accessible and file is attached
    const vsResponse = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}`, {
      headers: { Authorization: `Bearer ${openaiApiKey}` },
    });
    if (!vsResponse.ok) {
      await supabase
        .from("propel_360_generations")
        .update({ status: "failed", error_message: "Vector store is not accessible.", completed_at: new Date().toISOString() })
        .eq("id", generation_id);
      return new Response(
        JSON.stringify({ error: "AI analysis configuration error. Please contact your platform administrator." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check file is attached and processing is complete
    const filesResponse = await fetch(
      `https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`,
      { headers: { Authorization: `Bearer ${openaiApiKey}` } }
    );
    if (!filesResponse.ok) {
      await supabase
        .from("propel_360_generations")
        .update({ status: "failed", error_message: "Could not verify guide file status.", completed_at: new Date().toISOString() })
        .eq("id", generation_id);
      return new Response(
        JSON.stringify({ error: "AI analysis configuration error. Please contact your platform administrator." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const filesData = await filesResponse.json();
    const guideFile = (filesData.data ?? []).find(
      (f: { id: string; status: string }) => f.id === GUIDE_FILE_ID
    );
    if (!guideFile) {
      await supabase
        .from("propel_360_generations")
        .update({ status: "failed", error_message: "Guide file not found in vector store.", completed_at: new Date().toISOString() })
        .eq("id", generation_id);
      return new Response(
        JSON.stringify({ error: "AI analysis configuration error. Please contact your platform administrator." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (guideFile.status !== "completed") {
      await supabase
        .from("propel_360_generations")
        .update({ status: "failed", error_message: "Guide file processing not complete.", completed_at: new Date().toISOString() })
        .eq("id", generation_id);
      return new Response(
        JSON.stringify({ error: "The analysis guide is still being processed. Please try again in a few minutes." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Collect the full submitted response
    const { data: instance } = await supabase
      .from("assessment_instances")
      .select(`
        id, status, respondent_name, respondent_email, submitted_at,
        organization:organizations(id, organization_name, industry),
        assessment_version:assessment_versions(
          id, name, version_label,
          sections:assessment_sections(id, title, display_order,
            questions:assessment_questions(id, question_text, question_type, display_order,
              options:assessment_question_options(id, option_label, option_value, display_order)
            )
          )
        )
      `)
      .eq("id", assessment_instance_id)
      .maybeSingle();

    if (!instance) {
      await supabase
        .from("propel_360_generations")
        .update({ status: "failed", error_message: "Assessment instance not found.", completed_at: new Date().toISOString() })
        .eq("id", generation_id);
      return new Response(
        JSON.stringify({ error: "Assessment not found." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all responses
    const { data: responses } = await supabase
      .from("assessment_responses")
      .select("question_id, selected_option_id, text_value, numeric_value, boolean_value")
      .eq("assessment_instance_id", assessment_instance_id);

    // Build a structured response map
    const responseMap = new Map<string, Record<string, unknown>>();
    for (const r of (responses ?? [])) {
      responseMap.set(r.question_id, {
        selected_option_id: r.selected_option_id,
        text_value: r.text_value,
        numeric_value: r.numeric_value,
        boolean_value: r.boolean_value,
      });
    }

    // Build the structured payload for the AI
    const version = instance.assessment_version as Record<string, unknown>;
    const sections = (version?.sections ?? []) as Array<Record<string, unknown>>;
    const structuredResponses: Array<Record<string, unknown>> = [];
    let respondentSuccessMeasure: string | null = null;

    for (const section of sections) {
      const questions = (section.questions ?? []) as Array<Record<string, unknown>>;
      for (const question of questions) {
        const qId = question.id as string;
        const response = responseMap.get(qId);
        const options = (question.options ?? []) as Array<Record<string, unknown>>;

        let answerText = "";
        if (response) {
          if (response.selected_option_id) {
            const opt = options.find((o) => o.id === response.selected_option_id);
            answerText = (opt?.option_label as string) ?? "Selected option";
          } else if (response.text_value) {
            answerText = response.text_value as string;
          } else if (response.numeric_value !== null) {
            answerText = String(response.numeric_value);
          } else if (response.boolean_value !== null) {
            answerText = response.boolean_value ? "Yes" : "No";
          } else {
            answerText = "(no response)";
          }
        } else {
          answerText = "(no response)";
        }

        if (qId === SUCCESS_MEASURE_QUESTION_ID) {
          respondentSuccessMeasure = answerText === "(no response)" ? null : answerText;
        }

        structuredResponses.push({
          section_title: section.title,
          question_text: question.question_text,
          question_type: question.question_type,
          answer: answerText,
        });
      }
    }

    const orgName = ((instance.organization as Record<string, unknown>)?.organization_name) ?? "Unknown Organization";
    const payload = {
      organization_name: orgName,
      industry: ((instance.organization as Record<string, unknown>)?.industry) ?? null,
      respondent_name: instance.respondent_name,
      submitted_at: instance.submitted_at,
      respondent_success_measure: respondentSuccessMeasure,
      responses: structuredResponses,
    };

    // Call OpenAI with file search using the vector store
    const completionResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        instructions: SYSTEM_PROMPT,
        input: JSON.stringify(payload),
        tools: [{
          type: "file_search",
          vector_store_ids: [vectorStoreId],
        }],
        max_output_tokens: 4096,
      }),
    });

    if (!completionResponse.ok) {
      await completionResponse.text().catch(() => "");
      await supabase
        .from("propel_360_generations")
        .update({
          status: "failed",
          error_message: `OpenAI request failed: ${completionResponse.status}`,
          completed_at: new Date().toISOString(),
        })
        .eq("id", generation_id);
      return new Response(
        JSON.stringify({ error: "AI analysis generation failed. Please try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const completionData = await completionResponse.json();
    const outputText = completionData.output_text ?? completionData.output?.[0]?.content?.[0]?.text ?? "";

    if (!outputText) {
      await supabase
        .from("propel_360_generations")
        .update({ status: "failed", error_message: "Empty response from AI model.", completed_at: new Date().toISOString() })
        .eq("id", generation_id);
      return new Response(
        JSON.stringify({ error: "AI analysis produced no output. Please try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save the completed generation
    await supabase
      .from("propel_360_generations")
      .update({
        status: "completed",
        output_markdown: outputText,
        output_json: { raw_output: outputText, respondent_success_measure: respondentSuccessMeasure },
        model: MODEL,
        prompt_version: PROMPT_VERSION,
        vector_store_id: vectorStoreId,
        guide_file_id: GUIDE_FILE_ID,
        completed_at: new Date().toISOString(),
      })
      .eq("id", generation_id);

    return new Response(
      JSON.stringify({ success: true, generation_id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const _message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred during AI analysis generation." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
