import { describe, it, expect } from 'vitest';
import {
  wouldCreateReportingCycle,
  wouldCreateReportingCycleSync,
  isManagerEligible,
} from './hierarchy';
import { UserRole } from './roles';

describe('Reporting Hierarchy & Cycle Detection Algorithm', () => {
  // Graph:
  // Anika (Admin, top-level: manager = null)
  //   ↳ Riya (Manager: manager = Anika)
  //       ↳ Rahul (Recruiter: manager = Riya)
  //       ↳ Mitisha (Recruiter: manager = Riya)
  //           ↳ Junior (Recruiter: manager = Mitisha)
  const graph: Record<string, string | null> = {
    'user-anika': null,
    'user-riya': 'user-anika',
    'user-rahul': 'user-riya',
    'user-mitisha': 'user-riya',
    'user-junior': 'user-mitisha',
  };

  const getManagerSync = (id: string) => graph[id] ?? null;
  const getManagerAsync = async (id: string) => graph[id] ?? null;

  describe('wouldCreateReportingCycleSync', () => {
    it('returns false when proposed manager is null (top level)', () => {
      expect(wouldCreateReportingCycleSync('user-riya', null, getManagerSync)).toBe(false);
      expect(wouldCreateReportingCycleSync('user-rahul', undefined, getManagerSync)).toBe(false);
    });

    it('returns true when a user attempts to report to themselves', () => {
      expect(wouldCreateReportingCycleSync('user-riya', 'user-riya', getManagerSync)).toBe(true);
      expect(wouldCreateReportingCycleSync('user-anika', 'user-anika', getManagerSync)).toBe(true);
    });

    it('returns false for valid hierarchical assignment', () => {
      // Rahul reporting to Anika directly is a valid upward skip
      expect(wouldCreateReportingCycleSync('user-rahul', 'user-anika', getManagerSync)).toBe(false);
    });

    it('detects and prevents 2-hop immediate reporting cycles', () => {
      // Riya currently manages Rahul (Rahul -> Riya).
      // If Riya reports to Rahul: Riya -> Rahul -> Riya (Cycle!)
      expect(wouldCreateReportingCycleSync('user-riya', 'user-rahul', getManagerSync)).toBe(true);
    });

    it('detects and prevents 3-hop and deeper reporting cycles', () => {
      // Anika -> null
      // Riya -> Anika
      // Mitisha -> Riya
      // Junior -> Mitisha
      // If Anika reports to Junior: Anika -> Junior -> Mitisha -> Riya -> Anika (Cycle!)
      expect(wouldCreateReportingCycleSync('user-anika', 'user-junior', getManagerSync)).toBe(true);
      expect(wouldCreateReportingCycleSync('user-anika', 'user-mitisha', getManagerSync)).toBe(true);
      expect(wouldCreateReportingCycleSync('user-riya', 'user-junior', getManagerSync)).toBe(true);
    });
  });

  describe('wouldCreateReportingCycle (Async)', () => {
    it('returns identical cycle detection results asynchronously', async () => {
      expect(await wouldCreateReportingCycle('user-riya', null, getManagerAsync)).toBe(false);
      expect(await wouldCreateReportingCycle('user-riya', 'user-riya', getManagerAsync)).toBe(true);
      expect(await wouldCreateReportingCycle('user-riya', 'user-rahul', getManagerAsync)).toBe(true);
      expect(await wouldCreateReportingCycle('user-anika', 'user-junior', getManagerAsync)).toBe(true);
      expect(await wouldCreateReportingCycle('user-rahul', 'user-anika', getManagerAsync)).toBe(false);
    });
  });

  describe('isManagerEligible', () => {
    it('allows ACTIVE Managers and Admins', () => {
      expect(isManagerEligible(UserRole.MANAGER, 'ACTIVE', false)).toBe(true);
      expect(isManagerEligible(UserRole.ADMIN, 'ACTIVE', false)).toBe(true);
    });

    it('rejects Recruiters, Clients, and Candidates from being managers', () => {
      expect(isManagerEligible(UserRole.RECRUITER, 'ACTIVE', false)).toBe(false);
      expect(isManagerEligible(UserRole.CLIENT, 'ACTIVE', false)).toBe(false);
      expect(isManagerEligible(UserRole.CANDIDATE, 'ACTIVE', false)).toBe(false);
    });

    it('rejects Inactive or Archived Managers', () => {
      expect(isManagerEligible(UserRole.MANAGER, 'DISABLED', false)).toBe(false);
      expect(isManagerEligible(UserRole.MANAGER, 'SUSPENDED', false)).toBe(false);
      expect(isManagerEligible(UserRole.MANAGER, 'ACTIVE', true)).toBe(false);
      expect(isManagerEligible(UserRole.ADMIN, 'ACTIVE', true)).toBe(false);
    });
  });
});
