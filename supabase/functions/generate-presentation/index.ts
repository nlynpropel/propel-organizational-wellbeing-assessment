import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { generateDeckV2 } from "./deck_v2.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TEMPLATE_VERSION = "wellbeing-scorecard-deck-v3";
const MATURITY_BANDS = ["Reactive", "Developing", "Established", "Strategic", "Leading"];
const COVER_IMAGE_FILE = "title-slide-graphic.jpg";
const COVER_IMAGE_RAW_FALLBACK = "https://raw.githubusercontent.com/nlynpropel/propel-organizational-wellbeing-assessment/main/public/title-slide-graphic.jpg";

const DRIVER_LABELS: Record<string, string> = {
  clarity_of_value: "Clarity of Value",
  motivation_overcoming_inertia: "Motivation and Overcoming Inertia",
  trust_social_proof: "Trust and Social Proof",
  structural_environmental_friction: "Structural and Environmental Friction",
};

const DRIVER_DESCRIPTIONS: Record<string, string> = {
  clarity_of_value: "The well-being program’s value and next actions are presented clearly to employees.",
  motivation_overcoming_inertia: "The program makes healthy action feel achievable, timely, and worth continuing.",
  trust_social_proof: "Employees see credible support, relatable participation, and clear privacy protections.",
  structural_environmental_friction: "The program removes access, technology, workplace, and administrative barriers to participation.",
};

type DeckPayload = {
  client: { name: string; assessment_name: string; assessment_date: string };
  assessment: {
    overall_score: number;
    maturity: string;
    bands: string[];
    dimensions: Array<{ name: string; score: number; level: string }>;
    behavioral_drivers: Array<{ name: string; score: number; level: string; body: string }>;
  };
  strategy: {
    executive_summary: string;
    current_maturity: string;
    strengths: Array<{ title: string; body: string }>;
    priority_opportunities: Array<{ title: string; body: string }>;
    holding_back: Array<{ title: string; body: string }>;
    recommendations: Array<{
      title: string;
      why_it_matters: string;
      recommended_action: string;
      suggested_first_step: string;
      expected_impact: string;
      implementation_order: string;
      guidance: string;
      related_findings: string;
    }>;
    implementation_sequence: {
      now: { title: string; body: string };
      next: { title: string; body: string };
      later: { title: string; body: string };
    };
    discussion_questions: string[];
  };
};

type BuildResult = { payload: DeckPayload | null; error: string | null };
type SupabaseClient = ReturnType<typeof createClient>;

function getMaturityLevel(score: number): string {
  if (score >= 90) return "Leading";
  if (score >= 75) return "Strategic";
  if (score >= 60) return "Established";
  if (score >= 40) return "Developing";
  return "Reactive";
}

function getBehavioralInterpretation(score: number): string {
  if (score >= 80) return "Strong behavioral support";
  if (score >= 65) return "Generally supportive";
  if (score >= 50) return "Meaningful barriers";
  return "Significant barriers";
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function parsePhase(value: string): { title: string; body: string } {
  const clean = String(value ?? "").trim();
  const colonIdx = clean.indexOf(":");
  const dashIdx = clean.indexOf(" - ");
  let splitIdx = -1;
  if (colonIdx > 0 && (dashIdx < 0 || colonIdx < dashIdx)) splitIdx = colonIdx;
  else if (dashIdx > 0) splitIdx = dashIdx;
  if (splitIdx <= 0) return { title: clean, body: "" };
  return {
    title: clean.slice(0, splitIdx).trim(),
    body: clean.slice(splitIdx + (clean[splitIdx] === ":" ? 1 : 3)).trim(),
  };
}

function sanitizeForSlides(value: unknown): string {
  if (typeof value !== "string") return "";
  let cleaned = value;
  cleaned = cleaned.replace(/;\s*see\s+[^;]*\.(docx|txt|pdf)[^;]*/gi, "");
  cleaned = cleaned.replace(/see\s+[^\s]*\.(docx|txt|pdf)[^\n]*$/gi, "");
  cleaned = cleaned.replace(/[\w_-]+\.(docx|txt|pdf)/gi, "");
  cleaned = cleaned.replace(/propel_recommendation_bank/gi, "");
  cleaned = cleaned.replace(/Propel_Wellbeing_Strategy_Knowledge_Master_v1/gi, "");
  cleaned = cleaned.replace(/propel_knowledge_sources?/gi, "");
  cleaned = cleaned.replace(/readiness flags?/gi, "");
  cleaned = cleaned.replace(/readiness:\s*missing[^;.]*/gi, "");
  cleaned = cleaned.replace(/readiness\.missing[^;.]*/gi, "");
  cleaned = cleaned.replace(/completeness_level/gi, "");
  cleaned = cleaned.replace(/snapshot_mode/gi, "");
  cleaned = cleaned.replace(/assessment-only mode/gi, "");
  cleaned = cleaned.replace(/diagnostic\s+q\d+\s+response_score=\d+/gi, "");
  cleaned = cleaned.replace(/diagnostic\s+q\d+=\d+/gi, "");
  cleaned = cleaned.replace(/diagnostic_findings\[\d+\]/gi, "");
  cleaned = cleaned.replace(/\bq\d+=\d+/gi, "");
  cleaned = cleaned.replace(/assessment\.scores\.[^\s;.)]*/gi, "");
  cleaned = cleaned.replace(/assessment\.strategy_dimension_scores\[\d+\]/gi, "");
  cleaned = cleaned.replace(/assessment\.diagnostic_findings\[\d+\]/gi, "");
  cleaned = cleaned.replace(/assessment\.behavioral_readiness\.[^\s;.)]*/gi, "");
  cleaned = cleaned.replace(/\s*;\s*;\s*/g, "; ");
  cleaned = cleaned.replace(/\s*;\s*/g, "; ");
  cleaned = cleaned.replace(/\s{2,}/g, " ");
  cleaned = cleaned.replace(/\s*;\s*$/g, "");
  cleaned = cleaned.replace(/\s*and\s*$/gi, "");
  cleaned = cleaned.replace(/^\s*and\s+/gi, "");
  cleaned = cleaned.replace(/\(\s*\)/g, "");
  return cleaned.trim();
}

