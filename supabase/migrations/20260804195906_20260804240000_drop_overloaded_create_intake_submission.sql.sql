-- Drop the old overloaded create_intake_submission with p_region parameter
DROP FUNCTION IF EXISTS create_intake_submission(uuid, text, text, text, integer, text, text);
