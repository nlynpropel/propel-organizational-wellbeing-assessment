import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';

type CallbackStatus = 'completing' | 'expired' | 'no_auth';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<CallbackStatus>('completing');
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const url = new URL(window.location.href);
    const hasError = url.searchParams.has('error');
    const hasErrorDescription = url.searchParams.has('error_description');
    const hasCode = url.searchParams.has('code');
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

    const finish = async () => {
      try {
        // With detectSessionInUrl enabled, supabase-js parses the hash/query
        // and establishes the session automatically on mount. We just verify
        // it landed, then redirect to the root so RootRedirect can route
        // the user to the right place (dashboard, set-password, etc.).
        await new Promise((resolve) => setTimeout(resolve, 200));

        const { data, error } = await supabase.auth.getSession();
        if (cancelled) return;

        if (error || !data.session) {
          setStatus('expired');
          return;
        }

        history.replaceState(null, '', window.location.pathname);
        navigate('/', { replace: true });
      } catch {
        if (!cancelled) setStatus('expired');
      }
    };

    finish();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (status === 'completing') {
    return (
      <div className="min-h-screen bg-navy auth-radial flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-green animate-spin mx-auto mb-4" />
          <p className="text-sm text-white/60">Completing sign in…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy auth-radial flex items-center justify-center px-6">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-full bg-red-tint flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-7 h-7 text-red" />
        </div>
        {status === 'expired' ? (
          <>
            <h1 className="text-xl font-semibold text-navy">Invitation or reset link is invalid or expired</h1>
            <p className="text-sm text-neutral-secondary mt-2">
              This link has expired or already been used. Request a new invitation or password reset to continue.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-navy">No authentication data found</h1>
            <p className="text-sm text-neutral-secondary mt-2">
              You arrived at the authentication callback without the expected parameters.
            </p>
          </>
        )}
        <button
          onClick={() => navigate('/login', { replace: true })}
          className="mt-5 inline-flex items-center bg-navy hover:bg-navy-mid text-white text-sm font-medium px-4 py-2 rounded-sm transition"
        >
          Go to sign in
        </button>
      </div>
    </div>
  );
}
