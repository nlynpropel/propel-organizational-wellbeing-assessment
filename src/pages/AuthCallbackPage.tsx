import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Verifying your sign-in link…');

  useEffect(() => {
    // detectSessionInUrl is on; supabase auto-exchanges the token on load.
    // Poll for the session to appear, then route to dashboard.
    let attempts = 0;
    const interval = setInterval(() => {
      attempts += 1;
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          clearInterval(interval);
          setStatus('success');
          setMessage('Sign-in verified. Taking you to your dashboard…');
          setTimeout(() => navigate('/dashboard'), 900);
        } else if (attempts > 12) {
          clearInterval(interval);
          setStatus('error');
          setMessage('This sign-in link is invalid or has expired.');
        }
      });
    }, 400);

    return () => clearInterval(interval);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-navy auth-radial flex items-center justify-center px-6">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
        {status === 'verifying' && (
          <>
            <Loader2 className="w-8 h-8 text-green animate-spin mx-auto mb-4" />
            <h1 className="font-display text-xl font-semibold text-navy">Verifying…</h1>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-14 h-14 rounded-full bg-green-tint flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-green-dark" />
            </div>
            <h1 className="font-display text-xl font-semibold text-navy">Welcome back</h1>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-14 h-14 rounded-full bg-red-tint flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-red" />
            </div>
            <h1 className="font-display text-xl font-semibold text-navy">Link expired</h1>
            <button
              onClick={() => navigate('/login?error=expired')}
              className="mt-5 inline-flex items-center bg-navy hover:bg-navy-mid text-white text-sm font-medium px-4 py-2 rounded-sm transition"
            >
              Request a new link
            </button>
          </>
        )}
        <p className="text-sm text-neutral-secondary mt-2">{message}</p>
      </div>
    </div>
  );
}
