import { describe, it, expect } from 'vitest';
import {
  isPlatformAdmin,
  getPrimaryMembershipRole,
  hasCapability,
} from '../../services/capabilities';
import type { OrganizationMembershipRow, OrganizationCapability } from '../database.types';

function makeMembership(
  role: OrganizationMembershipRow['role'],
  status: OrganizationMembershipRow['status'] = 'active'
): OrganizationMembershipRow {
  return {
    id: crypto.randomUUID(),
    organization_id: crypto.randomUUID(),
    profile_id: 'test-profile-id',
    role,
    status,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe('capabilities', () => {
  describe('isPlatformAdmin', () => {
    it('returns true for active platform_admin membership', () => {
      const memberships = [makeMembership('platform_admin')];
      expect(isPlatformAdmin(memberships)).toBe(true);
    });

    it('returns false for advisor membership', () => {
      const memberships = [makeMembership('advisor')];
      expect(isPlatformAdmin(memberships)).toBe(false);
    });

    it('returns false for suspended platform_admin', () => {
      const memberships = [makeMembership('platform_admin', 'suspended')];
      expect(isPlatformAdmin(memberships)).toBe(false);
    });

    it('returns false for empty memberships', () => {
      expect(isPlatformAdmin([])).toBe(false);
    });
  });

  describe('getPrimaryMembershipRole', () => {
    it('returns platform_admin when present', () => {
      const memberships = [
        makeMembership('advisor'),
        makeMembership('platform_admin'),
      ];
      expect(getPrimaryMembershipRole(memberships)).toBe('platform_admin');
    });

    it('returns advisor when only advisor membership exists', () => {
      const memberships = [makeMembership('advisor')];
      expect(getPrimaryMembershipRole(memberships)).toBe('advisor');
    });

    it('returns null for empty memberships', () => {
      expect(getPrimaryMembershipRole([])).toBeNull();
    });

    it('prioritizes organization_admin over advisor', () => {
      const memberships = [
        makeMembership('advisor'),
        makeMembership('organization_admin'),
      ];
      expect(getPrimaryMembershipRole(memberships)).toBe('organization_admin');
    });
  });

  describe('hasCapability', () => {
    it('returns true when capability is in set', () => {
      const caps = new Set<OrganizationCapability>(['manage_clients', 'view_reports']);
      expect(hasCapability(caps, 'manage_clients')).toBe(true);
    });

    it('returns false when capability is not in set', () => {
      const caps = new Set<OrganizationCapability>(['view_reports']);
      expect(hasCapability(caps, 'manage_clients')).toBe(false);
    });

    it('returns false for empty set', () => {
      const caps = new Set<OrganizationCapability>();
      expect(hasCapability(caps, 'view_reports')).toBe(false);
    });
  });
});
