import { describe, it, expect } from 'vitest';
import {
  UserRole,
  getNavigationForRole,
  getDefaultRouteForRole,
  canAccessRoute,
  INTERNAL_NAVIGATION_ITEMS,
  CLIENT_NAVIGATION_ITEMS,
  CANDIDATE_NAVIGATION_ITEMS,
} from './index';

describe('Role-Based Navigation Configuration', () => {
  it('should return correct navigation items for RECRUITER', () => {
    const nav = getNavigationForRole(UserRole.RECRUITER);
    const paths = nav.map((item) => item.path);

    expect(paths).toContain('/dashboard');
    expect(paths).toContain('/candidates');
    expect(paths).toContain('/jobs');
    expect(paths).toContain('/interviews');
    expect(paths).toContain('/submissions');
    expect(paths).toContain('/offers');
    expect(paths).toContain('/clients');
    expect(paths).toContain('/reports');

    // Should NOT contain manager/admin specific paths
    expect(paths).not.toContain('/approvals');
    expect(paths).not.toContain('/assignments');
    expect(paths).not.toContain('/pipelines');
    expect(paths).not.toContain('/performance');
    expect(paths).not.toContain('/admin');
  });

  it('should return correct navigation items for MANAGER', () => {
    const nav = getNavigationForRole(UserRole.MANAGER);
    const paths = nav.map((item) => item.path);

    expect(paths).toContain('/dashboard');
    expect(paths).toContain('/approvals');
    expect(paths).toContain('/assignments');
    expect(paths).toContain('/pipelines');
    expect(paths).toContain('/performance');
    expect(paths).toContain('/admin');

    // Should NOT contain recruiter-only paths
    expect(paths).not.toContain('/candidates');
    expect(paths).not.toContain('/jobs');
    expect(paths).not.toContain('/submissions');
  });

  it('should return all internal items for ADMIN', () => {
    const nav = getNavigationForRole(UserRole.ADMIN);
    expect(nav.length).toBe(INTERNAL_NAVIGATION_ITEMS.length);
  });

  it('should return client portal items for CLIENT', () => {
    const nav = getNavigationForRole(UserRole.CLIENT);
    const paths = nav.map((item) => item.path);

    expect(paths).toEqual([
      '/portal',
      '/positions',
      '/submitted-profiles',
      '/portal/interviews',
      '/portal/reports',
    ]);
  });

  it('should return candidate portal items for CANDIDATE', () => {
    const nav = getNavigationForRole(UserRole.CANDIDATE);
    const paths = nav.map((item) => item.path);

    expect(paths).toEqual([
      '/my-dashboard',
      '/applications',
      '/my-interviews',
      '/profile',
    ]);
  });

  it('should return correct default route for each role', () => {
    expect(getDefaultRouteForRole(UserRole.RECRUITER)).toBe('/dashboard');
    expect(getDefaultRouteForRole(UserRole.MANAGER)).toBe('/dashboard');
    expect(getDefaultRouteForRole(UserRole.ADMIN)).toBe('/dashboard');
    expect(getDefaultRouteForRole(UserRole.CLIENT)).toBe('/portal');
    expect(getDefaultRouteForRole(UserRole.CANDIDATE)).toBe('/my-dashboard');
  });

  describe('canAccessRoute permission checks', () => {
    it('allows public routes for all roles', () => {
      expect(canAccessRoute(UserRole.RECRUITER, '/')).toBe(true);
      expect(canAccessRoute(UserRole.CLIENT, '/design')).toBe(true);
      expect(canAccessRoute(UserRole.CANDIDATE, '/no-permission')).toBe(true);
    });

    it('enforces recruiter permissions correctly', () => {
      expect(canAccessRoute(UserRole.RECRUITER, '/candidates')).toBe(true);
      expect(canAccessRoute(UserRole.RECRUITER, '/candidates/123')).toBe(true);
      expect(canAccessRoute(UserRole.RECRUITER, '/jobs')).toBe(true);
      expect(canAccessRoute(UserRole.RECRUITER, '/approvals')).toBe(false);
      expect(canAccessRoute(UserRole.RECRUITER, '/admin')).toBe(false);
      expect(canAccessRoute(UserRole.RECRUITER, '/portal')).toBe(false);
      expect(canAccessRoute(UserRole.RECRUITER, '/my-dashboard')).toBe(false);
    });

    it('enforces manager permissions correctly', () => {
      expect(canAccessRoute(UserRole.MANAGER, '/dashboard')).toBe(true);
      expect(canAccessRoute(UserRole.MANAGER, '/approvals')).toBe(true);
      expect(canAccessRoute(UserRole.MANAGER, '/pipelines')).toBe(true);
      expect(canAccessRoute(UserRole.MANAGER, '/candidates')).toBe(false);
      expect(canAccessRoute(UserRole.MANAGER, '/jobs')).toBe(false);
    });

    it('allows admin access to all configured routes', () => {
      expect(canAccessRoute(UserRole.ADMIN, '/dashboard')).toBe(true);
      expect(canAccessRoute(UserRole.ADMIN, '/candidates')).toBe(true);
      expect(canAccessRoute(UserRole.ADMIN, '/approvals')).toBe(true);
      expect(canAccessRoute(UserRole.ADMIN, '/portal')).toBe(true);
      expect(canAccessRoute(UserRole.ADMIN, '/my-dashboard')).toBe(true);
    });

    it('enforces client permissions correctly', () => {
      expect(canAccessRoute(UserRole.CLIENT, '/portal')).toBe(true);
      expect(canAccessRoute(UserRole.CLIENT, '/positions')).toBe(true);
      expect(canAccessRoute(UserRole.CLIENT, '/submitted-profiles')).toBe(true);
      expect(canAccessRoute(UserRole.CLIENT, '/portal/interviews')).toBe(true);
      expect(canAccessRoute(UserRole.CLIENT, '/dashboard')).toBe(false);
      expect(canAccessRoute(UserRole.CLIENT, '/candidates')).toBe(false);
      expect(canAccessRoute(UserRole.CLIENT, '/admin')).toBe(false);
    });

    it('enforces candidate permissions correctly', () => {
      expect(canAccessRoute(UserRole.CANDIDATE, '/my-dashboard')).toBe(true);
      expect(canAccessRoute(UserRole.CANDIDATE, '/applications')).toBe(true);
      expect(canAccessRoute(UserRole.CANDIDATE, '/my-interviews')).toBe(true);
      expect(canAccessRoute(UserRole.CANDIDATE, '/profile')).toBe(true);
      expect(canAccessRoute(UserRole.CANDIDATE, '/dashboard')).toBe(false);
      expect(canAccessRoute(UserRole.CANDIDATE, '/candidates')).toBe(false);
      expect(canAccessRoute(UserRole.CANDIDATE, '/portal')).toBe(false);
    });
  });
});