function truncateWords(value: string, maxWords: number): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return words.length <= maxWords ? value : `${words.slice(0, maxWords).join(" ")}...`;
}

function asArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    : [];
}

function bufferToDataUri(buffer: ArrayBuffer, mime: string): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return `data:${mime};base64,${btoa(binary)}`;
}

async function fetchPublicImageDataUri(
  fileName: string,
  mime: string,
  fallbackUrl?: string,
): Promise<string | null> {
  const urls: string[] = [];
  const siteUrl = Deno.env.get("SITE_URL");
  if (siteUrl) urls.push(`${siteUrl.replace(/\/$/, "")}/${fileName.replace(/^\//, "")}`);
  if (fallbackUrl) urls.push(fallbackUrl);

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      return bufferToDataUri(await res.arrayBuffer(), mime);
    } catch (err) {
      console.error(`Failed to fetch presentation asset ${fileName} from ${url}:`, err);
    }
  }
  return null;
}

async function fetchLogoDataUri(): Promise<string | null> {
  return fetchPublicImageDataUri("Propel_Logo_2020_Main.png", "image/png");
}

async function fetchCoverDataUri(): Promise<string | null> {
  return fetchPublicImageDataUri(COVER_IMAGE_FILE, "image/jpeg", COVER_IMAGE_RAW_FALLBACK);
}

function applyCoverImage(pres: ReturnType<typeof generateDeckV2>, coverDataUri: string | null): void {
  if (!coverDataUri) return;
  const coverSlide = (pres as unknown as { slides?: Array<Record<string, unknown>> }).slides?.[0] as any;
  if (!coverSlide) return;

  // Fill the edited deck's right-side image frame while preserving image aspect ratio.
  coverSlide.addImage({
    data: coverDataUri,
    x: 6.65,
    y: 0.32,
    sizing: { type: "cover", w: 6.15, h: 6.70 },
  });

  // Recreate the prominent rounded lower-left image treatment from the edited cover.
  coverSlide.addShape("ellipse", {
    x: 5.36,
    y: 4.76,
    w: 2.62,
    h: 2.62,
    fill: { color: "FFFFFF" },
    line: { type: "none" },
  });
}

