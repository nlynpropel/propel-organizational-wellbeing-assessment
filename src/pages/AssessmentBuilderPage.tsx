import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Loader2, Plus, AlertTriangle } from 'lucide-react';
import BrokerLayout from '../components/layout/BrokerLayout';
import PageHeader from '../components/layout/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import ErrorState from '../components/ui/ErrorState';
import LoadingState from '../components/ui/LoadingState';
import SectionEditor, { type DraftSection } from '../components/builder/SectionEditor';
import QuestionCard, { type DraftQuestion } from '../components/builder/QuestionCard';
import ScoreBandEditor from '../components/builder/ScoreBandEditor';
import AssessmentPreview from '../components/builder/AssessmentPreview';
import AssessmentReadinessChecklist from '../components/builder/AssessmentReadinessChecklist';
import RecommendationEligibilityBadge from '../components/builder/RecommendationEligibilityBadge';
import { useAuth } from '../context/AuthContext';
import {
  createTemplate,
  updateTemplate,
  fetchTemplateById,
  fetchLatestVersionForTemplate,
  createVersion,
  updateVersion,
  publishVersion,
  fetchSectionsWithQuestions,
  createSection,
  deleteSection,
  createQuestion,
  deleteQuestion,
  createOption,
  fetchScoreBandsForVersion,
  createScoreBand,
  deleteScoreBand,
} from '../services/assessmentBuilder';
import { validateAssessment, validateScoreBands, DEFAULT_SCORE_BANDS, type ScoreBand } from '../lib/assessmentScoring';
import type { AssessmentSectionWithQuestions, AssessmentScoringMethod } from '../lib/database.types';

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const stepLabels = [
  'Assessment basics',
  'Reporting structure',
  'Sections',
  'Questions',
  'Scoring setup',
  'Preview',
  'Review & publish',
];

