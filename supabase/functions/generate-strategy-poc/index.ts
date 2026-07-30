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
const SYSTEM_PROMPT_VERSION = Deno.env.get("OPENAI_PROMPT_VERSION") ?? "strategy-poc-v2";
const OPENAI_TIMEOUT_MS = 90_000;
const MAX_RECOMMENDATIONS = 5;
const MAX_DISCUSSION_QUESTIONS = 5;
const MAX_BARRIERS = 5;

// Types (used for runtime validation only)
type EvidenceRef = {
  path: string;
  label: string;
};

type SourceReference = {
  source_title: string;
  source_type: "propel_knowledge";
  file_id: string | null;
};

type PrioritizedBarrier = {
  title: string;
  description: string;
};

type PriorityRecommendation = {
  title: string;
  why_this_matters: string;
  assessment_evidence: string;
  propel_knowledge_evidence: string;
  recommended_action: string;
  suggested_first_step: string;
  expected_strategic_impact: string;
  implementation_sequence: string;
  evidence_references: EvidenceRef[];
};

type StrategyPocOutput = {
  executive_summary: string;
  maturity_interpretation: string;
  prioritized_barriers: PrioritizedBarrier[];
  priority_recommendations: PriorityRecommendation[];
  implementation_sequence: string[];
  client_discussion_questions: string[];
  limitations: string;
  source_references: SourceReference[];
  evidence_references: EvidenceRef[];
};

// ============================================================
// Versioned system prompt
// ============================================================
const SYSTEM_PROMPT = `You are a workplace wellbeing strategy advisor. You analyze assessment data and produce a strategy proof-of-concept grounded in both the client's assessment results and the Propel knowledge base.

STRICT RULES:
1. Output ONLY valid JSON matching the specified schema. No markdown, no code fences, no commentary.
2. Generate at most ${MAX_RECOMMENDATIONS} priority recommendations.
3. Generate at most ${MAX_DISCUSSION_QUESTIONS} client discussion questions.
4. Generate at most ${MAX_BARRIERS} prioritized barriers.
5. Every evidence_references entry must use a "path" that refers to a real section in the provided data (e.g., "assessment.strategy_dimension_scores", "recommendations[0]", "utilization[0]", "notes[2]").
6. Do NOT include PII, personal names, email addresses, or phone numbers.
7. Do NOT include internal scoring formulas, driver mapping weights, or methodology details.
8. "internal" notes may influence your analysis but must NEVER appear verbatim in output.
9. "organization_team" notes may influence your analysis but must NOT appear verbatim unless explicitly approved.
10. "client_report_candidate" notes may influence your analysis and may be paraphrased in output.
11. Be concise, specific, and actionable. Use plain professional language.
12. Use the file_search tool to retrieve relevant Propel knowledge. Cite retrieved knowledge in propel_knowledge_evidence and source_references using the human-readable filename from the retrieved results.
13. Every priority recommendation must be grounded in BOTH assessment evidence (assessment_evidence) AND Propel knowledge (propel_knowledge_evidence) when knowledge retrieval is available.
14. When knowledge retrieval is not available, set propel_knowledge_evidence to an empty string and note the limitation in the limitations field.
15. source_references must use source_title matching the filename of retrieved documents. Set file_id to null if unknown.

JSON SCHEMA:
{
  "executive_summary": "string — 3-5 sentence overview of the client's wellbeing maturity, key barriers, and strategic opportunities",
  "maturity_interpretation": "string — 2-4 paragraph narrative interpreting the maturity band, dimension scores, and what the pattern reveals about the organization's readiness",
  "prioritized_barriers": [
    {
      "title": "string — short barrier title",
      "description": "string — what the barrier is and why it matters, grounded in assessment data"
    }
  ],
  "priority_recommendations": [
    {
      "title": "string — short title",
      "why_this_matters": "string — why this matters for this client, grounded in the data",
      "assessment_evidence": "string — specific assessment findings that support this recommendation",
      "propel_knowledge_evidence": "string — specific Propel knowledge that supports this recommendation, with filename cited",
      "recommended_action": "string — specific next step",
      "suggested_first_step": "string — the first concrete action to take within 30 days",
      "expected_strategic_impact": "string — what strategic outcome this will produce and over what timeframe",
      "implementation_sequence": "string — where this fits in the sequence of recommendations (e.g., 'Phase 1: Foundation', 'Phase 2: Build')",
      "evidence_references": [
        { "path": "string — dot-path into the provided data", "label": "string — human-readable label" }
      ]
    }
  ],
  "implementation_sequence": ["string — ordered phase description"],
  "client_discussion_questions": ["string — open-ended question for the client"],
  "limitations": "string — caveats about data quality, scope, confidence, or knowledge coverage",
  "source_references": [
    { "source_title": "string — filename of the Propel knowledge document", "source_type": "propel_knowledge", "file_id": "string or null" }
  ],
  "evidence_references": [
    { "path": "string — dot-path into the provided data", "label": "string — human-readable label" }
  ]
}`;

