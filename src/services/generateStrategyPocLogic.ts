// ============================================================
// Shared logic for generate-strategy-poc edge function
// ============================================================
// This module extracts the pure (non-Deno) logic from the edge
// function so it can be unit-tested in a Node/Vitest environment.
// The edge function inlines these same functions directly.

export const SYSTEM_PROMPT_VERSION = "strategy-poc-v1";
export const MAX_RECOMMENDATIONS = 3;
export const MAX_DISCUSSION_QUESTIONS = 3;

export const SYSTEM_PROMPT = `You are a workplace wellbeing strategy advisor. You analyze assessment data and produce a strategy proof-of-concept.

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
// Types
// ============================================================
export type EvidenceRef = {
  path: string;
  label: string;
};

export type PriorityRecommendation = {
  title: string;
  rationale: string;
  recommended_action: string;
  evidence_references: EvidenceRef[];
};

export type StrategyPocOutput = {
  executive_summary: string;
  priority_recommendations: PriorityRecommendation[];
  client_discussion_questions: string[];
  limitations: string;
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
// Evidence path validation
// ============================================================
export function isValidEvidencePath(
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
// Output validation
// ============================================================
export function validateOutputStructure(
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