async function buildDeckPayloadServerSide(
  supabase: SupabaseClient,
  assessmentInstanceId: string,
  strategyGenerationId: string,
): Promise<BuildResult> {
  const { data: instance, error: instErr } = await supabase
    .from("assessment_instances")
    .select("*, organization:organizations(*), template:assessment_templates(*)")
    .eq("id", assessmentInstanceId)
    .maybeSingle();
  if (instErr || !instance) return { payload: null, error: "Assessment instance not found" };

  const { data: strategyGen, error: genErr } = await supabase
    .from("analysis_generations")
    .select("*")
    .eq("id", strategyGenerationId)
    .maybeSingle();
  if (genErr || !strategyGen) return { payload: null, error: "Strategy generation not found" };
  if (strategyGen.status !== "approved") {
    return { payload: null, error: `Strategy generation is not approved (status: ${strategyGen.status})` };
  }

  const output = (strategyGen.reviewed_output_json ?? strategyGen.output_json) as Record<string, unknown> | null;
  if (!output) return { payload: null, error: "Strategy generation has no output" };

  const { data: result } = await supabase
    .from("assessment_results")
    .select("result_snapshot, normalized_score, score_band")
    .eq("assessment_instance_id", assessmentInstanceId)
    .maybeSingle();

  const { data: sectionScores } = await supabase
    .from("assessment_section_scores")
    .select("*, section:assessment_sections(title, display_order)")
    .eq("assessment_instance_id", assessmentInstanceId)
    .order("display_order", { referencedTable: "section" });

  let scoreBands = MATURITY_BANDS;
  if (instance.assessment_version_id) {
    const { data: bands } = await supabase
      .from("assessment_score_bands")
      .select("*")
      .eq("assessment_version_id", instance.assessment_version_id)
      .order("display_order");
    const labels = ((bands ?? []) as Array<Record<string, unknown>>)
      .map((band) => String(band.band_label ?? band.band_name ?? "").trim())
      .filter(Boolean);
    if (labels.length) scoreBands = labels;
  }

  let recommendations: Record<string, unknown> | null = null;
  try {
    const { data: recData, error: recErr } = await supabase.rpc("get_recommendations_for_report", {
      p_assessment_instance_id: assessmentInstanceId,
    });
    if (!recErr && recData) recommendations = recData as Record<string, unknown>;
  } catch {
    // Continue without deterministic recommendations.
  }

  const org = instance.organization as Record<string, unknown> | null;
  const template = instance.template as Record<string, unknown> | null;
  const clientName = String(org?.organization_name ?? "Unknown Client");
  const assessmentName = String(template?.name ?? "Propel Well-being Scorecard");
  const completionDate = formatDate(instance.submitted_at ?? instance.created_at ?? null);
  const overallScore = result?.normalized_score
    ? Math.round(Number(result.normalized_score))
    : instance.overall_score
      ? Math.round(Number(instance.overall_score))
      : 0;
  const maturity = String(result?.score_band ?? getMaturityLevel(overallScore));

  const dimensions = ((sectionScores ?? []) as Array<Record<string, unknown>>).map((ss) => {
    const section = ss.section as Record<string, unknown> | null;
    const score = Math.round(Number(ss.normalized_score ?? 0));
    return {
      name: String(section?.title ?? "Unknown"),
      score,
      level: getMaturityLevel(score),
    };
  });

  const snapshot = (result?.result_snapshot ?? null) as Record<string, unknown> | null;
  const readiness = (snapshot?.behavioral_readiness ?? null) as Record<string, unknown> | null;
  const behavioralDrivers: DeckPayload["assessment"]["behavioral_drivers"] = [];
  if (readiness) {
    for (const key of ["clarity_of_value", "motivation_overcoming_inertia", "trust_social_proof", "structural_environmental_friction"]) {
      const score = Number(readiness[key] ?? 0);
      behavioralDrivers.push({
        name: DRIVER_LABELS[key],
        score: Math.round(score),
        level: getBehavioralInterpretation(score),
        body: DRIVER_DESCRIPTIONS[key],
      });
    }
  }

  const executiveSummary = truncateWords(sanitizeForSlides(output.executive_summary), 130);
  const currentMaturity = truncateWords(sanitizeForSlides(output.maturity_interpretation), 120);
  const recsData = recommendations as Record<string, unknown> | null;
  const strengths = asArray(recsData?.strengths).map((item) => ({
    title: sanitizeForSlides(item.title),
    body: sanitizeForSlides(item.description),
  }));
  const priorityOpportunities = asArray(recsData?.priorityOpportunities).map((item) => ({
    title: sanitizeForSlides(item.title),
    body: sanitizeForSlides(item.description),
  }));
  const holdingBack = asArray(output.prioritized_barriers).map((item) => ({
    title: sanitizeForSlides(item.title),
    body: sanitizeForSlides(item.description),
  }));
  const deckRecommendations = asArray(output.priority_recommendations).map((rec) => ({
    title: sanitizeForSlides(rec.title),
    why_it_matters: sanitizeForSlides(rec.why_this_matters),
    recommended_action: sanitizeForSlides(rec.recommended_action),
    suggested_first_step: sanitizeForSlides(rec.suggested_first_step),
    expected_impact: sanitizeForSlides(rec.expected_strategic_impact),
    implementation_order: sanitizeForSlides(rec.implementation_sequence),
    guidance: sanitizeForSlides(rec.propel_knowledge_evidence),
    related_findings: sanitizeForSlides(rec.assessment_evidence),
  }));
  const implSeq = Array.isArray(output.implementation_sequence) ? output.implementation_sequence.map(String) : [];
  const discussionQuestions = Array.isArray(output.client_discussion_questions)
    ? output.client_discussion_questions.map((q) => sanitizeForSlides(q)).filter(Boolean).slice(0, 3)
    : [];

  return {
    payload: {
      client: { name: clientName, assessment_name: assessmentName, assessment_date: completionDate },
      assessment: {
        overall_score: overallScore,
        maturity,
        bands: scoreBands,
        dimensions,
        behavioral_drivers: behavioralDrivers,
      },
      strategy: {
        executive_summary: executiveSummary,
        current_maturity: currentMaturity,
        strengths,
        priority_opportunities: priorityOpportunities,
        holding_back: holdingBack,
        recommendations: deckRecommendations,
        implementation_sequence: {
          now: implSeq[0] ? parsePhase(implSeq[0]) : { title: "Phase 1", body: "" },
          next: implSeq[1] ? parsePhase(implSeq[1]) : { title: "Phase 2", body: "" },
          later: implSeq[2] ? parsePhase(implSeq[2]) : { title: "Phase 3", body: "" },
        },
        discussion_questions: discussionQuestions,
      },
    },
    error: null,
  };
}

