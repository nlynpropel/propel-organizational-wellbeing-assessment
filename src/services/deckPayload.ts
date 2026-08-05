// ============================================================
// Deck payload types — exact structure expected by the PptxGenJS generator
// ============================================================

export type DeckDimension = {
  name: string;
  score: number;
  level: string;
};

export type DeckBehavioralDriver = {
  name: string;
  score: number;
  level: string;
  body: string;
};

export type DeckStrength = {
  title: string;
  body: string;
};

export type DeckOpportunity = {
  title: string;
  body: string;
};

export type DeckHoldingBack = {
  title: string;
  body: string;
};

export type DeckRecommendation = {
  title: string;
  why_it_matters: string;
  recommended_action: string;
  suggested_first_step: string;
  expected_impact: string;
  implementation_order: string;
  guidance: string;
  related_findings: string;
};

export type DeckImplementationPhase = {
  title: string;
  body: string;
};

export type DeckImplementationSequence = {
  now: DeckImplementationPhase;
  next: DeckImplementationPhase;
  later: DeckImplementationPhase;
};

export type DeckClient = {
  name: string;
  assessment_name: string;
  assessment_date: string;
};

export type DeckAssessment = {
  overall_score: number;
  maturity: string;
  bands: string[];
  dimensions: DeckDimension[];
  behavioral_drivers: DeckBehavioralDriver[];
};

export type DeckStrategy = {
  executive_summary: string;
  current_maturity: string;
  strengths: DeckStrength[];
  priority_opportunities: DeckOpportunity[];
  holding_back: DeckHoldingBack[];
  recommendations: DeckRecommendation[];
  implementation_sequence: DeckImplementationSequence;
  discussion_questions: string[];
};

export type DeckPayload = {
  client: DeckClient;
  assessment: DeckAssessment;
  strategy: DeckStrategy;
};

// ============================================================
// Overflow limits — pre-generation content safety
// ============================================================

export const DECK_LIMITS = {
  executive_summary_words: 130,
  current_maturity_words: 120,
  strength_title_words: 10,
  strength_body_words: 45,
  opportunity_title_words: 12,
  opportunity_body_words: 45,
  holding_back_title_words: 12,
  holding_back_body_words: 50,
  recommendation_title_words: 16,
  recommendation_section_words: 55,
  implementation_phase_title_words: 12,
  implementation_phase_body_words: 55,
  discussion_questions_max: 3,
} as const;

export type DeckLimitViolation = {
  field: string;
  limit: number;
  actual: number;
  unit: 'words' | 'count';
  message: string;
};