// ============================================================
// JSON Schema for Structured Outputs (Responses API text.format)
// ============================================================
const STRATEGY_REPORT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "executive_summary",
    "maturity_interpretation",
    "prioritized_barriers",
    "priority_recommendations",
    "implementation_sequence",
    "client_discussion_questions",
    "limitations",
    "source_references",
    "evidence_references",
  ],
  properties: {
    executive_summary: { type: "string" },
    maturity_interpretation: { type: "string" },
    prioritized_barriers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
        },
      },
    },
    priority_recommendations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "why_this_matters",
          "assessment_evidence",
          "propel_knowledge_evidence",
          "recommended_action",
          "suggested_first_step",
          "expected_strategic_impact",
          "implementation_sequence",
          "evidence_references",
        ],
        properties: {
          title: { type: "string" },
          why_this_matters: { type: "string" },
          assessment_evidence: { type: "string" },
          propel_knowledge_evidence: { type: "string" },
          recommended_action: { type: "string" },
          suggested_first_step: { type: "string" },
          expected_strategic_impact: { type: "string" },
          implementation_sequence: { type: "string" },
          evidence_references: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["path", "label"],
              properties: {
                path: { type: "string" },
                label: { type: "string" },
              },
            },
          },
        },
      },
    },
    implementation_sequence: {
      type: "array",
      items: { type: "string" },
    },
    client_discussion_questions: {
      type: "array",
      items: { type: "string" },
    },
    limitations: { type: "string" },
    source_references: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["source_title", "source_type", "file_id"],
        properties: {
          source_title: { type: "string" },
          source_type: { type: "string", enum: ["propel_knowledge"] },
          file_id: { type: ["string", "null"] },
        },
      },
    },
    evidence_references: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["path", "label"],
        properties: {
          path: { type: "string" },
          label: { type: "string" },
        },
      },
    },
  },
};

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
// Retrieval focus extraction
// ============================================================
function buildRetrievalFocus(payload: FilteredPayload): string {
  const focusParts: string[] = [];

  const org = payload.client_organization;
  if (org.industry) focusParts.push(`Industry: ${org.industry}`);
  if (org.size_band) focusParts.push(`Employee size: ${org.size_band}`);

  const assessment = payload.assessment;
  const dimensionScores =
    assessment.strategy_dimension_scores as
      | Array<Record<string, unknown>>
      | undefined;
  if (Array.isArray(dimensionScores)) {
    const weak = dimensionScores
      .map((d) => ({
        name: String(d.dimension_name ?? d.name ?? ""),
        score: typeof d.score === "number" ? d.score : null,
      }))
      .filter((d) => d.score !== null && d.score < 60)
      .map((d) => `${d.name} (${d.score})`);
    if (weak.length > 0) {
      focusParts.push(`Weak dimensions (score < 60): ${weak.join(", ")}`);
    }
  }

  const behavioral =
    assessment.behavioral_readiness as Record<string, unknown> | undefined;
  if (behavioral && typeof behavioral === "object") {
    const barriers = behavioral.barriers as
      | Array<Record<string, unknown>>
      | undefined;
    if (Array.isArray(barriers)) {
      const barrierNames = barriers
        .map((b) => String(b.barrier_name ?? b.name ?? ""))
        .filter(Boolean);
      if (barrierNames.length > 0) {
        focusParts.push(
          `Behavioral barriers: ${barrierNames.slice(0, 5).join(", ")}`
        );
      }
    }
  }

  const findings = assessment.diagnostic_findings as
    | Array<Record<string, unknown>>
    | undefined;
  if (Array.isArray(findings)) {
    const findingTitles = findings
      .map((f) => String(f.title ?? f.finding ?? ""))
      .filter(Boolean)
      .slice(0, 5);
    if (findingTitles.length > 0) {
      focusParts.push(
        `Diagnostic findings: ${findingTitles.join(", ")}`
      );
    }
  }

  if (Array.isArray(payload.recommendations)) {
    const categories = payload.recommendations
      .map((r) => {
        const rec = r as Record<string, unknown>;
        return String(rec.category ?? rec.recommendation_type ?? "");
      })
      .filter(Boolean);
    if (categories.length > 0) {
      const unique = [...new Set(categories)].slice(0, 5);
      focusParts.push(
        `Recommendation categories: ${unique.join(", ")}`
      );
    }
  }

  if (focusParts.length === 0) {
    return "No specific retrieval focus could be extracted. Search broadly for workplace wellbeing strategy best practices.";
  }

  return focusParts.join("\n");
}

