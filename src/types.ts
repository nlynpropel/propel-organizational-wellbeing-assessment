// Types used by placeholder score/recommendation display components.
// These remain in use while the scoring and recommendation engines are
// not yet implemented. Database row types live in lib/database.types.ts.

export type MaturityClass = 'Reactive' | 'Developing' | 'Established' | 'Strategic' | 'Leading';

export type RecommendationTier = 'Quick Win' | 'High-Impact Move';

export type RecommendationKind = 'strategy' | 'flag' | 'star' | 'target';

export type StrategyDimensionName =
  | 'Strategy and Leadership'
  | 'Employee Relevance'
  | 'Engagement and Communication'
  | 'Experience and Access'
  | 'Culture and Social Support'
  | 'Measurement and Improvement';

export type BehavioralDriverName =
  | 'Clarity of Value'
  | 'Motivation and Overcoming Inertia'
  | 'Trust and Social Proof'
  | 'Structural and Environmental Friction';

export type StrategyDimension = {
  name: StrategyDimensionName;
  score: number;
};

export type BehavioralDriver = {
  name: BehavioralDriverName;
  score: number;
};

export type Recommendation = {
  id: string;
  title: string;
  dimension: string;
  tier: RecommendationTier;
  kind: RecommendationKind;
  effort?: 'Low effort' | 'Medium effort' | 'High effort';
  impact?: 'Low impact' | 'Medium impact' | 'High impact' | 'High visibility';
};
