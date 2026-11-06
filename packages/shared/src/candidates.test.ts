import { describe, it, expect } from 'vitest';
import {
  CandidateFilterSchema,
  UpdateCandidateSchema,
  CreateCandidateNoteSchema,
  CandidateHandoverSchema,
  ArchiveCandidateSchema,
  formatINR,
  formatExperience,
} from './candidates';

describe('Candidate Shared Schemas & Helpers', () => {
  describe('formatINR', () => {
    it('formats LPA amounts correctly', () => {
      expect(formatINR(3200000)).toBe('₹32 LPA');
      expect(formatINR(850000)).toBe('₹8.5 LPA');
      expect(formatINR(1200000)).toBe('₹12 LPA');
    });

    it('formats sub-lakh amounts with Indian formatting', () => {
      expect(formatINR(50000)).toBe('₹50,000');
    });

    it('handles null, undefined, 0 gracefully', () => {
      expect(formatINR(null)).toBe('—');
      expect(formatINR(undefined)).toBe('—');
      expect(formatINR(0)).toBe('—');
    });
  });

  describe('formatExperience', () => {
    it('formats years properly', () => {
      expect(formatExperience(8.5)).toBe('8.5 years');
      expect(formatExperience(1)).toBe('1 year');
      expect(formatExperience(0)).toBe('Fresher');
      expect(formatExperience(null)).toBe('—');
    });
  });

  describe('CandidateFilterSchema', () => {
    it('applies defaults correctly', () => {
      const parsed = CandidateFilterSchema.parse({});
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(20);
      expect(parsed.sortBy).toBe('updatedAt');
      expect(parsed.sortOrder).toBe('desc');
      expect(parsed.includeArchived).toBe(false);
      expect(parsed.tags).toEqual([]);
    });

    it('parses comma-separated tags into an array', () => {
      const parsed = CandidateFilterSchema.parse({
        tags: 'React, TypeScript, Node.js',
      });
      expect(parsed.tags).toEqual(['React', 'TypeScript', 'Node.js']);
    });

    it('coerces string booleans for includeArchived', () => {
      const parsed = CandidateFilterSchema.parse({
        includeArchived: 'true',
      });
      expect(parsed.includeArchived).toBe(true);
    });
  });

  describe('UpdateCandidateSchema', () => {
    it('validates a complete update payload', () => {
      const valid = UpdateCandidateSchema.parse({
        name: 'Aarav Shah',
        email: 'aarav@example.com',
        currentTitle: 'Staff Engineer',
        experienceYears: 8.5,
        currentSalary: 3200000,
        expectedSalary: 4200000,
        skills: ['React', 'TypeScript'],
      });
      expect(valid.name).toBe('Aarav Shah');
      expect(valid.skills).toHaveLength(2);
    });

    it('rejects empty candidate name', () => {
      expect(() =>
        UpdateCandidateSchema.parse({
          name: '',
        })
      ).toThrow();
    });
  });

  describe('CreateCandidateNoteSchema', () => {
    it('defaults isInternalOnly to true', () => {
      const note = CreateCandidateNoteSchema.parse({
        content: 'Strong in React design systems, communicated well.',
      });
      expect(note.isInternalOnly).toBe(true);
    });

    it('rejects empty content', () => {
      expect(() =>
        CreateCandidateNoteSchema.parse({
          content: '   ',
        })
      ).toThrow();
    });
  });

  describe('CandidateHandoverSchema', () => {
    it('validates newOwnerId and reason', () => {
      const handover = CandidateHandoverSchema.parse({
        newOwnerId: 'user-priya',
        reason: 'Handing over due to reassignment to Bangalore client mandate.',
      });
      expect(handover.newOwnerId).toBe('user-priya');
    });

    it('rejects too short reason', () => {
      expect(() =>
        CandidateHandoverSchema.parse({
          newOwnerId: 'user-priya',
          reason: 'No',
        })
      ).toThrow();
    });
  });

  describe('ArchiveCandidateSchema', () => {
    it('requires a reason of at least 3 characters', () => {
      const archive = ArchiveCandidateSchema.parse({
        reason: 'Candidate accepted an offer elsewhere.',
      });
      expect(archive.reason).toBe('Candidate accepted an offer elsewhere.');

      expect(() => ArchiveCandidateSchema.parse({ reason: 'ab' })).toThrow();
    });
  });
});
