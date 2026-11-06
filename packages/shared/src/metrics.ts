import { DEFAULT_TIMEZONE } from './interviews';

// ==========================================
// DATE & TIMEZONE BOUNDARIES (ASIA/KOLKATA)
// ==========================================

export interface DateBoundariesUTC {
  startUtc: Date;
  endUtc: Date;
  label: string;
}

/**
 * Calculates start and end of calendar month in IST (UTC+05:30) converted to UTC.
 */
export function getISTMonthBoundaries(referenceDate: Date = new Date()): DateBoundariesUTC {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(referenceDate.getTime() + istOffsetMs);

  const year = istTime.getUTCFullYear();
  const month = istTime.getUTCMonth();

  // Start of month in IST: Year-Month-01 00:00:00.000 IST
  const startIstMs = Date.UTC(year, month, 1, 0, 0, 0, 0);
  const startUtc = new Date(startIstMs - istOffsetMs);

  // End of month in IST: Year-(Month+1)-01 00:00:00.000 IST minus 1ms
  const nextMonthIstMs = Date.UTC(year, month + 1, 1, 0, 0, 0, 0);
  const endUtc = new Date(nextMonthIstMs - 1 - istOffsetMs);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  return {
    startUtc,
    endUtc,
    label: `${monthNames[month]} ${year}`,
  };
}

/**
 * Calculates start and end of previous calendar month in IST converted to UTC.
 */
export function getPreviousISTMonthBoundaries(referenceDate: Date = new Date()): DateBoundariesUTC {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(referenceDate.getTime() + istOffsetMs);

  let year = istTime.getUTCFullYear();
  let prevMonth = istTime.getUTCMonth() - 1;
  if (prevMonth < 0) {
    prevMonth = 11;
    year -= 1;
  }

  const startIstMs = Date.UTC(year, prevMonth, 1, 0, 0, 0, 0);
  const startUtc = new Date(startIstMs - istOffsetMs);

  const nextMonthIstMs = Date.UTC(year, prevMonth + 1, 1, 0, 0, 0, 0);
  const endUtc = new Date(nextMonthIstMs - 1 - istOffsetMs);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  return {
    startUtc,
    endUtc,
    label: `${monthNames[prevMonth]} ${year}`,
  };
}

/**
 * Calculates today's boundaries in IST converted to UTC.
 */
export function getISTDayBoundaries(referenceDate: Date = new Date()): DateBoundariesUTC {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(referenceDate.getTime() + istOffsetMs);

  const year = istTime.getUTCFullYear();
  const month = istTime.getUTCMonth();
  const day = istTime.getUTCDate();

  const startIstMs = Date.UTC(year, month, day, 0, 0, 0, 0);
  const startUtc = new Date(startIstMs - istOffsetMs);

  const endIstMs = Date.UTC(year, month, day, 23, 59, 59, 999);
  const endUtc = new Date(endIstMs - istOffsetMs);

  return {
    startUtc,
    endUtc,
    label: `${day.toString().padStart(2, '0')}/${(month + 1).toString().padStart(2, '0')}/${year}`,
  };
}

// ==========================================
// DELTA & COMPARISON CALCULATOR
// ==========================================

export interface MetricDelta {
  current: number;
  previous: number;
  difference: number;
  percentageChange: number;
  isPositive: boolean;
  isNew: boolean;
  displayText: string;
}

/**
 * Computes deterministic month-over-month or period-over-period delta.
 * Protects against division by zero (never emits NaN or Infinity).
 */
export function calculateMonthOverMonthDelta(
  current: number,
  previous: number,
  periodLabel: string = 'vs last month'
): MetricDelta {
  const diff = current - previous;

  // Zero previous-period baseline handling
  if (previous === 0) {
    if (current === 0) {
      return {
        current: 0,
        previous: 0,
        difference: 0,
        percentageChange: 0,
        isPositive: true,
        isNew: false,
        displayText: `0% ${periodLabel}`,
      };
    }
    return {
      current,
      previous: 0,
      difference: diff,
      percentageChange: 100,
      isPositive: true,
      isNew: true,
      displayText: `+${current} new ${periodLabel}`,
    };
  }

  const pct = Math.round(((current - previous) / previous) * 100);
  const isPositive = diff >= 0;
  const sign = isPositive ? '+' : '';

  return {
    current,
    previous,
    difference: diff,
    percentageChange: pct,
    isPositive,
    isNew: false,
    displayText: `${sign}${pct}% ${periodLabel}`,
  };
}

// ==========================================
// TARGET PROGRESS CALCULATOR
// ==========================================

export interface TargetProgress {
  actual: number;
  target: number;
  remaining: number;
  progressPercentage: number;
  isMet: boolean;
}

export function calculateTargetProgress(actual: number, target: number): TargetProgress {
  const safeActual = Math.max(0, actual || 0);
  const safeTarget = Math.max(0, target || 0);

  if (safeTarget === 0) {
    return {
      actual: safeActual,
      target: 0,
      remaining: 0,
      progressPercentage: 100,
      isMet: true,
    };
  }

  const remaining = Math.max(0, safeTarget - safeActual);
  const progressPercentage = Math.min(100, Math.round((safeActual / safeTarget) * 100));

  return {
    actual: safeActual,
    target: safeTarget,
    remaining,
    progressPercentage,
    isMet: safeActual >= safeTarget,
  };
}

/**
 * Formats a real calculation timestamp in Asia/Kolkata (IST).
 * Example: "06 Nov 2026, 06:30 PM IST"
 */
export function formatAsOfTimestamp(date: Date = new Date()): string {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + istOffsetMs);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = istDate.getUTCDate().toString().padStart(2, '0');
  const month = months[istDate.getUTCMonth()];
  const year = istDate.getUTCFullYear();

  let hours = istDate.getUTCHours();
  const minutes = istDate.getUTCMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hourStr = hours.toString().padStart(2, '0');

  return `Data as of ${day} ${month} ${year}, ${hourStr}:${minutes} ${ampm} IST`;
}

// ==========================================
// DTO DEFINITIONS
// ==========================================

export interface KpiCardData {
  title: string;
  value: number;
  delta: MetricDelta;
  metricKey: string;
}

export interface PipelineStageCount {
  stage: string;
  displayName: string;
  count: number;
  percentage: number;
  colorHex: string;
}

export interface TodayAgendaItem {
  id: string;
  timeIST: string;
  title: string;
  counterpartName: string;
  relatedJobOrMandate?: string | null;
  eventType: 'INTERVIEW' | 'CLIENT_MEETING' | 'FOLLOW_UP';
  status: string;
}

export interface RecentCandidateActivityItem {
  id: string;
  actorName: string;
  action: string;
  recordTitle: string;
  timeAgo: string;
  createdAt: string;
}

export interface RecruiterDailyActivitySummary {
  asOfTimestamp: string;
  candidatesSourced: TargetProgress;
  callsMade: TargetProgress;
  emailsSent: TargetProgress;
  submissionsSent: TargetProgress;
  interviewsCompleted: TargetProgress;
  overallScorePercentage: number;
}
