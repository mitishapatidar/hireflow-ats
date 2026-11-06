/**
 * Deterministic Candidate-Job Match Percentage Calculator
 * Strictly reproducible without any AI/LLM dependency.
 *
 * Scoring Weights:
 * - Skills overlap:    50%
 * - Experience fit:    25%
 * - Location fit:      15%
 * - Salary fit:        10%
 */

export const MATCH_SCORING_VERSION = '1.0.0';

export interface MatchWeights {
  skills: number;
  experience: number;
  location: number;
  salary: number;
}

export const DEFAULT_MATCH_WEIGHTS: MatchWeights = {
  skills: 0.50,
  experience: 0.25,
  location: 0.15,
  salary: 0.10,
};

export interface MatchCandidateInput {
  name?: string;
  skills?: string[];
  experienceYears?: number | null;
  expectedSalary?: number | null;
  location?: string | null;
}

export interface MatchJobInput {
  title?: string;
  requiredSkills?: string[];
  requirements?: string | null;
  experienceMin?: number | null;
  experienceMax?: number | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  location?: string | null;
}

export interface MatchBreakdown {
  skills: {
    score: number;
    weight: number;
    matchedSkills: string[];
    missingSkills: string[];
    totalRequired: number;
  };
  experience: {
    score: number;
    weight: number;
    candidateYears: number | null;
    requiredMin: number | null;
    requiredMax: number | null;
    details: string;
  };
  location: {
    score: number;
    weight: number;
    candidateLocation: string | null;
    jobLocation: string | null;
    matchType: 'REMOTE' | 'EXACT' | 'PARTIAL' | 'MISMATCH' | 'MISSING';
    details: string;
  };
  salary: {
    score: number;
    weight: number;
    candidateExpected: number | null;
    jobSalaryMin: number | null;
    jobSalaryMax: number | null;
    matchType: 'IN_BUDGET' | 'UNDER_BUDGET' | 'OVER_BUDGET_SLIGHT' | 'OVER_BUDGET_HIGH' | 'MISSING';
    details: string;
  };
}

export interface MatchCalculationResult {
  overallScore: number; // 0 to 100 integer
  algorithmVersion: string;
  calculatedAt: string;
  breakdown: MatchBreakdown;
  explanation: string[];
}

/**
 * Normalizes skill strings: trimmed, lowercased, common symbol standardizations.
 */
export function normalizeSkill(skill: string): string {
  return skill
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\.js$/i, '')
    .replace(/^reactjs$/i, 'react')
    .replace(/^nodejs$/i, 'node')
    .replace(/^postgres$/i, 'postgresql');
}

/**
 * Extracts candidate skills safely from array or comma-separated string.
 */
function extractSkillSet(skills?: string[] | null): Set<string> {
  const set = new Set<string>();
  if (!skills || !Array.isArray(skills)) return set;
  for (const s of skills) {
    if (typeof s === 'string' && s.trim()) {
      set.add(normalizeSkill(s));
    }
  }
  return set;
}

/**
 * Extracts required skills from Job requiredSkills array, with fallback to parsing requirements text.
 */
function extractJobSkills(job: MatchJobInput): string[] {
  if (job.requiredSkills && Array.isArray(job.requiredSkills) && job.requiredSkills.length > 0) {
    return Array.from(new Set(job.requiredSkills.map(normalizeSkill)));
  }

  // Fallback: parse known common keywords from requirements string if present
  if (job.requirements && typeof job.requirements === 'string') {
    const rawTokens = job.requirements
      .split(/[,;\n•\/\-]/)
      .map((t) => t.trim())
      .filter((t) => t.length > 1 && t.length < 30);
    return Array.from(new Set(rawTokens.map(normalizeSkill))).slice(0, 10);
  }

  return [];
}

/**
 * 1. Calculate Skills Overlap Score (0-100)
 */
export function calculateSkillsFit(
  candidateSkills: string[],
  requiredSkills: string[]
): { score: number; matchedSkills: string[]; missingSkills: string[] } {
  if (requiredSkills.length === 0) {
    // If no specific required skills are listed, full match by default
    return { score: 100, matchedSkills: candidateSkills, missingSkills: [] };
  }

  const candSet = extractSkillSet(candidateSkills);
  const matched: string[] = [];
  const missing: string[] = [];

  for (const req of requiredSkills) {
    const norm = normalizeSkill(req);
    // Exact or substring match (e.g. "typescript" matches "typescript" or "ts")
    let hasMatch = candSet.has(norm);
    if (!hasMatch) {
      for (const cs of candSet) {
        if (cs.includes(norm) || norm.includes(cs)) {
          hasMatch = true;
          break;
        }
      }
    }

    if (hasMatch) {
      matched.push(req);
    } else {
      missing.push(req);
    }
  }

  const score = Math.round((matched.length / requiredSkills.length) * 100);
  return { score: Math.min(100, Math.max(0, score)), matchedSkills: matched, missingSkills: missing };
}

