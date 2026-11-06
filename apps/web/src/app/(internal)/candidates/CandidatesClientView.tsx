'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  X,
  FileText,
  Copy,
  Upload,
  Shield,
  Archive,
  ArrowRight,
  UserCheck,
  Building2,
  MapPin,
  Clock,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { formatExperience, SavedView, AuthUser } from '@hireflow/shared';
import { saveCustomViewAction } from '@/actions/candidates';

interface CandidateRow {
  id: string;
  code: string;
  name: string;
  email: string;
  currentTitle?: string | null;
  currentCompany?: string | null;
  experienceYears?: number | null;
  location?: string | null;
  isArchived: boolean;
  updatedAt: string | Date;
  owner?: { id: string; name: string; email: string } | null;
  tags?: Array<{ id: string; name: string }>;
  applications?: Array<{
    status: string;
    job: {
      id: string;
      title: string;
      client: { legalName: string };
    };
  }>;
}

interface CandidatesClientViewProps {
  initialCandidates: CandidateRow[];
  initialTotal: number;
  initialPage: number;
  initialLimit: number;
  initialTotalPages: number;
  savedViews: SavedView[];
  availableJobs: Array<{ id: string; title: string; clientName: string }>;
  availableRecruiters: Array<{ id: string; name: string; role: string }>;
  currentUser: AuthUser | null;
  activeFilters: {
    search: string;
    status: string;
    jobId: string;
    ownerId: string;
    location: string;
    includeArchived: boolean;
  };
}

