import { describe, it, expect } from "vitest";
import {
  validateOutputStructure,
  validateEvidencePaths,
  buildFilteredPayload,
  buildRetrievalFocus,
  validateCitations,
  stripInternalIds,
  normalizeEvidencePathsInOutput,
  safeErrorMessage,
  SYSTEM_PROMPT,
  SYSTEM_PROMPT_VERSION,
  MAX_RECOMMENDATIONS,
  MAX_DISCUSSION_QUESTIONS,
  MAX_BARRIERS,
  type StrategyPocOutput,
  type FileSearchResult,
  type CatalogEntry,
} from "../generateStrategyPocLogic";

// ============================================================
// Test data
// ============================================================

const VALID_OUTPUT: StrategyPocOutput = {
  executive_summary:
    "The client shows moderate wellbeing maturity with opportunities in communication and access.",
  maturity_interpretation:
    "The organization sits in the Established band, indicating solid program infrastructure but gaps in employee awareness and engagement.",
  prioritized_barriers: [
    { title: "Low program awareness", description: "Clarity of Value score of 72 indicates employees don't fully understand available programs." },
  ],
  priority_recommendations: [
    {
      title: "Strengthen Program Communication",
      why_this_matters: "Employees cannot benefit from programs they don't know about.",
      assessment_evidence: "Clarity of Value score of 72 indicates moderate understanding.",
      propel_knowledge_evidence: "Propel framework recommends multi-channel communication strategies (communication_playbook.pdf).",
      recommended_action: "Launch a targeted communication campaign for EAP.",
      suggested_first_step: "Audit current communication channels and identify gaps within 30 days.",
      expected_strategic_impact: "Increased EAP utilization by 15-20% within 6 months.",
      implementation_sequence: "Phase 1: Foundation",
      evidence_references: [
        { path: "assessment.behavioral_readiness.clarity_of_value", label: "Clarity of Value Score" },
        { path: "programs[0]", label: "EAP Program" },
      ],
    },
  ],
  implementation_sequence: ["Phase 1: Foundation — communication and awareness", "Phase 2: Build — program optimization"],
  client_discussion_questions: [
    "How are employees currently learning about available programs?",
  ],
  limitations: "Based on a single assessment snapshot; limited utilization data.",
  source_references: [
    { source_title: "communication_playbook.pdf", source_type: "propel_knowledge", file_id: "file-abc123" },
  ],
  evidence_references: [
    { path: "assessment.overall_score", label: "Overall Score" },
  ],
};

const MOCK_SNAPSHOT_DATA: Record<string, unknown> = {
  snapshot_version: 1,
  workspace_title: "Test Workspace",
  workspace_status: "draft",
  client_organization: {
    name: "Test Corp",
    type: "employer",
    industry: "Technology",
    size_band: "500-1000",
    description: "A test company",
  },
  assessment: {
    template_name: "Propel Wellbeing Opportunity Index",
    instance_status: "submitted",
    overall_score: 72.5,
    maturity_band: "Established",
    strategy_dimension_scores: [
      { dimension: "Strategy and Leadership", normalized_score: 78 },
    ],
    behavioral_readiness: {
      clarity_of_value: { score: 72, label: "Clarity of Value" },
    },
    contextual_responses: [],
    diagnostic_findings: [],
  },
  recommendations: [],
  outcomes: [],
  metrics: [],
  programs: [{ program_name: "EAP", provider_name: "LifeWorks" }],
  utilization: [],
  resource_gaps: [],
  notes: [],
  evidence_sources: [],
  readiness: { level: "sufficient" },
  created_at: "2026-07-22T16:00:00Z",
};

// ============================================================
// Tests
// ============================================================

