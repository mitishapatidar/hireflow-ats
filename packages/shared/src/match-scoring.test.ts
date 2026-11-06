import { describe, it, expect } from 'vitest';
import {
  calculateCandidateJobMatch,
  calculateSkillsFit,
  calculateExperienceFit,
  calculateLocationFit,
  calculateSalaryFit,
  normalizeSkill,
  MATCH_SCORING_VERSION,
} from './match-scoring';

describe('Deterministic Candidate-Job Match Percentage Calculator (Prompt 13)', () => {
  it('1. calculates perfect 100% match across all 4 components', () => {
    const candidate = {
      name: 'Aarav Shah',
      skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Next.js'],
      experienceYears: 8,
      location: 'Bengaluru, India',
      expectedSalary: 3500000,
    };

    const job = {
      title: 'Staff Frontend Architect',
      requiredSkills: ['TypeScript', 'React', 'Next.js'],
      experienceMin: 7,
      experienceMax: 10,
      location: 'Bengaluru, India',
      salaryMin: 3200000,
      salaryMax: 4000000,
    };

    const result = calculateCandidateJobMatch(candidate, job);
    expect(result.overallScore).toBe(100);
    expect(result.algorithmVersion).toBe(MATCH_SCORING_VERSION);
    expect(result.breakdown.skills.score).toBe(100);
    expect(result.breakdown.experience.score).toBe(100);
    expect(result.breakdown.location.score).toBe(100);
    expect(result.breakdown.salary.score).toBe(100);
    expect(result.explanation.length).toBe(4);
  });

  it('2. correctly calculates partial skills overlap', () => {
    const candidateSkills = ['React', 'CSS', 'HTML'];
    const requiredSkills = ['React', 'TypeScript', 'GraphQL', 'Node.js']; // 1 out of 4 matches = 25%

    const result = calculateSkillsFit(candidateSkills, requiredSkills);
    expect(result.score).toBe(25);
    expect(result.matchedSkills).toEqual(['React']);
    expect(result.missingSkills).toEqual(['TypeScript', 'GraphQL', 'Node.js']);
  });

  it('3. normalizes skill casing, trailing .js, and aliases', () => {
    expect(normalizeSkill('  REACTJS  ')).toBe('react');
    expect(normalizeSkill('Node.js')).toBe('node');
    expect(normalizeSkill('Postgres')).toBe('postgresql');
  });

  it('4. penalizes candidate experience below the required minimum', () => {
    // 3 years experience for a job requiring minimum 6 years -> 50%
    const result = calculateExperienceFit(3, 6, 10);
    expect(result.score).toBe(50);
    expect(result.details).toContain('below the minimum threshold');
  });

  it('5. gracefully scales score for overqualified candidates', () => {
    // 14 years experience for a job requiring max 10 years
    const result = calculateExperienceFit(14, 6, 10);
    expect(result.score).toBe(80); // 100 - (14 - 10)*5 = 80
    expect(result.details).toContain('Overqualification score');
  });

  it('6. handles remote location compatibility with full 100% score', () => {
    const res1 = calculateLocationFit('Mumbai', 'Remote, India');
    expect(res1.score).toBe(100);
    expect(res1.matchType).toBe('REMOTE');

    const res2 = calculateLocationFit('Remote, Anywhere', 'Bengaluru, India');
    expect(res2.score).toBe(100);
    expect(res2.matchType).toBe('REMOTE');
  });

  it('7. assigns partial relocatable score for domestic tech hub cities', () => {
    const res = calculateLocationFit('Bengaluru', 'Hyderabad');
    expect(res.score).toBe(70);
    expect(res.matchType).toBe('PARTIAL');
  });

  it('8. penalizes salary expectations exceeding budget ceiling', () => {
    // Job budget: 20L to 30L
    // Candidate expects 32L (6.6% over budget ceiling -> 80% score)
    const resSlight = calculateSalaryFit(3200000, 2000000, 3000000);
    expect(resSlight.score).toBe(80);
    expect(resSlight.matchType).toBe('OVER_BUDGET_SLIGHT');

    // Candidate expects 45L (>25% over budget ceiling -> 20% score)
    const resHigh = calculateSalaryFit(4500000, 2000000, 3000000);
    expect(resHigh.score).toBe(20);
    expect(resHigh.matchType).toBe('OVER_BUDGET_HIGH');
  });

  it('9. handles missing candidate data safely without throwing errors', () => {
    const candidateEmpty = {};
    const job = {
      title: 'DevOps Engineer',
      requiredSkills: ['Kubernetes', 'Terraform', 'AWS'],
      experienceMin: 5,
      location: 'Pune',
      salaryMax: 2500000,
    };

    const result = calculateCandidateJobMatch(candidateEmpty, job);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
    expect(result.breakdown.experience.score).toBe(0);
    expect(result.breakdown.location.matchType).toBe('MISSING');
    expect(result.breakdown.salary.matchType).toBe('MISSING');
  });

  it('10. handles missing job requirements safely (open criteria)', () => {
    const candidate = {
      skills: ['Python', 'Django'],
      experienceYears: 4,
      location: 'Delhi',
      expectedSalary: 1800000,
    };
    const jobEmpty = {};

    const result = calculateCandidateJobMatch(candidate, jobEmpty);
    expect(result.overallScore).toBe(100);
    expect(result.breakdown.skills.score).toBe(100);
    expect(result.breakdown.experience.score).toBe(100);
    expect(result.breakdown.location.score).toBe(100);
    expect(result.breakdown.salary.score).toBe(100);
  });

  it('11. respects custom weights if provided', () => {
    const candidate = { skills: ['React'], experienceYears: 2 };
    const job = { requiredSkills: ['React', 'Angular'], experienceMin: 5 }; // Skills: 50%, Exp: 40%

    // Weight 100% on skills
    const resultSkillsOnly = calculateCandidateJobMatch(candidate, job, {
      skills: 1.0,
      experience: 0,
      location: 0,
      salary: 0,
    });
    expect(resultSkillsOnly.overallScore).toBe(50);
  });

  it('12. enforces algorithm versioning and reproducible timestamp', () => {
    const res = calculateCandidateJobMatch({}, {});
    expect(res.algorithmVersion).toBe('1.0.0');
    expect(typeof res.calculatedAt).toBe('string');
  });
});
