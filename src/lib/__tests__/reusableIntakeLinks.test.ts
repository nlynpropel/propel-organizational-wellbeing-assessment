import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  validateEmployeeCount,
  isPublicEmailDomain,
  isValidEmailFormat,
  normalizeEmail,
  extractDomain,
  deriveEmployeeSizeTier,
} from '../validation';

const reusableLinksSrc = readFileSync(resolve('src/services/reusableLinks.ts'), 'utf-8');
const intakePageSrc = readFileSync(resolve('src/pages/IntakePage.tsx'), 'utf-8');
const linksPageSrc = readFileSync(resolve('src/pages/ReusableLinksPage.tsx'), 'utf-8');
const newClientSrc = readFileSync(resolve('src/pages/NewClientPage.tsx'), 'utf-8');
const clientDetailSrc = readFileSync(resolve('src/pages/ClientDetailPage.tsx'), 'utf-8');
const clientsPageSrc = readFileSync(resolve('src/pages/ClientsPage.tsx'), 'utf-8');
const assessmentsPageSrc = readFileSync(resolve('src/pages/AssessmentsPage.tsx'), 'utf-8');
const appSrc = readFileSync(resolve('src/App.tsx'), 'utf-8');

// ============================================================
// Employee-count validation
// ============================================================

describe('Employee count validation', () => {
  it('rejects blank values', () => {
    expect(validateEmployeeCount('').valid).toBe(false);
    expect(validateEmployeeCount(null).valid).toBe(false);
    expect(validateEmployeeCount(undefined).valid).toBe(false);
  });

  it('rejects zero', () => {
    expect(validateEmployeeCount('0').valid).toBe(false);
    expect(validateEmployeeCount(0).valid).toBe(false);
  });

  it('rejects negatives', () => {
    expect(validateEmployeeCount('-5').valid).toBe(false);
    expect(validateEmployeeCount(-5).valid).toBe(false);
  });

  it('rejects decimals', () => {
    expect(validateEmployeeCount('10.5').valid).toBe(false);
    expect(validateEmployeeCount('10.0').valid).toBe(false);
  });

  it('rejects text', () => {
    expect(validateEmployeeCount('abc').valid).toBe(false);
    expect(validateEmployeeCount('fifty').valid).toBe(false);
  });

  it('accepts positive integers', () => {
    expect(validateEmployeeCount('1').valid).toBe(true);
    expect(validateEmployeeCount('50').valid).toBe(true);
    expect(validateEmployeeCount('1000').valid).toBe(true);
    expect(validateEmployeeCount(250).valid).toBe(true);
  });

  it('derives correct size tiers from integers', () => {
    expect(deriveEmployeeSizeTier(10)).toBe('1-49');
    expect(deriveEmployeeSizeTier(49)).toBe('1-49');
    expect(deriveEmployeeSizeTier(50)).toBe('50-199');
    expect(deriveEmployeeSizeTier(200)).toBe('200-499');
    expect(deriveEmployeeSizeTier(500)).toBe('500-999');
    expect(deriveEmployeeSizeTier(1000)).toBe('1000+');
    expect(deriveEmployeeSizeTier(null)).toBeNull();
  });
});

// ============================================================
// Public email domain rejection
// ============================================================

describe('Public email domain rejection', () => {
  it('rejects gmail, yahoo, outlook, hotmail, icloud, aol', () => {
    expect(isPublicEmailDomain('user@gmail.com')).toBe(true);
    expect(isPublicEmailDomain('user@yahoo.com')).toBe(true);
    expect(isPublicEmailDomain('user@outlook.com')).toBe(true);
    expect(isPublicEmailDomain('user@hotmail.com')).toBe(true);
    expect(isPublicEmailDomain('user@icloud.com')).toBe(true);
    expect(isPublicEmailDomain('user@aol.com')).toBe(true);
  });

  it('accepts work email domains', () => {
    expect(isPublicEmailDomain('user@acme.com')).toBe(false);
    expect(isPublicEmailDomain('user@company.org')).toBe(false);
    expect(isPublicEmailDomain('user@university.edu')).toBe(false);
  });

  it('normalizes email to lowercase and trims', () => {
    expect(normalizeEmail('  Jane@Acme.COM  ')).toBe('jane@acme.com');
  });

  it('extracts domain from email', () => {
    expect(extractDomain('jane@acme.com')).toBe('acme.com');
    expect(extractDomain('Jane@Acme.COM')).toBe('acme.com');
  });

  it('validates email format', () => {
    expect(isValidEmailFormat('jane@acme.com')).toBe(true);
    expect(isValidEmailFormat('not-an-email')).toBe(false);
    expect(isValidEmailFormat('jane@')).toBe(false);
    expect(isValidEmailFormat('@acme.com')).toBe(false);
  });
});

// ============================================================
// Reusable links service
// ============================================================

describe('Reusable links service', () => {
  it('exports generateReusableLink', () => {
    expect(reusableLinksSrc).toMatch(/export async function generateReusableLink/);
  });

  it('exports fetchReusableLinks', () => {
    expect(reusableLinksSrc).toMatch(/export async function fetchReusableLinks/);
  });

  it('exports updateReusableLink', () => {
    expect(reusableLinksSrc).toMatch(/export async function updateReusableLink/);
  });

  it('exports deactivateReusableLink', () => {
    expect(reusableLinksSrc).toMatch(/export async function deactivateReusableLink/);
  });

  it('exports activateReusableLink', () => {
    expect(reusableLinksSrc).toMatch(/export async function activateReusableLink/);
  });

  it('exports resolveReusableLink (public RPC)', () => {
    expect(reusableLinksSrc).toMatch(/export async function resolveReusableLink/);
  });

  it('exports createIntakeSubmission (public RPC)', () => {
    expect(reusableLinksSrc).toMatch(/export async function createIntakeSubmission/);
  });

  it('exports submitReusableAssessment (public RPC)', () => {
    expect(reusableLinksSrc).toMatch(/export async function submitReusableAssessment/);
  });

  it('calls generate_reusable_link RPC', () => {
    expect(reusableLinksSrc).toMatch(/generate_reusable_link/);
  });

  it('calls resolve_reusable_link RPC', () => {
    expect(reusableLinksSrc).toMatch(/resolve_reusable_link/);
  });

  it('calls create_intake_submission RPC', () => {
    expect(reusableLinksSrc).toMatch(/create_intake_submission/);
  });

  it('calls submit_reusable_assessment RPC', () => {
    expect(reusableLinksSrc).toMatch(/submit_reusable_assessment/);
  });
});