function countWords(text: string): number {
  if (!text || typeof text !== 'string') return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function validateDeckOverflow(payload: DeckPayload): DeckLimitViolation[] {
  const violations: DeckLimitViolation[] = [];

  const checkWords = (
    text: string,
    limit: number,
    field: string
  ): void => {
    const count = countWords(text);
    if (count > limit) {
      violations.push({
        field,
        limit,
        actual: count,
        unit: 'words',
        message: `${field} exceeds limit: ${count} words (max ${limit})`,
      });
    }
  };

  // Executive summary
  checkWords(payload.strategy.executive_summary, DECK_LIMITS.executive_summary_words, 'strategy.executive_summary');

  // Current maturity
  checkWords(payload.strategy.current_maturity, DECK_LIMITS.current_maturity_words, 'strategy.current_maturity');

  // Strengths
  payload.strategy.strengths.forEach((s, i) => {
    checkWords(s.title, DECK_LIMITS.strength_title_words, `strategy.strengths[${i}].title`);
    checkWords(s.body, DECK_LIMITS.strength_body_words, `strategy.strengths[${i}].body`);
  });

  // Priority opportunities
  payload.strategy.priority_opportunities.forEach((o, i) => {
    checkWords(o.title, DECK_LIMITS.opportunity_title_words, `strategy.priority_opportunities[${i}].title`);
    checkWords(o.body, DECK_LIMITS.opportunity_body_words, `strategy.priority_opportunities[${i}].body`);
  });

  // Holding back
  payload.strategy.holding_back.forEach((h, i) => {
    checkWords(h.title, DECK_LIMITS.holding_back_title_words, `strategy.holding_back[${i}].title`);
    checkWords(h.body, DECK_LIMITS.holding_back_body_words, `strategy.holding_back[${i}].body`);
  });

  // Recommendations
  payload.strategy.recommendations.forEach((rec, i) => {
    checkWords(rec.title, DECK_LIMITS.recommendation_title_words, `strategy.recommendations[${i}].title`);
    checkWords(rec.why_it_matters, DECK_LIMITS.recommendation_section_words, `strategy.recommendations[${i}].why_it_matters`);
    checkWords(rec.recommended_action, DECK_LIMITS.recommendation_section_words, `strategy.recommendations[${i}].recommended_action`);
    checkWords(rec.suggested_first_step, DECK_LIMITS.recommendation_section_words, `strategy.recommendations[${i}].suggested_first_step`);
    checkWords(rec.expected_impact, DECK_LIMITS.recommendation_section_words, `strategy.recommendations[${i}].expected_impact`);
    checkWords(rec.implementation_order, DECK_LIMITS.recommendation_section_words, `strategy.recommendations[${i}].implementation_order`);
    checkWords(rec.guidance, DECK_LIMITS.recommendation_section_words, `strategy.recommendations[${i}].guidance`);
    checkWords(rec.related_findings, DECK_LIMITS.recommendation_section_words, `strategy.recommendations[${i}].related_findings`);
  });

  // Implementation phases
  const phases = [
    { key: 'now', phase: payload.strategy.implementation_sequence.now },
    { key: 'next', phase: payload.strategy.implementation_sequence.next },
    { key: 'later', phase: payload.strategy.implementation_sequence.later },
  ];
  phases.forEach(({ key, phase }) => {
    checkWords(phase.title, DECK_LIMITS.implementation_phase_title_words, `strategy.implementation_sequence.${key}.title`);
    checkWords(phase.body, DECK_LIMITS.implementation_phase_body_words, `strategy.implementation_sequence.${key}.body`);
  });

  // Discussion questions
  if (payload.strategy.discussion_questions.length > DECK_LIMITS.discussion_questions_max) {
    violations.push({
      field: 'strategy.discussion_questions',
      limit: DECK_LIMITS.discussion_questions_max,
      actual: payload.strategy.discussion_questions.length,
      unit: 'count',
      message: `discussion_questions exceeds limit: ${payload.strategy.discussion_questions.length} (max ${DECK_LIMITS.discussion_questions_max})`,
    });
  }

  return violations;
}

// ============================================================
// Required-data validation — ensures all data exists before generation
// ============================================================

export type DeckValidationError = {
  field: string;
  message: string;
};

export function validateDeckPayload(payload: DeckPayload): DeckValidationError[] {
  const errors: DeckValidationError[] = [];

  // Client
  if (!payload.client.name?.trim()) {
    errors.push({ field: 'client.name', message: 'Client name is required' });
  }
  if (!payload.client.assessment_name?.trim()) {
    errors.push({ field: 'client.assessment_name', message: 'Assessment name is required' });
  }
  if (!payload.client.assessment_date?.trim()) {
    errors.push({ field: 'client.assessment_date', message: 'Completion date is required' });
  }

  // Assessment
  if (typeof payload.assessment.overall_score !== 'number' ||
      payload.assessment.overall_score < 0 || payload.assessment.overall_score > 100) {
    errors.push({ field: 'assessment.overall_score', message: 'Overall score must be between 0 and 100' });
  }
  if (!payload.assessment.maturity?.trim()) {
    errors.push({ field: 'assessment.maturity', message: 'Maturity band is required' });
  }
  if (!Array.isArray(payload.assessment.bands) || payload.assessment.bands.length === 0) {
    errors.push({ field: 'assessment.bands', message: 'Maturity band labels are required' });
  }
  if (payload.assessment.dimensions.length !== 6) {
    errors.push({ field: 'assessment.dimensions', message: 'Exactly six strategy dimensions are required' });
  }
  payload.assessment.dimensions.forEach((dim, i) => {
    if (typeof dim.score !== 'number' || dim.score < 0 || dim.score > 100) {
      errors.push({ field: `assessment.dimensions[${i}].score`, message: `Dimension "${dim.name ?? i}" score must be between 0 and 100` });
    }
  });
  if (payload.assessment.behavioral_drivers.length !== 4) {
    errors.push({ field: 'assessment.behavioral_drivers', message: 'Exactly four behavioral drivers are required' });
  }
  payload.assessment.behavioral_drivers.forEach((d, i) => {
    if (typeof d.score !== 'number' || d.score < 0 || d.score > 100) {
      errors.push({ field: `assessment.behavioral_drivers[${i}].score`, message: `Driver "${d.name ?? i}" score must be between 0 and 100` });
    }
  });

  // Strategy
  if (!payload.strategy.executive_summary?.trim()) {
    errors.push({ field: 'strategy.executive_summary', message: 'Executive summary is required' });
  }
  if (!payload.strategy.current_maturity?.trim()) {
    errors.push({ field: 'strategy.current_maturity', message: 'Current maturity is required' });
  }
  if (payload.strategy.strengths.length < 1) {
    errors.push({ field: 'strategy.strengths', message: 'At least one strength is required' });
  }
  if (payload.strategy.priority_opportunities.length < 1) {
    errors.push({ field: 'strategy.priority_opportunities', message: 'At least one priority opportunity is required' });
  }
  if (payload.strategy.recommendations.length < 1) {
    errors.push({ field: 'strategy.recommendations', message: 'At least one recommendation is required' });
  }

  // Implementation sequence — all three phases required
  const seq = payload.strategy.implementation_sequence;
  if (!seq.now?.title?.trim() || !seq.now?.body?.trim()) {
    errors.push({ field: 'strategy.implementation_sequence.now', message: 'Phase 1 (now) title and body are required' });
  }
  if (!seq.next?.title?.trim() || !seq.next?.body?.trim()) {
    errors.push({ field: 'strategy.implementation_sequence.next', message: 'Phase 2 (next) title and body are required' });
  }
  if (!seq.later?.title?.trim() || !seq.later?.body?.trim()) {
    errors.push({ field: 'strategy.implementation_sequence.later', message: 'Phase 3 (later) title and body are required' });
  }

  return errors;
}

// ============================================================
// Prohibited metadata check — ensures no internal IDs leak into slides
// ============================================================

export const PROHIBITED_METADATA_PATTERNS: string[] = [
  'file-',
  'vs_',
  'file_id',
  'vector_store',
  'source:',
  'sources:',
  'according to the document',
  'see guidance in',
  'from the knowledge base',
  'strategy knowledge master',
  'recommendation bank',
  'propel knowledge sources',
  'materials used',
  'retrieved materials',
  'readiness flags',
  'completeness_level',
  'snapshot_mode',
  'assessment-only mode',
  '.docx',
  '.pdf',
  '.txt',
];

export function validateNoProhibitedMetadata(payload: DeckPayload): string[] {
  const violations: string[] = [];

  const checkText = (text: string, field: string): void => {
    if (typeof text !== 'string') return;
    const lower = text.toLowerCase();
    for (const pattern of PROHIBITED_METADATA_PATTERNS) {
      if (lower.includes(pattern)) {
        violations.push(`'${field}' contains prohibited metadata: '${pattern}'`);
      }
    }
  };

  checkText(payload.strategy.executive_summary, 'strategy.executive_summary');
  checkText(payload.strategy.current_maturity, 'strategy.current_maturity');

  payload.strategy.strengths.forEach((s, i) => {
    checkText(s.title, `strategy.strengths[${i}].title`);
    checkText(s.body, `strategy.strengths[${i}].body`);
  });
  payload.strategy.priority_opportunities.forEach((o, i) => {
    checkText(o.title, `strategy.priority_opportunities[${i}].title`);
    checkText(o.body, `strategy.priority_opportunities[${i}].body`);
  });
  payload.strategy.holding_back.forEach((h, i) => {
    checkText(h.title, `strategy.holding_back[${i}].title`);
    checkText(h.body, `strategy.holding_back[${i}].body`);
  });
  payload.strategy.recommendations.forEach((rec, i) => {
    checkText(rec.title, `strategy.recommendations[${i}].title`);
    checkText(rec.why_it_matters, `strategy.recommendations[${i}].why_it_matters`);
    checkText(rec.recommended_action, `strategy.recommendations[${i}].recommended_action`);
    checkText(rec.suggested_first_step, `strategy.recommendations[${i}].suggested_first_step`);
    checkText(rec.expected_impact, `strategy.recommendations[${i}].expected_impact`);
    checkText(rec.implementation_order, `strategy.recommendations[${i}].implementation_order`);
    checkText(rec.guidance, `strategy.recommendations[${i}].guidance`);
    checkText(rec.related_findings, `strategy.recommendations[${i}].related_findings`);
  });
  payload.strategy.discussion_questions.forEach((q, i) => {
    checkText(q, `strategy.discussion_questions[${i}]`);
  });

  const phases = [
    { key: 'now', phase: payload.strategy.implementation_sequence.now },
    { key: 'next', phase: payload.strategy.implementation_sequence.next },
    { key: 'later', phase: payload.strategy.implementation_sequence.later },
  ];
  phases.forEach(({ key, phase }) => {
    checkText(phase.title, `strategy.implementation_sequence.${key}.title`);
    checkText(phase.body, `strategy.implementation_sequence.${key}.body`);
  });

  return violations;
}

// ============================================================
// Placeholder token check — ensures no unresolved tokens remain
// ============================================================

export function validateNoPlaceholderTokens(payload: DeckPayload): string[] {
  const violations: string[] = [];
  const tokenPattern = /\{\{[^}]+\}\}|\$\{[^}]+\}|\[INSERT[^]]*\]/i;

  const checkText = (text: string, field: string): void => {
    if (typeof text !== 'string') return;
    if (tokenPattern.test(text)) {
      violations.push(`'${field}' contains unresolved placeholder token`);
    }
  };

  checkText(payload.client.name, 'client.name');
  checkText(payload.client.assessment_name, 'client.assessment_name');
  checkText(payload.client.assessment_date, 'client.assessment_date');
  checkText(payload.strategy.executive_summary, 'strategy.executive_summary');
  checkText(payload.strategy.current_maturity, 'strategy.current_maturity');

  payload.strategy.recommendations.forEach((rec, i) => {
    checkText(rec.title, `strategy.recommendations[${i}].title`);
  });

  return violations;
}
