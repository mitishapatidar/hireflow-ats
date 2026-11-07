import { extractCandidateProfile } from './extractor';

// Listen for messages from extension popup or background worker
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'EXTRACT_PROFILE_REQUEST') {
    try {
      const profile = extractCandidateProfile(document, window.location.href);
      sendResponse({ success: true, data: profile });
    } catch (err: any) {
      sendResponse({ success: false, error: err?.message || 'Failed to extract profile' });
    }
  }
  return true; // Keep channel open for async response
});
