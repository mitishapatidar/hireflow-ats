'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Building2,
  Search,
  Plus,
  Users,
  Calendar,
  Briefcase,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Archive,
  RefreshCw,
  Edit2,
  AlertCircle,
  X,
} from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import {
  ClientSummaryDTO,
  ClientCRMStatsDTO,
  ClientStatus,
  AuthUser,
  UserRole,
} from '@hireflow/shared';
import {
  createClientAction,
  updateClientAction,
  archiveClientAction,
  restoreClientAction,
} from '@/actions/clients';

interface ClientsClientViewProps {
  initialClients: ClientSummaryDTO[];
  initialTotal: number;
  initialPage: number;
  initialLimit: number;
  initialTotalPages: number;
  stats: ClientCRMStatsDTO;
  availableOwners: Array<{ id: string; name: string; role: string }>;
  currentUser: AuthUser | null;
  activeFilters: {
    search: string;
    status: string;
    relationshipOwnerId: string;
    isArchived: boolean | 'ALL';
    page: number;
  };
}

export function ClientsClientView({
  initialClients,
  initialTotal,
  initialPage,
  initialTotalPages,
  stats,
  availableOwners,
  currentUser,
  activeFilters,
}: ClientsClientViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  // Filter states
  const [search, setSearch] = useState(activeFilters.search);
  const [status, setStatus] = useState(activeFilters.status);
  const [ownerId, setOwnerId] = useState(activeFilters.relationshipOwnerId);
  const [archiveFilter, setArchiveFilter] = useState<'ACTIVE' | 'ARCHIVED' | 'ALL'>(
    activeFilters.isArchived === 'ALL'
      ? 'ALL'
      : activeFilters.isArchived
      ? 'ARCHIVED'
      : 'ACTIVE'
  );

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editClient, setEditClient] = useState<ClientSummaryDTO | null>(null);
  const [archiveClientTarget, setArchiveClientTarget] = useState<ClientSummaryDTO | null>(null);
  const [restoreClientTarget, setRestoreClientTarget] = useState<ClientSummaryDTO | null>(null);
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);

  // Add Client Form state
  const [formData, setFormData] = useState({
    legalName: '',
    industry: '',
    website: '',
    location: '',
    relationshipOwnerId: currentUser?.id || (availableOwners[0]?.id ?? ''),
    status: 'ACTIVE' as ClientStatus,
    nextStep: '',
    // Optional primary contact
    addPrimaryContact: false,
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    contactDesignation: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    legalName: '',
    industry: '',
    website: '',
    location: '',
    relationshipOwnerId: '',
    status: 'ACTIVE' as ClientStatus,
    nextStep: '',
  });
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Archive reason state
  const [archiveReason, setArchiveReason] = useState('');
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [archiveSubmitting, setArchiveSubmitting] = useState(false);

  // Helper to push URL updates
  function applyFilters(updates: {
    search?: string;
    status?: string;
    relationshipOwnerId?: string;
    archiveFilter?: 'ACTIVE' | 'ARCHIVED' | 'ALL';
    page?: number;
  }) {
    const params = new URLSearchParams();

    const merged = {
      search,
      status,
      relationshipOwnerId: ownerId,
      archiveFilter,
      page: 1,
      ...updates,
    };

    if (merged.search.trim()) params.set('search', merged.search.trim());
    if (merged.status && merged.status !== 'ALL') params.set('status', merged.status);
    if (merged.relationshipOwnerId) params.set('ownerId', merged.relationshipOwnerId);

    if (merged.archiveFilter === 'ARCHIVED') {
      params.set('isArchived', 'true');
    } else if (merged.archiveFilter === 'ALL') {
      params.set('isArchived', 'ALL');
    }

    if (merged.page && merged.page > 1) {
      params.set('page', merged.page.toString());
    }

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handleResetFilters() {
    setSearch('');
    setStatus('ALL');
    setOwnerId('');
    setArchiveFilter('ACTIVE');
    startTransition(() => {
      router.push(pathname);
    });
  }

  // Handle Add Client Submit
  async function handleAddClientSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!formData.legalName.trim()) {
      setFormError('Company legal name is required');
      return;
    }

    setFormSubmitting(true);
    try {
      const payload: Parameters<typeof createClientAction>[0] = {
        legalName: formData.legalName.trim(),
        industry: formData.industry.trim() || undefined,
        website: formData.website.trim() || undefined,
        location: formData.location.trim() || undefined,
        relationshipOwnerId: formData.relationshipOwnerId || undefined,
        status: formData.status,
        nextStep: formData.nextStep.trim() || undefined,
      };

      if (formData.addPrimaryContact && formData.contactName.trim() && formData.contactEmail.trim()) {
        payload.primaryContact = {
          name: formData.contactName.trim(),
          email: formData.contactEmail.trim(),
          phone: formData.contactPhone.trim() || undefined,
          designation: formData.contactDesignation.trim() || undefined,
          contactType: 'PRIMARY',
          isPrimary: true,
        };
      }

      const res = await createClientAction(payload);
      if (!res.success) {
        setFormError(res.error || 'Failed to create client');
        setFormSubmitting(false);
        return;
      }

      setShowAddModal(false);
      // Reset form
      setFormData({
        legalName: '',
        industry: '',
        website: '',
        location: '',
        relationshipOwnerId: currentUser?.id || (availableOwners[0]?.id ?? ''),
        status: 'ACTIVE',
        nextStep: '',
        addPrimaryContact: false,
        contactName: '',
        contactEmail: '',
        contactPhone: '',
        contactDesignation: '',
      });

      // Redirect to newly created client record
      if (res.client?.id) {
        router.push(`/clients/${res.client.id}`);
      } else {
        router.refresh();
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setFormSubmitting(false);
    }
  }

  // Handle Edit Client
  function openEditModal(client: ClientSummaryDTO) {
    setEditClient(client);
    setEditFormData({
      legalName: client.legalName,
      industry: client.industry || '',
      website: client.website || '',
      location: client.location || '',
      relationshipOwnerId: client.relationshipOwner?.id || '',
      status: client.status,
      nextStep: client.nextStep || '',
    });
    setEditFormError(null);
    setActionMenuOpenId(null);
  }

  async function handleEditClientSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editClient) return;
    setEditFormError(null);

    setEditSubmitting(true);
    try {
      const res = await updateClientAction(editClient.id, {
        legalName: editFormData.legalName.trim() || undefined,
        industry: editFormData.industry.trim() || null,
        website: editFormData.website.trim() || null,
        location: editFormData.location.trim() || null,
        relationshipOwnerId: editFormData.relationshipOwnerId || null,
        status: editFormData.status,
        nextStep: editFormData.nextStep.trim() || null,
      });

      if (!res.success) {
        setEditFormError(res.error || 'Failed to update client');
        setEditSubmitting(false);
        return;
      }

      setEditClient(null);
      router.refresh();
    } catch (err: unknown) {
      setEditFormError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setEditSubmitting(false);
    }
  }

  // Handle Archive Client
  async function handleArchiveSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!archiveClientTarget) return;
    setArchiveError(null);

    if (archiveReason.trim().length < 3) {
      setArchiveError('Archive reason must be at least 3 characters long');
      return;
    }

    setArchiveSubmitting(true);
    try {
      const res = await archiveClientAction(archiveClientTarget.id, archiveReason.trim());

      if (!res.success) {
        setArchiveError(res.error || 'Failed to archive client');
        setArchiveSubmitting(false);
        return;
      }

      setArchiveClientTarget(null);
      setArchiveReason('');
      router.refresh();
    } catch (err: unknown) {
      setArchiveError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setArchiveSubmitting(false);
    }
  }

  // Handle Restore Client
  async function handleRestoreSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!restoreClientTarget) return;

    setArchiveSubmitting(true);
    try {
      const res = await restoreClientAction(restoreClientTarget.id);
      if (!res.success) {
        alert(res.error || 'Failed to restore client');
        setArchiveSubmitting(false);
        return;
      }

      setRestoreClientTarget(null);
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setArchiveSubmitting(false);
    }
  }

  const hasActiveFilters =
    search.trim() !== '' ||
    status !== 'ALL' ||
    ownerId !== '' ||
    archiveFilter !== 'ACTIVE';

  const canManageClients =
    currentUser?.role === UserRole.ADMIN ||
    currentUser?.role === UserRole.MANAGER ||
    currentUser?.role === UserRole.RECRUITER;

  const isAdmin = currentUser?.role === UserRole.ADMIN;

  return (
    <div className="space-y-6">
      {/* 1. Page Header with Title and Add Client Button */}
      <PageHeader
        title="Clients CRM"
        subtitle="Manage client master records, hiring managers, commercial relationships, and active mandates."
        breadcrumbs={[{ label: 'Clients CRM' }]}
        actions={
          canManageClients && (
            <button
              onClick={() => setShowAddModal(true)}
              data-testid="add-client-btn"
              className="px-4 py-2 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Client</span>
            </button>
          )
        }
      />

      {/* 2. Live Statistics Cards (Figma Frame 09) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Active Clients */}
        <div
          data-testid="stat-active-clients"
          className="bg-white rounded-xl border border-[#E6E8F0] p-4 flex items-center justify-between shadow-xs"
        >
          <div>
            <div className="text-xs font-medium text-[#6B7490]">Active Clients</div>
            <div className="text-2xl font-bold text-[#1B2236] mt-1">{stats.activeCount}</div>
            <div className="text-[11px] text-[#12B76A] mt-0.5 flex items-center gap-1">
              <span>●</span> In active recruitment
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#EEEBFB] text-[#5B49D6] flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Prospects */}
        <div
          data-testid="stat-prospects"
          className="bg-white rounded-xl border border-[#E6E8F0] p-4 flex items-center justify-between shadow-xs"
        >
          <div>
            <div className="text-xs font-medium text-[#6B7490]">Prospects</div>
            <div className="text-2xl font-bold text-[#1B2236] mt-1">{stats.prospectCount}</div>
            <div className="text-[11px] text-[#0284C7] mt-0.5 flex items-center gap-1">
              <span>●</span> Business development
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#0284C7] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Scheduled Meetings in 30 days */}
        <div
          data-testid="stat-meetings"
          className="bg-white rounded-xl border border-[#E6E8F0] p-4 flex items-center justify-between shadow-xs"
        >
          <div>
            <div className="text-xs font-medium text-[#6B7490]">Scheduled Meetings</div>
            <div className="text-2xl font-bold text-[#1B2236] mt-1">{stats.meetingsCount}</div>
            <div className="text-[11px] text-[#6B7490] mt-0.5 flex items-center gap-1">
              Next 30 days
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. Search and Filters Toolbar */}
      <div className="bg-white rounded-xl border border-[#E6E8F0] p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7490]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  applyFilters({ search });
                }
              }}
              placeholder="Search by company name, client code (CL-1001), industry, contact..."
              data-testid="clients-search-input"
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[#E6E8F0] focus:outline-hidden focus:border-[#5B49D6] focus:ring-1 focus:ring-[#5B49D6] transition-all text-[#1B2236] placeholder-[#6B7490]"
            />
          </div>

          {/* Status Filter */}
          <div className="w-full md:w-44">
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                applyFilters({ status: e.target.value });
              }}
              data-testid="clients-status-filter"
              aria-label="Filter by client status"
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0] focus:outline-hidden focus:border-[#5B49D6] text-[#1B2236] bg-white cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="PROSPECT">Prospect</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          {/* Relationship Owner Filter */}
          <div className="w-full md:w-52">
            <select
              value={ownerId}
              onChange={(e) => {
                setOwnerId(e.target.value);
                applyFilters({ relationshipOwnerId: e.target.value });
              }}
              data-testid="clients-owner-filter"
              aria-label="Filter by relationship owner"
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0] focus:outline-hidden focus:border-[#5B49D6] text-[#1B2236] bg-white cursor-pointer"
            >
              <option value="">All Relationship Owners</option>
              {availableOwners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name} ({owner.role})
                </option>
              ))}
            </select>
          </div>

          {/* Archive Filter Toggle */}
          <div className="w-full md:w-36">
            <select
              value={archiveFilter}
              onChange={(e) => {
                const val = e.target.value as 'ACTIVE' | 'ARCHIVED' | 'ALL';
                setArchiveFilter(val);
                applyFilters({ archiveFilter: val });
              }}
              data-testid="clients-archive-filter"
              aria-label="Filter by archive state"
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0] focus:outline-hidden focus:border-[#5B49D6] text-[#1B2236] bg-white cursor-pointer"
            >
              <option value="ACTIVE">Active Records</option>
              <option value="ARCHIVED">Archived Records</option>
              <option value="ALL">All Records</option>
            </select>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => applyFilters({ search })}
              disabled={isPending}
              data-testid="clients-filter-search-btn"
              className="px-3.5 py-2 bg-[#5B49D6] text-white text-xs font-semibold rounded-lg hover:bg-[#5B49D6]/90 transition-all cursor-pointer shrink-0"
            >
              Search
            </button>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                data-testid="clients-filter-reset-btn"
                className="px-3 py-2 bg-slate-100 text-[#6B7490] hover:text-[#1B2236] text-xs font-medium rounded-lg transition-all cursor-pointer shrink-0"
                title="Reset filters"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Filter Summary & Results Counter */}
        <div className="flex items-center justify-between text-xs text-[#6B7490] pt-2 border-t border-[#E6E8F0]/60">
          <div>
            Showing <strong className="text-[#1B2236]">{initialClients.length}</strong> of{' '}
            <strong className="text-[#1B2236]">{initialTotal}</strong> clients
            {isPending && <span className="ml-2 text-[#5B49D6] animate-pulse">Updating...</span>}
          </div>
          {archiveFilter === 'ARCHIVED' && (
            <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-sm font-medium">
              <Archive className="w-3 h-3" />
              <span>Viewing archived clients</span>
            </div>
          )}
        </div>
      </div>

      {/* 4. Clients Data Table */}
      <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" data-testid="clients-table">
            <thead>
              <tr className="bg-[#F8F9FD] border-b border-[#E6E8F0] text-[11px] font-bold text-[#6B7490] uppercase tracking-wider">
                <th className="py-3 px-4">Company & Industry</th>
                <th className="py-3 px-4">Primary Contact</th>
                <th className="py-3 px-4">Open Jobs</th>
                <th className="py-3 px-4">Relationship Owner</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Next Step</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E8F0] text-xs text-[#1B2236]">
              {initialClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#6B7490]">
                    <div className="max-w-xs mx-auto space-y-3">
                      <div className="w-10 h-10 rounded-full bg-[#EEEBFB] text-[#5B49D6] mx-auto flex items-center justify-center">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="font-semibold text-sm text-[#1B2236]">No clients found</div>
                      <p className="text-xs text-[#6B7490]">
                        {hasActiveFilters
                          ? 'No client accounts match your active search or filter criteria.'
                          : 'No clients are registered yet for Aureva Capital.'}
                      </p>
                      {hasActiveFilters ? (
                        <button
                          onClick={handleResetFilters}
                          className="px-3 py-1.5 bg-slate-100 text-[#1B2236] rounded-md text-xs font-semibold hover:bg-slate-200"
                        >
                          Clear Filters
                        </button>
                      ) : (
                        canManageClients && (
                          <button
                            onClick={() => setShowAddModal(true)}
                            className="px-3.5 py-1.5 bg-[#5B49D6] text-white rounded-md text-xs font-semibold hover:bg-[#5B49D6]/90"
                          >
                            Add First Client
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                initialClients.map((client) => {
                  const isArchived = client.isArchived;

                  return (
                    <tr
                      key={client.id}
                      data-testid={`client-row-${client.code}`}
                      className={`hover:bg-[#F8F9FD]/60 transition-colors ${
                        isArchived ? 'bg-slate-50/70 text-slate-500' : ''
                      }`}
                    >
                      {/* Company & Industry */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-[#EEEBFB] text-[#5B49D6] flex items-center justify-center shrink-0 font-bold text-xs">
                            {client.legalName.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <Link
                                href={`/clients/${client.id}`}
                                className="font-bold text-[#1B2236] hover:text-[#5B49D6] transition-colors"
                              >
                                {client.legalName}
                              </Link>
                              <span className="px-1.5 py-0.5 rounded-sm bg-slate-100 text-[10px] font-mono font-medium text-[#6B7490]">
                                {client.code}
                              </span>
                              {client.website && (
                                <a
                                  href={client.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#6B7490] hover:text-[#5B49D6]"
                                  title={client.website}
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                            <div className="text-[11px] text-[#6B7490] flex items-center gap-2 mt-0.5">
                              <span>{client.industry || 'General Industry'}</span>
                              {client.location && (
                                <>
                                  <span>•</span>
                                  <span>{client.location}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Primary Contact */}
                      <td className="py-3.5 px-4">
                        {client.primaryContact ? (
                          <div>
                            <div className="font-medium text-[#1B2236]">
                              {client.primaryContact.name}
                            </div>
                            <div className="text-[11px] text-[#6B7490]">
                              {client.primaryContact.designation || client.primaryContact.email}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[#6B7490] italic text-[11px]">No contact set</span>
                        )}
                      </td>

                      {/* Open Jobs */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#EEEBFB] text-[#5B49D6]">
                          <Briefcase className="w-3 h-3" />
                          <span>{client.openJobsCount}</span>
                        </span>
                      </td>

                      {/* Relationship Owner */}
                      <td className="py-3.5 px-4">
                        {client.relationshipOwner ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-slate-200 text-[#1B2236] text-[10px] flex items-center justify-center font-bold">
                              {client.relationshipOwner.name.charAt(0)}
                            </div>
                            <span className="font-medium text-[#1B2236]">
                              {client.relationshipOwner.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[#6B7490] italic text-[11px]">Unassigned</span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4">
                        {isArchived ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200 text-slate-700">
                            ARCHIVED
                          </span>
                        ) : client.status === 'ACTIVE' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-[#12B76A] border border-emerald-200/50">
                            ACTIVE
                          </span>
                        ) : client.status === 'PROSPECT' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-[#0284C7] border border-sky-200/50">
                            PROSPECT
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-[#6B7490]">
                            INACTIVE
                          </span>
                        )}
                      </td>

                      {/* Next Step */}
                      <td className="py-3.5 px-4">
                        <span className="text-[11px] text-[#6B7490] max-w-xs truncate block" title={client.nextStep || ''}>
                          {client.nextStep || '—'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="relative inline-flex items-center gap-1 justify-end">
                          <Link
                            href={`/clients/${client.id}`}
                            data-testid={`view-client-btn-${client.code}`}
                            className="px-2.5 py-1 text-xs font-semibold text-[#5B49D6] hover:bg-[#EEEBFB] rounded-md transition-colors"
                          >
                            View
                          </Link>

                          {canManageClients && (
                            <div className="relative">
                              <button
                                onClick={() =>
                                  setActionMenuOpenId(actionMenuOpenId === client.id ? null : client.id)
                                }
                                data-testid={`client-action-menu-trigger-${client.code}`}
                                className="p-1 rounded-md text-[#6B7490] hover:text-[#1B2236] hover:bg-slate-100 transition-colors"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {actionMenuOpenId === client.id && (
                                <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg border border-[#E6E8F0] py-1 z-20 text-left">
                                  <button
                                    onClick={() => openEditModal(client)}
                                    className="w-full px-3 py-1.5 text-xs text-[#1B2236] hover:bg-slate-50 flex items-center gap-2"
                                  >
                                    <Edit2 className="w-3.5 h-3.5 text-[#6B7490]" />
                                    <span>Edit Client</span>
                                  </button>

                                  {isAdmin && (
                                    <>
                                      <div className="h-px bg-[#E6E8F0] my-1" />
                                      {client.isArchived ? (
                                        <button
                                          onClick={() => {
                                            setRestoreClientTarget(client);
                                            setActionMenuOpenId(null);
                                          }}
                                          className="w-full px-3 py-1.5 text-xs text-[#12B76A] hover:bg-emerald-50 flex items-center gap-2"
                                        >
                                          <RefreshCw className="w-3.5 h-3.5" />
                                          <span>Restore</span>
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => {
                                            setArchiveClientTarget(client);
                                            setActionMenuOpenId(null);
                                            setArchiveReason('');
                                            setArchiveError(null);
                                          }}
                                          className="w-full px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                                        >
                                          <Archive className="w-3.5 h-3.5" />
                                          <span>Archive</span>
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {initialTotalPages > 1 && (
          <div className="px-4 py-3 border-t border-[#E6E8F0] bg-[#F8F9FD]/60 flex items-center justify-between text-xs">
            <div className="text-[#6B7490]">
              Page <strong className="text-[#1B2236]">{initialPage}</strong> of{' '}
              <strong className="text-[#1B2236]">{initialTotalPages}</strong>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => applyFilters({ page: initialPage - 1 })}
                disabled={initialPage <= 1 || isPending}
                className="px-2.5 py-1 border border-[#E6E8F0] rounded-md text-[#1B2236] bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <button
                onClick={() => applyFilters({ page: initialPage + 1 })}
                disabled={initialPage >= initialTotalPages || isPending}
                className="px-2.5 py-1 border border-[#E6E8F0] rounded-md text-[#1B2236] bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. ADD CLIENT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div
            data-testid="add-client-modal"
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#E6E8F0] max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E6E8F0]">
              <div>
                <h3 className="text-base font-bold text-[#1B2236]">Add Client Record</h3>
                <p className="text-xs text-[#6B7490] mt-0.5">
                  Register a new client company into Aureva Capital ATS.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#6B7490] hover:text-[#1B2236] p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddClientSubmit} className="mt-4 space-y-4">
              {/* Company Legal Name */}
              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                  Company Legal Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.legalName}
                  onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                  placeholder="e.g. Acme Technologies Pvt Ltd"
                  data-testid="input-client-legal-name"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0] focus:outline-hidden focus:border-[#5B49D6]"
                />
              </div>

              {/* Industry & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                    Industry / Sector
                  </label>
                  <input
                    type="text"
                    value={formData.industry}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    placeholder="e.g. SaaS / AI"
                    data-testid="input-client-industry"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0] focus:outline-hidden focus:border-[#5B49D6]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g. Bengaluru, India"
                    data-testid="input-client-location"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0] focus:outline-hidden focus:border-[#5B49D6]"
                  />
                </div>
              </div>

              {/* Website */}
              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                  Website URL
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://example.com"
                  data-testid="input-client-website"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0] focus:outline-hidden focus:border-[#5B49D6]"
                />
              </div>

              {/* Relationship Owner & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                    Relationship Owner
                  </label>
                  <select
                    value={formData.relationshipOwnerId}
                    onChange={(e) => setFormData({ ...formData, relationshipOwnerId: e.target.value })}
                    data-testid="select-client-owner"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0] focus:outline-hidden focus:border-[#5B49D6] bg-white"
                  >
                    {availableOwners.map((owner) => (
                      <option key={owner.id} value={owner.id}>
                        {owner.name} ({owner.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as ClientStatus })}
                    data-testid="select-client-status"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0] focus:outline-hidden focus:border-[#5B49D6] bg-white"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PROSPECT">PROSPECT</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              {/* Next Step */}
              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                  Next Step / Immediate Action
                </label>
                <input
                  type="text"
                  value={formData.nextStep}
                  onChange={(e) => setFormData({ ...formData, nextStep: e.target.value })}
                  placeholder="e.g. Schedule discovery call with VP Eng"
                  data-testid="input-client-next-step"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0] focus:outline-hidden focus:border-[#5B49D6]"
                />
              </div>

              {/* Optional Primary Contact Accordion */}
              <div className="pt-2 border-t border-[#E6E8F0]">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#1B2236]">
                  <input
                    type="checkbox"
                    checked={formData.addPrimaryContact}
                    onChange={(e) => setFormData({ ...formData, addPrimaryContact: e.target.checked })}
                    className="rounded-sm border-gray-300 text-[#5B49D6] focus:ring-[#5B49D6]"
                  />
                  <span>Add Primary Contact now</span>
                </label>

                {formData.addPrimaryContact && (
                  <div className="mt-3 p-3 bg-slate-50 rounded-lg space-y-3 border border-[#E6E8F0]">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#1B2236] mb-1">
                        Contact Full Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.contactName}
                        onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                        placeholder="e.g. Priya Sharma"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-[#E6E8F0] bg-white"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#1B2236] mb-1">
                          Email <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="email"
                          value={formData.contactEmail}
                          onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                          placeholder="priya@example.com"
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-[#E6E8F0] bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#1B2236] mb-1">
                          Phone
                        </label>
                        <input
                          type="tel"
                          value={formData.contactPhone}
                          onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                          placeholder="+91 98765 43210"
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-[#E6E8F0] bg-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#1B2236] mb-1">
                        Designation / Role
                      </label>
                      <input
                        type="text"
                        value={formData.contactDesignation}
                        onChange={(e) => setFormData({ ...formData, contactDesignation: e.target.value })}
                        placeholder="e.g. VP Engineering / Head of Talent"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-[#E6E8F0] bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-[#E6E8F0] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#6B7490] hover:text-[#1B2236]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  data-testid="submit-create-client-btn"
                  className="px-4 py-2 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 disabled:opacity-50 cursor-pointer"
                >
                  {formSubmitting ? 'Creating Client...' : 'Create Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. EDIT CLIENT MODAL */}
      {editClient && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#E6E8F0]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6E8F0]">
              <div>
                <h3 className="text-base font-bold text-[#1B2236]">Edit Client Details</h3>
                <p className="text-xs text-[#6B7490] mt-0.5">
                  Update profile for {editClient.legalName} ({editClient.code})
                </p>
              </div>
              <button
                onClick={() => setEditClient(null)}
                className="text-[#6B7490] hover:text-[#1B2236] p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editFormError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{editFormError}</span>
              </div>
            )}

            <form onSubmit={handleEditClientSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                  Company Legal Name
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.legalName}
                  onChange={(e) => setEditFormData({ ...editFormData, legalName: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0] focus:outline-hidden focus:border-[#5B49D6]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                    Industry / Sector
                  </label>
                  <input
                    type="text"
                    value={editFormData.industry}
                    onChange={(e) => setEditFormData({ ...editFormData, industry: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0] focus:outline-hidden focus:border-[#5B49D6]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={editFormData.location}
                    onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0] focus:outline-hidden focus:border-[#5B49D6]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                  Website URL
                </label>
                <input
                  type="url"
                  value={editFormData.website}
                  onChange={(e) => setEditFormData({ ...editFormData, website: e.target.value })}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0] focus:outline-hidden focus:border-[#5B49D6]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                    Relationship Owner
                  </label>
                  <select
                    value={editFormData.relationshipOwnerId}
                    onChange={(e) => setEditFormData({ ...editFormData, relationshipOwnerId: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0] focus:outline-hidden focus:border-[#5B49D6] bg-white"
                  >
                    <option value="">Unassigned</option>
                    {availableOwners.map((owner) => (
                      <option key={owner.id} value={owner.id}>
                        {owner.name} ({owner.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                    Status
                  </label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as ClientStatus })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0] focus:outline-hidden focus:border-[#5B49D6] bg-white"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PROSPECT">PROSPECT</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                  Next Step
                </label>
                <input
                  type="text"
                  value={editFormData.nextStep}
                  onChange={(e) => setEditFormData({ ...editFormData, nextStep: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0] focus:outline-hidden focus:border-[#5B49D6]"
                />
              </div>

              <div className="pt-3 border-t border-[#E6E8F0] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditClient(null)}
                  className="px-4 py-2 text-xs font-semibold text-[#6B7490] hover:text-[#1B2236]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-4 py-2 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 disabled:opacity-50 cursor-pointer"
                >
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. ARCHIVE MODAL (Mandatory Reason) */}
      {archiveClientTarget && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E6E8F0]">
            <div className="flex items-center gap-3 text-rose-600 mb-2">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1B2236]">Archive Client Record</h3>
                <p className="text-xs text-[#6B7490]">
                  {archiveClientTarget.legalName} ({archiveClientTarget.code})
                </p>
              </div>
            </div>

            <p className="text-xs text-[#6B7490] mt-3">
              This client will be soft-archived. Associated open jobs and historical placements remain intact in accordance with ATS compliance.
            </p>

            {archiveError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                {archiveError}
              </div>
            )}

            <form onSubmit={handleArchiveSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                  Reason for Archival <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  placeholder="e.g. Account relationship terminated due to client merger"
                  data-testid="archive-reason-input"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0] focus:outline-hidden focus:border-rose-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setArchiveClientTarget(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-[#6B7490] hover:text-[#1B2236]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={archiveSubmitting}
                  data-testid="confirm-archive-btn"
                  className="px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                >
                  {archiveSubmitting ? 'Archiving...' : 'Confirm Archive'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. RESTORE MODAL */}
      {restoreClientTarget && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E6E8F0]">
            <div className="flex items-center gap-3 text-emerald-600 mb-2">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1B2236]">Restore Client Record</h3>
                <p className="text-xs text-[#6B7490]">
                  {restoreClientTarget.legalName} ({restoreClientTarget.code})
                </p>
              </div>
            </div>

            <p className="text-xs text-[#6B7490] mt-3">
              Restore this client record back to active CRM status?
            </p>

            <form onSubmit={handleRestoreSubmit} className="mt-4 pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRestoreClientTarget(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-[#6B7490] hover:text-[#1B2236]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={archiveSubmitting}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
              >
                {archiveSubmitting ? 'Restoring...' : 'Restore Client'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
