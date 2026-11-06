'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  MapPin,
  Users,
  Calendar,
  AlertCircle,
  PauseCircle,
  PlayCircle,
  XCircle,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Settings,
  ListOrdered,
  History,
  UserPlus,
  UserMinus,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Send,
} from 'lucide-react';
import {
  SerializedJobDto,
  JobStatus,
  EmploymentType,
  UserRole,
} from '@hireflow/shared';
import {
  updateJobConfigurationAction,
  activateJobAction,
  pauseJobAction,
  resumeJobAction,
  closeJobAction,
  reopenJobAction,
  createJobRoundAction,
  reorderJobRoundsAction,
  archiveJobRoundAction,
  assignRecruiterAction,
  unassignRecruiterAction,
  requestReassignmentAction,
  reviewReassignmentRequestAction,
} from '@/actions/jobs';

interface JobRecordClientViewProps {
  job: SerializedJobDto;
  clients: Array<{
    id: string;
    legalName: string;
    code: string;
    contacts: Array<{ id: string; name: string; email: string; designation?: string | null }>;
  }>;
  recruiters: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
  }>;
  currentUser: {
    id: string;
    name: string;
    role: string;
  };
}

export function JobRecordClientView({
  job,
  clients,
  recruiters,
  currentUser,
}: JobRecordClientViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'config' | 'rounds' | 'history' | 'assignments'>('config');

  // Success / Error alerts
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Tab 1: Configuration Form State
  const [title, setTitle] = useState(job.title);
  const [openings, setOpenings] = useState(job.openings);
  const [employmentType, setEmploymentType] = useState<EmploymentType>(
    (job.employmentType as EmploymentType) || EmploymentType.FULL_TIME
  );
  const [location, setLocation] = useState(job.location || '');
  const [salaryMin, setSalaryMin] = useState<string>(job.salaryMin != null ? String(job.salaryMin) : '');
  const [salaryMax, setSalaryMax] = useState<string>(job.salaryMax != null ? String(job.salaryMax) : '');
  const [hiringManagerContactId, setHiringManagerContactId] = useState(job.hiringManagerContactId || '');
  const [ownerId, setOwnerId] = useState(job.ownerId || '');
  const [deadline, setDeadline] = useState(
    job.deadline ? new Date(job.deadline).toISOString().split('T')[0] : ''
  );
  const [description, setDescription] = useState(job.description || '');
  const [requirements, setRequirements] = useState(job.requirements || '');

  // Tab 2: Rounds State
  const [isAddRoundOpen, setIsAddRoundOpen] = useState(false);
  const [newRoundName, setNewRoundName] = useState('');
  const [newRoundType, setNewRoundType] = useState('VIDEO');
  const [newRoundDuration, setNewRoundDuration] = useState(45);
  const [newRoundPanel, setNewRoundPanel] = useState('');
  const [newRoundDesc, setNewRoundDesc] = useState('');

  // Tab 4: Assignment Modals State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedRecruiterToAssign, setSelectedRecruiterToAssign] = useState('');

  const [isReassignmentModalOpen, setIsReassignmentModalOpen] = useState(false);
  const [targetRecruiterId, setTargetRecruiterId] = useState('');
  const [reassignmentReason, setReassignmentReason] = useState('');

  // Transition Dialog States
  const [transitionType, setTransitionType] = useState<'PAUSE' | 'CLOSE' | null>(null);
  const [transitionReason, setTransitionReason] = useState('CLIENT_HOLD');
  const [transitionNote, setTransitionNote] = useState('');

  const clearAlerts = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const isInternal =
    currentUser.role === UserRole.ADMIN ||
    currentUser.role === UserRole.MANAGER ||
    currentUser.role === UserRole.RECRUITER;

  const isManagerOrAdmin =
    currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER;

  // Selected client contacts
  const selectedClient = clients.find((c) => c.id === job.clientId);
  const clientContacts = selectedClient?.contacts || [];

  // -----------------------------------------------------------
  // Action Handlers
  // -----------------------------------------------------------
  const handleSaveConfiguration = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();

    const minSal = salaryMin ? parseFloat(salaryMin) : undefined;
    const maxSal = salaryMax ? parseFloat(salaryMax) : undefined;

    if (minSal != null && maxSal != null && maxSal < minSal) {
      setErrorMessage('Maximum salary must be greater than or equal to minimum salary');
      return;
    }

    startTransition(async () => {
      const res = await updateJobConfigurationAction(job.id, {
        title: title.trim(),
        openings: Number(openings) || 1,
        employmentType,
        location: location.trim() || null,
        salaryMin: minSal,
        salaryMax: maxSal,
        hiringManagerContactId: hiringManagerContactId || null,
        ownerId: ownerId || null,
        deadline: deadline ? new Date(deadline) : null,
        description: description.trim() || null,
        requirements: requirements.trim() || null,
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Failed to save configuration');
        return;
      }

      setSuccessMessage('Job configuration updated successfully');
      router.refresh();
    });
  };

  const handleActivate = () => {
    clearAlerts();
    startTransition(async () => {
      const res = await activateJobAction(job.id);
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to activate job');
        return;
      }
      setSuccessMessage('Job requisition activated successfully');
      router.refresh();
    });
  };

  const handleResume = () => {
    clearAlerts();
    startTransition(async () => {
      const res = await resumeJobAction(job.id, 'Resumed by user');
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to resume job');
        return;
      }
      setSuccessMessage('Job requisition resumed and is now accepting candidates');
      router.refresh();
    });
  };

  const handleReopen = () => {
    clearAlerts();
    startTransition(async () => {
      const res = await reopenJobAction(job.id, 'Client reopened mandate');
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to reopen job');
        return;
      }
      setSuccessMessage('Job requisition reopened as ACTIVE');
      router.refresh();
    });
  };

  const handleConfirmTransition = () => {
    clearAlerts();
    startTransition(async () => {
      let res: { success: boolean; error?: string };
      if (transitionType === 'PAUSE') {
        res = await pauseJobAction(job.id, transitionReason, transitionNote);
      } else if (transitionType === 'CLOSE') {
        res = await closeJobAction(job.id, transitionReason, transitionNote, transitionNote);
      } else {
        return;
      }

      if (!res.success) {
        setErrorMessage(res.error || 'Status transition failed');
        return;
      }

      setTransitionType(null);
      setTransitionNote('');
      setSuccessMessage(`Job status updated to ${transitionType === 'PAUSE' ? 'PAUSED' : 'CLOSED'}`);
      router.refresh();
    });
  };

  // Rounds handlers
  const handleAddRound = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();

    if (!newRoundName.trim()) return;

    startTransition(async () => {
      const panels = newRoundPanel
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

      const res = await createJobRoundAction(job.id, {
        name: newRoundName.trim(),
        roundOrder: (job.rounds?.length || 0) + 1,
        interviewType: newRoundType,
        durationMinutes: Number(newRoundDuration) || 45,
        panelMembers: panels,
        description: newRoundDesc.trim() || null,
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Failed to add round');
        return;
      }

      setIsAddRoundOpen(false);
      setNewRoundName('');
      setNewRoundPanel('');
      setNewRoundDesc('');
      setSuccessMessage('Interview round added');
      router.refresh();
    });
  };

  const handleMoveRound = (index: number, direction: 'UP' | 'DOWN') => {
    if (!job.rounds) return;
    const currentRounds = [...job.rounds];
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentRounds.length) return;

    // Swap
    const temp = currentRounds[index];
    currentRounds[index] = currentRounds[targetIndex];
    currentRounds[targetIndex] = temp;

    const roundIds = currentRounds.map((r) => r.id);

    startTransition(async () => {
      const res = await reorderJobRoundsAction(job.id, roundIds);
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to reorder rounds');
        return;
      }
      router.refresh();
    });
  };

  const handleArchiveRound = (roundId: string) => {
    if (!confirm('Are you sure you want to deactivate this round? Historical interviews will be preserved.')) {
      return;
    }
    clearAlerts();
    startTransition(async () => {
      const res = await archiveJobRoundAction(job.id, roundId);
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to deactivate round');
        return;
      }
      setSuccessMessage('Round safely deactivated without affecting historical interviews');
      router.refresh();
    });
  };

  // Assignment Handlers
  const handleAssignRecruiter = () => {
    if (!selectedRecruiterToAssign) return;
    clearAlerts();
    startTransition(async () => {
      const res = await assignRecruiterAction(job.id, selectedRecruiterToAssign);
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to assign recruiter');
        return;
      }
      setIsAssignModalOpen(false);
      setSelectedRecruiterToAssign('');
      setSuccessMessage('Recruiter assigned successfully');
      router.refresh();
    });
  };

  const handleUnassignRecruiter = (recruiterId: string) => {
    if (!confirm('Are you sure you want to unassign this recruiter from this job mandate?')) {
      return;
    }
    clearAlerts();
    startTransition(async () => {
      const res = await unassignRecruiterAction(job.id, recruiterId);
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to unassign recruiter');
        return;
      }
      setSuccessMessage('Recruiter unassigned successfully');
      router.refresh();
    });
  };

  const handleRequestReassignment = (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();
    if (reassignmentReason.trim().length < 5) {
      setErrorMessage('Please provide a reason with at least 5 characters');
      return;
    }

    startTransition(async () => {
      const res = await requestReassignmentAction(job.id, {
        targetRecruiterId: targetRecruiterId || null,
        reason: reassignmentReason.trim(),
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Failed to submit reassignment request');
        return;
      }

      setIsReassignmentModalOpen(false);
      setReassignmentReason('');
      setTargetRecruiterId('');
      setSuccessMessage('Reassignment request submitted for manager review');
      router.refresh();
    });
  };

  const handleReviewReassignment = (requestId: string, status: 'APPROVED' | 'REJECTED') => {
    clearAlerts();
    startTransition(async () => {
      const res = await reviewReassignmentRequestAction(job.id, requestId, {
        status,
        reviewNotes: `Reviewed and ${status.toLowerCase()} by ${currentUser.name}`,
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Failed to review reassignment request');
        return;
      }

      setSuccessMessage(`Reassignment request ${status.toLowerCase()}`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <div>
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6B7490] hover:text-[#5B49D6] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Jobs</span>
        </Link>
      </div>

      {/* Global Alerts */}
      {successMessage && (
        <div className="p-3.5 bg-green-50 border border-green-200 text-green-800 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-green-600 hover:text-green-800">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-red-600 hover:text-red-800">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner (Figma Frame 21) */}
      <div className="bg-white rounded-2xl border border-[#E6E8F0] p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-xs font-bold text-[#5B49D6] bg-[#EEEBFB] px-2 py-0.5 rounded">
              {job.code}
            </span>
            <h1 className="text-xl font-bold text-[#1B2236]">{job.title}</h1>
            {job.status === JobStatus.ACTIVE && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E3F6EC] text-[#12B76A]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#12B76A] animate-pulse" />
                Active
              </span>
            )}
            {job.status === JobStatus.PAUSED && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FEF3DC] text-[#F59E0B]">
                <PauseCircle className="w-3.5 h-3.5" />
                On Hold
              </span>
            )}
            {job.status === JobStatus.CLOSED && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F0F2F7] text-[#6B7490]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Closed ({job.closingReason || 'Finished'})
              </span>
            )}
            {job.status === JobStatus.DRAFT && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EEEBFB] text-[#5B49D6]">
                Draft Mandate
              </span>
            )}
          </div>

          {/* Metadata Row */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-[#6B7490]">
            <Link
              href={`/clients/${job.clientId}`}
              className="flex items-center gap-1.5 hover:text-[#5B49D6] transition-colors font-medium"
            >
              <Building2 className="w-3.5 h-3.5 text-[#5B49D6]" />
              <span className="text-[#1B2236] font-semibold">{job.clientName}</span>
            </Link>

            <div className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#6B7490]" />
              <span>{job.location || 'Remote'}</span>
            </div>

            <div className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-[#6B7490]" />
              <span>{job.openings} Openings ({job.candidateCount ?? 0} candidates)</span>
            </div>

            {job.deadline && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#6B7490]" />
                <span>Deadline: {new Date(job.deadline).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Lifecycle Actions */}
        {isInternal && (
          <div className="flex flex-wrap items-center gap-2">
            {job.status === JobStatus.DRAFT && (
              <button
                data-testid="btn-activate-job"
                onClick={handleActivate}
                disabled={isPending}
                className="px-4 py-2 bg-[#12B76A] hover:bg-[#0E9355] text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
              >
                <PlayCircle className="w-4 h-4" />
                <span>Activate Job</span>
              </button>
            )}

            {job.status === JobStatus.ACTIVE && (
              <>
                <button
                  data-testid="btn-pause-job"
                  onClick={() => {
                    setTransitionType('PAUSE');
                    setTransitionReason('CLIENT_HOLD');
                  }}
                  disabled={isPending}
                  className="px-3.5 py-2 bg-[#FEF3DC] text-[#F59E0B] hover:bg-[#FDE68A] rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
                >
                  <PauseCircle className="w-4 h-4" />
                  <span>Pause Job</span>
                </button>

                <button
                  data-testid="btn-close-job"
                  onClick={() => {
                    setTransitionType('CLOSE');
                    setTransitionReason('POSITION_FILLED');
                  }}
                  disabled={isPending}
                  className="px-3.5 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Close Job</span>
                </button>

                <button
                  data-testid="btn-reassign-job"
                  onClick={() => setIsReassignmentModalOpen(true)}
                  disabled={isPending}
                  className="px-3.5 py-2 border border-[#E6E8F0] text-[#1B2236] hover:bg-[#F6F7FB] rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5 text-[#5B49D6]" />
                  <span>Request Reassignment</span>
                </button>
              </>
            )}

            {job.status === JobStatus.PAUSED && (
              <>
                <button
                  data-testid="btn-resume-job"
                  onClick={handleResume}
                  disabled={isPending}
                  className="px-4 py-2 bg-[#12B76A] hover:bg-[#0E9355] text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <PlayCircle className="w-4 h-4" />
                  <span>Resume Job</span>
                </button>

                <button
                  data-testid="btn-close-job"
                  onClick={() => {
                    setTransitionType('CLOSE');
                    setTransitionReason('BUDGET_CANCELLED');
                  }}
                  disabled={isPending}
                  className="px-3.5 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Close Job</span>
                </button>
              </>
            )}

            {job.status === JobStatus.CLOSED && (
              <button
                data-testid="btn-reopen-job"
                onClick={handleReopen}
                disabled={isPending}
                className="px-4 py-2 bg-[#5B49D6] hover:bg-[#4D3DC2] text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
              >
                <PlayCircle className="w-4 h-4" />
                <span>Reopen Mandate</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4 Underline-Style Tabs (Figma Frame 21) */}
      <div className="border-b border-[#E6E8F0] flex items-center gap-8">
        <button
          data-testid="tab-config"
          onClick={() => setActiveTab('config')}
          className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-1.5 ${
            activeTab === 'config'
              ? 'text-[#5B49D6]'
              : 'text-[#6B7490] hover:text-[#1B2236]'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Configuration</span>
          {activeTab === 'config' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5B49D6] rounded-t-full" />
          )}
        </button>

        <button
          data-testid="tab-rounds"
          onClick={() => setActiveTab('rounds')}
          className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-1.5 ${
            activeTab === 'rounds'
              ? 'text-[#5B49D6]'
              : 'text-[#6B7490] hover:text-[#1B2236]'
          }`}
        >
          <ListOrdered className="w-4 h-4" />
          <span>Interview Rounds</span>
          {job.rounds && job.rounds.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 bg-[#EEEBFB] text-[#5B49D6] rounded-full text-[10px]">
              {job.rounds.length}
            </span>
          )}
          {activeTab === 'rounds' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5B49D6] rounded-t-full" />
          )}
        </button>

        <button
          data-testid="tab-history"
          onClick={() => setActiveTab('history')}
          className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-1.5 ${
            activeTab === 'history'
              ? 'text-[#5B49D6]'
              : 'text-[#6B7490] hover:text-[#1B2236]'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Lifecycle History</span>
          {activeTab === 'history' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5B49D6] rounded-t-full" />
          )}
        </button>

        <button
          data-testid="tab-assignments"
          onClick={() => setActiveTab('assignments')}
          className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-1.5 ${
            activeTab === 'assignments'
              ? 'text-[#5B49D6]'
              : 'text-[#6B7490] hover:text-[#1B2236]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Assignments</span>
          {job.assignments && job.assignments.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 bg-[#EEEBFB] text-[#5B49D6] rounded-full text-[10px]">
              {job.assignments.length}
            </span>
          )}
          {activeTab === 'assignments' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5B49D6] rounded-t-full" />
          )}
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: CONFIGURATION                                     */}
      {/* ======================================================== */}
      {activeTab === 'config' && (
        <div className="bg-white rounded-2xl border border-[#E6E8F0] p-6 shadow-xs">
          <form onSubmit={handleSaveConfiguration} className="space-y-6 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Job Title */}
              <div>
                <label className="block font-semibold text-[#1B2236] mb-1.5">
                  Job Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-sm focus:border-[#5B49D6] focus:outline-none"
                />
              </div>

              {/* Hiring Manager Contact */}
              <div>
                <label className="block font-semibold text-[#1B2236] mb-1.5">
                  Client Hiring Manager Contact
                </label>
                <select
                  value={hiringManagerContactId}
                  onChange={(e) => setHiringManagerContactId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs font-medium focus:border-[#5B49D6] focus:outline-none cursor-pointer"
                >
                  <option value="">None / Unassigned</option>
                  {clientContacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name} {contact.designation ? `(${contact.designation})` : ''} - {contact.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Openings & Type */}
              <div>
                <label className="block font-semibold text-[#1B2236] mb-1.5">
                  Openings <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={openings}
                  onChange={(e) => setOpenings(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs font-medium focus:border-[#5B49D6] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1B2236] mb-1.5">
                  Employment Type
                </label>
                <select
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
                  className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs font-medium focus:border-[#5B49D6] focus:outline-none cursor-pointer"
                >
                  <option value={EmploymentType.FULL_TIME}>Full Time</option>
                  <option value={EmploymentType.CONTRACT}>Contract</option>
                  <option value={EmploymentType.PART_TIME}>Part Time</option>
                  <option value={EmploymentType.INTERNSHIP}>Internship</option>
                </select>
              </div>

              {/* Location & Deadline */}
              <div>
                <label className="block font-semibold text-[#1B2236] mb-1.5">Location</label>
                <input
                  type="text"
                  placeholder="e.g. Bangalore / Remote"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs focus:border-[#5B49D6] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1B2236] mb-1.5">
                  Target Closing Deadline
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs focus:border-[#5B49D6] focus:outline-none"
                />
              </div>

              {/* Salary Range */}
              <div>
                <label className="block font-semibold text-[#1B2236] mb-1.5">
                  Min Salary (Annual ₹)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 1800000"
                  value={salaryMin}
                  onChange={(e) => setSalaryMin(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs focus:border-[#5B49D6] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1B2236] mb-1.5">
                  Max Salary (Annual ₹)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 2800000"
                  value={salaryMax}
                  onChange={(e) => setSalaryMax(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs focus:border-[#5B49D6] focus:outline-none"
                />
              </div>

              {/* Recruiter Owner (Admin/Manager only) */}
              {isManagerOrAdmin && (
                <div className="md:col-span-2">
                  <label className="block font-semibold text-[#1B2236] mb-1.5">
                    Lead Recruiter / Owner
                  </label>
                  <select
                    value={ownerId}
                    onChange={(e) => setOwnerId(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs font-medium focus:border-[#5B49D6] focus:outline-none cursor-pointer max-w-md"
                  >
                    <option value="">Unassigned</option>
                    {recruiters.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.role}) - {r.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block font-semibold text-[#1B2236] mb-1.5">
                Role Description & Scope
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detailed job description and responsibilities..."
                className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs focus:border-[#5B49D6] focus:outline-none"
              />
            </div>

            {/* Requirements */}
            <div>
              <label className="block font-semibold text-[#1B2236] mb-1.5">
                Requirements & Qualifications
              </label>
              <textarea
                rows={4}
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                placeholder="Must-have competencies, minimum years of experience, technical stack..."
                className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs focus:border-[#5B49D6] focus:outline-none"
              />
            </div>

            {/* Save Button */}
            {isInternal && (
              <div className="pt-4 border-t border-[#E6E8F0] flex items-center justify-end">
                <button
                  data-testid="btn-save-config"
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 bg-[#5B49D6] hover:bg-[#4D3DC2] text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-50 shadow-sm flex items-center gap-1.5"
                >
                  {isPending ? 'Saving Configuration...' : 'Save Configuration Changes'}
                </button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: INTERVIEW ROUNDS                                   */}
      {/* ======================================================== */}
      {activeTab === 'rounds' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#1B2236]">Interview Pipeline Sequence</h3>
              <p className="text-xs text-[#6B7490]">
                Sequential stages candidates pass through. Reordering updates pipeline order immediately.
              </p>
            </div>
            {isInternal && (
              <button
                data-testid="btn-add-round"
                onClick={() => setIsAddRoundOpen(true)}
                className="px-3 py-1.5 bg-[#5B49D6] hover:bg-[#4D3DC2] text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Interview Round</span>
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-[#E6E8F0] shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F6F7FB] border-b border-[#E6E8F0] text-[#6B7490] font-semibold">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Round Name</th>
                  <th className="py-3 px-4">Evaluation Type</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Panel Members</th>
                  <th className="py-3 px-4">Description</th>
                  {isInternal && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E8F0]">
                {(!job.rounds || job.rounds.length === 0) ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#6B7490]">
                      No active interview rounds defined. Click "Add Interview Round" to set up.
                    </td>
                  </tr>
                ) : (
                  job.rounds.map((round, idx) => (
                    <tr key={round.id} className="hover:bg-[#F6F7FB]/50 transition-colors">
                      <td className="py-3.5 px-4 text-center font-bold text-[#5B49D6]">
                        {round.roundOrder}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#1B2236]">
                        {round.name}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded font-mono text-[10px] font-semibold bg-[#EEEBFB] text-[#5B49D6]">
                          {round.interviewType}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-[#6B7490]">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#6B7490]" />
                          <span>{round.durationMinutes} mins</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-[#1B2236]">
                        {round.panelMembers && round.panelMembers.length > 0
                          ? round.panelMembers.join(', ')
                          : <span className="text-[#6B7490] italic">Unassigned</span>}
                      </td>
                      <td className="py-3.5 px-4 text-[#6B7490] max-w-xs truncate">
                        {round.description || '—'}
                      </td>
                      {isInternal && (
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Reorder Up */}
                            <button
                              disabled={idx === 0 || isPending}
                              onClick={() => handleMoveRound(idx, 'UP')}
                              className="p-1 rounded text-[#6B7490] hover:text-[#5B49D6] hover:bg-[#EEEBFB] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              title="Move Up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>

                            {/* Reorder Down */}
                            <button
                              disabled={idx === (job.rounds?.length || 0) - 1 || isPending}
                              onClick={() => handleMoveRound(idx, 'DOWN')}
                              className="p-1 rounded text-[#6B7490] hover:text-[#5B49D6] hover:bg-[#EEEBFB] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              title="Move Down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>

                            {/* Safe Deactivate */}
                            <button
                              disabled={isPending}
                              onClick={() => handleArchiveRound(round.id)}
                              className="p-1 rounded text-[#6B7490] hover:text-red-600 hover:bg-red-50 transition-colors ml-1"
                              title="Deactivate Round (Safe Archive)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: LIFECYCLE HISTORY                                  */}
      {/* ======================================================== */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-[#E6E8F0] p-6 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-[#1B2236]">Requisition State Transition Audit</h3>
            <p className="text-xs text-[#6B7490]">
              Immutable chronological record of every status transition, reason, and actor.
            </p>
          </div>

          {(!job.statusHistories || job.statusHistories.length === 0) ? (
            <div className="py-8 text-center text-[#6B7490] text-xs">
              No historical status changes recorded.
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E6E8F0]">
              {job.statusHistories.map((hist) => (
                <div key={hist.id} className="relative group text-xs">
                  {/* Dot */}
                  <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-[#5B49D6] ring-4 ring-white" />

                  <div className="bg-[#F6F7FB] rounded-xl p-3.5 border border-[#E6E8F0]/80">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-semibold">
                        <span className="text-[#6B7490]">
                          {hist.previousStatus || 'INIT'}
                        </span>
                        <span>→</span>
                        <span className="text-[#5B49D6] font-bold">
                          {hist.newStatus}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#6B7490]">
                        {new Date(hist.createdAt).toLocaleString()}
                      </span>
                    </div>

                    {hist.reason && (
                      <p className="mt-1.5 text-[#1B2236] font-medium">
                        Reason: <span className="font-semibold">{hist.reason}</span>
                      </p>
                    )}

                    {hist.note && (
                      <p className="mt-1 text-[#6B7490] italic">
                        "{hist.note}"
                      </p>
                    )}

                    <div className="mt-2 text-[10px] text-[#6B7490] font-mono">
                      Actor: {hist.changedByName || hist.changedById}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: ASSIGNMENTS & REASSIGNMENT REQUESTS                */}
      {/* ======================================================== */}
      {activeTab === 'assignments' && (
        <div className="space-y-6">
          {/* Active Assignments Card */}
          <div className="bg-white rounded-2xl border border-[#E6E8F0] p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#1B2236]">Assigned Recruiters</h3>
                <p className="text-xs text-[#6B7490]">
                  Team members actively working on sourcing and managing candidates for this requisition.
                </p>
              </div>
              {isManagerOrAdmin && (
                <button
                  onClick={() => setIsAssignModalOpen(true)}
                  className="px-3 py-1.5 bg-[#5B49D6] hover:bg-[#4D3DC2] text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Assign Recruiter</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {(!job.assignments || job.assignments.length === 0) ? (
                <div className="col-span-full py-6 text-center text-[#6B7490] text-xs">
                  No active recruiter assignments on this job mandate.
                </div>
              ) : (
                job.assignments.map((asg) => (
                  <div
                    key={asg.id}
                    className="p-4 rounded-xl border border-[#E6E8F0] bg-[#F6F7FB]/50 flex items-start justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#EEEBFB] text-[#5B49D6] font-bold text-xs flex items-center justify-center">
                        {asg.recruiterName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#1B2236]">
                          {asg.recruiterName}
                        </h4>
                        <p className="text-[11px] text-[#6B7490]">{asg.recruiterEmail}</p>
                        <p className="text-[10px] text-[#6B7490] mt-1 font-medium">
                          Assigned {new Date(asg.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {isManagerOrAdmin && (
                      <button
                        onClick={() => handleUnassignRecruiter(asg.recruiterId)}
                        disabled={isPending}
                        className="text-[#6B7490] hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                        title="Unassign recruiter"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Reassignment Requests Card */}
          <div className="bg-white rounded-2xl border border-[#E6E8F0] p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#1B2236]">Reassignment Requests</h3>
                <p className="text-xs text-[#6B7490]">
                  Track recruiter capacity handovers and manager approvals.
                </p>
              </div>
              {isInternal && (
                <button
                  onClick={() => setIsReassignmentModalOpen(true)}
                  className="px-3 py-1.5 border border-[#E6E8F0] text-[#1B2236] hover:bg-[#F6F7FB] rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5 text-[#5B49D6]" />
                  <span>Request Handover</span>
                </button>
              )}
            </div>

            <div className="divide-y divide-[#E6E8F0] border border-[#E6E8F0] rounded-xl overflow-hidden">
              {(!job.reassignmentRequests || job.reassignmentRequests.length === 0) ? (
                <div className="p-6 text-center text-[#6B7490] text-xs">
                  No reassignment requests submitted for this job mandate.
                </div>
              ) : (
                job.reassignmentRequests.map((req) => (
                  <div key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#1B2236]">
                          {req.requestingRecruiterName}
                        </span>
                        <span className="text-[#6B7490]">requested handover to</span>
                        <span className="font-bold text-[#5B49D6]">
                          {req.targetRecruiterName || 'Any Available Recruiter'}
                        </span>
                        <span
                          className={`ml-2 px-2 py-0.5 rounded text-[10px] font-bold ${
                            req.status === 'APPROVED'
                              ? 'bg-[#E3F6EC] text-[#12B76A]'
                              : req.status === 'REJECTED'
                              ? 'bg-red-50 text-red-600'
                              : 'bg-[#FEF3DC] text-[#F59E0B]'
                          }`}
                        >
                          {req.status}
                        </span>
                      </div>
                      <p className="text-[#6B7490] italic">"{req.reason}"</p>
                      <p className="text-[10px] text-[#6B7490]">
                        Requested on {new Date(req.createdAt).toLocaleString()}
                        {req.reviewedByName && ` • Reviewed by ${req.reviewedByName}`}
                      </p>
                    </div>

                    {/* Manager Approval Actions */}
                    {isManagerOrAdmin && req.status === 'PENDING' && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleReviewReassignment(req.id, 'APPROVED')}
                          disabled={isPending}
                          className="px-3 py-1.5 bg-[#12B76A] hover:bg-[#0E9355] text-white rounded-lg text-xs font-semibold transition-all shadow-sm"
                        >
                          Approve Handover
                        </button>
                        <button
                          onClick={() => handleReviewReassignment(req.id, 'REJECTED')}
                          disabled={isPending}
                          className="px-3 py-1.5 border border-[#E6E8F0] text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold transition-all"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ADD INTERVIEW ROUND                                */}
      {/* ======================================================== */}
      {isAddRoundOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-[#E6E8F0] p-6 space-y-4">
            <h3 className="text-base font-bold text-[#1B2236]">Add Interview Stage</h3>

            <form onSubmit={handleAddRound} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#1B2236] mb-1">
                  Round Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. System Design Architecture"
                  value={newRoundName}
                  onChange={(e) => setNewRoundName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs focus:border-[#5B49D6] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#1B2236] mb-1">Type</label>
                  <select
                    value={newRoundType}
                    onChange={(e) => setNewRoundType(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs font-medium focus:border-[#5B49D6] focus:outline-none"
                  >
                    <option value="SCREENING">HR / Screening</option>
                    <option value="TECHNICAL">Technical evaluation</option>
                    <option value="HIRING_MANAGER">Hiring Manager</option>
                    <option value="CULTURE_FIT">Culture & Fit</option>
                    <option value="EXECUTIVE">Executive / Partner</option>
                    <option value="VIDEO">Video Call</option>
                    <option value="IN_PERSON">In-Person</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#1B2236] mb-1">Duration (Mins)</label>
                  <input
                    type="number"
                    min={15}
                    max={240}
                    value={newRoundDuration}
                    onChange={(e) => setNewRoundDuration(parseInt(e.target.value, 10) || 45)}
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs focus:border-[#5B49D6] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#1B2236] mb-1">
                  Panel Members (Comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tech Lead, Principal Architect"
                  value={newRoundPanel}
                  onChange={(e) => setNewRoundPanel(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs focus:border-[#5B49D6] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1B2236] mb-1">Evaluation Description</label>
                <textarea
                  rows={2}
                  placeholder="Competencies and areas evaluated during this round..."
                  value={newRoundDesc}
                  onChange={(e) => setNewRoundDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs focus:border-[#5B49D6] focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddRoundOpen(false)}
                  className="px-3.5 py-2 border border-[#E6E8F0] text-[#6B7490] hover:bg-[#F6F7FB] rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-[#5B49D6] hover:bg-[#4D3DC2] text-white rounded-lg text-xs font-semibold shadow-sm"
                >
                  {isPending ? 'Adding Round...' : 'Add Round'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ASSIGN RECRUITER                                   */}
      {/* ======================================================== */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-[#E6E8F0] p-6 space-y-4">
            <h3 className="text-base font-bold text-[#1B2236]">Assign Recruiter to Requisition</h3>
            <div>
              <label className="block font-semibold text-[#1B2236] mb-1 text-xs">
                Select Team Member
              </label>
              <select
                value={selectedRecruiterToAssign}
                onChange={(e) => setSelectedRecruiterToAssign(e.target.value)}
                className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs font-medium focus:border-[#5B49D6] focus:outline-none cursor-pointer"
              >
                <option value="">Choose recruiter...</option>
                {recruiters.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="px-3.5 py-2 border border-[#E6E8F0] text-[#6B7490] hover:bg-[#F6F7FB] rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedRecruiterToAssign || isPending}
                onClick={handleAssignRecruiter}
                className="px-4 py-2 bg-[#5B49D6] hover:bg-[#4D3DC2] text-white rounded-lg font-semibold shadow-sm disabled:opacity-50"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: REQUEST REASSIGNMENT                               */}
      {/* ======================================================== */}
      {isReassignmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-[#E6E8F0] p-6 space-y-4 text-xs">
            <h3 className="text-base font-bold text-[#1B2236]">Request Mandate Handover</h3>
            <p className="text-[#6B7490]">
              Submit a workload transfer request to your team manager.
            </p>

            <form onSubmit={handleRequestReassignment} className="space-y-4">
              <div>
                <label className="block font-semibold text-[#1B2236] mb-1">
                  Target Recruiter (Optional)
                </label>
                <select
                  value={targetRecruiterId}
                  onChange={(e) => setTargetRecruiterId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs font-medium focus:border-[#5B49D6] focus:outline-none"
                >
                  <option value="">Any available recruiter</option>
                  {recruiters
                    .filter((r) => r.id !== currentUser.id)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.role})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#1B2236] mb-1">
                  Reason for Handover <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain capacity constraints, domain mismatch, or leave of absence..."
                  value={reassignmentReason}
                  onChange={(e) => setReassignmentReason(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs focus:border-[#5B49D6] focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsReassignmentModalOpen(false)}
                  className="px-3.5 py-2 border border-[#E6E8F0] text-[#6B7490] hover:bg-[#F6F7FB] rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-[#5B49D6] hover:bg-[#4D3DC2] text-white rounded-lg font-semibold shadow-sm"
                >
                  {isPending ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: PAUSE / CLOSE TRANSITION                           */}
      {/* ======================================================== */}
      {transitionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-[#E6E8F0] p-6 space-y-4 animate-in fade-in-50 zoom-in-95 text-xs">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  transitionType === 'PAUSE'
                    ? 'bg-[#FEF3DC] text-[#F59E0B]'
                    : 'bg-red-50 text-red-600'
                }`}
              >
                {transitionType === 'PAUSE' ? <PauseCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1B2236]">
                  {transitionType === 'PAUSE' ? 'Pause Job Mandate' : 'Close Job Mandate'}
                </h3>
                <p className="text-[#6B7490]">{job.code} — {job.title}</p>
              </div>
            </div>

            {transitionType === 'PAUSE' && (
              <div>
                <label className="block font-semibold text-[#1B2236] mb-1">
                  Hold Reason <span className="text-red-500">*</span>
                </label>
                <select
                  value={transitionReason}
                  onChange={(e) => setTransitionReason(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs font-medium focus:border-[#5B49D6] focus:outline-none"
                >
                  <option value="CLIENT_HOLD">Client Hiring Freeze</option>
                  <option value="BUDGET_REVIEW">Commercial / Budget Review</option>
                  <option value="PRIORITY_SHIFT">Priority Shift</option>
                  <option value="OTHER">Other Reason</option>
                </select>
              </div>
            )}

            {transitionType === 'CLOSE' && (
              <div>
                <label className="block font-semibold text-[#1B2236] mb-1">
                  Closing Reason <span className="text-red-500">*</span>
                </label>
                <select
                  value={transitionReason}
                  onChange={(e) => setTransitionReason(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs font-medium focus:border-[#5B49D6] focus:outline-none"
                >
                  <option value="POSITION_FILLED">Position Filled (Success)</option>
                  <option value="BUDGET_CANCELLED">Budget Cancelled</option>
                  <option value="ROLE_WITHDRAWN">Role Withdrawn by Client</option>
                  <option value="HIRED_INTERNALLY">Client Hired Internally</option>
                  <option value="OTHER">Other Reason</option>
                </select>
              </div>
            )}

            <div>
              <label className="block font-semibold text-[#1B2236] mb-1">
                Note / Internal Context
              </label>
              <textarea
                rows={3}
                placeholder="Explanation recorded in the immutable lifecycle audit..."
                value={transitionNote}
                onChange={(e) => setTransitionNote(e.target.value)}
                className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs focus:border-[#5B49D6] focus:outline-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setTransitionType(null)}
                className="px-3.5 py-2 border border-[#E6E8F0] text-[#6B7490] hover:bg-[#F6F7FB] rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirmTransition}
                className={`px-4 py-2 text-white rounded-lg font-semibold transition-all shadow-sm ${
                  transitionType === 'PAUSE'
                    ? 'bg-[#F59E0B] hover:bg-[#D97706]'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isPending ? 'Confirming...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
