export type ParticipationOpportunityResult = {
  header: string;
  primary: {
    title: string;
    explanation: string;
    likely_cause: string;
    thirty_day_action: string;
    measure: string;
    how_connect_can_help: string;
  };
  secondary: {
    title: string;
    description: string;
    connect_capability: string;
  } | null;
  closing: string;
  cta: string;
};

export async function fetchParticipationOpportunityResult(
  token: string
): Promise<ParticipationOpportunityResult> {
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-participation-opportunity-result`;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${anonKey}`,
      'apikey': anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ secure_token: token }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Failed to load your result: ${response.status} ${body}`);
  }

  return response.json();
}