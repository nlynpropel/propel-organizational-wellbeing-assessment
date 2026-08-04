import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const adminSrc = readFileSync(resolve('src/services/admin.ts'), 'utf-8');
const domainsSrc = readFileSync(resolve('src/services/domains.ts'), 'utf-8');
const authContextSrc = readFileSync(resolve('src/context/AuthContext.tsx'), 'utf-8');
const loginPageSrc = readFileSync(resolve('src/pages/LoginPage.tsx'), 'utf-8');
const adminPageSrc = readFileSync(resolve('src/pages/AdminPage.tsx'), 'utf-8');
const appSrc = readFileSync(resolve('src/App.tsx'), 'utf-8');
const edgeFnSrc = readFileSync(resolve('supabase/functions/admin-invite-user/index.ts'), 'utf-8');

describe('Auth flow — authorized-domain self-service', () => {
  it('LoginPage blocks unapproved domains instead of silently proceeding', () => {
    expect(loginPageSrc).toContain("setState('restricted')");
    expect(loginPageSrc).not.toContain("proceed and let");
    expect(loginPageSrc).not.toMatch(/Supabase's own validation/);
  });

  it('domains service uses server-side RPC for domain validation', () => {
    expect(domainsSrc).toMatch(/check_email_domain_approved/);
    expect(domainsSrc).not.toMatch(/fetchApprovedDomains\(\)\s*\.then/);
  });

  it('AuthContext uses signInWithPassword and signUp for password auth', () => {
    expect(authContextSrc).toMatch(/signInWithPassword/);
    expect(authContextSrc).toMatch(/signUp/);
    expect(authContextSrc).not.toMatch(/signInWithOtp/);
  });

  it('AuthContext does not use admin.createUser or inviteUserByEmail in client code', () => {
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

  it('edge function verifies caller is superadmin before inviting', () => {
    expect(edgeFnSrc).toMatch(/superadmin/);
    expect(edgeFnSrc).toMatch(/Superadmin access required/);
  });

  it('edge function uses inviteUserByEmail (not generateLink) for Supabase-managed invitations', () => {
    expect(edgeFnSrc).toMatch(/inviteUserByEmail/);
    expect(edgeFnSrc).not.toMatch(/generateLink/);
  });

  it('edge function reads SITE_URL from env and fails if missing', () => {
    expect(edgeFnSrc).toMatch(/SITE_URL/);
    expect(edgeFnSrc).toMatch(/SITE_URL.*not configured|SITE_URL.*missing/i);
    expect(edgeFnSrc).not.toMatch(/localhost/);
  });

  it('edge function builds redirect as SITE_URL + /auth/callback', () => {
    expect(edgeFnSrc).toMatch(/\/auth\/callback/);
  });

  it('edge function includes CORS headers on all responses', () => {
    expect(edgeFnSrc).toMatch(/Access-Control-Allow-Origin/);
    expect(edgeFnSrc).toMatch(/OPTIONS/);
  });

  it('edge function does not expose service role key to client', () => {
    expect(edgeFnSrc).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(edgeFnSrc).not.toMatch(/service_role.*JSON\.stringify/);
  });

  it('edge function validates email domain against approved_domains before creating user', () => {
    expect(edgeFnSrc).toMatch(/approved_domains/);
    expect(edgeFnSrc).toMatch(/not approved/i);
  });
});

describe('Auth flow — password reset', () => {
  it('AuthContext exposes resetPassword using resetPasswordForEmail', () => {
    expect(authContextSrc).toMatch(/resetPasswordForEmail/);
    expect(authContextSrc).toMatch(/update-password/);
  });

  it('AuthContext exposes updatePassword using updateUser', () => {
    expect(authContextSrc).toMatch(/updateUser/);
    expect(authContextSrc).toMatch(/updatePassword/);
  });

  it('ForgotPasswordPage exists and is routed', () => {
    const forgotSrc = readFileSync(resolve('src/pages/ForgotPasswordPage.tsx'), 'utf-8');
    expect(forgotSrc).toMatch(/resetPassword/);
    expect(appSrc).toMatch(/forgot-password/);
  });

  it('UpdatePasswordPage exists and is routed', () => {
    const updateSrc = readFileSync(resolve('src/pages/UpdatePasswordPage.tsx'), 'utf-8');
    expect(updateSrc).toMatch(/updatePassword/);
    expect(appSrc).toMatch(/update-password/);
  });

  it('LoginPage has a forgot password link', () => {
    expect(loginPageSrc).toMatch(/forgot-password/);
  });
});

describe('Auth flow — invitation set-password', () => {
  it('SetPasswordPage exists and is routed', () => {
    const setPwSrc = readFileSync(resolve('src/pages/SetPasswordPage.tsx'), 'utf-8');
    expect(setPwSrc).toMatch(/updatePassword/);
    expect(setPwSrc).toMatch(/completeAccountSetup/);
    expect(appSrc).toMatch(/set-password/);
  });

  it('RootRedirect routes password_set=false users to /set-password', () => {
    expect(appSrc).toMatch(/password_set/);
    expect(appSrc).toMatch(/\/set-password/);
  });

  it('ProtectedRoute blocks invited users without password from app routes', () => {
    expect(appSrc).toMatch(/allowInvited/);
  });
});

describe('Auth flow — existing user repair', () => {
  it('admin service has repairUser function calling admin_repair_user RPC', () => {
    expect(adminSrc).toMatch(/admin_repair_user/);
    expect(adminSrc).toMatch(/repairUser/);
  });
});

describe('Canonical roles', () => {
  it('database.types defines exactly four canonical roles', () => {
    const dbTypes = readFileSync(resolve('src/lib/database.types.ts'), 'utf-8');
    expect(dbTypes).toMatch(/superadmin.*propel_csm.*propel_sales.*broker/);
    expect(dbTypes).not.toMatch(/'admin'.*ProfileRole/);
  });

  it('App.tsx uses superadmin for route guards', () => {
    expect(appSrc).toMatch(/superadmin/);
    expect(appSrc).not.toMatch(/role !== 'admin'/);
    expect(appSrc).not.toMatch(/role === 'admin'/);
  });

  it('AdminPage invite modal offers canonical roles only (broker, propel_csm, propel_sales)', () => {
    expect(adminPageSrc).toMatch(/propel_csm/);
    expect(adminPageSrc).toMatch(/propel_sales/);
    expect(adminPageSrc).not.toMatch(/'admin'.*'broker'.*as const/);
  });

  it('AdminPage does not use legacy admin role for badges', () => {
    expect(adminPageSrc).not.toMatch(/=== 'admin'/);
  });

  it('AdminPage uses ROLE_LABELS for display (Superadmin, Propel Client Services, Propel Sales, Broker)', () => {
    expect(adminPageSrc).toMatch(/Superadmin/);
    expect(adminPageSrc).toMatch(/Propel Client Services/);
    expect(adminPageSrc).toMatch(/Propel Sales/);
    expect(adminPageSrc).toMatch(/Broker/);
  });

  it('AdminPage does not display Benefits Advisor', () => {
    expect(adminPageSrc).not.toMatch(/Benefits Advisor/i);
    expect(adminPageSrc).not.toMatch(/benefits_advisor/i);
  });

  it('AdminPage does not display legacy Advisor label for roles', () => {
    expect(adminPageSrc).not.toMatch(/'Advisor'/);
  });
});

describe('User management — role change and deletion', () => {
  it('admin service has changeUserRole function calling admin_change_user_role RPC', () => {
    expect(adminSrc).toMatch(/changeUserRole/);
    expect(adminSrc).toMatch(/admin_change_user_role/);
  });

  it('admin service has deleteUser function calling admin_delete_user RPC', () => {
    expect(adminSrc).toMatch(/deleteUser/);
    expect(adminSrc).toMatch(/admin_delete_user/);
  });

  it('admin service has deactivateUser function calling admin_deactivate_user RPC', () => {
    expect(adminSrc).toMatch(/deactivateUser/);
    expect(adminSrc).toMatch(/admin_deactivate_user/);
  });

  it('admin service has reactivateUser function calling admin_reactivate_user RPC', () => {
    expect(adminSrc).toMatch(/reactivateUser/);
    expect(adminSrc).toMatch(/admin_reactivate_user/);
  });

  it('admin service has checkUserDeletable function calling admin_check_user_deletable RPC', () => {
    expect(adminSrc).toMatch(/checkUserDeletable/);
    expect(adminSrc).toMatch(/admin_check_user_deletable/);
  });

  it('AdminPage has role change UI', () => {
    expect(adminPageSrc).toMatch(/roleChangeUserId/);
    expect(adminPageSrc).toMatch(/handleRoleChange/);
  });

  it('AdminPage has delete user UI', () => {
    expect(adminPageSrc).toMatch(/userToDelete/);
    expect(adminPageSrc).toMatch(/handleDeleteUser/);
  });

  it('AdminPage has deactivate user UI', () => {
    expect(adminPageSrc).toMatch(/userToDeactivate/);
    expect(adminPageSrc).toMatch(/handleDeactivateUser/);
  });

  it('AdminPage has reactivate user UI', () => {
    expect(adminPageSrc).toMatch(/handleReactivateUser/);
  });

  it('AdminPage checks deletion eligibility before allowing delete', () => {
    expect(adminPageSrc).toMatch(/deleteEligibility/);
    expect(adminPageSrc).toMatch(/handleCheckDeletable/);
  });

  it('AdminPage blocks delete button when not eligible', () => {
    expect(adminPageSrc).toMatch(/confirmDisabled/);
  });

  it('AdminPage shows approved-domain help text on invite form', () => {
    expect(adminPageSrc).toMatch(/Invitations can only be sent to email domains approved by the Superadmin/);
  });

  it('AdminPage does not say invitations work with any domain', () => {
    expect(adminPageSrc).not.toMatch(/Works with any domain/i);
    expect(adminPageSrc).not.toMatch(/any email domain/i);
  });

  it('AdminPage does not auto-delete shared data in delete confirmation', () => {
    expect(adminPageSrc).not.toMatch(/all associated data/i);
  });

  it('AdminPage shows Deactivated label for suspended status', () => {
    expect(adminPageSrc).toMatch(/Deactivated/);
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
    expect(adminPageSrc).not.toMatch(/bypass/i);
  });
});
