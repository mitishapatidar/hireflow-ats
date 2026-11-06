'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import React, { useState } from 'react';
import { X, Star, MessageSquare, ShieldAlert, Loader2 } from 'lucide-react';
import { PanelRecommendation } from '@hireflow/shared';
import { submitPanelFeedbackAction } from '@/actions/interviews';

interface PanelFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  interviewId: string;
  candidateName: string;
  roundName: string;
  onSubmitted: () => void;
}

export const PanelFeedbackModal: React.FC<PanelFeedbackModalProps> = ({
  isOpen,
  onClose,
  interviewId,
  candidateName,
  roundName,
  onSubmitted,
}) => {
  const [rating, setRating] = useState<number>(4);
  const [recommendation, setRecommendation] = useState<PanelRecommendation>(PanelRecommendation.YES);
  const [strengths, setStrengths] = useState<string>('');
  const [concerns, setConcerns] = useState<string>('');
  const [technicalScore, setTechnicalScore] = useState<number>(8);
  const [feedback, setFeedback] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (feedback.trim().length < 5) {
      setError('Feedback notes must be at least 5 characters');
      return;
    }

    setSubmitting(true);
    setError(null);

    const res = await submitPanelFeedbackAction(interviewId, {
      rating,
      recommendation,
      strengths: strengths.trim() || undefined,
      concerns: concerns.trim() || undefined,
      technicalScore,
      feedback: feedback.trim(),
    });

    if (res.success) {
      onSubmitted();
      onClose();
    } else {
      setError(res.error || 'Failed to submit panel feedback');
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1E2A4A]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-[#E6E8F0] shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E6E8F0] bg-[#F6F7FB]/50">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-[#EEEBFB] text-[#5B49D6] flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1B2236]">Submit Panel Feedback</h2>
              <p className="text-xs text-[#6B7490]">{candidateName} • {roundName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-[#6B7490] hover:text-[#1B2236] hover:bg-[#E6E8F0] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Anti-Leak Banner */}
        <div className="px-6 py-2.5 bg-[#FFFBEB] border-b border-[#F59E0B]/20 flex items-center gap-2 text-xs text-[#F59E0B] font-medium">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>Internal Confidential: This feedback is strictly hidden from candidate & client portals.</span>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-[#FFF0F0] border border-[#E5484D]/30 rounded-xl text-xs text-[#E5484D]">
              {error}
            </div>
          )}

          {/* Overall Rating (1-5 Stars) */}
          <div>
            <label className="block text-xs font-semibold text-[#1B2236] mb-1.5">
              Overall Rating <span className="text-[#E5484D]">*</span>
            </label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRating(star)}
                  className="p-1 hover:scale-110 transition-transform cursor-pointer"
                >
                  <Star
                    className={`w-6 h-6 ${
                      star <= rating
                        ? 'fill-[#F59E0B] text-[#F59E0B]'
                        : 'text-[#E6E8F0] hover:text-[#F59E0B]/50'
                    }`}
                  />
                </button>
              ))}
              <span className="text-xs font-bold text-[#1B2236] ml-2">{rating} / 5 Stars</span>
            </div>
          </div>

          {/* Recommendation */}
          <div>
            <label className="block text-xs font-semibold text-[#1B2236] mb-1.5">
              Hiring Recommendation <span className="text-[#E5484D]">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: PanelRecommendation.STRONG_YES, label: 'Strong Yes', color: 'text-[#12B76A]' },
                { id: PanelRecommendation.YES, label: 'Yes', color: 'text-[#12B76A]' },
                { id: PanelRecommendation.MAYBE, label: 'Maybe', color: 'text-[#F59E0B]' },
                { id: PanelRecommendation.NO, label: 'No', color: 'text-[#E5484D]' },
                { id: PanelRecommendation.STRONG_NO, label: 'Strong No', color: 'text-[#E5484D]' },
              ].map((rec) => (
                <button
                  type="button"
                  key={rec.id}
                  onClick={() => setRecommendation(rec.id)}
                  className={`py-2 px-2.5 text-xs font-bold rounded-xl border transition-all ${
                    recommendation === rec.id
                      ? 'bg-[#EEEBFB] border-[#5B49D6] text-[#5B49D6] shadow-xs'
                      : 'bg-white border-[#E6E8F0] text-[#6B7490] hover:border-[#5B49D6]/40'
                  }`}
                >
                  {rec.label}
                </button>
              ))}
            </div>
          </div>

          {/* Technical Score (1-10) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#1B2236]">Technical Competency Score</label>
              <span className="text-xs font-bold text-[#5B49D6]">{technicalScore} / 10</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={technicalScore}
              onChange={(e) => setTechnicalScore(Number(e.target.value))}
              className="w-full accent-[#5B49D6] cursor-pointer"
            />
          </div>

          {/* Strengths & Concerns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#1B2236] mb-1">Key Strengths</label>
              <textarea
                value={strengths}
                onChange={(e) => setStrengths(e.target.value)}
                placeholder="Architecture, communication, problem solving..."
                rows={2}
                className="w-full text-xs rounded-xl border border-[#E6E8F0] p-2.5 bg-white text-[#1B2236] focus:border-[#5B49D6] focus:outline-none resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1B2236] mb-1">Concerns / Areas to Probe</label>
              <textarea
                value={concerns}
                onChange={(e) => setConcerns(e.target.value)}
                placeholder="Notice period, niche tool familiarity..."
                rows={2}
                className="w-full text-xs rounded-xl border border-[#E6E8F0] p-2.5 bg-white text-[#1B2236] focus:border-[#5B49D6] focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* Feedback & Comments */}
          <div>
            <label className="block text-xs font-semibold text-[#1B2236] mb-1">
              Internal Evaluation Notes <span className="text-[#E5484D]">*</span>
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Detailed interview observations, coding task results, panel synthesis..."
              rows={3}
              className="w-full text-xs rounded-xl border border-[#E6E8F0] p-2.5 bg-white text-[#1B2236] focus:border-[#5B49D6] focus:outline-none resize-none"
              required
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E6E8F0]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#6B7490] hover:text-[#1B2236] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-[#5B49D6] text-white rounded-xl text-xs font-bold hover:bg-[#5B49D6]/90 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                'Save Panel Feedback'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