export default function AssessmentBuilderPage() {
  const navigate = useNavigate();
  const { assessmentId } = useParams();
  const { profile } = useAuth();
  const isEditing = Boolean(assessmentId);

  const [step, setStep] = useState<Step>(0);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Template + version IDs
  const [templateId, setTemplateId] = useState<string | null>(assessmentId ?? null);
  const [versionId, setVersionId] = useState<string | null>(null);

  // Step 1: basics
  const [name, setName] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [category, setCategory] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | ''>(10);
  const [scoringEnabled, setScoringEnabled] = useState(true);
  const [fullDescription, setFullDescription] = useState('');

  // Step 2: reporting structure
  const [reportingType, setReportingType] = useState<'overall_only' | 'overall_and_sections' | 'no_scoring'>('overall_and_sections');

  // Step 3: sections
  const [sections, setSections] = useState<DraftSection[]>([]);

  // Step 4: questions
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);

  // Step 5: scoring
  const [scoreBands, setScoreBands] = useState<ScoreBand[]>([]);
  const [useCustomBands, setUseCustomBands] = useState(false);

  // Step 6: version metadata
  const [introductionText, setIntroductionText] = useState('');
  const [completionMessage, setCompletionMessage] = useState('');

  const loadExisting = useCallback(async () => {
    if (!assessmentId) return;
    setLoading(true);
    try {
      const template = await fetchTemplateById(assessmentId);
      if (!template) {
        setError('Assessment not found.');
        return;
      }
      setName(template.name);
      setShortDescription(template.short_description ?? '');
      setCategory(template.category ?? '');
      setEstimatedMinutes(template.estimated_minutes ?? 10);
      setScoringEnabled(template.scoring_enabled);
      setFullDescription(template.full_description ?? '');
      setTemplateId(template.id);

      const version = await fetchLatestVersionForTemplate(assessmentId);
      if (version) {
        setVersionId(version.id);
        setIntroductionText(version.introduction_text ?? '');
        setCompletionMessage(version.completion_message ?? '');

        const existingSections = await fetchSectionsWithQuestions(version.id);
        setSections(existingSections.map((s: AssessmentSectionWithQuestions) => ({
          id: s.id,
          title: s.title,
          description: s.description ?? '',
          display_order: s.display_order,
          weight: s.weight,
          is_scored: s.is_scored,
        })));
        setQuestions(existingSections.flatMap((s: AssessmentSectionWithQuestions) =>
          s.questions.map((q) => ({
            id: q.id,
            question_text: q.question_text,
            help_text: q.help_text ?? '',
            question_type: q.question_type,
            display_order: q.display_order,
            is_required: q.is_required,
            is_scored: q.is_scored,
            weight: q.weight,
            reverse_scored: q.reverse_scored,
            reporting_label: q.reporting_label ?? '',
            scoring_dimension: q.scoring_dimension ?? '',
            allow_not_applicable: q.options.some((o) => o.is_not_applicable),
            options: q.options.map((o) => ({
              id: o.id,
              option_label: o.option_label,
              option_value: o.option_value,
              score_value: o.score_value,
              display_order: o.display_order,
              is_not_applicable: o.is_not_applicable,
            })),
            sectionId: s.id,
          }))
        ));

        const bands = await fetchScoreBandsForVersion(version.id);
        if (bands.length > 0) {
          setUseCustomBands(true);
          setScoreBands(bands.map((b) => ({
            band_name: b.band_name,
            min_threshold: Number(b.min_threshold),
            max_threshold: Number(b.max_threshold),
            display_order: b.display_order,
          })));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assessment.');
    } finally {
      setLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    loadExisting();
  }, [loadExisting]);

  const saveBasics = async (): Promise<boolean> => {
    if (!profile) return false;
    setSaving(true);
    try {
      if (templateId) {
        await updateTemplate(templateId, {
          name,
          short_description: shortDescription || undefined,
          full_description: fullDescription || undefined,
          category: category || undefined,
          estimated_minutes: typeof estimatedMinutes === 'number' ? estimatedMinutes : undefined,
          scoring_enabled: scoringEnabled,
        });
      } else {
        const template = await createTemplate({
          name,
          short_description: shortDescription || undefined,
          full_description: fullDescription || undefined,
          owner_type: 'broker',
          category: category || undefined,
          estimated_minutes: typeof estimatedMinutes === 'number' ? estimatedMinutes : undefined,
          scoring_enabled: scoringEnabled,
        }, profile.id);
        setTemplateId(template.id);

        const version = await createVersion({
          assessment_template_id: template.id,
          version_number: 1,
          version_label: 'v1',
          scoring_method: scoringEnabled ? 'weighted_sections' : 'none',
          show_overall_score: scoringEnabled,
        }, profile.id);
        setVersionId(version.id);
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save assessment basics.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveVersionMeta = async () => {
    if (!versionId) return;
    const scoringMethod: AssessmentScoringMethod = !scoringEnabled ? 'none' : reportingType === 'overall_only' ? 'simple' : 'weighted_sections';
    await updateVersion(versionId, {
      introduction_text: introductionText || undefined,
      completion_message: completionMessage || undefined,
      scoring_method: scoringMethod,
      show_overall_score: scoringEnabled && reportingType !== 'no_scoring',
    });
  };

  const handleNext = async () => {
    setError(null);
    if (step === 0) {
      if (!name.trim()) {
        setError('Assessment name is required.');
        return;
      }
      const ok = await saveBasics();
      if (!ok) return;
    }
    if (step === 1) {
      if (reportingType === 'overall_and_sections' && sections.length === 0) {
        // Pre-populate one section
        setSections([{ title: 'Section 1', description: '', display_order: 0, weight: 100, is_scored: true }]);
      }
      await saveVersionMeta();
    }
    if (step === 4) {
      await saveVersionMeta();
    }
    setStep((s) => Math.min(6, s + 1) as Step);
  };

  const handleBack = () => {
    setStep((s) => Math.max(0, s - 1) as Step);
  };

  const handlePublish = async () => {
    if (!versionId || !templateId) return;
    setSaving(true);
    setError(null);
    try {
      // Save score bands
      if (useCustomBands && scoreBands.length > 0) {
        // Delete existing bands first
        const existing = await fetchScoreBandsForVersion(versionId);
        await Promise.all(existing.map((b) => deleteScoreBand(b.id)));
        // Insert new bands
        await Promise.all(scoreBands.map((b, i) =>
          createScoreBand({
            assessment_version_id: versionId,
            band_name: b.band_name,
            min_threshold: b.min_threshold,
            max_threshold: b.max_threshold,
            display_order: i,
          })
        ));
      }

      await publishVersion(versionId);
      await updateTemplate(templateId, { status: 'published' });
      navigate('/assessments', { state: { justPublished: true } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish assessment.');
    } finally {
      setSaving(false);
    }
  };

  // Save sections to DB
  const saveSections = async () => {
    if (!versionId) return;
    setSaving(true);
    try {
      // Delete existing sections and questions
      const existing = await fetchSectionsWithQuestions(versionId);
      for (const s of existing) {
        for (const q of s.questions) {
          await deleteQuestion(q.id);
        }
        await deleteSection(s.id);
      }
      // Insert new sections
      for (let i = 0; i < sections.length; i++) {
        const s = sections[i];
        const created = await createSection({
          assessment_version_id: versionId,
          title: s.title,
          description: s.description || undefined,
          display_order: i,
          weight: s.weight,
          is_scored: s.is_scored,
        });
        // Insert questions for this section
        const sectionQuestions = questions.filter((q) => q.sectionId === s.id || (!q.sectionId && i === 0));
        for (let j = 0; j < sectionQuestions.length; j++) {
          const q = sectionQuestions[j];
          const createdQ = await createQuestion({
            assessment_version_id: versionId,
            assessment_section_id: created.id,
            question_text: q.question_text,
            help_text: q.help_text || undefined,
            question_type: q.question_type,
            display_order: j,
            is_required: q.is_required,
            is_scored: q.is_scored,
            weight: q.weight,
            reverse_scored: q.reverse_scored,
            reporting_label: q.reporting_label || undefined,
            scoring_dimension: q.scoring_dimension || undefined,
          });
          // Insert options
          for (let k = 0; k < q.options.length; k++) {
            const opt = q.options[k];
            await createOption({
              question_id: createdQ.id,
              option_label: opt.option_label,
              option_value: opt.option_value || opt.option_label.toLowerCase().replace(/\s+/g, '_'),
              score_value: opt.score_value,
              display_order: k,
              is_not_applicable: opt.is_not_applicable,
            });
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save sections.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <BrokerLayout title="Assessment Builder">
        <LoadingState label="Loading assessment…" />
      </BrokerLayout>
    );
  }

  if (error && step === 0 && !templateId) {
    return (
      <BrokerLayout title="Assessment Builder">
        <ErrorState message={error} onRetry={() => navigate('/assessments')} />
      </BrokerLayout>
    );
  }

  const previewSections: AssessmentSectionWithQuestions[] = sections.map((s, si) => ({
    id: s.id || `draft-${si}`,
    assessment_version_id: versionId || '',
    title: s.title,
    description: s.description || null,
    display_order: si,
    weight: s.weight,
    is_scored: s.is_scored,
    created_at: '',
    updated_at: '',
    questions: questions
      .filter((q) => q.sectionId === s.id || (!q.sectionId && si === 0))
      .map((q, qi) => ({
        id: q.id || `draft-q-${si}-${qi}`,
        assessment_version_id: versionId || '',
        assessment_section_id: s.id || `draft-${si}`,
        question_text: q.question_text,
        help_text: q.help_text || null,
        question_type: q.question_type,
        display_order: qi,
        is_required: q.is_required,
        is_scored: q.is_scored,
        weight: q.weight,
        reverse_scored: q.reverse_scored,
        reporting_label: q.reporting_label || null,
        scoring_dimension: q.scoring_dimension || null,
        created_at: '',
        updated_at: '',
        options: q.options.map((o, oi) => ({
          id: o.id || `draft-opt-${si}-${qi}-${oi}`,
          question_id: q.id || `draft-q-${si}-${qi}`,
          option_label: o.option_label,
          option_value: o.option_value,
          score_value: o.score_value,
          display_order: oi,
          is_not_applicable: o.is_not_applicable,
          created_at: '',
        })),
      })),
  }));

  const validationWarnings = validateAssessment(previewSections);
  const bandWarnings = useCustomBands ? validateScoreBands(scoreBands) : [];
  const allWarnings = [...validationWarnings, ...bandWarnings];
  const errors = allWarnings.filter((w) => w.level === 'error');

  const readinessItems = [
    { label: 'Assessment basics complete', done: name.trim() !== '' },
    { label: 'At least one question', done: questions.length > 0 },
    { label: 'All required choices configured', done: !errors.some((w) => w.message.includes('no selectable')) },
    { label: 'Scoring configuration valid', done: !errors.some((w) => w.message.includes('score')) },
    { label: 'Score bands valid', done: errors.filter((w) => w.message.includes('band')).length === 0 },
    { label: 'Estimated completion time set', done: typeof estimatedMinutes === 'number' && estimatedMinutes > 0 },
    { label: 'Recommendations: Not included for custom assessments', done: true },
  ];

  return (
    <BrokerLayout title="Assessment Builder">
      <PageHeader
        title={isEditing ? 'Edit Assessment' : 'Create Custom Assessment'}
        subtitle="Build your own client questionnaire using standardized question types, scoring, and reporting. Custom assessments include response and score reporting but do not include automated Propel recommendations."
        breadcrumbs={[{ label: 'Assessments', to: '/assessments' }, { label: 'Builder' }]}
        actions={<Button variant="ghost" size="sm" to="/assessments"><ArrowLeft className="w-4 h-4" /> Cancel</Button>}
      />

      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2">
        {stepLabels.map((label, i) => (
          <div key={i} className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => i < step && setStep(i as Step)}
              disabled={i > step}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                i === step
                  ? 'bg-navy text-white'
                  : i < step
                  ? 'bg-green-tint text-green-dark hover:bg-green/20 cursor-pointer'
                  : 'bg-neutral-bg text-neutral-muted'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                i === step ? 'bg-white/20' : i < step ? 'bg-green/20' : 'bg-neutral-border'
              }`}>
                {i < step ? <Check className="w-3 h-3" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </button>
            {i < stepLabels.length - 1 && <div className="w-4 h-px bg-neutral-border" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red/20 bg-red-tint px-4 py-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red shrink-0 mt-0.5" />
          <p className="text-sm text-red">{error}</p>
        </div>
      )}

      {/* Step content */}
      {step === 0 && (
        <Card className="space-y-4 max-w-2xl">
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">Assessment name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Workplace Wellness Check"
              className="w-full px-3 py-2 rounded-sm border border-neutral-border bg-white text-navy focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">Short description</label>
            <input
              type="text"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="One-line summary shown in the assessment library"
              className="w-full px-3 py-2 rounded-sm border border-neutral-border bg-white text-navy focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">Full description</label>
            <textarea
              value={fullDescription}
              onChange={(e) => setFullDescription(e.target.value)}
              placeholder="Detailed description of what this assessment measures"
              rows={3}
              className="w-full px-3 py-2 rounded-sm border border-neutral-border bg-white text-navy focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-navy mb-1.5">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Wellness, Culture, Leadership"
                className="w-full px-3 py-2 rounded-sm border border-neutral-border bg-white text-navy focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy mb-1.5">Estimated minutes</label>
              <input
                type="number"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(e.target.value === '' ? '' : Number(e.target.value))}
                min="1"
                className="w-full px-3 py-2 rounded-sm border border-neutral-border bg-white text-navy focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20"
              />
            </div>
          </div>
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={scoringEnabled}
                onChange={(e) => setScoringEnabled(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-navy">Enable scoring for this assessment</span>
            </label>
          </div>
          <div className="pt-2">
            <RecommendationEligibilityBadge ownerType="broker" recommendationsEnabled={false} />
            <p className="text-xs text-neutral-muted mt-1">
              Custom assessments never include automated Propel recommendations.
            </p>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card className="space-y-4 max-w-2xl">
          <h3 className="font-display text-base font-semibold text-navy">Reporting structure</h3>
          <p className="text-sm text-neutral-secondary">Choose how results should be reported.</p>
          <div className="space-y-3">
            {([
              { value: 'overall_only', label: 'Overall score only', desc: 'Single normalized score for the entire assessment' },
              { value: 'overall_and_sections', label: 'Overall score plus section scores', desc: 'Score broken down by section with weighted overall' },
              { value: 'no_scoring', label: 'Response reporting without scoring', desc: 'Collect responses without computing scores' },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setReportingType(opt.value)}
                disabled={!scoringEnabled && opt.value !== 'no_scoring'}
                className={`w-full text-left rounded-md border p-4 transition ${
                  reportingType === opt.value
                    ? 'border-green bg-green-tint ring-2 ring-green/20'
                    : 'border-neutral-border bg-white hover:border-navy/20'
                } ${!scoringEnabled && opt.value !== 'no_scoring' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span className="block text-sm font-semibold text-navy">{opt.label}</span>
                <span className="block text-xs text-neutral-muted mt-0.5">{opt.desc}</span>
              </button>
            ))}
          </div>
          {!scoringEnabled && (
            <p className="text-xs text-neutral-muted">Scoring is disabled — only response reporting is available.</p>
          )}
        </Card>
      )}

      {step === 2 && (
        <Card className="space-y-4">
          <div>
            <h3 className="font-display text-base font-semibold text-navy">Sections</h3>
            <p className="text-sm text-neutral-secondary mt-1">
              Organize your assessment into sections. Each section can be scored or informational.
              {reportingType === 'overall_and_sections' && ' At least one section is required.'}
            </p>
          </div>
          <SectionEditor
            sections={sections}
            onChange={setSections}
            onAdd={() => setSections([...sections, { title: `Section ${sections.length + 1}`, description: '', display_order: sections.length, weight: 100 / (sections.length + 1), is_scored: true }])}
          />
          {sections.length > 0 && (
            <Button variant="outline" size="sm" onClick={saveSections} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {saving ? 'Saving…' : 'Save sections'}
            </Button>
          )}
        </Card>
      )}

      {step === 3 && (
        <div className="space-y-4">
          {sections.length === 0 ? (
            <Card>
              <p className="text-sm text-neutral-secondary text-center py-8">
                Add at least one section before adding questions.
              </p>
            </Card>
          ) : (
            sections.map((section, si) => {
              const sectionQuestions = questions.filter((q) => q.sectionId === section.id || (!q.sectionId && si === 0));
              return (
                <Card key={si}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-display text-base font-semibold text-navy">{section.title}</h3>
                      {section.description && <p className="text-sm text-neutral-secondary mt-0.5">{section.description}</p>}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newQ: DraftQuestion = {
                          question_text: '',
                          help_text: '',
                          question_type: 'agreement5',
                          display_order: sectionQuestions.length,
                          is_required: true,
                          is_scored: true,
                          weight: 1,
                          reverse_scored: false,
                          reporting_label: '',
                          scoring_dimension: '',
                          allow_not_applicable: false,
                          options: [],
                          sectionId: section.id,
                        };
                        setQuestions([...questions, newQ]);
                      }}
                    >
                      <Plus className="w-4 h-4" /> Add question
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {sectionQuestions.length === 0 ? (
                      <p className="text-sm text-neutral-muted italic">No questions yet.</p>
                    ) : (
                      sectionQuestions.map((q, qi) => {
                        const globalIndex = questions.indexOf(q);
                        return (
                          <QuestionCard
                            key={qi}
                            question={q}
                            sectionTitle={section.title}
                            onChange={(updated) => setQuestions(questions.map((qq, i) => i === globalIndex ? updated : qq))}
                            onDelete={() => setQuestions(questions.filter((_, i) => i !== globalIndex))}
                            onDuplicate={() => {
                              const dup = { ...q, id: undefined, question_text: q.question_text + ' (copy)' };
                              setQuestions([...questions, dup]);
                            }}
                            onMoveUp={() => {
                              if (qi === 0) return;
                              const reordered = [...sectionQuestions];
                              [reordered[qi - 1], reordered[qi]] = [reordered[qi], reordered[qi - 1]];
                              const others = questions.filter((qq) => qq.sectionId !== section.id && !(qq.sectionId === undefined && si === 0));
                              setQuestions([...others, ...reordered]);
                            }}
                            onMoveDown={() => {
                              if (qi === sectionQuestions.length - 1) return;
                              const reordered = [...sectionQuestions];
                              [reordered[qi], reordered[qi + 1]] = [reordered[qi + 1], reordered[qi]];
                              const others = questions.filter((qq) => qq.sectionId !== section.id && !(qq.sectionId === undefined && si === 0));
                              setQuestions([...others, ...reordered]);
                            }}
                            canMoveUp={qi > 0}
                            canMoveDown={qi < sectionQuestions.length - 1}
                          />
                        );
                      })
                    )}
                  </div>
                </Card>
              );
            })
          )}
          <Button variant="outline" size="sm" onClick={saveSections} disabled={saving || questions.length === 0}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? 'Saving…' : 'Save questions'}
          </Button>
        </div>
      )}

      {step === 4 && (
        <Card className="space-y-6 max-w-2xl">
          <div>
            <h3 className="font-display text-base font-semibold text-navy">Scoring setup</h3>
            <p className="text-sm text-neutral-secondary mt-1">
              Review section weights, question weights, and score normalization.
              Scores are normalized from 0 to 100.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-navy mb-2">Section weights</h4>
            <div className="space-y-2">
              {sections.map((s, i) => (
                <div key={i} className="flex items-center justify-between rounded-md border border-neutral-border px-3 py-2">
                  <span className="text-sm text-navy">{s.title}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      value={s.weight}
                      onChange={(e) => setSections(sections.map((ss, j) => j === i ? { ...ss, weight: Number(e.target.value) } : ss))}
                      className="w-20 px-2 py-1 rounded-sm border border-neutral-border bg-white text-navy text-sm"
                    />
                    <span className="text-xs text-neutral-muted">/ {sections.reduce((sum, ss) => sum + ss.weight, 0)} total</span>
                  </div>
                </div>
              ))}
            </div>
            {sections.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => {
                  const total = sections.reduce((sum, s) => sum + s.weight, 0);
                  if (total > 0) {
                    setSections(sections.map((s) => ({ ...s, weight: Math.round((s.weight / total) * 100 * 10) / 10 })));
                  }
                }}
              >
                Normalize weights to 100
              </Button>
            )}
          </div>

          <div className="rounded-md bg-blue-tint border border-blue/20 p-4">
            <h4 className="text-sm font-semibold text-blue mb-1">Score normalization</h4>
            <p className="text-xs text-blue/80">
              Question scores are normalized: (answer - min) / (max - min) × 100.
              Section scores weight questions; overall scores weight sections.
              Unanswered optional and N/A responses are excluded from the denominator.
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={useCustomBands}
                onChange={(e) => {
                  setUseCustomBands(e.target.checked);
                  if (e.target.checked && scoreBands.length === 0) {
                    setScoreBands(DEFAULT_SCORE_BANDS);
                  }
                }}
                className="rounded"
              />
              <span className="text-sm text-navy">Customize score bands</span>
            </label>
            {useCustomBands && (
              <ScoreBandEditor bands={scoreBands} onChange={setScoreBands} />
            )}
            {!useCustomBands && (
              <div className="text-xs text-neutral-muted">
                Using defaults: {DEFAULT_SCORE_BANDS.map((b) => `${b.band_name} ${b.min_threshold}-${b.max_threshold}`).join(', ')}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">Introduction text (optional)</label>
            <textarea
              value={introductionText}
              onChange={(e) => setIntroductionText(e.target.value)}
              placeholder="Shown to respondents before they begin"
              rows={2}
              className="w-full px-3 py-2 rounded-sm border border-neutral-border bg-white text-navy text-sm focus:outline-none focus:border-green focus:ring-1 focus:ring-green/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">Completion message (optional)</label>
            <textarea
              value={completionMessage}
              onChange={(e) => setCompletionMessage(e.target.value)}
              placeholder="Shown to respondents after they submit"
              rows={2}
              className="w-full px-3 py-2 rounded-sm border border-neutral-border bg-white text-navy text-sm focus:outline-none focus:border-green focus:ring-1 focus:ring-green/20"
            />
          </div>
        </Card>
      )}

      {step === 5 && (
        <AssessmentPreview
          sections={previewSections}
          introductionText={introductionText}
          completionMessage={completionMessage}
          templateName={name}
        />
      )}

      {step === 6 && (
        <div className="space-y-4 max-w-2xl">
          <Card>
            <h3 className="font-display text-base font-semibold text-navy mb-4">Review & publish</h3>
            <AssessmentReadinessChecklist items={readinessItems} warnings={allWarnings} />
          </Card>
          <Card>
            <h4 className="text-sm font-semibold text-navy mb-3">Summary</h4>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-neutral-muted">Name</dt><dd className="text-navy font-medium">{name}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-muted">Category</dt><dd className="text-navy font-medium">{category || '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-muted">Sections</dt><dd className="text-navy font-medium">{sections.length}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-muted">Questions</dt><dd className="text-navy font-medium">{questions.length}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-muted">Scoring</dt><dd className="text-navy font-medium">{scoringEnabled ? 'Enabled' : 'Disabled'}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-muted">Recommendations</dt><dd className="text-navy font-medium">Not included</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-muted">Estimated time</dt><dd className="text-navy font-medium">{estimatedMinutes} min</dd></div>
            </dl>
          </Card>
          {errors.length === 0 ? (
            <Button variant="primary" size="lg" onClick={handlePublish} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? 'Publishing…' : 'Publish assessment'}
            </Button>
          ) : (
            <div className="rounded-md border border-red/20 bg-red-tint px-4 py-3">
              <p className="text-sm text-red font-medium">Fix errors before publishing:</p>
              <ul className="mt-2 space-y-1">
                {errors.map((e, i) => <li key={i} className="text-sm text-red">• {e.message}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      {step < 6 && (
        <div className="flex items-center justify-between mt-8">
          <Button variant="ghost" size="md" onClick={handleBack} disabled={step === 0}>
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <Button variant="primary" size="md" onClick={handleNext} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? 'Saving…' : 'Next'}
            {!saving && <ArrowRight className="w-4 h-4" />}
          </Button>
        </div>
      )}
    </BrokerLayout>
  );
}
