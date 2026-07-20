-- regenerate_assessment_token: generate a new secure_token for an assessment instance.
-- Rules:
--   * Only the owning broker or an admin may regenerate.
--   * Generate a new secure token, invalidating the old token immediately.
--   * Preserve the instance, responses, version, and client.
--   * Disallow regeneration after submission unless the caller is an admin.
--   * Return the new token + public URL data.

CREATE OR REPLACE FUNCTION public.regenerate_assessment_token(p_instance_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_instance assessment_instances%ROWTYPE;
  v_new_token uuid;
  v_is_admin boolean;
BEGIN
  SELECT * INTO v_instance FROM public.assessment_instances WHERE id = p_instance_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Assessment instance not found');
  END IF;

  SELECT is_active_admin() INTO v_is_admin;

  -- Authorization: owning broker or admin.
  IF NOT v_is_admin AND v_instance.broker_id <> auth.uid() THEN
    RETURN jsonb_build_object('error', 'Not authorized to regenerate this link');
  END IF;

  -- Disallow after submission unless admin.
  IF v_instance.status IN ('submitted', 'expired', 'revoked') AND NOT v_is_admin THEN
    RETURN jsonb_build_object('error', 'Cannot regenerate a link for a submitted assessment');
  END IF;

  v_new_token := gen_random_uuid();

  UPDATE public.assessment_instances
  SET secure_token = v_new_token
  WHERE id = p_instance_id;

  RETURN jsonb_build_object(
    'instance_id', p_instance_id,
    'secure_token', v_new_token
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.regenerate_assessment_token(uuid) TO authenticated;