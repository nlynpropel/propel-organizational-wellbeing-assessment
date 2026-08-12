import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const authContextSrc = readFileSync(resolve('src/context/AuthContext.tsx'), 'utf-8');
const loginPageSrc = readFileSync(resolve('src/pages/LoginPage.tsx'), 'utf-8');
const callbackSrc = readFileSync(resolve('src/pages/AuthCallbackPage.tsx'), 'utf-8');
const accountSetupSrc = readFileSync(resolve('src/pages/NewAccountPage.tsx'), 'utf-8');
const csmMigrationSrc = readFileSync(
  resolve('supabase/migrations/20260812151500_fix_propel_csm_membership.sql'),
  'utf-8'
);

describe('self-service signup profile data', () => {
  it('collects first and last name on the signup form', () => {
    expect(loginPageSrc).toMatch(/First name/);
    expect(loginPageSrc).toMatch(/Last name/);
    expect(loginPageSrc).toMatch(/signUp\(email, password, firstName, lastName\)/);
  });

  it('sends names as Supabase user metadata', () => {
    expect(authContextSrc).toMatch(/first_name:\s*firstName\.trim\(\)/);
    expect(authContextSrc).toMatch(/last_name:\s*lastName\.trim\(\)/);
  });

  it('prefills the post-confirmation setup form from the profile', () => {
    expect(accountSetupSrc).toMatch(/profile\?\.first_name/);
    expect(accountSetupSrc).toMatch(/profile\?\.last_name/);
  });
});

describe('branded email confirmation', () => {
  it('supports token-hash verification on the app callback', () => {
    expect(callbackSrc).toMatch(/token_hash/);
    expect(callbackSrc).toMatch(/verifyOtp/);
    expect(callbackSrc).toMatch(/EmailOtpType/);
  });

  it('directs signup back to the branded app callback', () => {
    expect(authContextSrc).toMatch(/emailRedirectTo/);
    expect(authContextSrc).toMatch(/\/auth\/callback/);
  });
});

describe('Propel Client Services authorization', () => {
  it('maps Propel-domain self-service users to propel_csm', () => {
    expect(csmMigrationSrc).toMatch(/propelwellness\.com/);
    expect(csmMigrationSrc).toMatch(/v_role := 'propel_csm'/);
  });

  it('gives CSMs an active client_manager membership, not platform admin', () => {
    expect(csmMigrationSrc).toMatch(/'client_manager', 'active'/);
    expect(csmMigrationSrc).toMatch(/'client_manager', 'manage_clients'/);
    expect(csmMigrationSrc).not.toMatch(/VALUES \(v_org_id, NEW\.id, 'platform_admin'/);
  });

  it('backfills existing propel_csm users into the Propel organization', () => {
    expect(csmMigrationSrc).toMatch(/WHERE p\.role = 'propel_csm'/);
    expect(csmMigrationSrc).toMatch(/ON CONFLICT \(profile_id\) DO UPDATE/);
  });
});
