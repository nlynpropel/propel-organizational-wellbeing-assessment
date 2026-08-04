import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, AlertCircle } from 'lucide-react';
import BrokerLayout from '../components/layout/BrokerLayout';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { useAuth } from '../context/AuthContext';
import { createOrganization } from '../services/organizations';
import { INDUSTRIES, EMPLOYEE_RANGES, FUNDING_TYPES } from '../lib/sampleData';
import type { FundingTypeDb } from '../lib/database.types';

type FormState = {
  organization_name: string;
  organization_alias: string;
  industry: string;
  employee_count_range: string;
  number_of_locations: string;
  funding_type: string;
  client_contact_name: string;
  client_contact_email: string;
};

const initial: FormState = {
  organization_name: '',
  organization_alias: '',
  industry: '',
  employee_count_range: '',
  number_of_locations: '',
  funding_type: '',
  client_contact_name: '',
  client_contact_email: '',
};

export default function NewClientPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const update = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.organization_name.trim()) {
      e.organization_name = 'Organization name is required.';
    }
    if (form.client_contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.client_contact_email)) {
      e.client_contact_email = 'Enter a valid email address.';
    }
    if (form.number_of_locations && parseInt(form.number_of_locations, 10) < 0) {
      e.number_of_locations = 'Number of locations cannot be negative.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!validate() || !profile) return;
    setSubmitting(true);

    try {
      const org = await createOrganization(profile.id, {
        organization_name: form.organization_name.trim(),
        organization_alias: form.organization_alias.trim() || undefined,
        industry: form.industry || undefined,
        employee_count_range: form.employee_count_range || undefined,
        number_of_locations: form.number_of_locations ? parseInt(form.number_of_locations, 10) : undefined,
        funding_type: (form.funding_type || undefined) as FundingTypeDb | undefined,
        client_contact_name: form.client_contact_name.trim() || undefined,
        client_contact_email: form.client_contact_email.trim() || undefined,
      });

      navigate(`/clients/${org.id}`, { state: { justCreated: true } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create client.';
      setSubmitError(
        /row-level security|policy/i.test(msg)
          ? 'Your account does not have permission to create clients. Contact an administrator.'
          : msg
      );
      setSubmitting(false);
    }
  };

  const fieldCls = (hasError?: boolean) =>
    `w-full px-3 py-2.5 rounded-sm border bg-white text-navy placeholder-neutral-muted focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20 transition text-sm ${
      hasError ? 'border-red' : 'border-neutral-border'
    }`;
  const labelCls = 'block text-sm font-medium text-navy mb-1.5';

  return (
    <BrokerLayout title="New Client">
      <PageHeader
        title="Create a client"
        subtitle="Set up an employer profile to start a well-being assessment"
        breadcrumbs={[{ label: 'Clients', to: '/clients' }, { label: 'New client' }]}
        actions={
          <Button variant="ghost" onClick={() => navigate('/clients')}>
            <ArrowLeft className="w-4 h-4" />
            Cancel
          </Button>
        }
      />

      {submitError && (
        <div className="mb-6 rounded-md border border-red/20 bg-red-tint px-4 py-3 flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-red shrink-0 mt-0.5" />
          <p className="text-sm text-red">{submitError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Card className="max-w-2xl">
          <h2 className="text-lg font-semibold text-navy mb-1">Organization profile</h2>
          <p className="text-sm text-neutral-muted mb-6">
            Basic details about the employer client. Used to tailor the assessment and report.
          </p>

          <div className="grid sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className={labelCls}>Organization name *</label>
              <input
                required
                value={form.organization_name}
                onChange={(e) => update('organization_name', e.target.value)}
                className={fieldCls(!!errors.organization_name)}
                placeholder="Acme Manufacturing"
              />
              {errors.organization_name && (
                <p className="text-xs text-red mt-1">{errors.organization_name}</p>
              )}
            </div>

            <div>
              <label className={labelCls}>Organization alias</label>
              <input
                value={form.organization_alias}
                onChange={(e) => update('organization_alias', e.target.value)}
                className={fieldCls()}
                placeholder="Acme"
              />
            </div>

            <div>
              <label className={labelCls}>Industry</label>
              <select
                value={form.industry}
                onChange={(e) => update('industry', e.target.value)}
                className={fieldCls()}
              >
                <option value="">Select an industry</option>
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Employee count range</label>
              <select
                value={form.employee_count_range}
                onChange={(e) => update('employee_count_range', e.target.value)}
                className={fieldCls()}
              >
                <option value="">Select a range</option>
                {EMPLOYEE_RANGES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Number of locations</label>
              <input
                type="number"
                min={0}
                value={form.number_of_locations}
                onChange={(e) => update('number_of_locations', e.target.value)}
                className={fieldCls(!!errors.number_of_locations)}
                placeholder="3"
              />
              {errors.number_of_locations && (
                <p className="text-xs text-red mt-1">{errors.number_of_locations}</p>
              )}
            </div>

            <div>
              <label className={labelCls}>Funding type</label>
              <select
                value={form.funding_type}
                onChange={(e) => update('funding_type', e.target.value)}
                className={fieldCls()}
              >
                <option value="">Select funding type</option>
                {FUNDING_TYPES.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>


          </div>
        </Card>

        <Card className="max-w-2xl mt-5">
          <h2 className="text-lg font-semibold text-navy mb-1">Client contact</h2>
          <p className="text-sm text-neutral-muted mb-6">
            The primary person who will receive the secure assessment link.
          </p>

          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>Contact name</label>
              <input
                value={form.client_contact_name}
                onChange={(e) => update('client_contact_name', e.target.value)}
                className={fieldCls()}
                placeholder="Dana Whitfield"
              />
            </div>
            <div>
              <label className={labelCls}>Contact email</label>
              <input
                type="email"
                value={form.client_contact_email}
                onChange={(e) => update('client_contact_email', e.target.value)}
                className={fieldCls(!!errors.client_contact_email)}
                placeholder="dana@acme.com"
              />
              {errors.client_contact_email && (
                <p className="text-xs text-red mt-1">{errors.client_contact_email}</p>
              )}
            </div>
          </div>
        </Card>

        <div className="max-w-2xl flex items-center justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => navigate('/clients')}>Cancel</Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? <Check className="w-4 h-4 animate-pulse" /> : null}
            {submitting ? 'Creating…' : 'Create client'}
          </Button>
        </div>

        <p className="text-xs text-neutral-muted max-w-2xl mt-4">
          Submitting creates an organization profile in Supabase. You can send an assessment to this client from their detail page.
        </p>
      </form>
    </BrokerLayout>
  );
}
