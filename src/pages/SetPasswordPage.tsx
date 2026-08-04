import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2, CheckCircle2, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { completeAccountSetup } from '../services/profiles';
import type { AverageClientSize } from '../lib/database.types';

const clientSizeOptions: { value: AverageClientSize; label: string; hint: string }[] = [
  { value: 'small', label: 'Small', hint: 'Under 100 employees' },
  { value: 'mid', label: 'Mid-market', hint: '100–1,000 employees' },
  { value: 'large', label: 'Large', hint: '1,000+ employees' },
];

export default function SetPasswordPage() {
  const navigate = useNavigate();
  const { user, profile, updatePassword, refreshProfile, signOut } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const needsProfileSetup =
    !profile?.account_setup_complete && profile?.role === 'broker';

  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [lastName, setLastName] = useState(profile?.last_name ?? '');
  const [clientSize, setClientSize] = useState<AverageClientSize | ''>('');
  const [territory, setTerritory] = useState('');

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
    try {
      const { error: pwError } = await updatePassword(password);
      if (pwError) throw new Error(pwError);

      if (needsProfileSetup) {
        if (!clientSize) {
          setError('Please select your average client size.');
          setSubmitting(false);
          return;
        }
        await completeAccountSetup({
          first_name: firstName,
          last_name: lastName,
          average_client_size: clientSize,
          territory,
        });
      }

      await refreshProfile();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set password. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy auth-radial flex flex-col">
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg">
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
              <h1 className="font-display text-2xl font-semibold text-navy">Set your password</h1>
            </div>
            <p className="text-sm text-neutral-secondary mt-2 ml-[52px]">
              You were invited to Propel. Choose a password to activate your account
              {needsProfileSetup ? ' and complete your profile' : ''}.
            </p>

            {user?.email && (
              <p className="text-xs text-neutral-muted mt-3 ml-[52px]">
                Signed in as <span className="font-medium text-navy">{user.email}</span>
              </p>
            )}

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

              {needsProfileSetup && (
                <div className="space-y-4 pt-2 border-t border-neutral-border">
                  <p className="text-sm font-medium text-navy pt-2">Complete your profile</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-navy mb-1.5">First name</label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-sm border border-neutral-border bg-white text-navy placeholder-neutral-muted focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-navy mb-1.5">Last name</label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-sm border border-neutral-border bg-white text-navy placeholder-neutral-muted focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-navy mb-1.5">Average client size</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {clientSizeOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setClientSize(opt.value)}
                          className={`text-left rounded-md border p-3 transition ${
                            clientSize === opt.value
                              ? 'border-green bg-green-tint ring-2 ring-green/20'
                              : 'border-neutral-border bg-white hover:border-navy/20'
                          }`}
                        >
                          <span className="block text-sm font-semibold text-navy">{opt.label}</span>
                          <span className="block text-xs text-neutral-muted mt-0.5">{opt.hint}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-navy mb-1.5">Territory / Region</label>
                    <input
                      type="text"
                      value={territory}
                      onChange={(e) => setTerritory(e.target.value)}
                      placeholder="e.g. Northeast, Texas, Pacific Northwest"
                      className="w-full px-3 py-2.5 rounded-sm border border-neutral-border bg-white text-navy placeholder-neutral-muted focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20 transition"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-navy hover:bg-navy-mid disabled:opacity-60 text-white font-medium py-2.5 rounded-sm transition"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Setting password…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Activate account
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="text-center mt-6">
            <button
              onClick={signOut}
              className="text-sm text-white/50 hover:text-white/80 transition"
            >
              Sign out
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
