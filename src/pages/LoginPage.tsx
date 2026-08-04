import { useState, type FormEvent } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Lock, Mail, AlertTriangle, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isEmailDomainApproved } from '../services/domains';

type LoginState = 'idle' | 'restricted' | 'error';

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const errorParam = params.get('error');

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [state, setState] = useState<LoginState>(errorParam === 'expired' || errorParam === 'invalid' ? 'error' : 'idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setInfoMsg(null);
    setState('idle');

    // Validate email domain is on the approved list before proceeding.
    try {
      const approved = await isEmailDomainApproved(email);
      if (!approved) {
        setState('restricted');
        setSubmitting(false);
        return;
      }
    } catch {
      setState('restricted');
      setErrorMsg('Could not verify your email domain. Please try again or contact your administrator.');
      setSubmitting(false);
      return;
    }

    if (mode === 'signup') {
      const { error } = await signUp(email, password);
      setSubmitting(false);
      if (error) {
        setErrorMsg(error);
        setState('error');
      } else {
        setInfoMsg('Account created. You can now sign in.');
        setMode('signin');
        setPassword('');
      }
    } else {
      const { error } = await signIn(email, password);
      setSubmitting(false);
      if (error) {
        setErrorMsg(error);
        setState('error');
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  };

  const switchMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setState('idle');
    setErrorMsg(null);
    setInfoMsg(null);
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
            <h1 className="font-display text-2xl font-semibold text-navy">
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </h1>
            <p className="text-sm text-neutral-secondary mt-1.5">
              {mode === 'signin'
                ? 'Enter your work email and password to access the platform.'
                : 'Enter your work email and choose a password to get started.'}
            </p>

            {state === 'restricted' && (
              <StateBanner
                icon={Lock}
                variant="warning"
                title="Access restricted"
                message="This email isn't on the approved list. Contact your Propel administrator if you believe this is an error."
              />
            )}
            {state === 'error' && errorMsg && (
              <StateBanner
                icon={AlertTriangle}
                variant="danger"
                title="Couldn't sign in"
                message={errorMsg}
              />
            )}
            {infoMsg && (
              <div className="mt-5 rounded-md border border-green/25 bg-green-tint px-4 py-3">
                <p className="text-sm text-green-dark">{infoMsg}</p>
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

              <div>
                <label className="block text-sm font-medium text-navy mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-muted" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-3 py-2.5 rounded-sm border border-neutral-border bg-white text-navy placeholder-neutral-muted focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-navy hover:bg-navy-mid disabled:opacity-60 text-white font-medium py-2.5 rounded-sm transition"
              >
                {submitting
                  ? (mode === 'signin' ? 'Signing in…' : 'Creating account…')
                  : (mode === 'signin' ? 'Sign in' : 'Create account')}
                {!submitting && (mode === 'signin' ? <ArrowRight className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />)}
              </button>
            </form>

            <div className="mt-5 text-center space-y-2">
              {mode === 'signin' && (
                <Link
                  to="/forgot-password"
                  className="block text-sm text-neutral-secondary hover:text-navy transition"
                >
                  Forgot password?
                </Link>
              )}
              <button
                onClick={switchMode}
                className="text-sm text-neutral-secondary hover:text-navy transition"
              >
                {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-white/40 mt-8">
            Access is limited to approved organizations.
          </p>
        </div>
      </div>
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
