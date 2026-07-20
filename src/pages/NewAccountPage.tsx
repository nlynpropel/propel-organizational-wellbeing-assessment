import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, User, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { completeAccountSetup } from '../services/profiles';
import type { AverageClientSize } from '../lib/database.types';

const clientSizeOptions: { value: AverageClientSize; label: string; hint: string }[] = [
  { value: 'small', label: 'Small', hint: 'Under 100 employees' },
  { value: 'mid', label: 'Mid-market', hint: '100–1,000 employees' },
  { value: 'large', label: 'Large', hint: '1,000+ employees' },
];

export default function NewAccountPage() {
  const navigate = useNavigate();
  const { user, refreshProfile, signOut } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [clientSize, setClientSize] = useState<AverageClientSize | ''>('');
  const [territory, setTerritory] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (!clientSize) {
      setError('Please select your average client size.');
      setSubmitting(false);
      return;
    }

    try {
      await completeAccountSetup({
        first_name: firstName,
        last_name: lastName,
        average_client_size: clientSize,
        territory,
      });
      await refreshProfile();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set up your account. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy auth-radial flex flex-col">
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg">
          <div className="flex items-center gap-2.5 mb-8">
            <img src="/Propel_Logo_2020_v4-3.png" alt="Propel" className="h-8 w-auto" style={{ filter: 'brightness(0) invert(1)' }} />
            <div>
              <span className="text-xs text-white/50 block leading-none mt-1">Broker portal</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-xl p-8">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-green-tint flex items-center justify-center">
                <User className="w-5 h-5 text-green-dark" />
              </div>
              <h1 className="font-display text-2xl font-semibold text-navy">Welcome to Propel</h1>
            </div>
            <p className="text-sm text-neutral-secondary mt-2 ml-[52px]">
              Let's set up your broker profile. This information helps us tailor your dashboard experience.
            </p>

            {error && (
              <div className="mt-5 rounded-md border border-red/20 bg-red-tint px-4 py-3 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red shrink-0 mt-0.5" />
                <p className="text-sm text-red">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="First name" required>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jordan"
                    className={inputClass}
                    autoFocus
                  />
                </Field>
                <Field label="Last name" required>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Ellis"
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field label="Average client size" required>
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
              </Field>

              <Field label="Territory / Region" required>
                <input
                  type="text"
                  required
                  value={territory}
                  onChange={(e) => setTerritory(e.target.value)}
                  placeholder="e.g. Northeast, Texas, Pacific Northwest"
                  className={inputClass}
                />
              </Field>

              {user?.email && (
                <p className="text-xs text-neutral-muted">
                  Setting up account for <span className="font-medium text-navy">{user.email}</span>
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-navy hover:bg-navy-mid disabled:opacity-60 text-white font-medium py-2.5 rounded-sm transition"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Setting up…
                  </>
                ) : (
                  <>
                    Complete setup
                    <ArrowRight className="w-4 h-4" />
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
              Sign out and use a different email
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  'w-full px-3 py-2.5 rounded-sm border border-neutral-border bg-white text-navy placeholder-neutral-muted focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20 transition';

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-navy mb-1.5">
        {label}
        {required && <span className="text-green ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