function countWords(value: string): number {
  return typeof value === "string" ? value.trim().split(/\s+/).filter(Boolean).length : 0;
}

function validatePayload(payload: DeckPayload): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!payload.client.name.trim()) errors.push("Client name is required");
  if (!payload.assessment.maturity.trim()) errors.push("Maturity band is required");
  if (payload.assessment.dimensions.length !== 6) errors.push("Exactly 6 dimensions required");
  if (payload.assessment.behavioral_drivers.length !== 4) errors.push("Exactly 4 behavioral drivers required");
  if (!payload.strategy.executive_summary.trim()) errors.push("Executive summary is required");
  if (payload.strategy.recommendations.length < 1) errors.push("At least 1 recommendation is required");
  if (payload.assessment.overall_score < 0 || payload.assessment.overall_score > 100) errors.push("Overall score must be 0-100");

  for (const dimension of payload.assessment.dimensions) {
    if (dimension.score < 0 || dimension.score > 100) errors.push(`Dimension "${dimension.name}" score out of range`);
  }
  for (const driver of payload.assessment.behavioral_drivers) {
    if (driver.score < 0 || driver.score > 100) errors.push(`Driver "${driver.name}" score out of range`);
  }

  const seq = payload.strategy.implementation_sequence;
  if (!seq.now.title.trim() || !seq.now.body.trim()) errors.push("Phase 1 is incomplete");
  if (!seq.next.title.trim() || !seq.next.body.trim()) errors.push("Phase 2 is incomplete");
  if (!seq.later.title.trim() || !seq.later.body.trim()) errors.push("Phase 3 is incomplete");
  if (countWords(payload.strategy.executive_summary) > 130) errors.push("Executive summary exceeds 130 words");
  if (countWords(payload.strategy.current_maturity) > 120) errors.push("Current maturity exceeds 120 words");

  const prohibited = [
    "file-", "vs_", "file_id", "vector_store", "source:", "sources:",
    "according to the document", "see guidance in", "from the knowledge base",
    "strategy knowledge master", "recommendation bank", "propel knowledge sources",
    "materials used", "retrieved materials", "readiness flags", "completeness_level",
    "snapshot_mode", "assessment-only mode", ".docx", ".pdf", ".txt",
  ];
  const allText = [
    payload.strategy.executive_summary,
    payload.strategy.current_maturity,
    ...payload.strategy.holding_back.map((item) => `${item.title} ${item.body}`),
    ...payload.strategy.recommendations.map((item) => `${item.title} ${item.why_it_matters} ${item.guidance} ${item.related_findings}`),
  ];
  for (const value of allText) {
    const lower = value.toLowerCase();
    for (const pattern of prohibited) {
      if (lower.includes(pattern)) {
        errors.push(`Prohibited metadata found: '${pattern}'`);
        break;
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 500) : "An unexpected error occurred";
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { presentation_generation_id, assessment_instance_id, strategy_generation_id } = body as {
      presentation_generation_id?: string;
      assessment_instance_id?: string;
      strategy_generation_id?: string;
    };
    if (!presentation_generation_id || !assessment_instance_id || !strategy_generation_id) {
      return new Response(JSON.stringify({ error: "presentation_generation_id, assessment_instance_id, and strategy_generation_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
    const userRole = profile?.role as string | undefined;
    if (userRole !== "superadmin" && userRole !== "propel_csm") {
      return new Response(JSON.stringify({ error: "Only Propel CSMs and superadmins can generate presentations" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (userRole === "propel_csm") {
      const { data: membership } = await supabase
        .from("organization_memberships")
        .select("role, status")
        .eq("profile_id", userData.user.id)
        .eq("status", "active")
        .maybeSingle();
      if (!membership) {
        return new Response(JSON.stringify({ error: "Access denied" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: presGen, error: presGenErr } = await supabase
      .from("presentation_generations")
      .select("*")
      .eq("id", presentation_generation_id)
      .maybeSingle();
    if (presGenErr || !presGen) {
      return new Response(JSON.stringify({ error: "Presentation generation record not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (presGen.status !== "queued") {
      return new Response(JSON.stringify({ error: `Generation is already in progress or completed (status: ${presGen.status})` }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("presentation_generations").update({ status: "generating" }).eq("id", presentation_generation_id);

    const { payload, error: buildError } = await buildDeckPayloadServerSide(supabase, assessment_instance_id, strategy_generation_id);
    if (buildError || !payload) {
      await supabase.from("presentation_generations").update({
        status: "failed",
        error_message: buildError ?? "Failed to build payload",
        completed_at: new Date().toISOString(),
      }).eq("id", presentation_generation_id);
      return new Response(JSON.stringify({ error: buildError ?? "Failed to build payload" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validation = validatePayload(payload);
    if (!validation.valid) {
      await supabase.from("presentation_generations").update({
        status: "failed",
        error_message: validation.errors.join("; "),
        completed_at: new Date().toISOString(),
      }).eq("id", presentation_generation_id);
      return new Response(JSON.stringify({ error: "Payload validation failed", details: validation.errors }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("presentation_generations")
      .update({ payload_snapshot_json: payload as unknown as Record<string, unknown> })
      .eq("id", presentation_generation_id);

    let fileBuffer: ArrayBuffer;
    try {
      const [logoDataUri, coverDataUri] = await Promise.all([fetchLogoDataUri(), fetchCoverDataUri()]);
      const pres = generateDeckV2(payload, logoDataUri);
      applyCoverImage(pres, coverDataUri);
      fileBuffer = await pres.write({ outputType: "arraybuffer" }) as ArrayBuffer;
    } catch (genErr) {
      await supabase.from("presentation_generations").update({
        status: "failed",
        error_message: safeErrorMessage(genErr),
        completed_at: new Date().toISOString(),
      }).eq("id", presentation_generation_id);
      return new Response(JSON.stringify({ error: "Deck generation failed", details: safeErrorMessage(genErr) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!fileBuffer || fileBuffer.byteLength === 0) {
      await supabase.from("presentation_generations").update({
        status: "failed",
        error_message: "Generated file is empty",
        completed_at: new Date().toISOString(),
      }).eq("id", presentation_generation_id);
      return new Response(JSON.stringify({ error: "Generated file is empty" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: instance } = await supabase
      .from("assessment_instances")
      .select("organization_id")
      .eq("id", assessment_instance_id)
      .maybeSingle();
    const orgId = instance?.organization_id ?? "unknown";
    const sanitizedClientName = sanitizeFileName(payload.client.name);
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `${sanitizedClientName}-wellbeing-scorecard-report-${dateStr}.pptx`;
    const storagePath = `${orgId}/${assessment_instance_id}/${presentation_generation_id}.pptx`;

    const { error: uploadErr } = await supabase.storage
      .from("strategy-presentations")
      .upload(storagePath, fileBuffer, {
        contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        upsert: false,
      });
    if (uploadErr) {
      await supabase.from("presentation_generations").update({
        status: "failed",
        error_message: safeErrorMessage(uploadErr),
        completed_at: new Date().toISOString(),
      }).eq("id", presentation_generation_id);
      return new Response(JSON.stringify({ error: "Failed to upload presentation file", details: safeErrorMessage(uploadErr) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("presentation_generations").update({
      status: "completed",
      storage_path: storagePath,
      file_name: fileName,
      completed_at: new Date().toISOString(),
      error_message: null,
    }).eq("id", presentation_generation_id);

    return new Response(JSON.stringify({
      presentation_generation_id,
      status: "completed",
      storage_path: storagePath,
      file_name: fileName,
      template_version: TEMPLATE_VERSION,
      file_size: fileBuffer.byteLength,
      slide_count: 8 + payload.strategy.recommendations.length,
      payload_built_by: "server",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: safeErrorMessage(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
