import { describe, it, expect } from 'vitest';
import { tokens } from './tokens';

describe('Design Tokens - HireFlow Brand Truth', () => {
  it('should have exact brand tokens from Figma Build Playbook', () => {
    expect(tokens.colors.primary).toBe('#5B49D6');
    expect(tokens.colors.primarySoft).toBe('#EEEBFB');
    expect(tokens.colors.navy).toBe('#1E2A4A');
    expect(tokens.colors.pageBg).toBe('#F6F7FB');
    expect(tokens.colors.card).toBe('#FFFFFF');
    expect(tokens.colors.border).toBe('#E6E8F0');
    expect(tokens.colors.text).toBe('#1B2236');
    expect(tokens.colors.muted).toBe('#6B7490');
  });

  it('should enforce proper radii', () => {
    expect(tokens.radii.input).toBe('8px');
    expect(tokens.radii.card).toBe('12px');
    expect(tokens.radii.pill).toBe('9999px');
  });
});
