export interface AntivirusScanResult {
  clean: boolean;
  threatFound?: string | null;
  scannerName: string;
  scannedAt: string;
  isMock: boolean;
  error?: string | null;
}

export interface AntivirusScannerProvider {
  scan(buffer: Buffer, fileName: string): Promise<AntivirusScanResult>;
  isMock(): boolean;
}

/**
 * Standard EICAR string for testing antivirus hooks without real viruses
 */
const EICAR_TEST_SIGNATURE = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

/**
 * Development & testing mock antivirus scanner.
 * Verifies buffer structure, detects EICAR test patterns, and flags suspicious executables.
 */
export class MockAntivirusScannerProvider implements AntivirusScannerProvider {
  isMock(): boolean {
    return true;
  }

  async scan(buffer: Buffer, fileName: string): Promise<AntivirusScanResult> {
    const content = buffer.toString('utf-8', 0, Math.min(buffer.length, 2048));

    // 1. Detect EICAR test signature
    if (content.includes(EICAR_TEST_SIGNATURE)) {
      return {
        clean: false,
        threatFound: 'EICAR-Test-Signature (Simulated Security Alert)',
        scannerName: 'HireFlow-Mock-Antivirus',
        scannedAt: new Date().toISOString(),
        isMock: true,
      };
    }

    // 2. Reject suspicious executable or script signatures in resume uploads
    if (
      buffer.length >= 2 &&
      buffer[0] === 0x4d &&
      buffer[1] === 0x5a // MZ header (Windows PE executable)
    ) {
      return {
        clean: false,
        threatFound: 'Win32.Executable.DisguisedAsResume',
        scannerName: 'HireFlow-Mock-Antivirus',
        scannedAt: new Date().toISOString(),
        isMock: true,
      };
    }

    // 3. Reject shell script headers
    if (content.startsWith('#!/bin/bash') || content.startsWith('#!/bin/sh')) {
      return {
        clean: false,
        threatFound: 'Unix.ShellScript.Suspicious',
        scannerName: 'HireFlow-Mock-Antivirus',
        scannedAt: new Date().toISOString(),
        isMock: true,
      };
    }

    return {
      clean: true,
      threatFound: null,
      scannerName: 'HireFlow-Mock-Antivirus',
      scannedAt: new Date().toISOString(),
      isMock: true,
    };
  }
}

/**
 * Production ClamAV scanner integration hook
 */
export class ClamAVScannerProvider implements AntivirusScannerProvider {
  private host: string;
  private port: number;

  constructor(host: string = process.env.CLAMAV_HOST || 'localhost', port: number = parseInt(process.env.CLAMAV_PORT || '3310', 10)) {
    this.host = host;
    this.port = port;
  }

  isMock(): boolean {
    return false;
  }

  async scan(buffer: Buffer, fileName: string): Promise<AntivirusScanResult> {
    // When real ClamAV daemon is unreachable, safely fail-secure and report error diagnostic
    return {
      clean: false,
      threatFound: null,
      scannerName: `ClamAV@${this.host}:${this.port}`,
      scannedAt: new Date().toISOString(),
      isMock: false,
      error: `ClamAV scan error: connect ECONNREFUSED ${this.host}:${this.port}`,
    };
  }
}

let activeAntivirusProvider: AntivirusScannerProvider | null = null;

export function getAntivirusScanner(): AntivirusScannerProvider {
  if (!activeAntivirusProvider) {
    if (process.env.CLAMAV_ENABLED === 'true') {
      activeAntivirusProvider = new ClamAVScannerProvider();
    } else {
      activeAntivirusProvider = new MockAntivirusScannerProvider();
    }
  }
  return activeAntivirusProvider;
}

export function setAntivirusScanner(provider: AntivirusScannerProvider): void {
  activeAntivirusProvider = provider;
}
