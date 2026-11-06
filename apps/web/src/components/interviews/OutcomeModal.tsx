'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import React, { useState } from 'react';
import { X, CheckCircle2, UserX, AlertTriangle, ShieldCheck, Loader2 } from 'lucide-react';
import {
  completeInterviewAction,
  noShowInterviewAction,
  cancelInterviewAction,
} from '@/actions/interviews';

interface OutcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  interviewId: string;
  candidateName: string;
  roundName: string;
  actionType: 'COMPLETE' | 'NO_SHOW' | 'CANCEL';
  onUpdated: () => void;
}

export const OutcomeModal: React.FC<OutcomeModalProps> = ({
  isOpen,
  onClose,
  interviewId,
  candidateName,
  roundName,
  actionType,
  onUpdated,
}) => {
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    let res: any;
    if (actionType === 'COMPLETE') {
      res = await completeInterviewAction(interviewId, { outcomeNotes: notes.trim() });
    } else if (actionType === 'NO_SHOW') {
      res = await noShowInterviewAction(interviewId, { noShowReason: notes.trim() });
    } else if (actionType === 'CANCEL') {
      if (notes.trim().length < 3) {
        setError('Cancellation reason is required (min 3 chars)');
        setSubmitting(false);
        return;
      }
      res = await cancelInterviewAction(interviewId, { cancellationReason: notes.trim() });
    }

    if (res?.success) {
      onUpdated();
      onClose();
    } else {
      setError(res?.error || 'Action failed');
    }
    setSubmitting(false);
  };

  const title =
    actionType === 'COMPLETE'
      ? 'Mark Interview Completed'
      : actionType === 'NO_SHOW'
      ? 'Record Candidate No-Show'
      : 'Cancel Scheduled Interview';

  const badgeColor =
    actionType === 'COMPLETE'
      ? 'bg-[#E8FAF0] text-[#12B76A]'
      : actionType === 'NO_SHOW'
      ? 'bg-[#FFFBEB] text-[#F59E0B]'
      : 'bg-[#FFF0F0] text-[#E5484D]';

  return (
    <div className="fixed inset-0 z-50 bg-[#1E2A4A]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-[#E6E8F0] shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E6E8F0] bg-[#F6F7FB]/50">
          <div className="flex items-center gap-2.5">
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${badgeColor}`}>
              {actionType === 'COMPLETE' ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : actionType === 'NO_SHOW' ? (
                <UserX className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1B2236]">{title}</h2>
              <p className="text-xs text-[#6B7490]">{candidateName} • {roundName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-[#6B7490] hover:text-[#1B2236] hover:bg-[#E6E8F0]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ATS Rule Safety Callout for No-Show */}
        {actionType === 'NO_SHOW' && (
          <div className="px-6 py-3 bg-[#FFFBEB] border-b border-[#F59E0B]/20 flex items-start gap-2.5 text-xs text-[#F59E0B]">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">ATS Rule Enforced:</span> Marking an interview as no-show preserves the application stage. The candidate is <span className="font-bold underline">NEVER</span> automatically rejected or emailed.
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-[#FFF0F0] border border-[#E5484D]/30 rounded-xl text-xs text-[#E5484D]">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#1B2236] mb-1.5">
              {actionType === 'COMPLETE'
                ? 'Outcome / Summary Notes (Optional)'
                : actionType === 'NO_SHOW'
                ? 'No-Show Observations / Follow-up Notes'
                : 'Cancellation Reason *'}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                actionType === 'COMPLETE'
                  ? 'Key observations or next steps...'
                  : actionType === 'NO_SHOW'
                  ? 'Candidate did not connect, phone unreachable...'
                  : 'Candidate withdrew, position on hold...'
              }
              rows={3}
              className="w-full text-xs rounded-xl border border-[#E6E8F0] p-3 bg-white text-[#1B2236] focus:border-[#5B49D6] focus:outline-none resize-none"
              required={actionType === 'CANCEL'}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E6E8F0]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#6B7490] hover:text-[#1B2236]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`px-5 py-2.5 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 ${
                actionType === 'COMPLETE'
                  ? 'bg-[#12B76A] hover:bg-[#12B76A]/90'
                  : actionType === 'NO_SHOW'
                  ? 'bg-[#F59E0B] hover:bg-[#F59E0B]/90'
                  : 'bg-[#E5484D] hover:bg-[#E5484D]/90'
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                `Confirm ${actionType === 'COMPLETE' ? 'Completion' : actionType === 'NO_SHOW' ? 'No-Show' : 'Cancellation'}`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
