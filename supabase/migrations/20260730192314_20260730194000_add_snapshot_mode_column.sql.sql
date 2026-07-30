-- Add snapshot_mode column to track assessment-only snapshots
ALTER TABLE public.analysis_input_snapshots
  ADD COLUMN IF NOT EXISTS snapshot_mode text NOT NULL DEFAULT 'standard';

COMMENT ON COLUMN public.analysis_input_snapshots.snapshot_mode IS
  'standard = broker-entered workspace inputs required; assessment_only = generated from submitted Propel assessment alone';
