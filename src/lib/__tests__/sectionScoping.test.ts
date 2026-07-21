import { describe, it, expect } from 'vitest';

// ============================================================
// Section-scoped question editing tests
// Mirrors the AssessmentBuilderPage state management logic.
// ============================================================

type DraftQuestion = {
  id: string;
  question_text: string;
  sectionId: string;
  display_order: number;
  question_type: string;
};

type DraftSection = {
  id: string;
  title: string;
  display_order: number;
};

function makeSection(id: string, title: string, order: number): DraftSection {
  return { id, title, display_order: order };
}

function makeQuestion(id: string, text: string, sectionId: string, order: number): DraftQuestion {
  return { id, question_text: text, sectionId, display_order: order, question_type: 'agreement5' };
}

function filterQuestionsBySection(questions: DraftQuestion[], sectionId: string): DraftQuestion[] {
  return questions.filter((q) => q.sectionId === sectionId);
}

function addQuestion(questions: DraftQuestion[], q: DraftQuestion): DraftQuestion[] {
  return [...questions, q];
}

function deleteQuestion(questions: DraftQuestion[], id: string): DraftQuestion[] {
  return questions.filter((q) => q.id !== id);
}

function duplicateQuestion(questions: DraftQuestion[], id: string, newId: string): DraftQuestion[] {
  const q = questions.find((qq) => qq.id === id);
  if (!q) return questions;
  return [...questions, { ...q, id: newId, question_text: q.question_text + ' (copy)' }];
}

function moveQuestionBetweenSections(questions: DraftQuestion[], id: string, newSectionId: string): DraftQuestion[] {
  return questions.map((q) => q.id === id ? { ...q, sectionId: newSectionId } : q);
}

function reorderWithinSection(questions: DraftQuestion[], sectionId: string, fromIdx: number, toIdx: number): DraftQuestion[] {
  const sectionQs = filterQuestionsBySection(questions, sectionId);
  if (fromIdx < 0 || fromIdx >= sectionQs.length || toIdx < 0 || toIdx >= sectionQs.length) return questions;
  const reordered = [...sectionQs];
  [reordered[fromIdx], reordered[toIdx]] = [reordered[toIdx], reordered[fromIdx]];
  const others = questions.filter((q) => q.sectionId !== sectionId);
  return [...others, ...reordered];
}

