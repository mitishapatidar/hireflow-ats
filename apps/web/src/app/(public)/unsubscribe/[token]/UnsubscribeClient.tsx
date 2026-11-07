'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import Link from 'next/link';
import {
  Mail,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Loader2,
  ArrowRight,
  Info,
} from 'lucide-react';
import { unsubscribeCandidateAction } from '@/actions/campaigns';

interface UnsubscribeClientProps {
  token: string;
  candidate: {
    id: string;
    name: string;
    email: string;
    emailMarketingOptIn: boolean;
  } | null;
  initialError: string | null;
}

export function UnsubscribeClient({
  token,
  candidate,
  initialError,
}: UnsubscribeClientProps) {
  const [selectedReason, setSelectedReason] = useState<string>('Too frequent');
  const [customFeedback, setCustomFeedback] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(initialError);
  const [isSuccess, setIsSuccess] = useState<boolean>(
    candidate ? candidate.emailMarketingOptIn === false : false
  );

  const handleUnsubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setIsSubmitting(true);
    setError(null);

    const fullReason =
      selectedReason === 'Other' && customFeedback.trim()
        ? `Other: ${customFeedback.trim()}`
        : selectedReason;

    try {
      const res = await unsubscribeCandidateAction(token, {
        reason: fullReason,
      });

      if (!res.success) {
        setError(res.error || 'Failed to update preferences. The link may have expired.');
      } else {
        setIsSuccess(true);
      }
    } catch (err: any) {
      setError(err.message || 'Error processing request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F7FB] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="w-12 h-12 rounded-2xl bg-[#EEEBFB] text-[#5B49D6] flex items-center justify-center mx-auto mb-4">
          <Mail className="w-6 h-6" />
        </div>
        <h2 className="text-center text-2xl font-black text-[#1B2236] tracking-tight">
          Email Communication Preferences
        </h2>
        <p className="mt-1 text-center text-xs text-[#6B7490]">
          HireFlow Talent Network & Careers
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xs rounded-2xl border border-[#E6E8F0] sm:px-8 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isSuccess ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1B2236]">
                  Preferences Successfully Updated
                </h3>
                <p className="text-xs text-[#6B7490] mt-1">
                  You have been unsubscribed from promotional marketing emails and announcements.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#F8F9FC] border border-[#E6E8F0] text-left text-xs text-[#1B2236] space-y-2">
                <div className="flex items-center gap-2 text-indigo-700 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-[#5B49D6]" />
                  <span>Important Transactional Notices</span>
                </div>
                <p className="text-[11px] text-[#6B7490]">
                  If you have active job applications, you will still receive critical interview invites, application status updates, and offer letters.
                </p>
              </div>

              <div className="pt-2">
                <Link
                  href="/careers"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-[#5B49D6] hover:underline"
                >
                  <span>Explore Open Roles</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : candidate ? (
            <form onSubmit={handleUnsubscribe} className="space-y-5">
              <div className="p-3 rounded-xl bg-[#F8F9FC] border border-[#E6E8F0] text-xs space-y-1">
                <span className="text-[#6B7490] block text-[11px]">Unsubscribing:</span>
                <span className="font-bold text-[#1B2236] block">{candidate.name}</span>
                <span className="text-gray-600 font-mono text-[11px] block">{candidate.email}</span>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#1B2236]">
                  Please let us know why you are unsubscribing:
                </label>
                <div className="space-y-1.5 text-xs text-[#1B2236]">
                  {[
                    'I receive too many emails',
                    'I already found a new job',
                    'Content is no longer relevant to my skills',
                    'I never signed up for these notifications',
                    'Other',
                  ].map((reason) => (
                    <label
                      key={reason}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="unsubscribeReason"
                        value={reason}
                        checked={selectedReason === reason}
                        onChange={() => setSelectedReason(reason)}
                        className="text-[#5B49D6] focus:ring-[#5B49D6]"
                      />
                      <span>{reason}</span>
                    </label>
                  ))}
                </div>

                {selectedReason === 'Other' && (
                  <textarea
                    rows={2}
                    placeholder="Optional feedback..."
                    value={customFeedback}
                    onChange={(e) => setCustomFeedback(e.target.value)}
                    className="w-full text-xs bg-[#F8F9FC] border border-[#E6E8F0] rounded-xl p-2.5 text-[#1B2236] focus:outline-none focus:border-[#5B49D6] mt-2"
                  />
                )}
              </div>

              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  This action disables promotional talent pool blasts. Status notifications for ongoing active applications will not be affected.
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                <span>Unsubscribe from Marketing Outreach</span>
              </button>
            </form>
          ) : (
            <div className="text-center py-6 space-y-3">
              <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
              <h3 className="text-sm font-bold text-[#1B2236]">Invalid or Expired Link</h3>
              <p className="text-xs text-[#6B7490]">
                We could not verify your unsubscribe token. It may have expired or already been processed.
              </p>
              <Link
                href="/careers"
                className="inline-block mt-2 text-xs font-semibold text-[#5B49D6] hover:underline"
              >
                Return to Careers Portal
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
