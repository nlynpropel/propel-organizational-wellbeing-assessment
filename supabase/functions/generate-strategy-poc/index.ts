import { createClient } from "npm:@supabase/supabase-js@2.45.0";

// ============================================================
// CORS headers (mandatory for Supabase client compatibility)
// ============================================================
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ============================================================
// Constants
// ============================================================
const SYSTEM_PROMPT_VERSION = Deno.env.get("OPENAI_PROMPT_VERSION") ?? "strategy-poc-v1";
const OPENAI_TIMEOUT_MS = 90_000;
const MAX_RECOMMENDATIONS = 3;
const MAX_DISCUSSION_QUESTIONS = 3;

// Types (used for runtime validation only)
type EvidenceRef = {
  path: string;
  label: string;
};

type PriorityRecommendation = {
  title: string;
  rationale: string;
  recommended_action: string;
  evidence_references: EvidenceRef[];
};

type StrategyPocOutput = {
  executive_summary: string;
  priority_recommendations: PriorityRecommendation[];
  client_discussion_questions: string[];
  limitations: string;
  evidence_references: EvidenceRef[];
};

// ============================================================
// Versioned system prompt
// ============================================================
const SYSTEM_PROMPT = `You are a workplace wellbeing strategy advisor. You analyze assessment data and produce a strategy proof-of-concept.

STRICT RULES:
1. Output ONLY valid JSON matching the specified schema. No markdown, no code fences, no commentary.
2. Generate at most ${MAX_RECOMMENDATIONS} priority recommendations.
3. Generate at most ${MAX_DISCUSSION_QUESTIONS} client discussion questions.
4. Every evidence_references entry must use a "path" that refers to a real section in the provided data (e.g., "assessment.strategy_dimension_scores", "recommendations[0]", "utilization[0]", "notes[2]").
5. Do NOT include PII, personal names, email addresses, or phone numbers.
6. Do NOT include internal scoring formulas, driver mapping weights, or methodology details.
7. "internal" notes may influence your analysis but must NEVER appear verbatim in output.
8. "organization_team" notes may influence your analysis but must NOT appear verbatim unless explicitly approved.
9. "client_report_candidate" notes may influence your analysis and may be paraphrased in output.
10. Be concise, specific, and actionable. Use plain professional language.
11. Do NOT generate strengths, quick wins, high-impact moves, outcome goals, resource gaps, or incentive designs.

JSON SCHEMA:
{
  "executive_summary": "string — 2-4 sentence overview of the client's wellbeing maturity and key opportunities",
  "priority_recommendations": [
    {
      "title": "string — short title",
      "rationale": "string — why this matters, grounded in the data",
      "recommended_action": "string — specific next step",
      "evidence_references": [
        { "path": "string — dot-path into the provided data", "label": "string — human-readable label" }
      ]
    }
  ],
  "client_discussion_questions": ["string — open-ended question for the client"],
  "limitations": "string — caveats about data quality, scope, or confidence",
  "evidence_references": [
    { "path": "string — dot-path into the provided data", "label": "string — human-readable label" }
  ]
}`;

// ============================================================
// Payload filter (inlined — edge functions must not share code)
// ============================================================
const PAYLOAD_FILTER_VERSION = 1;
const EXCLUDED_ASSESSMENT_KEYS = new Set([
  "driver_mapping",
  "mapping_weight",
  "prompt_token",
  "completion_token",
  "internal_priority",
  "methodology_notes",
]);

type FilteredNote = {
  note_type: string;
  title: string | null;
  content: string;
  visibility: string;
  importance: string;
  visibility_directive: "influence_only" | "influence_and_output";
};

type FilteredPayload = {
  filter_version: number;
  workspace_title: string;
  workspace_status: string;
  client_organization: Record<string, unknown>;
  assessment: Record<string, unknown>;
  recommendations: unknown[];
  outcomes: unknown[];
  metrics: unknown[];
  programs: unknown[];
  utilization: unknown[];
  resource_gaps: unknown[];
  evidence_sources: unknown[];
  notes: FilteredNote[];
  readiness: Record<string, unknown>;
};

