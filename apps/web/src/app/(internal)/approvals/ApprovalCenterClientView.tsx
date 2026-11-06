'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Send,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Eye,
  Check,
  X,
  FileText,
  RotateCcw,
  ShieldAlert,
  ExternalLink,
  History,
} from 'lucide-react';
import {
  approveSubmissionAction,
  requestSubmissionChangesAction,
  rejectSubmissionAction,
  getSubmissionReviewDataAction,
  approveJobAction,
  requestJobChangesAction,
  rejectJobAction,
} from '@/actions/approvals';

interface ApprovalCenterProps {
  initialTab: string;
  initialData: any;
  historyData?: any;
  currentUser: {
    id: string;
    name: string;
    role: string;
  };
}

export function ApprovalCenterClientView({
  initialTab,
  initialData,
  historyData,
  currentUser,
}: ApprovalCenterProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(initialTab || 'submissions');
  const [, startTransition] = useTransition();

  // Review Drawer state
  const [activeReviewItem, setActiveReviewItem] = useState<any | null>(null);
  const [reviewData, setReviewData] = useState<any | null>(null);
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [reviewTab, setReviewTab] = useState<'rules' | 'profile' | 'cv'>('rules');

  // Decision Modal state (for comments)
  const [decisionModal, setDecisionModal] = useState<{
    isOpen: boolean;
    type: 'APPROVE_SUBMISSION' | 'REQUEST_SUBMISSION_CHANGES' | 'REJECT_SUBMISSION' | 'APPROVE_JOB' | 'REQUEST_JOB_CHANGES' | 'REJECT_JOB';
    targetId: string;
    title: string;
    comments: string;
    isSubmitting: boolean;
    error?: string;
  }>({
    isOpen: false,
    type: 'APPROVE_SUBMISSION',
    targetId: '',
    title: '',
    comments: '',
    isSubmitting: false,
  });

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setActiveReviewItem(null);
    setReviewData(null);
    router.push(`/approvals?tab=${tab}`);
  };

  const openReviewDrawer = async (item: any) => {
    setActiveReviewItem(item);
    if (item.type === 'SUBMISSION') {
      setIsLoadingReview(true);
      setReviewTab('rules');
      const res = await getSubmissionReviewDataAction(item.id);
      if (res.success) {
        setReviewData(res.data);
      }
      setIsLoadingReview(false);
    }
  };

  const closeReviewDrawer = () => {
    setActiveReviewItem(null);
    setReviewData(null);
  };

  const handleDecisionSubmit = async () => {
    const { type, targetId, comments } = decisionModal;
    setDecisionModal((prev) => ({ ...prev, isSubmitting: true, error: undefined }));

    let res: { success: boolean; error?: string } = { success: false };

    if (type === 'APPROVE_SUBMISSION') {
      res = await approveSubmissionAction(targetId, comments);
    } else if (type === 'REQUEST_SUBMISSION_CHANGES') {
      res = await requestSubmissionChangesAction(targetId, comments);
    } else if (type === 'REJECT_SUBMISSION') {
      res = await rejectSubmissionAction(targetId, comments);
    } else if (type === 'APPROVE_JOB') {
      res = await approveJobAction(targetId, comments);
    } else if (type === 'REQUEST_JOB_CHANGES') {
      res = await requestJobChangesAction(targetId, comments);
    } else if (type === 'REJECT_JOB') {
      res = await rejectJobAction(targetId, comments);
    }

    if (res.success) {
      setDecisionModal({ isOpen: false, type: 'APPROVE_SUBMISSION', targetId: '', title: '', comments: '', isSubmitting: false });
      closeReviewDrawer();
      startTransition(() => {
        router.refresh();
      });
    } else {
      setDecisionModal((prev) => ({
        ...prev,
        isSubmitting: false,
        error: res.error || 'Operation failed. Please try again.',
      }));
    }
  };

  const items = initialData?.items || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E6E8F0] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold tracking-wider text-[#5B49D6] uppercase bg-[#EEEBFB] px-2.5 py-0.5 rounded-full">
              Centralized Governance
            </span>
            <span className="text-xs text-[#6B7490]">Phase 2 Approval Engine</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1B2236] mt-1">
            Approval Center
          </h1>
          <p className="text-xs text-[#6B7490] mt-0.5">
            Review and sign off on candidate client submissions and job requisitions prior to external release.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#6B7490] hidden md:inline">
            Reviewer: <strong className="text-[#1B2236]">{currentUser.name}</strong> ({currentUser.role})
          </span>
          <Link
            href="/manager"
            className="px-3.5 py-2 border border-[#E6E8F0] bg-white hover:bg-[#F8F9FC] text-[#1B2236] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <span>&larr; Manager Dashboard</span>
          </Link>
        </div>
      </div>

      {/* Tabs Bar (Figma Frame 28) */}
      <div className="flex border-b border-[#E6E8F0] gap-8">
        <button
          onClick={() => handleTabChange('submissions')}
          className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-2 cursor-pointer ${
            activeTab === 'submissions' ? 'text-[#5B49D6]' : 'text-[#6B7490] hover:text-[#1B2236]'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>Submissions Queue</span>
          {activeTab === 'submissions' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5B49D6] rounded-t-full" />
          )}
        </button>

        <button
          onClick={() => handleTabChange('jobs')}
          className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-2 cursor-pointer ${
            activeTab === 'jobs' ? 'text-[#5B49D6]' : 'text-[#6B7490] hover:text-[#1B2236]'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>New Jobs Sign-off</span>
          {activeTab === 'jobs' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5B49D6] rounded-t-full" />
          )}
        </button>

        <button
          onClick={() => handleTabChange('changes_requested')}
          className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-2 cursor-pointer ${
            activeTab === 'changes_requested' ? 'text-[#5B49D6]' : 'text-[#6B7490] hover:text-[#1B2236]'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Changes Requested</span>
          {activeTab === 'changes_requested' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5B49D6] rounded-t-full" />
          )}
        </button>

        <button
          onClick={() => handleTabChange('history')}
          className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-2 cursor-pointer ${
            activeTab === 'history' ? 'text-[#5B49D6]' : 'text-[#6B7490] hover:text-[#1B2236]'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Decision History</span>
          {activeTab === 'history' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5B49D6] rounded-t-full" />
          )}
        </button>
      </div>

      {/* Main Content Area */}
      {activeTab === 'history' ? (
        <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#E6E8F0] flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#1B2236]">Immutable Decision Audit Trail</h2>
            <span className="text-xs text-[#6B7490]">{historyData?.items?.length || 0} historical entries</span>
          </div>

          {!historyData?.items || historyData.items.length === 0 ? (
            <div className="p-10 text-center text-xs text-[#6B7490]">No past decision history recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F9FC] text-[#6B7490] font-semibold border-b border-[#E6E8F0]">
                  <tr>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Record & Target</th>
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Decision</th>
                    <th className="py-3 px-4">Reviewer</th>
                    <th className="py-3 px-4">Comments</th>
                    <th className="py-3 px-4">Decided At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E8F0]">
                  {historyData.items.map((hist: any) => (
                    <tr key={hist.id} className="hover:bg-[#F8F9FC]/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EEEBFB] text-[#5B49D6]">
                          {hist.type === 'SUBMISSION_APPROVAL' ? 'Submission' : 'Job Mandate'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#1B2236]">
                        <div>{hist.targetTitle}</div>
                        <div className="text-[10px] font-mono text-[#6B7490]">{hist.targetCode}</div>
                      </td>
                      <td className="py-3.5 px-4 text-[#1B2236]">{hist.clientName}</td>
                      <td className="py-3.5 px-4">
                        {hist.decision === 'APPROVED' ? (
                          <span className="inline-flex items-center gap-1 text-[#12B76A] font-bold text-[11px]">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>APPROVED</span>
                          </span>
                        ) : hist.decision === 'CHANGES_REQUESTED' ? (
                          <span className="inline-flex items-center gap-1 text-[#F59E0B] font-bold text-[11px]">
                            <RotateCcw className="w-3 h-3" />
                            <span>CHANGES</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[#E5484D] font-bold text-[11px]">
                            <XCircle className="w-3 h-3" />
                            <span>REJECTED</span>
                          </span>
                        )}
                        {hist.isInvalidated && (
                          <div className="text-[10px] text-[#E5484D] font-medium mt-0.5">
                            Invalidated: Profile edited
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-[#1B2236]">{hist.reviewerName}</td>
                      <td className="py-3.5 px-4 text-[#6B7490] max-w-xs truncate">{hist.comments || '—'}</td>
                      <td className="py-3.5 px-4 text-[#6B7490]">
                        {new Date(hist.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs overflow-hidden">
          {/* Action header with count */}
          <div className="p-4 border-b border-[#E6E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-bold text-[#1B2236]">
                {activeTab === 'submissions'
                  ? 'Submissions Awaiting Manager Sign-Off'
                  : activeTab === 'jobs'
                  ? 'Job Requisitions Awaiting Activation'
                  : 'Pending Recruiter Modifications'}
              </h2>
              <p className="text-[11px] text-[#6B7490] mt-0.5">
                {items.length} items in current queue
              </p>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 className="w-10 h-10 text-[#12B76A] mx-auto mb-2 opacity-80" />
              <h3 className="text-sm font-bold text-[#1B2236]">Queue is clear</h3>
              <p className="text-xs text-[#6B7490] mt-1 max-w-sm mx-auto">
                No items pending review in this section.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F9FC] text-[#6B7490] font-semibold border-b border-[#E6E8F0]">
                  <tr>
                    <th className="py-3 px-4">Ref Code</th>
                    <th className="py-3 px-4">{activeTab === 'jobs' ? 'Job Mandate' : 'Candidate & Role'}</th>
                    <th className="py-3 px-4">Client Company</th>
                    <th className="py-3 px-4">{activeTab === 'jobs' ? 'Owner' : 'Submitted By'}</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E8F0]">
                  {items.map((item: any) => (
                    <tr key={item.id} className="hover:bg-[#F8F9FC]/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-[#5B49D6]">
                        {item.code}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#1B2236]">
                        {activeTab === 'jobs' ? (
                          <div>
                            <div>{item.title}</div>
                            <div className="text-[10px] text-[#6B7490] font-normal">
                              {item.openings} opening(s) · {item.employmentType}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div>{item.candidateName}</div>
                            <div className="text-[10px] text-[#6B7490] font-normal">
                              &rarr; {item.jobTitle}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-[#1B2236]">{item.clientName}</td>
                      <td className="py-3.5 px-4 text-[#6B7490]">
                        {activeTab === 'jobs' ? item.ownerName : item.submittedBy}
                        {item.isSelfSubmission && (
                          <span className="block text-[10px] font-bold text-[#F59E0B]">
                            Your submission
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-[#6B7490]">
                        {new Date(item.submittedAt || item.createdAt || item.requestedAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {activeTab === 'jobs' ? (
                          <div className="inline-flex items-center gap-1.5">
                            {item.isSelfSubmission ? (
                              <span className="text-[11px] text-[#6B7490] italic">
                                Self-approval blocked
                              </span>
                            ) : (
                              <>
                                <button
                                  onClick={() =>
                                    setDecisionModal({
                                      isOpen: true,
                                      type: 'APPROVE_JOB',
                                      targetId: item.id,
                                      title: `Approve Job Mandate: ${item.title} (${item.code})`,
                                      comments: '',
                                      isSubmitting: false,
                                    })
                                  }
                                  className="px-2.5 py-1.5 bg-[#12B76A] hover:bg-[#12B76A]/90 text-white rounded text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Approve</span>
                                </button>
                                <button
                                  onClick={() =>
                                    setDecisionModal({
                                      isOpen: true,
                                      type: 'REQUEST_JOB_CHANGES',
                                      targetId: item.id,
                                      title: `Request Changes on Job: ${item.title} (${item.code})`,
                                      comments: '',
                                      isSubmitting: false,
                                    })
                                  }
                                  className="px-2.5 py-1.5 border border-[#E6E8F0] hover:bg-[#F8F9FC] text-[#F59E0B] rounded text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Changes</span>
                                </button>
                              </>
                            )}
                          </div>
                        ) : activeTab === 'changes_requested' ? (
                          <div className="text-xs text-[#6B7490] max-w-xs truncate text-right">
                            {item.comments}
                          </div>
                        ) : (
                          <button
                            onClick={() => openReviewDrawer(item)}
                            className="px-3 py-1.5 bg-[#5B49D6] hover:bg-[#5B49D6]/90 text-white rounded text-xs font-semibold inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Review Submission</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Submission Review Drawer / Modal */}
      {activeReviewItem && activeReviewItem.type === 'SUBMISSION' && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-xs transition-opacity">
          <div className="w-full max-w-2xl h-full bg-white shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-[#E6E8F0] flex items-center justify-between bg-[#F8F9FC]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EEEBFB] text-[#5B49D6]">
                    Submission Review
                  </span>
                  <span className="text-xs font-mono font-bold text-[#1B2236]">
                    {activeReviewItem.code}
                  </span>
                </div>
                <h2 className="text-base font-bold text-[#1B2236] mt-1">
                  {activeReviewItem.candidateName} &rarr; {activeReviewItem.jobTitle}
                </h2>
                <div className="text-xs text-[#6B7490] flex items-center gap-3 mt-0.5">
                  <span>Client: <strong className="text-[#1B2236]">{activeReviewItem.clientName}</strong></span>
                  <span>Submitted by: <strong className="text-[#1B2236]">{activeReviewItem.submittedBy}</strong></span>
                </div>
              </div>
              <button
                onClick={closeReviewDrawer}
                className="w-8 h-8 rounded-lg border border-[#E6E8F0] bg-white text-[#6B7490] hover:text-[#1B2236] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sub-tabs in Drawer */}
            <div className="flex border-b border-[#E6E8F0] px-5 bg-white gap-6">
              <button
                onClick={() => setReviewTab('rules')}
                className={`py-3 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
                  reviewTab === 'rules'
                    ? 'border-[#5B49D6] text-[#5B49D6]'
                    : 'border-transparent text-[#6B7490] hover:text-[#1B2236]'
                }`}
              >
                Client Rules Evaluation
              </button>
              <button
                onClick={() => setReviewTab('profile')}
                className={`py-3 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
                  reviewTab === 'profile'
                    ? 'border-[#5B49D6] text-[#5B49D6]'
                    : 'border-transparent text-[#6B7490] hover:text-[#1B2236]'
                }`}
              >
                Standard Profile Preview (Frame 29)
              </button>
              <button
                onClick={() => setReviewTab('cv')}
                className={`py-3 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
                  reviewTab === 'cv'
                    ? 'border-[#5B49D6] text-[#5B49D6]'
                    : 'border-transparent text-[#6B7490] hover:text-[#1B2236]'
                }`}
              >
                CV File & Documents
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#FAFAFC]">
              {isLoadingReview ? (
                <div className="p-12 text-center text-xs text-[#6B7490]">
                  Loading review metrics & client rule evaluation...
                </div>
              ) : !reviewData ? (
                <div className="p-8 text-center text-xs text-[#E5484D]">
                  Failed to load review data.
                </div>
              ) : (
                <>
                  {/* TAB 1: RULES EVALUATION */}
                  {reviewTab === 'rules' && (
                    <div className="space-y-4">
                      {/* Overall Compliance Banner */}
                      <div
                        className={`p-4 rounded-xl border flex items-start gap-3 ${
                          reviewData.ruleValidation?.allPassed || reviewData.ruleValidation?.isValid
                            ? 'bg-[#E6F4EA] border-[#12B76A]/30 text-[#12B76A]'
                            : 'bg-[#FEF3DC] border-[#F59E0B]/30 text-[#F59E0B]'
                        }`}
                      >
                        {reviewData.ruleValidation?.allPassed || reviewData.ruleValidation?.isValid ? (
                          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="font-bold text-xs">
                            {reviewData.ruleValidation?.allPassed || reviewData.ruleValidation?.isValid
                              ? '100% Client Rule Compliance Verified'
                              : 'Client Submission Rule Violations Detected'}
                          </div>
                          <div className="text-[11px] text-[#6B7490] mt-0.5">
                            {reviewData.ruleValidation?.allPassed || reviewData.ruleValidation?.isValid
                              ? `All required fields, representation consent, and profile attachments satisfy ${reviewData.job.clientName}'s active workflow policy (v${reviewData.workflow?.version || 1}).`
                              : `This submission does not satisfy ${reviewData.job.clientName}'s submission requirements. Review the failing checks below before deciding.`}
                          </div>
                        </div>
                      </div>

                      {/* Rule Checks Table */}
                      <div className="bg-white rounded-xl border border-[#E6E8F0] overflow-hidden shadow-xs">
                        <div className="p-3.5 bg-[#F8F9FC] border-b border-[#E6E8F0] font-bold text-xs text-[#1B2236]">
                          Active Submission Requirements & Rule Breakdown
                        </div>
                        <div className="divide-y divide-[#E6E8F0]">
                          {reviewData.ruleValidation?.checks?.map((check: any, idx: number) => (
                            <div key={idx} className="p-3.5 flex items-start justify-between gap-4">
                              <div>
                                <div className="font-bold text-xs text-[#1B2236] flex items-center gap-2">
                                  <span>{check.label}</span>
                                  {check.required ? (
                                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[#FEF3DC] text-[#F59E0B]">
                                      Mandatory
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-[#F1F3F9] text-[#6B7490]">
                                      Optional
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-[#6B7490] mt-0.5">{check.explanation}</div>
                                {check.fixAction && !check.passed && (
                                  <div className="text-[11px] text-[#E5484D] font-medium mt-1">
                                    Action: {check.fixAction}
                                  </div>
                                )}
                              </div>
                              <div className="shrink-0">
                                {check.passed ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#12B76A] bg-[#E6F4EA] px-2.5 py-1 rounded-full">
                                    <Check className="w-3 h-3" />
                                    <span>PASS</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#E5484D] bg-[#FDECEC] px-2.5 py-1 rounded-full">
                                    <X className="w-3 h-3" />
                                    <span>FAIL</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: STANDARD CANDIDATE PROFILE PREVIEW */}
                  {reviewTab === 'profile' && (
                    <div className="space-y-4">
                      <div className="bg-[#EEEBFB] p-3 rounded-lg border border-[#5B49D6]/20 text-[11px] text-[#5B49D6]">
                        🔒 <strong>Zero Data Leakage Protected:</strong> Commercial margins, internal candidate notes, and billing fees are stripped prior to presentation.
                      </div>

                      {reviewData.profilePreview ? (
                        <div className="bg-white rounded-xl border border-[#E6E8F0] p-6 shadow-xs space-y-5">
                          <div className="border-b-2 border-[#5B49D6] pb-4 flex justify-between items-start">
                            <div>
                              <h3 className="text-xl font-bold text-[#1B2236]">
                                {reviewData.profilePreview.candidateName}
                              </h3>
                              <div className="text-xs font-semibold text-[#5B49D6] mt-0.5">
                                {reviewData.profilePreview.headline}
                              </div>
                              <div className="text-[11px] text-[#6B7490] mt-1">
                                Code: {reviewData.profilePreview.candidateCode} · Location: {reviewData.profilePreview.location || 'Bengaluru, India'}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] font-bold px-2 py-1 rounded bg-[#EEEBFB] text-[#5B49D6]">
                                CONFIDENTIAL PROFILE
                              </span>
                              <div className="text-[10px] text-[#6B7490] mt-1">
                                Ref: {reviewData.profilePreview.versionTag}
                              </div>
                            </div>
                          </div>

                          <div>
                            <div className="text-[10px] font-bold tracking-wider uppercase text-[#6B7490]">
                              Professional Summary
                            </div>
                            <p className="text-xs text-[#333F51] mt-1.5 leading-relaxed">
                              {reviewData.profilePreview.professionalSummary || 'No summary provided.'}
                            </p>
                          </div>

                          <div>
                            <div className="text-[10px] font-bold tracking-wider uppercase text-[#6B7490]">
                              Core Competencies & Skills
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {reviewData.profilePreview.coreSkills?.map((skill: string, idx: number) => (
                                <span
                                  key={idx}
                                  className="text-xs font-medium px-2.5 py-1 rounded bg-[#F8F9FC] border border-[#E6E8F0] text-[#1B2236]"
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>

                          {reviewData.profilePreview.experienceHighlights?.length > 0 && (
                            <div>
                              <div className="text-[10px] font-bold tracking-wider uppercase text-[#6B7490]">
                                Selected Experience
                              </div>
                              <div className="space-y-3 mt-2">
                                {reviewData.profilePreview.experienceHighlights.map((exp: any, idx: number) => (
                                  <div key={idx} className="text-xs">
                                    <div className="font-bold text-[#1B2236] flex justify-between">
                                      <span>{exp.title}</span>
                                      <span className="text-[#6B7490] font-normal">{exp.duration}</span>
                                    </div>
                                    <div className="text-[#5B49D6]">{exp.company}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-8 text-center text-xs text-[#6B7490]">
                          No profile preview snapshot found.
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: CV DOCUMENTS */}
                  {reviewTab === 'cv' && (
                    <div className="space-y-4">
                      {reviewData.cvDocument ? (
                        <div className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#EEEBFB] text-[#5B49D6] flex items-center justify-center font-bold">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="font-bold text-xs text-[#1B2236]">{reviewData.cvDocument.fileName}</div>
                              <div className="text-[11px] text-[#6B7490]">
                                Uploaded {new Date(reviewData.cvDocument.uploadedAt).toLocaleDateString('en-IN')}
                              </div>
                            </div>
                          </div>
                          {reviewData.cvDocument.fileUrl && (
                            <a
                              href={reviewData.cvDocument.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 border border-[#E6E8F0] hover:bg-[#F8F9FC] text-[#1B2236] rounded text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <span>View Original Document</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      ) : (
                        <div className="p-8 text-center text-xs text-[#E5484D] bg-[#FDECEC] rounded-xl border border-[#E5484D]/20">
                          No candidate resume file attached. Client submission rules require an original CV document.
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-[#E6E8F0] bg-white space-y-3">
              {reviewData?.isSelfSubmission ? (
                <div className="p-3 bg-[#FEF3DC] border border-[#F59E0B]/30 rounded-lg flex items-center gap-2 text-xs text-[#F59E0B]">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>
                    <strong>Self-approval prohibited:</strong> You created or own this submission. Under Aureva Capital governance, an independent manager or administrator must sign off.
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setDecisionModal({
                          isOpen: true,
                          type: 'REQUEST_SUBMISSION_CHANGES',
                          targetId: activeReviewItem.id,
                          title: `Request Changes: ${activeReviewItem.candidateName}`,
                          comments: '',
                          isSubmitting: false,
                        })
                      }
                      className="px-3.5 py-2 border border-[#E6E8F0] hover:bg-[#F8F9FC] text-[#F59E0B] rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Request Changes</span>
                    </button>
                    <button
                      onClick={() =>
                        setDecisionModal({
                          isOpen: true,
                          type: 'REJECT_SUBMISSION',
                          targetId: activeReviewItem.id,
                          title: `Reject Submission: ${activeReviewItem.candidateName}`,
                          comments: '',
                          isSubmitting: false,
                        })
                      }
                      className="px-3.5 py-2 border border-[#E6E8F0] hover:bg-[#FDECEC] text-[#E5484D] rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>

                  <button
                    onClick={() =>
                      setDecisionModal({
                        isOpen: true,
                        type: 'APPROVE_SUBMISSION',
                        targetId: activeReviewItem.id,
                        title: `Approve Submission: ${activeReviewItem.candidateName}`,
                        comments: 'Approved for client presentation.',
                        isSubmitting: false,
                      })
                    }
                    disabled={!reviewData?.ruleValidation?.isValid && !reviewData?.ruleValidation?.allPassed}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer ${
                      reviewData?.ruleValidation?.isValid || reviewData?.ruleValidation?.allPassed
                        ? 'bg-[#12B76A] hover:bg-[#12B76A]/90 text-white'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve & Authorize Send</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Decision Modal (Comments & Confirmation) */}
      {decisionModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl border border-[#E6E8F0] p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div>
              <h3 className="text-base font-bold text-[#1B2236]">{decisionModal.title}</h3>
              <p className="text-xs text-[#6B7490] mt-1">
                Provide notes or instructions for the recruiter and audit trail.
              </p>
            </div>

            {decisionModal.error && (
              <div className="p-3 bg-[#FDECEC] border border-[#E5484D]/30 text-[#E5484D] rounded-lg text-xs">
                {decisionModal.error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                Decision Notes / Guidance {decisionModal.type.includes('CHANGES') || decisionModal.type.includes('REJECT') ? '*' : ''}
              </label>
              <textarea
                rows={3}
                value={decisionModal.comments}
                onChange={(e) => setDecisionModal((prev) => ({ ...prev, comments: e.target.value }))}
                placeholder="Enter instructions, rationale, or sign-off feedback..."
                className="w-full text-xs p-3 border border-[#E6E8F0] rounded-lg focus:outline-none focus:border-[#5B49D6]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDecisionModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-3.5 py-2 border border-[#E6E8F0] text-[#6B7490] rounded-lg text-xs font-semibold hover:bg-[#F8F9FC] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDecisionSubmit}
                disabled={decisionModal.isSubmitting}
                className={`px-4 py-2 rounded-lg text-xs font-semibold text-white cursor-pointer ${
                  decisionModal.type.includes('APPROVE')
                    ? 'bg-[#12B76A] hover:bg-[#12B76A]/90'
                    : decisionModal.type.includes('CHANGES')
                    ? 'bg-[#F59E0B] hover:bg-[#F59E0B]/90'
                    : 'bg-[#E5484D] hover:bg-[#E5484D]/90'
                }`}
              >
                {decisionModal.isSubmitting ? 'Recording Decision...' : 'Confirm Decision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
