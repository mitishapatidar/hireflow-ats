'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  Video,
  User,
  Building2,
  Copy,
  Check,
  Star,
  MessageSquare,
  AlertTriangle,
  History,
  CheckSquare,
  CheckCircle2,
  UserX,
  ExternalLink,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import Link from 'next/link';
import { InterviewOutcome, RECOMMENDATION_LABELS, PanelRecommendation } from '@hireflow/shared';
import { getInterviewDetailAction } from '@/actions/interviews';
import { PanelFeedbackModal } from './PanelFeedbackModal';
import { RescheduleModal } from './RescheduleModal';
import { OutcomeModal } from './OutcomeModal';
import { FollowUpTaskModal } from './FollowUpTaskModal';
import { RejectionModal } from '@/components/pipeline/RejectionModal';

interface InterviewDetailsDrawerProps {
  interviewId: string | null;
  onClose: () => void;
  onInterviewUpdated: () => void;
  users: Array<{ id: string; name: string; email: string }>;
}

export const InterviewDetailsDrawer: React.FC<InterviewDetailsDrawerProps> = ({
  interviewId,
  onClose,
  onInterviewUpdated,
  users,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [interview, setInterview] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Modal triggers
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [outcomeAction, setOutcomeAction] = useState<'COMPLETE' | 'NO_SHOW' | 'CANCEL' | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  useEffect(() => {
    if (!interviewId) {
      setInterview(null);
      return;
    }

    async function load() {
      setLoading(true);
      setError(null);
      const res = await getInterviewDetailAction(interviewId!);
      if (res.success && res.data) {
        setInterview(res.data);
      } else {
        setError(res.error || 'Failed to load interview details');
      }
      setLoading(false);
    }

    load();
  }, [interviewId]);

  if (!interviewId) return null;

  const copyMeetingLink = () => {
    if (interview?.meetingLink) {
      navigator.clipboard.writeText(interview.meetingLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleRefresh = async () => {
    if (interviewId) {
      const res = await getInterviewDetailAction(interviewId);
      if (res.success && res.data) {
        setInterview(res.data);
      }
      onInterviewUpdated();
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#1E2A4A]/40 backdrop-blur-2xs transition-opacity" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-2xl border-l border-[#E6E8F0] flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E6E8F0] bg-[#F6F7FB]/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#EEEBFB] text-[#5B49D6]">
                {interview?.round?.name || 'Interview Dossier'}
              </span>
              {interview?.outcome && (
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                    interview.outcome === InterviewOutcome.COMPLETED
                      ? 'bg-[#E8FAF0] text-[#12B76A]'
                      : interview.outcome === InterviewOutcome.NO_SHOW
                      ? 'bg-[#FFF0F0] text-[#E5484D]'
                      : interview.outcome === InterviewOutcome.RESCHEDULED
                      ? 'bg-[#FFFBEB] text-[#F59E0B]'
                      : interview.outcome === InterviewOutcome.CANCELLED
                      ? 'bg-[#F6F7FB] text-[#6B7490]'
                      : 'bg-[#EEEBFB] text-[#5B49D6]'
                  }`}
                >
                  {interview.outcome}
                </span>
              )}
            </div>
            <h2 className="text-base font-bold text-[#1B2236] mt-1">
              {interview?.candidate?.name || 'Interview Details'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-[#6B7490] hover:text-[#1B2236] hover:bg-[#E6E8F0] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2 text-xs text-[#6B7490]">
              <Loader2 className="w-6 h-6 animate-spin text-[#5B49D6]" />
              <span>Loading interview dossier...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-[#FFF0F0] border border-[#E5484D]/30 rounded-xl text-xs text-[#E5484D]">
              {error}
            </div>
          ) : interview ? (
            <>
              {/* Candidate & Job Summary Card */}
              <div className="p-4 rounded-xl border border-[#E6E8F0] bg-[#F6F7FB] space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-[#1B2236]">{interview.candidate.name}</h3>
                    <p className="text-xs text-[#6B7490]">
                      {interview.candidate.title || 'Candidate'} {interview.candidate.company ? `at ${interview.candidate.company}` : ''}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-[#6B7490]">
                      <span>{interview.candidate.email}</span>
                      {interview.candidate.phone && <span>• {interview.candidate.phone}</span>}
                    </div>
                  </div>
                  <Link
                    href={`/candidates/${interview.candidate.id}`}
                    target="_blank"
                    className="text-xs font-semibold text-[#5B49D6] hover:underline flex items-center gap-1"
                  >
                    <span>Profile</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>

                <div className="pt-2.5 border-t border-[#E6E8F0]/80 flex flex-wrap items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-[#1B2236]">
                    <Building2 className="w-3.5 h-3.5 text-[#5B49D6]" />
                    <span className="font-semibold">{interview.job.title}</span>
                    <span className="text-[#6B7490]">({interview.job.code})</span>
                  </div>
                  <span className="text-xs text-[#6B7490]">{interview.job.clientName}</span>
                </div>
              </div>

              {/* Scheduled Time & Meeting Details */}
              <div className="p-4 rounded-xl border border-[#E6E8F0] bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#5B49D6]" />
                    <span className="text-xs font-bold text-[#1B2236]">
                      {new Date(interview.scheduledAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-[#5B49D6]">
                    {interview.duration} mins ({interview.timezone})
                  </span>
                </div>

                {interview.meetingLink && (
                  <div className="p-3 bg-[#EEEBFB]/50 border border-[#5B49D6]/20 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 truncate">
                      <Video className="w-4 h-4 text-[#5B49D6] shrink-0" />
                      <span className="text-xs font-mono text-[#5B49D6] truncate">
                        {interview.meetingLink}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={copyMeetingLink}
                      className="px-2.5 py-1 bg-white border border-[#5B49D6]/30 text-[#5B49D6] text-xs font-bold rounded-lg hover:bg-[#5B49D6] hover:text-white transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedLink ? <Check className="w-3 h-3 text-[#12B76A]" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Panel Members */}
              <div>
                <h4 className="text-xs font-bold text-[#1B2236] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#5B49D6]" />
                  Assigned Panel Members ({interview.panelMembers.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {interview.panelMembers.map((pm: any) => (
                    <div
                      key={pm.userId}
                      className="p-2.5 bg-white border border-[#E6E8F0] rounded-xl flex items-center gap-2 text-xs"
                    >
                      <div className="w-7 h-7 rounded-lg bg-[#EEEBFB] text-[#5B49D6] font-bold flex items-center justify-center text-xs">
                        {pm.name.charAt(0)}
                      </div>
                      <div className="truncate">
                        <div className="font-bold text-[#1B2236] truncate">{pm.name}</div>
                        <div className="text-[10px] text-[#6B7490] truncate">{pm.email}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Panel Feedbacks (Internal Only!) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-[#1B2236] uppercase tracking-wider flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-[#F59E0B]" />
                    Panel Feedback ({interview.feedbacks.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowFeedbackModal(true)}
                    className="text-xs font-bold text-[#5B49D6] hover:underline cursor-pointer"
                  >
                    + Log Feedback
                  </button>
                </div>

                {interview.feedbacks.length === 0 ? (
                  <div className="p-4 bg-[#F6F7FB] border border-[#E6E8F0] rounded-xl text-center text-xs text-[#6B7490] italic">
                    No panel feedback logged yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {interview.feedbacks.map((fb: any) => (
                      <div key={fb.id} className="p-3.5 bg-white border border-[#E6E8F0] rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-[#1B2236]">{fb.reviewerName}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E8FAF0] text-[#12B76A]">
                              {RECOMMENDATION_LABELS[fb.recommendation as PanelRecommendation] || fb.recommendation}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-xs font-bold text-[#F59E0B]">
                            <Star className="w-3.5 h-3.5 fill-[#F59E0B]" />
                            <span>{fb.rating} / 5</span>
                          </div>
                        </div>

                        {fb.technicalScore && (
                          <div className="text-[11px] text-[#6B7490]">
                            Technical Score: <span className="font-bold text-[#1B2236]">{fb.technicalScore}/10</span>
                          </div>
                        )}

                        <p className="text-xs text-[#1B2236] bg-[#F6F7FB] p-2.5 rounded-lg leading-relaxed">
                          {fb.feedback}
                        </p>

                        {(fb.strengths || fb.concerns) && (
                          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                            {fb.strengths && (
                              <div className="text-[#12B76A]">
                                <span className="font-bold">Strengths:</span> {fb.strengths}
                              </div>
                            )}
                            {fb.concerns && (
                              <div className="text-[#E5484D]">
                                <span className="font-bold">Concerns:</span> {fb.concerns}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* History Timeline */}
              {interview.histories?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-[#1B2236] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-[#5B49D6]" />
                    Audit & Event History
                  </h4>
                  <div className="space-y-2 border-l-2 border-[#E6E8F0] ml-2 pl-3">
                    {interview.histories.map((h: any) => (
                      <div key={h.id} className="text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#1B2236]">{h.action}</span>
                          <span className="text-[10px] text-[#6B7490]">
                            {new Date(h.createdAt).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        {h.reason && <p className="text-[#6B7490] text-[11px] mt-0.5">{h.reason}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Drawer Action Bar */}
        {interview && (
          <div className="p-4 border-t border-[#E6E8F0] bg-[#F6F7FB]/60 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOutcomeAction('COMPLETE')}
                disabled={interview.outcome === InterviewOutcome.COMPLETED || interview.outcome === InterviewOutcome.CANCELLED}
                className="px-3 py-1.5 bg-[#12B76A] text-white rounded-lg text-xs font-bold hover:bg-[#12B76A]/90 transition-colors flex items-center gap-1 disabled:opacity-40 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Complete</span>
              </button>

              <button
                type="button"
                onClick={() => setOutcomeAction('NO_SHOW')}
                disabled={interview.outcome === InterviewOutcome.NO_SHOW || interview.outcome === InterviewOutcome.COMPLETED || interview.outcome === InterviewOutcome.CANCELLED}
                className="px-3 py-1.5 bg-[#F59E0B] text-white rounded-lg text-xs font-bold hover:bg-[#F59E0B]/90 transition-colors flex items-center gap-1 disabled:opacity-40 cursor-pointer"
              >
                <UserX className="w-3.5 h-3.5" />
                <span>No-Show</span>
              </button>

              <button
                type="button"
                onClick={() => setShowRescheduleModal(true)}
                disabled={interview.outcome === InterviewOutcome.COMPLETED || interview.outcome === InterviewOutcome.CANCELLED}
                className="px-3 py-1.5 bg-white border border-[#E6E8F0] text-[#1B2236] rounded-lg text-xs font-bold hover:bg-[#EEEBFB] hover:text-[#5B49D6] transition-colors disabled:opacity-40 cursor-pointer"
              >
                Reschedule
              </button>

              <button
                type="button"
                onClick={() => setShowTaskModal(true)}
                className="px-3 py-1.5 bg-white border border-[#E6E8F0] text-[#1B2236] rounded-lg text-xs font-bold hover:bg-[#EEEBFB] hover:text-[#5B49D6] transition-colors flex items-center gap-1 cursor-pointer"
              >
                <CheckSquare className="w-3.5 h-3.5 text-[#5B49D6]" />
                <span>Task</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOutcomeAction('CANCEL')}
                disabled={interview.outcome === InterviewOutcome.CANCELLED || interview.outcome === InterviewOutcome.COMPLETED}
                className="px-3 py-1.5 text-xs font-semibold text-[#6B7490] hover:text-[#E5484D] transition-colors disabled:opacity-40 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => setShowRejectModal(true)}
                className="px-3 py-1.5 bg-[#FFF0F0] text-[#E5484D] border border-[#E5484D]/30 rounded-lg text-xs font-bold hover:bg-[#E5484D] hover:text-white transition-colors cursor-pointer"
              >
                Reject Candidate
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Nested Modals */}
      {interview && (
        <>
          <PanelFeedbackModal
            isOpen={showFeedbackModal}
            onClose={() => setShowFeedbackModal(false)}
            interviewId={interview.id}
            candidateName={interview.candidate.name}
            roundName={interview.round?.name || 'Interview Round'}
            onSubmitted={handleRefresh}
          />

          <RescheduleModal
            isOpen={showRescheduleModal}
            onClose={() => setShowRescheduleModal(false)}
            interviewId={interview.id}
            candidateName={interview.candidate.name}
            currentScheduledAtIST={`${new Date(interview.scheduledAt).toLocaleDateString('en-GB')} at ${interview.duration} mins`}
            onRescheduled={handleRefresh}
          />

          <OutcomeModal
            isOpen={outcomeAction !== null}
            onClose={() => setOutcomeAction(null)}
            interviewId={interview.id}
            candidateName={interview.candidate.name}
            roundName={interview.round?.name || 'Interview Round'}
            actionType={outcomeAction || 'COMPLETE'}
            onUpdated={handleRefresh}
          />

          <FollowUpTaskModal
            isOpen={showTaskModal}
            onClose={() => setShowTaskModal(false)}
            interviewId={interview.id}
            candidateName={interview.candidate.name}
            users={users}
            onCreated={handleRefresh}
          />

          {showRejectModal && (
            <RejectionModal
              applicationId={interview.applicationId}
              jobId={interview.job.id}
              onClose={() => setShowRejectModal(false)}
              onRejected={handleRefresh}
            />
          )}
        </>
      )}
    </>
  );
};
