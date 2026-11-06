'use client';
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import React, { useState, useTransition } from 'react';
import {
  Send,
  Building2,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit3,
  HelpCircle,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { PageHeader } from '../layout/PageHeader';
import { StandardProfileModal } from './StandardProfileModal';
import { getSubmissionDetailAction } from '@/actions/submissions';
import { SubmissionRowDTO, SubmissionApprovalStatus } from '@hireflow/shared';

interface SubmissionsListClientViewProps {
  initialSubmissions: SubmissionRowDTO[];
  initialStats: { all: number; awaitingApproval: number; approved: number };
  initialPagination: { total: number; page: number; limit: number; totalPages: number };
  currentUser: { id: string; name: string; role: string };
}

export function SubmissionsListClientView({
  initialSubmissions,
  initialStats,
  initialPagination,
  currentUser,
}: SubmissionsListClientViewProps) {
  const [submissions, setSubmissions] = useState<SubmissionRowDTO[]>(initialSubmissions);
  const [stats, setStats] = useState(initialStats);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'AWAITING_APPROVAL' | 'APPROVED'>('ALL');
  const [search, setSearch] = useState('');
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [submissionDetail, setSubmissionDetail] = useState<any | null>(null);
  const [tooltipScoreId, setTooltipScoreId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Filter local rows
  const filteredSubmissions = submissions.filter((s) => {
    if (activeFilter === 'AWAITING_APPROVAL') {
      return s.approvalStatus === SubmissionApprovalStatus.PENDING_MANAGER_APPROVAL;
    }
    if (activeFilter === 'APPROVED') {
      return s.approvalStatus === SubmissionApprovalStatus.APPROVED;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        s.candidateName.toLowerCase().includes(q) ||
        s.candidateCode.toLowerCase().includes(q) ||
        s.jobTitle.toLowerCase().includes(q) ||
        s.clientName.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q)
      );
    }
    return true;
  });

  async function handleOpenDetail(id: string) {
    setSelectedSubmissionId(id);
    const res = await getSubmissionDetailAction(id);
    if (res.data) {
      setSubmissionDetail(res.data);
    }
  }

  async function handleRefresh() {
    if (selectedSubmissionId) {
      const res = await getSubmissionDetailAction(selectedSubmissionId);
      if (res.data) setSubmissionDetail(res.data);
    }
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client Submissions"
        subtitle="Review submission readiness, inspect deterministic candidate match scores, and present standard profiles to clients."
        breadcrumbs={[{ label: 'Submissions' }]}
      />

      {/* Filter Chips & Stats Strip (Figma Frame 07) */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-[#E6E8F0] shadow-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeFilter === 'ALL'
                ? 'bg-[#5B49D6] text-white shadow-xs'
                : 'bg-[#F6F7FB] text-[#6B7490] hover:text-[#1B2236]'
            }`}
          >
            <span>All Submissions</span>
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-mono">
              {stats.all}
            </span>
          </button>

          <button
            onClick={() => setActiveFilter('AWAITING_APPROVAL')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeFilter === 'AWAITING_APPROVAL'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Awaiting Approval</span>
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-mono">
              {stats.awaitingApproval}
            </span>
          </button>

          <button
            onClick={() => setActiveFilter('APPROVED')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeFilter === 'APPROVED'
                ? 'bg-[#12B76A] text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Approved for Client</span>
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-mono">
              {stats.approved}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7490]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search candidate, job or client..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#E6E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B49D6]"
          />
        </div>
      </div>

      {/* Submissions Table (Figma Frame 07) */}
      <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F6F7FB] text-[#6B7490] font-semibold uppercase tracking-wider border-b border-[#E6E8F0]">
            <tr>
              <th className="px-5 py-3.5">Candidate</th>
              <th className="px-5 py-3.5">Target Job & Client</th>
              <th className="px-5 py-3.5 text-center">Match %</th>
              <th className="px-5 py-3.5">Submitted By</th>
              <th className="px-5 py-3.5">Approval Status</th>
              <th className="px-5 py-3.5">Version</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E6E8F0] text-[#1B2236]">
            {filteredSubmissions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-[#6B7490]">
                  No candidate submissions match your current filter.
                </td>
              </tr>
            ) : (
              filteredSubmissions.map((s) => (
                <tr
                  key={s.id}
                  className="hover:bg-[#F6F7FB]/70 transition-colors cursor-pointer"
                  onClick={() => handleOpenDetail(s.id)}
                >
                  {/* Candidate */}
                  <td className="px-5 py-4">
                    <div className="font-bold text-[#1B2236]">{s.candidateName}</div>
                    <div className="text-[11px] font-mono text-[#6B7490] mt-0.5">{s.candidateCode}</div>
                  </td>

                  {/* Target Job & Client */}
                  <td className="px-5 py-4">
                    <div className="font-semibold text-[#1B2236]">{s.jobTitle}</div>
                    <div className="text-[11px] text-[#6B7490] flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3 h-3 text-[#5B49D6]" />
                      <span>{s.clientName}</span>
                    </div>
                  </td>

                  {/* Deterministic Match % */}
                  <td className="px-5 py-4 text-center">
                    <div className="inline-flex items-center gap-1 relative">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-xs ${
                          s.matchPercentage >= 85
                            ? 'bg-[#E3F6EC] text-[#12B76A]'
                            : s.matchPercentage >= 70
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {s.matchPercentage}%
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTooltipScoreId(tooltipScoreId === s.id ? null : s.id);
                        }}
                        className="text-gray-400 hover:text-[#5B49D6]"
                        title="Inspect deterministic calculation"
                      >
                        <HelpCircle className="w-3 h-3" />
                      </button>

                      {/* Match Tooltip */}
                      {tooltipScoreId === s.id && (
                        <div
                          className="absolute z-20 left-1/2 -translate-x-1/2 top-8 w-64 bg-[#1E2A4A] text-white text-[11px] rounded-lg p-3 shadow-xl text-left space-y-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="font-bold border-b border-white/20 pb-1 text-[#EEEBFB]">
                            Match Breakdown ({s.matchPercentage}%)
                          </div>
                          <div>Skills Overlap: 50% weight</div>
                          <div>Experience Fit: 25% weight</div>
                          <div>Location Alignment: 15% weight</div>
                          <div>Salary Fit: 10% weight</div>
                          <div className="text-[9px] text-gray-300 pt-1 border-t border-white/10">
                            Deterministic v1.0.0 · Zero LLM hallucination
                          </div>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Submitted By */}
                  <td className="px-5 py-4 text-[#6B7490]">
                    <div>{s.submittedByName}</div>
                    <div className="text-[10px] text-[#6B7490]/70">
                      {new Date(s.submittedAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </div>
                  </td>

                  {/* Approval Status */}
                  <td className="px-5 py-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        s.approvalStatus === 'APPROVED'
                          ? 'bg-[#E3F6EC] text-[#12B76A]'
                          : s.approvalStatus === 'PENDING_MANAGER_APPROVAL'
                          ? 'bg-amber-100 text-amber-800'
                          : s.approvalStatus === 'CHANGES_REQUESTED'
                          ? 'bg-orange-100 text-orange-800'
                          : s.approvalStatus === 'REJECTED'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {s.approvalStatus.replace(/_/g, ' ')}
                    </span>
                  </td>

                  {/* Version Tag */}
                  <td className="px-5 py-4">
                    <span className="font-mono text-xs bg-[#F6F7FB] border border-[#E6E8F0] px-2 py-0.5 rounded text-[#1B2236] font-semibold">
                      {s.versionTag}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDetail(s.id);
                      }}
                      className="text-xs text-[#5B49D6] hover:underline font-semibold"
                    >
                      View & Edit Profile
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#F6F7FB] border-t border-[#E6E8F0] flex items-center justify-between text-xs text-[#6B7490]">
          <span>
            Showing {filteredSubmissions.length} of {initialPagination.total} candidate submissions
          </span>
          <span className="text-[11px] font-medium text-[#5B49D6]">
            Standard Profile Generation & Client Presentation active
          </span>
        </div>
      </div>

      {/* Modal */}
      {selectedSubmissionId && submissionDetail && (
        <StandardProfileModal
          submissionDetail={submissionDetail}
          currentUser={currentUser}
          onClose={() => {
            setSelectedSubmissionId(null);
            setSubmissionDetail(null);
          }}
          onRefresh={handleRefresh}
        />
      )}
    </div>
  );
}
