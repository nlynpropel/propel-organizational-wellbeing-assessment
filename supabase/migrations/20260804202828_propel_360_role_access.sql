/*
# Propel 360 — Role Access Seeding

## Overview
Seeds the `assessment_role_access` table for the Propel 360 Engagement Assessment template.

## Role Access Rules
- superadmin: full access (view, send, view reports) — handled by platform admin logic, not seeded here
- propel_csm: can_view = true, can_send = true, can_view_reports = true
- propel_sales: no access (no row seeded = deny by default)
- broker: no access (no row seeded = deny by default)

## Notes
- The template_id is the fixed UUID of the Propel 360 Engagement Assessment.
- propel_sales and broker are deliberately NOT seeded — absence of a row means deny.
- superadmin access is handled at the application level via platform_admin membership.
*/

INSERT INTO assessment_role_access (assessment_template_id, role, can_view, can_send, can_view_reports)
VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001'::uuid, 'propel_csm', true, true, true)
ON CONFLICT (assessment_template_id, role) DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_send = EXCLUDED.can_send,
  can_view_reports = EXCLUDED.can_view_reports,
  updated_at = now();