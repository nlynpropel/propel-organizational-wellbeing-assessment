import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const clientDetailSrc = readFileSync(resolve('src/pages/ClientDetailPage.tsx'), 'utf-8');
const sendAssessmentSrc = readFileSync(resolve('src/pages/SendAssessmentPage.tsx'), 'utf-8');
const assessmentsPageSrc = readFileSync(resolve('src/pages/AssessmentsPage.tsx'), 'utf-8');

describe('Client-detail assessment send flow — button labels', () => {
  it('shows "Send an Assessment" when client has no instances', () => {
    expect(clientDetailSrc).toMatch(/instances\.length === 0 \? 'Send an Assessment' : 'Send Another Assessment'/);
  });

  it('shows "Send Another Assessment" when client has at least one instance', () => {
    expect(clientDetailSrc).toMatch(/Send Another Assessment/);
  });

  it('does not use a static "Send another assessment" label', () => {
    expect(clientDetailSrc).not.toMatch(/'Send another assessment'/);
  });

  it('does not use a static "Send assessment" label', () => {
    expect(clientDetailSrc).not.toMatch(/'Send assessment'/);
  });
});

describe('Client-detail assessment send flow — client context routing', () => {
  it('all send links from ClientDetailPage use clientId param', () => {
    expect(clientDetailSrc).not.toMatch(/\?org=/);
    expect(clientDetailSrc).toMatch(/assessments\/send\?clientId=/);
  });

  it('SendAssessmentPage reads clientId from query params', () => {
    expect(sendAssessmentSrc).toMatch(/searchParams\.get\('clientId'\)/);
  });

  it('SendAssessmentPage imports useSearchParams', () => {
    expect(sendAssessmentSrc).toMatch(/useSearchParams/);
  });

  it('AssessmentsPage general flow does not pass clientId', () => {
    expect(assessmentsPageSrc).toMatch(/to="\/assessments\/send"/);
    expect(assessmentsPageSrc).not.toMatch(/clientId/);
  });
});

describe('Client-detail assessment send flow — send page behavior', () => {
  it('fetches the organization by clientId on load', () => {
    expect(sendAssessmentSrc).toMatch(/fetchOrganizationById/);
  });

  it('preselects the client when clientId is valid', () => {
    expect(sendAssessmentSrc).toMatch(/setSelectedOrg\(org\)/);
  });

  it('shows error when clientId is invalid or unauthorized', () => {
    expect(sendAssessmentSrc).toMatch(/could not be found or you are not authorized/);
  });

  it('displays the selected client name clearly', () => {
    expect(sendAssessmentSrc).toMatch(/Selected client/);
    expect(sendAssessmentSrc).toMatch(/selectedOrg\.organization_name/);
  });

  it('hides the client selector when client is preselected', () => {
    expect(sendAssessmentSrc).toMatch(/hasClientContext/);
    expect(sendAssessmentSrc).toMatch(/!\s*hasClientContext/);
  });

  it('allows changing the client via Change client button', () => {
    expect(sendAssessmentSrc).toMatch(/Change client/);
  });

  it('still requires explicit assessment selection when multiple assessments exist', () => {
    expect(sendAssessmentSrc).toMatch(/assessments\.length > 1/);
  });

  it('auto-selects when only one accessible assessment exists', () => {
    expect(sendAssessmentSrc).toMatch(/accessibleAssessments\.length === 1/);
  });
});

describe('Client-detail assessment send flow — authorization handling', () => {
  it('does not create an instance until the final send action', () => {
    expect(sendAssessmentSrc).toMatch(/handleCreateInstance/);
    // The createAssessmentInstance call must be inside handleCreateInstance, not at module level
    const handleCreateMatch = sendAssessmentSrc.match(/handleCreateInstance[\s\S]*?createAssessmentInstance/);
    expect(handleCreateMatch).not.toBeNull();
  });

  it('preserves duplicate-click protection via submitting state', () => {
    expect(sendAssessmentSrc).toMatch(/disabled=\{submitting\}/);
  });

  it('passes the selected org id to createAssessmentInstance', () => {
    expect(sendAssessmentSrc).toMatch(/organization_id: selectedOrg\.id/);
  });
});