/**
 * 2. Calculate Experience Fit Score (0-100)
 */
export function calculateExperienceFit(
  candidateYears: number | null | undefined,
  minYears: number | null | undefined,
  maxYears: number | null | undefined
): { score: number; details: string } {
  // If no requirements specified on job, full match
  if (minYears == null && maxYears == null) {
    return { score: 100, details: 'Job mandate does not specify required experience.' };
  }

  // If candidate experience is missing, explicit 0 score with documented explanation
  if (candidateYears == null || isNaN(candidateYears)) {
    return { score: 0, details: 'Candidate experience is unspecified or missing from profile.' };
  }

  const min = minYears ?? 0;
  const max = maxYears ?? min + 5; // Default max is min + 5 if unspecified

  if (candidateYears >= min && candidateYears <= max) {
    return {
      score: 100,
      details: `Candidate has ${candidateYears} years of experience, perfectly within required range (${min}–${max}y).`,
    };
  }

  if (candidateYears < min) {
    if (min === 0) return { score: 100, details: 'Entry level requirement satisfied.' };
    const ratio = candidateYears / min;
    const score = Math.max(0, Math.min(90, Math.round(ratio * 100)));
    return {
      score,
      details: `Candidate has ${candidateYears} years experience, below the minimum threshold of ${min} years.`,
    };
  }

  // Candidate experience > max (Overqualified)
  const diff = candidateYears - max;
  const score = Math.max(70, Math.round(100 - diff * 5));
  return {
    score,
    details: `Candidate has ${candidateYears} years experience, exceeding the preferred upper bound (${max}y). Overqualification score: ${score}%.`,
  };
}

/**
 * 3. Calculate Location Fit Score (0-100)
 */
export function calculateLocationFit(
  candidateLoc: string | null | undefined,
  jobLoc: string | null | undefined
): { score: number; matchType: MatchBreakdown['location']['matchType']; details: string } {
  if (!jobLoc || !jobLoc.trim()) {
    return { score: 100, matchType: 'REMOTE', details: 'Job location is open / unspecified.' };
  }
  if (!candidateLoc || !candidateLoc.trim()) {
    return { score: 50, matchType: 'MISSING', details: 'Candidate location is missing. Scored neutrally at 50%.' };
  }

  const cClean = candidateLoc.trim().toLowerCase();
  const jClean = jobLoc.trim().toLowerCase();

  // Check remote compatibility
  if (jClean.includes('remote') || cClean.includes('remote') || jClean.includes('anywhere')) {
    return { score: 100, matchType: 'REMOTE', details: 'Remote-friendly match.' };
  }

  // Exact or city match
  if (cClean === jClean || cClean.includes(jClean) || jClean.includes(cClean)) {
    return { score: 100, matchType: 'EXACT', details: `Exact location match: ${jobLoc}.` };
  }

  // Major Indian tech hubs cross-check
  const metroKeywords = ['bengaluru', 'bangalore', 'mumbai', 'pune', 'delhi', 'noida', 'gurugram', 'hyderabad', 'chennai'];
  const cInMetro = metroKeywords.some((m) => cClean.includes(m));
  const jInMetro = metroKeywords.some((m) => jClean.includes(m));

  if (cInMetro && jInMetro) {
    // Cross-metro domestic relocatable
    return { score: 70, matchType: 'PARTIAL', details: `Candidate is in ${candidateLoc}, job in ${jobLoc}. Domestic relocation candidate.` };
  }

  return { score: 30, matchType: 'MISMATCH', details: `Location mismatch: Candidate in ${candidateLoc}, job requires ${jobLoc}.` };
}

/**
 * 4. Calculate Salary Fit Score (0-100)
 */
