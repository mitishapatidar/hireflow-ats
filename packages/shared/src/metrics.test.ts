import { describe, it, expect } from 'vitest';
import {
  getISTMonthBoundaries,
  getPreviousISTMonthBoundaries,
  getISTDayBoundaries,
  calculateMonthOverMonthDelta,
  calculateTargetProgress,
  formatAsOfTimestamp,
} from './metrics';

describe('Prompt 15 — Centralized Shared Metrics Engine Tests', () => {
  describe('Month-over-Month Delta Calculator', () => {
    it('handles zero previous baseline with positive current value without NaN or Infinity', () => {
      const delta = calculateMonthOverMonthDelta(5, 0);
      expect(delta.difference).toBe(5);
      expect(delta.isNew).toBe(true);
      expect(delta.isPositive).toBe(true);
      expect(delta.displayText).toBe('+5 new vs last month');
    });

    it('handles zero previous and zero current baseline', () => {
      const delta = calculateMonthOverMonthDelta(0, 0);
      expect(delta.difference).toBe(0);
      expect(delta.percentageChange).toBe(0);
      expect(delta.displayText).toBe('0% vs last month');
    });

    it('computes positive percentage increase correctly', () => {
      const delta = calculateMonthOverMonthDelta(15, 10);
      expect(delta.difference).toBe(5);
      expect(delta.percentageChange).toBe(50);
      expect(delta.isPositive).toBe(true);
      expect(delta.displayText).toBe('+50% vs last month');
    });

    it('computes negative percentage drop correctly', () => {
      const delta = calculateMonthOverMonthDelta(8, 10);
      expect(delta.difference).toBe(-2);
      expect(delta.percentageChange).toBe(-20);
      expect(delta.isPositive).toBe(false);
      expect(delta.displayText).toBe('-20% vs last month');
    });
  });

  describe('Target Progress Calculator', () => {
    it('calculates progress percentage and remaining targets accurately', () => {
      const result = calculateTargetProgress(7, 10);
      expect(result.actual).toBe(7);
      expect(result.target).toBe(10);
      expect(result.remaining).toBe(3);
      expect(result.progressPercentage).toBe(70);
      expect(result.isMet).toBe(false);
    });

    it('caps progress percentage at 100% and sets remaining to 0 when exceeded', () => {
      const result = calculateTargetProgress(14, 10);
      expect(result.actual).toBe(14);
      expect(result.remaining).toBe(0);
      expect(result.progressPercentage).toBe(100);
      expect(result.isMet).toBe(true);
    });

    it('safely handles zero target without division by zero', () => {
      const result = calculateTargetProgress(5, 0);
      expect(result.remaining).toBe(0);
      expect(result.progressPercentage).toBe(100);
      expect(result.isMet).toBe(true);
    });
  });

  describe('IST Date Boundary Helpers', () => {
    it('computes current and previous month boundaries in UTC', () => {
      const refDate = new Date('2026-11-06T12:00:00Z');
      const currentMonth = getISTMonthBoundaries(refDate);
      const prevMonth = getPreviousISTMonthBoundaries(refDate);

      expect(currentMonth.label).toContain('November 2026');
      expect(prevMonth.label).toContain('October 2026');
      expect(currentMonth.startUtc.getTime()).toBeGreaterThan(prevMonth.startUtc.getTime());
    });

    it('computes today boundaries in IST', () => {
      const refDate = new Date('2026-11-06T12:00:00Z');
      const today = getISTDayBoundaries(refDate);
      expect(today.label).toContain('06/11/2026');
      expect(today.endUtc.getTime()).toBeGreaterThan(today.startUtc.getTime());
    });
  });

  describe('As-Of Timestamp Formatter', () => {
    it('formats calculation timestamp cleanly in IST with AM/PM', () => {
      const refDate = new Date('2026-11-06T13:00:00Z'); // 13:00 UTC = 18:30 IST
      const formatted = formatAsOfTimestamp(refDate);
      expect(formatted).toContain('06 Nov 2026');
      expect(formatted).toContain('06:30 PM IST');
    });
  });
});
