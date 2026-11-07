'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { PageHeader } from '../../../components/layout/PageHeader';
import {
  Users,
  Briefcase,
  CheckSquare,
  Clock,
  ArrowRight,
  Plus,
  X,
  AlertCircle,
  CheckCircle2,
  XCircle,
  History,
  ShieldCheck,
  ChevronRight,
  Filter,
  Search,
  ArrowRightLeft,
} from 'lucide-react';
import {
  getHandoverRequestsAction,
  createHandoverRequestAction,
  approveHandoverRequestAction,
  rejectHandoverRequestAction,
  cancelHandoverRequestAction,
  getRecruiterResourcesAction,
  getActiveRecruitersAction,
} from '../../../actions/handover';
import { useDevUser } from '../../../context/DevUserContext';
import { UserRole } from '@hireflow/shared';

export default function HandoverDashboardPage() {
  const { currentRole, currentUser } = useDevUser();
  const isManager = currentRole === UserRole.ADMIN || currentRole === UserRole.MANAGER;

  const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED' | 'ALL'>('PENDING');
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Wizard Modal State
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [recruiters, setRecruiters] = useState<any[]>([]);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);

  // Form State
  const [fromUserId, setFromUserId] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  // Resources of selected source recruiter
  const [resources, setResources] = useState<{
    candidates: any[];
    jobs: any[];
    tasks: any[];
  }>({ candidates: [], jobs: [], tasks: [] });
  const [loadingResources, setLoadingResources] = useState(false);

  // Selected IDs
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [resourceTab, setResourceTab] = useState<'CANDIDATES' | 'JOBS' | 'TASKS'>('CANDIDATES');

  const [wizardError, setWizardError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await getHandoverRequestsAction({
        status: activeTab !== 'ALL' ? activeTab : undefined,
      });
      setRequests(data);
    } catch (err: any) {
      console.error('Failed to load handover requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [activeTab]);

  const openNewHandoverWizard = async () => {
    setIsWizardOpen(true);
    setWizardStep(1);
    setWizardError(null);
    setReason('');
    setNotes('');
    setSelectedCandidates([]);
    setSelectedJobs([]);
    setSelectedTasks([]);

    try {
      const recs = await getActiveRecruitersAction();
      setRecruiters(recs);

      // Default source to current user if recruiter
      if (currentUser?.id) {
        setFromUserId(currentUser.id);
        loadRecruiterResources(currentUser.id);
      } else if (recs.length > 0) {
        setFromUserId(recs[0].id);
        loadRecruiterResources(recs[0].id);
      }
    } catch (err: any) {
      setWizardError(err.message || 'Failed to load recruiters');
    }
  };

  const loadRecruiterResources = async (recId: string) => {
    setLoadingResources(true);
    try {
      const res = await getRecruiterResourcesAction(recId);
      setResources(res);
      // Auto-select all by default for convenience
      setSelectedCandidates(res.candidates.map((c) => c.id));
      setSelectedJobs(res.jobs.map((j) => j.id));
      setSelectedTasks(res.tasks.map((t) => t.id));
    } catch (err: any) {
      setWizardError(err.message || 'Failed to load recruiter portfolio');
    } finally {
      setLoadingResources(false);
    }
  };

  const handleSourceChange = (newFromId: string) => {
    setFromUserId(newFromId);
    loadRecruiterResources(newFromId);
  };

  const toggleSelectCandidate = (id: string) => {
    setSelectedCandidates((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectJob = (id: string) => {
    setSelectedJobs((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectTask = (id: string) => {
    setSelectedTasks((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleWizardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromUserId || !toUserId) {
      setWizardError('Please select both source and destination recruiters.');
      return;
    }
    if (fromUserId === toUserId) {
      setWizardError('Source and destination recruiters cannot be the same person.');
      return;
    }
    if (
      selectedCandidates.length === 0 &&
      selectedJobs.length === 0 &&
      selectedTasks.length === 0
    ) {
      setWizardError('Please select at least one candidate, job, or task to transfer.');
      return;
    }
    if (!reason.trim()) {
      setWizardError('Please specify the reason for handover.');
      return;
    }

    setWizardError(null);
    startTransition(async () => {
      try {
        await createHandoverRequestAction({
          fromUserId,
          toUserId,
          candidateIds: selectedCandidates,
          jobIds: selectedJobs,
          taskIds: selectedTasks,
          reason: reason.trim(),
          notes: notes.trim() || undefined,
        });

        setIsWizardOpen(false);
        await loadRequests();
      } catch (err: any) {
        setWizardError(err.message || 'Failed to create handover request');
      }
    });
  };

  const handleApprove = async (id: string) => {
    if (!confirm('Are you sure you want to approve this handover? Work will be immediately transferred.')) {
      return;
    }
    startTransition(async () => {
      try {
        await approveHandoverRequestAction(id);
        await loadRequests();
      } catch (err: any) {
        alert(err.message || 'Failed to approve handover');
      }
    });
  };

  const handleReject = async (id: string) => {
    const rejectionReason = prompt('Enter reason for rejecting this handover request:');
    if (!rejectionReason) return;

    startTransition(async () => {
      try {
        await rejectHandoverRequestAction(id, rejectionReason);
        await loadRequests();
      } catch (err: any) {
        alert(err.message || 'Failed to reject handover');
      }
    });
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this request?')) return;
    startTransition(async () => {
      try {
        await cancelHandoverRequestAction(id);
        await loadRequests();
      } catch (err: any) {
        alert(err.message || 'Failed to cancel handover');
      }
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Approved & Transferred</span>;
      case 'REJECTED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">Rejected</span>;
      case 'CANCELLED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">Cancelled</span>;
      case 'PENDING':
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">Pending Approval</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Recruiter Portfolio Handover"
          subtitle="Figma Frame 41: Multi-entity handover wizard for candidates, active jobs, and open tasks."
        />

        <div className="flex items-center gap-3">
          <Link
            href="/handover/history"
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-all shadow-sm"
          >
            <History className="w-4 h-4 text-slate-500" /> Ownership History
          </Link>
          <button
            onClick={openNewHandoverWizard}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#5B49D6] text-white hover:bg-[#4338ca] shadow-sm flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" /> New Handover Request
          </button>
        </div>
      </div>

      {/* Tabs & Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-6 pt-4 flex space-x-6">
          <button
            onClick={() => setActiveTab('PENDING')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'PENDING'
                ? 'border-[#5B49D6] text-[#5B49D6]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Pending Review
          </button>
          <button
            onClick={() => setActiveTab('APPROVED')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'APPROVED'
                ? 'border-[#5B49D6] text-[#5B49D6]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Approved / Transferred
          </button>
          <button
            onClick={() => setActiveTab('ALL')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'ALL'
                ? 'border-[#5B49D6] text-[#5B49D6]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            All Requests
          </button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-slate-400">Loading handover requests...</div>
          ) : requests.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <ArrowRightLeft className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="font-medium text-slate-700">No handover requests found</p>
              <p className="text-xs text-slate-400 mt-1">
                Click "New Handover Request" to transfer candidates, jobs, and open tasks to another recruiter.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-3.5">From Recruiter</th>
                  <th className="px-6 py-3.5">To Recruiter</th>
                  <th className="px-6 py-3.5">Entities Transferred</th>
                  <th className="px-6 py-3.5">Reason & Notes</th>
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{r.fromUserName}</div>
                      <div className="text-xs text-slate-400">{r.fromUserEmail}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{r.toUserName}</div>
                      <div className="text-xs text-slate-400">{r.toUserEmail}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5 text-xs">
                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">
                          {r.candidateIds.length} Candidate(s)
                        </span>
                        <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-medium">
                          {r.jobIds.length} Job(s)
                        </span>
                        <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-medium">
                          {r.taskIds.length} Task(s)
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <div className="font-medium text-slate-800 line-clamp-1">{r.reason}</div>
                      {r.notes && <div className="text-xs text-slate-400 line-clamp-1">{r.notes}</div>}
                      {r.rejectionReason && (
                        <div className="text-xs text-rose-600 font-medium mt-0.5">
                          Reason: {r.rejectionReason}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {new Date(r.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(r.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {r.status === 'PENDING' && isManager && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApprove(r.id)}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(r.id)}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {r.status === 'PENDING' && !isManager && r.fromUserId === currentUser?.id && (
                        <button
                          onClick={() => handleCancel(r.id)}
                          className="px-2.5 py-1 text-xs font-semibold rounded text-slate-600 border border-slate-200 hover:bg-slate-100"
                        >
                          Cancel
                        </button>
                      )}
                      {r.status === 'APPROVED' && (
                        <span className="text-xs text-slate-400 font-medium">Transferred</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* WIZARD MODAL: Frame 41 Recruiter Handover */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-[#5B49D6]" />
                <h3 className="text-lg font-bold text-slate-900">Initiate Recruiter Handover</h3>
              </div>
              <button
                onClick={() => setIsWizardOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleWizardSubmit} className="mt-4 flex-1 flex flex-col overflow-hidden space-y-4">
              {wizardError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {wizardError}
                </div>
              )}

              {/* Step 1: Select Recruiters */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Source Recruiter (Transferring From) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    disabled={!isManager}
                    value={fromUserId}
                    onChange={(e) => handleSourceChange(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 disabled:bg-slate-100 font-medium focus:ring-2 focus:ring-[#5B49D6]"
                  >
                    {recruiters.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Destination Recruiter (Transferring To) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={toUserId}
                    onChange={(e) => setToUserId(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium focus:ring-2 focus:ring-[#5B49D6]"
                  >
                    <option value="">Select Recruiter...</option>
                    {recruiters
                      .filter((r) => r.id !== fromUserId)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.role})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Step 2: Independent Resource Selection Tabs */}
              <div className="flex-1 flex flex-col border border-slate-200 rounded-xl overflow-hidden min-h-[220px]">
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => setResourceTab('CANDIDATES')}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                        resourceTab === 'CANDIDATES'
                          ? 'bg-[#5B49D6] text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Candidates ({selectedCandidates.length}/{resources.candidates.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setResourceTab('JOBS')}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                        resourceTab === 'JOBS'
                          ? 'bg-[#5B49D6] text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Jobs ({selectedJobs.length}/{resources.jobs.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setResourceTab('TASKS')}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                        resourceTab === 'TASKS'
                          ? 'bg-[#5B49D6] text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Open Tasks ({selectedTasks.length}/{resources.tasks.length})
                    </button>
                  </div>

                  <span className="text-[11px] text-slate-400 italic">
                    Independent selections
                  </span>
                </div>

                <div className="flex-1 p-3 overflow-y-auto max-h-52 space-y-1.5">
                  {loadingResources ? (
                    <div className="p-8 text-center text-xs text-slate-400">Loading portfolio...</div>
                  ) : resourceTab === 'CANDIDATES' ? (
                    resources.candidates.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">No candidates owned by this recruiter.</div>
                    ) : (
                      resources.candidates.map((c) => (
                        <label
                          key={c.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 border border-slate-100 text-xs cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCandidates.includes(c.id)}
                            onChange={() => toggleSelectCandidate(c.id)}
                            className="rounded border-slate-300 text-[#5B49D6] focus:ring-[#5B49D6]"
                          />
                          <div className="flex-1">
                            <span className="font-semibold text-slate-800">{c.name}</span>
                            <span className="text-slate-400 ml-2">{c.currentTitle || c.email}</span>
                          </div>
                        </label>
                      ))
                    )
                  ) : resourceTab === 'JOBS' ? (
                    resources.jobs.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">No active jobs assigned to this recruiter.</div>
                    ) : (
                      resources.jobs.map((j) => (
                        <label
                          key={j.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 border border-slate-100 text-xs cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedJobs.includes(j.id)}
                            onChange={() => toggleSelectJob(j.id)}
                            className="rounded border-slate-300 text-[#5B49D6] focus:ring-[#5B49D6]"
                          />
                          <div className="flex-1">
                            <span className="font-semibold text-slate-800">{j.title}</span>
                            <span className="text-slate-400 ml-2 font-mono">({j.code})</span>
                            <span className="text-slate-500 ml-2">• {j.client?.legalName}</span>
                          </div>
                        </label>
                      ))
                    )
                  ) : resources.tasks.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">No open pending tasks.</div>
                  ) : (
                    resources.tasks.map((t) => (
                      <label
                        key={t.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 border border-slate-100 text-xs cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTasks.includes(t.id)}
                          onChange={() => toggleSelectTask(t.id)}
                          className="rounded border-slate-300 text-[#5B49D6] focus:ring-[#5B49D6]"
                        />
                        <div className="flex-1">
                          <span className="font-medium text-slate-800">{t.title}</span>
                          <span className="text-slate-400 ml-2 text-[11px] font-semibold uppercase">{t.priority}</span>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Step 3: Reason & Notes */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Handover Reason <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Portfolio rebalancing, maternity leave, resignation"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#5B49D6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Instructions / Handoff Notes
                  </label>
                  <input
                    type="text"
                    placeholder="Prioritize job calls, follow up on pending candidate offer"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#5B49D6]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="text-xs text-slate-500">
                  Total Transfer: <strong>{selectedCandidates.length}</strong> candidates,{' '}
                  <strong>{selectedJobs.length}</strong> jobs, <strong>{selectedTasks.length}</strong> tasks
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsWizardOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-5 py-2 text-xs font-semibold rounded-lg bg-[#5B49D6] text-white hover:bg-[#4338ca] shadow-sm disabled:opacity-50"
                  >
                    {isPending ? 'Submitting Handover...' : 'Submit Handover Request'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
