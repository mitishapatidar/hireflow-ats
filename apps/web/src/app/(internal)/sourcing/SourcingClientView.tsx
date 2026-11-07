'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Users,
  UploadCloud,
  Copy,
  GitMerge,
  Chrome,
  Filter,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Loader2,
  Briefcase,
  Building2,
  MapPin,
  Clock,
  Sparkles,
  RefreshCw,
  Mail,
  X,
  Radio,
} from 'lucide-react';
import {
  approveSourcingItemAction,
  rejectSourcingItemAction,
  updateSourcingItemAction,
  issueExtensionTokenAction,
  connectSourcingIntegrationAction,
} from '@/actions/sourcing';

interface SourcingItem {
  id: string;
  source: string;
  candidateName: string;
  email: string | null;
  phone: string | null;
  currentCompany: string | null;
  currentTitle: string | null;
  location: string | null;
  skills: string[];
  experienceYears: number | null;
  status: string;
  duplicateStatus: string;
  duplicateScore: number;
  duplicateReasons: string[];
  createdAt: string | Date;
  job?: { id: string; title: string } | null;
}

interface SourcingClientViewProps {
  initialQueue: {
    items: SourcingItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    stats: {
      total: number;
      pendingReview: number;
      duplicateFound: number;
      approved: number;
    };
  };
  integrations: Array<{
    provider: string;
    status: string;
    isMock: boolean;
    message: string;
    details?: any;
  }>;
  availableJobs: Array<{ id: string; title: string; code: string; department: string }>;
  currentUser: {
    id: string;
    name: string;
    role: string;
  };
}

