'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '../layout/PageHeader';
import { ClientSubmissionRowDTO } from '@hireflow/shared';
import {
  Search,
  Filter,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
} from 'lucide-react';

interface Props {
  initialSubmissions: ClientSubmissionRowDTO[];
}

export function ClientSubmissionsClientView({ initialSubmissions }: Props) {
  const [submissions] = useState<ClientSubmissionRowDTO[]>(initialSubmissions);
  const [search, setSearch] = useState('');
  const [decisionFilter, setDecisionFilter] = useState('ALL');

  const filtered = submissions.filter((sub) => {
    const matchesSearch =
      search.trim() === '' ||
      sub.candidateName.toLowerCase().includes(search.toLowerCase()) ||
      sub.candidateCode.toLowerCase().includes(search.toLowerCase()) ||
      sub.jobTitle.toLowerCase().includes(search.toLowerCase()) ||
      sub.skills.some((s) => s.toLowerCase().includes(search.toLowerCase()));

    const matchesDecision =
      decisionFilter === 'ALL' ||
      (decisionFilter === 'AWAITING_REVIEW' && !sub.clientDecision) ||
      sub.clientDecision === decisionFilter;

    return matchesSearch && matchesDecision;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Submitted Candidate Profiles"
        subtitle="Vetted and standardized candidate profiles presented by your dedicated HireFlow recruitment team."
        breadcrumbs={[{ label: 'Client Portal', href: '/portal' }, { label: 'Submitted Profiles' }]}
      />

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-[#E6E8F0] p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#6B7490] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search candidates, skills, or job codes..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg text-[#1B2236] placeholder-[#6B7490] outline-none focus:border-[#5B49D6]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-[#6B7490]" />
          <select
            value={decisionFilter}
            onChange={(e) => setDecisionFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg text-[#1B2236] outline-none focus:border-[#5B49D6]"
          >
            <option value="ALL">All Decisions</option>
            <option value="AWAITING_REVIEW">Awaiting Your Review</option>
            <option value="SHORTLISTED">Shortlisted</option>
            <option value="NEED_DETAILS">Details Requested</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Submissions List */}
      {filtered.length === 0 ? (
        <div className="p-12 bg-white rounded-xl border border-[#E6E8F0] text-center shadow-xs">
          <FileText className="w-10 h-10 text-[#6B7490]/40 mx-auto mb-3" />
          <h3 className="text-base font-bold text-[#1B2236]">No submitted profiles found</h3>
          <p className="text-xs text-[#6B7490] mt-1 max-w-sm mx-auto">
            {search || decisionFilter !== 'ALL'
              ? 'Try adjusting your search filters.'
              : 'When candidates are vetted and submitted by your talent team, they will appear here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((sub) => {
            const isShortlisted = sub.clientDecision === 'SHORTLISTED';
            const isRejected = sub.clientDecision === 'REJECTED';
            const isNeedDetails = sub.clientDecision === 'NEED_DETAILS';

            return (
              <div
                key={sub.id}
                className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs hover:border-[#5B49D6] transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-[#1B2236]">{sub.candidateName}</span>
                    <span className="text-xs font-mono font-medium text-[#6B7490] bg-[#F6F7FB] px-1.5 py-0.5 rounded border border-[#E6E8F0]">
                      {sub.candidateCode}
                    </span>
                    <span className="text-xs font-semibold text-[#5B49D6]">
                      • {sub.jobTitle} ({sub.jobCode})
                    </span>
                    {sub.matchScore !== null && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#EEEBFB] text-[#5B49D6]">
                        {sub.matchScore}% Match
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-[#6B7490]">{sub.experienceSummary}</div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {sub.skills.map((skill, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#F6F7FB] border border-[#E6E8F0] text-[#1B2236]"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>

                  <div className="text-[11px] text-[#6B7490] pt-1 flex items-center gap-3">
                    {sub.submittedAt && (
                      <span>Submitted on {new Date(sub.submittedAt).toLocaleDateString('en-GB')}</span>
                    )}
                    <span>• Version: <strong>{sub.currentVersionTag}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Status Badge */}
                  {isShortlisted && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#E3F6EC] text-[#12B76A]">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Shortlisted</span>
                    </span>
                  )}
                  {isRejected && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FEE2E2] text-[#E5484D]">
                      <AlertCircle className="w-3 h-3" />
                      <span>Rejected</span>
                    </span>
                  )}
                  {isNeedDetails && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FEF3DC] text-[#F59E0B]">
                      <Clock className="w-3 h-3" />
                      <span>Details Requested</span>
                    </span>
                  )}
                  {!sub.clientDecision && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#EEEBFB] text-[#5B49D6]">
                      <Clock className="w-3 h-3" />
                      <span>Awaiting Review</span>
                    </span>
                  )}

                  {/* Review Profile Action */}
                  <Link
                    href={`/portal/submissions/${sub.id}`}
                    className="px-3.5 py-2 bg-[#5B49D6] hover:bg-[#5B49D6]/90 text-white rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <span>Review Profile</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