// ============================================================
// Intake page (public flow)
// ============================================================

describe('Intake page public flow', () => {
  it('renders intake form with required fields', () => {
    expect(intakePageSrc).toMatch(/organization_name/);
    expect(intakePageSrc).toMatch(/contact_name/);
    expect(intakePageSrc).toMatch(/email/);
    expect(intakePageSrc).toMatch(/employee_count/);
    expect(intakePageSrc).toMatch(/industry/);
    expect(intakePageSrc).toMatch(/region/);
  });

  it('uses validateEmployeeCount for employee count field', () => {
    expect(intakePageSrc).toMatch(/validateEmployeeCount/);
  });

  it('uses isPublicEmailDomain to reject public domains', () => {
    expect(intakePageSrc).toMatch(/isPublicEmailDomain/);
  });

  it('explains that a work email is required', () => {
    expect(intakePageSrc).toMatch(/work email is required/i);
  });

  it('does not auto-email the respondent', () => {
    expect(intakePageSrc).not.toMatch(/sendEmail|send_email|email.*send/i);
  });

  it('follows the phase flow: intake → intro → section → review → submit → complete', () => {
    expect(intakePageSrc).toMatch(/'intake'/);
    expect(intakePageSrc).toMatch(/'intro'/);
    expect(intakePageSrc).toMatch(/'section'/);
    expect(intakePageSrc).toMatch(/'review'/);
    expect(intakePageSrc).toMatch(/'submitting'/);
    expect(intakePageSrc).toMatch(/'complete'/);
  });

  it('does not expose scoring, permissions, or owner IDs', () => {
    expect(intakePageSrc).not.toMatch(/scoring_enabled|recommendations_enabled|owner_type|owner_profile_id|generating_user_id/);
  });

  it('uses assessment-specific intro configuration', () => {
    expect(intakePageSrc).toMatch(/introduction_text|respondent_intro_text/);
  });
});

// ============================================================
// Reusable links management page
// ============================================================

describe('Reusable links management page', () => {
  it('allows generating links', () => {
    expect(linksPageSrc).toMatch(/handleGenerate/);
  });

  it('allows copying links', () => {
    expect(linksPageSrc).toMatch(/handleCopy/);
    expect(linksPageSrc).toMatch(/navigator\.clipboard/);
  });

  it('allows labeling links', () => {
    expect(linksPageSrc).toMatch(/label/);
  });

  it('allows setting expiration', () => {
    expect(linksPageSrc).toMatch(/expires_at/);
  });

  it('allows activate/deactivate', () => {
    expect(linksPageSrc).toMatch(/handleToggleActive/);
  });

  it('shows submission count', () => {
    expect(linksPageSrc).toMatch(/submission_count/);
  });

  it('restricts non-superadmins to their own links', () => {
    expect(linksPageSrc).toMatch(/isSuperadmin/);
    expect(linksPageSrc).toMatch(/fetchReusableLinks/);
  });
});

// ============================================================
// Employee-count picklist replacement
// ============================================================

describe('Employee-count picklist replacement', () => {
  it('NewClientPage uses integer input for employee count', () => {
    expect(newClientSrc).toMatch(/type="number"/);
    expect(newClientSrc).toMatch(/employee_count/);
    expect(newClientSrc).not.toMatch(/EMPLOYEE_RANGES/);
    expect(newClientSrc).not.toMatch(/employee_count_range/);
  });

  it('ClientDetailPage shows employee_count with fallback to range', () => {
    expect(clientDetailSrc).toMatch(/employee_count/);
    expect(clientDetailSrc).toMatch(/employee_count_range/);
    expect(clientDetailSrc).toMatch(/employee_count_needs_confirmation/);
  });

  it('ClientsPage shows employee_count with fallback to range', () => {
    expect(clientsPageSrc).toMatch(/employee_count/);
  });
});

// ============================================================
// Existing flow preservation
// ============================================================

describe('Existing flow preservation', () => {
  it('AssessmentsPage still has Send assessment button', () => {
    expect(assessmentsPageSrc).toMatch(/Send assessment/);
    expect(assessmentsPageSrc).toMatch(/\/assessments\/send/);
  });

  it('AssessmentsPage adds Intake Links button', () => {
    expect(assessmentsPageSrc).toMatch(/Intake Links/);
    expect(assessmentsPageSrc).toMatch(/\/assessments\/links/);
  });

  it('App.tsx has both /assessments/send and /assessments/links routes', () => {
    expect(appSrc).toMatch(/path="\/assessments\/send"/);
    expect(appSrc).toMatch(/path="\/assessments\/links"/);
  });

  it('App.tsx has /intake/:token route for public flow', () => {
    expect(appSrc).toMatch(/path="\/intake\/:token"/);
  });

  it('App.tsx preserves /assessment/:token route', () => {
    expect(appSrc).toMatch(/path="\/assessment\/:token"/);
  });
});
