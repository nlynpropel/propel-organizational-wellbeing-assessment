import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Mail, AlertTriangle, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isEmailDomainApproved } from '../services/domains';

type LoginState = 'idle' | 'sent' | 'expired' | 'invalid' | 'restricted' | 'error';

export default function LoginPage() {
  const { sendMagicLink } = useAuth();
  const [params] = useSearchParams();
  const errorParam = params.get('error');

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [state, setState] = useState<LoginState>(errorParam === 'expired' ? 'expired' : errorParam === 'invalid' ? 'invalid' : 'idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    // Validate email domain is on the approved list before sending the link.
    try {
      const approved = await isEmailDomainApproved(email);
      if (!approved) {
        setState('restricted');
        setSubmitting(false);
        return;
      }
    } catch {
      // If the domain check fails (network/permission), proceed and let
      // Supabase's own validation handle it — don't block login on a lookup error.
    }

    const { error } = await sendMagicLink(email);
    setSubmitting(false);
    if (error) {
      if (/rate limit/i.test(error)) {
        setState('restricted');
      } else if (/not.*allow|forbidden|restricted/i.test(error)) {
        setState('restricted');
      } else {
        setErrorMsg(error);
        setState('error');
      }
    } else {
      setState('sent');
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

          {state === 'sent' ? (
            <SentState email={email} onReset={() => { setState('idle'); setEmail(''); }} />
          ) : (
            <div className="bg-white rounded-lg shadow-xl p-8">
              <h1 className="font-display text-2xl font-semibold text-navy">Sign in</h1>
              <p className="text-sm text-neutral-secondary mt-1.5">
                Enter your email and we'll send a secure magic link.
              </p>

              {state === 'restricted' && (
                <StateBanner
                  icon={Lock}
                  variant="warning"
                  title="Access restricted"
                  message="This email isn't on the approved broker list. Contact your Propel administrator if you believe this is an error."
                />
              )}
              {state === 'expired' && (
                <StateBanner
                  icon={AlertTriangle}
                  variant="warning"
                  title="Link expired"
                  message="This magic link has expired. Request a new one below."
                />
              )}
              {state === 'invalid' && (
                <StateBanner
                  icon={AlertTriangle}
                  variant="danger"
                  title="Invalid link"
                  message="This magic link is invalid or has already been used. Request a new one below."
                />
              )}
              {state === 'error' && errorMsg && (
                <StateBanner
                  icon={AlertTriangle}
                  variant="danger"
                  title="Couldn't send link"
                  message={errorMsg}
                />
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
                  {submitting ? 'Sending…' : 'Send Magic Link'}
                  {!submitting && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>

              <p className="text-xs text-neutral-muted mt-5 text-center">
                No password needed. We'll email a one-time sign-in link.
              </p>
            </div>
          )}

          <p className="text-center text-xs text-white/40 mt-8">
            Access is approved to approved organizations.
          </p>
        </div>
      </div>
    </div>
  );
}

function SentState({ email, onReset }: { email: string; onReset: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="bg-white rounded-lg shadow-xl p-8 text-center">
      <div className="w-14 h-14 rounded-full bg-green-tint flex items-center justify-center mx-auto mb-5">
        <CheckCircle2 className="w-7 h-7 text-green-dark" />
      </div>
      <h1 className="font-display text-2xl font-semibold text-navy">Check your email</h1>
      <p className="text-sm text-neutral-secondary mt-2">
        We sent a secure sign-in link to <span className="font-medium text-navy">{email}</span>.
        Click it to sign in.
      </p>
      <div className="mt-6 space-y-2">
        <button
          onClick={onReset}
          className="w-full text-sm text-neutral-secondary hover:text-navy transition py-2"
        >
          Use a different email
        </button>
      </div>
      <p className="text-xs text-neutral-muted mt-5">
        Link expires in 24 hours. Didn't get it? Check spam or try again.
      </p>
    </div>
  );
}

function StateBanner({
  icon: Icon,
  variant,
  title,
  message,
}: {
  icon: typeof AlertTriangle;
  variant: 'warning' | 'danger';
  title: string;
  message: string;
}) {
  const styles =
    variant === 'warning'
      ? 'bg-orange-tint border-orange/25 text-orange'
      : 'bg-red-tint border-red/20 text-red';
  return (
    <div className={`mt-5 rounded-md border px-4 py-3 flex items-start gap-3 ${styles}`}>
      <Icon className="w-5 h-5 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-sm opacity-90 mt-0.5">{message}</p>
      </div>
    </div>
  );
}
