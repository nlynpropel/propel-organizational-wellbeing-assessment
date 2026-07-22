import type { AnalysisNoteVisibility } from './database.types';

export const PAYLOAD_FILTER_VERSION = 1;

export type FilteredNote = {
  note_type: string;
  title: string | null;
  content: string;
  visibility: AnalysisNoteVisibility;
  importance: string;
};

export type FilteredSnapshotPayload = {
  filter_version: number;
  workspace_title: string;
  workspace_status: string;
  client_organization: {
    name: string;
    type: string;
    industry: string;
    size_band: string;
    description: string | null;
  };
  assessment: Record<string, unknown>;
  recommendations: unknown[];
  outcomes: unknown[];
  metrics: unknown[];
  programs: unknown[];
  utilization: unknown[];
  resource_gaps: unknown[];
  evidence_sources: unknown[];
  notes: FilteredNote[];
  readiness: Record<string, unknown>;
};

const EXCLUDED_ASSESSMENT_KEYS = new Set([
  'driver_mapping',
  'mapping_weight',
  'prompt_token',
  'completion_token',
  'internal_priority',
  'methodology_notes',
]);

function filterAssessment(assessment: Record<string, unknown>): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(assessment)) {
    if (EXCLUDED_ASSESSMENT_KEYS.has(key)) continue;
    filtered[key] = value;
  }
  return filtered;
}

function filterNotes(
  notes: Array<Record<string, unknown>>
): FilteredNote[] {
  return notes
    .filter((n) => {
      const visibility = n.visibility as AnalysisNoteVisibility;
      return (
        visibility === 'internal' ||
        visibility === 'organization_team' ||
        visibility === 'client_report_candidate'
      );
    })
    .map((n) => ({
      note_type: String(n.note_type ?? ''),
      title: (n.title as string | null) ?? null,
      content: String(n.content ?? ''),
      visibility: n.visibility as AnalysisNoteVisibility,
      importance: String(n.importance ?? 'normal'),
    }));
}

export function buildFilteredPayload(
  snapshot: Record<string, unknown>
): FilteredSnapshotPayload {
  const assessment = (snapshot.assessment as Record<string, unknown>) ?? {};
  const notes = (snapshot.notes as Array<Record<string, unknown>>) ?? [];

  return {
    filter_version: PAYLOAD_FILTER_VERSION,
    workspace_title: String(snapshot.workspace_title ?? ''),
    workspace_status: String(snapshot.workspace_status ?? ''),
    client_organization: {
      name: String(
        ((snapshot.client_organization as Record<string, unknown>) ?? {}).name ?? ''
      ),
      type: String(
        ((snapshot.client_organization as Record<string, unknown>) ?? {}).type ?? ''
      ),
      industry: String(
        ((snapshot.client_organization as Record<string, unknown>) ?? {}).industry ?? ''
      ),
      size_band: String(
        ((snapshot.client_organization as Record<string, unknown>) ?? {}).size_band ?? ''
      ),
      description:
        ((snapshot.client_organization as Record<string, unknown>) ?? {}).description as
          | string
          | null ?? null,
    },
    assessment: filterAssessment(assessment),
    recommendations: (snapshot.recommendations as unknown[]) ?? [],
    outcomes: (snapshot.outcomes as unknown[]) ?? [],
    metrics: (snapshot.metrics as unknown[]) ?? [],
    programs: (snapshot.programs as unknown[]) ?? [],
    utilization: (snapshot.utilization as unknown[]) ?? [],
    resource_gaps: (snapshot.resource_gaps as unknown[]) ?? [],
    evidence_sources: (snapshot.evidence_sources as unknown[]) ?? [],
    notes: filterNotes(notes),
    readiness: (snapshot.readiness as Record<string, unknown>) ?? {},
  };
}

export function getVisibilityDirective(
  visibility: AnalysisNoteVisibility
): 'influence_only' | 'influence_and_output' {
  if (visibility === 'client_report_candidate') return 'influence_and_output';
  return 'influence_only';
}
