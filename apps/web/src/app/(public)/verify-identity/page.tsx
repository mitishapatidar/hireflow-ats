'use client';

import React, { useState, useRef, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck, Mail, ArrowRight, RotateCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { verifyOtpAction, resendOtpAction, AuthActionResult } from '@/actions/auth';

export default function VerifyIdentityPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-[#F6F7FB]" />}>
      <VerifyIdentityContent />
    </React.Suspense>
  );
}

function VerifyIdentityContent() {
  const searchParams = useSearchParams();
  const challengeToken = searchParams.get('challenge') || '';

  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [cooldown, setCooldown] = useState<number>(30);
  const [result, setResult] = useState<AuthActionResult | null>(null);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus the first box on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleDigitChange = (index: number, value: string) => {
    const char = value.slice(-1);
    if (char && !/^\d$/.test(char)) return; // Only allow digits

    const nextDigits = [...digits];
    nextDigits[index] = char;
    setDigits(nextDigits);
    setResult(null);

    // Auto-advance to next input
    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pasted)) {
      const chars = pasted.split('');
      setDigits(chars);
      inputRefs.current[5]?.focus();
      setResult(null);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = digits.join('');
    if (code.length !== 6) {
      setResult({ success: false, error: 'Please enter all 6 digits of the verification code.' });
      return;
    }

    const formData = new FormData();
    formData.append('challengeToken', challengeToken);
    formData.append('code', code);

    startTransition(async () => {
      const res = await verifyOtpAction(result, formData);
      if (res) {
        setResult(res);
      }
    });
  };

  const handleResend = async () => {
    if (cooldown > 0 || isPending) return;
    setResendNotice(null);
    setResult(null);

    const res = await resendOtpAction(challengeToken);
    if (res.success) {
      setResendNotice(res.message || 'A new code has been sent to your work email.');
      setCooldown(30);
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } else {
      setResult({ success: false, error: res.error || 'Failed to resend code' });
      if (res.retryAfter) {
        setCooldown(res.retryAfter);
      }
    }
  };

  const isComplete = digits.every((d) => d.length === 1);

  return (
    <div className="min-h-screen flex w-full bg-[#F6F7FB]">
      {/* ------------------------------------------------------------- */}
      {/* LEFT PANEL: FIGMA FRAME 16 DARK NAVY HERO PANEL */}
      {/* ------------------------------------------------------------- */}
      <div className="hidden lg:flex lg:w-5/12 bg-[#1E2A4A] flex-col justify-between p-12 text-white relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#5B49D6]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-[#5B49D6]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#5B49D6] flex items-center justify-center font-bold text-xl text-white shadow-md">
            H
          </div>
          <div>
            <div className="font-extrabold text-xl tracking-tight text-white leading-none">HireFlow</div>
            <div className="text-[10px] font-semibold text-[#6B7490] tracking-widest uppercase mt-0.5">
              RECRUITMENT OS
            </div>
          </div>
        </div>

        <div className="relative z-10 my-auto py-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[#EEEBFB] text-xs font-semibold tracking-wider uppercase mb-6">
            <ShieldCheck className="w-3.5 h-3.5 text-[#5B49D6]" />
            Enterprise Security
          </div>
          <h1 className="text-4xl font-extrabold text-white leading-tight tracking-tight mb-5">
            Two-Step Identity Verification
          </h1>
          <p className="text-[#6B7490] text-base leading-relaxed max-w-md">
            Your workspace enforces two-step verification to safeguard candidate dossiers, client margins, and commercial agreements against unauthorized access.
          </p>
        </div>

        <div className="relative z-10 text-xs text-[#6B7490] flex items-center justify-between border-t border-white/10 pt-6">
          <span>HireFlow ATS v2.1 • Aureva Capital Private Limited</span>
          <span>ISO 27001 & SOC-2 Compliant</span>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* RIGHT PANEL: FIGMA FRAME 16 VERIFY YOUR IDENTITY FORM */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-12">
        <div className="w-full max-w-md mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="w-12 h-12 rounded-xl bg-[#EEEBFB] flex items-center justify-center text-[#5B49D6] mb-4">
              <Mail className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-[#1B2236] tracking-tight mb-2">
              Verify your identity
            </h2>
            <p className="text-sm text-[#6B7490] leading-relaxed">
              We have dispatched a single-use 6-digit verification code to your authorized work email address. Enter the code below to access your workspace.
            </p>
          </div>

          {/* Feedback Alerts */}
          {result?.error && (
            <div className="mb-6 p-4 rounded-xl bg-[#E5484D]/10 border border-[#E5484D]/20 flex items-start gap-3 text-sm text-[#E5484D] animate-in fade-in">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Verification Failed</div>
                <div>{result.error}</div>
              </div>
            </div>
          )}

          {resendNotice && (
            <div className="mb-6 p-4 rounded-xl bg-[#12B76A]/10 border border-[#12B76A]/20 flex items-start gap-3 text-sm text-[#12B76A] animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Code Dispatched</div>
                <div>{resendNotice}</div>
              </div>
            </div>
          )}

          {/* Form with 6 OTP Inputs */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex justify-between items-center gap-2 sm:gap-3">
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    inputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  onPaste={idx === 0 ? handlePaste : undefined}
                  className={`w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold rounded-xl border bg-white text-[#1B2236] shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#5B49D6] focus:border-[#5B49D6] ${
                    result?.error
                      ? 'border-[#E5484D] focus:ring-[#E5484D]'
                      : digit
                      ? 'border-[#5B49D6]'
                      : 'border-[#E6E8F0]'
                  }`}
                />
              ))}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!isComplete || isPending}
              className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-white shadow-sm transition-all ${
                isComplete && !isPending
                  ? 'bg-[#5B49D6] hover:bg-[#4d3db8] cursor-pointer'
                  : 'bg-[#5B49D6]/60 cursor-not-allowed'
              }`}
            >
              {isPending ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Verifying identity...</span>
                </>
              ) : (
                <>
                  <span>Verify Identity</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Resend Cooldown Section */}
          <div className="mt-8 text-center border-t border-[#E6E8F0] pt-6">
            <p className="text-sm text-[#6B7490] mb-3">
              Didn’t receive the code or code expired?
            </p>
            {cooldown > 0 ? (
              <span className="text-xs font-medium text-[#6B7490] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100">
                Resend available in <strong className="text-[#1B2236]">{cooldown}s</strong>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={isPending}
                className="text-sm font-semibold text-[#5B49D6] hover:text-[#4d3db8] hover:underline cursor-pointer inline-flex items-center gap-1.5"
              >
                <RotateCw className="w-3.5 h-3.5" />
                Resend verification code
              </button>
            )}

            <div className="mt-6">
              <Link
                href="/login"
                className="text-xs font-medium text-[#6B7490] hover:text-[#1B2236] hover:underline"
              >
                Return to sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
