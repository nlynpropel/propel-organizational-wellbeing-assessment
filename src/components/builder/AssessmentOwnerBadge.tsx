import Badge from '../ui/Badge';
import { Shield, User } from 'lucide-react';
import type { AssessmentOwnerType } from '../../lib/database.types';

export default function AssessmentOwnerBadge({ ownerType }: { ownerType: AssessmentOwnerType }) {
  return (
    <Badge variant={ownerType === 'propel' ? 'warning' : 'info'}>
      {ownerType === 'propel' ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
      {ownerType === 'propel' ? 'Propel' : 'Custom'}
    </Badge>
  );
}