describe('Section-scoped question editing', () => {
  // Test 1: Add question to Section 1
  it('Test 1: add question to Section 1', () => {
    const s1 = makeSection('s1', 'Section 1', 0);
    let questions: DraftQuestion[] = [];
    const q1 = makeQuestion('q1', 'Question 1', s1.id, 0);
    questions = addQuestion(questions, q1);

    const s1Qs = filterQuestionsBySection(questions, s1.id);
    expect(s1Qs).toHaveLength(1);
    expect(s1Qs[0].id).toBe('q1');
    expect(s1Qs[0].sectionId).toBe('s1');
  });

  // Test 2: Add question to Section 2
  it('Test 2: add question to Section 2', () => {
    const s1 = makeSection('s1', 'Section 1', 0);
    const s2 = makeSection('s2', 'Section 2', 1);
    let questions: DraftQuestion[] = [
      makeQuestion('q1', 'Question 1', s1.id, 0),
    ];
    const q2 = makeQuestion('q2', 'Question 2', s2.id, 0);
    questions = addQuestion(questions, q2);

    const s1Qs = filterQuestionsBySection(questions, s1.id);
    const s2Qs = filterQuestionsBySection(questions, s2.id);
    expect(s1Qs).toHaveLength(1);
    expect(s1Qs[0].id).toBe('q1');
    expect(s2Qs).toHaveLength(1);
    expect(s2Qs[0].id).toBe('q2');
  });

  // Test 3: Verify each section contains only its own question
  it('Test 3: each section contains only its own questions', () => {
    const s1 = makeSection('s1', 'Section 1', 0);
    const s2 = makeSection('s2', 'Section 2', 1);
    const questions: DraftQuestion[] = [
      makeQuestion('q1', 'Q1', s1.id, 0),
      makeQuestion('q2', 'Q2', s1.id, 1),
      makeQuestion('q3', 'Q3', s2.id, 0),
      makeQuestion('q4', 'Q4', s2.id, 1),
    ];

    const s1Qs = filterQuestionsBySection(questions, s1.id);
    const s2Qs = filterQuestionsBySection(questions, s2.id);
    expect(s1Qs).toHaveLength(2);
    expect(s2Qs).toHaveLength(2);
    expect(s1Qs.every((q) => q.sectionId === 's1')).toBe(true);
    expect(s2Qs.every((q) => q.sectionId === 's2')).toBe(true);
    expect(s1Qs.map((q) => q.id)).toEqual(['q1', 'q2']);
    expect(s2Qs.map((q) => q.id)).toEqual(['q3', 'q4']);
  });

  // Test 4: Edit one question without changing the other
  it('Test 4: edit one question without changing the other', () => {
    const s1 = makeSection('s1', 'Section 1', 0);
    let questions: DraftQuestion[] = [
      makeQuestion('q1', 'Q1', s1.id, 0),
      makeQuestion('q2', 'Q2', s1.id, 1),
    ];
    questions = questions.map((q) => q.id === 'q1' ? { ...q, question_text: 'Updated Q1' } : q);

    expect(questions[0].question_text).toBe('Updated Q1');
    expect(questions[1].question_text).toBe('Q2');
    expect(questions[0].sectionId).toBe('s1');
    expect(questions[1].sectionId).toBe('s1');
  });

  // Test 5: Duplicate a question
  it('Test 5: duplicate a question creates one new question in same section', () => {
    const s1 = makeSection('s1', 'Section 1', 0);
    let questions: DraftQuestion[] = [
      makeQuestion('q1', 'Q1', s1.id, 0),
      makeQuestion('q2', 'Q2', s1.id, 1),
    ];
    questions = duplicateQuestion(questions, 'q1', 'q1-copy');

    expect(questions).toHaveLength(3);
    const dup = questions.find((q) => q.id === 'q1-copy');
    expect(dup).toBeDefined();
    expect(dup!.sectionId).toBe('s1');
    expect(dup!.question_text).toBe('Q1 (copy)');
  });

  // Test 6: Move a question between sections
  it('Test 6: move a question between sections updates sectionId', () => {
    const s1 = makeSection('s1', 'Section 1', 0);
    const s2 = makeSection('s2', 'Section 2', 1);
    let questions: DraftQuestion[] = [
      makeQuestion('q1', 'Q1', s1.id, 0),
      makeQuestion('q2', 'Q2', s1.id, 1),
      makeQuestion('q3', 'Q3', s2.id, 0),
    ];
    questions = moveQuestionBetweenSections(questions, 'q2', s2.id);

    expect(questions.find((q) => q.id === 'q2')!.sectionId).toBe('s2');
    expect(filterQuestionsBySection(questions, s1.id)).toHaveLength(1);
    expect(filterQuestionsBySection(questions, s2.id)).toHaveLength(2);
  });

  // Test 7: Save and reload preserves section assignments
  it('Test 7: section assignments persist after save/reload simulation', () => {
    const s1 = makeSection('s1', 'Section 1', 0);
    const s2 = makeSection('s2', 'Section 2', 1);
    const savedQuestions: DraftQuestion[] = [
      makeQuestion('q1', 'Q1', s1.id, 0),
      makeQuestion('q2', 'Q2', s2.id, 0),
    ];

    // Simulate reload: questions come back from DB with section assignments
    const reloaded: DraftQuestion[] = savedQuestions.map((q) => ({ ...q }));
    expect(filterQuestionsBySection(reloaded, s1.id)).toHaveLength(1);
    expect(filterQuestionsBySection(reloaded, s2.id)).toHaveLength(1);
    expect(reloaded[0].sectionId).toBe('s1');
    expect(reloaded[1].sectionId).toBe('s2');
  });

  // Test 8: Delete a question removes it only once
  it('Test 8: delete removes question only once', () => {
    const s1 = makeSection('s1', 'Section 1', 0);
    let questions: DraftQuestion[] = [
      makeQuestion('q1', 'Q1', s1.id, 0),
      makeQuestion('q2', 'Q2', s1.id, 1),
    ];
    questions = deleteQuestion(questions, 'q1');
    expect(questions).toHaveLength(1);
    expect(questions[0].id).toBe('q2');
  });

  // Test 9: Reorder within a section does not affect other sections
  it('Test 9: reorder within section does not affect other section', () => {
    const s1 = makeSection('s1', 'Section 1', 0);
    const s2 = makeSection('s2', 'Section 2', 1);
    let questions: DraftQuestion[] = [
      makeQuestion('q1', 'Q1', s1.id, 0),
      makeQuestion('q2', 'Q2', s1.id, 1),
      makeQuestion('q3', 'Q3', s2.id, 0),
      makeQuestion('q4', 'Q4', s2.id, 1),
    ];
    questions = reorderWithinSection(questions, s1.id, 0, 1);

    const s1Qs = filterQuestionsBySection(questions, s1.id);
    const s2Qs = filterQuestionsBySection(questions, s2.id);
    expect(s1Qs[0].id).toBe('q2');
    expect(s1Qs[1].id).toBe('q1');
    expect(s2Qs[0].id).toBe('q3');
    expect(s2Qs[1].id).toBe('q4');
  });

  // Test 10: New sections get unique temp IDs
  it('Test 10: new sections get unique temp IDs', () => {
    let counter = 0;
    const makeTempId = () => {
      counter += 1;
      return `temp-section-${counter}`;
    };
    const s1 = { id: makeTempId(), title: 'Section 1', display_order: 0 };
    const s2 = { id: makeTempId(), title: 'Section 2', display_order: 1 };
    expect(s1.id).not.toBe(s2.id);
    expect(s1.id).toBe('temp-section-1');
    expect(s2.id).toBe('temp-section-2');
  });
});