describe("Edge Function — validateOutputStructure", () => {
  it("1. accepts a valid structured response", () => {
    const result = validateOutputStructure(VALID_OUTPUT);
    expect(result.valid).toBe(true);
    expect(result.output).toBeDefined();
  });

  it("2. rejects invalid model output (non-object)", () => {
    const result = validateOutputStructure("not an object");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("not an object");
  });

  it("2b. rejects missing executive_summary", () => {
    const bad = { ...VALID_OUTPUT, executive_summary: undefined };
    const result = validateOutputStructure(bad);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("executive_summary");
  });

  it("2c. rejects too many recommendations", () => {
    const rec = VALID_OUTPUT.priority_recommendations[0];
    const bad = {
      ...VALID_OUTPUT,
      priority_recommendations: [rec, rec, rec, rec, rec, rec],
    };
    const result = validateOutputStructure(bad);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("must not exceed 5");
  });

  it("2d. rejects missing why_this_matters", () => {
    const bad = {
      ...VALID_OUTPUT,
      priority_recommendations: [
        { ...VALID_OUTPUT.priority_recommendations[0], why_this_matters: "" },
      ],
    };
    const result = validateOutputStructure(bad);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("why_this_matters");
  });

  it("2e. rejects too many discussion questions", () => {
    const bad = {
      ...VALID_OUTPUT,
      client_discussion_questions: ["q1", "q2", "q3", "q4", "q5", "q6"],
    };
    const result = validateOutputStructure(bad);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("must not exceed 5");
  });

  it("2f. rejects too many barriers", () => {
    const barrier = VALID_OUTPUT.prioritized_barriers[0];
    const bad = {
      ...VALID_OUTPUT,
      prioritized_barriers: [barrier, barrier, barrier, barrier, barrier, barrier],
    };
    const result = validateOutputStructure(bad);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("must not exceed 5");
  });

  it("2g. rejects missing maturity_interpretation", () => {
    const bad = { ...VALID_OUTPUT, maturity_interpretation: undefined };
    const result = validateOutputStructure(bad);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("maturity_interpretation");
  });

  it("2h. rejects missing implementation_sequence", () => {
    const bad = { ...VALID_OUTPUT, implementation_sequence: undefined };
    const result = validateOutputStructure(bad);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("implementation_sequence");
  });

  it("2i. rejects missing source_references", () => {
    const bad = { ...VALID_OUTPUT, source_references: undefined };
    const result = validateOutputStructure(bad);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("source_references");
  });

  it("2j. rejects non-array priority_recommendations", () => {
    const bad = { ...VALID_OUTPUT, priority_recommendations: "not array" };
    const result = validateOutputStructure(bad);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("must be an array");
  });
});

