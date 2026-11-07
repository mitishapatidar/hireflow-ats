/**
 * Background Service Worker for HireFlow Extension
 * Manifest V3 Service Worker
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log('[HireFlow ATS Extension] Installed successfully.');
});

// Alarm to periodically verify token expiration
chrome.alarms.create('check-token-expiration', { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'check-token-expiration') {
    chrome.storage.local.get(['captureToken', 'tokenExpiresAt'], (result) => {
      if (result.tokenExpiresAt && Date.now() > result.tokenExpiresAt) {
        console.warn('[HireFlow ATS Extension] Capture token expired. Clearing session.');
        chrome.storage.local.remove(['captureToken', 'tokenExpiresAt', 'recruiterName']);
      }
    });
  }
});
