'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { getRejectionReasonsAction, rejectApplicationAction } from '@/actions/pipeline';

interface RejectionModalProps {
  applicationId: string;
  jobId: string;
  onClose: () => void;
  onRejected: () => void;
}

export function RejectionModal({ applicationId, jobId, onClose, onRejected }: RejectionModalProps) {
  const [reasons, setReasons] = useState<Array<{ id: string; code: string; label: string }>>([]);
  const [selectedReason, setSelectedReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getRejectionReasonsAction().then((res) => setReasons(res.reasons));
  }, []);

  function handleReject() {
    if (!selectedReason) { setError('Please select a rejection reason'); return; }
    if (!feedback.trim()) { setError('Please provide rejection feedback'); return; }
    setError(null);

    startTransition(async () => {
      const result = await rejectApplicationAction(applicationId, selectedReason, feedback.trim());
      if (result.success) {
        onRejected();
      } else {
        setError(result.error ?? 'Failed to reject candidate');
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" aria-modal="true" role="dialog">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Reject Candidate</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <p className="text-xs text-amber-700">
              Rejecting a candidate is a significant action. The candidate will not be automatically notified. This action is logged in the audit trail.
            </p>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedReason}
              onChange={(e) => { setSelectedReason(e.target.value); setError(null); }}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              <option value="">Select a reason…</option>
              {reasons.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Feedback */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Internal Feedback <span className="text-red-500">*</span>
            </label>
            <textarea
              value={feedback}
              onChange={(e) => { setFeedback(e.target.value); setError(null); }}
              placeholder="Provide specific feedback about why this candidate is not suitable… (internal only)"
              rows={4}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">This feedback is internal and will NOT be shared with the candidate.</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleReject}
            disabled={isPending || !selectedReason || !feedback.trim()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition"
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Confirm Rejection
          </button>
        </div>
      </div>
    </div>
  );
}
