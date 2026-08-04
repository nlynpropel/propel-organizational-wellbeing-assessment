import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Loader2, ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { error } = await resetPassword(email);
    setSubmitting(false);

    if (error) {
      setError(error);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="min-h-screen bg-navy auth-radial flex flex-col">
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2.5 mb-8">
            <img src="/Propel_Logo_2020_v4-3 copy.png" alt="Propel" className="h-10 w-auto" />
            <div>
              <span className="text-xs text-white/50 block leading-none mt-1">Assessment Engine</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-xl p-8">
            {sent ? (
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-green-tint flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-7 h-7 text-green-dark" />
                </div>
                <h1 className="text-xl font-semibold text-navy">Check your email</h1>
                <p className="text-sm text-neutral-secondary mt-2">
                  We sent a password reset link to <span className="font-medium text-navy">{email}</span>.
                  Click the link in the email to choose a new password.
                </p>
                <button
                  onClick={() => navigate('/login', { replace: true })}
                  className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-navy hover:text-navy-mid transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to sign in
                </button>
              </div>
            ) : (
              <>
                <h1 className="font-display text-2xl font-semibold text-navy">Forgot password</h1>
                <p className="text-sm text-neutral-secondary mt-1.5">
                  Enter your work email and we'll send you a link to reset your password.
                </p>

                {error && (
                  <div className="mt-5 rounded-md border border-red/20 bg-red-tint px-4 py-3 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red shrink-0 mt-0.5" />
                    <p className="text-sm text-red">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-navy mb-1.5">Work email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-muted" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@workemail.com"
                        className="w-full pl-10 pr-3 py-2.5 rounded-sm border border-neutral-border bg-white text-navy placeholder-neutral-muted focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20 transition"
                        autoFocus
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 bg-navy hover:bg-navy-mid disabled:opacity-60 text-white font-medium py-2.5 rounded-sm transition"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Send reset link
                  </button>
                </form>

                <div className="mt-5 text-center">
                  <button
                    onClick={() => navigate('/login', { replace: true })}
                    className="inline-flex items-center gap-1.5 text-sm text-neutral-secondary hover:text-navy transition"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to sign in
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
