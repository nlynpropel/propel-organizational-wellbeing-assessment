import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2, CheckCircle2, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function UpdatePasswordPage() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await updatePassword(password);
    setSubmitting(false);

    if (updateError) {
      setError(updateError);
    } else {
      setDone(true);
      setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-navy auth-radial flex items-center justify-center px-6">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-full bg-green-tint flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-green-dark" />
          </div>
          <h1 className="text-xl font-semibold text-navy">Password updated</h1>
          <p className="text-sm text-neutral-secondary mt-2">
            Your password has been changed. Taking you to your dashboard…
          </p>
        </div>
      </div>
    );
  }

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
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-green-tint flex items-center justify-center">
                <Lock className="w-5 h-5 text-green-dark" />
              </div>
              <h1 className="font-display text-2xl font-semibold text-navy">Update password</h1>
            </div>
            <p className="text-sm text-neutral-secondary mt-2 ml-[52px]">
              Choose a new password for your account.
            </p>

            {error && (
              <div className="mt-5 rounded-md border border-red/20 bg-red-tint px-4 py-3 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red shrink-0 mt-0.5" />
                <p className="text-sm text-red">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-navy mb-1.5">New password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full px-3 py-2.5 pr-10 rounded-sm border border-neutral-border bg-white text-navy placeholder-neutral-muted focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20 transition"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-muted hover:text-navy transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-navy mb-1.5">Confirm password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="w-full px-3 py-2.5 rounded-sm border border-neutral-border bg-white text-navy placeholder-neutral-muted focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20 transition"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-navy hover:bg-navy-mid disabled:opacity-60 text-white font-medium py-2.5 rounded-sm transition"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Update password
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
