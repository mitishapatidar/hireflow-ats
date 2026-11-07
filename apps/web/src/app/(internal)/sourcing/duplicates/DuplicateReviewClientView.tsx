'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  GitMerge,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Users,
  ShieldCheck,
  Building2,
  Briefcase,
  X,
  Loader2,
  ArrowRightLeft,
  FileText,
  MessageSquare,
  Tag,
  Calendar,
  Send,
  Award,
} from 'lucide-react';
import {
  previewMergeCandidatesAction,
  executeMergeCandidatesAction,
  resolveDuplicateDifferentAction,
} from '@/actions/sourcing';

interface CandidateBrief {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  currentCompany: string | null;
  currentTitle: string | null;
}

interface DuplicatePairItem {
  id: string;
  primaryCandidateId: string;
  duplicateCandidateId: string;
  score: number;
  reasons: string[];
  status: string;
  createdAt: string | Date;
  primaryCandidate?: CandidateBrief | null;
  duplicateCandidate?: CandidateBrief | null;
}

interface DuplicateReviewClientViewProps {
  initialPairs: DuplicatePairItem[];
  availableCandidates: CandidateBrief[];
  currentUser: {
    id: string;
    name: string;
    role: string;
  };
}

export function DuplicateReviewClientView({
  initialPairs,
  availableCandidates,
  currentUser,
}: DuplicateReviewClientViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<'pairs' | 'manual'>('pairs');

  // Manual Selection state
  const [manualMasterId, setManualMasterId] = useState('');
  const [manualSecondaryId, setManualSecondaryId] = useState('');

  // Side-by-Side Merge Studio Modal state
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<{
    master: any;
    secondary: any;
    comparison: Record<string, { master: any; secondary: any; label: string }>;
    mergedSkills: string[];
    preservedCounts: Record<string, number>;
  } | null>(null);

  // Field Selection map: field -> 'MASTER' | 'SECONDARY'
  const [selectedFields, setSelectedFields] = useState<Record<string, 'MASTER' | 'SECONDARY'>>({
    name: 'MASTER',
    email: 'MASTER',
    phone: 'MASTER',
    currentCompany: 'MASTER',
    currentTitle: 'MASTER',
    location: 'MASTER',
    experienceYears: 'MASTER',
  });

  const [mergeReason, setMergeReason] = useState('Duplicate record merged during sourcing review');
  const [confirmationInput, setConfirmationInput] = useState('');
  const [mergeError, setMergeError] = useState<string | null>(null);

  // Open Merge Studio with two candidate IDs
  const openMergeStudio = async (masterId: string, secondaryId: string) => {
    setIsLoadingPreview(true);
    setMergeError(null);
    setConfirmationInput('');

    const res = await previewMergeCandidatesAction(masterId, secondaryId);
    setIsLoadingPreview(false);

    if (res.success && res.data) {
      setPreviewData(res.data);
      // Default all fields to master
      const defaults: Record<string, 'MASTER' | 'SECONDARY'> = {};
      Object.keys(res.data.comparison).forEach((k) => {
        // If master value is empty and secondary has value, default to secondary
        if (!res.data.comparison[k].master && res.data.comparison[k].secondary) {
          defaults[k] = 'SECONDARY';
        } else {
          defaults[k] = 'MASTER';
        }
      });
      setSelectedFields(defaults);
      setIsMergeModalOpen(true);
    } else {
      alert((res as any).error || 'Failed to load candidate comparison');
    }
  };

  // Swap Master and Secondary
  const handleSwapCandidates = async () => {
    if (!previewData) return;
    openMergeStudio(previewData.secondary.id, previewData.master.id);
  };

  // Execute Non-Destructive Merge
  const handleExecuteMerge = () => {
    if (!previewData) return;
    if (confirmationInput.trim() !== 'MERGE') {
      setMergeError('Please type "MERGE" in all caps to confirm.');
      return;
    }

    setMergeError(null);
    startTransition(async () => {
      const res = await executeMergeCandidatesAction({
        masterCandidateId: previewData.master.id,
        secondaryCandidateId: previewData.secondary.id,
        mergeReason,
        fieldsRetained: selectedFields,
        confirmation: 'MERGE',
      });

      if (res.success) {
        alert('Candidates successfully merged! Secondary profile has been soft-archived.');
        setIsMergeModalOpen(false);
        router.refresh();
      } else {
        setMergeError((res as any).error || 'Failed to complete merge.');
      }
    });
  };

  // Resolve as Different
  const handleResolveDifferent = (pairId: string) => {
    startTransition(async () => {
      const res = await resolveDuplicateDifferentAction(pairId, 'Marked as different individual by recruiter');
      if (res.success) {
        router.refresh();
      } else {
        alert((res as any).error || 'Failed to resolve duplicate pair');
      }
    });
  };

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <Link href="/sourcing" className="hover:text-slate-800 flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" />
            Sourcing Workspace
          </Link>
          <span>/</span>
          <span className="font-medium text-slate-700">Duplicate Review & Merge</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1E2A4A]">Duplicate Review & Merge Studio</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Figma Frame 19: Inspect flagged duplicates, compare side-by-side, resolve field conflicts, and merge non-destructively.
            </p>
          </div>
          <Link
            href="/sourcing"
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Back to Workspace
          </Link>
        </div>
      </div>

      {/* Security Reassurance Callout */}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-[#5B49D6] shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-950 space-y-0.5">
          <p className="font-semibold text-[#1E2A4A]">ATS Security & Zero-Loss Merge Policy:</p>
          <p className="text-slate-600">
            Candidate merges are strictly non-destructive. All resumes, notes, tags, applications, interview logs, submissions, and placements are re-associated with the master record. The secondary candidate is soft-archived with bidirectional audit references.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('pairs')}
          className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
            activeTab === 'pairs'
              ? 'border-[#5B49D6] text-[#5B49D6]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Flagged Duplicate Pairs ({initialPairs.filter((p) => p.status === 'PENDING').length})
        </button>
        <button
          onClick={() => setActiveTab('manual')}
          className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
            activeTab === 'manual'
              ? 'border-[#5B49D6] text-[#5B49D6]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Manual Candidate Merge Tool
        </button>
      </div>

      {/* TAB 1: Flagged Duplicate Pairs Table */}
      {activeTab === 'pairs' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3.5">Primary Record</th>
                <th className="px-6 py-3.5">Duplicate Candidate</th>
                <th className="px-6 py-3.5">Confidence Score</th>
                <th className="px-6 py-3.5">Matching Criteria</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {initialPairs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-xs text-slate-400">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                    No duplicate pairs flagged! Your candidate database is clean.
                  </td>
                </tr>
              ) : (
                initialPairs.map((pair) => (
                  <tr key={pair.id} className="hover:bg-slate-50/70 transition">
                    {/* Primary Candidate */}
                    <td className="px-6 py-4">
                      <div className="font-semibold text-[#1E2A4A]">
                        {pair.primaryCandidate?.fullName || 'Candidate A'}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {pair.primaryCandidate?.email || 'No email'}
                      </div>
                      {pair.primaryCandidate?.currentCompany && (
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Building2 className="h-3 w-3" />
                          {pair.primaryCandidate.currentCompany}
                        </div>
                      )}
                    </td>

                    {/* Duplicate Candidate */}
                    <td className="px-6 py-4">
                      <div className="font-semibold text-[#1E2A4A]">
                        {pair.duplicateCandidate?.fullName || 'Candidate B'}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {pair.duplicateCandidate?.email || 'No email'}
                      </div>
                      {pair.duplicateCandidate?.currentCompany && (
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Building2 className="h-3 w-3" />
                          {pair.duplicateCandidate.currentCompany}
                        </div>
                      )}
                    </td>

                    {/* Confidence Score */}
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700 border border-rose-200">
                        <AlertTriangle className="h-3 w-3" />
                        {pair.score}% Match
                      </span>
                    </td>

                    {/* Reasons */}
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {pair.reasons.map((r, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                          pair.status === 'MERGED'
                            ? 'bg-purple-100 text-purple-800'
                            : pair.status === 'RESOLVED_DIFFERENT'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {pair.status.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      {pair.status === 'PENDING' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openMergeStudio(pair.primaryCandidateId, pair.duplicateCandidateId)}
                            className="inline-flex items-center gap-1 rounded-md bg-[#5B49D6] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4C3EC2] transition shadow-sm"
                          >
                            <GitMerge className="h-3 w-3" />
                            Compare & Merge
                          </button>
                          <button
                            onClick={() => handleResolveDifferent(pair.id)}
                            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
                            title="Mark as different persons"
                          >
                            Different
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">Resolved</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: Manual Candidate Merge Tool */}
      {activeTab === 'manual' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div>
            <h2 className="text-base font-semibold text-[#1E2A4A]">Manual Candidate Merge</h2>
            <p className="text-xs text-slate-500">
              Select any two active candidates to initiate a side-by-side comparison and merge.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Candidate A (Master Record — Retained)
              </label>
              <select
                value={manualMasterId}
                onChange={(e) => setManualMasterId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-[#5B49D6] focus:outline-none"
              >
                <option value="">Select Candidate A...</option>
                {availableCandidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} ({c.email || c.currentCompany || 'No email'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Candidate B (Secondary Record — Soft-Archived)
              </label>
              <select
                value={manualSecondaryId}
                onChange={(e) => setManualSecondaryId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-[#5B49D6] focus:outline-none"
              >
                <option value="">Select Candidate B...</option>
                {availableCandidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} ({c.email || c.currentCompany || 'No email'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => {
                if (!manualMasterId || !manualSecondaryId) {
                  alert('Please select both candidates.');
                  return;
                }
                if (manualMasterId === manualSecondaryId) {
                  alert('Cannot merge a candidate with themselves.');
                  return;
                }
                openMergeStudio(manualMasterId, manualSecondaryId);
              }}
              disabled={!manualMasterId || !manualSecondaryId || manualMasterId === manualSecondaryId}
              className="inline-flex items-center gap-2 rounded-lg bg-[#5B49D6] px-5 py-2 text-xs font-semibold text-white hover:bg-[#4C3EC2] disabled:opacity-50 transition shadow-sm"
            >
              <GitMerge className="h-4 w-4" />
              Launch Side-by-Side Merge Studio
            </button>
          </div>
        </div>
      )}

      {/* Side-by-Side Merge Studio Modal (Figma Frame 19) */}
      {isMergeModalOpen && previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <GitMerge className="h-5 w-5 text-[#5B49D6]" />
                <div>
                  <h3 className="text-base font-bold text-[#1E2A4A]">Candidate Merge Studio</h3>
                  <p className="text-xs text-slate-500">
                    Select which values to retain. All history, notes, and documents are preserved automatically.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSwapCandidates}
                  className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  title="Swap which record is Master"
                >
                  <ArrowRightLeft className="h-3 w-3" />
                  Swap Master
                </button>
                <button
                  onClick={() => setIsMergeModalOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Side-by-Side Comparison */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {/* Preserved Entity Counts Banner */}
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 mb-1">
                  <ShieldCheck className="h-4 w-4 text-emerald-700" />
                  <span>Preserved Secondary Records (Transferred into Master):</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-emerald-800">
                  <span>📄 {previewData.preservedCounts.documents} Documents</span>
                  <span>📝 {previewData.preservedCounts.notes} Recruiter Notes</span>
                  <span>🏷️ {previewData.preservedCounts.tags} Tags</span>
                  <span>💼 {previewData.preservedCounts.applications} Applications</span>
                  <span>🗓️ {previewData.preservedCounts.interviews} Interviews</span>
                  <span>📤 {previewData.preservedCounts.submissions} Submissions</span>
                  <span>🎉 {previewData.preservedCounts.offers} Offers</span>
                  <span>🤝 {previewData.preservedCounts.placements} Placements</span>
                </div>
              </div>

              {/* Conflict Resolution Table */}
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                    <tr>
                      <th className="px-4 py-3 w-1/4">Field</th>
                      <th className="px-4 py-3 w-3/8 bg-indigo-50/40">
                        Master Record (Retained ID: {previewData.master.id.substring(0, 8)}...)
                      </th>
                      <th className="px-4 py-3 w-3/8 bg-amber-50/40">
                        Secondary Record (To Soft-Archive: {previewData.secondary.id.substring(0, 8)}...)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Object.entries(previewData.comparison).map(([fieldKey, comp]) => {
                      const isMasterSelected = selectedFields[fieldKey] === 'MASTER';
                      return (
                        <tr key={fieldKey} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-semibold text-slate-700">
                            {comp.label}
                          </td>

                          {/* Master Option */}
                          <td
                            onClick={() => setSelectedFields((prev) => ({ ...prev, [fieldKey]: 'MASTER' }))}
                            className={`px-4 py-3 cursor-pointer transition ${
                              isMasterSelected ? 'bg-indigo-50 font-bold text-indigo-900' : 'text-slate-600'
                            }`}
                          >
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name={`field_${fieldKey}`}
                                checked={isMasterSelected}
                                onChange={() =>
                                  setSelectedFields((prev) => ({ ...prev, [fieldKey]: 'MASTER' }))
                                }
                                className="text-[#5B49D6]"
                              />
                              <span>{comp.master !== null && comp.master !== undefined ? String(comp.master) : '—'}</span>
                            </label>
                          </td>

                          {/* Secondary Option */}
                          <td
                            onClick={() => setSelectedFields((prev) => ({ ...prev, [fieldKey]: 'SECONDARY' }))}
                            className={`px-4 py-3 cursor-pointer transition ${
                              !isMasterSelected ? 'bg-amber-50 font-bold text-amber-900' : 'text-slate-600'
                            }`}
                          >
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name={`field_${fieldKey}`}
                                checked={!isMasterSelected}
                                onChange={() =>
                                  setSelectedFields((prev) => ({ ...prev, [fieldKey]: 'SECONDARY' }))
                                }
                                className="text-amber-600"
                              />
                              <span>{comp.secondary !== null && comp.secondary !== undefined ? String(comp.secondary) : '—'}</span>
                            </label>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Skills Union preview */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Merged Skills (Automatic Combined Union)
                </label>
                <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-slate-200 bg-slate-50 max-h-24 overflow-y-auto">
                  {previewData.mergedSkills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-[#5B49D6] border border-indigo-100"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Merge Reason */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Merge Audit Reason *</label>
                <input
                  type="text"
                  value={mergeReason}
                  onChange={(e) => setMergeReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-[#5B49D6] focus:outline-none"
                />
              </div>

              {/* Required "MERGE" Confirmation input */}
              <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-rose-900">
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                  <span>Mandatory Confirmation:</span>
                </div>
                <p className="text-xs text-rose-800">
                  To prevent accidental profile changes, please type <strong>MERGE</strong> below to confirm. Secondary candidate ({previewData.secondary.fullName}) will be soft-archived.
                </p>
                <input
                  type="text"
                  placeholder="Type MERGE to confirm"
                  value={confirmationInput}
                  onChange={(e) => setConfirmationInput(e.target.value)}
                  className="w-48 rounded border border-rose-300 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-rose-900 focus:border-rose-500 focus:outline-none bg-white"
                />
              </div>

              {mergeError && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-800">
                  {mergeError}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 bg-slate-50">
              <button
                type="button"
                onClick={() => setIsMergeModalOpen(false)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExecuteMerge}
                disabled={isPending || confirmationInput.trim() !== 'MERGE' || !mergeReason.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-[#5B49D6] px-5 py-2 text-xs font-semibold text-white hover:bg-[#4C3EC2] disabled:opacity-50 transition shadow-sm"
              >
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Execute Non-Destructive Merge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
