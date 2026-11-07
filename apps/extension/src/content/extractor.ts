/**
 * Profile DOM Extractor for HireFlow Chrome Extension
 * 
 * Extracts candidate information from VISIBLE text content only.
 * Strictly adheres to security rules:
 * - No background scraping or hidden API interception.
 * - Never reads cookies, site session tokens, or private user credentials.
 * - Sanitizes all text fields against XSS and script injection.
 */

export interface ExtractedProfile {
  candidateName: string;
  headline?: string;
  currentCompany?: string;
  currentTitle?: string;
  location?: string;
  email?: string;
  phone?: string;
  skills: string[];
  experienceYears?: number;
  sourceUrl: string;
  source: 'CHROME_EXTENSION' | 'NAUKRI' | 'FOUNDIT';
  rawText: string;
}

/**
 * Sanitizes plain text extracted from DOM nodes
 */
export function sanitizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, '') // Strip HTML tags
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses email from visible text using standard regex
 */
export function extractEmailFromText(text: string): string | undefined {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0].toLowerCase() : undefined;
}

/**
 * Parses phone number from visible text
 */
export function extractPhoneFromText(text: string): string | undefined {
  const match = text.match(/(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/);
  return match ? match[0].replace(/[\s-]/g, '') : undefined;
}

/**
 * Extracts visible skills from badge/tag selectors or list elements
 */
export function extractSkillsFromElements(elements: Element[]): string[] {
  const skillsSet = new Set<string>();
  for (const el of elements) {
    const text = sanitizeText(el.textContent);
    if (text && text.length < 50 && !text.includes('\n')) {
      skillsSet.add(text);
    }
  }
  return Array.from(skillsSet);
}

/**
 * Extracts candidate profile based on URL and document DOM
 */
export function extractCandidateProfile(doc: Document, url: string): ExtractedProfile {
  const cleanUrl = url.split('?')[0];
  const hostname = new URL(url).hostname.toLowerCase();
  const rawBodyText = sanitizeText(doc.body?.innerText || doc.body?.textContent || '');
  const truncatedRawText = rawBodyText.substring(0, 8000);

  let source: ExtractedProfile['source'] = 'CHROME_EXTENSION';
  let candidateName = '';
  let headline = '';
  let currentCompany = '';
  let currentTitle = '';
  let location = '';
  const skills: string[] = [];
  let experienceYears: number | undefined;

  if (hostname.includes('naukri.com')) {
    source = 'NAUKRI';
    // Naukri profile selectors
    const nameEl = doc.querySelector('.cand-name, .userName, h1');
    candidateName = sanitizeText(nameEl?.textContent);

    const titleEl = doc.querySelector('.desig, .current-desig, .experience');
    currentTitle = sanitizeText(titleEl?.textContent);

    const compEl = doc.querySelector('.company, .current-company');
    currentCompany = sanitizeText(compEl?.textContent);

    const locEl = doc.querySelector('.location, .userLoc');
    location = sanitizeText(locEl?.textContent);

    const skillEls = Array.from(doc.querySelectorAll('.key-skills .chip, .skill-tag, .chip-item'));
    skills.push(...extractSkillsFromElements(skillEls));

    const expEl = doc.querySelector('.total-exp, .experience');
    if (expEl) {
      const expMatch = sanitizeText(expEl.textContent).match(/(\d+)\s*(?:yrs|years?)/i);
      if (expMatch) experienceYears = parseInt(expMatch[1], 10);
    }
  } else if (hostname.includes('foundit.in') || hostname.includes('monsterindia.com')) {
    source = 'FOUNDIT';
    // Foundit profile selectors
    const nameEl = doc.querySelector('.candidate-name, .name, h1');
    candidateName = sanitizeText(nameEl?.textContent);

    const titleEl = doc.querySelector('.designation, .job-title');
    currentTitle = sanitizeText(titleEl?.textContent);

    const compEl = doc.querySelector('.company-name, .current-company');
    currentCompany = sanitizeText(compEl?.textContent);

    const locEl = doc.querySelector('.cand-location, .location');
    location = sanitizeText(locEl?.textContent);

    const skillEls = Array.from(doc.querySelectorAll('.skill-tag, .skills-list span, .badge'));
    skills.push(...extractSkillsFromElements(skillEls));
  } else if (hostname.includes('linkedin.com')) {
    source = 'CHROME_EXTENSION';
    // LinkedIn profile selectors (standard public and recruiter view fallbacks)
    const nameEl = doc.querySelector('h1.text-heading-xlarge, h1.top-card-layout__title, h1');
    candidateName = sanitizeText(nameEl?.textContent);

    const headlineEl = doc.querySelector('.text-body-medium.break-words, .top-card-layout__headline');
    headline = sanitizeText(headlineEl?.textContent);

    const locEl = doc.querySelector('.text-body-small.inline.t-black--light.break-words, .top-card__subline-item');
    location = sanitizeText(locEl?.textContent);

    // Try extracting company from headline or experience section
    if (headline.includes(' at ')) {
      const parts = headline.split(' at ');
      currentTitle = parts[0]?.trim() || '';
      currentCompany = parts[1]?.trim() || '';
    } else if (headline.includes(' @ ')) {
      const parts = headline.split(' @ ');
      currentTitle = parts[0]?.trim() || '';
      currentCompany = parts[1]?.trim() || '';
    } else {
      currentTitle = headline;
    }

    const skillEls = Array.from(doc.querySelectorAll('.hoverable-link-text, .pv-skill-category-entity__name-text, [data-field="skill_card_skill_topic"]'));
    skills.push(...extractSkillsFromElements(skillEls));
  } else {
    // Generic web page fallback
    const titleEl = doc.querySelector('h1, title');
    candidateName = sanitizeText(titleEl?.textContent);
  }

  // Fallback checks from text
  const email = extractEmailFromText(rawBodyText);
  const phone = extractPhoneFromText(rawBodyText);

  // If candidate name has suffixes like (He/Him) or commas, clean them
  if (candidateName) {
    candidateName = candidateName.replace(/\(.*?\)/g, '').split(',')[0].trim();
  }

  return {
    candidateName: candidateName || 'Unknown Candidate',
    headline: headline || undefined,
    currentCompany: currentCompany || undefined,
    currentTitle: currentTitle || undefined,
    location: location || undefined,
    email,
    phone,
    skills: skills.slice(0, 30),
    experienceYears,
    sourceUrl: cleanUrl,
    source,
    rawText: truncatedRawText,
  };
}