export function calculateSalaryFit(
  candidateExpected: number | null | undefined,
  salaryMin: number | null | undefined,
  salaryMax: number | null | undefined
): { score: number; matchType: MatchBreakdown['salary']['matchType']; details: string } {
  if (salaryMin == null && salaryMax == null) {
    return { score: 100, matchType: 'IN_BUDGET', details: 'Job budget is open / not specified.' };
  }

  if (candidateExpected == null || isNaN(candidateExpected) || candidateExpected <= 0) {
    return { score: 50, matchType: 'MISSING', details: 'Candidate expected salary not provided. Neutral score.' };
  }

  const maxBudget = salaryMax ?? (salaryMin ? salaryMin * 1.3 : null);
  const minBudget = salaryMin ?? 0;

  if (maxBudget != null && candidateExpected <= maxBudget) {
    if (candidateExpected >= minBudget) {
      return { score: 100, matchType: 'IN_BUDGET', details: 'Expected salary aligns comfortably within job budget range.' };
    }
    return { score: 100, matchType: 'UNDER_BUDGET', details: 'Expected salary is within or below target budget.' };
  }

  if (maxBudget != null) {
    const overBudgetRatio = (candidateExpected - maxBudget) / maxBudget;
    if (overBudgetRatio <= 0.10) {
      return { score: 80, matchType: 'OVER_BUDGET_SLIGHT', details: 'Candidate expectation is within 10% of maximum budget.' };
    }
    if (overBudgetRatio <= 0.25) {
      return { score: 50, matchType: 'OVER_BUDGET_SLIGHT', details: 'Candidate expectation is 10–25% above budget ceiling.' };
    }
    return { score: 20, matchType: 'OVER_BUDGET_HIGH', details: 'Candidate expectation exceeds job budget ceiling by >25%.' };
  }

  return { score: 100, matchType: 'IN_BUDGET', details: 'Salary fits target parameters.' };
}

/**
 * Master Deterministic Candidate Match Calculation Function
 */
export function calculateCandidateJobMatch(
  candidate: MatchCandidateInput,
  job: MatchJobInput,
  weights: MatchWeights = DEFAULT_MATCH_WEIGHTS
): MatchCalculationResult {
  const jobSkills = extractJobSkills(job);
  const candSkills = candidate.skills || [];

  const skillsResult = calculateSkillsFit(candSkills, jobSkills);
  const expResult = calculateExperienceFit(candidate.experienceYears, job.experienceMin, job.experienceMax);
  const locResult = calculateLocationFit(candidate.location, job.location);
  const salResult = calculateSalaryFit(candidate.expectedSalary, job.salaryMin, job.salaryMax);

  // Compute weighted sum
  const weightedSum =
    skillsResult.score * weights.skills +
    expResult.score * weights.experience +
    locResult.score * weights.location +
    salResult.score * weights.salary;

  const totalWeights = weights.skills + weights.experience + weights.location + weights.salary;
  const rawScore = totalWeights > 0 ? weightedSum / totalWeights : 0;
  const overallScore = Math.min(100, Math.max(0, Math.round(rawScore)));

  const explanation: string[] = [
    `Skills Fit: ${skillsResult.score}% (weight: ${Math.round(weights.skills * 100)}%) — Matched ${skillsResult.matchedSkills.length}/${jobSkills.length || candSkills.length} skills.`,
    `Experience Fit: ${expResult.score}% (weight: ${Math.round(weights.experience * 100)}%) — ${expResult.details}`,
    `Location Fit: ${locResult.score}% (weight: ${Math.round(weights.location * 100)}%) — ${locResult.details}`,
    `Salary Fit: ${salResult.score}% (weight: ${Math.round(weights.salary * 100)}%) — ${salResult.details}`,
  ];

  return {
    overallScore,
    algorithmVersion: MATCH_SCORING_VERSION,
    calculatedAt: new Date().toISOString(),
    breakdown: {
      skills: {
        score: skillsResult.score,
        weight: weights.skills,
        matchedSkills: skillsResult.matchedSkills,
        missingSkills: skillsResult.missingSkills,
        totalRequired: jobSkills.length,
      },
      experience: {
        score: expResult.score,
        weight: weights.experience,
        candidateYears: candidate.experienceYears ?? null,
        requiredMin: job.experienceMin ?? null,
        requiredMax: job.experienceMax ?? null,
        details: expResult.details,
      },
      location: {
        score: locResult.score,
        weight: weights.location,
        candidateLocation: candidate.location ?? null,
        jobLocation: job.location ?? null,
        matchType: locResult.matchType,
        details: locResult.details,
      },
      salary: {
        score: salResult.score,
        weight: weights.salary,
        candidateExpected: candidate.expectedSalary ?? null,
        jobSalaryMin: job.salaryMin ?? null,
        jobSalaryMax: job.salaryMax ?? null,
        matchType: salResult.matchType,
        details: salResult.details,
      },
    },
    explanation,
  };
}
