'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  FileText,
  Calendar,
  Clock,
  MapPin,
  ExternalLink,
  ChevronLeft,
  Edit2,
  Archive,
  RefreshCw,
  Lock,
  ShieldAlert,
  Plus,
  Mail,
  Phone,
  CheckCircle,
  X,
  Download,
  UserCheck,
  ShieldCheck,
  Activity,
  GitBranch,
} from 'lucide-react';
import {
  ClientDetailDTO,
  ClientCommercialDTO,
  ClientContactDTO,
  ClientJobDTO,
  ClientDocumentDTO,
  ClientActivityDTO,
  ClientStatus,
  AuthUser,
  UserRole,
} from '@hireflow/shared';
import {
  updateClientAction,
  updateClientCommercialAction,
  archiveClientAction,
  restoreClientAction,
  createClientContactAction,
  uploadClientDocumentAction,
  verifyClientDocumentAction,
  getClientDocumentSignedUrlAction,
} from '@/actions/clients';

interface ClientRecordClientViewProps {
  client: ClientDetailDTO;
  commercial: ClientCommercialDTO | null;
  commercialError?: string | null;
  contacts: ClientContactDTO[];
  jobs: ClientJobDTO[];
  documents: ClientDocumentDTO[];
  activity: ClientActivityDTO[];
  availableOwners: Array<{ id: string; name: string; role: string }>;
  currentUser: AuthUser | null;
}

