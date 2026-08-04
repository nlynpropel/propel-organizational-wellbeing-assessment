import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const assessmentsSrc = readFileSync(resolve('src/services/assessments.ts'), 'utf-8');
const newClientSrc = readFileSync(resolve('src/pages/NewClientPage.tsx'), 'utf-8');
const clientDetailSrc = readFileSync(resolve('src/pages/ClientDetailPage.tsx'), 'utf-8');
const sendAssessmentSrc = readFileSync(resolve('src/pages/SendAssessmentPage.tsx'), 'utf-8');
const introSrc = readFileSync(resolve('src/components/respondent/AssessmentIntroduction.tsx'), 'utf-8');
const dbTypesSrc = readFileSync(resolve('src/lib/database.types.ts'), 'utf-8');

describe('Multi-assessment foundation — no auto-instance creation', () => {
  it('NewClientPage does not call createDraftAssessment', () => {
    expect(newClientSrc).not.toMatch(/createDraftAssessment/);
  });

  it('NewClientPage does not import from assessments service', () => {
    expect(newClientSrc).not.toMatch(/from ['"]\.\.\/services\/assessments['"]/);
  });

  it('NewClientPage does not mention draft assessment instance creation', () => {
    expect(newClientSrc).not.toMatch(/draft assessment instance/i);
  });

  it('assessments service does not export createDraftAssessment', () => {
    expect(assessmentsSrc).not.toMatch(/export.*createDraftAssessment/);
  });

  it('assessments service exports fetchAccessibleAssessments', () => {
    expect(assessmentsSrc).toMatch(/fetchAccessibleAssessments/);
  });

  it('assessments service checks assessment_role_access table for non-superadmin', () => {
    expect(assessmentsSrc).toMatch(/assessment_role_access/);
  });

  it('assessments service bypasses role check for superadmin', () => {
    expect(assessmentsSrc).toMatch(/superadmin/);
  });
});

describe('Multi-assessment foundation — explicit instance creation', () => {
  it('SendAssessmentPage imports fetchAccessibleAssessments', () => {
    expect(sendAssessmentSrc).toMatch(/fetchAccessibleAssessments/);
  });

  it('SendAssessmentPage requires explicit assessment selection', () => {
    expect(sendAssessmentSrc).toMatch(/selectedAssessmentId/);
  });

  it('SendAssessmentPage shows assessment selector when more than one accessible assessment exists', () => {
    expect(sendAssessmentSrc).toMatch(/assessments\.length > 1/);
  });

  it('SendAssessmentPage auto-selects when only one accessible assessment exists', () => {
    expect(sendAssessmentSrc).toMatch(/accessibleAssessments\.length === 1/);
  });

  it('SendAssessmentPage passes assessment_version_id explicitly when creating instance', () => {
    expect(sendAssessmentSrc).toMatch(/assessment_version_id/);
  });

  it('SendAssessmentPage uses createAssessmentInstance from assessmentBuilder', () => {
    expect(sendAssessmentSrc).toMatch(/createAssessmentInstance/);
  });

  it('SendAssessmentPage disables submit button while submitting (duplicate prevention)', () => {
    expect(sendAssessmentSrc).toMatch(/disabled=\{submitting\}/);
  });
});

describe('Multi-assessment foundation — client detail UI', () => {
  it('ClientDetailPage does not have View all assessments button', () => {
    expect(clientDetailSrc).not.toMatch(/View all assessments/i);
  });

  it('ClientDetailPage does not say draft assessment instance was created', () => {
    expect(clientDetailSrc).not.toMatch(/draft assessment instance/i);
  });
});

describe('Multi-assessment foundation — dynamic intro', () => {
  it('AssessmentIntroduction uses Well-being Strategy Assessment eyebrow', () => {
    expect(introSrc).toMatch(/Well-being Strategy Assessment/);
  });

  it('AssessmentIntroduction uses template.name dynamically', () => {
    expect(introSrc).toMatch(/\{template\.name\}/);
  });

  it('AssessmentIntroduction uses respondent_intro_text from version', () => {
    expect(introSrc).toMatch(/respondent_intro_text/);
  });

  it('AssessmentIntroduction has default intro text fallback', () => {
    expect(introSrc).toMatch(/well-being strategy maturity, behavioral barriers, and priority opportunities/);
  });

  it('AssessmentIntroduction uses broker_name dynamically for reviewer line', () => {
    expect(introSrc).toMatch(/instance\.broker_name/);
    expect(introSrc).toMatch(/will review your responses and prepare a personalized report/);
  });

  it('AssessmentIntroduction does not contain "Your advisor:"', () => {
    expect(introSrc).not.toMatch(/Your advisor:/);
  });

  it('AssessmentIntroduction does not contain "Organizational Well-being Strategy"', () => {
    expect(introSrc).not.toMatch(/Organizational Well-being Strategy/);
  });

  it('AssessmentIntroduction does not contain "broker-enabled"', () => {
    expect(introSrc).not.toMatch(/broker-enabled/);
  });

  it('AssessmentIntroduction does not hardcode Nicholas Layne', () => {
    expect(introSrc).not.toMatch(/Nicholas Layne/);
  });

  it('AssessmentIntroduction uses "Message from your reviewer" not "Message from your advisor"', () => {
    expect(introSrc).toMatch(/Message from your reviewer/);
    expect(introSrc).not.toMatch(/Message from your advisor/);
  });

  it('AssessmentIntroduction uses "your reviewer" not "your advisor" in confidentiality text', () => {
    expect(introSrc).toMatch(/shared only with your reviewer/);
    expect(introSrc).not.toMatch(/shared only with your advisor/);
  });

  it('database.types includes respondent_intro_text on AssessmentVersionRow', () => {
    expect(dbTypesSrc).toMatch(/respondent_intro_text/);
  });
});

describe('Multi-assessment foundation — role access model', () => {
  it('database.types includes AssessmentTemplateRow with owner_type', () => {
    expect(dbTypesSrc).toMatch(/owner_type/);
  });

  it('assessments service uses profile.role to determine access', () => {
    expect(assessmentsSrc).toMatch(/role/);
  });
});
