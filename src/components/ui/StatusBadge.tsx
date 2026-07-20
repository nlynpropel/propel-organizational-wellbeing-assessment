import Badge from './Badge';
import { ASSESSMENT_STATUS_LABELS, ASSESSMENT_STATUS_VARIANTS } from '../../lib/sampleData';
import type { AssessmentInstanceStatus } from '../../lib/database.types';

export default function StatusBadge({ status }: { status: AssessmentInstanceStatus }) {
  return (
    <Badge variant={ASSESSMENT_STATUS_VARIANTS[status]} dot>
      {ASSESSMENT_STATUS_LABELS[status]}
    </Badge>
  );
}
