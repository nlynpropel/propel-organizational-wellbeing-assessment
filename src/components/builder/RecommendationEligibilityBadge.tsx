import Badge from '../ui/Badge';
import { Sparkles, Ban } from 'lucide-react';

export default function RecommendationEligibilityBadge({
  ownerType,
  recommendationsEnabled,
}: {
  ownerType: 'propel' | 'broker';
  recommendationsEnabled: boolean;
}) {
  const eligible = ownerType === 'propel' && recommendationsEnabled;
  return (
    <Badge variant={eligible ? 'success' : 'neutral'}>
      {eligible ? <Sparkles className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
      {eligible ? 'Recommendations included' : 'No recommendations'}
    </Badge>
  );
}
