import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Loader2, AlertCircle, Clock, CheckCircle, RefreshCw, History } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  fetch360GenerationsForInstance,
  generate360Analysis,
} from '../services/propel360Generations';
import type { Propel360GenerationRow } from '../lib/database.types';
import Button from '../components/ui/Button';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';

type InstanceInfo = {
  id: string;
  status: string;
  respondent_name: string | null;
  respondent_email: string | null;
  submitted_at: string | null;
  template_name: string;
  organization_name: string;
};

export default function Assessment360AnalysisPage() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [instance, setInstance] = useState<InstanceInfo | null>(null);
  const [generations, setGenerations] = useState<Propel360GenerationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const canAccess = profile?.role === 'superadmin' || profile?.role === 'propel_csm';

  const load = useCallback(async () => {
    if (!instanceId) return;
    setLoading(true);
    try {
      const { data: inst, error: instErr } = await supabase
        .from('assessment_instances')
        .select(`
          id, status, respondent_name, respondent_email, submitted_at,
          assessment_version:assessment_versions(name),
          organization:organizations(organization_name)
        `)
        .eq('id', instanceId)
        .maybeSingle();
      if (instErr) throw instErr;
      if (!inst) throw new Error('Assessment instance not found.');

      const versionData = inst.assessment_version as { name: string } | null;
      const orgData = inst.organization as { organization_name: string } | null;
      setInstance({
        id: inst.id,
        status: inst.status,
        respondent_name: inst.respondent_name,
        respondent_email: inst.respondent_email,
        submitted_at: inst.submitted_at,
        template_name: versionData?.name ?? 'Unknown',
        organization_name: orgData?.organization_name ?? 'Unknown',
      });

      const gens = await fetch360GenerationsForInstance(instanceId);
      setGenerations(gens);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    if (!canAccess) {
      setError('You do not have access to this page.');
      setLoading(false);
      return;
    }
    load();
  }, [canAccess, load]);

  const handleGenerate = async () => {
    if (!instanceId || !profile) return;
    setGenerating(true);
    setGenError(null);
    try {
      await generate360Analysis(instanceId, profile.id);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed.';
      setGenError(msg);
    } finally {
      setGenerating(false);
    }
  };

  if (!canAccess) {
    return (
      <div className="p-6">
        <ErrorState message="You do not have access to this page." />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <LoadingState label="Loading analysis…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }

  const latestCompleted = generations.find((g) => g.status === 'completed');
  const activeGeneration = generations.find((g) => g.status === 'queued' || g.status === 'generating');

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-navy">360 Engagement Analysis</h1>
            <p className="text-sm text-neutral-secondary">Internal AI analysis — Propel Client Services only</p>
          </div>
        </div>
      </div>

      {/* Assessment info card */}
      {instance && (
        <div className="bg-white rounded-lg border border-neutral-border p-5 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs font-medium text-neutral-muted uppercase tracking-wide">Assessment</p>
              <p className="text-sm text-navy font-medium mt-1">{instance.template_name}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-muted uppercase tracking-wide">Client</p>
              <p className="text-sm text-navy font-medium mt-1">{instance.organization_name}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-muted uppercase tracking-wide">Respondent</p>
              <p className="text-sm text-navy font-medium mt-1">
                {instance.respondent_name ?? instance.respondent_email ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-muted uppercase tracking-wide">Status</p>
              <div className="flex items-center gap-1.5 mt-1">
                {instance.status === 'submitted' ? (
                  <CheckCircle className="w-4 h-4 text-green-dark" />
                ) : (
                  <Clock className="w-4 h-4 text-neutral-muted" />
                )}
                <span className="text-sm text-navy font-medium">
                  {instance.status === 'submitted' ? 'Submitted' : instance.status}
                </span>
              </div>
            </div>
          </div>
          {instance.submitted_at && (
            <p className="text-xs text-neutral-muted mt-3">
              Submitted on {new Date(instance.submitted_at).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
          )}
        </div>
      )}

      {/* Generate action */}
      <div className="bg-white rounded-lg border border-neutral-border p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-navy">AI Analysis</h2>
            <p className="text-xs text-neutral-secondary mt-1">
              Generate an internal analysis from the submitted assessment responses.
            </p>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={generating || !!activeGeneration || instance?.status !== 'submitted'}
          >
            {generating || activeGeneration ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : latestCompleted ? (
              <RefreshCw className="w-4 h-4" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {generating ? 'Generating…' : latestCompleted ? 'Regenerate' : 'Generate AI Analysis'}
          </Button>
        </div>
        {genError && (
          <div className="mt-3 flex items-start gap-2 text-sm text-red bg-red-tint/50 rounded-md p-3">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{genError}</span>
          </div>
        )}
      </div>

      {/* Generation status */}
      {activeGeneration && (
        <div className="bg-blue-tint border border-blue/20 rounded-lg p-4 mb-6 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-blue animate-spin" />
          <div>
            <p className="text-sm font-medium text-blue">Generation in progress…</p>
            <p className="text-xs text-blue/70 mt-0.5">
              Started {new Date(activeGeneration.created_at).toLocaleTimeString()}
            </p>
          </div>
        </div>
      )}

      {/* Latest completed analysis */}
      {latestCompleted && !activeGeneration && (
        <div className="bg-white rounded-lg border border-neutral-border p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-dark" />
              <h2 className="text-sm font-semibold text-navy">Latest Analysis</h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-neutral-muted">
                Generated {new Date(latestCompleted.completed_at ?? latestCompleted.created_at).toLocaleDateString('en-US', {
                  year: 'numeric', month: 'short', day: 'numeric',
                })}
              </span>
              {generations.filter((g) => g.status === 'completed').length > 1 && (
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-navy hover:text-navy-mid transition"
                >
                  <History className="w-3.5 h-3.5" />
                  Version History ({generations.filter((g) => g.status === 'completed').length})
                </button>
              )}
            </div>
          </div>
          <div className="prose prose-sm max-w-none text-neutral-text">
            <pre className="whitespace-pre-wrap text-sm font-mono text-neutral-text bg-neutral-bg/30 rounded-md p-4 border border-neutral-border-soft">
              {latestCompleted.output_markdown}
            </pre>
          </div>
        </div>
      )}

      {/* Version history */}
      {showHistory && (
        <div className="bg-white rounded-lg border border-neutral-border p-5 mb-6">
          <h3 className="text-sm font-semibold text-navy mb-4">Version History</h3>
          <div className="space-y-3">
            {generations
              .filter((g) => g.status === 'completed')
              .map((gen, idx) => (
                <div key={gen.id} className="flex items-center justify-between border border-neutral-border-soft rounded-md p-3">
                  <div>
                    <p className="text-sm font-medium text-navy">
                      Version {generations.filter((g) => g.status === 'completed').length - idx}
                      {idx === 0 && <span className="text-xs text-green-dark ml-2">(Latest)</span>}
                    </p>
                    <p className="text-xs text-neutral-muted mt-0.5">
                      {new Date(gen.completed_at ?? gen.created_at).toLocaleString('en-US', {
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                      {' · '}Model: {gen.model}
                    </p>
                  </div>
                  <pre className="text-xs text-neutral-secondary max-h-24 overflow-y-auto max-w-md whitespace-pre-wrap">
                    {gen.output_markdown?.slice(0, 200)}…
                  </pre>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Failed generation */}
      {generations.find((g) => g.status === 'failed' && !activeGeneration) && !latestCompleted && (
        <div className="bg-red-tint/50 border border-red/20 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red">Last generation failed</p>
              <p className="text-xs text-red/70 mt-1">
                {generations.find((g) => g.status === 'failed')?.error_message}
              </p>
              <p className="text-xs text-neutral-muted mt-2">
                The submitted assessment is preserved. You can try generating again.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