export function SourcingClientView({
  initialQueue,
  integrations,
  availableJobs,
  currentUser,
}: SourcingClientViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Filters state
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [sourceFilter, setSourceFilter] = useState(searchParams.get('source') || 'ALL');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'ALL');

  // Modal states
  const [selectedItem, setSelectedItem] = useState<SourcingItem | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);
  const [isIntegrationsModalOpen, setIsIntegrationsModalOpen] = useState(false);

  // Review Form state
  const [reviewName, setReviewName] = useState('');
  const [reviewEmail, setReviewEmail] = useState('');
  const [reviewPhone, setReviewPhone] = useState('');
  const [reviewCompany, setReviewCompany] = useState('');
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewLocation, setReviewLocation] = useState('');
  const [reviewExp, setReviewExp] = useState<number | string>('');
  const [reviewJobId, setReviewJobId] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Extension Token state
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<string | null>(null);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  // Handle Search & Filter submit
  const handleApplyFilters = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (sourceFilter !== 'ALL') params.set('source', sourceFilter);
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    router.push(`/sourcing?${params.toString()}`);
  };

  // Open Review Modal
  const openReviewModal = (item: SourcingItem) => {
    setSelectedItem(item);
    setReviewName(item.candidateName || '');
    setReviewEmail(item.email || '');
    setReviewPhone(item.phone || '');
    setReviewCompany(item.currentCompany || '');
    setReviewTitle(item.currentTitle || '');
    setReviewLocation(item.location || '');
    setReviewExp(item.experienceYears ?? '');
    setReviewJobId(item.job?.id || '');
    setReviewNotes('');
    setActionMessage(null);
    setIsReviewOpen(true);
  };

  // Explicit Candidate Approval
  const handleApproveCandidate = () => {
    if (!selectedItem) return;
    setActionMessage(null);

    startTransition(async () => {
      // 1. Update edited fields
      await updateSourcingItemAction(selectedItem.id, {
        candidateName: reviewName,
        email: reviewEmail,
        phone: reviewPhone,
        currentCompany: reviewCompany,
        currentTitle: reviewTitle,
        location: reviewLocation,
        experienceYears: reviewExp !== '' ? Number(reviewExp) : undefined,
        jobId: reviewJobId || undefined,
        notes: reviewNotes || undefined,
      });

      // 2. Explicitly approve candidate
      const res = await approveSourcingItemAction(selectedItem.id, {
        jobId: reviewJobId || undefined,
        notes: reviewNotes || undefined,
      });

      if (res.success) {
        setActionMessage({
          type: 'success',
          text: `Successfully approved ${reviewName}! Candidate created in database.`,
        });
        setTimeout(() => {
          setIsReviewOpen(false);
          router.refresh();
        }, 1200);
      } else {
        setActionMessage({ type: 'error', text: res.error || 'Failed to approve candidate.' });
      }
    });
  };

  // Reject Item
  const handleRejectCandidate = (itemId: string) => {
    if (!confirm('Are you sure you want to reject this sourced profile?')) return;
    startTransition(async () => {
      const res = await rejectSourcingItemAction(itemId, 'Rejected by recruiter in Sourcing Workspace');
      if (res.success) {
        if (isReviewOpen) setIsReviewOpen(false);
        router.refresh();
      } else {
        alert(res.error || 'Failed to reject item');
      }
    });
  };

  // Generate Extension Token
  const handleGenerateToken = async () => {
    setIsGeneratingToken(true);
    const res = await issueExtensionTokenAction();
    setIsGeneratingToken(false);
    if (res.success && res.data) {
      setGeneratedToken(res.data.token);
      setTokenExpiresAt(new Date(res.data.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setCopiedToken(false);
    } else {
      alert('Failed to generate capture token');
    }
  };

  const handleCopyToken = () => {
    if (generatedToken) {
      navigator.clipboard.writeText(generatedToken);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#1E2A4A]">Sourcing Workspace</h1>
            <span className="inline-flex items-center rounded-full bg-[#EEF2FF] px-2.5 py-0.5 text-xs font-semibold text-[#5B49D6]">
              Aureva Capital
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Capture candidate profiles across job boards, bulk imports, and browser extension into a unified review queue.
          </p>
        </div>

        {/* Quick Action Navigation Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsExtensionModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            <Chrome className="h-4 w-4 text-[#5B49D6]" />
            Chrome Clipper
          </button>

          <button
            onClick={() => setIsIntegrationsModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            <Radio className="h-4 w-4 text-emerald-600" />
            Integrations
          </button>

          <Link
            href="/sourcing/duplicates"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            <GitMerge className="h-4 w-4 text-amber-600" />
            Duplicate Review
          </Link>

          <Link
            href="/sourcing/import"
            className="inline-flex items-center gap-2 rounded-lg bg-[#5B49D6] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#4C3EC2] transition"
          >
            <UploadCloud className="h-4 w-4" />
            Bulk Import Resumes
          </Link>
        </div>
      </div>

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Total Sourced</span>
            <span className="rounded-lg bg-indigo-50 p-2 text-[#5B49D6]">
              <Users className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#1E2A4A]">{initialQueue.stats.total}</span>
            <span className="text-xs text-slate-500">across 6 sources</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Awaiting Review</span>
            <span className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <Clock className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600">{initialQueue.stats.pendingReview}</span>
            <span className="text-xs text-slate-500">requires human approval</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Duplicate Flags</span>
            <span className="rounded-lg bg-rose-50 p-2 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-600">{initialQueue.stats.duplicateFound}</span>
            <span className="text-xs text-slate-500">potential matches</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Approved Candidates</span>
            <span className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600">{initialQueue.stats.approved}</span>
            <span className="text-xs text-slate-500">in active database</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search candidate name, email, or company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:border-[#5B49D6] focus:outline-none focus:ring-1 focus:ring-[#5B49D6]"
            />
          </div>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-[#5B49D6] focus:outline-none focus:ring-1 focus:ring-[#5B49D6]"
          >
            <option value="ALL">All Sources</option>
            <option value="CHROME_EXTENSION">Chrome Extension</option>
            <option value="BULK_IMPORT">Bulk Import</option>
            <option value="MANUAL_UPLOAD">Manual Upload</option>
            <option value="INBOUND_EMAIL">Inbound Email</option>
            <option value="NAUKRI">Naukri.com</option>
            <option value="FOUNDIT">Foundit.in</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-[#5B49D6] focus:outline-none focus:ring-1 focus:ring-[#5B49D6]"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <button
            onClick={handleApplyFilters}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-900 transition"
          >
            <Filter className="h-4 w-4" />
            Filter
          </button>
        </div>

        <div className="text-xs text-slate-500">
          Showing <span className="font-semibold text-slate-700">{initialQueue.items.length}</span> of {initialQueue.total} sourced items
        </div>
      </div>

      {/* Sourcing Items Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-6 py-3.5">Candidate Profile</th>
              <th className="px-6 py-3.5">Source</th>
              <th className="px-6 py-3.5">Skills Detected</th>
              <th className="px-6 py-3.5">Exp & Location</th>
              <th className="px-6 py-3.5">Duplicate Flag</th>
              <th className="px-6 py-3.5">Status</th>
              <th className="px-6 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {initialQueue.items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center">
                    <Users className="h-10 w-10 text-slate-300 mb-2" />
                    <p className="font-medium text-slate-600">No candidates in sourcing queue</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Upload resumes via Bulk Import or clip profiles with the Chrome Extension.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              initialQueue.items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70 transition">
                  {/* Candidate Name & Current Role */}
                  <td className="px-6 py-4">
                    <div className="font-semibold text-[#1E2A4A]">{item.candidateName}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                      {item.currentTitle && <span>{item.currentTitle}</span>}
                      {item.currentTitle && item.currentCompany && <span>•</span>}
                      {item.currentCompany && (
                        <span className="flex items-center gap-1 font-medium text-slate-600">
                          <Building2 className="h-3 w-3" />
                          {item.currentCompany}
                        </span>
                      )}
                    </div>
                    {item.email && (
                      <div className="text-xs text-slate-400 mt-0.5">{item.email}</div>
                    )}
                  </td>

                  {/* Source Badge */}
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${
                        item.source === 'CHROME_EXTENSION'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : item.source === 'NAUKRI'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : item.source === 'FOUNDIT'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : item.source === 'INBOUND_EMAIL'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {item.source.replace('_', ' ')}
                    </span>
                  </td>

                  {/* Skills Chips */}
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {item.skills && item.skills.length > 0 ? (
                        item.skills.slice(0, 3).map((skill, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600"
                          >
                            {skill}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                      {item.skills && item.skills.length > 3 && (
                        <span className="text-[11px] text-slate-400 self-center">
                          +{item.skills.length - 3}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Exp & Location */}
                  <td className="px-6 py-4">
                    <div className="text-xs text-slate-700">
                      {item.experienceYears !== null && item.experienceYears !== undefined
                        ? `${item.experienceYears} yrs exp`
                        : 'Exp not listed'}
                    </div>
                    {item.location && (
                      <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                        <MapPin className="h-3 w-3" />
                        {item.location}
                      </div>
                    )}
                  </td>

                  {/* Duplicate Flag */}
                  <td className="px-6 py-4">
                    {item.duplicateStatus === 'DUPLICATE_FOUND' ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">
                        <AlertTriangle className="h-3 w-3" />
                        {item.duplicateScore}% Match
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                        <CheckCircle2 className="h-3 w-3" />
                        Unique
                      </span>
                    )}
                  </td>

                  {/* Status Badge */}
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        item.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'REJECTED'
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.status.replace('_', ' ')}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openReviewModal(item)}
                        className="inline-flex items-center gap-1 rounded-md bg-[#5B49D6]/10 px-2.5 py-1 text-xs font-semibold text-[#5B49D6] hover:bg-[#5B49D6]/20 transition"
                      >
                        Review & Approve
                      </button>
                      {item.status === 'PENDING_REVIEW' && (
                        <button
                          onClick={() => handleRejectCandidate(item.id)}
                          className="rounded-md p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="Reject candidate"
                        >
                          <XCircle className="h-4 w-4" />
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

      {/* Review & Approve Candidate Modal (Explicit Human Review) */}
      {isReviewOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-[#1E2A4A]">Candidate Ingestion Review</h3>
                <p className="text-xs text-slate-500">
                  Verify extracted details and map to job requisition before adding to Aureva Capital ATS.
                </p>
              </div>
              <button
                onClick={() => setIsReviewOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Golden Rule Notice */}
              <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3 flex items-start gap-2.5">
                <Sparkles className="h-4 w-4 text-[#5B49D6] shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-900 leading-relaxed">
                  <strong>Explicit Approval Required:</strong> In accordance with ATS data governance rules, candidates are never created automatically from parsed CVs or external extensions. Your approval will create an active Candidate record.
                </p>
              </div>

              {/* Duplicate Alert Banner if flagged */}
              {selectedItem.duplicateStatus === 'DUPLICATE_FOUND' && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3.5 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-900">
                      Potential Duplicate Candidate Flagged ({selectedItem.duplicateScore}% Match)
                    </h4>
                    <p className="text-xs text-amber-800 mt-0.5">
                      Reasons: {selectedItem.duplicateReasons.join(', ')}.
                    </p>
                    <Link
                      href="/sourcing/duplicates"
                      className="text-xs font-semibold text-amber-900 underline hover:text-amber-950 mt-1 inline-block"
                    >
                      Compare against existing records in Duplicate Review Studio →
                    </Link>
                  </div>
                </div>
              )}

              {/* Action Feedback Message */}
              {actionMessage && (
                <div
                  className={`rounded-lg p-3 text-xs font-semibold ${
                    actionMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {actionMessage.text}
                </div>
              )}

              {/* Editable Fields Grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={reviewName}
                    onChange={(e) => setReviewName(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-[#5B49D6] focus:outline-none focus:ring-1 focus:ring-[#5B49D6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={reviewEmail}
                    onChange={(e) => setReviewEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-[#5B49D6] focus:outline-none focus:ring-1 focus:ring-[#5B49D6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={reviewPhone}
                    onChange={(e) => setReviewPhone(e.target.value)}
                    placeholder="+91..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-[#5B49D6] focus:outline-none focus:ring-1 focus:ring-[#5B49D6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Current Company</label>
                  <input
                    type="text"
                    value={reviewCompany}
                    onChange={(e) => setReviewCompany(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-[#5B49D6] focus:outline-none focus:ring-1 focus:ring-[#5B49D6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Current Job Title</label>
                  <input
                    type="text"
                    value={reviewTitle}
                    onChange={(e) => setReviewTitle(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-[#5B49D6] focus:outline-none focus:ring-1 focus:ring-[#5B49D6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={reviewLocation}
                    onChange={(e) => setReviewLocation(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-[#5B49D6] focus:outline-none focus:ring-1 focus:ring-[#5B49D6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Experience (Years)</label>
                  <input
                    type="number"
                    value={reviewExp}
                    onChange={(e) => setReviewExp(e.target.value)}
                    min="0"
                    max="50"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-[#5B49D6] focus:outline-none focus:ring-1 focus:ring-[#5B49D6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Map to Active Job Requisition</label>
                  <select
                    value={reviewJobId}
                    onChange={(e) => setReviewJobId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-[#5B49D6] focus:outline-none focus:ring-1 focus:ring-[#5B49D6]"
                  >
                    <option value="">No Job Mapping (General Talent Pool)</option>
                    {availableJobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title} ({j.code || j.department})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Skills Chips */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Extracted Skills</label>
                <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-slate-200 bg-slate-50 min-h-[40px]">
                  {selectedItem.skills && selectedItem.skills.length > 0 ? (
                    selectedItem.skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center rounded bg-indigo-50 px-2 py-0.5 text-xs font-medium text-[#5B49D6] border border-indigo-100"
                      >
                        {skill}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">No skills detected.</span>
                  )}
                </div>
              </div>

              {/* Recruiter Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Recruiter Notes</label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add sourcing context, initial impressions, or reason for outreach..."
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-[#5B49D6] focus:outline-none focus:ring-1 focus:ring-[#5B49D6]"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 bg-slate-50">
              <button
                type="button"
                onClick={() => handleRejectCandidate(selectedItem.id)}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700"
              >
                <XCircle className="h-4 w-4" />
                Reject Profile
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsReviewOpen(false)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApproveCandidate}
                  disabled={isPending || !reviewName.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#5B49D6] px-5 py-2 text-xs font-semibold text-white hover:bg-[#4C3EC2] disabled:opacity-50 transition shadow-sm"
                >
                  {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Approve & Create Candidate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chrome Extension Modal */}
      {isExtensionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div className="flex items-center gap-2">
                <Chrome className="h-5 w-5 text-[#5B49D6]" />
                <h3 className="text-base font-bold text-[#1E2A4A]">HireFlow Chrome Clipper</h3>
              </div>
              <button
                onClick={() => setIsExtensionModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Generate a short-lived capture token (15-minute validity) to connect your browser extension to Aureva Capital ATS.
              </p>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Active Recruiter Token
                  </span>
                  {tokenExpiresAt && (
                    <span className="text-xs text-amber-600 font-medium">Expires at {tokenExpiresAt}</span>
                  )}
                </div>

                {generatedToken ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedToken}
                      className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-800"
                    />
                    <button
                      onClick={handleCopyToken}
                      className="inline-flex items-center gap-1 rounded bg-[#5B49D6] px-3 py-2 text-xs font-semibold text-white hover:bg-[#4C3EC2]"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copiedToken ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleGenerateToken}
                    disabled={isGeneratingToken}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#5B49D6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4C3EC2] disabled:opacity-50"
                  >
                    {isGeneratingToken && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Generate 15-Minute Token
                  </button>
                )}
              </div>

              <div className="rounded-lg bg-slate-50 p-3.5 text-xs text-slate-600 space-y-1.5">
                <h4 className="font-semibold text-slate-800">Quick Installation Instructions:</h4>
                <ol className="list-decimal list-inside space-y-1 text-slate-500">
                  <li>Open <code>chrome://extensions</code> in Google Chrome.</li>
                  <li>Enable <strong>Developer mode</strong> in the top right corner.</li>
                  <li>Click <strong>Load unpacked</strong> and select the <code>apps/extension</code> folder.</li>
                  <li>Open the extension icon on any LinkedIn, Naukri, or Foundit profile.</li>
                  <li>Paste your capture token to begin clipping profiles into this workspace.</li>
                </ol>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-200 px-6 py-3 bg-slate-50">
              <button
                onClick={() => setIsExtensionModalOpen(false)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connected Integrations Modal */}
      {isIntegrationsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div className="flex items-center gap-2">
                <Radio className="h-5 w-5 text-emerald-600" />
                <h3 className="text-base font-bold text-[#1E2A4A]">Sourcing Integrations</h3>
              </div>
              <button
                onClick={() => setIsIntegrationsModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-500">
                Modular provider framework for external job boards and resume email inboxes. In sandbox mode, mock providers simulate incoming profiles without live partner credentials.
              </p>

              <div className="space-y-3">
                {integrations.map((item) => (
                  <div
                    key={item.provider}
                    className="flex items-center justify-between rounded-lg border border-slate-200 p-4 bg-slate-50/50"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-[#1E2A4A]">{item.provider}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            item.status === 'CONNECTED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.status} ({item.isMock ? 'Sandbox' : 'Live'})
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {item.message}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        startTransition(async () => {
                          await connectSourcingIntegrationAction(item.provider, { sandboxMode: true });
                          router.refresh();
                        });
                      }}
                      disabled={isPending}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
                    >
                      <RefreshCw className={`h-3 w-3 ${isPending ? 'animate-spin' : ''}`} />
                      Sync Provider
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-200 px-6 py-3 bg-slate-50">
              <button
                onClick={() => setIsIntegrationsModalOpen(false)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