// ============================================================
// Evidence path validation
// ============================================================
const ASSESSMENT_NESTED_KEYS = new Set([
  "strategy_dimension_scores",
  "behavioral_readiness",
  "contextual_responses",
  "diagnostic_findings",
  "template_name",
  "template_description",
  "instance_status",
  "submitted_at",
  "overall_score",
  "maturity_band",
]);

function resolvePath(parts: string[], root: unknown): boolean {
  let current: unknown = root;
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

function isValidEvidencePath(
  path: string,
  payload: FilteredPayload
): boolean {
  if (!path || typeof path !== "string") return false;

  const parts = path.split(".");
  const root = payload as Record<string, unknown>;

  if (resolvePath(parts, root)) return true;

  if (parts.length > 0 && ASSESSMENT_NESTED_KEYS.has(parts[0])) {
    return resolvePath(["assessment", ...parts], root);
  }

  return false;
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
// Canonicalize evidence paths
// ============================================================
function canonicalizePath(path: string): string {
  if (!path || typeof path !== "string") return path;
  if (path.startsWith("assessment.")) return path;
  const firstSegment = path.split(".")[0].replace(/\[.*$/, "");
  if (ASSESSMENT_NESTED_KEYS.has(firstSegment)) {
    return `assessment.${path}`;
  }
  return path;
}

function normalizeEvidencePathsInOutput(
  output: StrategyPocOutput
): StrategyPocOutput {
  const normalized = { ...output } as Record<string, unknown>;

  if (Array.isArray(normalized.priority_recommendations)) {
    normalized.priority_recommendations = (
      normalized.priority_recommendations as Array<Record<string, unknown>>
    ).map((rec) => ({
      ...rec,
      evidence_references: Array.isArray(rec.evidence_references)
        ? (rec.evidence_references as Array<Record<string, unknown>>).map(
            (ref) => ({
              ...ref,
              path: canonicalizePath(ref.path as string),
            })
          )
        : rec.evidence_references,
    }));
  }

  if (Array.isArray(normalized.evidence_references)) {
    normalized.evidence_references = (
      normalized.evidence_references as Array<Record<string, unknown>>
    ).map((ref) => ({
      ...ref,
      path: canonicalizePath(ref.path as string),
    }));
  }

  return normalized as unknown as StrategyPocOutput;
}

// ============================================================
// Responses API parsing
// ============================================================
type FileSearchResult = {
  file_id: string;
  filename: string;
  score: number | null;
};

type CitationAnnotation = {
  file_id: string;
  filename: string;
  quote: string | null;
};

type RetrievalMetadata = {
  file_search_results: FileSearchResult[];
  citation_annotations: CitationAnnotation[];
  catalog_verified_files: string[];
  catalog_unverified_files: string[];
  blocked_files: string[];
  knowledge_enabled: boolean;
};

function extractOutputText(data: Record<string, unknown>): string | null {
  // Responses API: output is an array of items
  const outputArr = data.output as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(outputArr)) {
    for (const item of outputArr) {
      if (item.type === "message" && item.role === "assistant") {
        const content = item.content as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(content)) {
          for (const part of content) {
            if (part.type === "output_text" && typeof part.text === "string") {
              return part.text;
            }
            if (part.type === "text" && typeof part.text === "string") {
              return part.text;
            }
          }
        }
      }
    }
  }

  // Fallback: output_text (convenience field)
  if (typeof data.output_text === "string") {
    return data.output_text;
  }

  // Fallback: choices[0].message.content (Chat Completions compatibility)
  const choices = data.choices as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(choices)) {
    const msg = choices[0]?.message as Record<string, unknown> | undefined;
    if (msg && typeof msg.content === "string") {
      return msg.content;
    }
  }

  return null;
}

