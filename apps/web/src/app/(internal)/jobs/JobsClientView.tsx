'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '../../../components/layout/PageHeader';
import {
  Briefcase,
  Plus,
  Search,
  Building2,
  MapPin,
  Users,
  Calendar,
  AlertCircle,
  PauseCircle,
  PlayCircle,
  XCircle,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
} from 'lucide-react';
import {
  SerializedJobDto,
  JobStatus,
  EmploymentType,
  UserRole,
} from '@hireflow/shared';
import {
  createJobAction,
  pauseJobAction,
  resumeJobAction,
  closeJobAction,
} from '@/actions/jobs';

interface JobsClientViewProps {
  initialData: {
    jobs: SerializedJobDto[];
    stats: {
      openJobs: number;
      onHoldJobs: number;
      filledThisMonth: number;
      totalJobs: number;
    };
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
    };
  };
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

export function JobsClientView({
  initialData,
  clients,
  recruiters,
  currentUser,
}: JobsClientViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Filter state synced with URL
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [clientFilter, setClientFilter] = useState(searchParams.get('clientId') || '');
  const [ownerFilter, setOwnerFilter] = useState(searchParams.get('ownerId') || '');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Quick Action Modal states (Pause / Close / Resume)
  const [selectedJob, setSelectedJob] = useState<SerializedJobDto | null>(null);
  const [actionType, setActionType] = useState<'PAUSE' | 'RESUME' | 'CLOSE' | null>(null);
  const [actionReason, setActionReason] = useState('CLIENT_HOLD');
  const [actionNote, setActionNote] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // New Job Form State
  const [newJobClientId, setNewJobClientId] = useState('');
  const [newJobContactId, setNewJobContactId] = useState('');
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newJobOpenings, setNewJobOpenings] = useState(1);
  const [newJobEmpType, setNewJobEmpType] = useState<EmploymentType>(EmploymentType.FULL_TIME);
  const [newJobLocation, setNewJobLocation] = useState('');
  const [newJobSalaryMin, setNewJobSalaryMin] = useState<string>('');
  const [newJobSalaryMax, setNewJobSalaryMax] = useState<string>('');
  const [newJobOwnerId, setNewJobOwnerId] = useState(currentUser.id);
  const [newJobDeadline, setNewJobDeadline] = useState('');
  const [newJobDescription, setNewJobDescription] = useState('');
  const [newJobRequirements, setNewJobRequirements] = useState('');

  // Selected client contacts for cascading dropdown
  const selectedClient = clients.find((c) => c.id === newJobClientId);
  const availableContacts = selectedClient?.contacts || [];

  const updateFilters = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, val]) => {
      if (!val) {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    });
    params.set('page', '1');
    startTransition(() => {
      router.push(`/jobs?${params.toString()}`);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ search: search.trim() || null });
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(newPage));
    startTransition(() => {
      router.push(`/jobs?${params.toString()}`);
    });
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!newJobTitle.trim()) {
      setModalError('Job title is required');
      return;
    }
    if (!newJobClientId) {
      setModalError('Please select a client company');
      return;
    }

    const minSal = newJobSalaryMin ? parseFloat(newJobSalaryMin) : undefined;
    const maxSal = newJobSalaryMax ? parseFloat(newJobSalaryMax) : undefined;

    if (minSal != null && maxSal != null && maxSal < minSal) {
      setModalError('Maximum salary must be greater than or equal to minimum salary');
      return;
    }

    startTransition(async () => {
      const res = await createJobAction({
        title: newJobTitle.trim(),
        clientId: newJobClientId,
        hiringManagerContactId: newJobContactId || null,
        ownerId: newJobOwnerId || null,
        openings: Number(newJobOpenings) || 1,
        employmentType: newJobEmpType,
        location: newJobLocation.trim() || null,
        salaryMin: minSal,
        salaryMax: maxSal,
        deadline: newJobDeadline ? new Date(newJobDeadline) : null,
        description: newJobDescription.trim() || null,
        requirements: newJobRequirements.trim() || null,
        assignedRecruiterIds: newJobOwnerId ? [newJobOwnerId] : [],
      });

      if (!res.success || !res.data) {
        setModalError(res.error || 'Failed to create job');
        return;
      }

      setIsAddModalOpen(false);
      resetAddForm();
      router.push(`/jobs/${res.data.id}`);
    });
  };

  const resetAddForm = () => {
    setNewJobTitle('');
    setNewJobClientId('');
    setNewJobContactId('');
    setNewJobOpenings(1);
    setNewJobEmpType(EmploymentType.FULL_TIME);
    setNewJobLocation('');
    setNewJobSalaryMin('');
    setNewJobSalaryMax('');
    setNewJobDeadline('');
    setNewJobDescription('');
    setNewJobRequirements('');
    setModalError(null);
  };

  const handleQuickAction = async () => {
    if (!selectedJob || !actionType) return;
    setActionError(null);

    startTransition(async () => {
      let res: { success: boolean; error?: string };
      if (actionType === 'PAUSE') {
        res = await pauseJobAction(selectedJob.id, actionReason, actionNote);
      } else if (actionType === 'RESUME') {
        res = await resumeJobAction(selectedJob.id, actionNote);
      } else if (actionType === 'CLOSE') {
        res = await closeJobAction(selectedJob.id, actionReason, actionNote, actionNote);
      } else {
        return;
      }

      if (!res.success) {
        setActionError(res.error || 'Action failed');
        return;
      }

      setActionType(null);
      setSelectedJob(null);
      setActionNote('');
      router.refresh();
    });
  };

  const getStatusBadge = (status: JobStatus) => {
    switch (status) {
      case JobStatus.ACTIVE:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E3F6EC] text-[#12B76A]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#12B76A] animate-pulse" />
            Active
          </span>
        );
      case JobStatus.PAUSED:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FEF3DC] text-[#F59E0B]">
            <PauseCircle className="w-3 h-3 text-[#F59E0B]" />
            On Hold
          </span>
        );
      case JobStatus.CLOSED:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F0F2F7] text-[#6B7490]">
            <CheckCircle2 className="w-3 h-3 text-[#6B7490]" />
            Closed
          </span>
        );
      case JobStatus.DRAFT:
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EEEBFB] text-[#5B49D6]">
            Draft
          </span>
        );
    }
  };

  const isClientOrCandidate =
    currentUser.role === UserRole.CLIENT || currentUser.role === UserRole.CANDIDATE;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs"
        subtitle="Manage client mandates, interview pipelines, recruiter ownership, and requisition lifecycles."
        breadcrumbs={[{ label: 'Jobs' }]}
        actions={
          !isClientOrCandidate && (
            <button
              data-testid="create-job-button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-[#5B49D6] hover:bg-[#4D3DC2] text-white rounded-lg text-sm font-semibold transition-all flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Job</span>
            </button>
          )
        }
      />

      {/* Live Statistics Cards (Figma Frame 04) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Open Jobs */}
        <div data-testid="stat-open-jobs" className="bg-white rounded-xl border border-[#E6E8F0] p-4.5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#6B7490]">Open Jobs</p>
            <h3 className="text-2xl font-bold text-[#1B2236] mt-1">
              {initialData.stats.openJobs}
            </h3>
            <p className="text-[11px] text-[#12B76A] font-medium mt-0.5">Active requisitions</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#E3F6EC] text-[#12B76A] flex items-center justify-center">
            <Briefcase className="w-5 h-5" />
          </div>
        </div>

        {/* On Hold */}
        <div data-testid="stat-on-hold" className="bg-white rounded-xl border border-[#E6E8F0] p-4.5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#6B7490]">On Hold</p>
            <h3 className="text-2xl font-bold text-[#1B2236] mt-1">
              {initialData.stats.onHoldJobs}
            </h3>
            <p className="text-[11px] text-[#F59E0B] font-medium mt-0.5">Paused by client</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#FEF3DC] text-[#F59E0B] flex items-center justify-center">
            <PauseCircle className="w-5 h-5" />
          </div>
        </div>

        {/* Filled This Month */}
        <div data-testid="stat-filled-month" className="bg-white rounded-xl border border-[#E6E8F0] p-4.5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#6B7490]">Filled This Month</p>
            <h3 className="text-2xl font-bold text-[#1B2236] mt-1">
              {initialData.stats.filledThisMonth}
            </h3>
            <p className="text-[11px] text-[#5B49D6] font-medium mt-0.5">Current calendar month</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#EEEBFB] text-[#5B49D6] flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Total Mandates */}
        <div data-testid="stat-total-jobs" className="bg-white rounded-xl border border-[#E6E8F0] p-4.5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#6B7490]">Total Mandates</p>
            <h3 className="text-2xl font-bold text-[#1B2236] mt-1">
              {initialData.stats.totalJobs}
            </h3>
            <p className="text-[11px] text-[#6B7490] font-medium mt-0.5">Matching current view</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#F6F7FB] text-[#1B2236] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Controls Bar: Search & Multi-Filters */}
      <div className="bg-white rounded-xl border border-[#E6E8F0] p-4 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7490]" />
          <input
            data-testid="jobs-search-input"
            type="text"
            placeholder="Search by job title, code, client, recruiter, location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-[#F6F7FB] border border-transparent rounded-lg focus:bg-white focus:border-[#5B49D6] focus:outline-none transition-all placeholder:text-[#6B7490]"
          />
        </form>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Filter */}
          <select
            data-testid="jobs-status-filter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              updateFilters({ status: e.target.value || null });
            }}
            className="px-3 py-2 text-xs font-medium bg-white border border-[#E6E8F0] rounded-lg text-[#1B2236] focus:border-[#5B49D6] focus:outline-none cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">On Hold (Paused)</option>
            <option value="CLOSED">Closed</option>
            <option value="DRAFT">Draft</option>
          </select>

          {/* Client Filter */}
          <select
            data-testid="jobs-client-filter"
            value={clientFilter}
            onChange={(e) => {
              setClientFilter(e.target.value);
              updateFilters({ clientId: e.target.value || null });
            }}
            className="px-3 py-2 text-xs font-medium bg-white border border-[#E6E8F0] rounded-lg text-[#1B2236] focus:border-[#5B49D6] focus:outline-none cursor-pointer max-w-[160px] truncate"
          >
            <option value="">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.legalName}
              </option>
            ))}
          </select>

          {/* Recruiter Filter */}
          <select
            data-testid="jobs-owner-filter"
            value={ownerFilter}
            onChange={(e) => {
              setOwnerFilter(e.target.value);
              updateFilters({ ownerId: e.target.value || null });
            }}
            className="px-3 py-2 text-xs font-medium bg-white border border-[#E6E8F0] rounded-lg text-[#1B2236] focus:border-[#5B49D6] focus:outline-none cursor-pointer max-w-[150px] truncate"
          >
            <option value="">All Owners</option>
            {recruiters.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          {/* Reset Filters button if any active */}
          {(search || statusFilter || clientFilter || ownerFilter) && (
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('');
                setClientFilter('');
                setOwnerFilter('');
                updateFilters({ search: null, status: null, clientId: null, ownerId: null });
              }}
              className="px-2.5 py-2 text-xs font-medium text-[#5B49D6] hover:bg-[#EEEBFB] rounded-lg transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Jobs Table */}
      <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table data-testid="jobs-table" className="w-full text-left text-xs">
            <thead className="bg-[#F6F7FB] border-b border-[#E6E8F0] text-[#6B7490] font-semibold">
              <tr>
                <th className="py-3 px-4">Job Title & Code</th>
                <th className="py-3 px-4">Client Company</th>
                <th className="py-3 px-4">Owner / Recruiter</th>
                <th className="py-3 px-4">Location & Type</th>
                <th className="py-3 px-4">Openings & Candidates</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Deadline</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E8F0]">
              {initialData.jobs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#6B7490]">
                    <Briefcase className="w-8 h-8 text-[#6B7490]/40 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-[#1B2236]">No job openings found</p>
                    <p className="text-xs text-[#6B7490] mt-0.5">
                      Try adjusting your search criteria or create a new job requisition.
                    </p>
                  </td>
                </tr>
              ) : (
                initialData.jobs.map((job) => (
                  <tr
                    key={job.id}
                    data-testid={`job-row-${job.code}`}
                    className="hover:bg-[#F6F7FB]/60 transition-colors group cursor-pointer"
                    onClick={() => router.push(`/jobs/${job.id}`)}
                  >
                    {/* Title & Code */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-[#5B49D6] bg-[#EEEBFB] px-1.5 py-0.5 rounded">
                          {job.code}
                        </span>
                        <Link
                          href={`/jobs/${job.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-bold text-[#1B2236] hover:text-[#5B49D6] transition-colors line-clamp-1"
                        >
                          {job.title}
                        </Link>
                      </div>
                    </td>

                    {/* Client Company */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 font-medium text-[#1B2236]">
                        <Building2 className="w-3.5 h-3.5 text-[#6B7490]" />
                        <span>{job.clientName}</span>
                      </div>
                    </td>

                    {/* Owner / Recruiter */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#EEEBFB] text-[#5B49D6] font-bold text-[10px] flex items-center justify-center">
                          {job.ownerName ? job.ownerName.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <span className="text-[#1B2236] font-medium">
                          {job.ownerName || 'Unassigned'}
                        </span>
                      </div>
                    </td>

                    {/* Location & Type */}
                    <td className="py-3.5 px-4 text-[#6B7490]">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#6B7490]" />
                        <span className="truncate max-w-[140px]">
                          {job.location || 'Remote'}
                        </span>
                      </div>
                      <span className="text-[10px] font-medium text-[#6B7490] block mt-0.5 capitalize">
                        {job.employmentType.replace('_', ' ').toLowerCase()}
                      </span>
                    </td>

                    {/* Openings & Candidates */}
                    <td className="py-3.5 px-4">
                      <div className="text-[#1B2236] font-semibold">
                        {job.openings} {job.openings === 1 ? 'Opening' : 'Openings'}
                      </div>
                      <div className="text-[11px] text-[#6B7490] flex items-center gap-1 mt-0.5">
                        <Users className="w-3 h-3 text-[#5B49D6]" />
                        <span>{job.candidateCount ?? 0} in pipeline</span>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4">{getStatusBadge(job.status)}</td>

                    {/* Deadline */}
                    <td className="py-3.5 px-4 text-[#6B7490]">
                      {job.deadline ? (
                        <div className="flex items-center gap-1 font-medium">
                          <Calendar className="w-3 h-3 text-[#6B7490]" />
                          <span>{new Date(job.deadline).toLocaleDateString()}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-[#6B7490]/70">No deadline</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td
                      className="py-3.5 px-4 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/jobs/${job.id}`}
                          className="px-2.5 py-1 text-xs font-semibold text-[#5B49D6] hover:bg-[#EEEBFB] rounded-md transition-colors"
                        >
                          View
                        </Link>

                        {/* Quick Pause / Resume / Close shortcuts */}
                        {!isClientOrCandidate && job.status === JobStatus.ACTIVE && (
                          <button
                            onClick={() => {
                              setSelectedJob(job);
                              setActionType('PAUSE');
                              setActionReason('CLIENT_HOLD');
                            }}
                            title="Put on hold"
                            className="p-1 text-[#6B7490] hover:text-[#F59E0B] hover:bg-[#FEF3DC] rounded transition-colors"
                          >
                            <PauseCircle className="w-4 h-4" />
                          </button>
                        )}

                        {!isClientOrCandidate && job.status === JobStatus.PAUSED && (
                          <button
                            onClick={() => {
                              setSelectedJob(job);
                              setActionType('RESUME');
                            }}
                            title="Resume job"
                            className="p-1 text-[#6B7490] hover:text-[#12B76A] hover:bg-[#E3F6EC] rounded transition-colors"
                          >
                            <PlayCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {initialData.pagination.totalPages > 1 && (
          <div className="p-3.5 bg-white border-t border-[#E6E8F0] flex items-center justify-between text-xs text-[#6B7490]">
            <div>
              Showing{' '}
              <span className="font-semibold text-[#1B2236]">
                {(initialData.pagination.page - 1) * initialData.pagination.limit + 1}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-[#1B2236]">
                {Math.min(
                  initialData.pagination.page * initialData.pagination.limit,
                  initialData.pagination.totalCount
                )}
              </span>{' '}
              of{' '}
              <span className="font-semibold text-[#1B2236]">
                {initialData.pagination.totalCount}
              </span>{' '}
              mandates
            </div>

            <div className="flex items-center gap-1.5">
              <button
                disabled={initialData.pagination.page <= 1}
                onClick={() => handlePageChange(initialData.pagination.page - 1)}
                className="p-1.5 rounded border border-[#E6E8F0] hover:bg-[#F6F7FB] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-medium text-[#1B2236]">
                Page {initialData.pagination.page} of {initialData.pagination.totalPages}
              </span>
              <button
                disabled={initialData.pagination.page >= initialData.pagination.totalPages}
                onClick={() => handlePageChange(initialData.pagination.page + 1)}
                className="p-1.5 rounded border border-[#E6E8F0] hover:bg-[#F6F7FB] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* ADD / CREATE JOB MODAL                                    */}
      {/* ======================================================== */}
      {isAddModalOpen && (
        <div data-testid="create-job-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl border border-[#E6E8F0] max-h-[90vh] flex flex-col my-8 animate-in fade-in-50 zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#E6E8F0] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#EEEBFB] text-[#5B49D6] flex items-center justify-center">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1B2236]">Create New Job Mandate</h3>
                  <p className="text-xs text-[#6B7490]">
                    Auto-generates sequential code (e.g. J-209) and initial interview rounds.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  resetAddForm();
                }}
                className="text-[#6B7490] hover:text-[#1B2236] p-1.5 rounded-lg hover:bg-[#F6F7FB] transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateJob} className="p-6 overflow-y-auto space-y-4 text-xs">
              {modalError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block font-semibold text-[#1B2236] mb-1">
                  Job Title <span className="text-red-500">*</span>
                </label>
                <input
                  data-testid="job-input-title"
                  type="text"
                  required
                  placeholder="e.g. Senior Backend Engineer (Node/Go)"
                  value={newJobTitle}
                  onChange={(e) => setNewJobTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-sm focus:border-[#5B49D6] focus:outline-none"
                />
              </div>

              {/* Client & Hiring Manager (Cascading) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#1B2236] mb-1">
                    Client Company <span className="text-red-500">*</span>
                  </label>
                  <select
                    data-testid="job-select-client"
                    required
                    value={newJobClientId}
                    onChange={(e) => {
                      setNewJobClientId(e.target.value);
                      setNewJobContactId('');
                    }}
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs font-medium focus:border-[#5B49D6] focus:outline-none cursor-pointer"
                  >
                    <option value="">Select client...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.legalName} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#1B2236] mb-1">
                    Hiring Manager Contact
                  </label>
                  <select
                    disabled={!newJobClientId || availableContacts.length === 0}
                    value={newJobContactId}
                    onChange={(e) => setNewJobContactId(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs font-medium focus:border-[#5B49D6] focus:outline-none cursor-pointer disabled:bg-[#F6F7FB] disabled:text-[#6B7490]"
                  >
                    <option value="">
                      {!newJobClientId
                        ? 'Select client first'
                        : availableContacts.length === 0
                        ? 'No contacts registered'
                        : 'Select contact...'}
                    </option>
                    {availableContacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name} {contact.designation ? `(${contact.designation})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Openings & Employment Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#1B2236] mb-1">
                    Openings <span className="text-red-500">*</span>
                  </label>
                  <input
                    data-testid="job-input-openings"
                    type="number"
                    min={1}
                    required
                    value={newJobOpenings}
                    onChange={(e) => setNewJobOpenings(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs font-medium focus:border-[#5B49D6] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#1B2236] mb-1">
                    Employment Type
                  </label>
                  <select
                    value={newJobEmpType}
                    onChange={(e) => setNewJobEmpType(e.target.value as EmploymentType)}
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs font-medium focus:border-[#5B49D6] focus:outline-none cursor-pointer"
                  >
                    <option value={EmploymentType.FULL_TIME}>Full Time</option>
                    <option value={EmploymentType.CONTRACT}>Contract</option>
                    <option value={EmploymentType.PART_TIME}>Part Time</option>
                    <option value={EmploymentType.INTERNSHIP}>Internship</option>
                  </select>
                </div>
              </div>

              {/* Location & Recruiter Owner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#1B2236] mb-1">Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Bangalore / Remote / Hybrid"
                    value={newJobLocation}
                    onChange={(e) => setNewJobLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs focus:border-[#5B49D6] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#1B2236] mb-1">
                    Lead Recruiter / Owner
                  </label>
                  <select
                    value={newJobOwnerId}
                    onChange={(e) => setNewJobOwnerId(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs font-medium focus:border-[#5B49D6] focus:outline-none cursor-pointer"
                  >
                    {recruiters.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Salary Range */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#1B2236] mb-1">
                    Min Salary (Annual ₹)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 1500000"
                    value={newJobSalaryMin}
                    onChange={(e) => setNewJobSalaryMin(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs focus:border-[#5B49D6] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#1B2236] mb-1">
                    Max Salary (Annual ₹)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 2500000"
                    value={newJobSalaryMax}
                    onChange={(e) => setNewJobSalaryMax(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs focus:border-[#5B49D6] focus:outline-none"
                  />
                </div>
              </div>

              {/* Deadline */}
              <div>
                <label className="block font-semibold text-[#1B2236] mb-1">
                  Target Closing Deadline
                </label>
                <input
                  type="date"
                  value={newJobDeadline}
                  onChange={(e) => setNewJobDeadline(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs focus:border-[#5B49D6] focus:outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block font-semibold text-[#1B2236] mb-1">
                  Role Description & Scope
                </label>
                <textarea
                  rows={3}
                  placeholder="Outline key deliverables, team context, and high-level responsibilities..."
                  value={newJobDescription}
                  onChange={(e) => setNewJobDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs focus:border-[#5B49D6] focus:outline-none"
                />
              </div>

              {/* Requirements */}
              <div>
                <label className="block font-semibold text-[#1B2236] mb-1">
                  Key Requirements & Skills
                </label>
                <textarea
                  rows={3}
                  placeholder="Required tech stack, years of experience, educational qualifications..."
                  value={newJobRequirements}
                  onChange={(e) => setNewJobRequirements(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs focus:border-[#5B49D6] focus:outline-none"
                />
              </div>

              {/* Actions Footer */}
              <div className="pt-4 border-t border-[#E6E8F0] flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    resetAddForm();
                  }}
                  className="px-4 py-2 border border-[#E6E8F0] text-[#6B7490] hover:bg-[#F6F7FB] rounded-lg text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  data-testid="job-submit-create-btn"
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 bg-[#5B49D6] hover:bg-[#4D3DC2] text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  {isPending ? 'Creating Requisition...' : 'Create Job Mandate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* QUICK TRANSITION DIALOG (PAUSE / RESUME / CLOSE)          */}
      {/* ======================================================== */}
      {actionType && selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-[#E6E8F0] p-6 space-y-4 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  actionType === 'PAUSE'
                    ? 'bg-[#FEF3DC] text-[#F59E0B]'
                    : actionType === 'CLOSE'
                    ? 'bg-red-50 text-red-600'
                    : 'bg-[#E3F6EC] text-[#12B76A]'
                }`}
              >
                {actionType === 'PAUSE' && <PauseCircle className="w-5 h-5" />}
                {actionType === 'RESUME' && <PlayCircle className="w-5 h-5" />}
                {actionType === 'CLOSE' && <XCircle className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1B2236]">
                  {actionType === 'PAUSE' && 'Hold Job Requisition'}
                  {actionType === 'RESUME' && 'Resume Job Requisition'}
                  {actionType === 'CLOSE' && 'Close Job Requisition'}
                </h3>
                <p className="text-xs text-[#6B7490] font-mono">{selectedJob.code} — {selectedJob.title}</p>
              </div>
            </div>

            {actionError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                {actionError}
              </div>
            )}

            {actionType === 'PAUSE' && (
              <>
                <p className="text-xs text-[#6B7490]">
                  Paused jobs will reject candidate submissions and show On Hold to team members.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                    Hold Reason <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs font-medium focus:border-[#5B49D6] focus:outline-none"
                  >
                    <option value="CLIENT_HOLD">Client Hiring Freeze</option>
                    <option value="BUDGET_REVIEW">Commercial / Budget Review</option>
                    <option value="PRIORITY_SHIFT">Priority Shift</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </>
            )}

            {actionType === 'CLOSE' && (
              <>
                <p className="text-xs text-[#6B7490]">
                  Closing a job finalizes this mandate and prevents further candidate pipeline activities.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                    Closing Reason <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs font-medium focus:border-[#5B49D6] focus:outline-none"
                  >
                    <option value="POSITION_FILLED">Position Filled (Success)</option>
                    <option value="BUDGET_CANCELLED">Budget Cancelled</option>
                    <option value="ROLE_WITHDRAWN">Role Withdrawn by Client</option>
                    <option value="HIRED_INTERNALLY">Client Hired Internally</option>
                    <option value="OTHER">Other Reason</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                Note / Internal Details
              </label>
              <textarea
                rows={2}
                placeholder="Optional explanation for lifecycle history..."
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs focus:border-[#5B49D6] focus:outline-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setActionType(null);
                  setSelectedJob(null);
                }}
                className="px-3.5 py-2 border border-[#E6E8F0] text-[#6B7490] hover:bg-[#F6F7FB] rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleQuickAction}
                className={`px-4 py-2 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ${
                  actionType === 'PAUSE'
                    ? 'bg-[#F59E0B] hover:bg-[#D97706]'
                    : actionType === 'CLOSE'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-[#12B76A] hover:bg-[#0E9355]'
                }`}
              >
                {isPending ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
