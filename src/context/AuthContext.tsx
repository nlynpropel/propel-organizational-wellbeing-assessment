import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { fetchProfile } from '../services/profiles';
import {
  fetchUserOrganizations,
  fetchUserCapabilities,
  isPlatformAdmin,
  getPrimaryMembershipRole,
  type UserOrganization,
} from '../services/capabilities';
import type {
  ProfileRow,
  ProfileRole,
  ProfileStatus,
  OrganizationType,
  MembershipRole,
  OrganizationCapability,
} from '../lib/database.types';
import type { TerminologyContext } from '../lib/terminology';

type AuthError = string | null;

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  role: ProfileRole | null;
  status: ProfileStatus | null;
  loading: boolean;
  organizations: UserOrganization[];
  primaryOrganization: UserOrganization | null;
  organizationType: OrganizationType | null;
  membershipRole: MembershipRole | null;
  capabilities: Set<OrganizationCapability>;
  isPlatformAdminUser: boolean;
  terminology: TerminologyContext;
  orgLoadError: boolean;
  refreshProfile: () => Promise<void>;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: AuthError }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError }>;
  resetPassword: (email: string) => Promise<{ error: AuthError }>;
  updatePassword: (password: string) => Promise<{ error: AuthError }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [organizations, setOrganizations] = useState<UserOrganization[]>([]);
  const [capabilities, setCapabilities] = useState<Set<OrganizationCapability>>(new Set());
  const [loading, setLoading] = useState(true);
  const [orgLoadError, setOrgLoadError] = useState(false);

  const loadOrgData = async (userId: string) => {
    try {
      const [orgs, caps] = await Promise.all([
        fetchUserOrganizations(userId),
        fetchUserCapabilities(userId),
      ]);
      setOrganizations(orgs);
      setCapabilities(caps);
      setOrgLoadError(false);
    } catch (err) {
      const route = window.location.pathname;
      console.error('[AuthContext] Organization loading failed', {
        route,
        errorName: err instanceof Error ? err.name : 'Unknown',
        message: err instanceof Error ? err.message : String(err),
      });
      setOrganizations([]);
      setCapabilities(new Set());
      setOrgLoadError(true);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setProfile(null);
      setOrganizations([]);
      setCapabilities(new Set());
      setOrgLoadError(false);
      if (newSession?.user) {
        (async () => {
          try {
            const p = await fetchProfile(newSession.user.id);
            setProfile(p);
            await loadOrgData(newSession.user.id);
          } catch (err) {
            const route = window.location.pathname;
            console.error('[AuthContext] Profile loading failed', {
              route,
              errorName: err instanceof Error ? err.name : 'Unknown',
              message: err instanceof Error ? err.message : String(err),
            });
            setProfile(null);
          } finally {
            setLoading(false);
          }
        })();
      } else {
        setLoading(false);
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    const emailRedirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        },
      },
    });
    return { error: error?.message ?? null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const resetPassword = async (email: string) => {
    const redirectTo = `${window.location.origin}/update-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    return { error: error?.message ?? null };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setOrganizations([]);
    setCapabilities(new Set());
    setOrgLoadError(false);
  };

  const refreshProfile = async () => {
    const uid = session?.user?.id;
    if (!uid) return;
    try {
      const p = await fetchProfile(uid);
      setProfile(p);
      await loadOrgData(uid);
    } catch (err) {
      const route = window.location.pathname;
      console.error('[AuthContext] Profile refresh failed', {
        route,
        errorName: err instanceof Error ? err.name : 'Unknown',
        message: err instanceof Error ? err.message : String(err),
      });
      setProfile(null);
    }
  };

  const primaryOrganization = organizations[0] ?? null;
  const organizationType = primaryOrganization?.organization?.organization_type ?? null;
  const membershipRole = getPrimaryMembershipRole(
    organizations.map((o) => o.membership)
  );
  const isPlatformAdminUser = isPlatformAdmin(
    organizations.map((o) => o.membership)
  );

  const terminology: TerminologyContext = {
    organizationType,
    membershipRole,
    profileRole: profile?.role ?? null,
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        role: profile?.role ?? null,
        status: profile?.status ?? null,
        loading,
        organizations,
        primaryOrganization,
        organizationType,
        membershipRole,
        capabilities,
        isPlatformAdminUser,
        terminology,
        orgLoadError,
        refreshProfile,
        signUp,
        signIn,
        resetPassword,
        updatePassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