function filterAssessment(
  assessment: Record<string, unknown>
): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(assessment)) {
    if (EXCLUDED_ASSESSMENT_KEYS.has(key)) continue;
    filtered[key] = value;
  }
  return filtered;
}

function filterNotes(
  notes: Array<Record<string, unknown>>
): FilteredNote[] {
  const allowedVisibilities = new Set([
    "internal",
    "organization_team",
    "client_report_candidate",
  ]);
  return notes
    .filter((n) => allowedVisibilities.has(String(n.visibility ?? "")))
    .map((n) => {
      const visibility = String(n.visibility ?? "");
      return {
        note_type: String(n.note_type ?? ""),
        title: (n.title as string | null) ?? null,
        content: String(n.content ?? ""),
        visibility,
        importance: String(n.importance ?? "normal"),
        visibility_directive:
          visibility === "client_report_candidate"
            ? "influence_and_output"
            : "influence_only",
      };
    });
}

function buildFilteredPayload(
  snapshot: Record<string, unknown>
): FilteredPayload {
  const assessment =
    (snapshot.assessment as Record<string, unknown>) ?? {};
  const notes =
    (snapshot.notes as Array<Record<string, unknown>>) ?? [];
  const org =
    (snapshot.client_organization as Record<string, unknown>) ?? {};

  return {
    filter_version: PAYLOAD_FILTER_VERSION,
    workspace_title: String(snapshot.workspace_title ?? ""),
    workspace_status: String(snapshot.workspace_status ?? ""),
    client_organization: {
      name: String(org.name ?? ""),
      type: String(org.type ?? ""),
      industry: String(org.industry ?? ""),
      size_band: String(org.size_band ?? ""),
      description: (org.description as string | null) ?? null,
    },
    assessment: filterAssessment(assessment),
    recommendations: (snapshot.recommendations as unknown[]) ?? [],
    outcomes: (snapshot.outcomes as unknown[]) ?? [],
    metrics: (snapshot.metrics as unknown[]) ?? [],
    programs: (snapshot.programs as unknown[]) ?? [],
    utilization: (snapshot.utilization as unknown[]) ?? [],
    resource_gaps: (snapshot.resource_gaps as unknown[]) ?? [],
    evidence_sources: (snapshot.evidence_sources as unknown[]) ?? [],
    notes: filterNotes(notes),
    readiness: (snapshot.readiness as Record<string, unknown>) ?? {},
  };
}

// ============================================================
// Evidence path validation
// ============================================================
function isValidEvidencePath(
  path: string,
  payload: FilteredPayload
): boolean {
  if (!path || typeof path !== "string") return false;

  const parts = path.split(".");
  let current: unknown = payload as Record<string, unknown>;

  for (const part of parts) {
    if (current === null || current === undefined) return false;

    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const key = arrayMatch[1];
      const index = parseInt(arrayMatch[2], 10);
      if (
        typeof current !== "object" ||
        current === null ||
        !(key in current)
      )
        return false;
      const arr = (current as Record<string, unknown>)[key];
      if (!Array.isArray(arr)) return false;
      if (index < 0 || index >= arr.length) return false;
      current = arr[index];
    } else {
      if (
        typeof current !== "object" ||
        current === null ||
        !(part in current)
      )
        return false;
      current = (current as Record<string, unknown>)[part];
    }
  }

  return current !== undefined;
}

function validateEvidencePaths(
  output: StrategyPocOutput,
  payload: FilteredPayload
): string[] {
  const errors: string[] = [];

  for (const rec of output.priority_recommendations ?? []) {
    for (const ref of rec.evidence_references ?? []) {
      if (!isValidEvidencePath(ref.path, payload)) {
        errors.push(
          `Invalid evidence path in recommendation "${rec.title}": ${ref.path}`
        );
      }
    }
  }

  for (const ref of output.evidence_references ?? []) {
    if (!isValidEvidencePath(ref.path, payload)) {
      errors.push(`Invalid evidence path: ${ref.path}`);
    }
  }

  return errors;
}

