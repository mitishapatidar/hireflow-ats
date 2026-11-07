export interface CaptchaVerificationResult {
  success: boolean;
  score?: number;
  error?: string;
  isMock: boolean;
  verifiedAt: string;
}

export interface CaptchaProvider {
  verify(token: string, remoteIp?: string): Promise<CaptchaVerificationResult>;
  isMock(): boolean;
}

/**
 * Development & testing mock CAPTCHA provider.
 * Passes valid test tokens, rejects empty or explicitly fraudulent tokens.
 */
export class MockCaptchaProvider implements CaptchaProvider {
  isMock(): boolean {
    return true;
  }

  async verify(token: string, _remoteIp?: string): Promise<CaptchaVerificationResult> {
    if (!token || token.trim().length === 0) {
      return {
        success: false,
        error: 'CAPTCHA token is missing',
        isMock: true,
        verifiedAt: new Date().toISOString(),
      };
    }

    if (token === 'invalid-captcha-token' || token === 'bot-token') {
      return {
        success: false,
        error: 'CAPTCHA verification failed: Automated bot detected',
        isMock: true,
        verifiedAt: new Date().toISOString(),
      };
    }

    return {
      success: true,
      score: 0.9,
      isMock: true,
      verifiedAt: new Date().toISOString(),
    };
  }
}

let activeCaptchaProvider: CaptchaProvider | null = null;

export function getCaptchaProvider(): CaptchaProvider {
  if (!activeCaptchaProvider) {
    activeCaptchaProvider = new MockCaptchaProvider();
  }
  return activeCaptchaProvider;
}

export function setCaptchaProvider(provider: CaptchaProvider): void {
  activeCaptchaProvider = provider;
}

/**
 * Validates a honeypot field.
 * Legitimate human candidates will leave the honeypot empty.
 * If populated (by automated scrapers/bots), returns false.
 */
export function validateHoneypot(honeypotValue?: string | null): boolean {
  if (!honeypotValue) return true;
  return honeypotValue.trim().length === 0;
}
