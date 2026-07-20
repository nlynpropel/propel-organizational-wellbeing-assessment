import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { fetchProfile } from '../services/profiles';
import type { ProfileRow, ProfileRole, ProfileStatus } from '../lib/database.types';

type AuthError = string | null;

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  role: ProfileRole | null;
  status: ProfileStatus | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  // Existing email/password flow (preserved for backward compatibility)
  signUp: (email: string, password: string) => Promise<{ error: AuthError }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError }>;
  // Magic-link flow
  sendMagicLink: (email: string) => Promise<{ error: AuthError }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) {
        setLoading(false);
      }
      // If session exists, profile loading happens in the onAuthStateChange handler
    });

    // onAuthStateChange callback runs synchronously; wrap async work to avoid deadlock.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setProfile(null);
      if (newSession?.user) {
        (async () => {
          try {
            const p = await fetchProfile(newSession.user.id);
            setProfile(p);
          } catch {
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

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const sendMagicLink = async (email: string) => {
    // In the Bolt preview / local dev environment, window.location.origin is a
    // localhost URL. Sending that as emailRedirectTo makes Supabase redirect the
    // magic link back to localhost, which the user's email client can't reach.
    // Instead, omit emailRedirectTo so Supabase falls back to its configured
    // Site URL (the live deployment URL). On a real deployed origin we pass it
    // through so deep-linking to /auth/callback still works.
    const origin = window.location.origin;
    const isLocalhost = origin.startsWith('http://localhost') || origin.startsWith('https://localhost');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: isLocalhost ? {} : { emailRedirectTo: `${origin}/auth/callback` },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const refreshProfile = async () => {
    const uid = session?.user?.id;
    if (!uid) return;
    try {
      const p = await fetchProfile(uid);
      setProfile(p);
    } catch {
      setProfile(null);
    }
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
        refreshProfile,
        signUp,
        signIn,
        sendMagicLink,
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
