'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import React, { useState } from 'react';
import { X, Calendar, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { rescheduleInterviewAction } from '@/actions/interviews';

interface RescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  interviewId: string;
  candidateName: string;
  currentScheduledAtIST: string;
  onRescheduled: () => void;
}

export const RescheduleModal: React.FC<RescheduleModalProps> = ({
  isOpen,
  onClose,
  interviewId,
  candidateName,
  currentScheduledAtIST,
  onRescheduled,
}) => {
  const [dateStr, setDateStr] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  });
  const [timeStr, setTimeStr] = useState<string>('15:00');
  const [duration, setDuration] = useState<number>(45);
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 3) {
      setError('A mandatory reschedule reason is required (min 3 chars).');
      return;
    }

    setSubmitting(true);
    setError(null);

    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, mins] = timeStr.split(':').map(Number);
    const istTimeMs = Date.UTC(year, month - 1, day, hours, mins, 0);
    const utcTimeMs = istTimeMs - 5.5 * 60 * 60 * 1000;
    const newScheduledAtUtc = new Date(utcTimeMs).toISOString();

    const res = await rescheduleInterviewAction(interviewId, {
      newScheduledAt: newScheduledAtUtc,
      duration,
      rescheduleReason: reason.trim(),
    });

    if (res.success) {
      onRescheduled();
      onClose();
    } else {
      setError(res.error || 'Failed to reschedule interview');
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1E2A4A]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-[#E6E8F0] shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E6E8F0] bg-[#F6F7FB]/50">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-[#FFFBEB] text-[#F59E0B] flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1B2236]">Reschedule Interview</h2>
              <p className="text-xs text-[#6B7490]">{candidateName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-[#6B7490] hover:text-[#1B2236] hover:bg-[#E6E8F0]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-[#FFF0F0] border border-[#E5484D]/30 rounded-xl text-xs text-[#E5484D] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3 bg-[#F6F7FB] border border-[#E6E8F0] rounded-xl text-xs text-[#6B7490]">
            <span className="font-semibold text-[#1B2236]">Current Schedule:</span> {currentScheduledAtIST}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#1B2236] mb-1">New Date (IST)</label>
              <input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full text-xs rounded-xl border border-[#E6E8F0] p-2.5 bg-white text-[#1B2236] focus:border-[#5B49D6] focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1B2236] mb-1">New Time (IST)</label>
              <input
                type="time"
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                className="w-full text-xs rounded-xl border border-[#E6E8F0] p-2.5 bg-white text-[#1B2236] focus:border-[#5B49D6] focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1B2236] mb-1">Duration (mins)</label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full text-xs rounded-xl border border-[#E6E8F0] p-2.5 bg-white text-[#1B2236] focus:border-[#5B49D6] focus:outline-none"
            >
              <option value={30}>30 mins</option>
              <option value={45}>45 mins</option>
              <option value={60}>60 mins</option>
              <option value={90}>90 mins</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1B2236] mb-1">
              Reason for Rescheduling <span className="text-[#E5484D]">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Candidate had conflicting flight, panel member unavailable..."
              rows={3}
              className="w-full text-xs rounded-xl border border-[#E6E8F0] p-2.5 bg-white text-[#1B2236] focus:border-[#5B49D6] focus:outline-none resize-none"
              required
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
              className="px-5 py-2.5 bg-[#F59E0B] text-white rounded-xl text-xs font-bold hover:bg-[#F59E0B]/90 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Rescheduling...</span>
                </>
              ) : (
                'Confirm Reschedule'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