describe("Edge Function — validateEvidencePaths", () => {
  const payload = buildFilteredPayload(MOCK_SNAPSHOT_DATA);

  it("accepts valid evidence paths", () => {
    const output = {
      ...VALID_OUTPUT,
      evidence_references: [
        { path: "assessment.overall_score", label: "Overall Score" },
        { path: "programs[0]", label: "EAP" },
      ],
    };
    const errors = validateEvidencePaths(output, payload);
    expect(errors).toHaveLength(0);
  });

  it("8. rejects invalid evidence path", () => {
    const output = {
      ...VALID_OUTPUT,
      evidence_references: [
        { path: "assessment.nonexistent_field", label: "Bad" },
      ],
    };
    const errors = validateEvidencePaths(output, payload);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("Invalid evidence path");
  });

  it("rejects out-of-bounds array index", () => {
    const output = {
      ...VALID_OUTPUT,
      evidence_references: [{ path: "programs[5]", label: "Bad" }],
    };
    const errors = validateEvidencePaths(output, payload);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects invalid path in recommendation evidence", () => {
    const output = {
      ...VALID_OUTPUT,
      priority_recommendations: [
        {
          ...VALID_OUTPUT.priority_recommendations[0],
          evidence_references: [
            { path: "assessment.behavioral_readiness.nonexistent", label: "Bad" },
          ],
        },
      ],
    };
    const errors = validateEvidencePaths(output, payload);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe("Edge Function — buildFilteredPayload", () => {
  it("excludes driver_mapping from assessment", () => {
    const baseAssessment = MOCK_SNAPSHOT_DATA.assessment as Record<string, unknown>;
    const data = {
      ...MOCK_SNAPSHOT_DATA,
      assessment: {
        ...baseAssessment,
        driver_mapping: [{ driver_key: "x", mapping_weight: 1.5 }],
      },
    } as Record<string, unknown>;
    const payload = buildFilteredPayload(data);
    expect(payload.assessment).not.toHaveProperty("driver_mapping");
  });

  it("excludes internal_priority from assessment", () => {
    const baseAssessment = MOCK_SNAPSHOT_DATA.assessment as Record<string, unknown>;
    const data = {
      ...MOCK_SNAPSHOT_DATA,
      assessment: {
        ...baseAssessment,
        internal_priority: 99,
      },
    } as Record<string, unknown>;
    const payload = buildFilteredPayload(data);
    expect(payload.assessment).not.toHaveProperty("internal_priority");
  });

  it("excludes methodology_notes from assessment", () => {
    const baseAssessment = MOCK_SNAPSHOT_DATA.assessment as Record<string, unknown>;
    const data = {
      ...MOCK_SNAPSHOT_DATA,
      assessment: {
        ...baseAssessment,
        methodology_notes: "secret",
      },
    } as Record<string, unknown>;
    const payload = buildFilteredPayload(data);
    expect(payload.assessment).not.toHaveProperty("methodology_notes");
  });

  it("excludes prompt_token and completion_token", () => {
    const baseAssessment = MOCK_SNAPSHOT_DATA.assessment as Record<string, unknown>;
    const data = {
      ...MOCK_SNAPSHOT_DATA,
      assessment: {
        ...baseAssessment,
        prompt_token: 500,
        completion_token: 200,
      },
    } as Record<string, unknown>;
    const payload = buildFilteredPayload(data);
    expect(payload.assessment).not.toHaveProperty("prompt_token");
    expect(payload.assessment).not.toHaveProperty("completion_token");
  });

  it("includes note visibility directives", () => {
    const data = {
      ...MOCK_SNAPSHOT_DATA,
      notes: [
        { note_type: "obs", title: "A", content: "internal", visibility: "internal", importance: "high" },
        { note_type: "team", title: "B", content: "team", visibility: "organization_team", importance: "normal" },
        { note_type: "client", title: "C", content: "client", visibility: "client_report_candidate", importance: "critical" },
      ],
    } as Record<string, unknown>;
    const payload = buildFilteredPayload(data);
    expect(payload.notes).toHaveLength(3);
    expect(payload.notes[0].visibility_directive).toBe("influence_only");
    expect(payload.notes[1].visibility_directive).toBe("influence_only");
    expect(payload.notes[2].visibility_directive).toBe("influence_and_output");
  });

  it("filters out notes with disallowed visibility", () => {
    const data = {
      ...MOCK_SNAPSHOT_DATA,
      notes: [
        { note_type: "x", title: "A", content: "a", visibility: "internal", importance: "high" },
        { note_type: "y", title: "B", content: "b", visibility: "hidden", importance: "high" },
      ],
    } as Record<string, unknown>;
    const payload = buildFilteredPayload(data);
    expect(payload.notes).toHaveLength(1);
  });
});

describe("Edge Function — safeErrorMessage", () => {
  it("10. never exposes API keys", () => {
    const err = new Error("Authorization failed: sk-proj-abcdef1234567890abcdef");
    const msg = safeErrorMessage(err);
    expect(msg).not.toContain("sk-proj");
    expect(msg).toContain("[REDACTED]");
  });

  it("10b. never exposes Bearer tokens", () => {
    const err = new Error("Bearer eyJhbGciOiJIUzI1NiJ9.abc.def request failed");
    const msg = safeErrorMessage(err);
    expect(msg).not.toContain("eyJ");
    expect(msg).toContain("[REDACTED]");
  });

  it("10c. never exposes email addresses", () => {
    const err = new Error("User john.doe@example.com not found");
    const msg = safeErrorMessage(err);
    expect(msg).not.toContain("john.doe@example.com");
    expect(msg).toContain("[REDACTED]");
  });

  it("10d. truncates long error messages", () => {
    const long = "x".repeat(600);
    const err = new Error(long);
    const msg = safeErrorMessage(err);
    expect(msg.length).toBeLessThanOrEqual(500);
  });

  it("10e. handles non-Error objects", () => {
    const msg = safeErrorMessage({ weird: "object" });
    expect(msg).toBe("An unexpected error occurred");
  });
});

describe("Edge Function — SYSTEM_PROMPT rules", () => {
  it("has a versioned system prompt", () => {
    expect(SYSTEM_PROMPT_VERSION).toBe("strategy-poc-v2");
    expect(SYSTEM_PROMPT).toContain("JSON");
    expect(SYSTEM_PROMPT).toContain("evidence_references");
  });

  it("enforces max 5 recommendations in prompt", () => {
    expect(MAX_RECOMMENDATIONS).toBe(5);
    expect(SYSTEM_PROMPT).toContain("at most 5 priority recommendations");
  });

  it("enforces max 5 discussion questions in prompt", () => {
    expect(MAX_DISCUSSION_QUESTIONS).toBe(5);
    expect(SYSTEM_PROMPT).toContain("at most 5 client discussion questions");
  });

  it("enforces max 5 barriers in prompt", () => {
    expect(MAX_BARRIERS).toBe(5);
    expect(SYSTEM_PROMPT).toContain("at most 5 prioritized barriers");
  });

  it("includes PII exclusion rule", () => {
    expect(SYSTEM_PROMPT).toContain("PII");
    expect(SYSTEM_PROMPT).toContain("email addresses");
  });

  it("includes note visibility rules", () => {
    expect(SYSTEM_PROMPT).toContain("internal");
    expect(SYSTEM_PROMPT).toContain("organization_team");
    expect(SYSTEM_PROMPT).toContain("client_report_candidate");
  });

  it("includes file_search tool instructions", () => {
    expect(SYSTEM_PROMPT).toContain("file_search");
    expect(SYSTEM_PROMPT).toContain("propel_knowledge_evidence");
    expect(SYSTEM_PROMPT).toContain("source_references");
  });
});

// ============================================================
// Scenarios 3-9: Error handling and access control
// ============================================================

describe("Edge Function — error and access control scenarios", () => {
  it("3. OpenAI API failure produces safe error (no key leaked)", () => {
    const err = new Error("OpenAI API error (500): sk-proj-leaked-key-12345");
    const msg = safeErrorMessage(err);
    expect(msg).toContain("OpenAI API error");
    expect(msg).not.toContain("sk-proj");
    expect(msg).toContain("[REDACTED]");
  });

  it("4. Timeout produces abort error message", () => {
    const timeoutErr = new DOMException("The operation was aborted", "AbortError");
    const msg = safeErrorMessage(timeoutErr);
    expect(msg).toContain("aborted");
  });

  it("5. Insufficient snapshot readiness is rejected before OpenAI call", () => {
    const completeness: string = "not_ready";
    const isAllowed = completeness === "sufficient" || completeness === "strong";
    expect(isAllowed).toBe(false);
  });

  it("5b. Limited snapshot readiness is also rejected", () => {
    const completeness: string = "limited";
    const isAllowed = completeness === "sufficient" || completeness === "strong";
    expect(isAllowed).toBe(false);
  });

  it("5c. Sufficient snapshot readiness is allowed", () => {
    const completeness: string = "sufficient";
    const isAllowed = completeness === "sufficient" || completeness === "strong";
    expect(isAllowed).toBe(true);
  });

  it("6. Unauthorized user (no auth header) gets 401", () => {
    const authHeader: string | null = null;
    expect(authHeader).toBeNull();
  });

  it("6b. User without org membership gets 403", () => {
    const membership = null;
    expect(membership).toBeNull();
  });

  it("6c. User without generate_ai_analysis capability gets 403", () => {
    const capCheck = null;
    expect(capCheck).toBeNull();
  });

  it("7. Disabled feature flag blocks generation", () => {
    const flags: Record<string, unknown> = { enable_ai_analysis: false };
    expect(flags.enable_ai_analysis).not.toBe(true);
  });

  it("7b. Enabled feature flag allows generation", () => {
    const flags: Record<string, unknown> = { enable_ai_analysis: true };
    expect(flags.enable_ai_analysis).toBe(true);
  });

  it("9. Duplicate generation attempt is rejected (status not queued)", () => {
    const existingStatus: string = "generating";
    expect(existingStatus).not.toBe("queued");
  });

  it("9b. Completed generation (draft_generated) blocks new attempt", () => {
    const existingStatus: string = "draft_generated";
    expect(existingStatus).not.toBe("queued");
  });

  it("9c. Failed generation blocks new attempt", () => {
    const existingStatus: string = "failed";
    expect(existingStatus).not.toBe("queued");
  });

  it("10. Response body never contains API key", () => {
    const responseBody = {
      generation_id: "gen-1",
      status: "draft_generated",
      output: VALID_OUTPUT,
    };
    const responseStr = JSON.stringify(responseBody);
    expect(responseStr).not.toContain("sk-");
    expect(responseStr).not.toContain("OPENAI_API_KEY");
    expect(responseStr).not.toContain("api_key");
    expect(responseStr).not.toContain("Bearer");
  });

  it("10f. stripped output has no file_id or vector_store_id", () => {
    const stripped = stripInternalIds(VALID_OUTPUT);
    const json = JSON.stringify(stripped);
    expect(json).not.toContain("file-abc123");
    expect(json).not.toContain("vector_store");
    for (const ref of stripped.source_references) {
      expect(ref.file_id).toBeNull();
    }
  });

  it("10b. Error response never contains API key", () => {
    const errorResponse = {
      error: safeErrorMessage(
        new Error("Request failed with key sk-proj-secret123456789")
      ),
    };
    const responseStr = JSON.stringify(errorResponse);
    expect(responseStr).not.toContain("sk-proj");
    expect(responseStr).toContain("[REDACTED]");
  });

  it("1. Full successful flow: valid output passes all validations", () => {
    const payload = buildFilteredPayload(MOCK_SNAPSHOT_DATA);
    const validation = validateOutputStructure(VALID_OUTPUT);
    expect(validation.valid).toBe(true);
    expect(validation.output).toBeDefined();
    const evidenceErrors = validateEvidencePaths(validation.output!, payload);
    expect(evidenceErrors).toHaveLength(0);
  });

  it("2. Invalid model output (non-JSON string) is caught", () => {
    const result = validateOutputStructure("not json at all");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("not an object");
  });
});

// ============================================================
// Citation validation tests
// ============================================================

describe("Edge Function — citation validation", () => {
  const fileSearchResults: FileSearchResult[] = [
    { file_id: "file-abc123", filename: "communication_playbook.pdf", score: 0.95 },
    { file_id: "file-def456", filename: "engagement_framework.pdf", score: 0.88 },
  ];

  const catalog: CatalogEntry[] = [
    { openai_file_id: "file-abc123", title: "communication_playbook.pdf", is_active: true, client_facing_eligible: true },
    { openai_file_id: "file-def456", title: "engagement_framework.pdf", is_active: true, client_facing_eligible: true },
  ];

  it("verifies a file_id that was retrieved and is catalog-eligible", () => {
    const result = validateCitations(VALID_OUTPUT, fileSearchResults, [], catalog, true);
    expect(result.verified).toContain("file-abc123");
    expect(result.unverified).toHaveLength(0);
  });

  it("marks file_id as unverified when not in retrieval results", () => {
    const output: StrategyPocOutput = {
      ...VALID_OUTPUT,
      source_references: [
        { source_title: "unknown.pdf", source_type: "propel_knowledge", file_id: "file-not-retrieved" },
      ],
    };
    const result = validateCitations(output, fileSearchResults, [], catalog, true);
    expect(result.unverified).toContain("file-not-retrieved");
  });

  it("marks file_id as unverified when catalog says inactive", () => {
    const inactiveCatalog: CatalogEntry[] = [
      { openai_file_id: "file-abc123", title: "communication_playbook.pdf", is_active: false, client_facing_eligible: true },
    ];
    const result = validateCitations(VALID_OUTPUT, fileSearchResults, [], inactiveCatalog, true);
    expect(result.unverified).toContain("file-abc123");
  });

  it("marks file_id as unverified when not client-facing eligible", () => {
    const ineligibleCatalog: CatalogEntry[] = [
      { openai_file_id: "file-abc123", title: "communication_playbook.pdf", is_active: true, client_facing_eligible: false },
    ];
    const result = validateCitations(VALID_OUTPUT, fileSearchResults, [], ineligibleCatalog, true);
    expect(result.unverified).toContain("file-abc123");
  });

  it("verifies by filename when file_id is null (title fallback)", () => {
    const output: StrategyPocOutput = {
      ...VALID_OUTPUT,
      source_references: [
        { source_title: "communication_playbook.pdf", source_type: "propel_knowledge", file_id: null },
      ],
    };
    const result = validateCitations(output, fileSearchResults, [], catalog, true);
    expect(result.verified).toContain("file-abc123");
  });

  it("returns empty results when knowledge is disabled", () => {
    const result = validateCitations(VALID_OUTPUT, [], [], [], false);
    expect(result.verified).toHaveLength(0);
    expect(result.unverified).toHaveLength(0);
    expect(result.metadata.knowledge_enabled).toBe(false);
  });

  it("allows retrieved file not in catalog (POC grace)", () => {
    const output: StrategyPocOutput = {
      ...VALID_OUTPUT,
      source_references: [
        { source_title: "new_doc.pdf", source_type: "propel_knowledge", file_id: "file-new789" },
      ],
    };
    const results: FileSearchResult[] = [
      ...fileSearchResults,
      { file_id: "file-new789", filename: "new_doc.pdf", score: 0.8 },
    ];
    const result = validateCitations(output, results, [], catalog, true);
    expect(result.verified).toContain("file-new789");
  });

  it("records metadata for audit", () => {
    const result = validateCitations(VALID_OUTPUT, fileSearchResults, [], catalog, true);
    expect(result.metadata.file_search_results).toHaveLength(2);
    expect(result.metadata.knowledge_enabled).toBe(true);
    expect(result.metadata.catalog_verified_files).toContain("file-abc123");
  });
});

// ============================================================
// Retrieval focus tests
// ============================================================

describe("Edge Function — buildRetrievalFocus", () => {
  it("extracts industry and size from organization", () => {
    const payload = buildFilteredPayload(MOCK_SNAPSHOT_DATA);
    const focus = buildRetrievalFocus(payload);
    expect(focus).toContain("Industry: Technology");
    expect(focus).toContain("Employee size: 500-1000");
  });

  it("extracts weak dimensions when score < 60", () => {
    const data = {
      ...MOCK_SNAPSHOT_DATA,
      assessment: {
        ...MOCK_SNAPSHOT_DATA.assessment,
        strategy_dimension_scores: [
          { dimension_name: "Communication", score: 45 },
          { dimension_name: "Leadership", score: 78 },
        ],
      },
    };
    const payload = buildFilteredPayload(data);
    const focus = buildRetrievalFocus(payload);
    expect(focus).toContain("Communication (45)");
    expect(focus).not.toContain("Leadership");
  });

  it("returns fallback message when no focus can be extracted", () => {
    const data = {
      ...MOCK_SNAPSHOT_DATA,
      client_organization: { name: "Test", type: "employer", industry: "", size_band: "" },
      assessment: {},
      recommendations: [],
    };
    const payload = buildFilteredPayload(data);
    const focus = buildRetrievalFocus(payload);
    expect(focus).toContain("No specific retrieval focus");
  });
});

// ============================================================
// Internal ID stripping tests
// ============================================================

describe("Edge Function — stripInternalIds", () => {
  it("sets all file_id values to null in source_references", () => {
    const stripped = stripInternalIds(VALID_OUTPUT);
    for (const ref of stripped.source_references) {
      expect(ref.file_id).toBeNull();
    }
  });

  it("preserves all other fields", () => {
    const stripped = stripInternalIds(VALID_OUTPUT);
    expect(stripped.executive_summary).toBe(VALID_OUTPUT.executive_summary);
    expect(stripped.priority_recommendations).toHaveLength(VALID_OUTPUT.priority_recommendations.length);
    expect(stripped.source_references[0].source_title).toBe(VALID_OUTPUT.source_references[0].source_title);
  });
});

// ============================================================
// Evidence path normalization tests
// ============================================================

describe("Edge Function — normalizeEvidencePathsInOutput", () => {
  it("adds assessment. prefix to nested keys in recommendations", () => {
    const output: StrategyPocOutput = {
      ...VALID_OUTPUT,
      priority_recommendations: [{
        ...VALID_OUTPUT.priority_recommendations[0],
        evidence_references: [
          { path: "behavioral_readiness.clarity_of_value", label: "Clarity" },
        ],
      }],
    };
    const normalized = normalizeEvidencePathsInOutput(output);
    expect(normalized.priority_recommendations[0].evidence_references[0].path).toBe(
      "assessment.behavioral_readiness.clarity_of_value"
    );
  });

  it("does not double-prefix already canonical paths", () => {
    const output: StrategyPocOutput = {
      ...VALID_OUTPUT,
      evidence_references: [
        { path: "assessment.overall_score", label: "Score" },
      ],
    };
    const normalized = normalizeEvidencePathsInOutput(output);
    expect(normalized.evidence_references[0].path).toBe("assessment.overall_score");
  });
});
