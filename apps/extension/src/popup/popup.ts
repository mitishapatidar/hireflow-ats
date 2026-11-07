import { ExtractedProfile } from '../content/extractor';

interface StoredData {
  captureToken?: string;
  tokenExpiresAt?: number;
  apiUrl?: string;
  recruiterName?: string;
}

let currentProfile: ExtractedProfile | null = null;

// DOM Elements
const authBadge = document.getElementById('auth-status-badge') as HTMLElement;
const tokenSection = document.getElementById('token-section') as HTMLElement;
const captureSection = document.getElementById('capture-section') as HTMLElement;
const successSection = document.getElementById('success-section') as HTMLElement;
const errorBanner = document.getElementById('error-banner') as HTMLElement;
const duplicateAlert = document.getElementById('duplicate-alert') as HTMLElement;
const duplicateReason = document.getElementById('duplicate-reason') as HTMLElement;

const tokenInput = document.getElementById('token-input') as HTMLInputElement;
const apiUrlInput = document.getElementById('api-url-input') as HTMLInputElement;
const saveTokenBtn = document.getElementById('save-token-btn') as HTMLButtonElement;

const candName = document.getElementById('cand-name') as HTMLElement;
const candHeadline = document.getElementById('cand-headline') as HTMLElement;
const inputCompany = document.getElementById('input-company') as HTMLInputElement;
const inputTitle = document.getElementById('input-title') as HTMLInputElement;
const inputEmail = document.getElementById('input-email') as HTMLInputElement;
const inputPhone = document.getElementById('input-phone') as HTMLInputElement;
const inputLocation = document.getElementById('input-location') as HTMLInputElement;
const inputExp = document.getElementById('input-exp') as HTMLInputElement;
const skillsContainer = document.getElementById('skills-container') as HTMLElement;
const inputNotes = document.getElementById('input-notes') as HTMLTextAreaElement;

const reExtractBtn = document.getElementById('re-extract-btn') as HTMLButtonElement;
const captureBtn = document.getElementById('capture-btn') as HTMLButtonElement;
const clipAnotherBtn = document.getElementById('clip-another-btn') as HTMLButtonElement;

function showError(msg: string) {
  errorBanner.textContent = msg;
  errorBanner.classList.remove('hidden');
}

function clearError() {
  errorBanner.textContent = '';
  errorBanner.classList.add('hidden');
}

async function getStoredAuth(): Promise<StoredData> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['captureToken', 'tokenExpiresAt', 'apiUrl', 'recruiterName'], (res) => {
      resolve(res as StoredData);
    });
  });
}

async function initPopup() {
  clearError();
  const auth = await getStoredAuth();
  const now = Date.now();

  if (auth.captureToken && auth.tokenExpiresAt && auth.tokenExpiresAt > now) {
    authBadge.textContent = 'Connected';
    authBadge.className = 'badge badge-success';
    tokenSection.classList.add('hidden');
    captureSection.classList.remove('hidden');
    await extractActiveTabProfile();
  } else {
    authBadge.textContent = 'Not Connected';
    authBadge.className = 'badge badge-neutral';
    tokenSection.classList.remove('hidden');
    captureSection.classList.add('hidden');
    if (auth.apiUrl) apiUrlInput.value = auth.apiUrl;
  }
}

async function extractActiveTabProfile() {
  clearError();
  candName.textContent = 'Extracting profile...';
  candHeadline.textContent = '';
  skillsContainer.innerHTML = '';
  duplicateAlert.classList.add('hidden');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      showError('No active browser tab found.');
      return;
    }

    chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_PROFILE_REQUEST' }, (response) => {
      if (chrome.runtime.lastError || !response || !response.success) {
        candName.textContent = 'Manual Entry Mode';
        candHeadline.textContent = 'Could not auto-extract from this page. Fill in fields manually:';
        return;
      }

      const p: ExtractedProfile = response.data;
      currentProfile = p;

      candName.textContent = p.candidateName;
      candHeadline.textContent = p.headline || `${p.currentTitle || ''} at ${p.currentCompany || ''}`;
      inputCompany.value = p.currentCompany || '';
      inputTitle.value = p.currentTitle || '';
      inputEmail.value = p.email || '';
      inputPhone.value = p.phone || '';
      inputLocation.value = p.location || '';
      inputExp.value = p.experienceYears ? String(p.experienceYears) : '';

      skillsContainer.innerHTML = '';
      p.skills.forEach((skill) => {
        const chip = document.createElement('span');
        chip.className = 'skill-chip';
        chip.textContent = skill;
        skillsContainer.appendChild(chip);
      });
    });
  } catch (err: any) {
    showError(err.message || 'Failed to inspect tab');
  }
}

saveTokenBtn.addEventListener('click', async () => {
  const token = tokenInput.value.trim();
  const apiUrl = apiUrlInput.value.trim() || 'http://localhost:3001';

  if (!token) {
    showError('Please enter a valid capture token.');
    return;
  }

  // Save in local storage (15 min validity)
  const expiresAt = Date.now() + 15 * 60 * 1000;
  chrome.storage.local.set({
    captureToken: token,
    tokenExpiresAt: expiresAt,
    apiUrl,
  }, () => {
    initPopup();
  });
});

captureBtn.addEventListener('click', async () => {
  clearError();
  const auth = await getStoredAuth();
  if (!auth.captureToken) {
    initPopup();
    return;
  }

  const apiUrl = auth.apiUrl || 'http://localhost:3001';
  captureBtn.disabled = true;
  captureBtn.textContent = 'Clipping...';

  const payload = {
    candidateName: candName.textContent || 'Unknown',
    email: inputEmail.value.trim() || undefined,
    phone: inputPhone.value.trim() || undefined,
    currentCompany: inputCompany.value.trim() || undefined,
    currentTitle: inputTitle.value.trim() || undefined,
    location: inputLocation.value.trim() || undefined,
    experienceYears: inputExp.value ? parseInt(inputExp.value, 10) : undefined,
    skills: currentProfile?.skills || [],
    source: currentProfile?.source || 'CHROME_EXTENSION',
    sourceMetadata: {
      profileUrl: currentProfile?.sourceUrl,
      headline: currentProfile?.headline,
      capturedAt: new Date().toISOString(),
    },
    rawText: currentProfile?.rawText || '',
    notes: inputNotes.value.trim() || undefined,
  };

  try {
    const res = await fetch(`${apiUrl}/api/sourcing/extension/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.captureToken}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        showError('Capture token has expired or is invalid. Please generate a new one.');
        chrome.storage.local.remove(['captureToken', 'tokenExpiresAt']);
        initPopup();
      } else {
        showError(data.error || 'Failed to capture candidate');
      }
      return;
    }

    captureSection.classList.add('hidden');
    successSection.classList.remove('hidden');
  } catch (err: any) {
    showError(err.message || 'Network error while contacting HireFlow API');
  } finally {
    captureBtn.disabled = false;
    captureBtn.textContent = 'Clip to Sourcing Workspace';
  }
});

reExtractBtn.addEventListener('click', () => {
  extractActiveTabProfile();
});

clipAnotherBtn.addEventListener('click', () => {
  successSection.classList.add('hidden');
  captureSection.classList.remove('hidden');
  extractActiveTabProfile();
});

document.addEventListener('DOMContentLoaded', () => {
  initPopup();
});