export function ClientRecordClientView({
  client,
  commercial: initialCommercial,
  commercialError,
  contacts: initialContacts,
  jobs: initialJobs,
  documents: initialDocuments,
  activity: initialActivity,
  availableOwners,
  currentUser,
}: ClientRecordClientViewProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Tab State: 'overview' | 'contacts' | 'jobs' | 'documents' | 'activity'
  const [activeTab, setActiveTab] = useState<'overview' | 'contacts' | 'jobs' | 'documents' | 'activity'>('overview');

  // Modals state
  const [showEditClientModal, setShowEditClientModal] = useState(false);
  const [showEditCommercialModal, setShowEditCommercialModal] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [showUploadDocModal, setShowUploadDocModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);

  // Edit Client Form State
  const [editFormData, setEditFormData] = useState({
    legalName: client.legalName,
    industry: client.industry || '',
    website: client.website || '',
    location: client.location || '',
    relationshipOwnerId: client.relationshipOwner?.id || '',
    status: client.status,
    nextStep: client.nextStep || '',
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Commercial Form State
  const [commercialFormData, setCommercialFormData] = useState({
    feePercentage: initialCommercial?.feePercentage?.toString() || '',
    paymentTerms: initialCommercial?.paymentTerms || 'NET_30',
    commercialTerms: initialCommercial?.commercialTerms || '',
    relationshipNotes: initialCommercial?.relationshipNotes || '',
  });
  const [commercialErrorState, setCommercialErrorState] = useState<string | null>(null);
  const [commercialSubmitting, setCommercialSubmitting] = useState(false);

  // Add Contact Form State
  const [contactFormData, setContactFormData] = useState({
    name: '',
    designation: '',
    email: '',
    phone: '',
    contactType: 'HIRING_MANAGER',
    isPrimary: false,
  });
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSubmitting, setContactSubmitting] = useState(false);

  // Upload Document Form State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docCategory, setDocCategory] = useState('AGREEMENT');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSubmitting, setUploadSubmitting] = useState(false);

  // Archive Form State
  const [archiveReason, setArchiveReason] = useState('');
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [archiveSubmitting, setArchiveSubmitting] = useState(false);

  // Document downloading state
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

  // Authorization checks
  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const isManagerOrAdmin = isAdmin || currentUser?.role === UserRole.MANAGER;
  const canEditProfile = isManagerOrAdmin || currentUser?.role === UserRole.RECRUITER;

  // 1. Submit Profile Edit
  async function handleEditClientSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEditError(null);
    setEditSubmitting(true);

    try {
      const res = await updateClientAction(client.id, {
        legalName: editFormData.legalName.trim() || undefined,
        industry: editFormData.industry.trim() || null,
        website: editFormData.website.trim() || null,
        location: editFormData.location.trim() || null,
        relationshipOwnerId: editFormData.relationshipOwnerId || null,
        status: editFormData.status,
        nextStep: editFormData.nextStep.trim() || null,
      });

      if (!res.success) {
        setEditError(res.error || 'Failed to update client');
        setEditSubmitting(false);
        return;
      }

      setShowEditClientModal(false);
      startTransition(() => {
        router.refresh();
      });
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setEditSubmitting(false);
    }
  }

  // 2. Submit Commercial Terms Edit (Admin Only)
  async function handleCommercialSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCommercialErrorState(null);
    setCommercialSubmitting(true);

    try {
      const fee = commercialFormData.feePercentage.trim() !== ''
        ? parseFloat(commercialFormData.feePercentage)
        : null;

      const res = await updateClientCommercialAction(client.id, {
        feePercentage: fee,
        paymentTerms: commercialFormData.paymentTerms.trim() || null,
        commercialTerms: commercialFormData.commercialTerms.trim() || null,
        relationshipNotes: commercialFormData.relationshipNotes.trim() || null,
      });

      if (!res.success) {
        setCommercialErrorState(res.error || 'Failed to update commercial terms');
        setCommercialSubmitting(false);
        return;
      }

      setShowEditCommercialModal(false);
      startTransition(() => {
        router.refresh();
      });
    } catch (err: unknown) {
      setCommercialErrorState(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setCommercialSubmitting(false);
    }
  }

  // 3. Submit Add Contact
  async function handleAddContactSubmit(e: React.FormEvent) {
    e.preventDefault();
    setContactError(null);

    if (!contactFormData.name.trim() || !contactFormData.email.trim()) {
      setContactError('Contact name and email are required');
      return;
    }

    setContactSubmitting(true);
    try {
      const res = await createClientContactAction(client.id, {
        name: contactFormData.name.trim(),
        designation: contactFormData.designation.trim() || null,
        email: contactFormData.email.trim().toLowerCase(),
        phone: contactFormData.phone.trim() || null,
        contactType: contactFormData.contactType,
        isPrimary: contactFormData.isPrimary,
      });

      if (!res.success) {
        setContactError(res.error || 'Failed to add contact');
        setContactSubmitting(false);
        return;
      }

      setShowAddContactModal(false);
      setContactFormData({
        name: '',
        designation: '',
        email: '',
        phone: '',
        contactType: 'HIRING_MANAGER',
        isPrimary: false,
      });
      startTransition(() => {
        router.refresh();
      });
    } catch (err: unknown) {
      setContactError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setContactSubmitting(false);
    }
  }

  // 4. Submit Upload Document
  async function handleUploadDocSubmit(e: React.FormEvent) {
    e.preventDefault();
    setUploadError(null);

    if (!selectedFile) {
      setUploadError('Please select a document file to upload');
      return;
    }

    setUploadSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('documentType', docCategory);

      const res = await uploadClientDocumentAction(client.id, formData);
      if (!res.success) {
        setUploadError(res.error || 'Failed to upload document');
        setUploadSubmitting(false);
        return;
      }

      setShowUploadDocModal(false);
      setSelectedFile(null);
      startTransition(() => {
        router.refresh();
      });
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setUploadSubmitting(false);
    }
  }

  // 5. Toggle Document Verification (Admin/Manager Only)
  async function handleToggleVerification(docId: string, currentVerified: boolean) {
    try {
      const res = await verifyClientDocumentAction(client.id, docId, !currentVerified);
      if (!res.success) {
        alert(res.error || 'Failed to change verification status');
        return;
      }
      startTransition(() => {
        router.refresh();
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  // 6. Download Document Signed URL
  async function handleDownloadDoc(doc: ClientDocumentDTO) {
    setDownloadingDocId(doc.id);
    try {
      const res = await getClientDocumentSignedUrlAction(client.id, doc.id);
      if (!res.success || !res.signedUrl) {
        alert(res.error || 'Failed to generate download link');
        return;
      }

      // Open signed download link
      window.open(res.signedUrl, '_blank');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'An error occurred downloading file');
    } finally {
      setDownloadingDocId(null);
    }
  }

  // 7. Submit Archive
  async function handleArchiveSubmit(e: React.FormEvent) {
    e.preventDefault();
    setArchiveError(null);

    if (archiveReason.trim().length < 3) {
      setArchiveError('Archive reason must be at least 3 characters long');
      return;
    }

    setArchiveSubmitting(true);
    try {
      const res = await archiveClientAction(client.id, archiveReason.trim());

      if (!res.success) {
        setArchiveError(res.error || 'Failed to archive client');
        setArchiveSubmitting(false);
        return;
      }

      setShowArchiveModal(false);
      setArchiveReason('');
      startTransition(() => {
        router.refresh();
      });
    } catch (err: unknown) {
      setArchiveError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setArchiveSubmitting(false);
    }
  }

  // 8. Submit Restore
  async function handleRestoreSubmit(e: React.FormEvent) {
    e.preventDefault();
    setArchiveSubmitting(true);

    try {
      const res = await restoreClientAction(client.id);
      if (!res.success) {
        alert(res.error || 'Failed to restore client');
        setArchiveSubmitting(false);
        return;
      }

      setShowRestoreModal(false);
      startTransition(() => {
        router.refresh();
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setArchiveSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Top Navigation & Record Header */}
      <div className="flex items-center gap-2 text-xs text-[#6B7490]">
        <Link
          href="/clients"
          data-testid="back-to-clients-link"
          className="hover:text-[#5B49D6] flex items-center gap-1 font-medium transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Clients CRM</span>
        </Link>
        <span>/</span>
        <span className="text-[#1B2236] font-semibold">{client.legalName}</span>
      </div>

      {/* Main Record Header Card */}
      <div className="bg-white rounded-2xl border border-[#E6E8F0] p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#E6E8F0]">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#EEEBFB] text-[#5B49D6] flex items-center justify-center font-bold text-lg shrink-0 shadow-xs">
              {client.legalName.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  data-testid="client-record-title"
                  className="text-xl font-bold text-[#1B2236]"
                >
                  {client.legalName}
                </h1>
                <span
                  data-testid="client-code-badge"
                  className="px-2 py-0.5 rounded-md bg-slate-100 text-xs font-mono font-semibold text-[#6B7490]"
                >
                  {client.code}
                </span>
                {client.isArchived ? (
                  <span
                    data-testid="client-status-badge"
                    className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700"
                  >
                    ARCHIVED
                  </span>
                ) : client.status === 'ACTIVE' ? (
                  <span
                    data-testid="client-status-badge"
                    className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-[#12B76A] border border-emerald-200/50"
                  >
                    ACTIVE
                  </span>
                ) : client.status === 'PROSPECT' ? (
                  <span
                    data-testid="client-status-badge"
                    className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-[#0284C7] border border-sky-200/50"
                  >
                    PROSPECT
                  </span>
                ) : (
                  <span
                    data-testid="client-status-badge"
                    className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-[#6B7490]"
                  >
                    INACTIVE
                  </span>
                )}
                {client.industry && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EEEBFB] text-[#5B49D6]">
                    {client.industry}
                  </span>
                )}
              </div>

              {/* Sub-header Metadata Row */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-[#6B7490] mt-2">
                {client.location && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{client.location}</span>
                  </div>
                )}
                {client.website && (
                  <a
                    href={client.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-[#5B49D6] transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{client.website.replace(/^https?:\/\//, '')}</span>
                  </a>
                )}
                <div className="flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>
                    Owner:{' '}
                    <strong className="text-[#1B2236]">
                      {client.relationshipOwner ? client.relationshipOwner.name : 'Unassigned'}
                    </strong>
                  </span>
                </div>
                {client.nextStep && (
                  <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                    <Clock className="w-3 h-3" />
                    <span>Next: {client.nextStep}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {isManagerOrAdmin && (
              <Link
                href={`/clients/${client.id}/workflow`}
                data-testid="client-workflow-btn"
                className="px-3.5 py-2 bg-[#EEEBFB] border border-[#D3CCF7] text-[#5B49D6] rounded-lg text-xs font-semibold hover:bg-[#E5E0FA] transition-all flex items-center gap-1.5 shadow-2xs"
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>Workflow & Rules</span>
              </Link>
            )}

            {canEditProfile && (
              <button
                onClick={() => setShowEditClientModal(true)}
                data-testid="edit-client-btn"
                className="px-3.5 py-2 bg-white border border-[#E6E8F0] text-[#1B2236] rounded-lg text-xs font-semibold hover:bg-slate-50 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-[#6B7490]" />
                <span>Edit Profile</span>
              </button>
            )}

            {isAdmin && (
              client.isArchived ? (
                <button
                  onClick={() => setShowRestoreModal(true)}
                  data-testid="restore-client-btn"
                  className="px-3.5 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Restore Client</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setShowArchiveModal(true);
                    setArchiveReason('');
                    setArchiveError(null);
                  }}
                  data-testid="archive-client-btn"
                  className="px-3.5 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold hover:bg-rose-100 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Archive Client</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* 2. Five Underline-Style Tabs (Figma Frame 22) */}
        <div className="flex items-center gap-6 mt-4 border-b border-[#E6E8F0] text-xs font-semibold">
          <button
            onClick={() => setActiveTab('overview')}
            data-testid="tab-overview"
            className={`pb-3 transition-colors relative cursor-pointer ${
              activeTab === 'overview'
                ? 'text-[#5B49D6] border-b-2 border-[#5B49D6]'
                : 'text-[#6B7490] hover:text-[#1B2236]'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('contacts')}
            data-testid="tab-contacts"
            className={`pb-3 transition-colors relative flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'contacts'
                ? 'text-[#5B49D6] border-b-2 border-[#5B49D6]'
                : 'text-[#6B7490] hover:text-[#1B2236]'
            }`}
          >
            <span>Contacts</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-[#6B7490]">
              {initialContacts.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('jobs')}
            data-testid="tab-jobs"
            className={`pb-3 transition-colors relative flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'jobs'
                ? 'text-[#5B49D6] border-b-2 border-[#5B49D6]'
                : 'text-[#6B7490] hover:text-[#1B2236]'
            }`}
          >
            <span>Jobs</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-[#6B7490]">
              {initialJobs.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            data-testid="tab-documents"
            className={`pb-3 transition-colors relative flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'documents'
                ? 'text-[#5B49D6] border-b-2 border-[#5B49D6]'
                : 'text-[#6B7490] hover:text-[#1B2236]'
            }`}
          >
            <span>Documents</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-[#6B7490]">
              {initialDocuments.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            data-testid="tab-activity"
            className={`pb-3 transition-colors relative flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'activity'
                ? 'text-[#5B49D6] border-b-2 border-[#5B49D6]'
                : 'text-[#6B7490] hover:text-[#1B2236]'
            }`}
          >
            <span>Meetings & Activity</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-[#6B7490]">
              {initialActivity.length}
            </span>
          </button>
        </div>
      </div>

      {/* 3. TAB CONTENT */}

      {/* ============================================================ */}
      {/* TAB 1: OVERVIEW */}
      {/* ============================================================ */}
      {activeTab === 'overview' && (
        <div className="space-y-6" data-testid="tab-content-overview">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-[#E6E8F0] p-4 shadow-2xs">
              <div className="text-xs text-[#6B7490]">Active Mandates</div>
              <div className="text-2xl font-bold text-[#1B2236] mt-1">{client.openJobsCount}</div>
            </div>
            <div className="bg-white rounded-xl border border-[#E6E8F0] p-4 shadow-2xs">
              <div className="text-xs text-[#6B7490]">Key Contacts</div>
              <div className="text-2xl font-bold text-[#1B2236] mt-1">{initialContacts.length}</div>
            </div>
            <div className="bg-white rounded-xl border border-[#E6E8F0] p-4 shadow-2xs">
              <div className="text-xs text-[#6B7490]">Verified Docs</div>
              <div className="text-2xl font-bold text-[#12B76A] mt-1">
                {initialDocuments.filter((d) => d.isVerified).length} / {initialDocuments.length}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-[#E6E8F0] p-4 shadow-2xs">
              <div className="text-xs text-[#6B7490]">Scheduled Meetings</div>
              <div className="text-2xl font-bold text-amber-600 mt-1">{client.meetingsCount}</div>
            </div>
          </div>

          {/* Company Master Information & Internal Commercial Panel Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Card: Company Profile */}
            <div className="bg-white rounded-2xl border border-[#E6E8F0] p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E6E8F0]">
                <h2 className="text-sm font-bold text-[#1B2236] flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#5B49D6]" />
                  <span>Company Profile</span>
                </h2>
                <span className="text-[11px] font-mono text-[#6B7490]">ID: {client.id}</span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b border-[#E6E8F0]/40">
                  <span className="text-[#6B7490]">Legal Name</span>
                  <span className="font-semibold text-[#1B2236]">{client.legalName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E6E8F0]/40">
                  <span className="text-[#6B7490]">Client Code</span>
                  <span className="font-mono font-bold text-[#5B49D6]">{client.code}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E6E8F0]/40">
                  <span className="text-[#6B7490]">Industry / Sector</span>
                  <span className="text-[#1B2236]">{client.industry || 'Not specified'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E6E8F0]/40">
                  <span className="text-[#6B7490]">Headquarters / Location</span>
                  <span className="text-[#1B2236]">{client.location || 'Not specified'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E6E8F0]/40">
                  <span className="text-[#6B7490]">Website</span>
                  {client.website ? (
                    <a
                      href={client.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#5B49D6] hover:underline flex items-center gap-1"
                    >
                      <span>{client.website}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-[#6B7490]">None</span>
                  )}
                </div>
                <div className="flex justify-between py-1 border-b border-[#E6E8F0]/40">
                  <span className="text-[#6B7490]">Relationship Owner</span>
                  <span className="font-semibold text-[#1B2236]">
                    {client.relationshipOwner ? client.relationshipOwner.name : 'Unassigned'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E6E8F0]/40">
                  <span className="text-[#6B7490]">Next Step</span>
                  <span className="text-amber-800 font-medium">{client.nextStep || 'None recorded'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#6B7490]">Account Created</span>
                  <span className="text-[#6B7490]">{new Date(client.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Right Card: STRICTLY INTERNAL COMMERCIAL INFORMATION PANEL */}
            <div
              data-testid="internal-commercial-panel"
              className="bg-white rounded-2xl border-2 border-amber-200/80 p-5 shadow-xs space-y-4 relative overflow-hidden"
            >
              {/* Internal Warning Banner */}
              <div className="bg-amber-500/10 -mx-5 -mt-5 px-5 py-2.5 border-b border-amber-200/80 flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                  <Lock className="w-3.5 h-3.5 text-amber-700" />
                  <span>INTERNAL COMMERCIAL AGREEMENT</span>
                </div>
                <span className="px-2 py-0.5 rounded-sm bg-amber-200/70 text-[10px] font-bold text-amber-900 tracking-wider">
                  CONFIDENTIAL
                </span>
              </div>

              <div className="text-[11px] text-[#6B7490] italic">
                Strictly internal agency terms. Never exposed to candidate or client portal responses.
              </div>

              {commercialError ? (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Commercial Access Restricted</div>
                    <p className="mt-0.5">{commercialError}</p>
                  </div>
                </div>
              ) : initialCommercial ? (
                <div className="space-y-3.5 text-xs">
                  {/* Fee Percentage */}
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                    <span className="text-[#6B7490] font-medium">Agreed Fee Percentage:</span>
                    <span
                      data-testid="commercial-fee-percentage"
                      className="font-bold text-base text-[#12B76A]"
                    >
                      {initialCommercial.feePercentage !== null
                        ? `${initialCommercial.feePercentage}%`
                        : 'Not agreed'}
                    </span>
                  </div>

                  {/* Payment Terms */}
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                    <span className="text-[#6B7490] font-medium">Payment Terms:</span>
                    <span
                      data-testid="commercial-payment-terms"
                      className="font-mono font-semibold text-[#1B2236] bg-slate-100 px-2 py-0.5 rounded-sm"
                    >
                      {initialCommercial.paymentTerms || 'NET_30'}
                    </span>
                  </div>

                  {/* Commercial Terms Description */}
                  <div className="py-1.5 border-b border-slate-100 space-y-1">
                    <span className="text-[#6B7490] font-medium block">Commercial Terms & Guarantees:</span>
                    <p
                      data-testid="commercial-terms-text"
                      className="text-[#1B2236] bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 leading-relaxed"
                    >
                      {initialCommercial.commercialTerms || 'Standard Aureva Capital recruitment placement terms apply.'}
                    </p>
                  </div>

                  {/* Internal Relationship Notes */}
                  <div className="py-1.5 space-y-1">
                    <span className="text-[#6B7490] font-medium block">Internal Agency Relationship Notes:</span>
                    <p
                      data-testid="commercial-notes-text"
                      className="text-[#1B2236] bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 leading-relaxed italic"
                    >
                      {initialCommercial.relationshipNotes || 'No internal relationship notes recorded yet.'}
                    </p>
                  </div>

                  {/* Admin Edit Trigger */}
                  {isAdmin && (
                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={() => setShowEditCommercialModal(true)}
                        data-testid="edit-commercial-btn"
                        className="px-3.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 border border-amber-300 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit Commercial Terms</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-[#6B7490] p-4 bg-slate-50 rounded-xl text-center">
                  Commercial terms not configured.
                  {isAdmin && (
                    <div className="mt-2">
                      <button
                        onClick={() => setShowEditCommercialModal(true)}
                        className="text-[#5B49D6] font-semibold hover:underline"
                      >
                        Configure Commercial Agreement →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: CONTACTS */}
      {/* ============================================================ */}
      {activeTab === 'contacts' && (
        <div className="space-y-4" data-testid="tab-content-contacts">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#1B2236]">Hiring Managers & Business Contacts</h2>
              <p className="text-xs text-[#6B7490]">
                Client stakeholder contacts and client portal access grants.
              </p>
            </div>
            {canEditProfile && (
              <button
                onClick={() => setShowAddContactModal(true)}
                data-testid="add-contact-btn"
                className="px-3.5 py-1.5 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Contact</span>
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-[#E6E8F0] shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse" data-testid="client-contacts-table">
              <thead>
                <tr className="bg-[#F8F9FD] border-b border-[#E6E8F0] text-[11px] font-bold text-[#6B7490] uppercase tracking-wider">
                  <th className="py-3 px-4">Contact Person</th>
                  <th className="py-3 px-4">Designation</th>
                  <th className="py-3 px-4">Contact Details</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Client Portal Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E8F0] text-xs text-[#1B2236]">
                {initialContacts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-[#6B7490]">
                      No contacts registered for this client.
                    </td>
                  </tr>
                ) : (
                  initialContacts.map((contact) => (
                    <tr
                      key={contact.id}
                      data-testid={`contact-row-${contact.id}`}
                      className="hover:bg-[#F8F9FD]/60 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#1B2236]">{contact.name}</span>
                          {contact.isPrimary && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EEEBFB] text-[#5B49D6]">
                              PRIMARY
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-[#6B7490]">
                        {contact.designation || 'Not specified'}
                      </td>
                      <td className="py-3.5 px-4 space-y-1">
                        <div className="flex items-center gap-1.5 text-[#5B49D6]">
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          <a href={`mailto:${contact.email}`} className="hover:underline">
                            {contact.email}
                          </a>
                        </div>
                        {contact.phone && (
                          <div className="flex items-center gap-1.5 text-[#6B7490]">
                            <Phone className="w-3.5 h-3.5 shrink-0" />
                            <span>{contact.phone}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-mono text-slate-700">
                          {contact.contactType}
                        </span>
                      </td>
                      {/* Prompt 6 ClientAccess Portal Indicator */}
                      <td className="py-3.5 px-4">
                        {contact.hasPortalAccess ? (
                          <span
                            data-testid={`contact-portal-badge-${contact.id}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-[#12B76A] border border-emerald-200/50"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Portal Access Active</span>
                          </span>
                        ) : (
                          <span
                            data-testid={`contact-portal-badge-${contact.id}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-[#6B7490]"
                          >
                            <span>No Portal Access</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: JOBS */}
      {/* ============================================================ */}
      {activeTab === 'jobs' && (
        <div className="space-y-4" data-testid="tab-content-jobs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#1B2236]">Active Mandates & Job Openings</h2>
              <p className="text-xs text-[#6B7490]">
                All recruitment assignments and open requisitions for {client.legalName}.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E6E8F0] shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse" data-testid="client-jobs-table">
              <thead>
                <tr className="bg-[#F8F9FD] border-b border-[#E6E8F0] text-[11px] font-bold text-[#6B7490] uppercase tracking-wider">
                  <th className="py-3 px-4">Job Title & Code</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Openings</th>
                  <th className="py-3 px-4">Candidates</th>
                  <th className="py-3 px-4">Hiring Manager</th>
                  <th className="py-3 px-4">Recruiter / Owner</th>
                  <th className="py-3 px-4 text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E8F0] text-xs text-[#1B2236]">
                {initialJobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-[#6B7490]">
                      No active jobs registered for this client.
                    </td>
                  </tr>
                ) : (
                  initialJobs.map((job) => (
                    <tr
                      key={job.id}
                      data-testid={`job-row-${job.code}`}
                      className="hover:bg-[#F8F9FD]/60 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div>
                          <span className="font-bold text-[#1B2236]">{job.title}</span>
                          <span className="ml-2 px-1.5 py-0.5 rounded-sm bg-slate-100 text-[10px] font-mono text-[#6B7490]">
                            {job.code}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            job.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-[#12B76A]'
                              : job.status === 'CLOSED'
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold">{job.openings}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-[#EEEBFB] text-[#5B49D6] font-semibold text-[11px]">
                          {job.candidateCount} candidates
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-[#6B7490]">
                        {job.hiringManager ? job.hiringManager.name : '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        {job.owner ? job.owner.name : 'Unassigned'}
                      </td>
                      <td className="py-3.5 px-4 text-right text-[#6B7490]">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 4: DOCUMENTS */}
      {/* ============================================================ */}
      {activeTab === 'documents' && (
        <div className="space-y-4" data-testid="tab-content-documents">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#1B2236]">Client Documents & Legal Agreements</h2>
              <p className="text-xs text-[#6B7490]">
                Private stored contracts, MSAs, role briefs, and fee agreements.
              </p>
            </div>
            {canEditProfile && (
              <button
                onClick={() => setShowUploadDocModal(true)}
                data-testid="upload-document-btn"
                className="px-3.5 py-1.5 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload Document</span>
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-[#E6E8F0] shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse" data-testid="client-documents-table">
              <thead>
                <tr className="bg-[#F8F9FD] border-b border-[#E6E8F0] text-[11px] font-bold text-[#6B7490] uppercase tracking-wider">
                  <th className="py-3 px-4">Document</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Version</th>
                  <th className="py-3 px-4">Size & Format</th>
                  <th className="py-3 px-4">Verification Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E8F0] text-xs text-[#1B2236]">
                {initialDocuments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-[#6B7490]">
                      No documents uploaded for this client yet.
                    </td>
                  </tr>
                ) : (
                  initialDocuments.map((doc) => (
                    <tr
                      key={doc.id}
                      data-testid={`document-row-${doc.id}`}
                      className="hover:bg-[#F8F9FD]/60 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-[#5B49D6] shrink-0" />
                          <div>
                            <span className="font-bold text-[#1B2236]">{doc.fileName}</span>
                            <div className="text-[11px] text-[#6B7490]">
                              Uploaded by {doc.uploadedBy ? doc.uploadedBy.name : 'Staff'} on{' '}
                              {new Date(doc.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-mono text-slate-700">
                          {doc.documentType}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-600">
                        v{doc.version}
                      </td>
                      <td className="py-3.5 px-4 text-[#6B7490]">
                        {(doc.fileSize / 1024).toFixed(0)} KB ({doc.mimeType})
                      </td>
                      {/* Verification Status Badge */}
                      <td className="py-3.5 px-4">
                        {doc.isVerified ? (
                          <span
                            data-testid={`doc-verified-badge-${doc.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-[#12B76A] border border-emerald-200/50"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Verified</span>
                          </span>
                        ) : (
                          <span
                            data-testid={`doc-verified-badge-${doc.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/50"
                          >
                            <span>Unverified</span>
                          </span>
                        )}
                      </td>
                      {/* Actions: Download Signed URL & Verify Toggle */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2 justify-end">
                          <button
                            onClick={() => handleDownloadDoc(doc)}
                            disabled={downloadingDocId === doc.id}
                            data-testid={`download-doc-btn-${doc.id}`}
                            className="px-2.5 py-1 text-xs font-semibold text-[#5B49D6] hover:bg-[#EEEBFB] rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>{downloadingDocId === doc.id ? 'Preparing...' : 'Download'}</span>
                          </button>

                          {isManagerOrAdmin && (
                            <button
                              onClick={() => handleToggleVerification(doc.id, doc.isVerified)}
                              data-testid={`toggle-verify-btn-${doc.id}`}
                              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                                doc.isVerified
                                  ? 'text-amber-700 hover:bg-amber-50'
                                  : 'text-emerald-700 hover:bg-emerald-50'
                              }`}
                            >
                              {doc.isVerified ? 'Unverify' : 'Verify'}
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
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 5: MEETINGS & ACTIVITY */}
      {/* ============================================================ */}
      {activeTab === 'activity' && (
        <div className="space-y-4" data-testid="tab-content-activity">
          <div>
            <h2 className="text-sm font-bold text-[#1B2236]">Meetings & Activity Timeline</h2>
            <p className="text-xs text-[#6B7490]">
              Chronological log of meetings, client audits, contract updates, and document verification.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-[#E6E8F0] p-6 shadow-xs">
            {initialActivity.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#6B7490]">
                No logged activity or scheduled meetings for this client yet.
              </div>
            ) : (
              <div className="relative border-l-2 border-[#E6E8F0] ml-3 pl-6 space-y-6">
                {initialActivity.map((item) => (
                  <div key={item.id} className="relative group">
                    {/* Timeline Node Icon */}
                    <div
                      className={`absolute -left-[31px] top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] shadow-2xs ${
                        item.type === 'MEETING'
                          ? 'bg-amber-500'
                          : item.type === 'AUDIT_LOG'
                          ? 'bg-[#5B49D6]'
                          : 'bg-emerald-600'
                      }`}
                    >
                      {item.type === 'MEETING' ? (
                        <Calendar className="w-3 h-3" />
                      ) : (
                        <Activity className="w-3 h-3" />
                      )}
                    </div>

                    {/* Timeline Item Content */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#1B2236] capitalize">
                          {item.title}
                        </span>
                        <span className="text-[11px] text-[#6B7490]">
                          {new Date(item.timestamp).toLocaleString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>

                      {item.description && (
                        <p className="text-xs text-[#6B7490] bg-[#F8F9FD] p-2.5 rounded-lg border border-[#E6E8F0]/60 max-w-xl font-mono text-[11px]">
                          {item.description}
                        </p>
                      )}

                      {item.actor && (
                        <div className="text-[11px] text-[#6B7490]">
                          By <strong className="text-[#1B2236]">{item.actor.name}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. MODALS */}
      {/* ============================================================ */}

      {/* Modal 1: Edit Client Profile */}
      {showEditClientModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#E6E8F0]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6E8F0]">
              <h3 className="text-base font-bold text-[#1B2236]">Edit Client Profile</h3>
              <button onClick={() => setShowEditClientModal(false)} className="text-[#6B7490] hover:text-[#1B2236] p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                {editError}
              </div>
            )}

            <form onSubmit={handleEditClientSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1">Company Legal Name</label>
                <input
                  type="text"
                  required
                  value={editFormData.legalName}
                  onChange={(e) => setEditFormData({ ...editFormData, legalName: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0] focus:outline-hidden focus:border-[#5B49D6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1B2236] mb-1">Industry</label>
                  <input
                    type="text"
                    value={editFormData.industry}
                    onChange={(e) => setEditFormData({ ...editFormData, industry: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1B2236] mb-1">Location</label>
                  <input
                    type="text"
                    value={editFormData.location}
                    onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1">Website URL</label>
                <input
                  type="url"
                  value={editFormData.website}
                  onChange={(e) => setEditFormData({ ...editFormData, website: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1B2236] mb-1">Relationship Owner</label>
                  <select
                    value={editFormData.relationshipOwnerId}
                    onChange={(e) => setEditFormData({ ...editFormData, relationshipOwnerId: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0] bg-white"
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
                  <label className="block text-xs font-semibold text-[#1B2236] mb-1">Status</label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as ClientStatus })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0] bg-white"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PROSPECT">PROSPECT</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1">Next Step</label>
                <input
                  type="text"
                  value={editFormData.nextStep}
                  onChange={(e) => setEditFormData({ ...editFormData, nextStep: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0]"
                />
              </div>

              <div className="pt-3 border-t border-[#E6E8F0] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditClientModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#6B7490]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-4 py-2 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 disabled:opacity-50 cursor-pointer"
                >
                  {editSubmitting ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Edit Commercial Terms (Admin Only) */}
      {showEditCommercialModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#E6E8F0]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6E8F0]">
              <div className="flex items-center gap-2 text-amber-900">
                <Lock className="w-4 h-4 text-amber-700" />
                <h3 className="text-base font-bold">Edit Commercial Terms</h3>
              </div>
              <button onClick={() => setShowEditCommercialModal(false)} className="text-[#6B7490] p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            {commercialErrorState && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                {commercialErrorState}
              </div>
            )}

            <form onSubmit={handleCommercialSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                    Fee Percentage (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={commercialFormData.feePercentage}
                    onChange={(e) => setCommercialFormData({ ...commercialFormData, feePercentage: e.target.value })}
                    placeholder="e.g. 18.5"
                    data-testid="input-commercial-fee"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                    Payment Terms
                  </label>
                  <select
                    value={commercialFormData.paymentTerms}
                    onChange={(e) => setCommercialFormData({ ...commercialFormData, paymentTerms: e.target.value })}
                    data-testid="select-commercial-payment-terms"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0] bg-white"
                  >
                    <option value="NET_15">NET 15</option>
                    <option value="NET_30">NET 30</option>
                    <option value="NET_45">NET 45</option>
                    <option value="NET_60">NET 60</option>
                    <option value="IMMEDIATE">IMMEDIATE</option>
                    <option value="CUSTOM">CUSTOM</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                  Commercial Agreement Terms
                </label>
                <textarea
                  rows={3}
                  value={commercialFormData.commercialTerms}
                  onChange={(e) => setCommercialFormData({ ...commercialFormData, commercialTerms: e.target.value })}
                  placeholder="e.g. 18.5% fee on first-year fixed CTC, 90-day replacement guarantee..."
                  data-testid="input-commercial-terms"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                  Internal Relationship Notes (Recruiter Eyes Only)
                </label>
                <textarea
                  rows={3}
                  value={commercialFormData.relationshipNotes}
                  onChange={(e) => setCommercialFormData({ ...commercialFormData, relationshipNotes: e.target.value })}
                  placeholder="e.g. Approved discount for bulk tech mandates..."
                  data-testid="input-commercial-notes"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0]"
                />
              </div>

              <div className="pt-3 border-t border-[#E6E8F0] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditCommercialModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#6B7490]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={commercialSubmitting}
                  data-testid="save-commercial-btn"
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
                >
                  {commercialSubmitting ? 'Saving Terms...' : 'Save Commercial Terms'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Add Contact */}
      {showAddContactModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E6E8F0]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6E8F0]">
              <h3 className="text-base font-bold text-[#1B2236]">Add Client Contact</h3>
              <button onClick={() => setShowAddContactModal(false)} className="text-[#6B7490] p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            {contactError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                {contactError}
              </div>
            )}

            <form onSubmit={handleAddContactSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={contactFormData.name}
                  onChange={(e) => setContactFormData({ ...contactFormData, name: e.target.value })}
                  placeholder="e.g. Anita Desai"
                  data-testid="input-contact-name"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={contactFormData.email}
                  onChange={(e) => setContactFormData({ ...contactFormData, email: e.target.value })}
                  placeholder="anita.desai@company.com"
                  data-testid="input-contact-email"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1B2236] mb-1">Phone</label>
                  <input
                    type="tel"
                    value={contactFormData.phone}
                    onChange={(e) => setContactFormData({ ...contactFormData, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    data-testid="input-contact-phone"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1B2236] mb-1">Designation</label>
                  <input
                    type="text"
                    value={contactFormData.designation}
                    onChange={(e) => setContactFormData({ ...contactFormData, designation: e.target.value })}
                    placeholder="e.g. Engineering Lead"
                    data-testid="input-contact-designation"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1">Contact Type</label>
                <select
                  value={contactFormData.contactType}
                  onChange={(e) => setContactFormData({ ...contactFormData, contactType: e.target.value })}
                  data-testid="select-contact-type"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0] bg-white"
                >
                  <option value="HIRING_MANAGER">Hiring Manager</option>
                  <option value="PRIMARY">Primary Contact</option>
                  <option value="BILLING">Billing / Finance</option>
                  <option value="HR">Human Resources</option>
                  <option value="TECHNICAL">Technical Interviewer</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#1B2236]">
                  <input
                    type="checkbox"
                    checked={contactFormData.isPrimary}
                    onChange={(e) => setContactFormData({ ...contactFormData, isPrimary: e.target.checked })}
                    data-testid="checkbox-contact-primary"
                    className="rounded-sm border-gray-300 text-[#5B49D6]"
                  />
                  <span>Mark as Primary Account Contact</span>
                </label>
              </div>

              <div className="pt-3 border-t border-[#E6E8F0] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddContactModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#6B7490]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={contactSubmitting}
                  data-testid="submit-add-contact-btn"
                  className="px-4 py-2 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 disabled:opacity-50 cursor-pointer"
                >
                  {contactSubmitting ? 'Adding...' : 'Add Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Upload Document */}
      {showUploadDocModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E6E8F0]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6E8F0]">
              <h3 className="text-base font-bold text-[#1B2236]">Upload Client Document</h3>
              <button onClick={() => setShowUploadDocModal(false)} className="text-[#6B7490] p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            {uploadError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                {uploadError}
              </div>
            )}

            <form onSubmit={handleUploadDocSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                  Document Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={docCategory}
                  onChange={(e) => setDocCategory(e.target.value)}
                  data-testid="select-doc-category"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0] bg-white"
                >
                  <option value="AGREEMENT">Service Agreement</option>
                  <option value="ROLE_BRIEF">Role Brief / JD</option>
                  <option value="MSA">Master Services Agreement (MSA)</option>
                  <option value="COMMERCIAL">Commercial Proposal / Rate Card</option>
                  <option value="OTHER">Other Compliance Document</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1">
                  Select File (PDF, DOCX, DOC — Max 10MB) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="file"
                  required
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  data-testid="input-doc-file"
                  className="w-full text-xs text-[#1B2236] file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#EEEBFB] file:text-[#5B49D6] hover:file:bg-[#EEEBFB]/80 cursor-pointer"
                />
              </div>

              <div className="pt-3 border-t border-[#E6E8F0] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadDocModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#6B7490]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadSubmitting}
                  data-testid="submit-upload-doc-btn"
                  className="px-4 py-2 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 disabled:opacity-50 cursor-pointer"
                >
                  {uploadSubmitting ? 'Uploading...' : 'Upload File'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 5: Archive Client */}
      {showArchiveModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E6E8F0]">
            <div className="flex items-center gap-3 text-rose-600 mb-2">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1B2236]">Archive Client Record</h3>
                <p className="text-xs text-[#6B7490]">{client.legalName} ({client.code})</p>
              </div>
            </div>

            <p className="text-xs text-[#6B7490] mt-3">
              Soft-archiving moves this client out of active pipelines. Past placements and audit logs are safely retained.
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
                  placeholder="e.g. Client paused hiring operations for H2"
                  data-testid="archive-detail-reason-input"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#E6E8F0] focus:outline-hidden focus:border-rose-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowArchiveModal(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-[#6B7490]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={archiveSubmitting}
                  data-testid="confirm-archive-detail-btn"
                  className="px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                >
                  {archiveSubmitting ? 'Archiving...' : 'Confirm Archive'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 6: Restore Client */}
      {showRestoreModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E6E8F0]">
            <div className="flex items-center gap-3 text-emerald-600 mb-2">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1B2236]">Restore Client Record</h3>
                <p className="text-xs text-[#6B7490]">{client.legalName} ({client.code})</p>
              </div>
            </div>

            <p className="text-xs text-[#6B7490] mt-3">
              Restore this client record back to active CRM status?
            </p>

            <form onSubmit={handleRestoreSubmit} className="mt-4 pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRestoreModal(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-[#6B7490]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={archiveSubmitting}
                data-testid="confirm-restore-detail-btn"
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
