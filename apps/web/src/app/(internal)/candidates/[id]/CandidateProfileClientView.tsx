'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Mail,
  Phone,
  Building2,
  MapPin,
  Calendar,
  Clock,
  Tag,
  FileText,
  Plus,
  Trash2,
  Edit,
  ArrowRightLeft,
  Archive,
  RefreshCw,
  MoreVertical,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  X,
  IndianRupee,
  Download,
} from 'lucide-react';
import { PageHeader } from '../../../../components/layout/PageHeader';
import { formatINR, formatExperience, UserRole, AuthUser } from '@hireflow/shared';
import {
  updateCandidateAction,
  addCandidateNoteAction,
  deleteCandidateNoteAction,
  addCandidateTagAction,
  removeCandidateTagAction,
  handoverCandidateAction,
  archiveCandidateAction,
  restoreCandidateAction,
} from '@/actions/candidates';

export interface CandidateProfile {
  id: string;
  code: string;
  name: string;
  email: string;
  phone?: string | null;
  currentTitle?: string | null;
  currentCompany?: string | null;
  experienceYears?: number | null;
  currentSalary?: number | null;
  expectedSalary?: number | null;
  noticePeriod?: string | null;
  location?: string | null;
  skills?: string[];
  source?: string | null;
  ownerId?: string | null;
  isArchived: boolean;
  archivedAt?: string | null;
  archivedById?: string | null;
  archiveReason?: string | null;
  createdAt: string;
  updatedAt: string;
  owner?: { id: string; name: string; email: string; role?: string } | null;
  tags?: Array<{ id: string; name: string }>;
  notes?: Array<{
    id: string;
    content: string;
    isInternalOnly: boolean;
    createdAt: string;
    author?: { id: string; name: string; role?: string };
  }>;
  documents?: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    documentType: string;
    uploadedAt: string;
  }>;
  applications?: Array<{
    id: string;
    status: string;
    job: {
      id: string;
      title: string;
      client: { id: string; legalName: string };
    };
    interviews?: Array<{
      id: string;
      mode?: string | null;
      scheduledAt: string;
      round?: { id: string; name: string } | null;
    }>;
  }>;
}

export interface CandidateAuditLogItem {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  actorId: string;
  ipAddress?: string | null;
  createdAt: string;
  actor?: { id: string; name: string; role: string };
}

interface CandidateProfileClientViewProps {
  candidate: CandidateProfile;
  auditLogs: CandidateAuditLogItem[];
  currentUser: AuthUser | null;
  activeRecruiters: Array<{ id: string; name: string; email: string; role: string }>;
}