function extractFileSearchResults(
  data: Record<string, unknown>
): FileSearchResult[] {
  const results: FileSearchResult[] = [];
  const outputArr = data.output as Array<Record<string, unknown>> | undefined;

  if (!Array.isArray(outputArr)) return results;

  for (const item of outputArr) {
    if (item.type === "file_search_call") {
      const searchResults = item.results as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(searchResults)) {
        for (const r of searchResults) {
          results.push({
            file_id: String(r.file_id ?? r.id ?? ""),
            filename: String(r.filename ?? r.file_name ?? ""),
            score: typeof r.score === "number" ? r.score : null,
          });
        }
      }
    }
  }

  return results;
}

function extractCitationAnnotations(
  data: Record<string, unknown>
): CitationAnnotation[] {
  const annotations: CitationAnnotation[] = [];
  const outputArr = data.output as Array<Record<string, unknown>> | undefined;

  if (!Array.isArray(outputArr)) return annotations;

  for (const item of outputArr) {
    if (item.type === "message" && item.role === "assistant") {
      const content = item.content as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(content)) {
        for (const part of content) {
          const partAnnotations = part.annotations as Array<Record<string, unknown>> | undefined;
          if (Array.isArray(partAnnotations)) {
            for (const ann of partAnnotations) {
              if (ann.type === "file_citation") {
                const fileCitation = ann.file_citation as Record<string, unknown> | undefined;
                if (fileCitation) {
                  annotations.push({
                    file_id: String(fileCitation.file_id ?? ""),
                    filename: String(fileCitation.filename ?? ""),
                    quote: typeof ann.quote === "string" ? ann.quote : null,
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  return annotations;
}

// ============================================================
// Citation validation
// ============================================================
type CatalogEntry = {
  openai_file_id: string;
  title: string;
  is_active: boolean;
  client_facing_eligible: boolean;
};

function validateCitations(
  output: StrategyPocOutput,
  fileSearchResults: FileSearchResult[],
  citationAnnotations: CitationAnnotation[],
  catalog: CatalogEntry[],
  knowledgeEnabled: boolean
): { verified: string[]; unverified: string[]; blockedFileIds: Set<string>; metadata: RetrievalMetadata } {
  const catalogMap = new Map(catalog.map((c) => [c.openai_file_id, c]));
  const retrievedFileIds = new Set(fileSearchResults.map((r) => r.file_id));
  const retrievedFilenames = new Set(fileSearchResults.map((r) => r.filename));

  const verified: string[] = [];
  const unverified: string[] = [];

  if (!knowledgeEnabled) {
    return {
      verified: [],
      unverified: [],
      blockedFileIds: new Set<string>(),
      metadata: {
        file_search_results: [],
        citation_annotations: [],
        catalog_verified_files: [],
        catalog_unverified_files: [],
        blocked_files: [],
        knowledge_enabled: false,
      },
    };
  }

  const referencedFileIds = new Set<string>();
  const referencedTitles = new Set<string>();

  for (const ref of output.source_references ?? []) {
    if (ref.file_id) referencedFileIds.add(ref.file_id);
    if (ref.source_title) referencedTitles.add(ref.source_title);
  }

  for (const fileId of referencedFileIds) {
    const catalogEntry = catalogMap.get(fileId);
    const wasRetrieved = retrievedFileIds.has(fileId);

    if (!wasRetrieved) {
      unverified.push(fileId);
      continue;
    }

    if (catalogEntry) {
      if (!catalogEntry.is_active || !catalogEntry.client_facing_eligible) {
        unverified.push(fileId);
      } else {
        verified.push(fileId);
      }
    } else {
      unverified.push(fileId);
    }
  }

  for (const title of referencedTitles) {
    if (retrievedFilenames.has(title)) {
      const result = fileSearchResults.find((r) => r.filename === title);
      if (result && !verified.includes(result.file_id)) {
        const catalogEntry = catalogMap.get(result.file_id);
        if (catalogEntry) {
          if (catalogEntry.is_active && catalogEntry.client_facing_eligible) {
            verified.push(result.file_id);
          } else {
            unverified.push(result.file_id);
          }
        } else {
          unverified.push(result.file_id);
        }
      }
    } else {
      unverified.push(`title:${title}`);
    }
  }

  const blockedFileIds = new Set<string>();
  for (const id of unverified) {
    if (!id.startsWith("title:")) {
      blockedFileIds.add(id);
    }
  }

  return {
    verified,
    unverified,
    blockedFileIds,
    metadata: {
      file_search_results: fileSearchResults,
      citation_annotations: citationAnnotations,
      catalog_verified_files: verified,
      catalog_unverified_files: unverified,
      blocked_files: [...blockedFileIds],
      knowledge_enabled: true,
    },
  };
}

// ============================================================
// Internal ID stripping
// ============================================================
function stripInternalIds(
  output: StrategyPocOutput
): StrategyPocOutput {
  return {
    ...output,
    source_references: (output.source_references ?? []).map((ref) => ({
      ...ref,
      file_id: null,
    })),
  };
}

function stripBlockedSources(
  output: StrategyPocOutput,
  blockedFileIds: Set<string>,
  fileSearchResults: FileSearchResult[]
): StrategyPocOutput {
  if (blockedFileIds.size === 0) return output;

  const blockedFilenames = new Set(
    fileSearchResults
      .filter((r) => blockedFileIds.has(r.file_id))
      .map((r) => r.filename)
  );

  const filtered = (output.source_references ?? []).filter((ref) => {
    if (ref.file_id && blockedFileIds.has(ref.file_id)) return false;
    if (ref.source_title && blockedFilenames.has(ref.source_title)) return false;
    return true;
  });

  return {
    ...output,
    source_references: filtered,
  };
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

  if (typeof obj.maturity_interpretation !== "string") {
    return { valid: false, error: "maturity_interpretation must be a string" };
  }
  if (!obj.maturity_interpretation.trim()) {
    return { valid: false, error: "maturity_interpretation must not be empty" };
  }

  if (!Array.isArray(obj.prioritized_barriers)) {
    return { valid: false, error: "prioritized_barriers must be an array" };
  }
  if (obj.prioritized_barriers.length > MAX_BARRIERS) {
    return {
      valid: false,
      error: `prioritized_barriers must not exceed ${MAX_BARRIERS}`,
    };
  }
  for (const barrier of obj.prioritized_barriers) {
    if (!barrier || typeof barrier !== "object") {
      return { valid: false, error: "Each prioritized_barrier must be an object" };
    }
    const b = barrier as Record<string, unknown>;
    if (typeof b.title !== "string" || !b.title.trim()) {
      return {
        valid: false,
        error: "Each prioritized_barrier must have a non-empty title",
      };
    }
    if (typeof b.description !== "string" || !b.description.trim()) {
      return {
        valid: false,
        error: `description required for barrier "${b.title ?? ""}"`,
      };
    }
  }

  if (!Array.isArray(obj.priority_recommendations)) {
    return { valid: false, error: "priority_recommendations must be an array" };
  }
  if (obj.priority_recommendations.length > MAX_RECOMMENDATIONS) {
    return {
      valid: false,
      error: `priority_recommendations must not exceed ${MAX_RECOMMENDATIONS}`,
    };
  }
  for (const rec of obj.priority_recommendations) {
    if (!rec || typeof rec !== "object") {
      return { valid: false, error: "Each priority_recommendation must be an object" };
    }
    const r = rec as Record<string, unknown>;
    if (typeof r.title !== "string" || !r.title.trim()) {
      return {
        valid: false,
        error: "Each priority_recommendation must have a non-empty title",
      };
    }
    const requiredStringFields = [
      "why_this_matters",
      "assessment_evidence",
      "propel_knowledge_evidence",
      "recommended_action",
      "suggested_first_step",
      "expected_strategic_impact",
      "implementation_sequence",
    ];
    for (const field of requiredStringFields) {
      if (typeof r[field] !== "string" || !r[field].trim()) {
        return {
          valid: false,
          error: `${field} required for recommendation "${r.title ?? ""}"`,
        };
      }
    }
    if (!Array.isArray(r.evidence_references)) {
      return {
        valid: false,
        error: `evidence_references must be an array for recommendation "${r.title ?? ""}"`,
      };
    }
    for (const ref of r.evidence_references) {
      if (!ref || typeof ref !== "object") {
        return { valid: false, error: "Each evidence_reference must be an object" };
      }
      const e = ref as Record<string, unknown>;
      if (typeof e.path !== "string" || !e.path.trim()) {
        return { valid: false, error: "Each evidence_reference must have a non-empty path" };
      }
      if (typeof e.label !== "string" || !e.label.trim()) {
        return { valid: false, error: "Each evidence_reference must have a non-empty label" };
      }
    }
  }

  if (!Array.isArray(obj.implementation_sequence)) {
    return { valid: false, error: "implementation_sequence must be an array" };
  }
  for (const phase of obj.implementation_sequence) {
    if (typeof phase !== "string" || !phase.trim()) {
      return {
        valid: false,
        error: "Each implementation_sequence entry must be a non-empty string",
      };
    }
  }

  if (!Array.isArray(obj.client_discussion_questions)) {
    return { valid: false, error: "client_discussion_questions must be an array" };
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

  if (!Array.isArray(obj.source_references)) {
    return { valid: false, error: "source_references must be an array" };
  }
  for (const ref of obj.source_references) {
    if (!ref || typeof ref !== "object") {
      return { valid: false, error: "Each source_reference must be an object" };
    }
    const s = ref as Record<string, unknown>;
    if (typeof s.source_title !== "string" || !s.source_title.trim()) {
      return {
        valid: false,
        error: "Each source_reference must have a non-empty source_title",
      };
    }
    if (s.source_type !== "propel_knowledge") {
      return { valid: false, error: "source_type must be 'propel_knowledge'" };
    }
    if (s.file_id !== null && typeof s.file_id !== "string") {
      return { valid: false, error: "file_id must be a string or null" };
    }
  }

  if (!Array.isArray(obj.evidence_references)) {
    return { valid: false, error: "evidence_references must be an array" };
  }
  for (const ref of obj.evidence_references) {
    if (!ref || typeof ref !== "object") {
      return { valid: false, error: "Each evidence_reference must be an object" };
    }
    const e = ref as Record<string, unknown>;
    if (typeof e.path !== "string" || !e.path.trim()) {
      return { valid: false, error: "Each evidence_reference must have a non-empty path" };
    }
    if (typeof e.label !== "string" || !e.label.trim()) {
      return { valid: false, error: "Each evidence_reference must have a non-empty label" };
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

    // Knowledge retrieval config
    const vectorStoreId = Deno.env.get("OPENAI_VECTOR_STORE_ID");
    const knowledgeEnabledRaw = Deno.env.get("OPENAI_KNOWLEDGE_ENABLED");
    const knowledgeEnabled = knowledgeEnabledRaw === "true" && !!vectorStoreId;

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
          error: "workspace_id, snapshot_id, and generation_id are required",
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
        .update({ status: "failed", error_message: "Snapshot not found" })
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
        JSON.stringify({ error: "Snapshot readiness is below sufficient" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 12. Apply versioned payload filter ──
    const snapshotData = snapshot.input_json as Record<string, unknown>;
    const filteredPayload = buildFilteredPayload(snapshotData);

    // ── 13. Build retrieval focus and user prompt ──
    const retrievalFocus = knowledgeEnabled
      ? buildRetrievalFocus(filteredPayload)
      : "";

    const userPrompt = `Analyze the following workplace wellbeing assessment data and produce a strategy proof-of-concept.

DATA (version ${filteredPayload.filter_version}):
${JSON.stringify(filteredPayload, null, 0)}
${knowledgeEnabled ? `\nRETRIEVAL FOCUS:\n${retrievalFocus}\n\nUse the file_search tool to retrieve relevant Propel knowledge based on the retrieval focus above. Ground every recommendation in both the assessment data and retrieved Propel knowledge.` : "\nKnowledge retrieval is not available. Focus on assessment evidence only and note this limitation."}

Respond with ONLY the JSON object. No markdown, no code fences.`;

    // ── 14. Build Responses API request body ──
    const requestBody: Record<string, unknown> = {
      model: openaiModel,
      instructions: SYSTEM_PROMPT,
      input: userPrompt,
      text: {
        format: {
          type: "json_schema",
          name: "propel_strategy_report",
          strict: true,
          schema: STRATEGY_REPORT_JSON_SCHEMA,
        },
      },
      max_output_tokens: 8192,
    };

    if (knowledgeEnabled) {
      requestBody.tools = [
        {
          type: "file_search",
          vector_store_ids: [vectorStoreId],
          max_num_results: 10,
        },
      ];
      requestBody.include = ["file_search_call.results"];
    }

    // ── 15. Call OpenAI Responses API ──
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

    let openaiResponse: Response;
    try {
      openaiResponse = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify(requestBody),
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

    // ── 16. Parse OpenAI Responses API response ──
    const openaiData = await openaiResponse.json() as Record<string, unknown>;

    // Check for incomplete status
    const status = openaiData.status as string | undefined;
    if (status === "incomplete") {
      const incompleteDetails = openaiData.incomplete_details as Record<string, unknown> | undefined;
      const reason = String(incompleteDetails?.reason ?? "unknown");
      const errMsg = `Model output was incomplete (reason: ${reason})`;
      await supabase
        .from("analysis_generations")
        .update({ status: "failed", error_message: errMsg })
        .eq("id", generation_id);
      return new Response(
        JSON.stringify({ error: errMsg }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for refusal
    if (status === "refused") {
      const errMsg = "Model refused to generate output";
      await supabase
        .from("analysis_generations")
        .update({ status: "failed", error_message: errMsg })
        .eq("id", generation_id);
      return new Response(
        JSON.stringify({ error: errMsg }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract output text
    const responseText = extractOutputText(openaiData);

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

    // ── 17. Validate output structure ──
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

    // ── 18. Validate evidence paths ──
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

    // ── 19. Extract retrieval metadata and validate citations ──
    const fileSearchResults = extractFileSearchResults(openaiData);
    const citationAnnotations = extractCitationAnnotations(openaiData);

    let catalog: CatalogEntry[] = [];
    if (knowledgeEnabled) {
      const { data: catalogRows } = await supabase
        .from("propel_knowledge_catalog")
        .select("openai_file_id, title, is_active, client_facing_eligible");
      catalog = (catalogRows as CatalogEntry[] | null) ?? [];
    }

    const citationValidation = validateCitations(
      validation.output,
      fileSearchResults,
      citationAnnotations,
      catalog,
      knowledgeEnabled
    );

    // ── 20. Extract token usage from Responses API ──
    const usage = openaiData.usage as Record<string, unknown> | undefined;
    const inputTokens = usage?.input_tokens as number | null | undefined ?? null;
    const outputTokens = usage?.output_tokens as number | null | undefined ?? null;
    const totalTokens = usage?.total_tokens as number | null | undefined ?? null;

    // ── 21. Normalize evidence paths and strip internal IDs ──
    const normalizedOutput = normalizeEvidencePathsInOutput(validation.output);
    const blockedStripped = stripBlockedSources(
      normalizedOutput,
      citationValidation.blockedFileIds,
      fileSearchResults
    );
    const strippedOutput = stripInternalIds(blockedStripped);

    // ── 22. Save successful result ──
    const { error: saveError } = await supabase
      .from("analysis_generations")
      .update({
        status: "draft_generated",
        output_json: strippedOutput as unknown as Record<string, unknown>,
        original_output_json: strippedOutput as unknown as Record<string, unknown>,
        error_message: null,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        retrieval_metadata: citationValidation.metadata as unknown as Record<string, unknown>,
        knowledge_enabled: knowledgeEnabled,
      })
      .eq("id", generation_id);
    if (saveError) {
      return new Response(
        JSON.stringify({ error: "Failed to save generation result" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 23. Return result (no secrets exposed) ──
    return new Response(
      JSON.stringify({
        generation_id,
        status: "draft_generated",
        output: strippedOutput,
        retrieval_metadata: citationValidation.metadata,
        knowledge_enabled: knowledgeEnabled,
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