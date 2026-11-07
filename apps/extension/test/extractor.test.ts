import { describe, it, expect } from 'vitest';
import {
  sanitizeText,
  extractEmailFromText,
  extractPhoneFromText,
  extractSkillsFromElements,
  extractCandidateProfile,
} from '../src/content/extractor';

describe('Chrome Extension DOM Extractor', () => {
  describe('Sanitizer & Regex Extractors', () => {
    it('sanitizes malicious script tags and html tags', () => {
      const malicious = '<script>alert("hack")</script><p>Clean <b>Text</b></p>';
      expect(sanitizeText(malicious)).toBe('Clean Text');
    });

    it('extracts valid email addresses from text', () => {
      const text = 'Reach me at rahul.verma@example.com or via telephone';
      expect(extractEmailFromText(text)).toBe('rahul.verma@example.com');
    });

    it('extracts Indian phone numbers from text', () => {
      const text = 'Mobile: +91 98765 43210. Available 9am to 6pm';
      expect(extractPhoneFromText(text)).toBe('+919876543210');
    });

    it('extracts unique skills from element list', () => {
      const mockElements = [
        { textContent: 'React.js' },
        { textContent: 'TypeScript' },
        { textContent: 'React.js' }, // Duplicate
        { textContent: '   Next.js  ' },
      ] as any[];
      const skills = extractSkillsFromElements(mockElements);
      expect(skills).toEqual(['React.js', 'TypeScript', 'Next.js']);
    });
  });

  describe('extractCandidateProfile', () => {
    it('extracts Naukri profile structure correctly', () => {
      const mockDoc = {
        body: {
          textContent: 'Rahul Sharma. rahul@infosys.com, 9876543210. 8 years experience at Infosys.',
        },
        querySelector: (selector: string) => {
          if (selector.includes('cand-name')) return { textContent: 'Rahul Sharma' };
          if (selector.includes('desig')) return { textContent: 'Lead Engineer' };
          if (selector.includes('company')) return { textContent: 'Infosys' };
          if (selector.includes('location')) return { textContent: 'Bengaluru' };
          if (selector.includes('total-exp')) return { textContent: '8 yrs' };
          return null;
        },
        querySelectorAll: (selector: string) => {
          if (selector.includes('chip')) {
            return [{ textContent: 'Java' }, { textContent: 'Spring Boot' }];
          }
          return [];
        },
      } as any;

      const profile = extractCandidateProfile(mockDoc, 'https://www.naukri.com/profile/12345');
      expect(profile.candidateName).toBe('Rahul Sharma');
      expect(profile.source).toBe('NAUKRI');
      expect(profile.currentCompany).toBe('Infosys');
      expect(profile.currentTitle).toBe('Lead Engineer');
      expect(profile.location).toBe('Bengaluru');
      expect(profile.experienceYears).toBe(8);
      expect(profile.email).toBe('rahul@infosys.com');
      expect(profile.phone).toBe('9876543210');
      expect(profile.skills).toContain('Java');
      expect(profile.skills).toContain('Spring Boot');
    });

    it('extracts LinkedIn profile structure correctly', () => {
      const mockDoc = {
        body: {
          textContent: 'Priya Patel. Engineering Manager at Zomato. priya.p@zomato.com',
        },
        querySelector: (selector: string) => {
          if (selector.includes('text-heading-xlarge')) return { textContent: 'Priya Patel (She/Her)' };
          if (selector.includes('text-body-medium')) return { textContent: 'Engineering Manager at Zomato' };
          if (selector.includes('text-body-small')) return { textContent: 'Gurugram, Haryana' };
          return null;
        },
        querySelectorAll: () => [],
      } as any;

      const profile = extractCandidateProfile(mockDoc, 'https://www.linkedin.com/in/priya-patel');
      expect(profile.candidateName).toBe('Priya Patel');
      expect(profile.source).toBe('CHROME_EXTENSION');
      expect(profile.currentTitle).toBe('Engineering Manager');
      expect(profile.currentCompany).toBe('Zomato');
      expect(profile.location).toBe('Gurugram, Haryana');
      expect(profile.email).toBe('priya.p@zomato.com');
    });
  });
});
