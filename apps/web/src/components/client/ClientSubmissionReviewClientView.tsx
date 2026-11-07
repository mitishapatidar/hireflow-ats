'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '../layout/PageHeader';
import {
  ClientSubmissionDetailDTO,
} from '@hireflow/shared';
import {
  clientShortlistAction,
  clientRejectAction,
  clientRequestDetailsAction,
  sendClientFeedbackAction,
  downloadClientCvAction,
} from '@/actions/client-portal';
import {
  Users,
  Briefcase,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Download,
  MessageSquare,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react';

interface Props {
  initialData: ClientSubmissionDetailDTO;
}

export function ClientSubmissionReviewClientView({ initialData }: Props) {
  const [data, setData] = useState<ClientSubmissionDetailDTO>(initialData);
  const [activeTab, setActiveTab] = useState<'profile' | 'experience' | 'cv' | 'history'>('profile');

  // Modals
  const [isShortlistModalOpen, setIsShortlistModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  // Form states
  const [shortlistComments, setShortlistComments] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectFeedback, setRejectFeedback] = useState('');
  const [detailsRequired, setDetailsRequired] = useState('');
  const [detailsContext, setDetailsContext] = useState('');
  const [detailsPriority, setDetailsPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [feedbackCategory, setFeedbackCategory] = useState<'GENERAL' | 'SKILLS' | 'INTERVIEW_PREP' | 'SUITABILITY'>('SUITABILITY');
  const [feedbackContent, setFeedbackContent] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const sub = data.submission;
  const profile = data.profile;
  const cv = data.cv;

  // Handlers
  async function handleShortlist(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setActionMessage(null);
    try {
      const res = await clientShortlistAction(sub.id, shortlistComments);
      if (res.success) {
        setActionMessage({ type: 'success', text: res.message || 'Candidate shortlisted successfully!' });
        setIsShortlistModalOpen(false);
        setData((prev) => ({
          ...prev,
          submission: {
            ...prev.submission,
            clientDecision: 'SHORTLISTED',
            clientDecisionAt: new Date().toISOString(),
          },
          decisionHistory: [
            {
              decision: 'SHORTLISTED',
              feedback: shortlistComments || null,
              decidedAt: new Date().toISOString(),
              clientUserName: 'You',
            },
            ...prev.decisionHistory,
          ],
        }));
      } else {
        setActionMessage({ type: 'error', text: res.error || 'Failed to shortlist candidate.' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'An unexpected error occurred.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReject(e: React.FormEvent) {
    e.preventDefault();
    if (rejectReason.trim().length < 5) {
      setActionMessage({ type: 'error', text: 'Rejection reason must be at least 5 characters.' });
      return;
    }

    setIsSubmitting(true);
    setActionMessage(null);
    try {
      const res = await clientRejectAction(sub.id, {
        reason: rejectReason,
        feedback: rejectFeedback,
      });
      if (res.success) {
        setActionMessage({
          type: 'success',
          text: res.message || 'Candidate rejection recorded. Shared with talent team only.',
        });
        setIsRejectModalOpen(false);
        setData((prev) => ({
          ...prev,
          submission: {
            ...prev.submission,
            clientDecision: 'REJECTED',
            clientDecisionReason: rejectReason,
            clientDecisionAt: new Date().toISOString(),
          },
          decisionHistory: [
            {
              decision: 'REJECTED',
              reason: rejectReason,
              feedback: rejectFeedback || null,
              decidedAt: new Date().toISOString(),
              clientUserName: 'You',
            },
            ...prev.decisionHistory,
          ],
        }));
      } else {
        setActionMessage({ type: 'error', text: res.error || 'Failed to record rejection.' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'An unexpected error occurred.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRequestDetails(e: React.FormEvent) {
    e.preventDefault();
    if (detailsRequired.trim().length < 5) {
      setActionMessage({ type: 'error', text: 'Information requested must be at least 5 characters.' });
      return;
    }

    setIsSubmitting(true);
    setActionMessage(null);
    try {
      const res = await clientRequestDetailsAction(sub.id, {
        informationRequired: detailsRequired,
        additionalContext: detailsContext,
        priority: detailsPriority,
      });
      if (res.success) {
        setActionMessage({ type: 'success', text: res.message || 'Request sent to your talent team.' });
        setIsDetailsModalOpen(false);
        setData((prev) => ({
          ...prev,
          submission: {
            ...prev.submission,
            clientDecision: 'NEED_DETAILS',
            clientDecisionAt: new Date().toISOString(),
          },
          decisionHistory: [
            {
              decision: 'NEED_DETAILS',
              informationRequired: detailsRequired,
              feedback: detailsContext || null,
              decidedAt: new Date().toISOString(),
              clientUserName: 'You',
            },
            ...prev.decisionHistory,
          ],
        }));
      } else {
        setActionMessage({ type: 'error', text: res.error || 'Failed to send request.' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'An unexpected error occurred.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSendFeedback(e: React.FormEvent) {
    e.preventDefault();
    if (feedbackContent.trim().length < 5) {
      setActionMessage({ type: 'error', text: 'Feedback content must be at least 5 characters.' });
      return;
    }

    setIsSubmitting(true);
    setActionMessage(null);
    try {
      const res = await sendClientFeedbackAction(sub.id, {
        category: feedbackCategory,
        content: feedbackContent,
      });
      if (res.success) {
        setActionMessage({ type: 'success', text: res.message || 'Feedback sent to recruitment team.' });
        setIsFeedbackModalOpen(false);
        setFeedbackContent('');
        setData((prev) => ({
          ...prev,
          recruitmentFeedback: [
            {
              id: `fb-${Date.now()}`,
              category: feedbackCategory,
              content: feedbackContent,
              createdAt: new Date().toISOString(),
              authorName: 'You',
            },
            ...prev.recruitmentFeedback,
          ],
        }));
      } else {
        setActionMessage({ type: 'error', text: res.error || 'Failed to send feedback.' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'An unexpected error occurred.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDownloadCv() {
    setIsSubmitting(true);
    setActionMessage(null);
    try {
      const res = await downloadClientCvAction(sub.id);
      if (res.success && res.data) {
        setActionMessage({
          type: 'success',
          text: `Watermarked CV ready: ${res.data.fileName}. Watermark applied: "${res.data.watermarkText}". Remaining today: ${res.data.remainingToday}`,
        });
        setData((prev) => ({
          ...prev,
          cv: {
            ...prev.cv,
            usedToday: prev.cv.usedToday + 1,
            remainingToday: Math.max(0, prev.cv.remainingToday - 1),
          },
        }));
      } else {
        setActionMessage({ type: 'error', text: res.error || 'Failed to download CV.' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'An unexpected error occurred.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <PageHeader
        title={`${profile.candidateName} — Candidate Review`}
        subtitle={`Vetted submission for position: ${sub.jobTitle} (${sub.jobCode})`}
        breadcrumbs={[
          { label: 'Client Portal', href: '/portal' },
          { label: 'Submitted Profiles', href: '/submitted-profiles' },
          { label: profile.candidateName },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/submitted-profiles"
              className="px-3 py-1.5 bg-white border border-[#E6E8F0] hover:bg-[#F6F7FB] text-[#1B2236] rounded-lg text-xs font-semibold transition-colors"
            >
              Back to Submissions
            </Link>
          </div>
        }
      />

      {/* Global Alert Notification */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
            actionMessage.type === 'success'
              ? 'bg-[#E3F6EC] border-[#12B76A]/30 text-[#12B76A]'
              : 'bg-[#FEE2E2] border-[#E5484D]/30 text-[#E5484D]'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span className="font-semibold">{actionMessage.text}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="p-1 hover:opacity-75">
            ✕
          </button>
        </div>
      )}

      {/* Frame 29 Hero Card */}
      <div className="bg-white rounded-xl border border-[#E6E8F0] p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-[#1B2236]">{profile.candidateName}</h1>
            <span className="text-xs font-mono font-medium text-[#6B7490] bg-[#F6F7FB] px-2 py-0.5 rounded border border-[#E6E8F0]">
              {profile.candidateCode}
            </span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#EEEBFB] text-[#5B49D6]">
              Standard Profile {profile.versionTag}
            </span>
            {sub.matchScore !== null && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#E3F6EC] text-[#12B76A]">
                {sub.matchScore}% Match Score
              </span>
            )}
          </div>

          <div className="text-xs text-[#6B7490] flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-[#1B2236]">{profile.currentTitle || 'Experienced Professional'}</span>
            {profile.currentCompany && <span>• {profile.currentCompany}</span>}
            {profile.location && <span>• {profile.location}</span>}
          </div>

          {/* Current Status Pill */}
          <div className="pt-1 flex items-center gap-2 text-xs">
            <span className="text-[#6B7490]">Your Hiring Decision:</span>
            {sub.clientDecision === 'SHORTLISTED' && (
              <span className="font-bold text-[#12B76A] flex items-center gap-1 bg-[#E3F6EC] px-2 py-0.5 rounded">
                <CheckCircle2 className="w-3.5 h-3.5" /> Shortlisted for Interview
              </span>
            )}
            {sub.clientDecision === 'REJECTED' && (
              <span className="font-bold text-[#E5484D] flex items-center gap-1 bg-[#FEE2E2] px-2 py-0.5 rounded">
                <XCircle className="w-3.5 h-3.5" /> Rejected
              </span>
            )}
            {sub.clientDecision === 'NEED_DETAILS' && (
              <span className="font-bold text-[#F59E0B] flex items-center gap-1 bg-[#FEF3DC] px-2 py-0.5 rounded">
                <HelpCircle className="w-3.5 h-3.5" /> Details Requested
              </span>
            )}
            {!sub.clientDecision && (
              <span className="font-bold text-[#5B49D6] flex items-center gap-1 bg-[#EEEBFB] px-2 py-0.5 rounded">
                <Clock className="w-3.5 h-3.5" /> Pending Client Decision
              </span>
            )}
          </div>
        </div>

        {/* Frame 29 Decision Action Bar */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => setIsShortlistModalOpen(true)}
            className="px-4 py-2 bg-[#12B76A] hover:bg-[#12B76A]/90 text-white rounded-lg text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Shortlist</span>
          </button>

          <button
            onClick={() => setIsRejectModalOpen(true)}
            className="px-4 py-2 bg-white border border-[#E5484D] text-[#E5484D] hover:bg-[#FEE2E2] rounded-lg text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Reject</span>
          </button>

          <button
            onClick={() => setIsDetailsModalOpen(true)}
            className="px-3.5 py-2 bg-white border border-[#E6E8F0] text-[#1B2236] hover:bg-[#F6F7FB] rounded-lg text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span>Need Details</span>
          </button>

          <button
            onClick={() => setIsFeedbackModalOpen(true)}
            className="px-3.5 py-2 bg-[#EEEBFB] text-[#5B49D6] hover:bg-[#5B49D6] hover:text-white rounded-lg text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Feedback</span>
          </button>
        </div>
      </div>

      {/* Frame 29 Tabbed Interface */}
      <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs overflow-hidden">
        <div className="flex border-b border-[#E6E8F0] bg-[#F6F7FB] text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-5 py-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'profile'
                ? 'border-[#5B49D6] text-[#5B49D6] bg-white'
                : 'border-transparent text-[#6B7490] hover:text-[#1B2236]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Standard Profile</span>
          </button>
          <button
            onClick={() => setActiveTab('experience')}
            className={`px-5 py-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'experience'
                ? 'border-[#5B49D6] text-[#5B49D6] bg-white'
                : 'border-transparent text-[#6B7490] hover:text-[#1B2236]'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Experience & Skills</span>
          </button>
          <button
            onClick={() => setActiveTab('cv')}
            className={`px-5 py-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'cv'
                ? 'border-[#5B49D6] text-[#5B49D6] bg-white'
                : 'border-transparent text-[#6B7490] hover:text-[#1B2236]'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Watermarked CV ({cv.remainingToday} left)</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-5 py-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'history'
                ? 'border-[#5B49D6] text-[#5B49D6] bg-white'
                : 'border-transparent text-[#6B7490] hover:text-[#1B2236]'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Decision History & Feedback ({data.decisionHistory.length + data.recruitmentFeedback.length})</span>
          </button>
        </div>

        <div className="p-6">
          {/* TAB 1: Standard Profile Overview */}
          {activeTab === 'profile' && (
            <div className="space-y-6 text-xs max-w-4xl">
              <div>
                <h3 className="text-xs font-bold text-[#6B7490] uppercase tracking-wider mb-2">
                  Executive Candidate Summary
                </h3>
                <div className="bg-[#F6F7FB] p-4 rounded-xl border border-[#E6E8F0] leading-relaxed text-[#333F51] text-sm">
                  {profile.professionalSummary || profile.headline || 'No executive summary provided for this profile version.'}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-[#6B7490] uppercase tracking-wider mb-2">
                  Core Verified Skills
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(profile.coreSkills || []).map((s: string, i: number) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-md bg-[#EEEBFB] text-[#5B49D6] font-semibold text-xs border border-[#5B49D6]/20"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {profile.portfolioUrl && (
                <div>
                  <h3 className="text-xs font-bold text-[#6B7490] uppercase tracking-wider mb-2">
                    Verified Portfolio / Code Repositories
                  </h3>
                  <a
                    href={profile.portfolioUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#5B49D6] hover:underline font-semibold"
                  >
                    {profile.portfolioUrl}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Experience & Education */}
          {activeTab === 'experience' && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h3 className="text-xs font-bold text-[#6B7490] uppercase tracking-wider mb-4">
                  Professional Experience Highlights
                </h3>
                {profile.experienceHighlights && Array.isArray(profile.experienceHighlights) && profile.experienceHighlights.length > 0 ? (
                  <div className="space-y-4">
                    {profile.experienceHighlights.map((exp: any, i: number) => (
                      <div key={i} className="p-4 bg-[#F6F7FB] rounded-xl border border-[#E6E8F0] space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-sm text-[#1B2236]">{exp.title}</span>
                          <span className="text-[#6B7490]">{exp.duration}</span>
                        </div>
                        <div className="text-xs font-semibold text-[#5B49D6]">{exp.company}</div>
                        {exp.description && (
                          <p className="text-xs text-[#333F51] pt-1 leading-relaxed whitespace-pre-wrap">
                            {exp.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-5 bg-[#F6F7FB] rounded-xl text-xs text-[#6B7490]">
                    Experience highlights are summarized in the executive overview.
                  </div>
                )}
              </div>

              {profile.educationHighlights && Array.isArray(profile.educationHighlights) && profile.educationHighlights.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-[#6B7490] uppercase tracking-wider mb-3">
                    Education & Credentials
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {profile.educationHighlights.map((edu: any, i: number) => (
                      <div key={i} className="p-3 bg-[#F6F7FB] rounded-lg border border-[#E6E8F0] text-xs space-y-0.5">
                        <div className="font-bold text-[#1B2236]">{edu.degree}</div>
                        <div className="text-[#6B7490]">{edu.institution} ({edu.year})</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Watermarked CV Preview & Download */}
          {activeTab === 'cv' && (
            <div className="space-y-6 max-w-3xl">
              <div className="p-5 bg-[#EEEBFB]/50 rounded-xl border border-[#5B49D6]/20 space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-[#5B49D6]">
                  <ShieldCheck className="w-5 h-5 text-[#5B49D6]" />
                  <span>Enterprise Candidate CV Protection & Watermarking</span>
                </div>
                <p className="text-xs text-[#6B7490] leading-relaxed">
                  In accordance with your organization's data governance policy, all downloaded resumes are automatically embedded with a server-side digital watermark for candidate privacy:
                </p>
                <div className="p-2.5 bg-white rounded border border-[#E6E8F0] font-mono text-xs font-bold text-[#1E2A4A] tracking-wider text-center">
                  {cv.watermarkPreview}
                </div>
              </div>

              {/* Quota Tracker */}
              <div className="bg-white rounded-xl border border-[#E6E8F0] p-4 flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-[#1B2236]">Daily Client Download Quota</div>
                  <div className="text-[#6B7490] text-[11px] mt-0.5">
                    Resets every day at 12:00 AM Asia/Kolkata (IST)
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-[#1B2236]">
                    <span className="text-[#5B49D6]">{cv.remainingToday}</span> / {cv.dailyLimit} remaining
                  </div>
                  <div className="text-[11px] text-[#12B76A] font-medium">{cv.usedToday} downloaded today</div>
                </div>
              </div>

              {/* Action Button */}
              <div>
                <button
                  onClick={handleDownloadCv}
                  disabled={isSubmitting || cv.remainingToday <= 0}
                  className="px-5 py-3 bg-[#5B49D6] hover:bg-[#5B49D6]/90 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{isSubmitting ? 'Watermarking CV...' : 'Download Watermarked CV (PDF)'}</span>
                </button>
                {cv.remainingToday <= 0 && (
                  <p className="text-xs text-[#E5484D] mt-2">
                    Daily download limit reached. Please contact your HireFlow account manager for quota increases.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: History & Feedback */}
          {activeTab === 'history' && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h3 className="text-xs font-bold text-[#6B7490] uppercase tracking-wider mb-3">
                  Client Decision Timeline
                </h3>
                {data.decisionHistory.length === 0 ? (
                  <div className="p-4 bg-[#F6F7FB] rounded-lg text-xs text-[#6B7490]">
                    No decisions have been recorded yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.decisionHistory.map((item, i) => (
                      <div key={i} className="p-4 bg-[#F6F7FB] rounded-lg border border-[#E6E8F0] space-y-1 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-[#1B2236]">Decision: {item.decision}</span>
                          <span className="text-[#6B7490]">{new Date(item.decidedAt).toLocaleString('en-GB')}</span>
                        </div>
                        <div className="text-[#6B7490]">Recorded by: {item.clientUserName}</div>
                        {item.reason && (
                          <div className="pt-1 text-[#E5484D]">
                            <strong>Reason:</strong> {item.reason}
                          </div>
                        )}
                        {item.feedback && (
                          <div className="pt-0.5 text-[#333F51]">
                            <strong>Feedback:</strong> {item.feedback}
                          </div>
                        )}
                        {item.informationRequired && (
                          <div className="pt-0.5 text-[#F59E0B]">
                            <strong>Information Requested:</strong> {item.informationRequired}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-xs font-bold text-[#6B7490] uppercase tracking-wider mb-3">
                  Feedback Sent to Recruitment Team
                </h3>
                {data.recruitmentFeedback.length === 0 ? (
                  <div className="p-4 bg-[#F6F7FB] rounded-lg text-xs text-[#6B7490]">
                    No recruitment-team feedback has been recorded for this submission yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.recruitmentFeedback.map((fb) => (
                      <div key={fb.id} className="p-4 bg-[#EEEBFB]/40 rounded-lg border border-[#5B49D6]/20 space-y-1 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-[#5B49D6]">Category: {fb.category}</span>
                          <span className="text-[#6B7490]">{new Date(fb.createdAt).toLocaleString('en-GB')}</span>
                        </div>
                        <p className="text-[#333F51] pt-1">{fb.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          MODALS FOR ACTIONS
         ========================================================================= */}

      {/* Shortlist Modal */}
      {isShortlistModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-[#E6E8F0] space-y-4">
            <div className="flex items-center gap-2 text-base font-bold text-[#1B2236]">
              <CheckCircle2 className="w-5 h-5 text-[#12B76A]" />
              <span>Shortlist {profile.candidateName}</span>
            </div>
            <p className="text-xs text-[#6B7490] leading-relaxed">
              Shortlisting notifies your HireFlow talent team to proceed with coordinating interview schedules for this candidate.
            </p>

            <form onSubmit={handleShortlist} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                  Optional notes / interview availability:
                </label>
                <textarea
                  value={shortlistComments}
                  onChange={(e) => setShortlistComments(e.target.value)}
                  placeholder="e.g., Prefers technical round on Thursday afternoon..."
                  className="w-full p-2.5 text-xs bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg text-[#1B2236] outline-none focus:border-[#5B49D6] h-24"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsShortlistModalOpen(false)}
                  className="px-4 py-2 border border-[#E6E8F0] text-xs font-semibold rounded-lg hover:bg-[#F6F7FB]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#12B76A] hover:bg-[#12B76A]/90 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  {isSubmitting ? 'Shortlisting...' : 'Confirm Shortlist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal with Mandatory Reason */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-[#E6E8F0] space-y-4">
            <div className="flex items-center gap-2 text-base font-bold text-[#E5484D]">
              <XCircle className="w-5 h-5 text-[#E5484D]" />
              <span>Reject Candidate Profile</span>
            </div>
            <p className="text-xs text-[#6B7490] leading-relaxed">
              Please provide a specific rejection reason. This feedback is shared with the HireFlow recruitment team to calibrate future candidate searches and will <strong>not</strong> be sent directly to the candidate.
            </p>

            <form onSubmit={handleReject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                  Mandatory Rejection Reason <span className="text-[#E5484D]">*</span>
                </label>
                <select
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full p-2.5 text-xs bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg text-[#1B2236] outline-none focus:border-[#5B49D6] mb-2"
                  required
                >
                  <option value="">-- Select a reason --</option>
                  <option value="Insufficient technical depth in core technologies">Insufficient technical depth in core technologies</option>
                  <option value="Total experience below position requirements">Total experience below position requirements</option>
                  <option value="Expected compensation exceeds authorized budget">Expected compensation exceeds authorized budget</option>
                  <option value="Notice period too long for project timeline">Notice period too long for project timeline</option>
                  <option value="Work arrangement / location mismatch">Work arrangement / location mismatch</option>
                  <option value="Candidate already interviewed previously">Candidate already interviewed previously</option>
                </select>

                <input
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Or enter custom rejection reason (min 5 chars)..."
                  className="w-full p-2.5 text-xs bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg text-[#1B2236] outline-none focus:border-[#5B49D6]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                  Additional Constructive Feedback (Optional)
                </label>
                <textarea
                  value={rejectFeedback}
                  onChange={(e) => setRejectFeedback(e.target.value)}
                  placeholder="Notes for the recruitment team regarding future profile sourcing..."
                  className="w-full p-2.5 text-xs bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg text-[#1B2236] outline-none focus:border-[#5B49D6] h-20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(false)}
                  className="px-4 py-2 border border-[#E6E8F0] text-xs font-semibold rounded-lg hover:bg-[#F6F7FB]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || rejectReason.trim().length < 5}
                  className="px-4 py-2 bg-[#E5484D] hover:bg-[#E5484D]/90 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  {isSubmitting ? 'Recording...' : 'Submit Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Need Details Modal */}
      {isDetailsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-[#E6E8F0] space-y-4">
            <div className="flex items-center gap-2 text-base font-bold text-[#1B2236]">
              <HelpCircle className="w-5 h-5 text-[#F59E0B]" />
              <span>Request Additional Candidate Details</span>
            </div>
            <p className="text-xs text-[#6B7490] leading-relaxed">
              Ask your dedicated talent team for supplementary information before making a shortlist or rejection decision.
            </p>

            <form onSubmit={handleRequestDetails} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                  Information Required <span className="text-[#E5484D]">*</span>
                </label>
                <input
                  type="text"
                  value={detailsRequired}
                  onChange={(e) => setDetailsRequired(e.target.value)}
                  placeholder="e.g., Code portfolio, notice period buyout flexibility..."
                  className="w-full p-2.5 text-xs bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg text-[#1B2236] outline-none focus:border-[#5B49D6]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                  Urgency / Priority
                </label>
                <select
                  value={detailsPriority}
                  onChange={(e: any) => setDetailsPriority(e.target.value)}
                  className="w-full p-2.5 text-xs bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg text-[#1B2236] outline-none focus:border-[#5B49D6]"
                >
                  <option value="LOW">Low (Next business day)</option>
                  <option value="MEDIUM">Medium (Normal)</option>
                  <option value="HIGH">High (Immediate)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                  Additional Context (Optional)
                </label>
                <textarea
                  value={detailsContext}
                  onChange={(e) => setDetailsContext(e.target.value)}
                  placeholder="Additional context or specific technical questions..."
                  className="w-full p-2.5 text-xs bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg text-[#1B2236] outline-none focus:border-[#5B49D6] h-20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="px-4 py-2 border border-[#E6E8F0] text-xs font-semibold rounded-lg hover:bg-[#F6F7FB]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || detailsRequired.trim().length < 5}
                  className="px-4 py-2 bg-[#5B49D6] hover:bg-[#5B49D6]/90 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  {isSubmitting ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Give Feedback Modal */}
      {isFeedbackModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-[#E6E8F0] space-y-4">
            <div className="flex items-center gap-2 text-base font-bold text-[#1B2236]">
              <MessageSquare className="w-5 h-5 text-[#5B49D6]" />
              <span>Feedback to Talent Team</span>
            </div>
            <p className="text-xs text-[#6B7490] leading-relaxed">
              Submit feedback directly to your dedicated HireFlow account team. This note will remain strictly internal to the agency.
            </p>

            <form onSubmit={handleSendFeedback} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                  Category
                </label>
                <select
                  value={feedbackCategory}
                  onChange={(e: any) => setFeedbackCategory(e.target.value)}
                  className="w-full p-2.5 text-xs bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg text-[#1B2236] outline-none focus:border-[#5B49D6]"
                >
                  <option value="SUITABILITY">Candidate Suitability</option>
                  <option value="SKILLS">Skills Assessment</option>
                  <option value="INTERVIEW_PREP">Interview Preparation Guidelines</option>
                  <option value="GENERAL">General Feedback</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                  Feedback Content <span className="text-[#E5484D]">*</span>
                </label>
                <textarea
                  value={feedbackContent}
                  onChange={(e) => setFeedbackContent(e.target.value)}
                  placeholder="Share guidance on role fit, interview focus areas, or team culture alignment..."
                  className="w-full p-2.5 text-xs bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg text-[#1B2236] outline-none focus:border-[#5B49D6] h-28"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFeedbackModalOpen(false)}
                  className="px-4 py-2 border border-[#E6E8F0] text-xs font-semibold rounded-lg hover:bg-[#F6F7FB]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || feedbackContent.trim().length < 5}
                  className="px-4 py-2 bg-[#5B49D6] hover:bg-[#5B49D6]/90 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  {isSubmitting ? 'Sending...' : 'Submit Feedback'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