// ============================================================
// Output validation
// ============================================================
function validateOutputStructure(
  raw: unknown
): { valid: boolean; output?: StrategyPocOutput; error?: string } {
  if (!raw || typeof raw !== "object") {
    return { valid: false, error: "Output is not an object" };
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.executive_summary !== "string") {
    return { valid: false, error: "executive_summary must be a string" };
  }
  if (!obj.executive_summary.trim()) {
    return { valid: false, error: "executive_summary must not be empty" };
  }

  if (!Array.isArray(obj.priority_recommendations)) {
    return {
      valid: false,
      error: "priority_recommendations must be an array",
    };
  }
  if (obj.priority_recommendations.length > MAX_RECOMMENDATIONS) {
    return {
      valid: false,
      error: `priority_recommendations must not exceed ${MAX_RECOMMENDATIONS}`,
    };
  }
  for (const rec of obj.priority_recommendations) {
    if (!rec || typeof rec !== "object") {
      return {
        valid: false,
        error: "Each priority_recommendation must be an object",
      };
    }
    const r = rec as Record<string, unknown>;
    if (typeof r.title !== "string" || !r.title.trim()) {
      return {
        valid: false,
        error: "Each priority_recommendation must have a non-empty title",
      };
    }
    if (typeof r.rationale !== "string" || !r.rationale.trim()) {
      return {
        valid: false,
        error: `rationale required for recommendation "${r.title ?? ""}"`,
      };
    }
    if (
      typeof r.recommended_action !== "string" ||
      !r.recommended_action.trim()
    ) {
      return {
        valid: false,
        error: `recommended_action required for recommendation "${r.title ?? ""}"`,
      };
    }
    if (!Array.isArray(r.evidence_references)) {
      return {
        valid: false,
        error: `evidence_references must be an array for recommendation "${r.title ?? ""}"`,
      };
    }
    for (const ref of r.evidence_references) {
      if (!ref || typeof ref !== "object") {
        return {
          valid: false,
          error: "Each evidence_reference must be an object",
        };
      }
      const e = ref as Record<string, unknown>;
      if (typeof e.path !== "string" || !e.path.trim()) {
        return {
          valid: false,
          error: "Each evidence_reference must have a non-empty path",
        };
      }
      if (typeof e.label !== "string" || !e.label.trim()) {
        return {
          valid: false,
          error: "Each evidence_reference must have a non-empty label",
        };
      }
    }
  }

  if (!Array.isArray(obj.client_discussion_questions)) {
    return {
      valid: false,
      error: "client_discussion_questions must be an array",
    };
  }
  if (obj.client_discussion_questions.length > MAX_DISCUSSION_QUESTIONS) {
    return {
      valid: false,
      error: `client_discussion_questions must not exceed ${MAX_DISCUSSION_QUESTIONS}`,
    };
  }
  for (const q of obj.client_discussion_questions) {
    if (typeof q !== "string" || !q.trim()) {
      return {
        valid: false,
        error: "Each client_discussion_question must be a non-empty string",
      };
    }
  }

  if (typeof obj.limitations !== "string") {
    return { valid: false, error: "limitations must be a string" };
  }

  if (!Array.isArray(obj.evidence_references)) {
    return {
      valid: false,
      error: "evidence_references must be an array",
    };
  }
  for (const ref of obj.evidence_references) {
    if (!ref || typeof ref !== "object") {
      return { valid: false, error: "Each evidence_reference must be an object" };
    }
    const e = ref as Record<string, unknown>;
    if (typeof e.path !== "string" || !e.path.trim()) {
      return {
        valid: false,
        error: "Each evidence_reference must have a non-empty path",
      };
    }
    if (typeof e.label !== "string" || !e.label.trim()) {
      return {
        valid: false,
        error: "Each evidence_reference must have a non-empty label",
      };
    }
  }

  return { valid: true, output: obj as unknown as StrategyPocOutput };
}

// ============================================================
// Safe error message (no sensitive data leaked)
// ============================================================
function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message;
    // Strip any potential API keys, tokens, or PII patterns
    const sanitized = msg
      .replace(/sk-[A-Za-z0-9-]{20,}/g, "[REDACTED]")
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "[REDACTED]")
      .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[REDACTED]");
    return sanitized.slice(0, 500);
  }
  return "An unexpected error occurred";
}

