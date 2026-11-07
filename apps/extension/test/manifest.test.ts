import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Manifest V3 Compliance', () => {
  const manifestPath = path.resolve(__dirname, '../manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  it('declares manifest_version 3', () => {
    expect(manifest.manifest_version).toBe(3);
  });

  it('contains valid extension metadata and action', () => {
    expect(manifest.name).toBe('HireFlow ATS Sourcing Clipper');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.action.default_popup).toBe('src/popup/index.html');
  });

  it('uses background service worker instead of background scripts', () => {
    expect(manifest.background).toBeDefined();
    expect(manifest.background.service_worker).toBeDefined();
    expect(manifest.background.scripts).toBeUndefined(); // V2 forbidden
    expect(manifest.browser_action).toBeUndefined(); // V2 forbidden
    expect(manifest.page_action).toBeUndefined(); // V2 forbidden
  });

  it('includes required permissions for activeTab and storage', () => {
    expect(manifest.permissions).toContain('activeTab');
    expect(manifest.permissions).toContain('storage');
    expect(manifest.permissions).toContain('alarms');
  });

  it('scopes host_permissions to supported job boards and localhost', () => {
    expect(manifest.host_permissions).toContain('https://*.linkedin.com/*');
    expect(manifest.host_permissions).toContain('https://*.naukri.com/*');
    expect(manifest.host_permissions).toContain('https://*.foundit.in/*');
  });
});