export function CandidateProfileClientView({
  candidate: initialCandidate,
  auditLogs,
  currentUser,
  activeRecruiters,
}: CandidateProfileClientViewProps) {
  const router = useRouter();
  const [candidate, setCandidate] = useState<CandidateProfile>(initialCandidate);
  const [activeTab, setActiveTab] = useState<
    'Overview' | 'Resume' | 'Activity' | 'Interviews' | 'Submissions' | 'Archive'
  >('Overview');

  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Form states
  const [editForm, setEditForm] = useState({
    name: candidate.name || '',
    email: candidate.email || '',
    phone: candidate.phone || '',
    currentTitle: candidate.currentTitle || '',
    currentCompany: candidate.currentCompany || '',
    experienceYears: candidate.experienceYears ? Number(candidate.experienceYears) : '',
    currentSalary: candidate.currentSalary ? Number(candidate.currentSalary) : '',
    expectedSalary: candidate.expectedSalary ? Number(candidate.expectedSalary) : '',
    noticePeriod: candidate.noticePeriod || '',
    location: candidate.location || '',
    skillsString: (candidate.skills || []).join(', '),
  });

  const [noteContent, setNoteContent] = useState('');
  const [tagName, setTagName] = useState('');
  const [handoverData, setHandoverData] = useState({ newOwnerId: '', reason: '' });
  const [archiveReason, setArchiveReason] = useState('');
  const [restoreReason, setRestoreReason] = useState('');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, startTransition] = useTransition();

  // Helper: Flash message
  function flash(text: string, type: 'success' | 'error' = 'success') {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 5000);
  }

  // Handle Edit Submit
  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    const skills = editForm.skillsString
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);

    startTransition(async () => {
      const res = await updateCandidateAction(candidate.id, {
        name: editForm.name,
        email: editForm.email || undefined,
        phone: editForm.phone || undefined,
        currentTitle: editForm.currentTitle || undefined,
        currentCompany: editForm.currentCompany || undefined,
        experienceYears: editForm.experienceYears !== '' ? Number(editForm.experienceYears) : null,
        currentSalary: editForm.currentSalary !== '' ? Number(editForm.currentSalary) : null,
        expectedSalary: editForm.expectedSalary !== '' ? Number(editForm.expectedSalary) : null,
        noticePeriod: editForm.noticePeriod || undefined,
        location: editForm.location || undefined,
        skills,
      });

      if (res.success && res.candidate) {
        setCandidate((prev) => ({
          ...prev,
          name: res.candidate.name,
          email: res.candidate.email,
          phone: res.candidate.phone,
          currentTitle: res.candidate.currentTitle,
          currentCompany: res.candidate.currentCompany,
          experienceYears: res.candidate.experienceYears ? Number(res.candidate.experienceYears) : null,
          currentSalary: res.candidate.currentSalary ? Number(res.candidate.currentSalary) : null,
          expectedSalary: res.candidate.expectedSalary ? Number(res.candidate.expectedSalary) : null,
          noticePeriod: res.candidate.noticePeriod,
          location: res.candidate.location,
          skills: res.candidate.skills,
        }));
        setShowEditModal(false);
        flash('Candidate profile updated successfully.');
        router.refresh();
      } else {
        flash(res.error || 'Failed to update candidate', 'error');
      }
    });
  }

  // Handle Add Note
  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteContent.trim()) return;

    startTransition(async () => {
      const res = await addCandidateNoteAction(candidate.id, {
        content: noteContent,
        isInternalOnly: true,
      });

      if (res.success && res.note) {
        const formattedNote = {
          id: res.note.id,
          content: res.note.content,
          isInternalOnly: res.note.isInternalOnly,
          createdAt: new Date(res.note.createdAt).toISOString(),
          author: res.note.author,
        };
        setCandidate((prev) => ({
          ...prev,
          notes: [formattedNote, ...(prev.notes || [])],
        }));
        setNoteContent('');
        setShowNoteModal(false);
        flash('Internal note added.');
        router.refresh();
      } else {
        flash(res.error || 'Failed to add note', 'error');
      }
    });
  }

  // Handle Delete Note
  async function handleDeleteNote(noteId: string) {
    if (!confirm('Are you sure you want to delete this internal note?')) return;

    startTransition(async () => {
      const res = await deleteCandidateNoteAction(noteId);
      if (res.success) {
        setCandidate((prev) => ({
          ...prev,
          notes: (prev.notes || []).filter((n) => n.id !== noteId),
        }));
        flash('Note deleted.');
        router.refresh();
      } else {
        flash(res.error || 'Failed to delete note', 'error');
      }
    });
  }

  // Handle Add Tag
  async function handleAddTag(e: React.FormEvent) {
    e.preventDefault();
    if (!tagName.trim()) return;

    startTransition(async () => {
      const res = await addCandidateTagAction(candidate.id, tagName.trim());
      if (res.success && res.tag) {
        setCandidate((prev) => ({
          ...prev,
          tags: [...(prev.tags || []), res.tag],
        }));
        setTagName('');
        setShowTagModal(false);
        flash(`Tag "${res.tag.name}" added.`);
        router.refresh();
      } else {
        flash(res.error || 'Failed to add tag', 'error');
      }
    });
  }

  // Handle Remove Tag
  async function handleRemoveTag(tagId: string) {
    startTransition(async () => {
      const res = await removeCandidateTagAction(candidate.id, tagId);
      if (res.success) {
        setCandidate((prev) => ({
          ...prev,
          tags: (prev.tags || []).filter((t) => t.id !== tagId),
        }));
        router.refresh();
      } else {
        flash(res.error || 'Failed to remove tag', 'error');
      }
    });
  }

  // Handle Handover
  async function handleHandoverSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!handoverData.newOwnerId || !handoverData.reason) return;

    startTransition(async () => {
      const res = await handoverCandidateAction(candidate.id, handoverData);
      if (res.success && res.candidate) {
        const newOwner = activeRecruiters.find((r) => r.id === handoverData.newOwnerId);
        setCandidate((prev) => ({
          ...prev,
          ownerId: res.candidate.ownerId,
          owner: newOwner || prev.owner,
        }));
        setShowHandoverModal(false);
        setHandoverData({ newOwnerId: '', reason: '' });
        flash(res.message || 'Ownership transferred.');
        router.refresh();
      } else {
        flash(res.error || 'Failed to handover candidate', 'error');
      }
    });
  }

  // Handle Archive
  async function handleArchiveSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!archiveReason) return;

    startTransition(async () => {
      const res = await archiveCandidateAction(candidate.id, { reason: archiveReason });
      if (res.success && res.candidate) {
        setCandidate((prev) => ({
          ...prev,
          isArchived: true,
          archivedAt: res.candidate.archivedAt ? new Date(res.candidate.archivedAt).toISOString() : null,
          archiveReason: res.candidate.archiveReason,
        }));
        setShowArchiveModal(false);
        setArchiveReason('');
        flash('Candidate moved to archive.');
        router.refresh();
      } else {
        flash(res.error || 'Failed to archive candidate', 'error');
      }
    });
  }

  // Handle Restore
  async function handleRestoreSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await restoreCandidateAction(candidate.id, { reason: restoreReason });
      if (res.success && res.candidate) {
        setCandidate((prev) => ({
          ...prev,
          isArchived: false,
          archivedAt: null,
          archiveReason: null,
        }));
        setShowRestoreModal(false);
        setRestoreReason('');
        flash('Candidate restored to active pipeline.');
        router.refresh();
      } else {
        flash(res.error || 'Failed to restore candidate', 'error');
      }
    });
  }

  const latestApp = candidate.applications?.[0];
  const isClient = currentUser?.role === UserRole.CLIENT;
  const isCandidateUser = currentUser?.role === UserRole.CANDIDATE;
  const initials = candidate.name
    .trim()
    .split(/\s+/)
    .map((p: string) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6">
      {/* Flash Alert */}
      {actionMessage && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            actionMessage.type === 'success'
              ? 'bg-[#E3F6EC] border-[#12B76A]/30 text-[#12B76A]'
              : 'bg-[#FDECEC] border-[#E5484D]/30 text-[#E5484D]'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Breadcrumb Header */}
      <PageHeader
        title="Candidate Profile"
        subtitle={`Candidate ID: ${candidate.code} · Aureva Capital Talent Pool`}
        breadcrumbs={[{ label: 'Candidates', href: '/candidates' }, { label: candidate.name }]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEditModal(true)}
              className="px-3.5 py-2 bg-white border border-[#E6E8F0] hover:bg-[#F6F7FB] text-[#1B2236] rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Edit className="w-3.5 h-3.5 text-[#5B49D6]" />
              <span>+ Edit candidate</span>
            </button>
          </div>
        }
      />

      {/* Top Header Card (Matching Figma Frame 03) */}
      <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs p-6 relative">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left: Avatar + Details */}
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#EEEBFB] text-[#5B49D6] font-bold text-xl flex items-center justify-center shrink-0 border-2 border-[#5B49D6]/20 shadow-xs">
              {initials}
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-xl font-bold text-[#1B2236]">{candidate.name}</h1>
                {/* Stage Badge */}
                {candidate.isArchived ? (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#F1F3F9] text-[#6B7490]">
                    Archived
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#E5F0FF] text-[#3B82F6]">
                    {latestApp?.status || 'Technical interview'}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#6B7490]">
                {candidate.currentTitle || 'Software Engineer'} · {candidate.location || 'Mumbai'} ·{' '}
                {formatExperience(candidate.experienceYears ? Number(candidate.experienceYears) : null)}
              </p>
              {/* Owner info */}
              <div className="flex items-center gap-2 pt-1 text-xs text-[#6B7490]">
                <span className="font-medium">
                  Owner: <strong className="text-[#1B2236]">{candidate.owner?.name || 'Unassigned'}</strong>
                </span>
                {!isClient && !isCandidateUser && (
                  <button
                    onClick={() => setShowHandoverModal(true)}
                    className="text-[#5B49D6] hover:underline font-semibold text-[11px] ml-1 flex items-center gap-1"
                  >
                    <ArrowRightLeft className="w-3 h-3" />
                    <span>Handover</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right: Action Buttons (Matching Figma Frame 03) */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() =>
                alert('Interview scheduler launches in Phase 1 (Prompt 11: Interview Operations).')
              }
              className="px-4 py-2 bg-[#5B49D6] hover:bg-[#5B49D6]/90 text-white rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Schedule interview</span>
            </button>

            {/* More Menu Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="p-2 bg-white border border-[#E6E8F0] hover:bg-[#F6F7FB] text-[#1B2236] rounded-lg text-xs font-semibold transition-all"
              >
                <MoreVertical className="w-4 h-4 text-[#6B7490]" />
              </button>

              {showMoreMenu && (
                <div
                  className="absolute right-0 mt-2 w-48 bg-white border border-[#E6E8F0] rounded-xl shadow-lg z-20 py-1 divide-y divide-[#E6E8F0]"
                  onMouseLeave={() => setShowMoreMenu(false)}
                >
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        setShowNoteModal(true);
                      }}
                      className="w-full px-4 py-2 text-left text-xs text-[#1B2236] hover:bg-[#F6F7FB] flex items-center gap-2"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-[#6B7490]" />
                      <span>Add internal note</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        setShowTagModal(true);
                      }}
                      className="w-full px-4 py-2 text-left text-xs text-[#1B2236] hover:bg-[#F6F7FB] flex items-center gap-2"
                    >
                      <Tag className="w-3.5 h-3.5 text-[#6B7490]" />
                      <span>Manage tags</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        setShowHandoverModal(true);
                      }}
                      className="w-full px-4 py-2 text-left text-xs text-[#1B2236] hover:bg-[#F6F7FB] flex items-center gap-2"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 text-[#6B7490]" />
                      <span>Handover candidate</span>
                    </button>
                  </div>
                  <div className="py-1">
                    {candidate.isArchived ? (
                      <button
                        onClick={() => {
                          setShowMoreMenu(false);
                          setShowRestoreModal(true);
                        }}
                        className="w-full px-4 py-2 text-left text-xs text-[#12B76A] hover:bg-[#E3F6EC] flex items-center gap-2 font-semibold"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Restore candidate</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setShowMoreMenu(false);
                          setShowArchiveModal(true);
                        }}
                        className="w-full px-4 py-2 text-left text-xs text-[#E5484D] hover:bg-[#FDECEC] flex items-center gap-2 font-semibold"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span>Archive candidate</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 6 Tabs Navigation (Matching Figma Frame 03) */}
        <div className="flex border-b border-[#E6E8F0] mt-6 gap-6 text-xs font-semibold overflow-x-auto">
          {(['Overview', 'Resume', 'Activity', 'Interviews', 'Submissions', 'Archive'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab
                  ? 'border-[#5B49D6] text-[#5B49D6]'
                  : 'border-transparent text-[#6B7490] hover:text-[#1B2236]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* -------------------------------------------------------------
          TAB 1: OVERVIEW (2 Columns Layout from Frame 03)
      -------------------------------------------------------------- */}
      {activeTab === 'Overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Candidate Overview Card (2 cols width) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-[#E6E8F0] pb-3">
                <h3 className="font-bold text-sm text-[#1B2236] flex items-center gap-2">
                  <User className="w-4 h-4 text-[#5B49D6]" />
                  <span>Candidate Overview</span>
                </h3>
                <button
                  onClick={() => setShowEditModal(true)}
                  className="text-xs text-[#5B49D6] hover:underline font-semibold flex items-center gap-1"
                >
                  <Edit className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              </div>

              {/* Key Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[#6B7490] block mb-1">Email Address</span>
                  <div className="font-semibold text-[#1B2236] flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#6B7490]" />
                    <a href={`mailto:${candidate.email}`} className="hover:text-[#5B49D6] hover:underline">
                      {candidate.email}
                    </a>
                  </div>
                </div>

                <div>
                  <span className="text-[#6B7490] block mb-1">Phone Number</span>
                  <div className="font-semibold text-[#1B2236] flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[#6B7490]" />
                    <span>{candidate.phone || '—'}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[#6B7490] block mb-1">Current Company</span>
                  <div className="font-semibold text-[#1B2236] flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#6B7490]" />
                    <span>{candidate.currentCompany || '—'}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[#6B7490] block mb-1">Location</span>
                  <div className="font-semibold text-[#1B2236] flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#6B7490]" />
                    <span>{candidate.location || '—'}</span>
                  </div>
                </div>

                {/* Salary details strictly hidden from Client Portal */}
                {!isClient && (
                  <>
                    <div>
                      <span className="text-[#6B7490] block mb-1">Current Salary</span>
                      <div className="font-bold text-[#1B2236] flex items-center gap-1.5">
                        <IndianRupee className="w-3.5 h-3.5 text-[#6B7490]" />
                        <span>{formatINR(candidate.currentSalary ? Number(candidate.currentSalary) : null)}</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[#6B7490] block mb-1">Expected Salary</span>
                      <div className="font-bold text-[#5B49D6] flex items-center gap-1.5">
                        <IndianRupee className="w-3.5 h-3.5 text-[#5B49D6]" />
                        <span>{formatINR(candidate.expectedSalary ? Number(candidate.expectedSalary) : null)}</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[#6B7490] block mb-1">Notice Period</span>
                      <div className="font-semibold text-[#1B2236] flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#6B7490]" />
                        <span>{candidate.noticePeriod || '30 days'}</span>
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <span className="text-[#6B7490] block mb-1">Source</span>
                  <div className="font-semibold text-[#1B2236]">
                    {candidate.source || 'Direct Ingestion'}
                  </div>
                </div>
              </div>

              {/* Skills Tags */}
              <div className="pt-2 border-t border-[#E6E8F0]">
                <span className="text-xs text-[#6B7490] font-semibold block mb-2">Technical Skills</span>
                <div className="flex flex-wrap gap-1.5">
                  {candidate.skills && candidate.skills.length > 0 ? (
                    candidate.skills.map((skill: string, idx: number) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg text-xs font-medium text-[#1B2236]"
                      >
                        {skill}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-[#6B7490]">No skills tagged yet.</span>
                  )}
                </div>
              </div>

              {/* Candidate Tags */}
              <div className="pt-2 border-t border-[#E6E8F0]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-[#6B7490] font-semibold">Candidate Tags</span>
                  <button
                    onClick={() => setShowTagModal(true)}
                    className="text-xs text-[#5B49D6] hover:underline font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add tag</span>
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {candidate.tags && candidate.tags.length > 0 ? (
                    candidate.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#EEEBFB] border border-[#5B49D6]/30 rounded-lg text-xs font-semibold text-[#5B49D6]"
                      >
                        <span>{tag.name}</span>
                        <button
                          onClick={() => handleRemoveTag(tag.id)}
                          className="hover:text-[#E5484D] transition-colors ml-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-[#6B7490]">No tags assigned.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Internal Notes Section (Strictly internal only, never shown to Client) */}
            {!isClient && (
              <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[#E6E8F0] pb-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[#5B49D6]" />
                    <h3 className="font-bold text-sm text-[#1B2236]">Internal Recruiter Notes</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF3DC] text-[#F59E0B]">
                      Internal only
                    </span>
                  </div>
                  <button
                    onClick={() => setShowNoteModal(true)}
                    className="px-3 py-1.5 bg-[#5B49D6] hover:bg-[#5B49D6]/90 text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Note</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {(candidate.notes || []).length === 0 ? (
                    <p className="text-xs text-[#6B7490] py-4 text-center">
                      No internal notes recorded yet. Click &quot;Add Note&quot; to write confidential recruiter notes.
                    </p>
                  ) : (
                    candidate.notes?.map((note) => (
                      <div
                        key={note.id}
                        className="p-3.5 rounded-lg border border-[#E6E8F0] bg-[#F6F7FB]/50 space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#1B2236] flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#5B49D6]" />
                            {note.author?.name || 'Recruiter'}
                          </span>
                          <div className="flex items-center gap-2 text-[#6B7490]">
                            <span>{new Date(note.createdAt).toLocaleDateString('en-GB')}</span>
                            <button
                              onClick={() => handleDeleteNote(note.id)}
                              className="text-[#6B7490] hover:text-[#E5484D] transition-colors"
                              title="Delete note"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-[#1B2236] leading-relaxed whitespace-pre-wrap">{note.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Activity Timeline & Interview History (1 col width) */}
          <div className="space-y-6">
            {/* Activity Timeline Card */}
            <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs p-6 space-y-4">
              <h3 className="font-bold text-sm text-[#1B2236] flex items-center gap-2 border-b border-[#E6E8F0] pb-3">
                <Clock className="w-4 h-4 text-[#5B49D6]" />
                <span>Activity Timeline</span>
              </h3>

              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E6E8F0]">
                {auditLogs.length === 0 ? (
                  <p className="text-xs text-[#6B7490]">No activity recorded yet.</p>
                ) : (
                  auditLogs.slice(0, 8).map((log, idx) => (
                    <div key={log.id || idx} className="relative text-xs space-y-0.5">
                      <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-[#5B49D6] ring-4 ring-white" />
                      <div className="font-bold text-[#1B2236]">
                        {log.action.replace('candidate.', '').replace('_', ' ').toUpperCase()}
                      </div>
                      <div className="text-[11px] text-[#6B7490]">
                        By {log.actor?.name || 'System'} ·{' '}
                        {new Date(log.createdAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Interview History Card */}
            <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs p-6 space-y-4">
              <h3 className="font-bold text-sm text-[#1B2236] flex items-center gap-2 border-b border-[#E6E8F0] pb-3">
                <Calendar className="w-4 h-4 text-[#5B49D6]" />
                <span>Interview History</span>
              </h3>

              {candidate.applications?.flatMap((a) => a.interviews || []).length === 0 ? (
                <p className="text-xs text-[#6B7490] py-2">No interviews scheduled yet.</p>
              ) : (
                <div className="space-y-3">
                  {candidate.applications
                    ?.flatMap((a) => a.interviews || [])
                    .map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between font-bold text-[#1B2236]">
                          <span>{item.round?.name || 'Technical Round'}</span>
                          <span className="px-2 py-0.5 bg-[#E5F0FF] text-[#3B82F6] rounded text-[10px]">
                            {item.mode || 'VIDEO'}
                          </span>
                        </div>
                        <div className="text-[#6B7490] text-[11px]">
                          Scheduled: {new Date(item.scheduledAt).toLocaleString('en-GB')}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 2: RESUME
      -------------------------------------------------------------- */}
      {activeTab === 'Resume' && (
        <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E6E8F0] pb-3">
            <h3 className="font-bold text-sm text-[#1B2236] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#5B49D6]" />
              <span>Candidate Resumes & Documents</span>
            </h3>
            <button
              onClick={() =>
                alert('Automated Resume Parser arrives in Prompt 8 (Resume Parser & Auto-Profile Generation).')
              }
              className="px-3.5 py-1.5 bg-[#5B49D6] hover:bg-[#5B49D6]/90 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Upload Resume (Prompt 8)</span>
            </button>
          </div>

          {(candidate.documents || []).length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <FileText className="w-10 h-10 text-[#6B7490]/40 mx-auto" />
              <p className="font-bold text-sm text-[#1B2236]">No resume attached yet</p>
              <p className="text-xs text-[#6B7490] max-w-sm mx-auto">
                Full LLM resume auto-parsing and document extraction arrives in Prompt 8.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {candidate.documents?.map((doc) => (
                <div
                  key={doc.id}
                  className="p-4 border border-[#E6E8F0] rounded-lg bg-[#F6F7FB]/40 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-[#5B49D6]" />
                    <div>
                      <div className="font-bold text-[#1B2236]">{doc.fileName}</div>
                      <div className="text-[11px] text-[#6B7490]">
                        Uploaded {new Date(doc.uploadedAt).toLocaleDateString('en-GB')} · Type: {doc.documentType}
                      </div>
                    </div>
                  </div>
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-white border border-[#E6E8F0] hover:bg-[#EEEBFB] rounded-lg font-semibold text-[#5B49D6] flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 3: ACTIVITY (Full Audit Trail)
      -------------------------------------------------------------- */}
      {activeTab === 'Activity' && (
        <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs p-6 space-y-4">
          <h3 className="font-bold text-sm text-[#1B2236] flex items-center gap-2 border-b border-[#E6E8F0] pb-3">
            <Clock className="w-4 h-4 text-[#5B49D6]" />
            <span>Complete Audit Trail ({auditLogs.length} events)</span>
          </h3>

          <div className="divide-y divide-[#E6E8F0]">
            {auditLogs.map((log) => (
              <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <div className="font-bold text-[#1B2236]">{log.action}</div>
                  <div className="text-[11px] text-[#6B7490]">
                    Actor: {log.actor?.name || log.actorId} ({log.actor?.role || 'Staff'}) · IP:{' '}
                    {log.ipAddress || '127.0.0.1'}
                  </div>
                </div>
                <div className="text-[11px] text-[#6B7490] font-medium">
                  {new Date(log.createdAt).toLocaleString('en-GB')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 4: INTERVIEWS
      -------------------------------------------------------------- */}
      {activeTab === 'Interviews' && (
        <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E6E8F0] pb-3">
            <h3 className="font-bold text-sm text-[#1B2236] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#5B49D6]" />
              <span>Interview Operations</span>
            </h3>
            <button
              onClick={() =>
                alert('Interview rounds management arrives in Prompt 11.')
              }
              className="px-3.5 py-1.5 bg-[#5B49D6] hover:bg-[#5B49D6]/90 text-white rounded-lg text-xs font-semibold"
            >
              + Schedule Round
            </button>
          </div>
          <p className="text-xs text-[#6B7490]">
            Full multi-round panel interview scheduling, calendar synchronization, and scorecards arrive in Prompt 11.
          </p>
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 5: SUBMISSIONS
      -------------------------------------------------------------- */}
      {activeTab === 'Submissions' && (
        <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E6E8F0] pb-3">
            <h3 className="font-bold text-sm text-[#1B2236] flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#5B49D6]" />
              <span>Client Submissions</span>
            </h3>
            <button
              onClick={() =>
                alert('Client submission workflows and 2-way client approvals arrive in Prompt 10.')
              }
              className="px-3.5 py-1.5 bg-[#5B49D6] hover:bg-[#5B49D6]/90 text-white rounded-lg text-xs font-semibold"
            >
              + Submit to Client
            </button>
          </div>
          <p className="text-xs text-[#6B7490]">
            Submission governance, client portal reviews, and blind resume sharing arrive in Prompt 10.
          </p>
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 6: ARCHIVE
      -------------------------------------------------------------- */}
      {activeTab === 'Archive' && (
        <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs p-6 space-y-4">
          <h3 className="font-bold text-sm text-[#1B2236] flex items-center gap-2 border-b border-[#E6E8F0] pb-3">
            <Archive className="w-4 h-4 text-[#5B49D6]" />
            <span>Archive Status & Retention Compliance</span>
          </h3>

          {candidate.isArchived ? (
            <div className="p-4 bg-[#FDECEC]/40 border border-[#E5484D]/30 rounded-xl space-y-3 text-xs">
              <div className="flex items-center gap-2 text-[#E5484D] font-bold">
                <AlertCircle className="w-4 h-4" />
                <span>Candidate is currently Soft-Archived</span>
              </div>
              <p className="text-[#1B2236]">
                <strong>Archive Reason:</strong> {candidate.archiveReason || 'No reason provided'}
              </p>
              <p className="text-[#6B7490]">
                Archived on {candidate.archivedAt ? new Date(candidate.archivedAt).toLocaleString('en-GB') : '—'}
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setShowRestoreModal(true)}
                  className="px-4 py-2 bg-[#12B76A] hover:bg-[#12B76A]/90 text-white rounded-lg font-semibold flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Restore Candidate to Active Pipeline</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-[#E3F6EC]/30 border border-[#12B76A]/30 rounded-xl space-y-3 text-xs">
              <div className="flex items-center gap-2 text-[#12B76A] font-bold">
                <CheckCircle className="w-4 h-4" />
                <span>Candidate is Active</span>
              </div>
              <p className="text-[#6B7490]">
                In compliance with HireFlow ATS data governance, candidate profiles are never permanently hard deleted.
                Soft archiving hides this candidate from active candidate lists while preserving audit logs and submission history.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setShowArchiveModal(true)}
                  className="px-4 py-2 bg-[#E5484D] hover:bg-[#E5484D]/90 text-white rounded-lg font-semibold flex items-center gap-1.5"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Archive Candidate Profile</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------
          MODALS
      -------------------------------------------------------------- */}

      {/* 1. Edit Candidate Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E6E8F0] pb-3">
              <h3 className="font-bold text-base text-[#1B2236]">Edit Candidate Profile</h3>
              <button onClick={() => setShowEditModal(false)} className="text-[#6B7490] hover:text-[#1B2236]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#1B2236] mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg outline-none focus:border-[#5B49D6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#1B2236] mb-1">Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg outline-none focus:border-[#5B49D6]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#1B2236] mb-1">Phone</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg outline-none focus:border-[#5B49D6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#1B2236] mb-1">Current Title</label>
                  <input
                    type="text"
                    value={editForm.currentTitle}
                    onChange={(e) => setEditForm({ ...editForm, currentTitle: e.target.value })}
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg outline-none focus:border-[#5B49D6]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#1B2236] mb-1">Current Company</label>
                  <input
                    type="text"
                    value={editForm.currentCompany}
                    onChange={(e) => setEditForm({ ...editForm, currentCompany: e.target.value })}
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg outline-none focus:border-[#5B49D6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#1B2236] mb-1">Experience (Years)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={editForm.experienceYears}
                    onChange={(e) => setEditForm({ ...editForm, experienceYears: e.target.value })}
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg outline-none focus:border-[#5B49D6]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#1B2236] mb-1">Current CTC (INR)</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.currentSalary}
                    onChange={(e) => setEditForm({ ...editForm, currentSalary: e.target.value })}
                    placeholder="e.g. 3200000"
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg outline-none focus:border-[#5B49D6]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#1B2236] mb-1">Expected CTC (INR)</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.expectedSalary}
                    onChange={(e) => setEditForm({ ...editForm, expectedSalary: e.target.value })}
                    placeholder="e.g. 4200000"
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg outline-none focus:border-[#5B49D6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#1B2236] mb-1">Location</label>
                  <input
                    type="text"
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg outline-none focus:border-[#5B49D6]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#1B2236] mb-1">Notice Period</label>
                  <input
                    type="text"
                    value={editForm.noticePeriod}
                    onChange={(e) => setEditForm({ ...editForm, noticePeriod: e.target.value })}
                    placeholder="e.g. 30 days"
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg outline-none focus:border-[#5B49D6]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#1B2236] mb-1">
                  Skills (comma-separated)
                </label>
                <input
                  type="text"
                  value={editForm.skillsString}
                  onChange={(e) => setEditForm({ ...editForm, skillsString: e.target.value })}
                  placeholder="e.g. React, TypeScript, Next.js, GraphQL"
                  className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg outline-none focus:border-[#5B49D6]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E6E8F0]">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-3.5 py-1.5 bg-[#F6F7FB] text-[#1B2236] rounded-lg font-medium hover:bg-[#E6E8F0]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-[#5B49D6] text-white rounded-lg font-semibold hover:bg-[#5B49D6]/90 disabled:opacity-50"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Add Note Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E6E8F0] pb-3">
              <h3 className="font-bold text-base text-[#1B2236] flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#5B49D6]" />
                <span>Add Internal Note</span>
              </h3>
              <button onClick={() => setShowNoteModal(false)} className="text-[#6B7490] hover:text-[#1B2236]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddNote} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#1B2236] mb-1">
                  Confidential Note (Internal Only)
                </label>
                <textarea
                  rows={4}
                  required
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Record interview notes, compensation discussions, or recruiter impressions..."
                  className="w-full p-2.5 border border-[#E6E8F0] rounded-lg outline-none focus:border-[#5B49D6]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNoteModal(false)}
                  className="px-3 py-1.5 bg-[#F6F7FB] text-[#1B2236] rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !noteContent.trim()}
                  className="px-4 py-1.5 bg-[#5B49D6] text-white rounded-lg font-semibold hover:bg-[#5B49D6]/90 disabled:opacity-50"
                >
                  Save Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Add Tag Modal */}
      {showTagModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E6E8F0] pb-3">
              <h3 className="font-bold text-base text-[#1B2236] flex items-center gap-2">
                <Tag className="w-4 h-4 text-[#5B49D6]" />
                <span>Add Candidate Tag</span>
              </h3>
              <button onClick={() => setShowTagModal(false)} className="text-[#6B7490] hover:text-[#1B2236]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddTag} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#1B2236] mb-1">Tag Name</label>
                <input
                  type="text"
                  required
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  placeholder="e.g. Immediate Joiner, High Priority"
                  className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg outline-none focus:border-[#5B49D6]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTagModal(false)}
                  className="px-3 py-1.5 bg-[#F6F7FB] text-[#1B2236] rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !tagName.trim()}
                  className="px-4 py-1.5 bg-[#5B49D6] text-white rounded-lg font-semibold hover:bg-[#5B49D6]/90 disabled:opacity-50"
                >
                  Add Tag
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Handover Modal */}
      {showHandoverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E6E8F0] pb-3">
              <h3 className="font-bold text-base text-[#1B2236] flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-[#5B49D6]" />
                <span>Handover Candidate Ownership</span>
              </h3>
              <button onClick={() => setShowHandoverModal(false)} className="text-[#6B7490] hover:text-[#1B2236]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleHandoverSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#1B2236] mb-1">Select New Owner *</label>
                <select
                  required
                  value={handoverData.newOwnerId}
                  onChange={(e) => setHandoverData({ ...handoverData, newOwnerId: e.target.value })}
                  className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg outline-none focus:border-[#5B49D6] bg-white"
                >
                  <option value="">-- Choose active recruiter --</option>
                  {activeRecruiters.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.role}) - {r.email}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-[#1B2236] mb-1">Handover Reason *</label>
                <textarea
                  required
                  rows={3}
                  value={handoverData.reason}
                  onChange={(e) => setHandoverData({ ...handoverData, reason: e.target.value })}
                  placeholder="e.g. Workload rebalancing, Bangalore mandate realignment"
                  className="w-full p-2.5 border border-[#E6E8F0] rounded-lg outline-none focus:border-[#5B49D6]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowHandoverModal(false)}
                  className="px-3 py-1.5 bg-[#F6F7FB] text-[#1B2236] rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !handoverData.newOwnerId || !handoverData.reason}
                  className="px-4 py-1.5 bg-[#5B49D6] text-white rounded-lg font-semibold hover:bg-[#5B49D6]/90 disabled:opacity-50"
                >
                  Confirm Handover
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Archive Modal */}
      {showArchiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E6E8F0] pb-3">
              <h3 className="font-bold text-base text-[#1B2236] flex items-center gap-2 text-[#E5484D]">
                <Archive className="w-4 h-4" />
                <span>Archive Candidate</span>
              </h3>
              <button onClick={() => setShowArchiveModal(false)} className="text-[#6B7490] hover:text-[#1B2236]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleArchiveSubmit} className="space-y-3 text-xs">
              <p className="text-[#6B7490]">
                Candidate will be soft-archived and hidden from active talent pipelines. Audit logs and records remain intact.
              </p>
              <div>
                <label className="block font-semibold text-[#1B2236] mb-1">Archive Reason *</label>
                <textarea
                  required
                  rows={3}
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  placeholder="e.g. Candidate accepted an offer elsewhere, salary mismatch"
                  className="w-full p-2.5 border border-[#E6E8F0] rounded-lg outline-none focus:border-[#5B49D6]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowArchiveModal(false)}
                  className="px-3 py-1.5 bg-[#F6F7FB] text-[#1B2236] rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !archiveReason.trim()}
                  className="px-4 py-1.5 bg-[#E5484D] text-white rounded-lg font-semibold hover:bg-[#E5484D]/90 disabled:opacity-50"
                >
                  Archive Candidate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Restore Modal */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E6E8F0] pb-3">
              <h3 className="font-bold text-base text-[#1B2236] flex items-center gap-2 text-[#12B76A]">
                <RefreshCw className="w-4 h-4" />
                <span>Restore Candidate to Pipeline</span>
              </h3>
              <button onClick={() => setShowRestoreModal(false)} className="text-[#6B7490] hover:text-[#1B2236]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleRestoreSubmit} className="space-y-3 text-xs">
              <p className="text-[#6B7490]">
                This will un-archive the candidate profile and return them to the active candidates talent pool.
              </p>
              <div>
                <label className="block font-semibold text-[#1B2236] mb-1">Restore Note (Optional)</label>
                <input
                  type="text"
                  value={restoreReason}
                  onChange={(e) => setRestoreReason(e.target.value)}
                  placeholder="e.g. Candidate re-engaged for new mandate"
                  className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg outline-none focus:border-[#5B49D6]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRestoreModal(false)}
                  className="px-3 py-1.5 bg-[#F6F7FB] text-[#1B2236] rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-[#12B76A] text-white rounded-lg font-semibold hover:bg-[#12B76A]/90 disabled:opacity-50"
                >
                  Restore Candidate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
