import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  MessageSquareQuote,
  Target,
  TrendingUp,
  Lightbulb,
  CheckCircle2,
} from 'lucide-react';
import BrokerLayout from '../components/layout/BrokerLayout';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import OpportunitySpectrum from '../components/ui/OpportunitySpectrum';
import StrategyDimensionList from '../components/StrategyDimensionList';
import BehavioralReadinessList from '../components/BehavioralReadinessList';
import RecommendationCard from '../components/RecommendationCard';
import EmptyState from '../components/ui/EmptyState';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';
import { useAuth } from '../context/AuthContext';
import { fetchOrganizationById } from '../services/organizations';
import { useEffect, useState, useCallback } from 'react';
import type { OrganizationWithAssessment } from '../services/organizations';
import {
  PLACEHOLDER_STRATEGY_DIMENSIONS,
  PLACEHOLDER_BEHAVIORAL_DRIVERS,
  PLACEHOLDER_STRENGTHS,
  PLACEHOLDER_OPPORTUNITIES,
} from '../lib/sampleData';

// Placeholder recommendations — real recommendation engine is a future phase.
const PLACEHOLDER_QUICK_WINS = [
  {
    id: 'ph-r-qw-1',
    title: 'Add a leadership video kickoff message to next open enrollment',
    dimension: 'Strategy and Leadership',
    tier: 'Quick Win' as const,
    kind: 'flag' as const,
    effort: 'Low effort' as const,
    impact: 'High visibility' as const,
  },
  {
    id: 'ph-r-qw-2',
    title: 'Publish a simple one-page "where to start" guide for new hires',
    dimension: 'Employee Relevance',
    tier: 'Quick Win' as const,
    kind: 'star' as const,
    effort: 'Low effort' as const,
    impact: 'Medium impact' as const,
  },
];

const PLACEHOLDER_HIGH_IMPACT = [
  {
    id: 'ph-r-hi-1',
    title: 'Build a 12-month measurement plan tied to 3 outcome metrics',
    dimension: 'Measurement and Improvement',
    tier: 'High-Impact Move' as const,
    kind: 'target' as const,
    effort: 'High effort' as const,
    impact: 'High impact' as const,
  },
];

const PLACEHOLDER_QUESTIONS = [
  'What would make this year\u2019s well-being investment feel personally relevant to your team?',
  'How is leadership currently visible in supporting these programs?',
];

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
            description="The assessment hasn't been completed or scored. Results will appear here once scores are assigned."
            action={<Button to={`/clients/${org.id}`}>Back to client</Button>}
          />
        </Card>
      </BrokerLayout>
    );
  }

  const score = Math.round(assessment!.overall_score!);

  return (
    <BrokerLayout title={`${org.organization_name} · Results`}>
      <div className="mb-4">
        <Link to={`/clients/${org.id}`} className="inline-flex items-center gap-1.5 text-xs text-neutral-muted hover:text-navy transition">
          <ArrowLeft className="w-3.5 h-3.5" />
          {org.organization_name}
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy">Results</h1>
          <p className="text-sm text-neutral-secondary mt-1">
            Well-being Opportunity Index report for {org.organization_name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-neutral-muted">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Download Report</span>
          </Button>
          <Button variant="ghost" size="sm">
            <MessageSquareQuote className="w-4 h-4" />
            <span className="hidden sm:inline">Request Propel Strategy Review</span>
          </Button>
        </div>
      </div>

      <div className="space-y-5">
        <Card>
          <OpportunitySpectrum score={score} />
        </Card>

        <div className="grid lg:grid-cols-2 gap-5">
          <Card>
            <h3 className="font-display text-base font-semibold text-navy mb-1">Strategy dimensions</h3>
            <p className="text-xs text-neutral-muted mb-4">Placeholder data — scoring engine not yet implemented</p>
            <StrategyDimensionList dimensions={PLACEHOLDER_STRATEGY_DIMENSIONS} />
          </Card>
          <Card>
            <h3 className="font-display text-base font-semibold text-navy mb-1">Behavioral readiness</h3>
            <p className="text-xs text-neutral-muted mb-4">Placeholder data — scoring engine not yet implemented</p>
            <BehavioralReadinessList drivers={PLACEHOLDER_BEHAVIORAL_DRIVERS} />
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          <Card>
            <h3 className="font-display text-base font-semibold text-navy mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-dark" />
              Strengths
            </h3>
            <p className="text-xs text-neutral-muted mb-3">Placeholder data</p>
            <ul className="space-y-3">
              {PLACEHOLDER_STRENGTHS.map((s, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-neutral-text">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-dark mt-2 shrink-0" />
                  {s}
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h3 className="font-display text-base font-semibold text-navy mb-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-orange" />
              Priority opportunities
            </h3>
            <p className="text-xs text-neutral-muted mb-3">Placeholder data</p>
            <ul className="space-y-3">
              {PLACEHOLDER_OPPORTUNITIES.map((o, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-neutral-text">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange mt-2 shrink-0" />
                  {o}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div>
          <h3 className="font-display text-lg font-semibold text-navy mb-1 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-green-dark" />
            Quick wins
          </h3>
          <p className="text-xs text-neutral-muted mb-3">Placeholder data — recommendation engine not yet implemented</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {PLACEHOLDER_QUICK_WINS.map((rec) => (
              <RecommendationCard key={rec.id} rec={rec} />
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-display text-lg font-semibold text-navy mb-1 flex items-center gap-2">
            <Target className="w-5 h-5 text-orange" />
            High-impact moves
          </h3>
          <p className="text-xs text-neutral-muted mb-3">Placeholder data — recommendation engine not yet implemented</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {PLACEHOLDER_HIGH_IMPACT.map((rec) => (
              <RecommendationCard key={rec.id} rec={rec} />
            ))}
          </div>
        </div>

        <Card>
          <h3 className="font-display text-base font-semibold text-navy mb-4 flex items-center gap-2">
            <MessageSquareQuote className="w-4 h-4 text-navy" />
            Client meeting questions
          </h3>
          <p className="text-xs text-neutral-muted mb-3">Placeholder data</p>
          <ul className="space-y-3">
            {PLACEHOLDER_QUESTIONS.map((q, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-neutral-text">
                <span className="font-mono text-xs text-green-dark font-bold mt-0.5 shrink-0">{i + 1}.</span>
                {q}
              </li>
            ))}
          </ul>
        </Card>

        <p className="text-xs text-neutral-muted px-1">
          PDF generation and Propel Strategy Review requests are placeholders in this phase.
          Scores and recommendations shown are placeholder data.
        </p>
      </div>
    </BrokerLayout>
  );
}
