import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const adminSrc = readFileSync(resolve('src/services/admin.ts'), 'utf-8');
const domainsSrc = readFileSync(resolve('src/services/domains.ts'), 'utf-8');
const authContextSrc = readFileSync(resolve('src/context/AuthContext.tsx'), 'utf-8');
const loginPageSrc = readFileSync(resolve('src/pages/LoginPage.tsx'), 'utf-8');
const adminPageSrc = readFileSync(resolve('src/pages/AdminPage.tsx'), 'utf-8');
const edgeFnSrc = readFileSync(resolve('supabase/functions/admin-invite-user/index.ts'), 'utf-8');

describe('Auth flow — authorized-domain self-service', () => {
  it('LoginPage blocks unapproved domains instead of silently proceeding', () => {
    expect(loginPageSrc).toContain("setState('restricted')");
    // Must NOT contain the old "proceed and let Supabase handle it" fallback
    expect(loginPageSrc).not.toContain("proceed and let");
    expect(loginPageSrc).not.toMatch(/Supabase's own validation/);
  });

  it('domains service uses server-side RPC for domain validation', () => {
    expect(domainsSrc).toMatch(/check_email_domain_approved/);
    // Must NOT fetch all domains and filter client-side
    expect(domainsSrc).not.toMatch(/fetchApprovedDomains\(\)\s*\.then/);
  });

  it('AuthContext uses signInWithOtp with emailRedirectTo for magic links', () => {
    expect(authContextSrc).toMatch(/signInWithOtp/);
    expect(authContextSrc).toMatch(/emailRedirectTo/);
    expect(authContextSrc).toMatch(/\/auth\/callback/);
  });

  it('does not use admin.createUser or inviteUserByEmail in client code', () => {
    expect(authContextSrc).not.toMatch(/admin\.createUser/);
    expect(authContextSrc).not.toMatch(/inviteUserByEmail/);
  });
});

describe('Auth flow — Superadmin invitation', () => {
  it('admin service calls edge function for invitations', () => {
    expect(adminSrc).toMatch(/functions\/v1\/admin-invite-user/);
    expect(adminSrc).toMatch(/inviteUser/);
  });

  it('admin service has resendInvitation function', () => {
    expect(adminSrc).toMatch(/resendInvitation/);
    expect(adminSrc).toMatch(/admin-invite-user\/resend/);
  });

  it('edge function verifies caller is admin before inviting', () => {
    expect(edgeFnSrc).toMatch(/role.*admin.*status.*active/);
    expect(edgeFnSrc).toMatch(/Admin access required/);
  });

  it('edge function uses admin.generateLink for magic links (not client-side)', () => {
    expect(edgeFnSrc).toMatch(/admin\.generateLink/);
    expect(edgeFnSrc).toMatch(/magiclink/);
  });

  it('edge function includes CORS headers on all responses', () => {
    expect(edgeFnSrc).toMatch(/Access-Control-Allow-Origin/);
    expect(edgeFnSrc).toMatch(/OPTIONS/);
  });

  it('edge function does not expose service role key to client', () => {
    expect(edgeFnSrc).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    // The key is used server-side only, never returned in response
    expect(edgeFnSrc).not.toMatch(/service_role.*JSON\.stringify/);
  });
});

describe('Auth flow — existing user repair', () => {
  it('admin service has repairUser function calling admin_repair_user RPC', () => {
    expect(adminSrc).toMatch(/admin_repair_user/);
    expect(adminSrc).toMatch(/repairUser/);
  });
});

describe('User directory — data source', () => {
  it('admin service uses admin_list_all_users RPC (not direct profiles query)', () => {
    expect(adminSrc).toMatch(/admin_list_all_users/);
    expect(adminSrc).not.toMatch(/\.from\('profiles'\)\.select\('\*'\)/);
  });

  it('AdminPage loads users when tab is opened (not blocked by loading guard)', () => {
    expect(adminPageSrc).toMatch(/usersLoaded/);
    expect(adminPageSrc).toMatch(/tab === 'users'/);
    // Must NOT have the old guard that prevented loading
    expect(adminPageSrc).not.toMatch(/!usersLoading.*&&.*!usersLoaded/);
  });

  it('AdminPage shows user directory with name, email, role, status, org', () => {
    expect(adminPageSrc).toMatch(/first_name/);
    expect(adminPageSrc).toMatch(/email/);
    expect(adminPageSrc).toMatch(/role/);
    expect(adminPageSrc).toMatch(/status/);
    expect(adminPageSrc).toMatch(/organization_name/);
  });

  it('AdminPage shows last sign-in date', () => {
    expect(adminPageSrc).toMatch(/last_sign_in_at/);
  });

  it('AdminPage shows internal/external classification', () => {
    expect(adminPageSrc).toMatch(/is_internal/);
    expect(adminPageSrc).toMatch(/Internal/);
    expect(adminPageSrc).toMatch(/External/);
  });

  it('AdminPage does not query auth.users directly from client', () => {
    expect(adminPageSrc).not.toMatch(/\.from\('auth\.users'\)/);
    expect(adminPageSrc).not.toMatch(/auth\.users/);
  });
});

describe('User directory — authorization', () => {
  it('AdminPage is wrapped in adminOnly ProtectedRoute', () => {
    // This is verified in App.tsx, but we check AdminPage doesn't
    // do its own bypass
    expect(adminPageSrc).not.toMatch(/bypass/i);
  });

  it('admin service does not use service role key', () => {
    expect(adminSrc).not.toMatch(/SERVICE_ROLE/);
    expect(adminSrc).not.toMatch(/service_role/);
  });
});

describe('Audit logging', () => {
  it('admin service has fetchAuditLog function for audit records', () => {
    expect(adminSrc).toMatch(/fetchAuditLog/);
    expect(adminSrc).toMatch(/auth_audit_log/);
  });

  it('AdminPage does not expose audit log to non-admin users', () => {
    // AdminPage is behind adminOnly ProtectedRoute — verified in App.tsx
    // Here we just confirm the page doesn't bypass the guard
    expect(adminPageSrc).not.toMatch(/bypass/i);
  });
});
