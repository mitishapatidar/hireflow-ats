'use client';
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import React, { useState, useTransition } from 'react';
import {
  X,
  FileText,
  Edit3,
  History,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  ShieldCheck,
  Eye,
  Loader2,
  Building2,
  Briefcase,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import {
  updateProfileVersionAction,
  requestApprovalAction,
  reviewApprovalAction,
  sendSubmissionAction,
} from '@/actions/submissions';
import { SubmissionApprovalStatus, UserRole } from '@hireflow/shared';

interface StandardProfileModalProps {
  submissionDetail: any;
  currentUser: { id: string; name: string; role: string };
  onClose: () => void;
  onRefresh: () => void;
}

type Tab = 'preview' | 'edit' | 'versions' | 'send' | 'cv';

export function StandardProfileModal({
  submissionDetail,
  currentUser,
  onClose,
  onRefresh,
}: StandardProfileModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('preview');
  const [isPending, startTransition] = useTransition();
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit Profile Form State
  const profile = submissionDetail.profile;
  const [headline, setHeadline] = useState(profile?.headline || '');
  const [summary, setSummary] = useState(profile?.professionalSummary || '');
  const [skills, setSkills] = useState<string[]>(profile?.coreSkills || []);
  const [newSkill, setNewSkill] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState(profile?.portfolioUrl || '');
  const [changeSummary, setChangeSummary] = useState('');

  // Send to Client Form State
  const [recipientContactId, setRecipientContactId] = useState(
    submissionDetail.job?.client?.contacts?.[0]?.id || ''
  );
  const [emailSubject, setEmailSubject] = useState(
    `Candidate Presentation: ${submissionDetail.candidate?.name} — ${submissionDetail.job?.title}`
  );
  const [coverNote, setCoverNote] = useState(
    `Dear Hiring Team,\n\nPlease find attached the standardized candidate profile and watermarked CV for ${submissionDetail.candidate?.name} for the ${submissionDetail.job?.title} position.\n\nBest regards,\n${currentUser.name}`
  );

  // Manager Approval Review State
  const [reviewDecision, setReviewDecision] = useState<'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED'>('APPROVED');
  const [reviewComments, setReviewComments] = useState('');

  const isManagerOrAdmin =
    currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER;

  const jobIsActive = submissionDetail.job?.status === 'ACTIVE';

  function handleAddSkill() {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill('');
    }
  }

  function handleRemoveSkill(skillToRemove: string) {
    setSkills(skills.filter((s) => s !== skillToRemove));
  }

  function handleSaveNewVersion(e: React.FormEvent) {
    e.preventDefault();
    if (!changeSummary.trim()) {
      setAlertMsg({ type: 'error', text: 'Change summary is mandatory to record a new profile version.' });
      return;
    }

    setAlertMsg(null);
    startTransition(async () => {
      const res = await updateProfileVersionAction(submissionDetail.id, {
        headline,
        summary,
        selectedSkills: skills,
        portfolioUrl: portfolioUrl || undefined,
        changeSummary: changeSummary.trim(),
      });

      if (res.success) {
        setAlertMsg({ type: 'success', text: `New profile version ${res.versionTag} created successfully.` });
        setChangeSummary('');
        onRefresh();
        setActiveTab('preview');
      } else {
        setAlertMsg({ type: 'error', text: res.error || 'Failed to save new profile version.' });
      }
    });
  }

  function handleRequestApproval() {
    setAlertMsg(null);
    startTransition(async () => {
      const res = await requestApprovalAction(submissionDetail.id);
      if (res.success) {
        setAlertMsg({ type: 'success', text: 'Manager approval requested successfully.' });
        onRefresh();
      } else {
        setAlertMsg({ type: 'error', text: res.error || 'Failed to request approval.' });
      }
    });
  }

  function handleReviewApproval(e: React.FormEvent) {
    e.preventDefault();
    if (!reviewComments.trim()) {
      setAlertMsg({ type: 'error', text: 'Review comments are required.' });
      return;
    }

    setAlertMsg(null);
    startTransition(async () => {
      const res = await reviewApprovalAction(submissionDetail.id, reviewDecision, reviewComments.trim());
      if (res.success) {
        setAlertMsg({ type: 'success', text: `Approval decision "${reviewDecision}" recorded.` });
        setReviewComments('');
        onRefresh();
      } else {
        setAlertMsg({ type: 'error', text: res.error || 'Failed to record approval decision.' });
      }
    });
  }

  function handleSendSubmission(e: React.FormEvent) {
    e.preventDefault();
    if (!recipientContactId) {
      setAlertMsg({ type: 'error', text: 'Please select a recipient client contact.' });
      return;
    }

    setAlertMsg(null);
    startTransition(async () => {
      const res = await sendSubmissionAction(
        submissionDetail.id,
        recipientContactId,
        emailSubject,
        coverNote
      );

      if (res.success) {
        setAlertMsg({
          type: 'success',
          text: `Submission dispatched to ${res.recipientName} (${res.recipientEmail}). ${res.providerNotice}`,
        });
        onRefresh();
      } else {
        setAlertMsg({ type: 'error', text: res.error || 'Failed to dispatch submission.' });
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" aria-modal="true" role="dialog">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-[#E6E8F0]">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E6E8F0] bg-[#F6F7FB]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#EEEBFB] text-[#5B49D6] flex items-center justify-center font-bold text-sm">
              {submissionDetail.code}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#1B2236]">
                  {submissionDetail.candidate?.name}
                </h2>
                <span className="text-xs font-mono bg-white border border-[#E6E8F0] text-[#6B7490] px-2 py-0.5 rounded">
                  {profile?.versionTag || `v${submissionDetail.version}`}
                </span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                    submissionDetail.approvalStatus === 'APPROVED'
                      ? 'bg-[#E3F6EC] text-[#12B76A]'
                      : submissionDetail.approvalStatus === 'PENDING_MANAGER_APPROVAL'
                      ? 'bg-amber-100 text-amber-800'
                      : submissionDetail.approvalStatus === 'CHANGES_REQUESTED'
                      ? 'bg-orange-100 text-orange-800'
                      : submissionDetail.approvalStatus === 'REJECTED'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {submissionDetail.approvalStatus.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-xs text-[#6B7490] mt-0.5 flex items-center gap-1">
                <span>{submissionDetail.job?.title}</span>
                <span>·</span>
                <Building2 className="w-3 h-3 text-[#5B49D6]" />
                <span className="font-semibold text-[#1B2236]">{submissionDetail.job?.client?.name}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[#6B7490] hover:text-[#1B2236] p-1.5 rounded-lg hover:bg-gray-200/60 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs (Figma Frame 29 style) */}
        <div className="flex items-center border-b border-[#E6E8F0] px-6 bg-white gap-6 text-xs font-bold">
          <button
            onClick={() => { setActiveTab('preview'); setAlertMsg(null); }}
            className={`py-3.5 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'preview'
                ? 'border-[#5B49D6] text-[#5B49D6]'
                : 'border-transparent text-[#6B7490] hover:text-[#1B2236]'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Profile Preview (Frame 29)</span>
          </button>

          <button
            onClick={() => { setActiveTab('edit'); setAlertMsg(null); }}
            className={`py-3.5 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'edit'
                ? 'border-[#5B49D6] text-[#5B49D6]'
                : 'border-transparent text-[#6B7490] hover:text-[#1B2236]'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            <span>Edit Profile Content</span>
          </button>

          <button
            onClick={() => { setActiveTab('versions'); setAlertMsg(null); }}
            className={`py-3.5 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'versions'
                ? 'border-[#5B49D6] text-[#5B49D6]'
                : 'border-transparent text-[#6B7490] hover:text-[#1B2236]'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Versions & Approvals ({submissionDetail.versions?.length || 1})</span>
          </button>

          <button
            onClick={() => { setActiveTab('cv'); setAlertMsg(null); }}
            className={`py-3.5 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'cv'
                ? 'border-[#5B49D6] text-[#5B49D6]'
                : 'border-transparent text-[#6B7490] hover:text-[#1B2236]'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Watermarked CV Preview</span>
          </button>

          <button
            onClick={() => { setActiveTab('send'); setAlertMsg(null); }}
            className={`py-3.5 border-b-2 flex items-center gap-1.5 transition ml-auto ${
              activeTab === 'send'
                ? 'border-[#5B49D6] text-[#5B49D6]'
                : 'border-transparent text-[#6B7490] hover:text-[#1B2236]'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Send to Client</span>
          </button>
        </div>

        {/* Alert Banner */}
        {alertMsg && (
          <div
            className={`px-6 py-2.5 text-xs flex items-center gap-2 ${
              alertMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
                : 'bg-red-50 text-red-800 border-b border-red-200'
            }`}
          >
            {alertMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
            )}
            <span>{alertMsg.text}</span>
          </div>
        )}

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-white">
          {/* TAB 1: PREVIEW (Figma Frame 29 Standard Profile) */}
          {activeTab === 'preview' && (
            <div className="space-y-6">
              {/* Anti-leak reassurance banner */}
              <div className="bg-[#EEEBFB]/50 border border-[#EEEBFB] rounded-xl p-3 flex items-center justify-between text-xs text-[#5B49D6]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                  <span>
                    <strong>Anti-Leak Guarantee:</strong> Internal recruiter notes, salaries, and commercial fees are strictly excluded.
                  </span>
                </div>
                <a
                  href={`/api/submissions/${submissionDetail.id}/profile/preview`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 font-bold underline hover:text-[#4D3DC2]"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Full HTML Preview
                </a>
              </div>

              {/* Standard Profile Document Container */}
              <div className="border border-[#E6E8F0] rounded-xl p-8 bg-white shadow-xs space-y-6">
                {/* Header */}
                <div className="border-b-2 border-[#5B49D6] pb-5 flex items-start justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-[#1E2A4A]">{profile?.candidateName}</h1>
                    <h2 className="text-sm font-semibold text-[#5B49D6] mt-1">{profile?.headline}</h2>
                    <p className="text-xs text-[#6B7490] mt-1">
                      Candidate Code: {profile?.candidateCode} · Location: {profile?.location || 'India'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-bold bg-[#EEEBFB] text-[#5B49D6] px-3 py-1 rounded-md">
                      CONFIDENTIAL
                    </span>
                    <p className="text-[11px] text-[#6B7490] mt-1">
                      Prepared for {profile?.clientName}
                    </p>
                    <p className="text-[10px] text-[#6B7490]/70 font-mono">
                      Ref: {profile?.versionTag}
                    </p>
                  </div>
                </div>

                {/* Professional Summary */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7490] border-b border-[#E6E8F0] pb-1.5 mb-2.5">
                    Professional Summary
                  </h3>
                  <p className="text-sm leading-relaxed text-[#1B2236]">
                    {profile?.professionalSummary || 'Specialized technology professional.'}
                  </p>
                </div>

                {/* Core Competencies */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7490] border-b border-[#E6E8F0] pb-1.5 mb-2.5">
                    Core Competencies & Skills
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {profile?.coreSkills?.map((skill: string) => (
                      <span
                        key={skill}
                        className="bg-[#F6F7FB] border border-[#E6E8F0] text-[#1E2A4A] text-xs font-semibold px-2.5 py-1 rounded-md"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Experience Highlights */}
                {profile?.experienceHighlights?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7490] border-b border-[#E6E8F0] pb-1.5 mb-2.5 flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-[#5B49D6]" />
                      <span>Experience Highlights</span>
                    </h3>
                    <div className="space-y-3">
                      {profile.experienceHighlights.map((exp: any, i: number) => (
                        <div key={i} className="text-xs">
                          <div className="flex items-center justify-between font-bold text-[#1B2236]">
                            <span>{exp.title}</span>
                            <span className="text-[#6B7490] font-normal">{exp.duration}</span>
                          </div>
                          <div className="text-[#5B49D6] font-semibold">{exp.company}</div>
                          {exp.description && (
                            <p className="text-[#6B7490] mt-1 leading-normal">{exp.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Portfolio URL */}
                {profile?.portfolioUrl && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7490] border-b border-[#E6E8F0] pb-1.5 mb-2">
                      Portfolio & Work Samples
                    </h3>
                    <a
                      href={profile.portfolioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#5B49D6] hover:underline flex items-center gap-1 font-semibold"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>{profile.portfolioUrl}</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: EDIT PROFILE CONTENT (Creates New Version) */}
          {activeTab === 'edit' && (
            <form onSubmit={handleSaveNewVersion} className="space-y-5">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                <strong>Versioning Rule:</strong> Saving changes will create a new immutable version (
                {submissionDetail.code}-v{submissionDetail.version + 1}) and invalidate any prior manager approvals.
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1B2236] mb-1">Professional Headline</label>
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  className="w-full text-xs border border-[#E6E8F0] rounded-lg px-3 py-2 text-[#1B2236] focus:ring-2 focus:ring-[#5B49D6] focus:outline-none"
                  placeholder="e.g. Staff Distributed Systems Architect"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1B2236] mb-1">Professional Summary</label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={4}
                  className="w-full text-xs border border-[#E6E8F0] rounded-lg px-3 py-2 text-[#1B2236] focus:ring-2 focus:ring-[#5B49D6] focus:outline-none resize-none"
                  placeholder="Tailor the candidate profile to the client's technology mandate..."
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1B2236] mb-1">Selected Core Skills</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSkill(); } }}
                    className="flex-1 text-xs border border-[#E6E8F0] rounded-lg px-3 py-1.5 text-[#1B2236] focus:outline-none"
                    placeholder="Add a key skill (press Enter)..."
                  />
                  <button
                    type="button"
                    onClick={handleAddSkill}
                    className="px-3 py-1.5 bg-[#5B49D6] text-white text-xs font-bold rounded-lg hover:bg-[#4D3DC2]"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((s) => (
                    <span
                      key={s}
                      className="bg-[#EEEBFB] text-[#5B49D6] text-xs font-bold px-2.5 py-1 rounded-md flex items-center gap-1.5"
                    >
                      {s}
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(s)}
                        className="text-[#5B49D6] hover:text-red-500"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1B2236] mb-1">Portfolio or Code URL</label>
                <input
                  type="url"
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  className="w-full text-xs border border-[#E6E8F0] rounded-lg px-3 py-2 text-[#1B2236] focus:outline-none"
                  placeholder="https://github.com/..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1B2236] mb-1">
                  Change Summary <span className="text-red-500">* (Mandatory for audit trail)</span>
                </label>
                <input
                  type="text"
                  value={changeSummary}
                  onChange={(e) => setChangeSummary(e.target.value)}
                  className="w-full text-xs border border-[#E6E8F0] rounded-lg px-3 py-2 text-[#1B2236] focus:ring-2 focus:ring-[#5B49D6] focus:outline-none"
                  placeholder="e.g. Updated summary to emphasize micro-frontend architecture for Acme..."
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#E6E8F0]">
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className="px-4 py-2 border border-[#E6E8F0] text-[#1B2236] rounded-lg text-xs font-bold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !changeSummary.trim()}
                  className="px-4 py-2 bg-[#5B49D6] hover:bg-[#4D3DC2] text-white rounded-lg text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save New Version ({submissionDetail.code}-v{submissionDetail.version + 1})</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: VERSIONS & APPROVALS */}
          {activeTab === 'versions' && (
            <div className="space-y-6">
              {/* Approval status banner */}
              <div className="p-4 rounded-xl border border-[#E6E8F0] bg-[#F6F7FB] flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-[#1B2236]">Current Approval Status</div>
                  <div className="text-sm font-bold text-[#5B49D6] mt-0.5">
                    {submissionDetail.approvalStatus.replace(/_/g, ' ')}
                  </div>
                  {submissionDetail.latestApproval?.comments && (
                    <p className="text-xs text-[#6B7490] mt-1">
                      Latest note: &ldquo;{submissionDetail.latestApproval.comments}&rdquo;
                    </p>
                  )}
                </div>

                {submissionDetail.approvalStatus !== 'APPROVED' && (
                  <button
                    onClick={handleRequestApproval}
                    disabled={isPending || submissionDetail.approvalStatus === 'PENDING_MANAGER_APPROVAL'}
                    className="px-3.5 py-1.5 bg-[#5B49D6] text-white rounded-lg text-xs font-bold hover:bg-[#4D3DC2] disabled:opacity-50"
                  >
                    Request Manager Sign-off
                  </button>
                )}
              </div>

              {/* Manager Review Box (Managers and Admins only) */}
              {isManagerOrAdmin && (
                <form onSubmit={handleReviewApproval} className="border border-[#E6E8F0] rounded-xl p-4 bg-white space-y-3">
                  <div className="text-xs font-bold text-[#1B2236] flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#5B49D6]" />
                    <span>Manager Sign-Off Decision</span>
                  </div>

                  <div className="flex gap-4 text-xs font-semibold">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="decision"
                        checked={reviewDecision === 'APPROVED'}
                        onChange={() => setReviewDecision('APPROVED')}
                      />
                      <span className="text-[#12B76A]">Approve Submission</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="decision"
                        checked={reviewDecision === 'CHANGES_REQUESTED'}
                        onChange={() => setReviewDecision('CHANGES_REQUESTED')}
                      />
                      <span className="text-orange-600">Request Changes</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="decision"
                        checked={reviewDecision === 'REJECTED'}
                        onChange={() => setReviewDecision('REJECTED')}
                      />
                      <span className="text-red-600">Reject</span>
                    </label>
                  </div>

                  <input
                    type="text"
                    value={reviewComments}
                    onChange={(e) => setReviewComments(e.target.value)}
                    className="w-full text-xs border border-[#E6E8F0] rounded-lg px-3 py-2 text-[#1B2236] focus:outline-none"
                    placeholder="Enter review decision comments (mandatory)..."
                    required
                  />

                  <button
                    type="submit"
                    disabled={isPending || !reviewComments.trim()}
                    className="px-3.5 py-1.5 bg-[#12B76A] hover:bg-[#0E9355] text-white rounded-lg text-xs font-bold disabled:opacity-50"
                  >
                    Confirm Review Decision
                  </button>
                </form>
              )}

              {/* Version History Table */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7490] mb-3">
                  Immutable Version History
                </h3>
                <div className="border border-[#E6E8F0] rounded-xl overflow-hidden divide-y divide-[#E6E8F0]">
                  {submissionDetail.versions?.map((v: any) => (
                    <div key={v.versionNumber} className="p-3 text-xs flex items-center justify-between hover:bg-[#F6F7FB]">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#1B2236]">{v.versionTag}</span>
                          {v.isCurrent && (
                            <span className="bg-[#EEEBFB] text-[#5B49D6] px-2 py-0.5 rounded text-[10px] font-bold">
                              CURRENT
                            </span>
                          )}
                        </div>
                        <p className="text-[#6B7490] mt-0.5">{v.changeSummary || 'Initial profile generation.'}</p>
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5 truncate max-w-md">
                          Hash: {v.contentHash}
                        </p>
                      </div>
                      <div className="text-right text-[#6B7490] text-[11px]">
                        <div>{new Date(v.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: WATERMARKED CV PREVIEW */}
          {activeTab === 'cv' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-[#5B49D6]/30 bg-[#EEEBFB]/20 rounded-xl p-8 text-center relative overflow-hidden min-h-[300px] flex flex-col items-center justify-center">
                {/* Diagonal Watermark Overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-15 select-none">
                  <div className="transform -rotate-45 text-4xl font-black text-[#5B49D6] tracking-widest text-center">
                    HIREFLOW / {submissionDetail.job?.client?.name?.toUpperCase()} / {new Date().toLocaleDateString('en-GB').toUpperCase()}
                  </div>
                </div>

                <ShieldCheck className="w-12 h-12 text-[#5B49D6] mb-3" />
                <h3 className="text-sm font-bold text-[#1B2236]">Candidate Resume Protected</h3>
                <p className="text-xs text-[#6B7490] max-w-md mt-1">
                  Server-side watermark is automatically stamped across all pages for presentation to{' '}
                  <strong>{submissionDetail.job?.client?.name}</strong>.
                </p>

                <div className="mt-4 font-mono text-xs bg-white border border-[#E6E8F0] px-3 py-1.5 rounded-lg text-[#1E2A4A]">
                  Watermark: HIREFLOW / {submissionDetail.job?.client?.name?.toUpperCase()} / {new Date().toLocaleDateString('en-GB').toUpperCase()}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SEND TO CLIENT */}
          {activeTab === 'send' && (
            <form onSubmit={handleSendSubmission} className="space-y-4">
              {/* Job Status Banner */}
              {!jobIsActive ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />
                  <div>
                    <strong>Sending Blocked:</strong> Job mandate &ldquo;{submissionDetail.job?.title}&rdquo; is in{' '}
                    <strong>{submissionDetail.job?.status}</strong> status. Submissions can strictly only be sent for{' '}
                    <strong>ACTIVE</strong> mandates.
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Job mandate is <strong>ACTIVE</strong>. Ready for presentation.</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#1B2236] mb-1">Target Client Contact</label>
                <select
                  value={recipientContactId}
                  onChange={(e) => setRecipientContactId(e.target.value)}
                  className="w-full text-xs border border-[#E6E8F0] rounded-lg px-3 py-2 text-[#1B2236] focus:outline-none"
                  required
                >
                  {submissionDetail.job?.client?.contacts?.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.email}) {c.designation ? `— ${c.designation}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1B2236] mb-1">Email Subject</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full text-xs border border-[#E6E8F0] rounded-lg px-3 py-2 text-[#1B2236] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1B2236] mb-1">Cover Note</label>
                <textarea
                  value={coverNote}
                  onChange={(e) => setCoverNote(e.target.value)}
                  rows={5}
                  className="w-full text-xs border border-[#E6E8F0] rounded-lg px-3 py-2 text-[#1B2236] focus:outline-none resize-none"
                  required
                />
              </div>

              <div className="flex justify-end pt-3 border-t border-[#E6E8F0]">
                <button
                  type="submit"
                  disabled={isPending || !jobIsActive || submissionDetail.approvalStatus !== 'APPROVED'}
                  className="px-5 py-2.5 bg-[#5B49D6] hover:bg-[#4D3DC2] text-white rounded-lg text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <Send className="w-3.5 h-3.5" />
                  <span>Present Standard Profile to Client</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
