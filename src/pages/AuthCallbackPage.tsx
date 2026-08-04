import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertTriangle, UserX } from 'lucide-react';
import { supabase } from '../lib/supabase';

type CallbackStatus = 'completing' | 'success' | 'expired' | 'no_auth' | 'account_error';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<CallbackStatus>('completing');
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const url = new URL(window.location.href);
    const hasCode = url.searchParams.has('code');
    const hasError = url.searchParams.has('error');
    const hasErrorDescription = url.searchParams.has('error_description');
    const hasFragment = url.hash.length > 1;

    if (hasError || hasErrorDescription) {
      setStatus('expired');
      return;
    }

    if (!hasCode && !hasFragment) {
      setStatus('no_auth');
      return;
    }

    let cancelled = false;
    const timeoutMs = 15000;

    const finish = async () => {
      try {
        // With detectSessionInUrl disabled, we must explicitly exchange the PKCE code.
        // supabase-js handles the code_verifier from sessionStorage automatically.
        const { data, error } = await supabase.auth.exchangeCodeForSession(
          window.location.href,
        );
        if (cancelled) return;

        if (error || !data.session) {
          setStatus('expired');
          return;
        }

        history.replaceState(null, '', window.location.pathname);
        setStatus('success');
        setTimeout(() => navigate('/dashboard', { replace: true }), 600);
      } catch {
        if (!cancelled) setStatus('account_error');
      }
    };

    finish();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-navy auth-radial flex items-center justify-center px-6">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
        {status === 'completing' && (
          <>
            <Loader2 className="w-8 h-8 text-green animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-navy">Completing sign in…</h1>
            <p className="text-sm text-neutral-secondary mt-2">
              Verifying your credentials and loading your account.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-14 h-14 rounded-full bg-green-tint flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-green-dark" />
            </div>
            <h1 className="text-xl font-semibold text-navy">Welcome back</h1>
            <p className="text-sm text-neutral-secondary mt-2">
              Sign-in verified. Taking you to your dashboard…
            </p>
          </>
        )}

        {status === 'expired' && (
          <>
            <div className="w-14 h-14 rounded-full bg-red-tint flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-red" />
            </div>
            <h1 className="text-xl font-semibold text-navy">Sign-in link is invalid or expired</h1>
            <p className="text-sm text-neutral-secondary mt-2">
              This magic link has expired or already been used. Request a new one to continue.
            </p>
            <button
              onClick={() => navigate('/login?error=expired', { replace: true })}
              className="mt-5 inline-flex items-center bg-navy hover:bg-navy-mid text-white text-sm font-medium px-4 py-2 rounded-sm transition"
            >
              Request a new link
            </button>
          </>
        )}

        {status === 'no_auth' && (
          <>
            <div className="w-14 h-14 rounded-full bg-neutral-bg flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-neutral-muted" />
            </div>
            <h1 className="text-xl font-semibold text-navy">No sign-in data found</h1>
            <p className="text-sm text-neutral-secondary mt-2">
              You arrived at the sign-in callback without authentication parameters.
            </p>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="mt-5 inline-flex items-center bg-navy hover:bg-navy-mid text-white text-sm font-medium px-4 py-2 rounded-sm transition"
            >
              Go to sign in
            </button>
          </>
        )}

        {status === 'account_error' && (
          <>
            <div className="w-14 h-14 rounded-full bg-red-tint flex items-center justify-center mx-auto mb-4">
              <UserX className="w-7 h-7 text-red" />
            </div>
            <h1 className="text-xl font-semibold text-navy">We could not load your account</h1>
            <p className="text-sm text-neutral-secondary mt-2">
              Something went wrong while loading your account. Please try again or sign in from the start.
            </p>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="mt-5 inline-flex items-center bg-navy hover:bg-navy-mid text-white text-sm font-medium px-4 py-2 rounded-sm transition"
            >
              Back to sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}
