import { useParams, Link, Navigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import BrokerLayout from '../components/layout/BrokerLayout';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';
import { useAuth } from '../context/AuthContext';
import { fetchOrganizationById } from '../services/organizations';
import { useEffect, useState, useCallback } from 'react';
import type { OrganizationWithAssessment } from '../services/organizations';

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [org, setOrg] = useState<OrganizationWithAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile || !id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOrganizationById(profile.id, id);
      setOrg(data);
      if (!data) setError('Organization not found or you do not have access.');
    } catch (err) {
      console.error('[ResultsPage.load] Failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load results.');
    } finally {
      setLoading(false);
    }
  }, [profile, id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <BrokerLayout title="Loading…">
        <LoadingState label="Loading results…" />
      </BrokerLayout>
    );
  }

  if (error || !org) {
    return (
      <BrokerLayout title="Not found">
        <ErrorState message={error ?? 'Organization not found.'} onRetry={load} />
      </BrokerLayout>
    );
  }

  const assessment = org.latest_assessment;
  const hasScore = assessment?.overall_score !== null && assessment?.overall_score !== undefined;

  if (!hasScore) {
    return (
      <BrokerLayout title={`${org.organization_name} · Results`}>
        <div className="mb-2">
          <Link to={`/clients/${org.id}`} className="inline-flex items-center gap-1.5 text-xs text-neutral-muted hover:text-navy transition">
            <ArrowLeft className="w-3.5 h-3.5" />
            {org.organization_name}
          </Link>
        </div>
        <Card>
          <EmptyState
            icon={TrendingUp}
            title="Results not available yet"
            description="The assessment hasn't been completed or scored. Results will appear here once the assessment is submitted."
            action={<Button to={`/clients/${org.id}`}>Back to client</Button>}
          />
        </Card>
      </BrokerLayout>
    );
  }

  // Redirect to the full report page for completed assessments.
  if (assessment?.id) {
    return <Navigate to={`/reports/${assessment.id}`} replace />;
  }

  return (
    <BrokerLayout title={`${org.organization_name} · Results`}>
      <Card>
        <EmptyState
          icon={TrendingUp}
          title="No assessment found"
          description="There is no completed assessment for this client yet."
          action={<Button to="/clients">Back to clients</Button>}
        />
      </Card>
    </BrokerLayout>
  );
}