// ============================================================
// Main handler
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
    // ── 1. Verify secrets ──
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    const openaiModel = Deno.env.get("OPENAI_MODEL");
    const openaiPromptVersion = Deno.env.get("OPENAI_PROMPT_VERSION");

    if (!openaiApiKey || !openaiModel || !openaiPromptVersion) {
      return new Response(
        JSON.stringify({ error: "AI generation is not properly configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Parse request body ──
    const body = await req.json();
    const { workspace_id, snapshot_id, generation_id } = body as {
      workspace_id?: string;
      snapshot_id?: string;
      generation_id?: string;
    };

    if (!workspace_id || !snapshot_id || !generation_id) {
      return new Response(
        JSON.stringify({
          error:
            "workspace_id, snapshot_id, and generation_id are required",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 3. Create Supabase client with service role ──
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ── 4. Verify authenticated user ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } =
      await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = userData.user.id;

    // ── 5. Confirm workspace access ──
    const { data: workspace, error: wsError } = await supabase
      .from("analysis_workspaces")
      .select("id, service_organization_id")
      .eq("id", workspace_id)
      .maybeSingle();
    if (wsError || !workspace) {
      return new Response(
        JSON.stringify({ error: "Workspace not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check org membership
    const { data: membership } = await supabase
      .from("organization_memberships")
      .select("role, status")
      .eq("profile_id", userId)
      .eq("organization_id", workspace.service_organization_id)
      .eq("status", "active")
      .maybeSingle();
    if (!membership) {
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 6. Confirm generate_ai_analysis capability ──
    const { data: capCheck } = await supabase
      .from("organization_role_capabilities")
      .select("capability")
      .eq("role", membership.role)
      .eq("capability", "generate_ai_analysis")
      .maybeSingle();
    if (!capCheck) {
      return new Response(
        JSON.stringify({ error: "You do not have permission to generate AI analysis" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 7. Confirm ENABLE_AI_ANALYSIS feature flag ──
    const { data: settings } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "ai_feature_flags")
      .maybeSingle();
    const flags = (settings?.value as Record<string, unknown>) ?? {};
    if (flags.enable_ai_analysis !== true) {
      return new Response(
        JSON.stringify({ error: "AI analysis is not enabled" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 8. Load the generation record and verify ownership ──
    const { data: generation, error: genError } = await supabase
      .from("analysis_generations")
      .select("*")
      .eq("id", generation_id)
      .eq("workspace_id", workspace_id)
      .eq("created_by", userId)
      .maybeSingle();
    if (genError || !generation) {
      return new Response(
        JSON.stringify({ error: "Generation record not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (generation.status !== "queued") {
      return new Response(
        JSON.stringify({
          error: `Generation is already in progress or completed (status: ${generation.status})`,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify prompt version matches the deployed version
    if (generation.prompt_version !== SYSTEM_PROMPT_VERSION) {
      await supabase
        .from("analysis_generations")
        .update({
          status: "failed",
          error_message: `Prompt version mismatch: record has "${generation.prompt_version}", deployed version is "${SYSTEM_PROMPT_VERSION}"`,
        })
        .eq("id", generation_id);
      return new Response(
        JSON.stringify({ error: "Prompt version mismatch — please create a new generation request" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 9. Update status to generating ──
    const { error: updateGenErr } = await supabase
      .from("analysis_generations")
      .update({ status: "generating", model_name: openaiModel })
      .eq("id", generation_id);
    if (updateGenErr) {
      return new Response(
        JSON.stringify({ error: "Failed to update generation status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 10. Load immutable snapshot ──
    const { data: snapshot, error: snapError } = await supabase
      .from("analysis_input_snapshots")
      .select("input_json, completeness_level, snapshot_version")
      .eq("id", snapshot_id)
      .maybeSingle();
    if (snapError || !snapshot) {
      await supabase
        .from("analysis_generations")
        .update({
          status: "failed",
          error_message: "Snapshot not found",
        })
        .eq("id", generation_id);
      return new Response(
        JSON.stringify({ error: "Snapshot not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 11. Reject snapshots below sufficient readiness ──
    const completeness = snapshot.completeness_level as string;
    if (completeness !== "sufficient" && completeness !== "strong") {
      await supabase
        .from("analysis_generations")
        .update({
          status: "failed",
          error_message: `Snapshot readiness is "${completeness}", must be sufficient or strong`,
        })
        .eq("id", generation_id);
      return new Response(
        JSON.stringify({
          error: `Snapshot readiness is below sufficient`,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 12. Apply versioned payload filter ──
    const snapshotData = snapshot.input_json as Record<string, unknown>;
    const filteredPayload = buildFilteredPayload(snapshotData);

    // ── 13. Call OpenAI Chat Completions API ──
    const userPrompt = `Analyze the following workplace wellbeing assessment data and produce a strategy proof-of-concept.

DATA (version ${filteredPayload.filter_version}):
${JSON.stringify(filteredPayload, null, 0)}

Respond with ONLY the JSON object. No markdown, no code fences.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

    let openaiResponse: Response;
    try {
      openaiResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({
            model: openaiModel,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
            ],
            max_completion_tokens: 4096,
          }),
          signal: controller.signal,
        }
      );
    } catch (fetchError) {
      clearTimeout(timeoutId);
      const isTimeout =
        fetchError instanceof DOMException &&
        fetchError.name === "AbortError";
      const errMsg = isTimeout
        ? "OpenAI request timed out"
        : safeErrorMessage(fetchError);
      await supabase
        .from("analysis_generations")
        .update({ status: "failed", error_message: errMsg })
        .eq("id", generation_id);
      return new Response(
        JSON.stringify({ error: errMsg }),
        {
          status: isTimeout ? 504 : 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    clearTimeout(timeoutId);

    if (!openaiResponse.ok) {
      await openaiResponse.text();
      const errMsg = `OpenAI API error (${openaiResponse.status})`;
      await supabase
        .from("analysis_generations")
        .update({ status: "failed", error_message: errMsg })
        .eq("id", generation_id);
      return new Response(
        JSON.stringify({ error: errMsg }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 14. Parse OpenAI response ──
    const openaiData = await openaiResponse.json();
    const responseText =
      openaiData.choices?.[0]?.message?.content ??
      openaiData.output?.[0]?.content?.[0]?.text ??
      openaiData.output_text ??
      null;

    if (!responseText || typeof responseText !== "string") {
      await supabase
        .from("analysis_generations")
        .update({
          status: "failed",
          error_message: "OpenAI returned no usable text content",
        })
        .eq("id", generation_id);
      return new Response(
        JSON.stringify({ error: "Invalid model output: no text content" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Strip any markdown code fences
    const cleanedText = responseText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleanedText);
    } catch {
      await supabase
        .from("analysis_generations")
        .update({
          status: "failed",
          error_message: "Model output was not valid JSON",
        })
        .eq("id", generation_id);
      return new Response(
        JSON.stringify({ error: "Invalid model output: not valid JSON" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 15. Validate output structure ──
    const validation = validateOutputStructure(parsed);
    if (!validation.valid || !validation.output) {
      await supabase
        .from("analysis_generations")
        .update({
          status: "failed",
          error_message: validation.error ?? "Output validation failed",
        })
        .eq("id", generation_id);
      return new Response(
        JSON.stringify({ error: validation.error ?? "Output validation failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 16. Validate evidence paths ──
    const evidenceErrors = validateEvidencePaths(
      validation.output,
      filteredPayload
    );
    if (evidenceErrors.length > 0) {
      await supabase
        .from("analysis_generations")
        .update({
          status: "failed",
          error_message: `Invalid evidence paths: ${evidenceErrors.join("; ")}`,
        })
        .eq("id", generation_id);
      return new Response(
        JSON.stringify({ error: evidenceErrors.join("; ") }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 17. Save successful result ──
    const { error: saveError } = await supabase
      .from("analysis_generations")
      .update({
        status: "draft_generated",
        output_json: validation.output as Record<string, unknown>,
        error_message: null,
      })
      .eq("id", generation_id);
    if (saveError) {
      return new Response(
        JSON.stringify({ error: "Failed to save generation result" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 18. Return result (no secrets exposed) ──
    return new Response(
      JSON.stringify({
        generation_id,
        status: "draft_generated",
        output: validation.output,
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
