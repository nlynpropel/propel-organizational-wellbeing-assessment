/*
# Intake Opportunity Index respondent summary

Expose a deliberately limited, token-scoped result payload for submitted
Propel Well-being Opportunity Index assessments created through reusable intake
links. The payload includes only overall/section/behavioral scores and score
bands. It does not expose recommendations, strengths, priority opportunities,
or internal AI analysis.
*/

CREATE OR REPLACE FUNCTION public.get_intake_opportunity_index_summary(p_secure_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instance public.assessment_instances;
  v_result public.assessment_results;
  v_template public.assessment_templates;
  v_version public.assessment_versions;
  v_readiness jsonb;
  v_sections jsonb;
  v_bands jsonb;
BEGIN
  SELECT ai.* INTO v_instance
  FROM public.assessment_instances ai
  WHERE ai.secure_token = p_secure_token
    AND ai.status = 'submitted'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Submitted assessment not found');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.intake_submissions i
    WHERE i.assessment_instance_id = v_instance.id
      AND i.status = 'submitted'
  ) THEN
    RETURN jsonb_build_object('error', 'Result summary is not available for this assessment');
  END IF;

  SELECT * INTO v_template
  FROM public.assessment_templates
  WHERE id = v_instance.assessment_template_id;

  IF NOT FOUND
     OR v_template.name <> 'Propel Well-being Opportunity Index'
     OR v_template.owner_type <> 'propel'
     OR NOT v_template.scoring_enabled THEN
    RETURN jsonb_build_object('error', 'Result summary is not available for this assessment');
  END IF;

  SELECT * INTO v_version
  FROM public.assessment_versions
  WHERE id = v_instance.assessment_version_id;

  SELECT * INTO v_result
  FROM public.assessment_results
  WHERE assessment_instance_id = v_instance.id
  ORDER BY completed_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Assessment results are not ready yet');
  END IF;

  v_readiness := COALESCE(v_result.result_snapshot -> 'behavioral_readiness', '{}'::jsonb);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'title', s.title,
    'display_order', s.display_order,
    'normalized_score', ss.normalized_score
  ) ORDER BY s.display_order), '[]'::jsonb)
  INTO v_sections
  FROM public.assessment_sections s
  LEFT JOIN public.assessment_section_scores ss
    ON ss.section_id = s.id
   AND ss.assessment_instance_id = v_instance.id
  WHERE s.assessment_version_id = v_instance.assessment_version_id
    AND s.is_scored = true;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', b.id,
    'assessment_version_id', b.assessment_version_id,
    'band_name', b.band_name,
    'min_threshold', b.min_threshold,
    'max_threshold', b.max_threshold,
    'display_order', b.display_order
  ) ORDER BY b.display_order), '[]'::jsonb)
  INTO v_bands
  FROM public.assessment_score_bands b
  WHERE b.assessment_version_id = v_instance.assessment_version_id;

  RETURN jsonb_build_object(
    'assessment_instance_id', v_instance.id,
    'template_name', v_template.name,
    'organization_name', (
      SELECT o.organization_name
      FROM public.organizations o
      WHERE o.id = v_instance.organization_id
    ),
    'respondent_name', v_instance.respondent_name,
    'submitted_at', v_instance.submitted_at,
    'overall_score', v_result.normalized_score,
    'score_band', v_result.score_band,
    'strategy_dimensions', v_sections,
    'behavioral_readiness', v_readiness,
    'score_bands', v_bands
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_intake_opportunity_index_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_intake_opportunity_index_summary(uuid) TO anon, authenticated;
