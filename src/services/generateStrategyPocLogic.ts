// ============================================================
// Shared logic for generate-strategy-poc edge function
// ============================================================
// This module extracts the pure (non-Deno) logic from the edge
// function so it can be unit-tested in a Node/Vitest environment.
// The edge function inlines these same functions directly.

export const SYSTEM_PROMPT_VERSION = "strategy-poc-v2";
export const MAX_RECOMMENDATIONS = 5;
export const MAX_DISCUSSION_QUESTIONS = 5;
export const MAX_BARRIERS = 5;

export const SYSTEM_PROMPT = `You are a workplace wellbeing strategy advisor. You analyze assessment data and produce a strategy proof-of-concept grounded in both the client's assessment results and the Propel knowledge base.

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
14. When knowledge retrieval is not available, set propel_knowledge_evidence to an empty array and note the limitation in the limitations field.
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
// Types
// ============================================================
export type EvidenceRef = {
  path: string;
  label: string;
};

export type SourceReference = {
  source_title: string;
  source_type: "propel_knowledge";
  file_id: string | null;
};

export type PrioritizedBarrier = {
  title: string;
  description: string;
};

export type PriorityRecommendation = {
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

export type StrategyPocOutput = {
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

export type FilteredNote = {
  note_type: string;
  title: string | null;
  content: string;
  visibility: string;
  importance: string;
  visibility_directive: "influence_only" | "influence_and_output";
};

export type FilteredPayload = {
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

// ============================================================
// Retrieval metadata types
// ============================================================
export type FileSearchResult = {
  file_id: string;
  filename: string;
  score: number | null;
};

export type CitationAnnotation = {
  file_id: string;
  filename: string;
  quote: string | null;
};

export type RetrievalMetadata = {
  file_search_results: FileSearchResult[];
  citation_annotations: CitationAnnotation[];
  catalog_verified_files: string[];
  catalog_unverified_files: string[];
  blocked_files: string[];
  knowledge_enabled: boolean;
};

// ============================================================
// Payload filter
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

export function buildFilteredPayload(
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
export function buildRetrievalFocus(payload: FilteredPayload): string {
  const focusParts: string[] = [];

  // Industry and size
  const org = payload.client_organization;
  if (org.industry) focusParts.push(`Industry: ${org.industry}`);
  if (org.size_band) focusParts.push(`Employee size: ${org.size_band}`);

  // Weak dimensions from assessment
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

  // Behavioral readiness barriers
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

  // Diagnostic findings
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

  // Recommendation categories from existing recommendations
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

export function isValidEvidencePath(
  path: string,
  payload: FilteredPayload
): boolean {
  if (!path || typeof path !== "string") return false;

  const parts = path.split(".");
  const root = payload as Record<string, unknown>;

  if (resolvePath(parts, root)) return true;

  // Fallback: the model may omit the "assessment." prefix for nested keys
  if (parts.length > 0 && ASSESSMENT_NESTED_KEYS.has(parts[0])) {
    return resolvePath(["assessment", ...parts], root);
  }

  return false;
}

export function validateEvidencePaths(
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
// Citation validation
// ============================================================
export type CatalogEntry = {
  openai_file_id: string;
  title: string;
  is_active: boolean;
  client_facing_eligible: boolean;
};

export type CitationValidationResult = {
  verified: string[];
  unverified: string[];
  blockedFileIds: Set<string>;
  metadata: RetrievalMetadata;
};

export function validateCitations(
  output: StrategyPocOutput,
  fileSearchResults: FileSearchResult[],
  citationAnnotations: CitationAnnotation[],
  catalog: CatalogEntry[],
  knowledgeEnabled: boolean
): CitationValidationResult {
  const catalogMap = new Map(catalog.map((c) => [c.openai_file_id, c]));
  const retrievedFileIds = new Set(fileSearchResults.map((r) => r.file_id));
  const retrievedFilenames = new Set(
    fileSearchResults.map((r) => r.filename)
  );

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

  // Collect all file_ids and source_titles referenced in the output
  const referencedFileIds = new Set<string>();
  const referencedTitles = new Set<string>();

  for (const ref of output.source_references ?? []) {
    if (ref.file_id) referencedFileIds.add(ref.file_id);
    if (ref.source_title) referencedTitles.add(ref.source_title);
  }

  for (const _rec of output.priority_recommendations ?? []) {
    // Extract file_ids from propel_knowledge_evidence text if they appear
    // (model may embed filenames, not file_ids, so we rely on source_references)
  }

  // Check each referenced file_id against retrieval results + catalog
  for (const fileId of referencedFileIds) {
    const catalogEntry = catalogMap.get(fileId);
    const wasRetrieved = retrievedFileIds.has(fileId);

    if (!wasRetrieved) {
      unverified.push(fileId);
      continue;
    }

    if (catalogEntry) {
      if (!catalogEntry.is_active) {
        unverified.push(fileId);
      } else if (!catalogEntry.client_facing_eligible) {
        unverified.push(fileId);
      } else {
        verified.push(fileId);
      }
    } else {
      // File was retrieved but not in catalog — block it
      unverified.push(fileId);
    }
  }

  // Fallback: check source_titles against retrieved filenames
  for (const title of referencedTitles) {
    if (retrievedFilenames.has(title)) {
      // Find the file_id for this filename
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
    } else if (!unverified.some((id) => {
      const r = fileSearchResults.find((fr) => fr.filename === title);
      return r?.file_id === id;
    })) {
      // Title not found in retrieved files — mark as unverified by title
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
export function stripInternalIds(
  output: StrategyPocOutput
): StrategyPocOutput {
  const stripped: StrategyPocOutput = {
    ...output,
    source_references: (output.source_references ?? []).map((ref) => ({
      ...ref,
      file_id: null,
    })),
  };
  return stripped;
}

export function stripBlockedSources(
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
export function validateOutputStructure(
  raw: unknown
): { valid: boolean; output?: StrategyPocOutput; error?: string } {
  if (!raw || typeof raw !== "object") {
    return { valid: false, error: "Output is not an object" };
  }

  const obj = raw as Record<string, unknown>;

  // executive_summary
  if (typeof obj.executive_summary !== "string") {
    return { valid: false, error: "executive_summary must be a string" };
  }
  if (!obj.executive_summary.trim()) {
    return { valid: false, error: "executive_summary must not be empty" };
  }

  // maturity_interpretation
  if (typeof obj.maturity_interpretation !== "string") {
    return { valid: false, error: "maturity_interpretation must be a string" };
  }
  if (!obj.maturity_interpretation.trim()) {
    return { valid: false, error: "maturity_interpretation must not be empty" };
  }

  // prioritized_barriers
  if (!Array.isArray(obj.prioritized_barriers)) {
    return {
      valid: false,
      error: "prioritized_barriers must be an array",
    };
  }
  if (obj.prioritized_barriers.length > MAX_BARRIERS) {
    return {
      valid: false,
      error: `prioritized_barriers must not exceed ${MAX_BARRIERS}`,
    };
  }
  for (const barrier of obj.prioritized_barriers) {
    if (!barrier || typeof barrier !== "object") {
      return {
        valid: false,
        error: "Each prioritized_barrier must be an object",
      };
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

  // priority_recommendations
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

  // implementation_sequence
  if (!Array.isArray(obj.implementation_sequence)) {
    return {
      valid: false,
      error: "implementation_sequence must be an array",
    };
  }
  for (const phase of obj.implementation_sequence) {
    if (typeof phase !== "string" || !phase.trim()) {
      return {
        valid: false,
        error: "Each implementation_sequence entry must be a non-empty string",
      };
    }
  }

  // client_discussion_questions
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

  // limitations
  if (typeof obj.limitations !== "string") {
    return { valid: false, error: "limitations must be a string" };
  }

  // source_references
  if (!Array.isArray(obj.source_references)) {
    return {
      valid: false,
      error: "source_references must be an array",
    };
  }
  for (const ref of obj.source_references) {
    if (!ref || typeof ref !== "object") {
      return {
        valid: false,
        error: "Each source_reference must be an object",
      };
    }
    const s = ref as Record<string, unknown>;
    if (typeof s.source_title !== "string" || !s.source_title.trim()) {
      return {
        valid: false,
        error: "Each source_reference must have a non-empty source_title",
      };
    }
    if (s.source_type !== "propel_knowledge") {
      return {
        valid: false,
        error: "source_type must be 'propel_knowledge'",
      };
    }
    // file_id can be null or string
    if (
      s.file_id !== null &&
      typeof s.file_id !== "string"
    ) {
      return {
        valid: false,
        error: "file_id must be a string or null",
      };
    }
  }

  // evidence_references (top-level)
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
// Safe error message
// ============================================================
export function safeErrorMessage(error: unknown): string {
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
// Evidence path normalization (canonical form)
// ============================================================
export function normalizeEvidencePath(path: string): string {
  if (!path) return path;
  const parts = path.split(".");
  const firstKey = parts[0].replace(/\[.*$/, "");
  if (firstKey !== parts[0] && ASSESSMENT_NESTED_KEYS.has(firstKey)) {
    return `assessment.${path}`;
  }
  if (parts.length > 0 && ASSESSMENT_NESTED_KEYS.has(parts[0])) {
    return `assessment.${path}`;
  }
  return path;
}

export function normalizeEvidencePathsInOutput(
  output: StrategyPocOutput
): StrategyPocOutput {
  const normalizeRefs = (refs: EvidenceRef[]): EvidenceRef[] =>
    refs.map((ref) => ({ ...ref, path: normalizeEvidencePath(ref.path) }));

  return {
    ...output,
    priority_recommendations: output.priority_recommendations.map((rec) => ({
      ...rec,
      evidence_references: normalizeRefs(rec.evidence_references ?? []),
    })),
    evidence_references: normalizeRefs(output.evidence_references ?? []),
  };
}

// ============================================================
// JSON Schema for Structured Outputs
// ============================================================
export const STRATEGY_REPORT_JSON_SCHEMA = {
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
} as const;