export function CandidatesClientView({
  initialCandidates,
  initialTotal,
  initialPage,
  initialLimit,
  initialTotalPages,
  savedViews: initialSavedViews,
  availableJobs,
  availableRecruiters,
  currentUser,
  activeFilters,
}: CandidatesClientViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  // Local state for filters
  const [search, setSearch] = useState(activeFilters.search);
  const [status, setStatus] = useState(activeFilters.status);
  const [jobId, setJobId] = useState(activeFilters.jobId);
  const [ownerId, setOwnerId] = useState(activeFilters.ownerId);
  const [location, setLocation] = useState(activeFilters.location);
  const [includeArchived, setIncludeArchived] = useState(activeFilters.includeArchived);
  const [savedViews, setSavedViews] = useState<SavedView[]>(initialSavedViews);
  const [activeViewName, setActiveViewName] = useState<string>('All candidates');

  // Modals state
  const [showSaveViewModal, setShowSaveViewModal] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [featureModalInfo, setFeatureModalInfo] = useState<{ title: string; content: string } | null>(null);

  // Sync state with URL params
  function applyFilters(updates: Partial<typeof activeFilters> & { page?: number }) {
    const currentParams = new URLSearchParams();

    const merged = {
      search,
      status,
      jobId,
      ownerId,
      location,
      includeArchived,
      page: 1,
      ...updates,
    };

    if (merged.search) currentParams.set('search', merged.search);
    if (merged.status) currentParams.set('status', merged.status);
    if (merged.jobId) currentParams.set('jobId', merged.jobId);
    if (merged.ownerId) currentParams.set('ownerId', merged.ownerId);
    if (merged.location) currentParams.set('location', merged.location);
    if (merged.includeArchived) currentParams.set('includeArchived', 'true');
    if (merged.page && merged.page > 1) currentParams.set('page', merged.page.toString());

    startTransition(() => {
      router.push(`${pathname}?${currentParams.toString()}`);
    });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    applyFilters({ search });
  }

  function handleClearFilters() {
    setSearch('');
    setStatus('');
    setJobId('');
    setOwnerId('');
    setLocation('');
    setIncludeArchived(false);
    setActiveViewName('All candidates');
    startTransition(() => {
      router.push(pathname);
    });
  }

  // Built-in saved views
  function applyPresetView(preset: string) {
    setActiveViewName(preset);
    if (preset === 'All candidates') {
      handleClearFilters();
    } else if (preset === 'My Active') {
      setOwnerId(currentUser?.id || '');
      setIncludeArchived(false);
      applyFilters({ ownerId: currentUser?.id || '', includeArchived: false, status: '' });
    } else if (preset === 'In Interview') {
      setStatus('INTERVIEW');
      applyFilters({ status: 'INTERVIEW' });
    } else if (preset === 'Archived') {
      setIncludeArchived(true);
      applyFilters({ includeArchived: true });
    }
  }

  async function handleSaveCustomView() {
    if (!newViewName.trim()) return;
    const res = await saveCustomViewAction(newViewName, {
      search: search || undefined,
      status: status || undefined,
      jobId: jobId || undefined,
      ownerId: ownerId || undefined,
      location: location || undefined,
      tags: [],
      includeArchived,
      page: 1,
      limit: 15,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    });
    if (res.success && res.view) {
      setSavedViews([...savedViews, res.view]);
      setActiveViewName(res.view.name);
      setShowSaveViewModal(false);
      setNewViewName('');
    }
  }

  // Format Stage Badges with tokens
  function renderStageBadge(statusVal?: string | null, isArchived?: boolean) {
    if (isArchived) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F1F3F9] text-[#6B7490]">
          Archived
        </span>
      );
    }
    const val = (statusVal || 'SOURCED').toUpperCase();
    if (val.includes('OFFER') || val.includes('HIRE')) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E3F6EC] text-[#12B76A]">
          {statusVal || 'Offered'}
        </span>
      );
    }
    if (val.includes('INTERVIEW') || val.includes('TECH')) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E5F0FF] text-[#3B82F6]">
          {statusVal || 'Technical interview'}
        </span>
      );
    }
    if (val.includes('REVIEW') || val.includes('SUBMIT')) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FEF3DC] text-[#F59E0B]">
          {statusVal || 'Client review'}
        </span>
      );
    }
    if (val.includes('REJECT')) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FDECEC] text-[#E5484D]">
          {statusVal || 'Rejected'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EEEBFB] text-[#5B49D6]">
        {statusVal || 'Sourced'}
      </span>
    );
  }

  // Format Relative Date
  function formatRelativeDate(dateStr: string | Date) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 3600 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // Get Initials for Avatar
  function getInitials(name: string) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (name.slice(0, 2) || 'CA').toUpperCase();
  }

  const hasActiveFilters = Boolean(search || status || jobId || ownerId || location || includeArchived);

  return (
    <div className="space-y-6">
      {/* 1. Header (Matching Figma Frame 02) */}
      <PageHeader
        title="Candidates"
        subtitle="Find, organise and move talent through your hiring pipeline."
        breadcrumbs={[{ label: 'Candidates' }]}
        actions={
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#6B7490] font-medium hidden sm:inline-block">
              Total <strong className="text-[#1B2236]">{initialTotal}</strong> candidates in pipeline
            </span>
            <Link
              href="/candidates/new"
              className="px-4 py-2 bg-[#5B49D6] hover:bg-[#5B49D6]/90 text-white rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>+ New</span>
            </Link>
          </div>
        }
      />

      {/* 2. Search & Filter Bar (Matching Figma Frame 02) */}
      <div className="bg-white p-4 rounded-xl border border-[#E6E8F0] shadow-xs space-y-3">
        {/* Top row: Search input + Saved views dropdown + Filter reset */}
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Free-text search input */}
          <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-[#6B7490] absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, skill or tag..."
              className="w-full pl-9 pr-8 py-2 text-xs border border-[#E6E8F0] rounded-lg outline-none focus:border-[#5B49D6] focus:ring-1 focus:ring-[#5B49D6] transition-all text-[#1B2236]"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  applyFilters({ search: '' });
                }}
                className="absolute right-2.5 top-2.5 text-[#6B7490] hover:text-[#1B2236]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* Saved Views Pills & Actions */}
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            {['All candidates', 'My Active', 'In Interview', 'Archived'].map((vName) => (
              <button
                key={vName}
                onClick={() => applyPresetView(vName)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  activeViewName === vName
                    ? 'bg-[#EEEBFB] text-[#5B49D6] font-semibold border border-[#5B49D6]/30'
                    : 'bg-[#F6F7FB] text-[#6B7490] hover:bg-[#EEEBFB]/60 hover:text-[#1B2236]'
                }`}
              >
                {vName}
              </button>
            ))}

            {/* Custom Saved Views */}
            {savedViews.map((sv) => (
              <button
                key={sv.id}
                onClick={() => {
                  setActiveViewName(sv.name);
                  setSearch(sv.filters.search || '');
                  setStatus(sv.filters.status || '');
                  setJobId(sv.filters.jobId || '');
                  setOwnerId(sv.filters.ownerId || '');
                  setLocation(sv.filters.location || '');
                  setIncludeArchived(Boolean(sv.filters.includeArchived));
                  applyFilters({
                    search: sv.filters.search || '',
                    status: sv.filters.status || '',
                    jobId: sv.filters.jobId || '',
                    ownerId: sv.filters.ownerId || '',
                    location: sv.filters.location || '',
                    includeArchived: Boolean(sv.filters.includeArchived),
                  });
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  activeViewName === sv.name
                    ? 'bg-[#EEEBFB] text-[#5B49D6] font-semibold border border-[#5B49D6]/30'
                    : 'bg-[#F6F7FB] text-[#6B7490] hover:bg-[#EEEBFB]/60 hover:text-[#1B2236]'
                }`}
              >
                <Bookmark className="w-3 h-3" />
                <span>{sv.name}</span>
              </button>
            ))}

            {hasActiveFilters && (
              <button
                onClick={() => setShowSaveViewModal(true)}
                className="px-2.5 py-1.5 text-xs text-[#5B49D6] hover:bg-[#EEEBFB] rounded-lg font-medium transition-colors flex items-center gap-1 whitespace-nowrap border border-dashed border-[#5B49D6]/40"
              >
                <Plus className="w-3 h-3" />
                <span>Save view</span>
              </button>
            )}

            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="px-2.5 py-1.5 text-xs text-[#E5484D] hover:bg-[#FDECEC] rounded-lg font-medium transition-colors whitespace-nowrap"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Bottom row: Filter Select Dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-[#E6E8F0]/60">
          {/* Status / Stage Filter */}
          <div>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                applyFilters({ status: e.target.value });
              }}
              className="w-full text-xs py-1.5 px-2 bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg text-[#1B2236] outline-none focus:border-[#5B49D6]"
            >
              <option value="">All Stages</option>
              <option value="SOURCED">Sourced</option>
              <option value="SCREENING">Screening</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="CLIENT_REVIEW">Client Review</option>
              <option value="INTERVIEW">Interview</option>
              <option value="OFFERED">Offer</option>
              <option value="HIRED">Hired</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Job Filter */}
          <div>
            <select
              value={jobId}
              onChange={(e) => {
                setJobId(e.target.value);
                applyFilters({ jobId: e.target.value });
              }}
              className="w-full text-xs py-1.5 px-2 bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg text-[#1B2236] outline-none focus:border-[#5B49D6]"
            >
              <option value="">All Jobs</option>
              {availableJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} ({j.clientName})
                </option>
              ))}
            </select>
          </div>

          {/* Recruiter / Owner Filter (Admin / Manager) */}
          {(currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER') && (
            <div>
              <select
                value={ownerId}
                onChange={(e) => {
                  setOwnerId(e.target.value);
                  applyFilters({ ownerId: e.target.value });
                }}
                className="w-full text-xs py-1.5 px-2 bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg text-[#1B2236] outline-none focus:border-[#5B49D6]"
              >
                <option value="">All Recruiters</option>
                {availableRecruiters.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Location Filter */}
          <div>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onBlur={() => applyFilters({ location })}
              placeholder="Filter location..."
              className="w-full text-xs py-1.5 px-2 bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg text-[#1B2236] outline-none focus:border-[#5B49D6]"
            />
          </div>

          {/* Include Archived Checkbox */}
          <div className="flex items-center gap-2 px-1">
            <input
              type="checkbox"
              id="includeArchived"
              checked={includeArchived}
              onChange={(e) => {
                setIncludeArchived(e.target.checked);
                applyFilters({ includeArchived: e.target.checked });
              }}
              className="rounded border-[#E6E8F0] text-[#5B49D6] focus:ring-[#5B49D6] w-3.5 h-3.5"
            />
            <label htmlFor="includeArchived" className="text-xs text-[#6B7490] select-none cursor-pointer">
              Include archived
            </label>
          </div>

          {/* Count pill */}
          <div className="flex items-center justify-end text-xs text-[#6B7490] font-medium">
            Showing {initialCandidates.length} of {initialTotal}
          </div>
        </div>
      </div>

      {/* 3. Candidates Data Table (Matching Figma Frame 02) */}
      <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F7FB] text-[#6B7490] font-semibold uppercase tracking-wider border-b border-[#E6E8F0]">
              <tr>
                <th className="px-5 py-3">Candidate</th>
                <th className="px-5 py-3">Applied for</th>
                <th className="px-5 py-3">Experience</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Stage</th>
                <th className="px-5 py-3">Updated</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E8F0] text-[#1B2236]">
              {initialCandidates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-[#6B7490]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <UserCheck className="w-8 h-8 text-[#6B7490]/40" />
                      <p className="font-semibold text-sm text-[#1B2236]">No candidates found</p>
                      <p className="text-xs text-[#6B7490] max-w-sm">
                        No candidate profiles match your search criteria or permissions scope. Try clearing your filters.
                      </p>
                      {hasActiveFilters && (
                        <button
                          onClick={handleClearFilters}
                          className="mt-2 text-xs text-[#5B49D6] hover:underline font-semibold"
                        >
                          Clear active filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                initialCandidates.map((candidate) => {
                  const latestApp = candidate.applications?.[0];
                  return (
                    <tr
                      key={candidate.id}
                      onClick={() => router.push(`/candidates/${candidate.id}`)}
                      className="hover:bg-[#F6F7FB]/70 transition-colors cursor-pointer group"
                    >
                      {/* Column 1: Candidate (Avatar, Name, Email) */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#EEEBFB] text-[#5B49D6] font-bold text-xs flex items-center justify-center shrink-0 border border-[#5B49D6]/20">
                            {getInitials(candidate.name)}
                          </div>
                          <div>
                            <div className="font-bold text-[#1B2236] group-hover:text-[#5B49D6] transition-colors">
                              {candidate.name}
                            </div>
                            <div className="text-[11px] text-[#6B7490] mt-0.5">{candidate.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Applied for (Job + Client) */}
                      <td className="px-5 py-3.5">
                        {latestApp ? (
                          <div>
                            <div className="font-semibold text-[#1B2236]">{latestApp.job.title}</div>
                            <div className="text-[11px] text-[#6B7490] flex items-center gap-1 mt-0.5">
                              <Building2 className="w-3 h-3 text-[#6B7490]" />
                              <span>{latestApp.job.client.legalName}</span>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="font-medium text-[#1B2236]">{candidate.currentTitle || 'Talent Pool'}</div>
                            <div className="text-[11px] text-[#6B7490]">{candidate.currentCompany || 'Unassigned'}</div>
                          </div>
                        )}
                      </td>

                      {/* Column 3: Experience */}
                      <td className="px-5 py-3.5 text-[#1B2236] font-medium">
                        {formatExperience(candidate.experienceYears ? Number(candidate.experienceYears) : null)}
                      </td>

                      {/* Column 4: Location */}
                      <td className="px-5 py-3.5 text-[#6B7490]">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#6B7490]/70" />
                          <span>{candidate.location || '—'}</span>
                        </div>
                      </td>

                      {/* Column 5: Stage */}
                      <td className="px-5 py-3.5">
                        {renderStageBadge(latestApp?.status, candidate.isArchived)}
                      </td>

                      {/* Column 6: Updated */}
                      <td className="px-5 py-3.5 text-[#6B7490]">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#6B7490]/70" />
                          <span>{formatRelativeDate(candidate.updatedAt)}</span>
                        </div>
                      </td>

                      {/* Column 7: Actions */}
                      <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/candidates/${candidate.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#5B49D6] hover:text-[#5B49D6]/80 hover:underline"
                        >
                          <span>View Profile</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-5 py-3 bg-[#F6F7FB] border-t border-[#E6E8F0] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6B7490]">
          <div>
            Showing <strong className="text-[#1B2236]">{(initialPage - 1) * initialLimit + 1}</strong> to{' '}
            <strong className="text-[#1B2236]">
              {Math.min(initialPage * initialLimit, initialTotal)}
            </strong>{' '}
            of <strong className="text-[#1B2236]">{initialTotal}</strong> candidates
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={initialPage <= 1 || isPending}
              onClick={() => applyFilters({ page: initialPage - 1 })}
              className="px-3 py-1.5 bg-white border border-[#E6E8F0] rounded-lg text-[#1B2236] font-medium hover:bg-[#F6F7FB] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <span className="px-2 font-semibold text-[#1B2236]">
              {initialPage} / {initialTotalPages}
            </span>
            <button
              disabled={initialPage >= initialTotalPages || isPending}
              onClick={() => applyFilters({ page: initialPage + 1 })}
              className="px-3 py-1.5 bg-white border border-[#E6E8F0] rounded-lg text-[#1B2236] font-medium hover:bg-[#F6F7FB] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Bottom Action Chips (Matching Figma Frame 02) */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Duplicate detection chip */}
          <button
            onClick={() =>
              setFeatureModalInfo({
                title: 'Duplicate Detection',
                content:
                  'HireFlow scans candidate submissions across email addresses, mobile numbers, and LinkedIn handles to prevent accidental duplicate entries across mandates. Full merge and duplicate reconciliation workflow arrives in Prompt 20.',
              })
            }
            className="px-3 py-1.5 bg-white hover:bg-[#EEEBFB] border border-[#E6E8F0] hover:border-[#5B49D6]/40 rounded-full text-xs font-medium text-[#1B2236] transition-colors flex items-center gap-1.5"
          >
            <Copy className="w-3.5 h-3.5 text-[#5B49D6]" />
            <span>Duplicate detection</span>
          </button>

          {/* Auto-fill from PDF/Word chip */}
          <button
            onClick={() =>
              setFeatureModalInfo({
                title: 'Auto-fill from PDF/Word',
                content:
                  'Instant automated resume parsing extracts contact details, work history, skills, and education directly from uploaded PDF and DOCX files. Dedicated LLM parser arrives in Prompt 8.',
              })
            }
            className="px-3 py-1.5 bg-white hover:bg-[#EEEBFB] border border-[#E6E8F0] hover:border-[#5B49D6]/40 rounded-full text-xs font-medium text-[#1B2236] transition-colors flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5 text-[#5B49D6]" />
            <span>Auto-fill from PDF/Word</span>
          </button>

          {/* Bulk resume upload chip */}
          <button
            onClick={() =>
              setFeatureModalInfo({
                title: 'Bulk Resume Upload',
                content:
                  'Batch import up to 100 candidate resumes simultaneously with asynchronous background parsing, automatic job mandate matching, and tag assignment. Full batch parser arrives in Prompt 20.',
              })
            }
            className="px-3 py-1.5 bg-white hover:bg-[#EEEBFB] border border-[#E6E8F0] hover:border-[#5B49D6]/40 rounded-full text-xs font-medium text-[#1B2236] transition-colors flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5 text-[#5B49D6]" />
            <span>Bulk resume upload</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Recruiter permissions chip */}
          <Link
            href="/admin/team?tab=permissions"
            className="px-3 py-1.5 bg-white hover:bg-[#EEEBFB] border border-[#E6E8F0] hover:border-[#5B49D6]/40 rounded-full text-xs font-medium text-[#1B2236] transition-colors flex items-center gap-1.5"
          >
            <Shield className="w-3.5 h-3.5 text-[#5B49D6]" />
            <span>Recruiter permissions</span>
          </Link>

          {/* Archive instead of delete chip */}
          <button
            onClick={() =>
              setFeatureModalInfo({
                title: 'Archive Instead of Delete',
                content:
                  'Strict ATS Security Commandment: Candidate records, audit logs, and applications are never hard deleted. Soft archiving preserves compliance audit trails while hiding candidates from active pipelines.',
              })
            }
            className="px-3 py-1.5 bg-white hover:bg-[#EEEBFB] border border-[#E6E8F0] hover:border-[#5B49D6]/40 rounded-full text-xs font-medium text-[#1B2236] transition-colors flex items-center gap-1.5"
          >
            <Archive className="w-3.5 h-3.5 text-[#5B49D6]" />
            <span>Archive instead of delete</span>
          </button>
        </div>
      </div>

      {/* Feature Information Modal */}
      {featureModalInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E6E8F0] pb-3">
              <h3 className="font-bold text-base text-[#1B2236] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#5B49D6]" />
                <span>{featureModalInfo.title}</span>
              </h3>
              <button
                onClick={() => setFeatureModalInfo(null)}
                className="text-[#6B7490] hover:text-[#1B2236]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#6B7490] leading-relaxed">{featureModalInfo.content}</p>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setFeatureModalInfo(null)}
                className="px-4 py-2 bg-[#5B49D6] hover:bg-[#5B49D6]/90 text-white rounded-lg text-xs font-semibold"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Custom View Modal */}
      {showSaveViewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E6E8F0] pb-3">
              <h3 className="font-bold text-base text-[#1B2236] flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-[#5B49D6]" />
                <span>Save Custom Candidate View</span>
              </h3>
              <button
                onClick={() => setShowSaveViewModal(false)}
                className="text-[#6B7490] hover:text-[#1B2236]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#6B7490]">
              Save your current filters, stage selections, and search query as a reusable view tab.
            </p>
            <div>
              <label className="block text-xs font-semibold text-[#1B2236] mb-1">View Name</label>
              <input
                type="text"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                placeholder="e.g. Senior Frontend Mumbai"
                className="w-full text-xs px-3 py-2 border border-[#E6E8F0] rounded-lg outline-none focus:border-[#5B49D6]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowSaveViewModal(false)}
                className="px-3 py-1.5 bg-[#F6F7FB] text-[#1B2236] rounded-lg text-xs font-medium hover:bg-[#E6E8F0]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCustomView}
                disabled={!newViewName.trim()}
                className="px-4 py-1.5 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 disabled:opacity-50"
              >
                Save View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
