import Badge from '../ui/Badge';
import type { AssessmentVersionStatus } from '../../lib/database.types';

export default function AssessmentVersionBadge({ status }: { status: AssessmentVersionStatus }) {
  const variant = status === 'published' ? 'success' : status === 'draft' ? 'neutral' : 'danger';
  return <Badge variant={variant}>{status}</Badge>;
}
