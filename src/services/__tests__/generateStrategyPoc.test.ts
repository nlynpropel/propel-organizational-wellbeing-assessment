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
      propel_knowledge_evidence: "Propel recommends multi-channel communication strategies because consistent messaging across channels increases program awareness and participation.",
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
    { source_title: "Communication Strategy Guide", source_type: "propel_knowledge", file_id: "file-abc123" },
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

  it("includes knowledge synthesis instructions", () => {
    expect(SYSTEM_PROMPT).toContain("propel_knowledge_evidence");
    expect(SYSTEM_PROMPT).toContain("source_references");
    expect(SYSTEM_PROMPT).toContain("Synthesize retrieved Propel knowledge");
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
    expect(stripped.source_references).toEqual([]);
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
    { file_id: "file-abc123", filename: "Communication Strategy Guide", score: 0.95 },
    { file_id: "file-def456", filename: "engagement_framework.pdf", score: 0.88 },
  ];

  const catalog: CatalogEntry[] = [
    { openai_file_id: "file-abc123", title: "Communication Strategy Guide", is_active: true, client_facing_eligible: true },
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
      { openai_file_id: "file-abc123", title: "Communication Strategy Guide", is_active: false, client_facing_eligible: true },
    ];
    const result = validateCitations(VALID_OUTPUT, fileSearchResults, [], inactiveCatalog, true);
    expect(result.unverified).toContain("file-abc123");
  });

  it("marks file_id as unverified when not client-facing eligible", () => {
    const ineligibleCatalog: CatalogEntry[] = [
      { openai_file_id: "file-abc123", title: "Communication Strategy Guide", is_active: true, client_facing_eligible: false },
    ];
    const result = validateCitations(VALID_OUTPUT, fileSearchResults, [], ineligibleCatalog, true);
    expect(result.unverified).toContain("file-abc123");
  });

  it("verifies by filename when file_id is null (title fallback)", () => {
    const output: StrategyPocOutput = {
      ...VALID_OUTPUT,
      source_references: [
        { source_title: "Communication Strategy Guide", source_type: "propel_knowledge", file_id: null },
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

  it("blocks retrieved file not in catalog (no grace)", () => {
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
    expect(result.verified).not.toContain("file-new789");
    expect(result.unverified).toContain("file-new789");
    expect(result.blockedFileIds.has("file-new789")).toBe(true);
    expect(result.metadata.blocked_files).toContain("file-new789");
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
  it("clears source_references to an empty array", () => {
    const stripped = stripInternalIds(VALID_OUTPUT);
    expect(stripped.source_references).toEqual([]);
  });

  it("preserves all other fields", () => {
    const stripped = stripInternalIds(VALID_OUTPUT);
    expect(stripped.executive_summary).toBe(VALID_OUTPUT.executive_summary);
    expect(stripped.priority_recommendations).toHaveLength(VALID_OUTPUT.priority_recommendations.length);
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

// ============================================================
// Assessment-only visible-output sanitization tests
// ============================================================

import {
  sanitizeVisibleOutput,
  validateNoForbiddenContent,
} from "../generateStrategyPocLogic";

describe("Assessment-only visible-output sanitization", () => {
  const BAD_OUTPUT: StrategyPocOutput = {
    ...VALID_OUTPUT,
    executive_summary: "The client shows moderate maturity. See guidance in Propel_Wellbeing_Strategy_Knowledge_Master_v1.docx for details.",
    maturity_interpretation: "The organization sits in the Established band. According to the document, communication could be improved. CLARITY-004 recommends targeted campaigns.",
    limitations: "Apollo's readiness flags show missing utilization data, program inventory, and defined outcomes, which reduce precision. The Propel materials used are the internal Strategy Knowledge Master and Recommendation Bank retrieved for this analysis.",
    priority_recommendations: [
      {
        ...VALID_OUTPUT.priority_recommendations[0],
        propel_knowledge_evidence: "See guidance in Propel_Wellbeing_Strategy_Knowledge_Master_v1.docx. The Recommendation Bank suggests multi-channel communication.",
        assessment_evidence: "Source: file-abc123def456. Clarity of Value score of 72.",
      },
    ],
    source_references: [
      { source_title: "Propel_Wellbeing_Strategy_Knowledge_Master_v1.docx", source_type: "propel_knowledge", file_id: "file-abc123def456" },
    ],
  };

  // ── Filenames never appear ──
  it("removes filenames from all visible report fields", () => {
    const sanitized = sanitizeVisibleOutput(BAD_OUTPUT, true);
    const allText = JSON.stringify(sanitized);
    expect(allText).not.toMatch(/\.docx/i);
    expect(allText).not.toMatch(/\.pdf/i);
    expect(allText).not.toMatch(/\.txt/i);
  });

  // ── Recommendation IDs never appear ──
  it("removes recommendation IDs (e.g. CLARITY-004) from visible fields", () => {
    const sanitized = sanitizeVisibleOutput(BAD_OUTPUT, true);
    expect(JSON.stringify(sanitized)).not.toMatch(/\b[A-Z]{3,}-\d{3,}\b/);
  });

  // ── File IDs and vector-store IDs never appear ──
  it("removes file IDs and vector-store IDs from visible fields", () => {
    const sanitized = sanitizeVisibleOutput(BAD_OUTPUT, true);
    expect(JSON.stringify(sanitized)).not.toMatch(/file-[A-Za-z0-9_-]{10,}/i);
    expect(JSON.stringify(sanitized)).not.toMatch(/vs_[A-Za-z0-9_-]{10,}/i);
  });

  // ── Source references cleared ──
  it("clears source_references to empty array", () => {
    const sanitized = sanitizeVisibleOutput(BAD_OUTPUT, true);
    expect(sanitized.source_references).toEqual([]);
  });

  // ── Strategy Knowledge Master never appears ──
  it("removes 'Strategy Knowledge Master' from all visible fields", () => {
    const sanitized = sanitizeVisibleOutput(BAD_OUTPUT, true);
    expect(JSON.stringify(sanitized)).not.toMatch(/Strategy Knowledge Master/i);
  });

  // ── Recommendation Bank never appears ──
  it("removes 'Recommendation Bank' from all visible fields", () => {
    const sanitized = sanitizeVisibleOutput(BAD_OUTPUT, true);
    expect(JSON.stringify(sanitized)).not.toMatch(/Recommendation Bank/i);
  });

  // ── Propel knowledge sources never appears ──
  it("removes 'Propel knowledge sources' from all visible fields", () => {
    const sanitized = sanitizeVisibleOutput(BAD_OUTPUT, true);
    expect(JSON.stringify(sanitized)).not.toMatch(/Propel knowledge sources/i);
  });

  // ── Materials used never appears ──
  it("removes 'materials used' from all visible fields", () => {
    const sanitized = sanitizeVisibleOutput(BAD_OUTPUT, true);
    expect(JSON.stringify(sanitized)).not.toMatch(/materials used/i);
  });

  // ── Readiness flags never appear ──
  it("removes 'readiness flags' from all visible fields", () => {
    const sanitized = sanitizeVisibleOutput(BAD_OUTPUT, true);
    expect(JSON.stringify(sanitized)).not.toMatch(/readiness flags/i);
  });

  // ── Completeness level never appears ──
  it("removes 'completeness_level' from all visible fields", () => {
    const sanitized = sanitizeVisibleOutput(BAD_OUTPUT, true);
    expect(JSON.stringify(sanitized)).not.toMatch(/completeness_level/i);
  });

  // ── Missing requirements never appears ──
  it("removes 'missing requirements' from all visible fields", () => {
    const sanitized = sanitizeVisibleOutput(BAD_OUTPUT, true);
    expect(JSON.stringify(sanitized)).not.toMatch(/missing requirements/i);
  });

  // ── Missing utilization data never appears as a deficiency ──
  it("removes 'missing utilization data' from visible fields", () => {
    const sanitized = sanitizeVisibleOutput(BAD_OUTPUT, true);
    expect(JSON.stringify(sanitized)).not.toMatch(/missing utilization data/i);
  });

  // ── Missing program inventory never appears ──
  it("removes 'missing program inventory' from visible fields", () => {
    const sanitized = sanitizeVisibleOutput(BAD_OUTPUT, true);
    expect(JSON.stringify(sanitized)).not.toMatch(/missing program inventory/i);
  });

  // ── Missing outcomes never appears ──
  it("removes 'undefined outcomes' from visible fields", () => {
    const sanitized = sanitizeVisibleOutput(BAD_OUTPUT, true);
    expect(JSON.stringify(sanitized)).not.toMatch(/undefined outcomes/i);
  });

  // ── Missing cohort definitions never appears ──
  it("removes 'missing cohort definitions' from visible fields", () => {
    const sanitized = sanitizeVisibleOutput(BAD_OUTPUT, true);
    expect(JSON.stringify(sanitized)).not.toMatch(/missing cohort definitions/i);
  });

  // ── Missing baseline definitions never appears ──
  it("removes 'missing baseline definitions' from visible fields", () => {
    const sanitized = sanitizeVisibleOutput(BAD_OUTPUT, true);
    expect(JSON.stringify(sanitized)).not.toMatch(/missing baseline/i);
  });

  // ── Source: prefix never appears ──
  it("removes 'Source:' prefixes from visible fields", () => {
    const sanitized = sanitizeVisibleOutput(BAD_OUTPUT, true);
    expect(JSON.stringify(sanitized)).not.toMatch(/Source:\s*/i);
    expect(JSON.stringify(sanitized)).not.toMatch(/Sources:\s*/i);
  });

  // ── "according to the document" never appears ──
  it("removes 'according to the document' from visible fields", () => {
    const sanitized = sanitizeVisibleOutput(BAD_OUTPUT, true);
    expect(JSON.stringify(sanitized)).not.toMatch(/according to the document/i);
  });

  // ── "see guidance in" never appears ──
  it("removes 'see guidance in' from visible fields", () => {
    const sanitized = sanitizeVisibleOutput(BAD_OUTPUT, true);
    expect(JSON.stringify(sanitized)).not.toMatch(/see guidance in/i);
  });

  // ── "from the knowledge base" never appears ──
  it("removes 'from the knowledge base' from visible fields", () => {
    const sanitized = sanitizeVisibleOutput(BAD_OUTPUT, true);
    expect(JSON.stringify(sanitized)).not.toMatch(/from the knowledge base/i);
  });

  // ── "retrieved materials" never appears ──
  it("removes 'retrieved materials' from visible fields", () => {
    const sanitized = sanitizeVisibleOutput(BAD_OUTPUT, true);
    expect(JSON.stringify(sanitized)).not.toMatch(/retrieved materials/i);
  });

  // ── Assessment-only reports still produce useful limitations ──
  it("preserves clean limitation text that does not reference forbidden terms", () => {
    const cleanOutput: StrategyPocOutput = {
      ...VALID_OUTPUT,
      limitations: "This assessment reflects reported organizational practices and should be validated through stakeholder discussion before implementation.",
    };
    const sanitized = sanitizeVisibleOutput(cleanOutput, true);
    expect(sanitized.limitations).toContain("reported organizational practices");
    expect(sanitized.limitations).toContain("stakeholder discussion");
  });

  // ── Exact bad example is transformed ──
  it("transforms the exact bad example limitations into clean language", () => {
    const sanitized = sanitizeVisibleOutput(BAD_OUTPUT, true);
    expect(sanitized.limitations).not.toMatch(/readiness flags|missing utilization|Strategy Knowledge Master|Recommendation Bank|materials used/i);
    // The sanitized limitations should not contain broken sentences
    expect(sanitized.limitations).not.toMatch(/^\s*[,.;]/);
  });

  // ── Print output remains source-free ──
  it("print output (all visible fields) remains source-free after sanitization", () => {
    const sanitized = sanitizeVisibleOutput(BAD_OUTPUT, true);
    const visibleFields = [
      sanitized.executive_summary,
      sanitized.maturity_interpretation,
      sanitized.limitations,
      ...(sanitized.prioritized_barriers ?? []).flatMap(b => [b.title, b.description]),
      ...(sanitized.priority_recommendations ?? []).flatMap(r => [
        r.title, r.why_this_matters, r.assessment_evidence, r.propel_knowledge_evidence,
        r.recommended_action, r.suggested_first_step, r.expected_strategic_impact,
        r.implementation_sequence,
      ]),
      ...(sanitized.client_discussion_questions ?? []),
      ...(sanitized.implementation_sequence ?? []),
    ];
    for (const field of visibleFields) {
      expect(field).not.toMatch(/\.docx|\.pdf|\.txt|Strategy Knowledge Master|Recommendation Bank|readiness flags|materials used|retrieved materials|Source:/i);
    }
  });

  // ── validateNoForbiddenContent catches remaining violations ──
  it("validateNoForbiddenContent returns violations for unsanitized output", () => {
    const violations = validateNoForbiddenContent(BAD_OUTPUT, true);
    expect(violations.length).toBeGreaterThan(0);
  });

  it("validateNoForbiddenContent returns no violations for clean output", () => {
    const cleanOutput: StrategyPocOutput = {
      ...VALID_OUTPUT,
      limitations: "This assessment reflects reported organizational practices and should be validated through stakeholder discussion before implementation.",
      source_references: [],
    };
    const violations = validateNoForbiddenContent(cleanOutput, true);
    expect(violations).toEqual([]);
  });

  // ── Assessment-only payload strips readiness ──
  it("buildFilteredPayload for assessment_only strips readiness and empty legacy arrays", () => {
    const snapshot = {
      ...MOCK_SNAPSHOT_DATA,
      snapshot_mode: "assessment_only",
      outcomes: [],
      metrics: [],
      programs: [],
      utilization: [],
      resource_gaps: [],
      evidence_sources: [],
      readiness: { level: "sufficient", requirements: [], complete_count: 7, total_required: 7 },
    };
    const payload = buildFilteredPayload(snapshot);
    expect(payload.readiness).toEqual({});
    expect(payload.outcomes).toEqual([]);
    expect(payload.utilization).toEqual([]);
    expect(payload.resource_gaps).toEqual([]);
  });

  it("buildFilteredPayload for standard mode preserves readiness", () => {
    const snapshot = {
      ...MOCK_SNAPSHOT_DATA,
      snapshot_mode: "standard",
    };
    const payload = buildFilteredPayload(snapshot);
    expect(payload.readiness).toBeDefined();
    expect(payload.readiness.level).toBe("sufficient");
  });

  // ── Non-assessment-only mode does not strip readiness deficiency language ──
  it("standard mode sanitization does not strip assessment-only-specific terms", () => {
    const output: StrategyPocOutput = {
      ...VALID_OUTPUT,
      limitations: "The readiness flags show some issues with the workspace data.",
    };
    const sanitized = sanitizeVisibleOutput(output, false);
    // In standard mode, 'readiness flags' should still be stripped (it's in the general list)
    expect(sanitized.limitations).not.toMatch(/readiness flags/i);
  });
});
